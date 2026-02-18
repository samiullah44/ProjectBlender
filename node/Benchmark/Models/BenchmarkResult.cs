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
        public string BenchmarkType { get; set; } // "Blender" or "V-Ray"
        
        // Cache validity
        public bool IsValid() => IsComplete && (GpuScore > 0 || CpuScore > 0) && (DateTime.UtcNow - RunDate).TotalDays < 7;
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
    // Blender Benchmark (fallback)
    public string DownloadUrl { get; set; } = "https://download.blender.org/release/BlenderBenchmark2.0/launcher/benchmark-launcher-cli-3.2.0-windows.zip";
    
    // V-Ray Benchmark (primary)
    public string VRayDownloadUrl { get; set; } = "https://download.chaos.com/api/v3/builds/latest/download?product=V-Ray+Benchmark&build-type=official&tags=windows-x64-cli";
    
    // Fallback URLs for V-Ray
    public List<string> VRayFallbackUrls { get; set; } = new()
    {
        "https://download.chaos.com/vray-benchmark-cli-windows.exe",
        "https://download.chaosgroup.com/vray-benchmark-cli-windows.exe",
        "https://files.chaosgroup.com/vray-benchmark-cli-windows.exe"
    };
    
    // Directories
    public string BenchmarkDir { get; set; }
    public string ResultsDir { get; set; }
    public string VRayBenchmarkDir { get; set; }
    public string VRayResultsDir { get; set; }
    
    // Test settings
    public List<string> Scenes { get; set; } = new() { "monster", "classroom", "bmw" };
    public List<string> Devices { get; set; } = new() { "CPU", "CUDA", "OPTIX" };
    public int TimeoutMinutes { get; set; } = 10;
}
}