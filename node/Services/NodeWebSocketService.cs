using System;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Services
{
    /// <summary>
    /// Maintains a persistent WebSocket connection to the backend.
    /// Replaces the REST heartbeat timer and the REST job-poll loop.
    ///
    /// Protocol (node → backend):
    ///   node_connect  – sent once on open, carries nodeId + hardwareFingerprint
    ///   heartbeat     – every HeartbeatIntervalMs, carries resource stats
    ///   pong          – reply to server ping
    ///
    /// Protocol (backend → node):
    ///   ping          – server keep-alive probe
    ///   ack           – heartbeat acknowledged
    ///   job_assigned  – server pushes a new job; node starts rendering
    ///   disconnect    – server is shutting down / rejecting the node
    /// </summary>
    public class NodeWebSocketService : IDisposable
    {
        // ─── Configuration ─────────────────────────────────────────────────────

        private const int HeartbeatIntervalMs    = 25_000;   // 25 s  (server times out at 35 s)
        private const int MaxReconnectDelayMs     = 60_000;   // max 60 s back-off
        private const int InitialReconnectDelayMs = 1_000;    // start at 1 s

        // ─── Dependencies ──────────────────────────────────────────────────────

        private readonly ILogger _logger;
        private readonly string  _nodeId;
        private readonly string  _wsUrl;           // e.g. wss://host/ws
        private readonly string  _hardwareFingerprint;
        private readonly HardwareInfo? _hardware;

        // ─── Telemetry ─────────────────────────────────────────────────────────
        private PerformanceCounter? _cpuCounter;

        // ─── State ─────────────────────────────────────────────────────────────

        private ClientWebSocket? _ws;
        private CancellationTokenSource _cts = new();
        private int _reconnectDelay = InitialReconnectDelayMs;
        private bool _disposed;

        // ─── Job-push callback ─────────────────────────────────────────────────
        /// <summary>Raised when the backend pushes a <c>job_assigned</c> message.</summary>
        public event Func<JobAssignment, Task>? OnJobAssigned;

        /// <summary>Raised when the backend sends <c>request_job_poll</c> (e.g. a new job just appeared).</summary>
        public event Func<Task>? OnJobPollRequested;

        // ─── Public API ────────────────────────────────────────────────────────

        public bool IsConnected => _ws?.State == WebSocketState.Open;

        public NodeWebSocketService(
            ILogger logger,
            IConfiguration configuration,
            HardwareInfo? hardware,
            string nodeId)
        {
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
            _hardware = hardware;
            _nodeId = nodeId;

            var backendUrl = (configuration["Backend:Url"]
                              ?? "http://192.168.1.32:3000")
                             .TrimEnd('/');

            // Convert http(s) → ws(s)
            _wsUrl = backendUrl
                .Replace("https://", "wss://")
                .Replace("http://",  "ws://")
                + "/ws";

            _hardwareFingerprint = hardware?.HardwareFingerprint ?? string.Empty;

            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                try
                {
                    _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                    _cpuCounter.NextValue(); // First call always returns 0
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Failed to initialize CPU counter: {ex.Message}");
                }
            }

            _logger.LogInformation($"🔌 WebSocket URL: {_wsUrl}");
        }

        /// <summary>Starts the WebSocket loop; runs until <paramref name="stoppingToken"/> is cancelled.</summary>
        public async Task RunAsync(CancellationToken stoppingToken)
        {
            // Merge external cancel with our internal one
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, _cts.Token);
            var token = linked.Token;

            while (!token.IsCancellationRequested)
            {
                try
                {
                    await ConnectAndRunAsync(token);
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"⚠️  WebSocket disconnected: {ex.Message}. Reconnecting in {_reconnectDelay / 1000}s…");
                }

                if (token.IsCancellationRequested) break;

                await Task.Delay(_reconnectDelay, token).ConfigureAwait(false);
                _reconnectDelay = Math.Min(_reconnectDelay * 2, MaxReconnectDelayMs);
            }

            _logger.LogInformation("🔌 WebSocket service stopped.");
        }

        // ─── Private methods ───────────────────────────────────────────────────

        private async Task ConnectAndRunAsync(CancellationToken token)
        {
            _ws?.Dispose();
            _ws = new ClientWebSocket();

            // Accept self-signed / dev certs (same as the existing HttpClient)
            _ws.Options.RemoteCertificateValidationCallback =
                (_, _, _, _) => true;

            _logger.LogInformation($"🔗 Connecting to backend WebSocket: {_wsUrl}");
            await _ws.ConnectAsync(new Uri(_wsUrl), token);

            _logger.LogInformation($"✅ WebSocket connected to backend as: {_nodeId}");
            _reconnectDelay = InitialReconnectDelayMs;   // reset on success

            // Announce ourselves
            await SendAsync(new Dictionary<string, object>
            {
                ["type"]                = "node_connect",
                ["nodeId"]              = _nodeId,
                ["hardwareFingerprint"] = _hardwareFingerprint,
                ["hostname"]            = _hardware?.Ip.Hostname,
                ["localIP"]             = _hardware?.Ip.LocalIP,
                ["publicIP"]            = _hardware?.Ip.PublicIP,
                ["timestamp"]           = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            }, token);

            // Run receive-loop and heartbeat-loop concurrently
            using var hbCts = CancellationTokenSource.CreateLinkedTokenSource(token);
            var receiveTask   = ReceiveLoopAsync(token);
            var heartbeatTask = HeartbeatLoopAsync(hbCts.Token);

            // Whichever finishes first (disconnect / cancel) wins
            await Task.WhenAny(receiveTask, heartbeatTask);
            hbCts.Cancel();

            // Re-throw any real exception
            await receiveTask;
            await heartbeatTask;
        }

        private async Task ReceiveLoopAsync(CancellationToken token)
        {
            var buffer = new byte[16 * 1024];

            while (_ws!.State == WebSocketState.Open && !token.IsCancellationRequested)
            {
                var sb = new StringBuilder();
                WebSocketReceiveResult result;

                do
                {
                    result = await _ws.ReceiveAsync(buffer, token);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        _logger.LogInformation("🔌 Server closed the WebSocket connection.");
                        return;
                    }

                    sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                }
                while (!result.EndOfMessage);

                var json = sb.ToString();
                if (!string.IsNullOrWhiteSpace(json))
                    await HandleMessageAsync(json, token);
            }
        }

        private async Task HandleMessageAsync(string json, CancellationToken token)
        {
            try
            {
                var msg = JsonConvert.DeserializeObject<Dictionary<string, object>>(json);
                if (msg == null) return;

                var type = msg.GetValueOrDefault("type")?.ToString() ?? "";

                switch (type)
                {
                    case "ping":
                        await SendAsync(new Dictionary<string, object>
                        {
                            ["type"] = "pong",
                            ["nodeId"] = _nodeId,
                            ["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                        }, token);
                        break;

                    case "ack":
                        _logger.LogDebug("💓 Heartbeat acknowledged by server");
                        break;

                    case "job_assigned":
                        _logger.LogInformation($"📋 Job pushed via WebSocket: {json.Substring(0, Math.Min(200, json.Length))}");
                        if (OnJobAssigned != null)
                        {
                            var assignment = JsonConvert.DeserializeObject<JobAssignment>(json);
                            if (assignment != null)
                                await OnJobAssigned(assignment);
                        }
                        break;

                    case "request_job_poll":
                        _logger.LogInformation("📢 Backend requested job poll — calling /assign endpoint now");
                        if (OnJobPollRequested != null)
                        {
                            await OnJobPollRequested();
                        }
                        break;

                    case "command":
                        var cmd = msg.GetValueOrDefault("command")?.ToString() ?? "";
                        if (cmd == "node_rejected")
                        {
                            var reason = msg.GetValueOrDefault("reason")?.ToString() ?? "Unknown hardware issue";
                            _logger.LogCritical("\n" + new string('=', 60));
                            _logger.LogCritical("🚫 NODE REJECTED BY BACKEND");
                            _logger.LogCritical($"Reason: {reason}");
                            _logger.LogCritical(new string('=', 60) + "\n");
                            _logger.LogCritical("This node does not meet the requirements to remain on the network.");
                            _logger.LogCritical("💰 Tip: Update or upgrade your system to earn more from the network!");
                            _logger.LogCritical("The application will now shut down.");
                            
                            // Hard kill as requested by user
                            Environment.Exit(1);
                        }
                        break;

                    case "disconnect":
                        _logger.LogWarning($"⚠️  Server requested disconnect: {msg.GetValueOrDefault("reason")}");
                        return;

                    default:
                        _logger.LogDebug($"📨 WS message [{type}]: {json.Substring(0, Math.Min(150, json.Length))}");
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to handle WS message: {ex.Message}");
            }
        }

        private async Task HeartbeatLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested && _ws?.State == WebSocketState.Open)
            {
                await Task.Delay(HeartbeatIntervalMs, token);

                if (token.IsCancellationRequested) break;
                if (_ws.State != WebSocketState.Open) break;

                try
                {
                    var stats = GatherResourceStats();
                    await SendAsync(new Dictionary<string, object>
                    {
                        ["type"]      = "heartbeat",
                        ["nodeId"]    = _nodeId,
                        ["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        ["resources"] = stats,
                        // Include performance info if benchmark was run
                        ["performance"] = _hardware?.HardwareFingerprint != null ? new Dictionary<string, object>() : null
                    }, token);

                    _logger.LogDebug($"💓 Heartbeat sent for {_nodeId} (CPU: {stats["cpuPercent"]:F0}%)");
                }
                catch (Exception ex) when (!token.IsCancellationRequested)
                {
                    _logger.LogWarning($"Heartbeat send failed: {ex.Message}");
                    break;
                }
            }
        }

        private async Task SendAsync(object payload, CancellationToken token)
        {
            if (_ws?.State != WebSocketState.Open) return;

            var json  = JsonConvert.SerializeObject(payload);
            var bytes = Encoding.UTF8.GetBytes(json);
            await _ws.SendAsync(
                new ArraySegment<byte>(bytes),
                WebSocketMessageType.Text,
                endOfMessage: true,
                token);
        }

        private Dictionary<string, object> GatherResourceStats()
        {
            double cpuPercent   = 0;

            if (_cpuCounter != null)
            {
                try { cpuPercent = _cpuCounter.NextValue(); } catch { }
            }
            else if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // Simple Linux fallback: /proc/loadavg or similar could be used
                cpuPercent = 10.0; // dummy
            }
            long   ramUsedMB    = 0;
            long   ramTotalMB   = (long)((_hardware?.Ram.TotalMB) ?? 0);
            long   diskFreeMB   = 0;
            long   diskTotalMB  = (long)((_hardware?.Storage.TotalGB ?? 0) * 1024);

            try
            {
                var proc = Process.GetCurrentProcess();
                ramUsedMB = proc.WorkingSet64 / (1024 * 1024);
            }
            catch { }

            try
            {
                var drive = new System.IO.DriveInfo(
                    _hardware?.Storage.DriveLetter ?? "C:\\");
                diskFreeMB = drive.AvailableFreeSpace / (1024 * 1024);
            }
            catch { }

            return new Dictionary<string, object>
            {
                ["cpuPercent"]  = cpuPercent,
                ["ramUsedMB"]   = ramUsedMB,
                ["ramTotalMB"]  = ramTotalMB,
                ["diskFreeMB"]  = diskFreeMB,
                ["diskTotalMB"] = diskTotalMB
            };
        }

        // ─── IDisposable ───────────────────────────────────────────────────────

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _cts.Cancel();
            _ws?.Dispose();
            _cpuCounter?.Dispose();
            _cts.Dispose();
        }
    }
}
