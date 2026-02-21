using System;
using System.IO;
using Newtonsoft.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Benchmark.Models;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Benchmark
{
    public class BenchmarkCache
    {
        private readonly ILogger _logger;
        private readonly string _cachePath;

        public BenchmarkCache(ILogger logger)
        {
            _logger = logger;
            _cachePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "BlendFarm",
                "benchmark_cache.json");
            
            Directory.CreateDirectory(Path.GetDirectoryName(_cachePath));
            _logger.LogInformation($"Benchmark cache path: {_cachePath}");
        }

        public async Task<BenchmarkResult> GetCachedBenchmarkAsync()
        {
            if (!File.Exists(_cachePath))
            {
                _logger.LogDebug($"No cached benchmark found at {_cachePath}");
                return null;
            }

            try
            {
                var json = await File.ReadAllTextAsync(_cachePath);
                var result = JsonConvert.DeserializeObject<BenchmarkResult>(json);

                if (result != null && result.IsValid())
                {
                    _logger.LogInformation($"📦 Using cached benchmark from {result.RunDate:yyyy-MM-dd} (path: {_cachePath})");
                    return result;
                }

                _logger.LogInformation($"📦 Cached benchmark expired at {_cachePath}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to read cached benchmark: {ex.Message}");
                return null;
            }
        }

        public async Task SaveBenchmarkAsync(BenchmarkResult result)
        {
            try
            {
                var json = JsonConvert.SerializeObject(result, Formatting.Indented);
                await File.WriteAllTextAsync(_cachePath, json);
                _logger.LogDebug($"✅ Benchmark cached successfully at {_cachePath}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to cache benchmark: {ex.Message}");
            }
        }

        public bool ShouldRerunBenchmark(HardwareInfo currentHardware)
        {
            if (!File.Exists(_cachePath))
                return true;

            try
            {
                var json = File.ReadAllText(_cachePath);
                var cached = JsonConvert.DeserializeObject<BenchmarkResult>(json);

                if (cached == null) return true;
                if (!cached.IsValid()) return true;

                // Check if hardware changed significantly
                // This would require storing hardware fingerprint in cache
                return false;
            }
            catch
            {
                return true;
            }
        }
    }
}