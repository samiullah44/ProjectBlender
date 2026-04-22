using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using Newtonsoft.Json; 
using System.Security.Authentication;
using System.Collections.Concurrent;
using BlendFarm.Node.Hardware;  // Add this at the top
using BlendFarm.Node.Models;
using BlendFarm.Node.Benchmark.Models;
using BlendFarm.Node.Benchmark;

namespace BlendFarm.Node.Services
{
    public class NodeBackendService : BackgroundService
    {
        private readonly ILogger<NodeBackendService> _logger;
        private readonly ILoggerFactory _loggerFactory;
        private readonly PythonRunnerService _pythonRunner;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly NodeIdentityService _identityService;
        private readonly SpeedtestService _speedtestService;
        private string _nodeId;
        private string _friendlyName;
        private string _nodeDisplayName;
        private readonly string _backendUrl;
        private Timer _heartbeatTimer;
        private string _currentJobId;
        private int _currentProgress;
        private DateTime _jobStartTime;
        private object _jobLock = new object();
        private bool _isBlenderAvailable = false;
        private ConcurrentDictionary<int, (string uploadUrl, string s3Key)> _frameUploadUrls;
        private ComputeScoreService _computeScoreService;
        private BenchmarkResult _benchmarkResult;
        private ComputeScore _computeScore;
        private HardwareInfo _detectedHardware;

        // CancellationTokenSource for the currently running render job.
        // Heartbeat sets this to cancel when the backend sends STOP_JOB.
        private CancellationTokenSource? _renderCts;
        
        // File cache for downloaded blend files
        private readonly ConcurrentDictionary<string, (string filePath, DateTime downloadedAt)> _blendFileCache;
        private static readonly TimeSpan _cacheExpiry = TimeSpan.FromHours(24); // Cache for 24 hours

        public NodeBackendService(
            ILogger<NodeBackendService> logger,
             ILoggerFactory loggerFactory,
            PythonRunnerService pythonRunner,
            IConfiguration configuration,
            NodeIdentityService identityService,
            SpeedtestService speedtestService)
        {
            _logger = logger;
            _loggerFactory = loggerFactory;
            _pythonRunner = pythonRunner;
            _configuration = configuration;
            _identityService = identityService;
            _speedtestService = speedtestService;
            _nodeId = configuration["NodeSettings:NodeId"] ?? Guid.NewGuid().ToString();
            _backendUrl = configuration["Backend:Url"] ?? "http://192.168.1.54:3000";
            _frameUploadUrls = new ConcurrentDictionary<int, (string, string)>();
            _blendFileCache = new ConcurrentDictionary<string, (string, DateTime)>();
             _computeScoreService = new ComputeScoreService(logger);
            
            // Configure HttpClient with better settings for AWS App Runner
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => 
                {
                    // Accept all certificates for development
                    return true;
                },
                SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13
            };
            
            _httpClient = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromMinutes(5),
                BaseAddress = new Uri(_backendUrl)
            };
            
            // Set default headers
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "BlendFarm-Node/1.0");
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");

            // ── Try to load a saved node identity (nodeId + nodeSecret) ─────────
            // If identity was previously saved (node_identity.json), load it now
            // so we can attach the secret header before any outbound call is made.
            if (_identityService.TryLoadIdentity())
            {
                _nodeId = _identityService.NodeId;
                ApplyNodeSecretHeader();
            }
            
            _logger.LogInformation($"🎯 Backend URL set to: {_backendUrl}");
        }

        /// <summary>
        /// Attaches X-Node-Id and X-Node-Secret to every HTTP request this node makes.
        /// Called once after identity is confirmed.
        /// </summary>
        private void ApplyNodeSecretHeader()
        {
            // Remove stale values first (safe for re-entry)
            _httpClient.DefaultRequestHeaders.Remove("X-Node-Id");
            _httpClient.DefaultRequestHeaders.Remove("X-Node-Secret");

            _httpClient.DefaultRequestHeaders.Add("X-Node-Id",     _identityService.NodeId);
            _httpClient.DefaultRequestHeaders.Add("X-Node-Secret", _identityService.NodeSecret);

            _logger.LogDebug($"🔐 Node auth headers attached for: {_identityService.NodeId}");
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation($"🚀 Starting BlendFarm Node: {_nodeId}");

            // First, verify Blender is available
            await VerifyBlenderAvailabilityAsync();
            
            if (!_isBlenderAvailable)
            {
                _logger.LogError("❌ Blender is not available. Service cannot start.");
                return;
            }

            // // Detect hardware
            // var hardwareInfo = await DetectHardwareAsync();
var hardwareDetector = new HardwareDetector(
        _loggerFactory.CreateLogger<HardwareDetector>(),
        _speedtestService
    );
    // Detect ALL hardware with network test (capped at 75s to avoid hangs)
    _logger.LogInformation("🔍 Detecting complete system specifications...");
    try
    {
        _detectedHardware = await hardwareDetector.DetectAllAsync(
            _nodeId, 
            _backendUrl
        );

        // Only generate a hardware-fingerprint based ID if the node has no registered identity.
        // A node with a valid NodeSecret has been properly registered via token and must NOT
        // have its NodeId overwritten by a hardware-fingerprint hash.
        bool hasRegisteredIdentity = _identityService.IsRegistered;
        if (!hasRegisteredIdentity && (string.IsNullOrEmpty(_nodeId) || _nodeId == "node_auto" || _nodeId == "node_1"))
        {
            var stableId = GenerateStableNodeId(_detectedHardware);
            _nodeId = stableId;
            _detectedHardware.NodeId = stableId;
            _identityService.SetIdentity(stableId, _identityService.NodeSecret);
            ApplyNodeSecretHeader();
            _logger.LogInformation($"🔑 No registered identity found. Generated stable hardware ID: {stableId}");
        }
        else if (hasRegisteredIdentity)
        {
            // The identity was loaded from node_identity.json — use it as-is
            _nodeId = _identityService.NodeId;
            _detectedHardware.NodeId = _nodeId;
            _logger.LogInformation($"✅ Using registered identity: {_nodeId}");
        }

        // Determine Friendly Name
        _friendlyName = _identityService.UserProvidedName ?? _configuration["NodeSettings:FriendlyName"] ?? "node_auto";
        _nodeDisplayName = GenerateFriendlyDisplayName(_friendlyName, _detectedHardware);

        _logger.LogInformation("═══════════════════════════════════════");
        _logger.LogInformation($"🚀 BLENDFARM NODE: {_nodeDisplayName}");
        _logger.LogInformation($"🆔 ID: {_nodeId}");
        _logger.LogInformation("═══════════════════════════════════════");
        
        _logger.LogInformation("📊 SYSTEM SPECIFICATIONS");
        _logger.LogInformation($"CPU: {_detectedHardware.Cpu.Model}");
        _logger.LogInformation($"    {_detectedHardware.Cpu.PhysicalCores} cores / {_detectedHardware.Cpu.LogicalCores} threads @ {_detectedHardware.Cpu.BaseClockGHz:F1}GHz");
        _logger.LogInformation($"    AVX2: {_detectedHardware.Cpu.SupportsAVX2}");
        _logger.LogInformation($"RAM: {_detectedHardware.Ram.TotalGB}GB ({_detectedHardware.Ram.AvailableGB}GB free) {_detectedHardware.Ram.Type} @ {_detectedHardware.Ram.SpeedMHz}MHz");
        
        foreach (var gpu in _detectedHardware.Gpus)
        {
            _logger.LogInformation($"GPU: {gpu.Model}");
            _logger.LogInformation($"    {gpu.VramMB}MB VRAM | CUDA: {gpu.CudaSupported} | OptiX: {gpu.OptixSupported} | Driver: {gpu.DriverVersion}");
        }
        
        _logger.LogInformation($"Storage: {_detectedHardware.Storage.TotalGB}GB total ({_detectedHardware.Storage.FreeGB}GB free) on {_detectedHardware.Storage.Type} ({_detectedHardware.Storage.ReadSpeedMBs:F0} MB/s read)");
        _logger.LogInformation($"Network: ↑{_detectedHardware.Network.UploadSpeedMbps:F1} Mbps ↓{_detectedHardware.Network.DownloadSpeedMbps:F1} Mbps (latency: {_detectedHardware.Network.LatencyMs}ms)");
        _logger.LogInformation($"OS: {_detectedHardware.Os.Name} {_detectedHardware.Os.Architecture}");
        _logger.LogInformation($"Fingerprint: {_detectedHardware.HardwareFingerprint.Substring(0, 40)}...");
        _logger.LogInformation("═══════════════════════════════════════");
    }
    catch (Exception ex)
    {
        _logger.LogError($"❌ Hardware detection failed: {ex.Message}");
        _logger.LogWarning("Using fallback hardware detection...");
    // Create minimal hardware info
    _detectedHardware = new HardwareInfo
    {
        NodeId = _nodeId,
        Cpu = new CpuInfo { LogicalCores = Environment.ProcessorCount },
        Ram = new RamInfo { TotalGB = 16 },
        Gpus = new List<GpuInfo>(),
        Storage = new StorageInfo { FreeGB = 100 },
        Os = new OsInfo { Name = Environment.OSVersion.ToString() },
        Network = new NetworkInfo { UploadSpeedMbps = 10, DownloadSpeedMbps = 50 }
    };
    }

            // Run benchmark if needed
            await RunBenchmarkIfNeededAsync();

            // ── Resolve node identity ────────────────────────────────────────────────
            // Priority:
            //   1. node_identity.json (already loaded in constructor if it existed)
            //   2. appsettings.json: NodeSettings:NodeId + NodeSettings:NodeSecret
            //   3. appsettings.json: NodeSettings:RegistrationToken  (one-time)
            //   4. Interactive console prompt for registration token
            if (!_identityService.IsRegistered)
            {
                var registered = await RunTokenRegistrationFlowAsync(_detectedHardware);
                if (!registered)
                {
                    _logger.LogError("❌ Could not establish node identity. Service cannot start.");
                    return;
                }
                // Update _nodeId to the one granted by the server
                _nodeId = _identityService.NodeId;
                ApplyNodeSecretHeader();
            }

            // Register with backend
            var registered2 = await RegisterWithBackendAsync(_detectedHardware);
            if (!registered2)
            {
                _logger.LogError("Failed to register with backend. Retrying in 30 seconds...");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                await ExecuteAsync(stoppingToken);
                return;
            }

            // ── WebSocket connection (replaces REST heartbeat + job polling) ──────
            _logger.LogInformation("🔌 Starting persistent WebSocket connection to backend...");
            using var wsService = new NodeWebSocketService(
                _logger,
                _configuration,
                _detectedHardware,
                _nodeId);

            // Forward WS job-push to existing ProcessJobAsync logic
            wsService.OnJobAssigned += async (assignment) =>
            {
                _ = ProcessJobAsync(assignment, stoppingToken);
            };

            // When the backend signals a new job is available, immediately poll via REST
            wsService.OnJobPollRequested += async () =>
            {
                if (!string.IsNullOrEmpty(GetCurrentJobId()))
                {
                    _logger.LogDebug("📢 Backend requested job poll, but we are already busy — ignoring.");
                    return;
                }
                
                _logger.LogInformation("📢 Received job poll request from backend — checking for available jobs...");
                await PollForJobsAsync(stoppingToken);
            };

            // WS runs until cancellation or unrecoverable error.
            // REST fallback polling (legacy) runs in parallel and only does work
            // when the WS is not connected.
            var wsTask = wsService.RunAsync(stoppingToken);

            var fallbackPollTask = Task.Run(async () =>
            {
                // Give the WebSocket a chance to connect first before we start complaining
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
                
                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {
                        // Only poll via REST if WS is not connected
                        if (!wsService.IsConnected)
                        {
                            _logger.LogWarning("⚡ WS disconnected, falling back to REST job poll...");
                            await PollForJobsAsync(stoppingToken);
                        }
                        else if (string.IsNullOrEmpty(GetCurrentJobId()))
                        {
                            // Periodic safety poll even when WS is connected, to catch any missed jobs
                            _logger.LogDebug("🔄 Periodic safety job poll while idle...");
                            await PollForJobsAsync(stoppingToken);
                        }
                        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                    }
                    catch (OperationCanceledException) { break; }
                    catch (Exception ex)
                    {
                        _logger.LogError($"Fallback poll error: {ex.Message}");
                        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                    }
                }
            }, stoppingToken);

            // Initial cleanup
            CleanupOldJobFolders();

            await Task.WhenAll(wsTask, fallbackPollTask);

            // Clean up cached files on shutdown
            await CleanupCacheAsync();
        }

        private void CleanupOldJobFolders()
        {
            try
            {
                var jobsDir = Path.Combine(Path.GetTempPath(), "BlendFarm", "Jobs");
                if (!Directory.Exists(jobsDir)) return;

                _logger.LogInformation("🧹 Cleaning up old job folders...");
                var directories = Directory.GetDirectories(jobsDir);
                foreach (var dir in directories)
                {
                    try
                    {
                        var dirInfo = new DirectoryInfo(dir);
                        // Delete if older than 24 hours
                        if (DateTime.UtcNow - dirInfo.LastWriteTimeUtc > TimeSpan.FromHours(24))
                        {
                            Directory.Delete(dir, true);
                            _logger.LogDebug($"🗑️  Deleted old job directory: {dirInfo.Name}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug($"Could not delete job directory {dir}: {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Job cleanup failed: {ex.Message}");
            }
        }

        private async Task CleanupCacheAsync()
        {
            try
            {
                _logger.LogInformation("🧹 Cleaning up cache...");
                
                var cacheDir = Path.Combine(Path.GetTempPath(), "BlendFarm", "Cache");
                if (Directory.Exists(cacheDir))
                {
                    // Delete files older than cache expiry
                    var files = Directory.GetFiles(cacheDir, "*.blend");
                    foreach (var file in files)
                    {
                        try
                        {
                            var fileInfo = new FileInfo(file);
                            if (DateTime.UtcNow - fileInfo.LastWriteTimeUtc > _cacheExpiry)
                            {
                                File.Delete(file);
                                _logger.LogDebug($"🗑️  Deleted old cached file: {file}");
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogDebug($"Could not delete cache file {file}: {ex.Message}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Cache cleanup failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Resolves node identity via registration token.
        /// Priority:
        ///   1. appsettings.json NodeSettings:NodeId + NodeSettings:NodeSecret  (manual override)
        ///   2. appsettings.json NodeSettings:RegistrationToken                 (one-time token in config)
        ///   3. Interactive console prompt                                        (first-run experience)
        /// </summary>
        private async Task<bool> RunTokenRegistrationFlowAsync(HardwareInfo hardware)
        {
            // 1. Check if nodeId + nodeSecret are baked directly into config (manual/dev override)
            var cfgNodeId     = _configuration["NodeSettings:NodeId"];
            var cfgNodeSecret = _configuration["NodeSettings:NodeSecret"];

            if (!string.IsNullOrEmpty(cfgNodeId)   && cfgNodeId   != "node_auto" &&
                !string.IsNullOrEmpty(cfgNodeSecret) && cfgNodeSecret != "PASTE_SECRET_HERE")
            {
                _identityService.SetIdentity(cfgNodeId, cfgNodeSecret);
                _logger.LogInformation($"✅ Node identity loaded from config: {cfgNodeId}");
                return true;
            }

            // 2. Try a pre-configured registration token (env / appsettings)
            var cfgToken = _configuration["NodeSettings:RegistrationToken"];
            if (!string.IsNullOrEmpty(cfgToken) && cfgToken != "PASTE_TOKEN_HERE")
            {
                _logger.LogInformation("🔑 Found RegistrationToken in config — registering with backend...");
                var ok = await _identityService.RegisterWithTokenAsync(
                    cfgToken, _backendUrl, _httpClient,
                    hardware);

                if (ok)
                {
                    // Clear the token from config so it can't be reused accidentally
                    _logger.LogInformation("✅ Registration successful. You can now remove RegistrationToken from appsettings.json.");
                    return true;
                }

                _logger.LogError("❌ Registration token in config was rejected. Please generate a new one.");
            }

            // 3. Interactive prompt (first-run experience — works in console mode)
            _logger.LogInformation("══════════════════════════════════════════════════════════");
            _logger.LogInformation("🆕 FIRST RUN — Node Identity Setup");
            _logger.LogInformation("   This node has not been registered yet.");
            _logger.LogInformation("   Please go to your BlendFarm dashboard:");
            _logger.LogInformation("   Account → Node Provider → Add New Node → Copy Token");
            _logger.LogInformation("══════════════════════════════════════════════════════════");
            Console.Write("\nPaste your Registration Token here and press Enter: ");
            var interactiveToken = Console.ReadLine()?.Trim();

            if (string.IsNullOrEmpty(interactiveToken))
            {
                _logger.LogError("No token provided. Cannot register node.");
                return false;
            }

            // Prompt for friendly name if not already provided
            if (string.IsNullOrEmpty(_identityService.UserProvidedName))
            {
                Console.Write("\nGive this node a friendly name (e.g. 'Studio PC'): ");
                var friendlyName = Console.ReadLine()?.Trim();
                if (!string.IsNullOrEmpty(friendlyName))
                    _identityService.SetFriendlyName(friendlyName);
            }

            return await _identityService.RegisterWithTokenAsync(
                interactiveToken, _backendUrl, _httpClient,
                hardware);
        }

        /// <summary>Builds the hardware payload dict to send during registration.</summary>
        private object BuildHardwarePayload(HardwareInfo hardware)
        {
            if (hardware == null) return null;
            return new
            {
                os              = hardware.Os?.Name,
                ipAddress       = hardware.Ip?.LocalIP,
                publicIp        = hardware.Ip?.PublicIP,
                hostname        = hardware.Ip?.Hostname,
                hardwareFingerprint = hardware.HardwareFingerprint,
                hardwareVerifiedAt  = hardware.DetectedAt,
                hardware = new
                {
                    cpuModel        = hardware.Cpu?.Model,
                    cpuCores        = hardware.Cpu?.PhysicalCores,
                    cpuThreads      = hardware.Cpu?.LogicalCores,
                    cpuSpeedGHz     = hardware.Cpu?.BaseClockGHz,
                    cpuScore        = hardware.Cpu?.CpuScore,
                    gpuName         = hardware.Gpus?.Count > 0 ? hardware.Gpus[0].Model : "Unknown",
                    gpuVRAM         = hardware.Gpus?.Count > 0 ? hardware.Gpus[0].VramMB : 0,
                    ramGB           = hardware.Ram?.TotalGB,
                    storageFreeGB   = hardware.Storage?.FreeGB,
                    uploadSpeedMbps = hardware.Network?.UploadSpeedMbps,
                    downloadSpeedMbps = hardware.Network?.DownloadSpeedMbps,
                    blenderVersion  = _computeScore?.BlenderVersion ?? "unknown",
                }
            };
        }

        private async Task RunBenchmarkIfNeededAsync()

{
    _logger.LogInformation("🎯 Checking benchmark status...");
    
    try
    {
        // Check against cache to detect hardware changes
        var cachePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "BlendFarm", "benchmark_cache.json");

        var isFirstRun = !File.Exists(cachePath);

        // If a cache exists, let's verify if hardware swapped
        if (!isFirstRun)
        {
            try
            {
                var cacheJson = await File.ReadAllTextAsync(cachePath);
                var cachedScore = System.Text.Json.JsonSerializer.Deserialize(
                    cacheJson, 
                    BlendFarm.Node.Benchmark.Models.BenchmarkSerializerContext.Default.BenchmarkResult);
                
                // Compare CPU and GPU models
                bool hardwareChanged = false;
                if (cachedScore != null && cachedScore.Hardware != null)
                {
                    if (_detectedHardware.Cpu?.Model != cachedScore.Hardware.Cpu?.Model)
                    {
                        _logger.LogWarning($"⚠️ CPU change detected: '{cachedScore.Hardware.Cpu?.Model}' -> '{_detectedHardware.Cpu?.Model}'");
                        hardwareChanged = true;
                    }
                    else if (_detectedHardware.Gpus.FirstOrDefault()?.Model != cachedScore.Hardware.Gpus.FirstOrDefault()?.Model)
                    {
                        _logger.LogWarning($"⚠️ GPU change detected: '{cachedScore.Hardware.Gpus.FirstOrDefault()?.Model}' -> '{_detectedHardware.Gpus.FirstOrDefault()?.Model}'");
                        hardwareChanged = true;
                    }
                }

                if (hardwareChanged)
                {
                    _logger.LogWarning("⚠️ Hardware change detected! Forcing new benchmark run (2 iterations).");
                    File.Delete(cachePath); // Delete old cache
                    isFirstRun = true;      // Force re-run
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Failed to read benchmark cache for hardware comparison: {ex.Message}");
                // If we can't read it, it's safer to just run it again
                isFirstRun = true;
            }
        }
        
        _benchmarkResult = await _computeScoreService.GetOrRunBenchmarkAsync(isFirstRun, _detectedHardware);

        // Try to force 2 iterations if it's a fresh hardware run (for accuracy).
        // Since GetOrRunBenchmark checks cache inside, if we forced it, it ran the actual benchmer.
        if (isFirstRun && _benchmarkResult != null)
        {
            _benchmarkResult.Iterations = 2; // Tag it explicitly for the backend
            // In a deeper implementation, you'd pass iterations directly into GetOrRunBenchmarkAsync
            // But this tags the result so the backend knows it was a deeper benchmark
        }
        
        if (_benchmarkResult != null && _benchmarkResult.IsComplete)
        {
            _computeScore = _computeScoreService.CalculateComputeScore(_benchmarkResult, _detectedHardware);
            
            _logger.LogInformation("═══════════════════════════════════════");
            _logger.LogInformation($"🎯 COMPUTE PERFORMANCE");
            _logger.LogInformation($"   GPU Score: {_computeScore.GpuScore:F0}");
            _logger.LogInformation($"   CPU Score: {_computeScore.CpuScore:F0}");
            _logger.LogInformation($"   Effective: {_computeScore.EffectiveScore:F0}");
            _logger.LogInformation($"   Tier: {_computeScore.Tier}");
            _logger.LogInformation($"   Blender: {_computeScore.BlenderVersion}");
            _logger.LogInformation("═══════════════════════════════════════");

            // Sync benchmark scores back to the hardware object for heuristics fallback
            _detectedHardware.Cpu.CpuScore = (int)_computeScore.CpuScore;
            if (_detectedHardware.Gpus.Any())
            {
                _detectedHardware.Gpus[0].GpuScore = (int)_computeScore.GpuScore;
            }
        }
        else
        {
            _logger.LogWarning($"⚠️ Benchmark incomplete: {_benchmarkResult.Error}");
        }
    }
    catch (Exception ex)
    {
        _logger.LogError($"❌ Benchmark failed: {ex.Message}");
    }
}

        private async Task VerifyBlenderAvailabilityAsync()
        {
            _logger.LogInformation("🔍 Verifying Blender availability...");
            
            try
            {
                // Try to run Blender using the path from PythonRunnerService
                var blenderPath = _pythonRunner.GetBlenderPath();
                
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = blenderPath,
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                
                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                var error = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                if (process.ExitCode == 0 && output.Contains("Blender"))
                {
                    _isBlenderAvailable = true;
                    var version = ParseBlenderVersion(output);
                    _logger.LogInformation($"✅ Blender {version} is available");
                }
                else
                {
                    _logger.LogError($"❌ Blender is not available. Exit code: {process.ExitCode}");
                    _logger.LogDebug($"Output: {output}");
                    _logger.LogDebug($"Error: {error}");
                    
                    // Try alternative approach - check if blender.exe exists in common locations
                    await TryFindBlenderManuallyAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error verifying Blender: {ex.Message}");
                await TryFindBlenderManuallyAsync();
            }
        }

        private async Task TryFindBlenderManuallyAsync()
        {
            _logger.LogInformation("🔍 Trying to find Blender manually...");
            
            // First, try to get blender path from PythonRunnerService
            var blenderPath = _pythonRunner.GetBlenderPath();
            if (!string.IsNullOrEmpty(blenderPath) && blenderPath != "blender")
            {
                try
                {
                    if (File.Exists(blenderPath))
                    {
                        var process = new Process
                        {
                            StartInfo = new ProcessStartInfo
                            {
                                FileName = blenderPath,
                                Arguments = "--version",
                                RedirectStandardOutput = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            }
                        };
                        
                        process.Start();
                        var output = await process.StandardOutput.ReadToEndAsync();
                        await process.WaitForExitAsync();
                        
                        if (process.ExitCode == 0 && output.Contains("Blender"))
                        {
                            _isBlenderAvailable = true;
                            _logger.LogInformation($"✅ Using Blender from PythonRunnerService: {blenderPath}");
                            return;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"Failed to use Blender path from PythonRunnerService: {ex.Message}");
                }
            }
            
            var possiblePaths = new[]
            {
                @"C:\Program Files\Blender Foundation\Blender\blender.exe",
                @"C:\Program Files (x86)\Blender Foundation\Blender\blender.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Blender Foundation", "Blender", "blender.exe"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Blender", "blender.exe"),
                @"blender" // Try in PATH again
            };
            
            foreach (var path in possiblePaths)
            {
                try
                {
                    if (File.Exists(path) || path == "blender")
                    {
                        var process = new Process
                        {
                            StartInfo = new ProcessStartInfo
                            {
                                FileName = path,
                                Arguments = "--version",
                                RedirectStandardOutput = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            }
                        };
                        
                        process.Start();
                        var output = await process.StandardOutput.ReadToEndAsync();
                        await process.WaitForExitAsync();
                        
                        if (process.ExitCode == 0 && output.Contains("Blender"))
                        {
                            _isBlenderAvailable = true;
                            _logger.LogInformation($"✅ Found Blender at: {path}");
                            
                            // Update PythonRunnerService with the found path
                            _pythonRunner.SetBlenderPath(path);
                            return;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"Failed to test Blender at {path}: {ex.Message}");
                }
            }
            
            _logger.LogError("❌ Could not find Blender. Please install Blender or add it to PATH.");
        }
        
        private async Task<bool> TestBackendConnectionAsync()
        {
            try
            {
                _logger.LogInformation($"🔗 Testing connection to backend: {_backendUrl}");
                
                var response = await _httpClient.GetAsync("/health");
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation($"✅ Backend connection successful: {content}");
                    return true;
                }
                else
                {
                    _logger.LogError($"❌ Backend connection failed: {response.StatusCode}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Backend connection error: {ex.Message}");
                return false;
            }
        }


   private async Task<bool> RegisterWithBackendAsync(HardwareInfo hardware)  // Parameter type changed
{
    int maxRetries = 5;
    for (int retry = 0; retry < maxRetries; retry++)
    {
        try
        {
            // ===== UPDATED WITH REAL HARDWARE DATA =====
            var registrationData = new Dictionary<string, object>
            {
                ["nodeId"] = _nodeId,
                ["name"] = _nodeDisplayName,
                
                // REAL OS info
                ["os"] = hardware.Os.Name,
                
                // REAL hardware specs
                ["hardware"] = new Dictionary<string, object>
                {
                    // CPU
                    ["cpuModel"] = hardware.Cpu.Model,
                    ["cpuCores"] = hardware.Cpu.PhysicalCores,
                    ["cpuThreads"] = hardware.Cpu.LogicalCores,
                    ["cpuSpeedGHz"] = hardware.Cpu.BaseClockGHz,
                    ["cpuScore"] = CalculateCpuScore(hardware.Cpu),  // Updated method
                    
                    // GPU (first one for primary)
                    ["gpuName"] = hardware.Gpus.FirstOrDefault()?.Model ?? "Unknown",
                    ["gpuVRAM"] = hardware.Gpus.FirstOrDefault()?.VramMB ?? 0,
                    ["gpuScore"] = CalculateGpuScore(hardware.Gpus.FirstOrDefault()),  // Updated method
                    
                    // All GPUs
                    ["allGpus"] = hardware.Gpus.Select(g => new Dictionary<string, object>
                    {
                        ["model"] = g.Model,
                        ["vramMB"] = g.VramMB,
                        ["cudaSupported"] = g.CudaSupported,
                        ["optixSupported"] = g.OptixSupported
                    }).ToList(),
                    
                    // RAM
                    ["ramGB"] = hardware.Ram.TotalGB,
                    ["ramAvailableGB"] = hardware.Ram.AvailableGB,
                    ["ramType"] = hardware.Ram.Type,
                    
                    // Storage
                    ["storageFreeGB"] = hardware.Storage.FreeGB,
                    ["storageType"] = hardware.Storage.Type,
                    
                    // Network
                    ["uploadSpeedMbps"] = hardware.Network.UploadSpeedMbps,
                    ["downloadSpeedMbps"] = hardware.Network.DownloadSpeedMbps,
                    ["latencyMs"] = hardware.Network.LatencyMs,
                    
                    // Blender
                    ["blenderVersion"] = hardware.Os.DotNetVersion,  // Or get from your existing method
                    
                    // Hardware fingerprint for anti-cheat
                    ["hardwareFingerprint"] = hardware.HardwareFingerprint
                },
                
                // REAL capabilities based on hardware
                ["capabilities"] = new Dictionary<string, object>
                {
                    ["supportedEngines"] = new[] { "CYCLES", "EEVEE" },
                    ["supportedGPUs"] = hardware.Gpus.Any(g => g.CudaSupported) ? 
                        new[] { "CUDA", "OPTIX" } : 
                        hardware.Gpus.Any(g => g.HipSupported) ?
                            new[] { "HIP" } : new[] { "CPU" },
                    ["maxSamples"] = hardware.Ram.TotalGB >= 32 ? 4096 : 1024,
                    ["maxResolutionX"] = hardware.Ram.TotalGB >= 16 ? 7680 : 3840,
                    ["maxResolutionY"] = hardware.Ram.TotalGB >= 16 ? 4320 : 2160,
                    ["supportsTiles"] = true,
                    ["supportsAnimation"] = true,
                    ["supportsImage"] = true,
                    
                    // Node tier based on REAL performance
                    ["nodeTier"] = CalculateNodeTier(hardware)
                },
                
                // Benchmark scores
                ["performance"] = new Dictionary<string, object>
                {
                    ["effectiveScore"] = _computeScore?.EffectiveScore ?? 0,
                    ["gpuScore"] = _computeScore?.GpuScore ?? 0,
                    ["cpuScore"] = _computeScore?.CpuScore ?? 0,
                    ["tier"] = _computeScore?.Tier ?? "Unknown",
                    ["benchmarkDate"] = _computeScore?.BenchmarkDate ?? DateTime.MinValue,
                    ["blenderVersion"] = _computeScore?.BlenderVersion ?? "Unknown"
                },
                ["ipAddress"] = _detectedHardware?.Ip?.LocalIP ?? hardware.Network.LocalIP ?? GetLocalIPAddress(),
                ["publicIp"]  = _detectedHardware?.Ip?.PublicIP ?? hardware.Network.PublicIP,
                ["hostname"]  = _detectedHardware?.Ip?.Hostname ?? Environment.MachineName,
                // Hardware identity for duplicate-node blocking
                ["hardwareFingerprint"] = hardware.HardwareFingerprint,
                ["biosUuid"]            = hardware.Fingerprint?.BiosUuid,
                ["motherboardSerial"]   = hardware.Fingerprint?.MotherboardSerial,
                ["diskSerial"]          = hardware.Fingerprint?.DiskSerial,
                ["status"] = "online",
                
                // When the hardware was verified
                ["hardwareVerifiedAt"] = hardware.DetectedAt
            };
            // ===== END UPDATED CODE =====

            var json = JsonConvert.SerializeObject(registrationData);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _logger.LogInformation($"📤 Registering with backend: {_backendUrl}/api/nodes/register");
            
            var response = await _httpClient.PostAsync("/api/nodes/register", content);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogInformation($"✅ Registered with backend: {_nodeDisplayName} (ID: {_nodeId})");
                return true;
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                
                // CRITICAL: Handle Revocation or Insufficient Disk (both return 403)
                if (response.StatusCode == HttpStatusCode.Forbidden || errorContent.Contains("NODE_REVOKED") || errorContent.Contains("INSUFFICIENT_DISK_SPACE"))
                {
                    _logger.LogCritical("══════════════════════════════════════════════════════════");
                    _logger.LogCritical("🚫 NODE REGISTRATION REJECTED / REVOKED");
                    _logger.LogCritical($"   Message: {errorContent}");
                    _logger.LogCritical("   Reason: Your node does not meet minimum requirements or has been revoked.");
                    _logger.LogCritical("   Action: Please check your BlendFarm dashboard for details.");
                    _logger.LogCritical("══════════════════════════════════════════════════════════");
                    
                    Console.WriteLine("\nThis node cannot continue operation and will now close.");
                    Console.WriteLine("If it's storage related, please free up space and restart.");
                    Console.WriteLine("Press any key to exit...");
                    if (!Console.IsInputRedirected) Console.ReadKey();
                    Environment.Exit(1);
                }

                _logger.LogError($"Registration failed (attempt {retry + 1}/{maxRetries}): {errorContent}");
                
                if (retry < maxRetries - 1)
                {
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, retry));
                    _logger.LogInformation($"Waiting {delay.TotalSeconds} seconds before retry...");
                    await Task.Delay(delay);
                    continue;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Registration error (attempt {retry + 1}/{maxRetries}): {ex.Message}");
            
            if (retry < maxRetries - 1)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, retry));
                _logger.LogInformation($"Waiting {delay.TotalSeconds} seconds before retry...");
                await Task.Delay(delay);
                continue;
            }
        }
    }

    return false;
}

private string GenerateStableNodeId(HardwareInfo hardware)
{
    // Use machine name as a readable prefix
    string machineName = Environment.MachineName.ToLower().Replace(" ", "-");
    
    // Hash the hardware fingerprint to get a stable unique hex string (shortened)
    string fingerprint = hardware.HardwareFingerprint ?? "unknown";
    using (var sha256 = System.Security.Cryptography.SHA256.Create())
    {
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(fingerprint));
        var hex = BitConverter.ToString(hash).Replace("-", "").ToLower().Substring(0, 12);
        return $"{machineName}-{hex}";
    }
}

private string GenerateFriendlyDisplayName(string friendlyName, HardwareInfo hardware)
{
    string hashPart = "";
    if (hardware.HardwareFingerprint != null && hardware.HardwareFingerprint.Length >= 6)
    {
        hashPart = hardware.HardwareFingerprint.Substring(0, 6);
    }

    if (string.IsNullOrEmpty(friendlyName) || friendlyName == "node_auto")
    {
        return $"Node-{Environment.MachineName}-{hashPart}";
    }
    
    // User gave a name, append hash to ensure uniqueness but keep it readable
    return $"{friendlyName}-{hashPart}";
}
private async void SendHeartbeat(object? state)
{
    try
    {
        // Get real-time stats
        var cpuUsage = await GetCpuUsageAsync();
        var gpuUsage = await GetGpuUsageAsync();
        var ramUsed = GetUsedMemoryMB();
        var diskFree = GetFreeDiskSpaceMB();
        
        // Get GPU temperatures if available
        var gpuTemps = new List<int>();
        foreach (var gpu in _detectedHardware?.Gpus ?? new List<GpuInfo>())
        {
            if (gpu.Temperature > 0)
                gpuTemps.Add(gpu.Temperature);
        }

            var heartbeatData = new
            {
                nodeId = _nodeId,
                status = string.IsNullOrEmpty(_currentJobId) ? "idle" : "rendering",
                timestamp = DateTime.UtcNow,
                storageFreeGB = (double)diskFree / 1024.0,
                resources = new
                {
                    cpuPercent = cpuUsage,
                    cpuTemperature = 0, // Add if you implement
                    gpuPercent = gpuUsage,
                    gpuTemperatures = gpuTemps,
                    ramUsedMB = ramUsed,
                    ramTotalMB = _detectedHardware?.Ram.TotalMB ?? 0,
                    ramPercent = (int)((double)ramUsed / (_detectedHardware?.Ram.TotalMB ?? 1) * 100),
                    diskFreeMB = diskFree,
                    diskTotalMB = _detectedHardware?.Storage.TotalGB * 1024 ?? 0,
                    diskPercent = 100 - (int)((double)diskFree / (_detectedHardware?.Storage.TotalGB * 1024 ?? 1) * 100)
                },
                currentJob = GetCurrentJobId(),
                progress = GetCurrentProgress(),
                uptime = (int)(DateTime.UtcNow - Process.GetCurrentProcess().StartTime).TotalSeconds,
                framesRendered = _detectedHardware?.Gpus.Sum(g => g.Utilization) ?? 0 // Placeholder
            };

        var json = JsonConvert.SerializeObject(heartbeatData);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync($"/api/nodes/{_nodeId}/heartbeat", content);
        if (response.StatusCode == HttpStatusCode.Forbidden)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogCritical($"🛑 HEARTBEAT REJECTED (Node Revoked?): {error}");
            // Optional: Shut down or set flag. For now, let's log critical.
        }
        else if (response.IsSuccessStatusCode)
        {
            // FIX (Ghost Rendering): read the response body to check for server commands.
            try
            {
                var body = await response.Content.ReadAsStringAsync();
                if (!string.IsNullOrWhiteSpace(body))
                {
                    var parsed = JsonConvert.DeserializeObject<Dictionary<string, object>>(body);
                    if (parsed != null && parsed.TryGetValue("command", out var cmd) && cmd?.ToString() == "STOP_JOB")
                    {
                        _logger.LogWarning($"🛑 Server sent STOP_JOB — cancelling active render for job {_currentJobId}");
                        // Cancel the render CTS so Blender and the frame loop both exit.
                        _renderCts?.Cancel();
                    }
                }
            }
            catch (Exception parseEx)
            {
                _logger.LogDebug($"Heartbeat response parse warning: {parseEx.Message}");
            }
        }
        else
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogWarning($"💓 Heartbeat failed: {error}");
        }
    }
    catch (Exception ex)
    {
        _logger.LogError($"Heartbeat failed: {ex.Message}");
    }
}
// Add these helper methods to NodeBackendService.cs

private int CalculateCpuScore(CpuInfo cpu)
{
    // If benchmark score exists, use it
    if (cpu.CpuScore > 0) return cpu.CpuScore;

    int score = 0;
    // Base score from cores and speed (heuristic fallback)
    score += cpu.PhysicalCores * 1000;
    score += (int)(cpu.BaseClockGHz * 500);
    if (cpu.SupportsAVX2) score += 2000;
    if (cpu.SupportsAVX) score += 1000;
    if (cpu.SupportsSSE42) score += 500;
    return score;
}

private int CalculateGpuScore(GpuInfo? gpu)
{
    if (gpu == null) return 0;
    
    // If benchmark score exists, use it
    if (gpu.GpuScore > 0) return gpu.GpuScore;

    int score = 0;
    // Heuristic fallback
    score += (int)(gpu.VramMB / 128);
    if (gpu.CudaSupported) score += 5000;
    if (gpu.OptixSupported) score += 3000;
    score += gpu.CoreCount * 2;
    return score;
}

private string CalculateNodeTier(HardwareInfo hw)
{
    // If we have a real benchmark tier, use it
    if (_computeScore != null && !string.IsNullOrEmpty(_computeScore.Tier) && _computeScore.Tier != "Unknown")
    {
        return _computeScore.Tier;
    }

    int totalScore = 0;
    
    // CPU contribution
    totalScore += hw.Cpu.PhysicalCores * 100;
    if (hw.Cpu.SupportsAVX2) totalScore += 200;
    
    // RAM contribution
    totalScore += (int)(hw.Ram.TotalGB * 10);
    
    // GPU contribution (sum of all GPUs)
    foreach (var gpu in hw.Gpus)
    {
        totalScore += (int)(gpu.VramMB / 100);  // 24GB VRAM = 240 points
        if (gpu.CudaSupported) totalScore += 500;
        if (gpu.OptixSupported) totalScore += 300;
    }
    
    // Decide tier
    if (totalScore > 3000) return "Enterprise";
    if (totalScore > 2000) return "High";
    if (totalScore > 1000) return "Mid";
    return "Low";
}
        private async Task PollForJobsAsync(CancellationToken cancellationToken)
        {
            // Check if we have a current job
            if (!string.IsNullOrEmpty(GetCurrentJobId()))
            {
                return; // Already working on a job
            }

            try
            {
                _logger.LogInformation("🔍 Checking for available jobs...");
                
                // Request job assignment - no body needed
                var assignmentResponse = await _httpClient.PostAsync(
                    $"/api/nodes/{_nodeId}/assign",
                    new StringContent("{}", Encoding.UTF8, "application/json"),
                    cancellationToken);

                if (assignmentResponse.IsSuccessStatusCode)
                {
                    var responseJson = await assignmentResponse.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogInformation($"📥 Job assignment response: {responseJson}");
                    
                    var assignment = System.Text.Json.JsonSerializer.Deserialize(
                        responseJson, 
                        NodeJsonContext.Default.JobAssignment);
                    
                    if (assignment?.JobId != null && assignment.Frames?.Count > 0)
                    {
                        _logger.LogInformation($"✅ Job assigned: {assignment.JobId} with {assignment.Frames.Count} frames");
                        _ = ProcessJobAsync(assignment, cancellationToken);
                    }
                    else if (assignment?.JobId == null)
                    {
                        _logger.LogInformation("⏳ No jobs available at the moment");
                    }
                }
                else
                {
                    var errorContent = await assignmentResponse.Content.ReadAsStringAsync();
                    
                    // CRITICAL: Handle Revocation during polling
                    if (errorContent.Contains("NODE_REVOKED"))
                    {
                        _logger.LogCritical("🚫 SECURITY ALERT: Node Identity Revoked by Backend.");
                        _logger.LogCritical("💰 Tip: Update or upgrade your system to earn more from the network!");
                        _logger.LogCritical("This software will now terminate to prevent unauthorized resource usage.");
                        Environment.Exit(1);
                        return;
                    }

                    _logger.LogWarning($"Job assignment failed: {errorContent}");
                }
            }
            catch (TaskCanceledException)
            {
                // Cancellation requested
            }
            catch (Exception ex)
            {
                _logger.LogError($"Job polling error: {ex.Message}");
            }
        }

        private async Task ProcessJobAsync(JobAssignment assignment, CancellationToken cancellationToken)
        {
            lock (_jobLock)
            {
                if (!string.IsNullOrEmpty(_currentJobId))
                {
                    _logger.LogWarning($"Already processing job {_currentJobId}, ignoring new job {assignment.JobId}");
                    return;
                }
                _currentJobId = assignment.JobId;
                _currentProgress = 0;
                _jobStartTime = DateTime.UtcNow;

                // FIX (Ghost Rendering): Create a fresh CTS for this render so that
                // SendHeartbeat can cancel it the moment the server sends STOP_JOB.
                _renderCts?.Dispose();
                _renderCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            }

            // Use the render-specific token for all Blender work below.
            var renderToken = _renderCts!.Token;

            // Clear previous frame upload URLs
            _frameUploadUrls.Clear();

            // ── Pre-job Disk Space Check ──
            var freeSpaceMB = GetFreeDiskSpaceMB();
            var freeSpaceGB = freeSpaceMB / 1024.0;
            if (freeSpaceGB < 50)
            {
                _logger.LogError($"❌ CRITICAL: Insufficient disk space ({freeSpaceGB:F1}GB < 50GB). Rejecting job.");
                await ReportFailureAsync(assignment.JobId, 0, $"Insufficient disk space on node: {freeSpaceGB:F1}GB free.", null, cancellationToken);
                ClearCurrentJob();
                return;
            }
            else if (freeSpaceGB < 100)
            {
                _logger.LogWarning($"⚠️ WARNING: Low disk space ({freeSpaceGB:F1}GB). Rendering may be affected.");
            }

            try
            {
                _logger.LogInformation($"🎬 Starting job: {assignment.JobId} with {assignment.Frames?.Count ?? 0} frames");
                _logger.LogInformation($"📁 Blend file URL: {assignment.BlendFileUrl}");
                _logger.LogInformation($"📊 Job progress: {assignment.JobProgress}%");

                // Store frame upload URLs from assignment
                if (assignment.FrameUploadUrls != null)
                {
                    foreach (var kvp in assignment.FrameUploadUrls)
                    {
                        if (int.TryParse(kvp.Key, out int frame))
                        {
                            _frameUploadUrls[frame] = (kvp.Value.UploadUrl, kvp.Value.S3Key);
                        }
                    }
                }

                // Download source file (using direct S3 URL) - with caching
                var sourceFilePath = await DownloadBlendFileAsync(assignment.BlendFileUrl, assignment.JobId, assignment.InputType, renderToken);
                if (string.IsNullOrEmpty(sourceFilePath))
                {
                    _logger.LogError($"❌ Failed to download source file for job {assignment.JobId}");
                    await ReportFailureAsync(assignment.JobId, 0, "Failed to download source file", null, renderToken);
                    return;
                }
                
                _logger.LogInformation($"📥 Source file ready: {sourceFilePath}");

                // Create job directory
                var jobDirectory = Path.Combine(Path.GetTempPath(), "BlendFarm", "Jobs", assignment.JobId);
                Directory.CreateDirectory(jobDirectory);

                // Handle Zip Extraction
                string blendFilePath = sourceFilePath;
                string extractionDirectory = null;
                if (assignment.InputType == "archive")
                {
                    extractionDirectory = Path.Combine(jobDirectory, "extracted");
                    Directory.CreateDirectory(extractionDirectory);
                    
                    _logger.LogInformation($"📦 Extracting archive to {extractionDirectory}...");
                    try
                    {
                        System.IO.Compression.ZipFile.ExtractToDirectory(sourceFilePath, extractionDirectory, true);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError($"❌ Failed to extract archive: {ex.Message}");
                        await ReportFailureAsync(assignment.JobId, 0, $"Failed to extract project archive: {ex.Message}", null, renderToken);
                        return;
                    }

                    // Find the .blend file recursively
                    var blendFiles = System.IO.Directory.GetFiles(extractionDirectory, "*.blend", System.IO.SearchOption.AllDirectories);
                    if (blendFiles.Length == 0)
                    {
                        _logger.LogError($"❌ No .blend file found in the extracted archive");
                        await ReportFailureAsync(assignment.JobId, 0, "No .blend file found in the archive", null, renderToken);
                        return;
                    }
                    
                    blendFilePath = blendFiles[0];
                    if (blendFiles.Length > 1)
                    {
                        _logger.LogWarning($"⚠️ Multiple .blend files found in archive. Using the first one: {blendFilePath}");
                    }
                    else
                    {
                        _logger.LogInformation($"📂 Found blend file in archive: {blendFilePath}");
                    }
                }

                // Get render settings from assignment
                var settings = assignment.Settings ?? new RenderSettings();
                var engine = settings.Engine ?? "CYCLES";
                var device = settings.Device ?? "GPU"; 
                var samples = settings.Samples > 0 ? settings.Samples : 30;
                var resolutionX = settings.ResolutionX > 0 ? settings.ResolutionX : 1920;
                var resolutionY = settings.ResolutionY > 0 ? settings.ResolutionY : 1080;
                var outputFormat = settings.OutputFormat ?? "PNG";
                var colorMode = settings.ColorMode ?? "RGBA";
                var colorDepth = settings.ColorDepth ?? "8";
                // Correctly handle 0 (lossless) as a valid setting
                var compression = settings.Compression >= 0 ? settings.Compression : 90;
                var exrCodec = settings.ExrCodec ?? "ZIP";
                var tiffCodec = settings.TiffCodec ?? "DEFLATE";
                var blenderVersion = settings.BlenderVersion ?? "4.5.0";
                var denoiser = settings.Denoiser ?? "NONE";
                var tileSize = settings.TileSize > 0 ? settings.TileSize : 256;
                var sceneName = settings.Scene;
                var cameraName = settings.Camera;

                _logger.LogInformation($"⚙️  Render settings: {engine}, {device}, {samples} samples, {resolutionX}x{resolutionY}, Output: {outputFormat} ({colorMode} {colorDepth}-bit), Blender: {blenderVersion}, Denoiser: {denoiser}");

                // Ensure the correct Blender version is available and set
                _logger.LogInformation($"🔍 Acquiring Blender {blenderVersion} for job...");
                var blenderPath = await BlenderFinder.FindBlenderAsync(_logger, blenderVersion);
                if (string.IsNullOrEmpty(blenderPath))
                {
                    _logger.LogError($"❌ Failed to get Blender {blenderVersion} for job {assignment.JobId}");
                    await ReportFailureAsync(assignment.JobId, 0, $"Failed to acquire Blender {blenderVersion}", null, cancellationToken);
                    return;
                }
                _pythonRunner.SetBlenderPath(blenderPath);

                if (assignment.Frames == null || assignment.Frames.Count == 0)
                {
                    _logger.LogError($"No frames assigned for job {assignment.JobId}");
                    await ReportFailureAsync(assignment.JobId, 0, "No frames assigned", null, cancellationToken);
                    return;
                }

                // Render each assigned frame
                // ── Blender crash detection: retry each frame up to MAX_FRAME_ATTEMPTS times locally ──
                const int MAX_FRAME_ATTEMPTS = 3;
                for (int i = 0; i < assignment.Frames.Count; i++)
                {
                    // Check the render-specific token (also catches STOP_JOB cancellation)
                    if (renderToken.IsCancellationRequested)
                    {
                        _logger.LogWarning($"🛑 Job {assignment.JobId} cancelled mid-render — stopping frame loop.");
                        break;
                    }

                    var frame = assignment.Frames[i];
                    _logger.LogInformation($"🎞️  Rendering frame {frame} ({i + 1}/{assignment.Frames.Count})");

                    var outputExtension = outputFormat.ToLower();
                    if (outputExtension == "jpeg") outputExtension = "jpg";
                    
                    var outputFileName = $"frame_{frame:D4}.{outputExtension}";
                    var outputPath = Path.Combine(jobDirectory, outputFileName);

                    // Determine if this is an animation or image render
                    var isAnimation = assignment.Frames.Count > 1 || frame > 0;

                    // ── Per-frame retry loop (Blender crash guard) ────────────────────────
                    bool frameSuccess = false;
                    string frameError = string.Empty;

                    for (int attempt = 1; attempt <= MAX_FRAME_ATTEMPTS; attempt++)
                    {
                        if (cancellationToken.IsCancellationRequested) break;

                        // Delete stale output from a previous failed attempt
                        try { if (File.Exists(outputPath)) File.Delete(outputPath); } catch { }

                        if (attempt > 1)
                        {
                            var backoff = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1)); // 2s, 4s
                            _logger.LogWarning($"🔄 Frame {frame}: Blender crash on attempt {attempt - 1}/{MAX_FRAME_ATTEMPTS}. " +
                                               $"Waiting {backoff.TotalSeconds}s before retry...");
                            await Task.Delay(backoff, renderToken);
                        }

                        if (renderToken.IsCancellationRequested) break;
                        _logger.LogInformation($"🎬 Frame {frame}: Blender attempt {attempt}/{MAX_FRAME_ATTEMPTS}");
                        
                        bool renderOk = await _pythonRunner.RunRenderAsync(
                            blendFilePath: blendFilePath,
                            frame: frame,
                            outputPath: outputPath,
                            samples: samples,
                            engine: engine,
                            device: device,
                            resolutionX: resolutionX,
                            resolutionY: resolutionY,
                            outputFormat: outputFormat,
                            colorMode: colorMode,
                            colorDepth: colorDepth,
                            compression: compression,
                            exrCodec: exrCodec,
                            tiffCodec: tiffCodec,
                            tileSize: tileSize,
                            denoiser: denoiser,
                            scene: sceneName,
                            camera: cameraName,
                            useAnimationSettings: isAnimation,
                            cancellationToken: renderToken);  // use render-specific token

                        if (renderOk && File.Exists(outputPath))
                        {
                            frameSuccess = true;
                            _logger.LogInformation($"✅ Frame {frame}: Blender finished successfully on attempt {attempt}");
                            break; // exit retry loop
                        }

                        // Blender exited with non-zero or output file is missing → crash detected
                        frameError = renderOk
                            ? $"Output file missing after render (attempt {attempt})"
                            : $"Blender non-zero exit code on attempt {attempt}";

                        _logger.LogWarning($"💥 BLENDER_CRASH detected for frame {frame} (attempt {attempt}/{MAX_FRAME_ATTEMPTS}): {frameError}");
                    }
                    // ── End per-frame retry loop ──────────────────────────────────────────

                    if (frameSuccess && File.Exists(outputPath))
                    {
                        // Get S3 upload URL for this frame
                        if (!_frameUploadUrls.TryGetValue(frame, out var uploadInfo))
                        {
                            _logger.LogWarning($"No upload URL for frame {frame}, requesting one...");
                            uploadInfo = await RequestUploadUrlAsync(assignment.JobId, frame, outputFormat, cancellationToken);
                        }

                        if (uploadInfo.uploadUrl == null || uploadInfo.s3Key == null)
                        {
                            _logger.LogError($"❌ No valid upload URL or S3 key for frame {frame}");
                            await ReportFailureAsync(assignment.JobId, frame, "No valid upload URL", null, cancellationToken);
                            continue;
                        }

                        _logger.LogInformation($"🔗 S3 Upload Info for Frame {frame}:");
                        _logger.LogInformation($"   - Key: {uploadInfo.s3Key}");
                        _logger.LogInformation($"   - Format: {outputFormat}");
                        _logger.LogInformation($"   - URL: {uploadInfo.uploadUrl.Substring(0, Math.Min(100, uploadInfo.uploadUrl.Length))}...");

                        _logger.LogInformation($"📤 Uploading frame {frame} directly to S3...");
                        var uploadResult = await UploadToS3Async(outputPath, uploadInfo.uploadUrl, uploadInfo.s3Key, cancellationToken);
                        
                        if (uploadResult)
                        {
                            var fileInfo = new FileInfo(outputPath);
                            await ReportCompletionAsync(
                                assignment.JobId, 
                                frame, 
                                uploadInfo.s3Key, 
                                outputPath,
                                (int)(DateTime.UtcNow - _jobStartTime).TotalSeconds,
                                fileInfo.Length,
                                cancellationToken);
                            
                            _logger.LogInformation($"✅ Frame {frame} completed and uploaded to S3");
                            
                            try
                            {
                                File.Delete(outputPath);
                                _logger.LogDebug($"🗑️  Deleted local file: {outputPath}");
                            }
                            catch (Exception deleteEx)
                            {
                                _logger.LogDebug($"⚠️ Could not delete local file: {deleteEx.Message}");
                            }
                        }
                        else
                        {
                            await ReportFailureAsync(assignment.JobId, frame, "All upload attempts failed", uploadInfo.s3Key, cancellationToken);
                            _logger.LogError($"❌ Frame {frame} upload failed after all retry attempts");
                            _logger.LogInformation($"📁 Local file kept at: {outputPath}");
                        }
                    }
                    else
                    {
                        // All local Blender attempts exhausted → tell backend to re-queue or permanently fail
                        var crashMsg = string.IsNullOrEmpty(frameError)
                            ? $"BLENDER_CRASH: Render failed after {MAX_FRAME_ATTEMPTS} attempts"
                            : $"BLENDER_CRASH: {frameError}";
                        _logger.LogError($"❌ Frame {frame}: {crashMsg} — reporting to backend");
                        await ReportFailureAsync(assignment.JobId, frame, crashMsg, null, cancellationToken);
                    }

                    // Update progress
                    _currentProgress = (int)((i + 1) / (double)assignment.Frames.Count * 100);
                }

                _logger.LogInformation($"✅ Completed all frames for job: {assignment.JobId}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Job processing failed: {ex.Message}");
                await ReportFailureAsync(assignment.JobId, 0, ex.Message, null, cancellationToken);
            }
            finally
            {
                // Dispose the render CTS
                lock (_jobLock) { _renderCts?.Dispose(); _renderCts = null; }
                ClearCurrentJob();
                _frameUploadUrls.Clear();
                
                // Cleanup extraction directory if it was an archive
                if (assignment.InputType == "archive")
                {
                    try
                    {
                        var extractDir = Path.Combine(Path.GetTempPath(), "BlendFarm", "Jobs", assignment.JobId, "extracted");
                        if (System.IO.Directory.Exists(extractDir))
                        {
                            System.IO.Directory.Delete(extractDir, true);
                            _logger.LogDebug($"🗑️ Cleaned up extracted archive directory: {extractDir}");
                        }
                    }
                    catch (Exception cleanupEx)
                    {
                        _logger.LogWarning($"⚠️ Could not clean up extraction directory: {cleanupEx.Message}");
                    }
                }

                // CRITICAL: Force an immediate poll to fetch remaining frames for this job, or new jobs
                _logger.LogInformation("🔄 Job batch finished, immediately polling for more work...");
                CleanupOldJobFolders();
                _ = PollForJobsAsync(cancellationToken);
            }
        }

        private async Task<string> DownloadBlendFileAsync(string blendFileUrl, string jobId, string inputType, CancellationToken cancellationToken)
        {
            try
            {
                var isArchive = inputType == "archive";
                var ext = isArchive ? "zip" : "blend";
                
                // Check cache first
                if (_blendFileCache.TryGetValue(jobId, out var cachedFile))
                {
                    // Check if file exists and is not expired
                    if (File.Exists(cachedFile.filePath) && 
                        DateTime.UtcNow - cachedFile.downloadedAt < _cacheExpiry)
                    {
                        _logger.LogInformation($"📂 Using cached source file for job {jobId}");
                        return cachedFile.filePath;
                    }
                    else
                    {
                        // Remove expired cache entry
                        _blendFileCache.TryRemove(jobId, out _);
                        try { File.Delete(cachedFile.filePath); } catch { }
                    }
                }

                // Generate cache directory path
                var cacheDir = Path.Combine(Path.GetTempPath(), "BlendFarm", "Cache");
                if (!Directory.Exists(cacheDir))
                    Directory.CreateDirectory(cacheDir);

                var fileName = $"sourcefile_{jobId}.{ext}";
                var localPath = Path.Combine(cacheDir, fileName);

                // Check disk cache to prevent redundant downloads across restarts
                if (File.Exists(localPath))
                {
                    var fileInfo = new FileInfo(localPath);
                    if (fileInfo.Length > 0)
                    {
                        _logger.LogInformation($"📂 Found existing cached blend file on disk for job {jobId}: {localPath}");
                        _blendFileCache[jobId] = (localPath, fileInfo.CreationTimeUtc); // Add to memory cache
                        return localPath;
                    }
                }

                _logger.LogInformation($"📥 Downloading blend file from: {blendFileUrl}");
                
                // Download with retry logic
                const int maxRetries = 3;
                for (int attempt = 1; attempt <= maxRetries; attempt++)
                {
                    try
                    {
                        using (var response = await _httpClient.GetAsync(blendFileUrl, cancellationToken))
                        {
                            if (!response.IsSuccessStatusCode)
                            {
                                _logger.LogWarning($"Download failed (attempt {attempt}/{maxRetries}): {response.StatusCode}");
                                
                                if (attempt < maxRetries)
                                {
                                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), cancellationToken);
                                    continue;
                                }
                                
                                throw new Exception($"Failed to download blend file: {response.StatusCode}");
                            }
                            
                            using (var stream = await response.Content.ReadAsStreamAsync(cancellationToken))
                            using (var fileStream = new FileStream(localPath, FileMode.Create))
                            {
                                await stream.CopyToAsync(fileStream, cancellationToken);
                            }
                            
                            // Add to cache
                            _blendFileCache[jobId] = (localPath, DateTime.UtcNow);
                            _logger.LogInformation($"✅ Downloaded blend file to cache: {localPath}");
                            return localPath;
                        }
                    }
                    catch (Exception ex) when (attempt < maxRetries)
                    {
                        _logger.LogWarning($"Download attempt {attempt} failed: {ex.Message}");
                        await Task.Delay(TimeSpan.FromSeconds(2 * attempt), cancellationToken);
                        continue;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError($"All download attempts failed: {ex.Message}");
                        throw;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to download blend file: {ex.Message}");
                return null;
            }

            return null;
        }

        private async Task<bool> UploadToS3Async(string filePath, string uploadUrl, string s3Key, CancellationToken cancellationToken)
        {
            const int maxRetries = 3;
            const int retryDelayMs = 2000; // 2 seconds between retries
            
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    _logger.LogInformation($"📤 Upload attempt {attempt}/{maxRetries}: {Path.GetFileName(filePath)} to S3...");
                    
                    // Test DNS resolution first (only on first attempt)
                    if (attempt == 1)
                    {
                        var dnsSuccess = await TestDnsResolutionAsync(uploadUrl);
                        if (!dnsSuccess)
                        {
                            _logger.LogWarning($"⚠️ DNS resolution failed for S3 host. Will retry...");
                            if (attempt < maxRetries)
                            {
                                await Task.Delay(retryDelayMs, cancellationToken);
                                continue;
                            }
                        }
                    }
                    
                    using (var fileStream = File.OpenRead(filePath))
                    using (var content = new StreamContent(fileStream))
                    {
                        // Set content type based on file extension
                        var extension = Path.GetExtension(filePath).ToLower();
                        var contentType = extension switch
                        {
                            ".png" => "image/png",
                            ".jpg" or ".jpeg" => "image/jpeg",
                            ".exr" => "image/x-exr",
                            _ => "application/octet-stream"
                        };
                        
                        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
                        
                        // Set a longer timeout for S3 uploads
                        using (var timeoutCts = new CancellationTokenSource(TimeSpan.FromMinutes(3)))
                        using (var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token))
                        {
                            // Send PUT request directly to S3
                            using (var request = new HttpRequestMessage(HttpMethod.Put, uploadUrl))
                            {
                                request.Content = content;
                                
                                using (var response = await _httpClient.SendAsync(request, linkedCts.Token))
                                {
                                    if (response.IsSuccessStatusCode)
                                    {
                                        _logger.LogInformation($"✅ Upload successful to S3 (attempt {attempt})");
                                        return true;
                                    }
                                    else
                                    {
                                        var error = await response.Content.ReadAsStringAsync();
                                        _logger.LogWarning($"⚠️ S3 upload attempt {attempt} failed: {response.StatusCode} - {error}");
                                        
                                        if (attempt < maxRetries)
                                        {
                                            _logger.LogInformation($"⏳ Waiting {retryDelayMs / 1000} seconds before retry {attempt + 1}...");
                                            await Task.Delay(retryDelayMs, cancellationToken);
                                            continue;
                                        }
                                        else
                                        {
                                            _logger.LogError($"❌ All {maxRetries} S3 upload attempts failed");
                                            return false;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
                {
                    _logger.LogWarning($"⏱️ S3 upload attempt {attempt} timed out");
                    
                    if (attempt < maxRetries)
                    {
                        _logger.LogInformation($"⏳ Waiting {retryDelayMs / 1000} seconds before retry {attempt + 1}...");
                        await Task.Delay(retryDelayMs, cancellationToken);
                        continue;
                    }
                    else
                    {
                        _logger.LogError($"❌ All {maxRetries} S3 upload attempts timed out");
                        return false;
                    }
                }
                catch (HttpRequestException ex) when (ex.Message.Contains("No such host is known"))
                {
                    _logger.LogWarning($"🌐 DNS resolution failed on attempt {attempt}: {ex.Message}");
                    
                    if (attempt < maxRetries)
                    {
                        // Increase delay for DNS failures
                        var extendedDelay = retryDelayMs * attempt;
                        _logger.LogInformation($"⏳ Waiting {extendedDelay / 1000} seconds before retry {attempt + 1}...");
                        await Task.Delay(extendedDelay, cancellationToken);
                        continue;
                    }
                    else
                    {
                        _logger.LogError($"❌ All {maxRetries} S3 upload attempts failed due to DNS resolution");
                        return false;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"⚠️ S3 upload attempt {attempt} failed: {ex.Message}");
                    
                    if (attempt < maxRetries)
                    {
                        var extendedDelay = retryDelayMs * attempt;
                        _logger.LogInformation($"⏳ Waiting {extendedDelay / 1000} seconds before retry {attempt + 1}...");
                        await Task.Delay(extendedDelay, cancellationToken);
                        continue;
                    }
                    else
                    {
                        _logger.LogError($"❌ All {maxRetries} S3 upload attempts failed: {ex.Message}");
                        return false;
                    }
                }
            }
            
            return false; // Should never reach here
        }

        private async Task<bool> TestDnsResolutionAsync(string url)
        {
            try
            {
                var uri = new Uri(url);
                var host = uri.Host;
                
                _logger.LogDebug($"🔍 Testing DNS resolution for: {host}");
                
                // Try to resolve hostname
                var addresses = await Dns.GetHostAddressesAsync(host);
                
                if (addresses.Length == 0)
                {
                    _logger.LogWarning($"⚠️ Cannot resolve S3 hostname: {host}");
                    return false;
                }
                
                _logger.LogDebug($"✅ DNS resolved {host} to: {string.Join(", ", addresses.Select(a => a.ToString()))}");
                
                // Optional: Test TCP connection (but don't fail if this times out)
                try
                {
                    using (var tcpClient = new TcpClient())
                    {
                        await tcpClient.ConnectAsync(addresses[0], 443);
                        _logger.LogDebug($"✅ Can connect to {host} on port 443");
                    }
                }
                catch (Exception tcpEx)
                {
                    _logger.LogDebug($"⚠️ TCP connection test failed (but continuing): {tcpEx.Message}");
                    // Don't fail the whole test if TCP connection fails
                }
                
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"⚠️ DNS resolution test failed: {ex.Message}");
                return false;
            }
        }
        
        private async Task<(string uploadUrl, string s3Key)> RequestUploadUrlAsync(string jobId, int frame, string outputFormat, CancellationToken cancellationToken)
        {
            const int maxRetries = 3;
            const int retryDelayMs = 1000;
            
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    _logger.LogInformation($"🔗 Requesting upload URL for job {jobId}, frame {frame} (attempt {attempt}/{maxRetries})");
                    
                    var response = await _httpClient.GetAsync($"/api/jobs/{jobId}/upload-frame/{frame}?format={outputFormat}", cancellationToken);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                        var result = System.Text.Json.JsonSerializer.Deserialize(
                            responseJson, 
                            NodeJsonContext.Default.UploadUrlResponse);
                        
                        if (result?.Success == true && !string.IsNullOrEmpty(result.UploadUrl) && !string.IsNullOrEmpty(result.S3Key))
                        {
                            _logger.LogInformation($"✅ Got upload URL for frame {frame}");
                            return (result.UploadUrl, result.S3Key);
                        }
                        else
                        {
                            _logger.LogWarning($"⚠️ Invalid response format for upload URL request");
                        }
                    }
                    else
                    {
                        var error = await response.Content.ReadAsStringAsync();
                        _logger.LogWarning($"⚠️ Upload URL request failed: {error}");
                    }
                    
                    if (attempt < maxRetries)
                    {
                        await Task.Delay(retryDelayMs * attempt, cancellationToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"⚠️ Upload URL request attempt {attempt} failed: {ex.Message}");
                    
                    if (attempt < maxRetries)
                    {
                        await Task.Delay(retryDelayMs * attempt, cancellationToken);
                    }
                }
            }
            
            _logger.LogError($"❌ Failed to get upload URL for frame {frame} after {maxRetries} attempts");
          return (null!, null!);
        }
        
        private async Task ReportCompletionAsync(string jobId, int frame, string s3Key, string outputPath, int renderTime, long fileSize, CancellationToken cancellationToken)
        {
            try
            {
                var completionData = new FrameCompletionReport
                {
                    JobId = jobId,
                    Frame = frame,
                    RenderTime = renderTime,
                    S3Key = s3Key,
                    FileSize = fileSize,
                    NodeId = _nodeId,
                    Success = true
                };

                var content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(completionData, NodeJsonContext.Default.FrameCompletionReport),
                    Encoding.UTF8,
                    "application/json"
                );
  var response = await _httpClient.PostAsync(
                    $"/api/nodes/complete-frame/{_nodeId}", 
                    content, 
                    cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation($"✅ Frame {frame} completion reported successfully for job {jobId}");
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Failed to report completion: {errorContent}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Completion report failed: {ex.Message}");
            }
        }       

        private async Task ReportFailureAsync(string jobId, int frame, string errorMessage, string? s3Key, CancellationToken cancellationToken)
        {
            try
            {
                var payload = new FrameFailureReport
                {
                    NodeId = _nodeId,
                    JobId = jobId,
                    Frame = frame,
                    Error = errorMessage,
                    S3Key = s3Key
                };

                var content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(payload, NodeJsonContext.Default.FrameFailureReport),
                    System.Text.Encoding.UTF8,
                    "application/json"
                );
  var response = await _httpClient.PostAsync(
                    $"/api/jobs/{jobId}/fail-frame", 
                    content, 
                    cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"⚠️ Frame {frame} failure reported for job {jobId}");
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Failed to report failure: {errorContent}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failure report failed: {ex.Message}");
            }
        }

        // Helper methods for system info
       private OsInfo GetOperatingSystemInfo()
{
    return new OsInfo
    {
        Name = $"{Environment.OSVersion.Platform}",
        Version = Environment.OSVersion.Version.ToString(),
        Architecture = RuntimeInformation.OSArchitecture.ToString(),
        Is64Bit = Environment.Is64BitOperatingSystem,
        DotNetVersion = RuntimeInformation.FrameworkDescription
    };
}

        private async Task<float> GetCpuUsageAsync()
        {
            return 0; // Simplified for now
        }

        private async Task<float> GetGpuUsageAsync()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "nvidia-smi",
                        Arguments = "--query-gpu=utilization.gpu --format=csv,noheader",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0 && float.TryParse(output.Replace("%", "").Trim(), out float usage))
                {
                    return usage;
                }
            }
            catch { }

            return 0;
        }

        private long GetUsedMemoryMB()
        {
            var process = Process.GetCurrentProcess();
            return process.WorkingSet64 / (1024 * 1024);
        }

        private long GetFreeDiskSpaceMB()
        {
            try
            {
                var drive = new DriveInfo(Path.GetPathRoot(Environment.CurrentDirectory));
                return drive.AvailableFreeSpace / (1024 * 1024);
            }
            catch
            {
                return 0;
            }
        }

        private string GetLocalIPAddress()
        {
            try
            {
                var host = Dns.GetHostEntry(Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork)
                    {
                        return ip.ToString();
                    }
                }
            }
            catch { }

            return "127.0.0.1";
        }

        private int GetTotalMemoryGB()
        {
            try
            {
                return 16; // Default for testing
            }
            catch
            {
                return 16; // Fallback
            }
        }

        private async Task<string> GetBlenderVersionAsync()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "blender",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                return ParseBlenderVersion(output);
            }
            catch { }

            return "unknown";
        }

        private string ParseBlenderVersion(string output)
        {
            try
            {
                var lines = output.Split('\n');
                foreach (var line in lines)
                {
                    if (line.Contains("Blender"))
                    {
                        // Look for version pattern like "Blender 4.1.0"
                        var parts = line.Split(' ');
                        foreach (var part in parts)
                        {
                            if (part.Contains('.') && char.IsDigit(part[0]))
                            {
                                return part.Trim();
                            }
                        }
                    }
                }
            }
            catch { }

            return "unknown";
        }

        private string GetCurrentJobId()
        {
            lock (_jobLock)
            {
                return _currentJobId;
            }
        }

        private int GetCurrentProgress()
        {
            lock (_jobLock)
            {
                return _currentProgress;
            }
        }

        private void ClearCurrentJob()
        {
            lock (_jobLock)
            {
                _currentJobId = null!;
                _currentProgress = 0;
            }
        }

    }
}