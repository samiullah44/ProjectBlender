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
        
        // File cache for downloaded blend files
        private readonly ConcurrentDictionary<string, (string filePath, DateTime downloadedAt)> _blendFileCache;
        private static readonly TimeSpan _cacheExpiry = TimeSpan.FromHours(24); // Cache for 24 hours

        public NodeBackendService(
            ILogger<NodeBackendService> logger,
             ILoggerFactory loggerFactory,
            PythonRunnerService pythonRunner,
            IConfiguration configuration,
            NodeIdentityService identityService)
        {
            _logger = logger;
            _loggerFactory = loggerFactory;
            _pythonRunner = pythonRunner;
            _configuration = configuration;
            _identityService = identityService;
            _nodeId = configuration["NodeSettings:NodeId"] ?? Guid.NewGuid().ToString();
            _backendUrl = configuration["Backend:Url"] ?? "https://fpcp8k7whm.ap-south-1.awsapprunner.com";
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
            
            _logger.LogInformation($"🎯 Backend URL set to: {_backendUrl}");
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
        _loggerFactory.CreateLogger<HardwareDetector>() 
    );
    // Detect ALL hardware with network test
    _logger.LogInformation("🔍 Detecting complete system specifications...");
    try
    {
        _detectedHardware = await hardwareDetector.DetectAllAsync(
            _nodeId, 
            _backendUrl
        );

        // If NodeId is default or empty, generate a stable unique identity
        if (string.IsNullOrEmpty(_nodeId) || _nodeId == "node_auto" || _nodeId == "node_1" || 
            _nodeId.StartsWith("node-") && _nodeId.Length > 20) 
        {
            var stableId = GenerateStableNodeId(_detectedHardware);
            _nodeId = stableId;
            _detectedHardware.NodeId = stableId;
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

            // Register with backend
            var registered = await RegisterWithBackendAsync(_detectedHardware);
            if (!registered)
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

            // WS runs until cancellation or unrecoverable error.
            // REST fallback polling (legacy) runs in parallel and only does work
            // when the WS is not connected.
            var wsTask = wsService.RunAsync(stoppingToken);

            var fallbackPollTask = Task.Run(async () =>
            {
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
                        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                    }
                    catch (OperationCanceledException) { break; }
                    catch (Exception ex)
                    {
                        _logger.LogError($"Fallback poll error: {ex.Message}");
                        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                    }
                }
            }, stoppingToken);

            await Task.WhenAll(wsTask, fallbackPollTask);

            // Clean up cached files on shutdown
            await CleanupCacheAsync();
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
        private async Task RunBenchmarkIfNeededAsync()
{
    _logger.LogInformation("🎯 Checking benchmark status...");
    
    try
    {
        // Force benchmark on first run, otherwise use cache
        var isFirstRun = !File.Exists(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "BlendFarm", "benchmark_cache.json"));
        
        _benchmarkResult = await _computeScoreService.GetOrRunBenchmarkAsync(isFirstRun);
        
        if (_benchmarkResult.IsComplete)
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
                Path.Combine(Directory.GetCurrentDirectory(), "Blender", "blender.exe"),
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
            var registrationData = new
            {
                nodeId = _nodeId,
                name = _nodeDisplayName,
                
                // REAL OS info
                os = hardware.Os.Name,
                
                // REAL hardware specs
                hardware = new
                {
                    // CPU
                    cpuModel = hardware.Cpu.Model,
                    cpuCores = hardware.Cpu.PhysicalCores,
                    cpuThreads = hardware.Cpu.LogicalCores,
                    cpuSpeedGHz = hardware.Cpu.BaseClockGHz,
                    cpuScore = CalculateCpuScore(hardware.Cpu),  // Updated method
                    
                    // GPU (first one for primary)
                    gpuName = hardware.Gpus.FirstOrDefault()?.Model ?? "Unknown",
                    gpuVRAM = hardware.Gpus.FirstOrDefault()?.VramMB ?? 0,
                    gpuScore = CalculateGpuScore(hardware.Gpus.FirstOrDefault()),  // Updated method
                    
                    // All GPUs
                    allGpus = hardware.Gpus.Select(g => new
                    {
                        model = g.Model,
                        vramMB = g.VramMB,
                        cudaSupported = g.CudaSupported,
                        optixSupported = g.OptixSupported
                    }),
                    
                    // RAM
                    ramGB = hardware.Ram.TotalGB,
                    ramAvailableGB = hardware.Ram.AvailableGB,
                    ramType = hardware.Ram.Type,
                    
                    // Storage
                    storageFreeGB = hardware.Storage.FreeGB,
                    storageType = hardware.Storage.Type,
                    
                    // Network
                    uploadSpeedMbps = hardware.Network.UploadSpeedMbps,
                    downloadSpeedMbps = hardware.Network.DownloadSpeedMbps,
                    latencyMs = hardware.Network.LatencyMs,
                    
                    // Blender
                    blenderVersion = hardware.Os.DotNetVersion,  // Or get from your existing method
                    
                    // Hardware fingerprint for anti-cheat
                    hardwareFingerprint = hardware.HardwareFingerprint
                },
                
                // REAL capabilities based on hardware
                capabilities = new
                {
                    supportedEngines = new[] { "CYCLES", "EEVEE" },
                    supportedGPUs = hardware.Gpus.Any(g => g.CudaSupported) ? 
                        new[] { "CUDA", "OPTIX" } : 
                        hardware.Gpus.Any(g => g.HipSupported) ?
                            new[] { "HIP" } : new[] { "CPU" },
                    maxSamples = hardware.Ram.TotalGB >= 32 ? 4096 : 1024,
                    maxResolutionX = hardware.Ram.TotalGB >= 16 ? 7680 : 3840,
                    maxResolutionY = hardware.Ram.TotalGB >= 16 ? 4320 : 2160,
                    supportsTiles = true,
                    supportsAnimation = true,
                    supportsImage = true,
                    
                    // Node tier based on REAL performance
                    nodeTier = CalculateNodeTier(hardware)
                },
                
                    // Benchmark scores
                    performance = new
                    {
                        effectiveScore = _computeScore?.EffectiveScore ?? 0,
                        gpuScore = _computeScore?.GpuScore ?? 0,
                        cpuScore = _computeScore?.CpuScore ?? 0,
                        tier = _computeScore?.Tier ?? "Unknown",
                        benchmarkDate = _computeScore?.BenchmarkDate ?? DateTime.MinValue,
                        blenderVersion = _computeScore?.BlenderVersion ?? "Unknown"
                    },
                ipAddress = _detectedHardware?.Ip?.LocalIP ?? hardware.Network.LocalIP ?? GetLocalIPAddress(),
                publicIp  = _detectedHardware?.Ip?.PublicIP ?? hardware.Network.PublicIP,
                hostname  = _detectedHardware?.Ip?.Hostname ?? Environment.MachineName,
                // Hardware identity for duplicate-node blocking
                hardwareFingerprint = hardware.HardwareFingerprint,
                biosUuid            = hardware.Fingerprint?.BiosUuid,
                motherboardSerial   = hardware.Fingerprint?.MotherboardSerial,
                diskSerial          = hardware.Fingerprint?.DiskSerial,
                status = "online",
                
                // When the hardware was verified
                hardwareVerifiedAt = hardware.DetectedAt
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

        await _httpClient.PostAsync($"/api/nodes/{_nodeId}/heartbeat", content);
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
                    
                    var assignment = JsonConvert.DeserializeObject<JobAssignment>(responseJson);
                    
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
            }

            // Clear previous frame upload URLs
            _frameUploadUrls.Clear();

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

                // Download blend file (using direct S3 URL) - with caching
                var blendFilePath = await DownloadBlendFileAsync(assignment.BlendFileUrl, assignment.JobId, cancellationToken);
                if (string.IsNullOrEmpty(blendFilePath))
                {
                    _logger.LogError($"❌ Failed to download blend file for job {assignment.JobId}");
                    await ReportFailureAsync(assignment.JobId, 0, "Failed to download blend file", null, cancellationToken);
                    return;
                }
                
                _logger.LogInformation($"📥 Blend file ready: {blendFilePath}");

                // Create job directory
                var jobDirectory = Path.Combine(Path.GetTempPath(), "BlendFarm", "Jobs", assignment.JobId);
                Directory.CreateDirectory(jobDirectory);

                // Get render settings from assignment
                var settings = assignment.Settings ?? new RenderSettings();
                var engine = settings.Engine ?? "CYCLES";
                var device = settings.Device ?? "GPU"; 
                var samples = settings.Samples > 0 ? settings.Samples : 30;
                var resolutionX = settings.ResolutionX > 0 ? settings.ResolutionX : 1920;
                var resolutionY = settings.ResolutionY > 0 ? settings.ResolutionY : 1080;
                var outputFormat = settings.OutputFormat ?? "PNG";

                _logger.LogInformation($"⚙️  Render settings: {engine}, {device}, {samples} samples, {resolutionX}x{resolutionY}, Output: {outputFormat}");

                if (assignment.Frames == null || assignment.Frames.Count == 0)
                {
                    _logger.LogError($"No frames assigned for job {assignment.JobId}");
                    await ReportFailureAsync(assignment.JobId, 0, "No frames assigned", null, cancellationToken);
                    return;
                }

                // Render each assigned frame
                for (int i = 0; i < assignment.Frames.Count; i++)
                {
                    if (cancellationToken.IsCancellationRequested)
                        break;

                    var frame = assignment.Frames[i];
                    _logger.LogInformation($"🎞️  Rendering frame {frame} ({i + 1}/{assignment.Frames.Count})");

                    var outputExtension = outputFormat.ToLower();
                    if (outputExtension == "jpeg") outputExtension = "jpg";
                    
                    var outputFileName = $"frame_{frame:D4}.{outputExtension}";
                    var outputPath = Path.Combine(jobDirectory, outputFileName);

                    // IMPORTANT: Pass ALL settings from backend to PythonRunner
                    // Determine if this is an animation or image render
                    var isAnimation = assignment.Frames.Count > 1 || frame > 0;
                    
                    var success = await _pythonRunner.RunRenderAsync(
                        blendFilePath: blendFilePath,
                        frame: frame,
                        outputPath: outputPath,
                        samples: samples,
                        engine: engine,
                        device: device,
                        resolutionX: resolutionX,
                        resolutionY: resolutionY,
                        outputFormat: outputFormat,
                        useAnimationSettings: isAnimation,
                        cancellationToken: cancellationToken);

                    if (success && File.Exists(outputPath))
                    {
                        // Get S3 upload URL for this frame
                        if (!_frameUploadUrls.TryGetValue(frame, out var uploadInfo))
                        {
                            // If we don't have upload URL, request one from backend
                            _logger.LogWarning($"No upload URL for frame {frame}, requesting one...");
                            uploadInfo = await RequestUploadUrlAsync(assignment.JobId, frame, outputFormat, cancellationToken);
                        }

                        if (uploadInfo.uploadUrl == null || uploadInfo.s3Key == null)
                        {
                            _logger.LogError($"❌ No valid upload URL or S3 key for frame {frame}");
                            await ReportFailureAsync(assignment.JobId, frame, "No valid upload URL", null, cancellationToken);
                            continue;
                        }

                        // Upload result directly to S3 with retry logic
                        _logger.LogInformation($"📤 Uploading frame {frame} directly to S3...");
                        var uploadResult = await UploadToS3Async(outputPath, uploadInfo.uploadUrl, uploadInfo.s3Key, cancellationToken);
                        
                        if (uploadResult)
                        {
                            // Report completion to backend (without uploading file)
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
                            
                            // Clean up local file after successful upload
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
                            // All retry attempts failed
                            await ReportFailureAsync(assignment.JobId, frame, "All upload attempts failed", uploadInfo.s3Key, cancellationToken);
                            _logger.LogError($"❌ Frame {frame} upload failed after all retry attempts");
                            
                            // Keep the file locally for debugging
                            _logger.LogInformation($"📁 Local file kept at: {outputPath}");
                        }
                    }
                    else
                    {
                        await ReportFailureAsync(assignment.JobId, frame, "Render failed", null, cancellationToken);
                        _logger.LogError($"❌ Frame {frame} render failed");
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
                ClearCurrentJob();
                _frameUploadUrls.Clear();
            }
        }

        private async Task<string> DownloadBlendFileAsync(string blendFileUrl, string jobId, CancellationToken cancellationToken)
        {
            try
            {
                // Check cache first
                if (_blendFileCache.TryGetValue(jobId, out var cachedFile))
                {
                    // Check if file exists and is not expired
                    if (File.Exists(cachedFile.filePath) && 
                        DateTime.UtcNow - cachedFile.downloadedAt < _cacheExpiry)
                    {
                        _logger.LogInformation($"📂 Using cached blend file for job {jobId}");
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

                var fileName = $"blendfile_{jobId}.blend";
                var localPath = Path.Combine(cacheDir, fileName);

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
                        var json = await response.Content.ReadAsStringAsync(cancellationToken);
                        var result = JsonConvert.DeserializeObject<UploadUrlResponse>(json);
                        
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
                var completionData = new
                {
                    jobId,
                    frame,
                    renderTime,
                    s3Key,
                    fileSize,
                    nodeId = _nodeId,
                    success = true
                };

                var json = JsonConvert.SerializeObject(completionData);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

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

        private async Task ReportFailureAsync(string jobId, int frame, string error, string s3Key, CancellationToken cancellationToken)
        {
            try
            {
                var failureData = new
                {
                    jobId,
                    frame,
                    error,
                    nodeId = _nodeId,
                    s3Key,
                    timestamp = DateTime.UtcNow
                };

                var json = JsonConvert.SerializeObject(failureData);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

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