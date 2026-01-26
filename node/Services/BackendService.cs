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

namespace BlendFarm.Node.Services
{
    public class NodeBackendService : BackgroundService
    {
        private readonly ILogger<NodeBackendService> _logger;
        private readonly PythonRunnerService _pythonRunner;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly string _nodeId;
        private readonly string _backendUrl;
        private Timer _heartbeatTimer;
        private string _currentJobId;
        private int _currentProgress;
        private DateTime _jobStartTime;
        private object _jobLock = new object();
        private bool _isBlenderAvailable = false;
        private ConcurrentDictionary<int, (string uploadUrl, string s3Key)> _frameUploadUrls;
        
        // File cache for downloaded blend files
        private readonly ConcurrentDictionary<string, (string filePath, DateTime downloadedAt)> _blendFileCache;
        private static readonly TimeSpan _cacheExpiry = TimeSpan.FromHours(24); // Cache for 24 hours

        public NodeBackendService(
            ILogger<NodeBackendService> logger,
            PythonRunnerService pythonRunner,
            IConfiguration configuration)
        {
            _logger = logger;
            _pythonRunner = pythonRunner;
            _configuration = configuration;
            _nodeId = configuration["NodeSettings:NodeId"] ?? Guid.NewGuid().ToString();
            _backendUrl = configuration["Backend:Url"] ?? "https://fpcp8k7whm.ap-south-1.awsapprunner.com";
            _frameUploadUrls = new ConcurrentDictionary<int, (string, string)>();
            _blendFileCache = new ConcurrentDictionary<string, (string, DateTime)>();
            
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

            // Detect hardware
            var hardwareInfo = await DetectHardwareAsync();

            // Register with backend
            var registered = await RegisterWithBackendAsync(hardwareInfo);
            if (!registered)
            {
                _logger.LogError("Failed to register with backend. Retrying in 30 seconds...");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                // Try to restart the service
                await ExecuteAsync(stoppingToken);
                return;
            }

            // Test backend connection
            if (!await TestBackendConnectionAsync())
            {
                _logger.LogError("Cannot connect to backend. Service will retry periodically.");
            }

            // Start heartbeat
            _heartbeatTimer = new Timer(SendHeartbeat, null, TimeSpan.Zero, TimeSpan.FromSeconds(30));

            // Start job polling
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollForJobsAsync(stoppingToken);
                    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Job polling error: {ex.Message}");
                    await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                }
            }

            // Clean up
            _heartbeatTimer?.Dispose();
            
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

        private async Task<HardwareInfo> DetectHardwareAsync()
        {
            var info = new HardwareInfo
            {
                NodeId = _nodeId,
                Os = GetOperatingSystemInfo(),
                CpuCores = Environment.ProcessorCount,
                GpuName = "Unknown",
                GpuVRAM = 0,
                RamGB = GetTotalMemoryGB(),
                BlenderVersion = await GetBlenderVersionAsync()
            };

            // Try to detect NVIDIA GPU
            info.GpuName = await DetectNvidiaGpuAsync();
            if (info.GpuName != "Unknown")
            {
                info.GpuVRAM = await DetectNvidiaVramAsync();
            }

            return info;
        }

        private async Task<string> DetectNvidiaGpuAsync()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "nvidia-smi",
                        Arguments = "--query-gpu=name --format=csv,noheader",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
                {
                    return output.Trim();
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"NVIDIA GPU detection failed: {ex.Message}");
            }

            return "Unknown";
        }

        private async Task<bool> RegisterWithBackendAsync(HardwareInfo hardware)
        {
            int maxRetries = 5;
            for (int retry = 0; retry < maxRetries; retry++)
            {
                try
                {
                    var registrationData = new
                    {
                        nodeId = _nodeId,
                        name = $"Node-{Environment.MachineName}",
                        os = hardware.Os,
                        hardware = new
                        {
                            cpuCores = hardware.CpuCores,
                            cpuScore = CalculateCpuScore(),
                            gpuName = hardware.GpuName,
                            gpuVRAM = hardware.GpuVRAM,
                            gpuScore = CalculateGpuScore(hardware.GpuName, hardware.GpuVRAM),
                            ramGB = hardware.RamGB,
                            blenderVersion = hardware.BlenderVersion
                        },
                        capabilities = new
                        {
                            supportedEngines = new[] { "CYCLES", "EEVEE" },
                            supportedGPUs = hardware.GpuName != "Unknown" ? 
                                new[] { "CUDA", "OPTIX" } : new[] { "CPU" },
                            maxSamples = 4096,
                            maxResolutionX = 7680,
                            maxResolutionY = 4320,
                            supportsTiles = true,
                            supportsAnimation = true,
                            supportsImage = true
                        },
                        ipAddress = GetLocalIPAddress(),
                        status = "online"
                    };

                    var json = JsonConvert.SerializeObject(registrationData);
                    var content = new StringContent(json, Encoding.UTF8, "application/json");

                    _logger.LogInformation($"📤 Registering with backend: {_backendUrl}/api/nodes/register");
                    
                    var response = await _httpClient.PostAsync("/api/nodes/register", content);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        _logger.LogInformation($"✅ Registered with backend: {responseContent}");
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

        private async void SendHeartbeat(object? state)
        {
            try
            {
                var heartbeatData = new
                {
                    status = "online",
                    resources = new
                    {
                        cpuPercent = await GetCpuUsageAsync(),
                        gpuPercent = await GetGpuUsageAsync(),
                        ramUsedMB = GetUsedMemoryMB(),
                        diskFreeMB = GetFreeDiskSpaceMB()
                    },
                    currentJob = GetCurrentJobId(),
                    progress = GetCurrentProgress(),
                    uptime = (int)(DateTime.UtcNow - Process.GetCurrentProcess().StartTime).TotalSeconds
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
                    
                    var assignment = JsonConvert.DeserializeObject<JobAssignmentResponse>(responseJson);
                    
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

        private async Task ProcessJobAsync(JobAssignmentResponse assignment, CancellationToken cancellationToken)
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
            return (null, null);
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
        private string GetOperatingSystemInfo()
        {
            return $"{Environment.OSVersion.Platform} {Environment.OSVersion.Version}";
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

        private int CalculateCpuScore()
        {
            return Environment.ProcessorCount * 1000;
        }

        private int CalculateGpuScore(string gpuName, int vramMB)
        {
            if (gpuName == "Unknown") return 0;
            
            if (vramMB >= 8000) return 5000;
            if (vramMB >= 4000) return 3000;
            return 1000;
        }

        private async Task<int> DetectNvidiaVramAsync()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "nvidia-smi",
                        Arguments = "--query-gpu=memory.total --format=csv,noheader",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
                {
                    var vramText = output.Trim();
                    if (vramText.Contains("MiB"))
                    {
                        var vramValue = vramText.Replace(" MiB", "").Trim();
                        if (int.TryParse(vramValue, out int vramMB))
                        {
                            return vramMB;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"NVIDIA VRAM detection failed: {ex.Message}");
            }

            return 0;
        }

        private class HardwareInfo
        {
            public string NodeId { get; set; }
            public string Os { get; set; }
            public int CpuCores { get; set; }
            public string GpuName { get; set; }
            public int GpuVRAM { get; set; }
            public int RamGB { get; set; }
            public string BlenderVersion { get; set; }
        }

        private class JobAssignmentResponse
        {
            [JsonProperty("jobId")]
            public string? JobId { get; set; }
            
            [JsonProperty("frames")]
            public List<int>? Frames { get; set; }
            
            [JsonProperty("blendFileUrl")]
            public string? BlendFileUrl { get; set; }
            
            [JsonProperty("frameUploadUrls")]
            public Dictionary<string, FrameUploadInfo>? FrameUploadUrls { get; set; }
            
            [JsonProperty("settings")]
            public RenderSettings? Settings { get; set; }
            
            [JsonProperty("totalFrames")]
            public int? TotalFrames { get; set; }
            
            [JsonProperty("assignedFramesCount")]
            public int? AssignedFramesCount { get; set; }
            
            [JsonProperty("jobProgress")]
            public int? JobProgress { get; set; }
            
            [JsonProperty("isResume")]
            public bool? IsResume { get; set; }
        }

        private class FrameUploadInfo
        {
            [JsonProperty("uploadUrl")]
            public string UploadUrl { get; set; }
            
            [JsonProperty("s3Key")]
            public string S3Key { get; set; }
        }

        private class UploadUrlResponse
        {
            [JsonProperty("success")]
            public bool Success { get; set; }
            
            [JsonProperty("uploadUrl")]
            public string UploadUrl { get; set; }
            
            [JsonProperty("s3Key")]
            public string S3Key { get; set; }
        }

        private class RenderSettings
        {
            public string? Engine { get; set; }
            public string? Device { get; set; }
            public int Samples { get; set; }
            public int ResolutionX { get; set; }
            public int ResolutionY { get; set; }
            public string? Denoiser { get; set; }
            public int TileSize { get; set; }
            public string? OutputFormat { get; set; } = "PNG";
            public int CreditsPerFrame { get; set; } = 1;
        }
    }
}