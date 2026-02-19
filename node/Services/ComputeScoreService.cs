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
            if (!force)
            {
                var cached = await _cache.GetCachedBenchmarkAsync();
                if (cached != null)
                    return cached;
            }

            _logger.LogInformation("🏁 No cached benchmark found. Running new benchmark...");

            try
            {
                // Try V-Ray first (primary)
                var vray = new VRayBenchmark(_logger, _config);
                var result = await vray.RunBenchmarkAsync();

                if (result.IsComplete && (result.CpuScore > 0 || result.GpuScore > 0))
                {
                    await _cache.SaveBenchmarkAsync(result);
                    return result;
                }

                // Fallback to Blender
                _logger.LogWarning("⚠️ V-Ray benchmark failed, falling back to Blender...");
                var benchmarkExe = await _downloader.EnsureBenchmarkAsync();
                var blenderRunner = new BlenderBenchmarkRunner(_logger, _config, benchmarkExe);
                result = await blenderRunner.RunFullBenchmarkAsync();
                result.BenchmarkType = "Blender";

                if (result.IsComplete)
                    await _cache.SaveBenchmarkAsync(result);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Benchmark process failed: {ex.Message}");
                return new BenchmarkResult
                {
                    RunDate = DateTime.UtcNow,
                    IsComplete = false,
                    Error = ex.Message,
                    CpuScore = 0,
                    GpuScore = 0,
                    EffectiveScore = 0,
                    BenchmarkType = "Unknown"
                };
            }
        }

        public ComputeScore CalculateComputeScore(BenchmarkResult benchmark, HardwareInfo hardware)
        {
            return new ComputeScore
            {
                CpuScore = benchmark.CpuScore,
                GpuScore = benchmark.GpuScore,
                EffectiveScore = benchmark.EffectiveScore,
                Tier = DetermineTier(benchmark.EffectiveScore, benchmark.BenchmarkType),
                TierDescription = GetTierDescription(benchmark.EffectiveScore, benchmark.BenchmarkType),
                BenchmarkDate = benchmark.RunDate,
                BenchmarkType = benchmark.BenchmarkType,
                Iterations = benchmark.Iterations,
                CpuStdDev = benchmark.CpuStdDev,
                GpuStdDev = benchmark.GpuStdDev,
                BlenderVersion = benchmark.BlenderVersion,
                Hardware = hardware
            };
        }

        private string DetermineTier(double score, string benchmarkType)
        {
            // Different scales for different benchmark types
            if (benchmarkType == "V-Ray")
            {
                if (score >= 2000) return "Ultra";
                if (score >= 1000) return "High";     // Your 1575 is High
                if (score >= 500) return "Medium";
                if (score >= 200) return "Low";
                return "Minimal";
            }
            else // Blender benchmark
            {
                if (score >= 400) return "Ultra";
                if (score >= 300) return "High";
                if (score >= 200) return "Medium";
                if (score >= 100) return "Low";
                return "Minimal";
            }
        }

        private string GetTierDescription(double score, string benchmarkType)
        {
            if (benchmarkType == "V-Ray")
            {
                if (score >= 2000) return "Enterprise-grade rendering server";
                if (score >= 1000) return "High-performance workstation - Can handle complex scenes";
                if (score >= 500) return "Mid-range workstation - Good for most rendering tasks";
                if (score >= 200) return "Entry-level - Suitable for basic rendering";
                return "Minimal - Consider upgrading for better performance";
            }
            else
            {
                if (score >= 400) return "Exceptional Blender performance";
                if (score >= 300) return "Very good Blender performance";
                if (score >= 200) return "Good Blender performance";
                if (score >= 100) return "Adequate Blender performance";
                return "Basic Blender performance";
            }
        }
    }

    public class ComputeScore
    {
        public double EffectiveScore { get; set; }
        public double GpuScore { get; set; }
        public double CpuScore { get; set; }
        public string Tier { get; set; }
        public string TierDescription { get; set; }
        public DateTime BenchmarkDate { get; set; }
        public string BenchmarkType { get; set; }
        public int Iterations { get; set; } = 1;
        public double CpuStdDev { get; set; }
        public double GpuStdDev { get; set; }
        public string BlenderVersion { get; set; }
        public HardwareInfo Hardware { get; set; }
        
        // Helper property for display
        public string ScoreSummary => 
            $"{Tier}: CPU={CpuScore:F0}, GPU={GpuScore:F0}, Effective={EffectiveScore:F0} (±{CpuStdDev:F1}/{GpuStdDev:F1})";
    }
}