using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Benchmark.Models;

namespace BlendFarm.Node.Benchmark
{
    public class VRayBenchmark
    {
        private readonly ILogger _logger;
        private readonly BenchmarkConfiguration _config;
        private readonly HttpClient _httpClient;
        private readonly int _commandTimeoutMs = 60000;

        public VRayBenchmark(ILogger logger, BenchmarkConfiguration config)
        {
            _logger = logger;
            _config = config;

            _config.VRayBenchmarkDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "vray_benchmark");
            _config.VRayResultsDir = Path.Combine(_config.VRayBenchmarkDir, "results");

            _httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(30) };

            Directory.CreateDirectory(_config.VRayBenchmarkDir);
            Directory.CreateDirectory(_config.VRayResultsDir);
        }

        public async Task<BenchmarkResult> RunBenchmarkAsync()
        {
            _logger.LogInformation("🎬 Starting V-Ray Benchmark...");
            _logger.LogInformation($"⏱️  Running {_config.BenchmarkIterations} iterations for accuracy (takes 3-5 minutes)");

            try
            {
                var benchmarkExe = await EnsureBenchmarkDownloadedAsync();
                
                // First, let's verify the CLI works by getting version
                await VerifyCLIWorkingAsync(benchmarkExe);
                
                _logger.LogInformation("🔍 Detecting available devices...");
                var (hasCpu, hasGpu) = await ListDevicesWithTimeoutAsync(benchmarkExe);

                List<double> cpuScores = new();
                List<double> gpuScores = new();

                // Run multiple iterations for stability
                for (int i = 1; i <= _config.BenchmarkIterations; i++)
                {
                    _logger.LogInformation($"📊 Iteration {i}/{_config.BenchmarkIterations}");
                    
                    if (hasCpu)
                    {
                        _logger.LogInformation("   🖥️ Running CPU benchmark...");
                        var cpuScore = await RunCpuBenchmarkWithTimeoutAsync(benchmarkExe);
                        if (cpuScore > 0)
                        {
                            cpuScores.Add(cpuScore);
                            _logger.LogInformation($"      ✅ CPU Score: {cpuScore:F0} vsamples");
                        }
                        else
                        {
                            _logger.LogError("      ❌ CPU benchmark returned 0 score - trying alternative method...");
                            // Try alternative command
                            var altCpuScore = await RunAlternativeCpuBenchmarkAsync(benchmarkExe);
                            if (altCpuScore > 0)
                            {
                                cpuScores.Add(altCpuScore);
                                _logger.LogInformation($"      ✅ CPU Score (alt): {altCpuScore:F0} vsamples");
                            }
                        }
                    }

                    if (hasGpu)
                    {
                        _logger.LogInformation("   🎮 Running GPU benchmark...");
                        var gpuScore = await RunGpuBenchmarkWithTimeoutAsync(benchmarkExe);
                        if (gpuScore > 0)
                        {
                            gpuScores.Add(gpuScore);
                            _logger.LogInformation($"      ✅ GPU Score: {gpuScore:F0} vpaths");
                        }
                        else
                        {
                            _logger.LogError("      ❌ GPU benchmark returned 0 score - trying alternative method...");
                            var altGpuScore = await RunAlternativeGpuBenchmarkAsync(benchmarkExe);
                            if (altGpuScore > 0)
                            {
                                gpuScores.Add(altGpuScore);
                                _logger.LogInformation($"      ✅ GPU Score (alt): {altGpuScore:F0} vpaths");
                            }
                        }
                    }
                }

                // Calculate statistics
                double avgCpuScore = CalculateAverage(cpuScores);
                double avgGpuScore = CalculateAverage(gpuScores);
                double cpuStdDev = CalculateStdDev(cpuScores, avgCpuScore);
                double gpuStdDev = CalculateStdDev(gpuScores, avgGpuScore);

                var result = new BenchmarkResult
                {
                    BenchmarkType = "V-Ray",
                    CpuScore = avgCpuScore,
                    GpuScore = avgGpuScore,
                    RawCpuScore = avgCpuScore,
                    RawGpuScore = avgGpuScore,
                    CpuUnit = "vsamples",
                    GpuUnit = "vpaths",
                    EffectiveScore = (avgCpuScore * 0.3) + (avgGpuScore * 0.7),
                    Iterations = _config.BenchmarkIterations,
                    CpuStdDev = cpuStdDev,
                    GpuStdDev = gpuStdDev,
                    RunDate = DateTime.UtcNow,
                    IsComplete = true
                };

                _logger.LogInformation("═══════════════════════════════════════");
                _logger.LogInformation($"📊 V-RAY BENCHMARK RESULTS");
                _logger.LogInformation($"   CPU Score: {result.CpuScore:F0} ±{result.CpuStdDev:F1} vsamples");
                _logger.LogInformation($"   GPU Score: {result.GpuScore:F0} ±{result.GpuStdDev:F1} vpaths");
                _logger.LogInformation($"   Effective: {result.EffectiveScore:F0}");
                _logger.LogInformation($"   Iterations: {result.Iterations}");
                _logger.LogInformation("═══════════════════════════════════════");

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ V-Ray Benchmark failed: {ex.Message}");
                return new BenchmarkResult
                {
                    BenchmarkType = "V-Ray",
                    RunDate = DateTime.UtcNow,
                    IsComplete = false,
                    Error = ex.Message
                };
            }
        }

        private async Task VerifyCLIWorkingAsync(string benchmarkExe)
        {
            try
            {
                _logger.LogInformation("🔧 Verifying V-Ray CLI is working...");
                var output = await RunProcessWithTimeoutAsync(benchmarkExe, "--version", 10000);
                
                if (string.IsNullOrEmpty(output))
                {
                    throw new Exception("V-Ray CLI not responding");
                }
                
                _logger.LogInformation($"✅ V-Ray CLI version: {output.Trim()}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ V-Ray CLI verification failed: {ex.Message}");
                throw;
            }
        }

        private async Task<double> RunAlternativeCpuBenchmarkAsync(string benchmarkExe)
        {
            try
            {
                // Try alternative command format
                var output = await RunProcessWithTimeoutAsync(benchmarkExe, "benchmark --mode vray", _commandTimeoutMs * 2);
                return ParseScoreFromOutputAlternative(output, "cpu");
            }
            catch
            {
                return 0;
            }
        }

        private async Task<double> RunAlternativeGpuBenchmarkAsync(string benchmarkExe)
        {
            try
            {
                // Try alternative command format
                var output = await RunProcessWithTimeoutAsync(benchmarkExe, "benchmark --mode vray-gpu", _commandTimeoutMs * 2);
                return ParseScoreFromOutputAlternative(output, "gpu");
            }
            catch
            {
                return 0;
            }
        }

private async Task<(bool hasCpu, bool hasGpu)> ListDevicesWithTimeoutAsync(string benchmarkExe)
{
    try
    {
        bool hasCpu = false;
        bool hasGpu = false;
        
        // 1️⃣ Check CPU devices using correct command
        _logger.LogDebug("Checking CPU devices with: -m vray -l");
        // Reduced timeout to 15s for device listing
        var cpuOutput = await RunProcessWithTimeoutAsync(benchmarkExe, "-m vray -l", 60000);
        
        if (!string.IsNullOrEmpty(cpuOutput))
        {
            _logger.LogDebug($"CPU device list output: {cpuOutput}");
            
            // CPU should always be present
            hasCpu = cpuOutput.Contains("CPU", StringComparison.OrdinalIgnoreCase) ||
                     cpuOutput.Contains("Processor", StringComparison.OrdinalIgnoreCase) ||
                     cpuOutput.Contains("[0]", StringComparison.OrdinalIgnoreCase);
            
            // If we don't see CPU in output, assume it's available (V-Ray always has CPU)
            if (!hasCpu) hasCpu = true;
        }
        
        // 2️⃣ Check GPU devices using correct command
        _logger.LogDebug("Checking GPU devices with: -m vray-gpu -l");
        // Reduced timeout to 15s for device listing (this is where hangs usually happen)
        var gpuOutput = await RunProcessWithTimeoutAsync(benchmarkExe, "-m vray-gpu -l", 60000);
        
        if (!string.IsNullOrEmpty(gpuOutput))
        {
            _logger.LogDebug($"GPU device list output: {gpuOutput}");
            
            // Look for any GPU
            hasGpu = gpuOutput.Contains("NVIDIA", StringComparison.OrdinalIgnoreCase) ||
                     gpuOutput.Contains("GeForce", StringComparison.OrdinalIgnoreCase) ||
                     gpuOutput.Contains("GTX", StringComparison.OrdinalIgnoreCase) ||
                     gpuOutput.Contains("RTX", StringComparison.OrdinalIgnoreCase) ||
                     gpuOutput.Contains("AMD", StringComparison.OrdinalIgnoreCase) ||
                     gpuOutput.Contains("Intel", StringComparison.OrdinalIgnoreCase) ||
                     gpuOutput.Contains("GPU", StringComparison.OrdinalIgnoreCase) ||
                     gpuOutput.Contains("[1]", StringComparison.OrdinalIgnoreCase); // GPU is often device 1
        }

        _logger.LogInformation($"   Detected - CPU: {hasCpu}, GPU: {hasGpu}");
        return (hasCpu, hasGpu);
    }
    catch (Exception ex)
    {
        _logger.LogWarning($"⚠️ Device list detection timed out or failed: {ex.Message}. Defaulting to CPU only.");
        return (true, false);
    }
}

// Also update the GPU benchmark commands to include RTX flag for better performance
private async Task<double> RunGpuBenchmarkWithTimeoutAsync(string benchmarkExe)
{
    try
    {
        // Try different command formats with correct syntax
        string[] gpuCommands = { 
            "-m vray-gpu",                    // Standard GPU
            "-m vray-gpu --rtx",               // GPU with RTX (better for RTX cards)
            "-device-type CUDA -m vray-gpu",   // Explicit CUDA
            "-device-type OPTIX -m vray-gpu"   // Explicit OPTIX
        };
        
        foreach (var cmd in gpuCommands)
        {
            _logger.LogDebug($"Trying GPU command: {cmd}");
            var output = await RunProcessWithTimeoutAsync(benchmarkExe, cmd, _commandTimeoutMs * 2);
            var score = ParseScoreFromOutput(output, "vpaths");
            
            if (score > 0)
            {
                _logger.LogInformation($"   ✅ GPU benchmark successful with command: {cmd}");
                return score;
            }
        }
        
        return 0;
    }
    catch (Exception ex)
    {
        _logger.LogWarning($"⚠️ GPU benchmark failed: {ex.Message}");
        return 0;
    }
}

// Update CPU commands as well
private async Task<double> RunCpuBenchmarkWithTimeoutAsync(string benchmarkExe)
{
    try
    {
        // Try different command formats with correct syntax
        string[] cpuCommands = { 
            "-m vray",                         // Standard CPU
            "-device-type CPU -m vray"         // Explicit CPU
        };
        
        foreach (var cmd in cpuCommands)
        {
            _logger.LogDebug($"Trying CPU command: {cmd}");
            var output = await RunProcessWithTimeoutAsync(benchmarkExe, cmd, _commandTimeoutMs * 2);
            var score = ParseScoreFromOutput(output, "vsamples");
            
            if (score > 0)
            {
                _logger.LogInformation($"   ✅ CPU benchmark successful with command: {cmd}");
                return score;
            }
        }
        
        return 0;
    }
    catch (Exception ex)
    {
        _logger.LogWarning($"⚠️ CPU benchmark failed: {ex.Message}");
        return 0;
    }
}

        private async Task<string> RunProcessWithTimeoutAsync(string exe, string args, int timeoutMs)
        {
            using var cts = new CancellationTokenSource();
            cts.CancelAfter(timeoutMs);
            
            var psi = new ProcessStartInfo(exe, args)
            {
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = _config.VRayBenchmarkDir
            };

            using var process = Process.Start(psi);
            
            var outputBuilder = new System.Text.StringBuilder();
            var errorBuilder = new System.Text.StringBuilder();

            var readOutputTask = Task.Run(async () =>
            {
                char[] buffer = new char[1024];
                int charsRead;
                try
                {
                    while ((charsRead = await process.StandardOutput.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        var text = new string(buffer, 0, charsRead);
                        outputBuilder.Append(text);
                        
                        var currentStr = outputBuilder.ToString();
                        if (currentStr.EndsWith("[y/n]", StringComparison.OrdinalIgnoreCase) ||
                            currentStr.EndsWith("[y/n]:", StringComparison.OrdinalIgnoreCase) ||
                            currentStr.EndsWith("[y/n]: ", StringComparison.OrdinalIgnoreCase) ||
                            text.Contains("[y/n]", StringComparison.OrdinalIgnoreCase))
                        {
                            try
                            {
                                _logger.LogDebug("Auto-answering V-Ray prompt with 'y'");
                                await process.StandardInput.WriteLineAsync("y");
                                await process.StandardInput.FlushAsync();
                            }
                            catch { }
                        }
                    }
                }
                catch { }
            });

            var readErrorTask = Task.Run(async () =>
            {
                char[] buffer = new char[1024];
                int charsRead;
                try
                {
                    while ((charsRead = await process.StandardError.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        errorBuilder.Append(new string(buffer, 0, charsRead));
                    }
                }
                catch { }
            });
            
            try
            {
                await process.WaitForExitAsync(cts.Token);
                await Task.WhenAll(readOutputTask, readErrorTask);
            }
            catch (OperationCanceledException)
            {
                try 
                { 
                    if (!process.HasExited)
                    {
                        process.Kill(true); 
                        _logger.LogDebug($"   Successfully terminated hung process: {args}");
                    }
                } 
                catch (Exception killEx) 
                {
                    _logger.LogDebug($"   Could not kill hung process: {killEx.Message}");
                }
                
                _logger.LogWarning($"⚠️ V-Ray command timed out after {timeoutMs/1000}s: {args}");
                return string.Empty;
            }

            var output = outputBuilder.ToString();
            var error = errorBuilder.ToString();
            
            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogDebug($"V-Ray stderr: {error}");
            }
            
            return output;
        }

        private double ParseScoreFromOutput(string output, string unit)
        {
            if (string.IsNullOrEmpty(output))
                return 0;
            
            // Log the output for debugging
            _logger.LogDebug($"Raw V-Ray output: {output}");
            
            // Pattern for V-Ray CPU: "V-Ray score: 3669 vsamples"
            // Pattern for V-Ray GPU: "V-Ray GPU score: 678 vpaths"
            // Also try to match "Score: 1234" or just numbers before the unit
            
            string[] patterns = unit switch
            {
                "vsamples" => new[] 
                { 
                    @"V-Ray\s+score:\s*([\d,]+)",
                    @"Score:\s*([\d,]+)",
                    @"([\d,]+)\s+vsamples",
                    @"([\d,]+)\s+samples",
                    @"CPU[^\d]*([\d,]+)"
                },
                "vpaths" => new[] 
                { 
                    @"V-Ray\s+GPU\s+score:\s*([\d,]+)",
                    @"GPU\s+score:\s*([\d,]+)",
                    @"Score:\s*([\d,]+)",
                    @"([\d,]+)\s+vpaths",
                    @"([\d,]+)\s+paths",
                    @"GPU[^\d]*([\d,]+)"
                },
                _ => new[] { @"([\d,]+)\s+" + unit }
            };

            foreach (var pattern in patterns)
            {
                var match = Regex.Match(output, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var scoreStr = match.Groups[1].Value.Replace(",", "");
                    if (double.TryParse(scoreStr, out double score))
                    {
                        _logger.LogDebug($"Parsed score: {score} using pattern: {pattern}");
                        return score;
                    }
                }
            }

            // If no patterns match, try to find any number in the output
            var numberMatch = Regex.Match(output, @"(\d+)");
            if (numberMatch.Success && double.TryParse(numberMatch.Groups[1].Value, out double anyNumber))
            {
                _logger.LogWarning($"Using fallback number parsing: {anyNumber}");
                return anyNumber;
            }

            return 0;
        }

        private double ParseScoreFromOutputAlternative(string output, string type)
        {
            if (string.IsNullOrEmpty(output))
                return 0;
            
            // Try to find JSON in output
            var jsonStart = output.IndexOf('{');
            var jsonEnd = output.LastIndexOf('}');
            
            if (jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart)
            {
                var json = output.Substring(jsonStart, jsonEnd - jsonStart + 1);
                try
                {
                    var doc = System.Text.Json.JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("score", out var scoreElement))
                    {
                        return scoreElement.GetDouble();
                    }
                }
                catch { }
            }
            
            return 0;
        }

        private double CalculateAverage(List<double> values)
        {
            if (values.Count == 0) return 0;
            double sum = 0;
            foreach (var v in values) sum += v;
            return sum / values.Count;
        }

        private double CalculateStdDev(List<double> values, double mean)
        {
            if (values.Count <= 1) return 0;
            double sum = 0;
            foreach (var v in values)
            {
                sum += Math.Pow(v - mean, 2);
            }
            return Math.Sqrt(sum / (values.Count - 1));
        }

        private async Task<string> EnsureBenchmarkDownloadedAsync()
        {
            var searchPatterns = new[] { "vray-benchmark-*.exe", "vray-benchmark-cli.exe" };
            foreach (var pattern in searchPatterns)
            {
                var files = Directory.GetFiles(_config.VRayBenchmarkDir, pattern);
                if (files.Length > 0 && new FileInfo(files[0]).Length > 10 * 1024 * 1024)
                {
                    _logger.LogInformation($"✅ V-Ray CLI found at: {files[0]}");
                    return files[0];
                }
            }

            _logger.LogInformation("📥 V-Ray CLI not found. Attempting to download...");
            var urls = new List<string> { _config.VRayDownloadUrl };
            urls.AddRange(_config.VRayFallbackUrls);
            
            Exception lastEx = null;

            foreach (var url in urls)
            {
                try
                {
                    _logger.LogInformation($"   Trying: {url}");
                    using var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                    response.EnsureSuccessStatusCode();

                    var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                    var tempFile = Path.Combine(_config.VRayBenchmarkDir, $"vray-benchmark-{timestamp}.exe.tmp");

                    using (var contentStream = await response.Content.ReadAsStreamAsync())
                    using (var fileStream = new FileStream(tempFile, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
                    {
                        await contentStream.CopyToAsync(fileStream);
                    }

                    var finalExe = Path.Combine(_config.VRayBenchmarkDir, $"vray-benchmark-{timestamp}.exe");
                    File.Move(tempFile, finalExe);
                    _logger.LogInformation($"✅ V-Ray CLI downloaded successfully: {finalExe}");
                    return finalExe;
                }
                catch (Exception ex)
                {
                    lastEx = ex;
                    _logger.LogWarning($"⚠️ Download failed: {ex.Message}");
                }
            }

            throw lastEx ?? new Exception("Failed to download V-Ray CLI.");
        }
    }
}