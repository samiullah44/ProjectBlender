using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.RegularExpressions;
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
            _logger.LogInformation("⏱️  This will take 2-3 minutes depending on your hardware");

            try
            {
                var benchmarkExe = await EnsureBenchmarkDownloadedAsync();
                _logger.LogInformation("🔍 Detecting available devices...");
                var (hasCpu, hasGpu) = await ListDevicesAsync(benchmarkExe);

                double cpuScore = 0, gpuScore = 0;

                if (hasCpu)
                {
                    _logger.LogInformation("🖥️ Running CPU benchmark...");
                    cpuScore = await RunCpuBenchmarkAsync(benchmarkExe);
                }
                else
                {
                    _logger.LogInformation("ℹ️ CPU benchmark skipped");
                }

                if (hasGpu)
                {
                    _logger.LogInformation("🎮 Running GPU benchmark...");
                    gpuScore = await RunGpuBenchmarkAsync(benchmarkExe);
                }
                else
                {
                    _logger.LogWarning("⚠️ No GPU detected for benchmarking");
                }

                var result = new BenchmarkResult
                {
                    BenchmarkType = "V-Ray",
                    CpuScore = cpuScore,
                    GpuScore = gpuScore,
                    EffectiveScore = (cpuScore * 0.3) + (gpuScore * 0.7),
                    CpuRenderTime = cpuScore > 0 ? 10000.0 / cpuScore : 0,
                    GpuRenderTime = gpuScore > 0 ? 10000.0 / gpuScore : 0,
                    RunDate = DateTime.UtcNow,
                    IsComplete = true
                };

                _logger.LogInformation("═══════════════════════════════════════");
                _logger.LogInformation($"📊 V-RAY BENCHMARK RESULTS");
                _logger.LogInformation($"   CPU Score: {result.CpuScore:F0} vsamples");
                _logger.LogInformation($"   GPU Score: {result.GpuScore:F0} vpaths");
                _logger.LogInformation($"   Effective: {result.EffectiveScore:F0}");
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
            var urls = new List<string> { _config.VRayDownloadUrl, "https://download.chaos.com/vray-benchmark-cli-windows.exe" };
            Exception lastEx = null;

            foreach (var url in urls)
            {
                try
                {
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

        private async Task<(bool hasCpu, bool hasGpu)> ListDevicesAsync(string benchmarkExe)
        {
            var output = await RunProcessAsync(benchmarkExe, "-m vray-gpu -l");
            bool hasCpu = output.Contains("CPU");
            bool hasGpu = output.Contains("NVIDIA") || output.Contains("GeForce") || output.Contains("GTX") || output.Contains("RTX");

            _logger.LogInformation($"   Detected - CPU: {hasCpu}, GPU: {hasGpu}");
            return (hasCpu, hasGpu);
        }

        private async Task<double> RunCpuBenchmarkAsync(string benchmarkExe)
        {
            var output = await RunProcessAsync(benchmarkExe, "-m vray");
            var score = ParseScoreFromOutput(output, "vsamples");
            _logger.LogInformation($"   ✅ CPU Score: {score:F0} vsamples");
            return score;
        }

        private async Task<double> RunGpuBenchmarkAsync(string benchmarkExe)
        {
            var output = await RunProcessAsync(benchmarkExe, "-m vray-gpu");
            var score = ParseScoreFromOutput(output, "vpaths");
            _logger.LogInformation($"   ✅ GPU Score: {score:F0} vpaths");
            return score;
        }

        private async Task<string> RunProcessAsync(string exe, string args)
        {
            var psi = new ProcessStartInfo(exe, args)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = _config.VRayBenchmarkDir
            };

            using var process = Process.Start(psi);
            var output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();
            return output;
        }

        private double ParseScoreFromOutput(string output, string type)
        {
            var pattern = type == "vsamples"
                ? @"V-Ray\s+score:\s*([\d,]+)|([\d,]+)\s+vsamples"
                : @"V-Ray\s+GPU\s+score:\s*([\d,]+)|([\d,]+)\s+vpaths";

            var match = Regex.Match(output, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var str = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
                str = str.Replace(",", "");
                if (double.TryParse(str, out double score))
                    return score;
            }

            return 0;
        }
    }
}
