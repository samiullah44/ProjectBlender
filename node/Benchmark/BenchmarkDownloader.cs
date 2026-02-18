using System;
using System.IO;
using System.Net.Http;
using System.IO.Compression;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Benchmark.Models;

namespace BlendFarm.Node.Benchmark
{
    public class BenchmarkDownloader
    {
        private readonly ILogger _logger;
        private readonly BenchmarkConfiguration _config;
        private readonly HttpClient _httpClient;

        public BenchmarkDownloader(ILogger logger, BenchmarkConfiguration config)
        {
            _logger = logger;
            _config = config;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromMinutes(15);
        }

        public async Task<string> EnsureBenchmarkAsync()
        {
            _logger.LogInformation("📥 Setting up Blender Benchmark CLI...");

            // Set up directories
            _config.BenchmarkDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "benchmark");
            _config.ResultsDir = Path.Combine(_config.BenchmarkDir, "results");
            
            Directory.CreateDirectory(_config.BenchmarkDir);
            Directory.CreateDirectory(_config.ResultsDir);

            // Check if already downloaded - search for the executable
            var existingExe = FindBenchmarkCli(_config.BenchmarkDir);
            if (!string.IsNullOrEmpty(existingExe))
            {
                _logger.LogInformation($"✅ Benchmark CLI already exists at: {existingExe}");
                return existingExe;
            }

            _logger.LogInformation("⬇️ Downloading Blender Benchmark CLI...");
            
            var zipPath = Path.Combine(_config.BenchmarkDir, "benchmark.zip");
            
            try
            {
                // Download with progress
                using var response = await _httpClient.GetAsync(_config.DownloadUrl, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();
                
                var totalBytes = response.Content.Headers.ContentLength ?? -1;
                using var contentStream = await response.Content.ReadAsStreamAsync();
                using var fileStream = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);
                
                var buffer = new byte[8192];
                long totalRead = 0;
                int bytesRead;
                var lastProgress = DateTime.Now;
                
                while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await fileStream.WriteAsync(buffer, 0, bytesRead);
                    totalRead += bytesRead;
                    
                    if (totalBytes > 0 && (DateTime.Now - lastProgress).TotalSeconds > 1)
                    {
                        var progress = (double)totalRead / totalBytes * 100;
                        _logger.LogDebug($"Download progress: {progress:F1}%");
                        lastProgress = DateTime.Now;
                    }
                }

                _logger.LogInformation("✅ Download complete. Extracting...");

                // Extract
                ZipFile.ExtractToDirectory(zipPath, _config.BenchmarkDir, true);
                File.Delete(zipPath);

                // Find the executable after extraction
                var benchmarkExe = FindBenchmarkCli(_config.BenchmarkDir);
                if (string.IsNullOrEmpty(benchmarkExe))
                {
                    throw new FileNotFoundException("Could not find benchmark-launcher executable after extraction.");
                }

                _logger.LogInformation($"✅ Benchmark CLI ready at: {benchmarkExe}");
                return benchmarkExe;
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Failed to download benchmark CLI: {ex.Message}");
                throw;
            }
        }

        public async Task ResetCacheAsync()
        {
            _logger.LogInformation("🧹 Clearing Blender Benchmark CLI cache and logs...");
            
            var benchmarkExe = FindBenchmarkCli(_config.BenchmarkDir);
            if (!string.IsNullOrEmpty(benchmarkExe))
            {
                var psi = new ProcessStartInfo
                {
                    FileName = benchmarkExe,
                    Arguments = "clear_cache",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WorkingDirectory = _config.BenchmarkDir
                };

                try
                {
                    using var process = Process.Start(psi);
                    await process.WaitForExitAsync();
                    _logger.LogInformation("✅ CLI internal cache cleared.");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Failed to run CLI clear_cache: {ex.Message}");
                }
            }

            // Manual cleanup of AppData (last resort or for locked files)
            var appDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "blender-benchmark-launcher"
            );

            if (Directory.Exists(appDataPath))
            {
                try
                {
                    foreach (var file in Directory.GetFiles(appDataPath))
                    {
                        try { File.Delete(file); } catch { /* Ignore locked files */ }
                    }
                    _logger.LogInformation($"✅ Manual cleanup of {appDataPath} completed.");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Manual cleanup failed: {ex.Message}");
                }
            }
        }

        private string FindBenchmarkCli(string directory)
        {
            if (!Directory.Exists(directory)) return null;

            // Try clear specific names first
            var specificNames = new[] { "benchmark-launcher-cli.exe", "benchmark-launcher.exe" };
            foreach (var name in specificNames)
            {
                var files = Directory.GetFiles(directory, name, SearchOption.AllDirectories);
                if (files.Length > 0) return files[0];
            }

            return null;
        }
    }
}