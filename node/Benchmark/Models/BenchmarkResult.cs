using System;

namespace BlendFarm.Node.Benchmark.Models
{
    public class BenchmarkResult
    {
        public DateTime RunDate { get; set; }
        public string BlenderVersion { get; set; }
        
        // Individual scene results
        public List<SceneResult> Scenes { get; set; } = new();
        
        // Aggregate scores
        public double GpuScore { get; set; }
        public double CpuScore { get; set; }
        public double EffectiveScore { get; set; }
        
        // Render times
        public double GpuRenderTime { get; set; }
        public double CpuRenderTime { get; set; }
        
        // Status
        public bool IsComplete { get; set; }
        public string Error { get; set; }
        
        // Cache validity
        public bool IsValid() => (DateTime.UtcNow - RunDate).TotalDays < 7;
    }

    public class SceneResult
    {
        public string SceneName { get; set; } // monster, classroom, bmw
        public string Device { get; set; } // CPU, CUDA, OPTIX
        public double Score { get; set; }
        public double RenderTime { get; set; }
        public int Samples { get; set; }
    }

    public class BenchmarkConfiguration
    {
        public string DownloadUrl { get; set; } = "https://download.blender.org/release/BlenderBenchmark2.0/benchmark-launcher-2.0.5-windows.zip";
        public string BenchmarkDir { get; set; }
        public string ResultsDir { get; set; }
        public List<string> Scenes { get; set; } = new() { "monster", "classroom", "bmw" };
        public List<string> Devices { get; set; } = new() { "CPU", "CUDA", "OPTIX" };
        public int TimeoutMinutes { get; set; } = 10;
    }
}