using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;
using System.Linq;
using System.Diagnostics;
using System.Net.Http;
using System.Collections.Generic;
using System.Threading;
using BlendFarm.Node.Services;

namespace BlendFarm.Node.Hardware
{
    public class NetworkDetector
    {
        private readonly ILogger _logger;
        private readonly SpeedtestService _speedtestService;
        private readonly HttpClient _httpClient;
        private double _capturedLatency = 0;

        public NetworkDetector(ILogger logger, SpeedtestService speedtestService)
        {
            _logger = logger;
            _speedtestService = speedtestService;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "BlendFarm-Node/1.0");
        }

        public async Task<NetworkInfo> DetectAsync(string serverUrl)
        {
            var network = new NetworkInfo();

            try
            {
                // Get local IP
                network.LocalIP = GetLocalIPAddress();
                
                // Get MAC address
                network.MacAddress = GetMacAddress();
                
                // Get interface name
                network.InterfaceName = GetActiveInterfaceName();
                
                // Get public IP
                network.PublicIP = await GetPublicIPAddressAsync();
                
                // Measure REAL upload/download speeds
                var speeds = await MeasureRealNetworkSpeedAsync();
                network.UploadSpeedMbps = speeds.upload;
                network.DownloadSpeedMbps = speeds.download;
                
                // Use captured latency from speedtest if available
                network.LatencyMs = _capturedLatency > 0 ? _capturedLatency : await MeasureLatencyAsync(serverUrl);
                
                _logger.LogInformation($"📊 Network: ↑{network.UploadSpeedMbps:F1} Mbps ↓{network.DownloadSpeedMbps:F1} Mbps (latency: {network.LatencyMs}ms)");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Network detection failed: {ex.Message}");
                
                // Provide fallback values based on latency
                var latency = await MeasureLatencyAsync(serverUrl);
                var fallback = GetFallbackSpeeds(latency);
                
                network.UploadSpeedMbps = fallback.upload;
                network.DownloadSpeedMbps = fallback.download;
                network.LatencyMs = latency < 999 ? latency : 50;
                network.LocalIP = GetLocalIPAddress() ?? "127.0.0.1";
                
                _logger.LogWarning($"Using fallback speeds: ↑{network.UploadSpeedMbps} Mbps ↓{network.DownloadSpeedMbps} Mbps");
            }

            return network;
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

        private string GetMacAddress()
        {
            try
            {
                foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus == OperationalStatus.Up &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Tunnel)
                    {
                        var address = nic.GetPhysicalAddress();
                        if (address != null && address.ToString() != "")
                        {
                            return string.Join("-", address.GetAddressBytes().Select(b => b.ToString("X2")));
                        }
                    }
                }
            }
            catch { }

            return "00-00-00-00-00-00";
        }

        private string GetActiveInterfaceName()
        {
            try
            {
                foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus == OperationalStatus.Up &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        nic.Speed > 0)
                    {
                        return nic.Name;
                    }
                }
            }
            catch { }

            return "Unknown";
        }

        private async Task<string> GetPublicIPAddressAsync()
        {
            // Try multiple services for redundancy
            string[] services = new[]
            {
                "https://api.ipify.org",
                "https://icanhazip.com",
                "https://ifconfig.me/ip",
                "https://api.my-ip.io/ip"
            };

            foreach (var service in services)
            {
                try
                {
                    using var client = new HttpClient();
                    client.Timeout = TimeSpan.FromSeconds(5);
                    var ip = await client.GetStringAsync(service);
                    return ip.Trim();
                }
                catch
                {
                    continue;
                }
            }

            return "Unknown";
        }

        private async Task<double> MeasureLatencyAsync(string serverUrl)
        {
            try
            {
                var uri = new Uri(serverUrl);
                var host = uri.Host;

                var ping = new Ping();
                var times = new List<long>();
                
                for (int i = 0; i < 3; i++)
                {
                    var reply = await ping.SendPingAsync(host, 2000);
                    if (reply.Status == IPStatus.Success)
                    {
                        times.Add(reply.RoundtripTime);
                    }
                    await Task.Delay(100);
                }

                if (times.Count > 0)
                {
                    return Math.Round(times.Average(), 0);
                }
            }
            catch { }

            return 999;
        }

        private async Task<(double upload, double download)> MeasureRealNetworkSpeedAsync()
        {
            _logger.LogInformation("🌐 Testing real network speed (this may take 20-30 seconds)...");

            // Strategy 1: Try official Speedtest CLI (Automated download/use)
            try
            {
                _logger.LogInformation("📊 Attempting to use Speedtest CLI for accurate results...");
                var speedtestResult = await MeasureSpeedUsingSpeedtestCLI();
                
                if (speedtestResult.download > 1.0 || speedtestResult.upload > 1.0)
                {
                    _logger.LogInformation($"✅ Speedtest CLI: ↓{speedtestResult.download:F1} Mbps ↑{speedtestResult.upload:F1} Mbps");
                    _capturedLatency = speedtestResult.latency;
                    return (speedtestResult.upload, speedtestResult.download);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Speedtest CLI failed: {ex.Message}");
                _logger.LogInformation("Falling back to HTTP-based speed test...");
            }

            // Strategy 2: Use HTTP download/upload test
            try
            {
                _logger.LogInformation("📥 Testing download speed with HTTP...");
                var downloadSpeed = await MeasureDownloadSpeedAsync();
                
                if (downloadSpeed > 1.0)
                {
                    _logger.LogInformation($"✅ Download speed: {downloadSpeed:F1} Mbps");
                    
                    _logger.LogInformation("📤 Testing upload speed...");
                    var uploadSpeed = await MeasureUploadSpeedAsync();
                    _logger.LogInformation($"✅ Upload speed: {uploadSpeed:F1} Mbps");
                    
                    return (Math.Round(uploadSpeed, 1), Math.Round(downloadSpeed, 1));
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"HTTP speed test failed: {ex.Message}");
            }

            // Strategy 3: Use network interface statistics
            try
            {
                _logger.LogWarning("⚠️ Speed tests failed, using network interface capacity estimate...");
                return EstimateFromNetworkInterface();
            }
            catch (Exception ex)
            {
                _logger.LogError($"All speed tests failed: {ex.Message}");
                return (10, 20);
            }
        }

        private async Task<(double upload, double download, double latency)> MeasureSpeedUsingSpeedtestCLI()
        {
            // Ensure speedtest.exe is available (downloads if missing)
            var speedtestPath = await _speedtestService.GetOrInstallSpeedtestAsync();
            if (string.IsNullOrEmpty(speedtestPath))
            {
                throw new Exception("Could not find or install Speedtest CLI");
            }

            _logger.LogInformation("⏱️  Running comprehensive speed test (may take up to 60 seconds)...");
            
            var processInfo = new ProcessStartInfo
            {
                FileName = speedtestPath,
                Arguments = "--accept-license --accept-gdpr --format=json",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = processInfo };
            
            var output = new System.Text.StringBuilder();
            var error = new System.Text.StringBuilder();

            process.OutputDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                    output.AppendLine(e.Data);
            };

            process.ErrorDataReceived += (sender, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                    error.AppendLine(e.Data);
            };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            _logger.LogInformation("🔄 Speedtest in progress... (selecting best server, testing download/upload)");
            
            var completed = await Task.Run(() => process.WaitForExit(90000));

            if (!process.HasExited)
            {
                _logger.LogWarning("⏰ Speedtest took longer than 90 seconds, terminating...");
                process.Kill();
                throw new Exception("Speedtest CLI timed out after 90 seconds");
            }

            if (process.ExitCode != 0)
            {
                var errorMsg = error.ToString();
                _logger.LogWarning($"❌ Speedtest CLI failed with exit code {process.ExitCode}");
                throw new Exception($"Speedtest CLI failed: {errorMsg}");
            }

            _logger.LogInformation("✅ Speedtest completed successfully, parsing results...");
            
            var jsonOutput = output.ToString();
            return ParseSpeedtestJSON(jsonOutput);
        }

        private (double upload, double download, double latency) ParseSpeedtestJSON(string json)
        {
            try
            {
                // Extract server info
                var serverMatch = System.Text.RegularExpressions.Regex.Match(json, @"""server"":\s*\{[^}]*""name"":\s*""([^""]+)""");
                var locationMatch = System.Text.RegularExpressions.Regex.Match(json, @"""server"":\s*\{[^}]*""location"":\s*""([^""]+)""");
                
                if (serverMatch.Success)
                {
                    var serverName = serverMatch.Groups[1].Value;
                    var location = locationMatch.Success ? locationMatch.Groups[1].Value : "Unknown";
                    _logger.LogInformation($"📍 Server: {serverName} ({location})");
                }
                
                // Extract latency
                double latency = 0;
                var latencyMatch = System.Text.RegularExpressions.Regex.Match(json, @"""ping"":\s*\{[^}]*""latency"":\s*([\d.]+)");
                if (latencyMatch.Success)
                {
                    latency = double.Parse(latencyMatch.Groups[1].Value);
                    _logger.LogInformation($"📶 Latency: {latency:F1} ms");
                }
                
                // Extract download and upload speeds
                var downloadMatch = System.Text.RegularExpressions.Regex.Match(json, @"""download"":\s*\{[^}]*""bandwidth"":\s*(\d+)");
                var uploadMatch = System.Text.RegularExpressions.Regex.Match(json, @"""upload"":\s*\{[^}]*""bandwidth"":\s*(\d+)");

                if (downloadMatch.Success && uploadMatch.Success)
                {
                    var downloadBytesPerSec = long.Parse(downloadMatch.Groups[1].Value);
                    var uploadBytesPerSec = long.Parse(uploadMatch.Groups[1].Value);

                    var downloadMbps = (downloadBytesPerSec * 8.0) / (1024 * 1024);
                    var uploadMbps = (uploadBytesPerSec * 8.0) / (1024 * 1024);

                    _logger.LogInformation($"📥 Download: {downloadMbps:F2} Mbps");
                    _logger.LogInformation($"📤 Upload: {uploadMbps:F2} Mbps");
                    
                    return (uploadMbps, downloadMbps, latency);
                }

                throw new Exception("Could not parse download/upload speeds from JSON");
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to parse speedtest output: {ex.Message}");
                throw;
            }
        }

        private async Task<double> MeasureDownloadSpeedAsync()
        {
            var testServers = new[]
            {
                "http://speedtest.tele2.net/50MB.zip",
                "http://ipv4.download.thinkbroadband.com/20MB.zip",
                "http://proof.ovh.net/files/50Mb.dat"
            };

            var allSpeeds = new List<double>();
            
            foreach (var testUrl in testServers)
            {
                try
                {
                    _logger.LogInformation($"Testing download from {new Uri(testUrl).Host}...");
                    
                    using var client = new HttpClient();
                    client.Timeout = TimeSpan.FromSeconds(45);
                    
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(45));
                    var stopwatch = Stopwatch.StartNew();
                    
                    using var response = await client.GetAsync(testUrl, HttpCompletionOption.ResponseHeadersRead, cts.Token);
                    
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning($"Server returned {response.StatusCode}");
                        continue;
                    }
                    
                    using var stream = await response.Content.ReadAsStreamAsync();
                    byte[] buffer = new byte[262144]; // 256KB buffer
                    long totalBytes = 0;
                    int bytesRead;
                    
                    while ((bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, cts.Token)) > 0)
                    {
                        totalBytes += bytesRead;
                    }
                    
                    stopwatch.Stop();
                    
                    var seconds = stopwatch.Elapsed.TotalSeconds;
                    var speedMbps = (totalBytes * 8.0) / (1024 * 1024) / seconds;
                    
                    _logger.LogInformation($"✅ Downloaded {totalBytes / (1024 * 1024)}MB in {seconds:F2}s = {speedMbps:F1} Mbps");
                    
                    if (speedMbps > 0.5 && speedMbps < 10000)
                    {
                        allSpeeds.Add(speedMbps);
                        
                        if (speedMbps > 5)
                            return speedMbps;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Download test failed for {testUrl}: {ex.Message}");
                }
            }

            return allSpeeds.Count > 0 ? allSpeeds.Max() : 0;
        }

        private async Task<double> MeasureUploadSpeedAsync()
        {
            var uploadEndpoints = new[]
            {
                "https://httpbin.org/post",
                "https://speedtest.tele2.net/upload.php",
                "http://proof.ovh.net/files/upload.php"
            };

            var allSpeeds = new List<double>();
            var testSizes = new[] { 5 * 1024 * 1024, 10 * 1024 * 1024 };
            
            foreach (var size in testSizes)
            {
                foreach (var uploadUrl in uploadEndpoints)
                {
                    try
                    {
                        _logger.LogInformation($"Testing upload {size / (1024 * 1024)}MB to: {new Uri(uploadUrl).Host}");
                        
                        byte[] uploadData = new byte[size];
                        new Random().NextBytes(uploadData);
                        
                        using var client = new HttpClient();
                        client.Timeout = TimeSpan.FromSeconds(45);
                        
                        using var content = new ByteArrayContent(uploadData);
                        content.Headers.Add("Content-Type", "application/octet-stream");
                        
                        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(45));
                        var stopwatch = Stopwatch.StartNew();
                        var response = await client.PostAsync(uploadUrl, content, cts.Token);
                        stopwatch.Stop();
                        
                        if (response.IsSuccessStatusCode)
                        {
                            var seconds = stopwatch.Elapsed.TotalSeconds;
                            var speedMbps = (uploadData.Length * 8.0) / (1024 * 1024) / seconds;
                            
                            _logger.LogInformation($"✅ Uploaded {size / (1024 * 1024)}MB in {seconds:F2}s = {speedMbps:F1} Mbps");
                            
                            if (speedMbps > 0.5 && speedMbps < 10000)
                            {
                                allSpeeds.Add(speedMbps);
                                
                                if (speedMbps > 5)
                                    return speedMbps;
                            }
                        }
                        else
                        {
                            _logger.LogWarning($"Server returned {response.StatusCode}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Upload test failed for {uploadUrl}: {ex.Message}");
                    }
                }
            }

            return allSpeeds.Count > 0 ? allSpeeds.Max() : 0;
        }

        private (double upload, double download) EstimateFromNetworkInterface()
        {
            try
            {
                foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus == OperationalStatus.Up &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        nic.Speed > 0)
                    {
                        var linkSpeedMbps = nic.Speed / (1024.0 * 1024.0);
                        
                        _logger.LogInformation($"Using network interface '{nic.Name}' link speed: {linkSpeedMbps:F0} Mbps");
                        
                        var estimatedDownload = Math.Min(linkSpeedMbps * 0.8, 1000);
                        var estimatedUpload = Math.Min(linkSpeedMbps * 0.4, 500);
                        
                        return (estimatedUpload, estimatedDownload);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to get network interface speed: {ex.Message}");
            }
            
            return (10, 20);
        }

        private (double upload, double download) GetFallbackSpeeds(double latencyMs)
        {
            if (latencyMs < 10)
                return (50, 100);
            else if (latencyMs < 30)
                return (20, 50);
            else if (latencyMs < 60)
                return (10, 20);
            else
                return (5, 10);
        }
    }
}