using System;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Benchmark.Models;

namespace BlendFarm.Node.Benchmark
{
    public class BlenderBenchmarkRunner
    {
        private readonly ILogger _logger;
        private readonly BenchmarkConfiguration _config;
        private readonly string _benchmarkExe;

        public BlenderBenchmarkRunner(ILogger logger, BenchmarkConfiguration config, string benchmarkExe)
        {
            _logger = logger;
            _config = config;
            _benchmarkExe = benchmarkExe;
        }

        public async Task<BenchmarkResult> RunFullBenchmarkAsync()
        {
            _logger.LogInformation("🎬 Starting complete Blender benchmark suite...");
            _logger.LogInformation("⏱️  This will take 5-10 minutes depending on your hardware");

            var result = new BenchmarkResult
            {
                RunDate = DateTime.UtcNow,
                Scenes = new List<SceneResult>()
            };

            try
            {
                // Get Blender version first
                result.BlenderVersion = await GetBlenderVersionAsync();

                // Run CPU benchmark
                _logger.LogInformation("🖥️ Running CPU benchmark...");
                var cpuResults = await RunBenchmarkForDeviceAsync("CPU");
                result.Scenes.AddRange(cpuResults);
                result.CpuRenderTime = cpuResults.Average(r => r.RenderTime);
                result.CpuScore = (int)cpuResults.Average(r => r.Score);

                // Run GPU benchmark (CUDA)
                if (await CheckDeviceSupportAsync("CUDA"))
                {
                    _logger.LogInformation("🎮 Running CUDA GPU benchmark...");
                    var gpuResults = await RunBenchmarkForDeviceAsync("CUDA");
                    result.Scenes.AddRange(gpuResults);
                    result.GpuRenderTime = gpuResults.Average(r => r.RenderTime);
                    result.GpuScore = (int)gpuResults.Average(r => r.Score);
                }

                // Run OptiX if supported (RTX cards)
                if (await CheckDeviceSupportAsync("OPTIX"))
                {
                    _logger.LogInformation("✨ Running OptiX GPU benchmark...");
                    var optixResults = await RunBenchmarkForDeviceAsync("OPTIX");
                    result.Scenes.AddRange(optixResults);
                    // Use OptiX scores if better than CUDA
                    var optixAvg = optixResults.Average(r => r.Score);
                    if (optixAvg > result.GpuScore)
                    {
                        result.GpuScore = (int)optixAvg;
                        result.GpuRenderTime = optixResults.Average(r => r.RenderTime);
                    }
                }

                // Calculate effective score (weighted)
                result.EffectiveScore = (result.GpuScore * 0.7) + (result.CpuScore * 0.3);
                result.IsComplete = true;

                _logger.LogInformation("✅ Benchmark complete!");
                _logger.LogInformation($"   GPU Score: {result.GpuScore:F0}");
                _logger.LogInformation($"   CPU Score: {result.CpuScore:F0}");
                _logger.LogInformation($"   Effective Score: {result.EffectiveScore:F0}");

                // Save raw results
                await SaveRawResultsAsync(result);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Benchmark failed: {ex.Message}");
                result.Error = ex.Message;
                result.IsComplete = false;
                return result;
            }
        }

        private async Task<List<SceneResult>> RunBenchmarkForDeviceAsync(string device)
        {
            var results = new List<SceneResult>();
            var outputFile = Path.Combine(_config.ResultsDir, $"{device}_{DateTime.Now:yyyyMMdd_HHmmss}.json");

            foreach (var scene in _config.Scenes)
            {
                _logger.LogInformation($"   Testing {scene} with {device}...");

                var psi = new ProcessStartInfo
                {
                    FileName = _benchmarkExe,
                    Arguments = $"run --scene {scene} --device-type {device} --output \"{outputFile}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WorkingDirectory = _config.BenchmarkDir
                };

                using var process = Process.Start(psi);
                
                var output = new StringBuilder();
                process.OutputDataReceived += (s, e) => { if (e.Data != null) output.AppendLine(e.Data); };
                process.ErrorDataReceived += (s, e) => { if (e.Data != null) output.AppendLine(e.Data); };
                
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                // Wait with timeout
                var completed = await Task.Run(() => process.WaitForExit(_config.TimeoutMinutes * 60 * 1000));
                
                if (!completed)
                {
                    process.Kill();
                    throw new Exception($"Benchmark timed out after {_config.TimeoutMinutes} minutes");
                }

                // Parse result
                var sceneResult = await ParseSceneResultAsync(outputFile, scene, device);
                if (sceneResult != null)
                {
                    results.Add(sceneResult);
                    _logger.LogInformation($"      Score: {sceneResult.Score:F0} (Time: {sceneResult.RenderTime:F1}s)");
                }

                // Clean up
                if (File.Exists(outputFile))
                    File.Delete(outputFile);
            }

            return results;
        }

        private async Task<SceneResult> ParseSceneResultAsync(string outputFile, string scene, string device)
        {
            if (!File.Exists(outputFile))
            {
                _logger.LogWarning($"No output file found for {scene} {device}");
                return null;
            }

            var json = await File.ReadAllTextAsync(outputFile);
            
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // Navigate to the result for this scene
                if (root.TryGetProperty("results", out var results))
                {
                    foreach (var item in results.EnumerateArray())
                    {
                        string resultScene = item.GetProperty("name").GetString();
                        string resultDevice = item.GetProperty("device_name").GetString();
                        
                        if (resultScene == scene && resultDevice.Contains(device))
                        {
                            return new SceneResult
                            {
                                SceneName = scene,
                                Device = device,
                                Score = item.GetProperty("score").GetDouble(),
                                RenderTime = item.GetProperty("time").GetDouble(),
                                Samples = item.GetProperty("samples").GetInt32()
                            };
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to parse benchmark output: {ex.Message}");
            }

            return null;
        }

        private async Task<bool> CheckDeviceSupportAsync(string device)
        {
            var psi = new ProcessStartInfo
            {
                FileName = _benchmarkExe,
                Arguments = "list-devices",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            var output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();

            return output.Contains(device);
        }

        private async Task<string> GetBlenderVersionAsync()
        {
            var blenderPath = Path.Combine(_config.BenchmarkDir, "blender", "blender.exe");
            
            if (!File.Exists(blenderPath))
                return "unknown";

            var psi = new ProcessStartInfo
            {
                FileName = blenderPath,
                Arguments = "--version",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            var output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();

            var match = Regex.Match(output, @"Blender\s+([\d\.]+)");
            return match.Success ? match.Groups[1].Value : "unknown";
        }

        private async Task SaveRawResultsAsync(BenchmarkResult result)
        {
            var resultPath = Path.Combine(_config.ResultsDir, $"full_benchmark_{DateTime.Now:yyyyMMdd_HHmmss}.json");
            var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(resultPath, json);
            _logger.LogInformation($"📊 Raw results saved to: {resultPath}");
        }
    }
}