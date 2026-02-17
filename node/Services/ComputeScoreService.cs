using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Benchmark;
using BlendFarm.Node.Benchmark.Models;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Services
{
    public class ComputeScoreService
    {
        private readonly ILogger _logger;
        private readonly BenchmarkDownloader _downloader;
        private readonly BenchmarkCache _cache;
        private readonly BenchmarkConfiguration _config;

        public ComputeScoreService(ILogger logger)
        {
            _logger = logger;
            _config = new BenchmarkConfiguration();
            _downloader = new BenchmarkDownloader(logger, _config);
            _cache = new BenchmarkCache(logger);
        }

        public async Task<BenchmarkResult> GetOrRunBenchmarkAsync(bool force = false)
        {
            // Check cache first
            if (!force)
            {
                var cached = await _cache.GetCachedBenchmarkAsync();
                if (cached != null)
                {
                    return cached;
                }
            }

            _logger.LogInformation("🏁 No valid cached benchmark found. Running new benchmark...");

            try
            {
                // Download benchmark CLI if needed
                var benchmarkExe = await _downloader.EnsureBenchmarkAsync();

                // Run benchmark
                var runner = new BlenderBenchmarkRunner(_logger, _config, benchmarkExe);
                var result = await runner.RunFullBenchmarkAsync();

                if (result.IsComplete)
                {
                    // Cache results
                    await _cache.SaveBenchmarkAsync(result);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Benchmark failed: {ex.Message}");
                
                // Return a minimal result with error
                return new BenchmarkResult
                {
                    RunDate = DateTime.UtcNow,
                    IsComplete = false,
                    Error = ex.Message,
                    GpuScore = 0,
                    CpuScore = 0,
                    EffectiveScore = 0
                };
            }
        }

        public ComputeScore CalculateComputeScore(BenchmarkResult benchmark, HardwareInfo hardware)
        {
            return new ComputeScore
            {
                EffectiveScore = benchmark.EffectiveScore,
                GpuScore = benchmark.GpuScore,
                CpuScore = benchmark.CpuScore,
                Tier = DetermineTier(benchmark.EffectiveScore),
                BenchmarkDate = benchmark.RunDate,
                BlenderVersion = benchmark.BlenderVersion,
                Hardware = hardware
            };
        }

        private string DetermineTier(double score)
        {
            if (score >= 400) return "Ultra";
            if (score >= 300) return "High";
            if (score >= 200) return "Medium";
            if (score >= 100) return "Low";
            return "Minimal";
        }
    }

    public class ComputeScore
    {
        public double EffectiveScore { get; set; }
        public double GpuScore { get; set; }
        public double CpuScore { get; set; }
        public string Tier { get; set; }
        public DateTime BenchmarkDate { get; set; }
        public string BlenderVersion { get; set; }
        public HardwareInfo Hardware { get; set; }
    }
}