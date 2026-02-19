using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
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
                Scenes = new List<SceneResult>(),
                BenchmarkType = "Blender"
            };

            try
            {
                // Get Blender version first
                result.BlenderVersion = await GetBlenderVersionAsync();

                // Run CPU benchmark
                _logger.LogInformation("🖥️ Running CPU benchmark...");
                var cpuResults = await RunBenchmarkForDeviceAsync("CPU");
                if (cpuResults.Any())
                {
                    result.Scenes.AddRange(cpuResults);
                    result.CpuScore = (int)cpuResults.Average(r => r.Score);
                    // REMOVED: result.CpuRenderTime = cpuResults.Average(r => r.RenderTime);
                }
                else
                {
                    _logger.LogWarning("⚠️ No CPU results obtained.");
                }

                // Run GPU benchmark (Try OptiX first, then CUDA)
                string gpuDevice = "CUDA";
                if (await CheckDeviceSupportAsync("OPTIX"))
                {
                    gpuDevice = "OPTIX";
                    _logger.LogInformation("✨ OptiX support detected, preferring OptiX for GPU benchmark.");
                }
                else if (await CheckDeviceSupportAsync("CUDA"))
                {
                    _logger.LogInformation("🎮 CUDA support detected.");
                }
                else if (await CheckDeviceSupportAsync("HIP"))
                {
                    gpuDevice = "HIP";
                    _logger.LogInformation("🚀 AMD HIP support detected.");
                }
                else if (await CheckDeviceSupportAsync("ONEAPI"))
                {
                    gpuDevice = "ONEAPI";
                    _logger.LogInformation("🔷 Intel OneAPI support detected.");
                }

                _logger.LogInformation($"🎮 Running {gpuDevice} GPU benchmark...");
                var gpuResults = await RunBenchmarkForDeviceAsync(gpuDevice);
                if (gpuResults.Any())
                {
                    result.Scenes.AddRange(gpuResults);
                    var gpuAvg = gpuResults.Average(r => r.Score);
                    result.GpuScore = (int)gpuAvg;
                    // REMOVED: result.GpuRenderTime = gpuResults.Average(r => r.RenderTime);
                }
                else
                {
                    _logger.LogWarning($"⚠️ No GPU results obtained for {gpuDevice}.");
                }

                // Calculate effective score (weighted)
                result.EffectiveScore = (result.GpuScore * 0.7) + (result.CpuScore * 0.3);
                result.IsComplete = result.GpuScore > 0 || result.CpuScore > 0;

                if (result.IsComplete)
                {
                    _logger.LogInformation("✅ Benchmark complete!");
                }
                else
                {
                    _logger.LogWarning("⚠️ Benchmark finished but no scores were obtained.");
                }
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
            var blenderVersion = await GetBlenderVersionAsync();
            
            // Try with detected version, and potentially fallback if it fails
            return await RunBenchmarkWithFallbackAsync(device, blenderVersion);
        }

        private async Task<List<SceneResult>> RunBenchmarkWithFallbackAsync(string device, string blenderVersion)
        {
            var scenesArg = string.Join(" ", _config.Scenes);
            var arguments = $"benchmark --blender-version {blenderVersion} --device-type {device} --json {scenesArg}";

            _logger.LogInformation($"   Testing scenes with {device} using Blender {blenderVersion}...");
            
            var psi = new ProcessStartInfo
            {
                FileName = _benchmarkExe,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = _config.BenchmarkDir
            };

            using var process = Process.Start(psi);
            
            var outputBuilder = new StringBuilder();
            var errorBuilder = new StringBuilder();

            process.OutputDataReceived += (s, e) => { if (e.Data != null) outputBuilder.AppendLine(e.Data); };
            process.ErrorDataReceived += (s, e) => { if (e.Data != null) errorBuilder.AppendLine(e.Data); };
            
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            // Wait with timeout
            var completed = await Task.Run(() => process.WaitForExit(_config.TimeoutMinutes * 60 * 1000));
            
            if (!completed)
            {
                process.Kill();
                throw new Exception($"Benchmark timed out after {_config.TimeoutMinutes} minutes");
            }

            var output = outputBuilder.ToString();
            var error = errorBuilder.ToString();

            if (process.ExitCode != 0)
            {
                _logger.LogError($"Benchmark process exited with code {process.ExitCode}");
                
                if (error.Contains("panic") || error.Contains("invalid memory address"))
                {
                    _logger.LogCritical("🔥 Benchmark CLI crashed/panicked. This might be a systemic issue or hardware detection failure.");
                }
                
                if (error.Contains("seems to be broken") || error.Contains("ERROR: Blender version"))
                {
                    _logger.LogWarning($"⚠️ Blender {blenderVersion} reported as broken.");
                    
                    // Fallback logic: Try 4.0.0 or 3.6.0 if 4.1.0 failed
                    if (blenderVersion.StartsWith("4.1") || blenderVersion.StartsWith("4.5"))
                    {
                        _logger.LogInformation("🔄 Retrying with fallback version (4.0.0)...");
                        return await RunBenchmarkWithFallbackAsync(device, "4.0.0");
                    }
                    else if (blenderVersion.StartsWith("4.0"))
                    {
                        _logger.LogInformation("🔄 Retrying with fallback version (3.6.0)...");
                        return await RunBenchmarkWithFallbackAsync(device, "3.6.0");
                    }
                }
                
                _logger.LogError($"Error output: {error}");
            }

            // Parse result from STDOUT
            var sceneResults = ParseSceneResultsFromOutput(output, device);
            var results = new List<SceneResult>();
            if (sceneResults.Any())
            {
                results.AddRange(sceneResults);
                foreach (var res in sceneResults)
                {
                    _logger.LogInformation($"      {res.SceneName}: {res.Score:F0} (Time: {res.RenderTime:F1}s)");
                }
            }
            else
            {
                _logger.LogWarning($"No results parsed for {device}. Output: {output}");
            }

            return results;
        }

        private List<SceneResult> ParseSceneResultsFromOutput(string output, string device)
        {
            var results = new List<SceneResult>();
            
            // Output might contain noise, find the JSON array part
            var jsonStart = output.IndexOf('[');
            var jsonEnd = output.LastIndexOf(']');
            
            if (jsonStart == -1 || jsonEnd == -1 || jsonEnd < jsonStart)
            {
                return results;
            }

            var json = output.Substring(jsonStart, jsonEnd - jsonStart + 1);
            
            try
            {
                // The output is a JSON array of results
                var array = JArray.Parse(json);
                foreach (var item in array)
                {
                    string resultScene = item["scene"]?.ToString();
                    var score = item["score"]?.Value<double>() ?? 0;
                    
                    double time = 0;
                    if (item["time"] != null) time = item["time"].Value<double>();
                    else if (item["render_time"] != null) time = item["render_time"].Value<double>();

                    results.Add(new SceneResult
                    {
                        SceneName = resultScene,
                        Device = device,
                        Score = score,
                        RenderTime = time,
                        Samples = 0
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to parse benchmark output: {ex.Message}");
            }

            return results;
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

            try 
            {
                using var process = Process.Start(psi);
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                return output.Contains(device, StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private async Task<string> GetBlenderVersionAsync()
        {
            var psi = new ProcessStartInfo
            {
                FileName = _benchmarkExe,
                Arguments = "blender list",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = _config.BenchmarkDir
            };

            try
            {
                using var process = Process.Start(psi);
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                var matches = Regex.Matches(output, @"(\d+\.\d+\.\d+)");
                if (matches.Count > 0)
                {
                    var versions = matches.Cast<Match>()
                        .Select(m => m.Value)
                        .OrderByDescending(v => Version.TryParse(v, out var ver) ? ver : new Version(0, 0))
                        .ToList();
                    
                    // Filter out known broken versions
                    var filteredVersions = versions.Where(v => !v.StartsWith("4.5")).ToList();
                    
                    var preferredVersion = filteredVersions.FirstOrDefault(v => v.StartsWith("4.1"));
                    if (!string.IsNullOrEmpty(preferredVersion)) return preferredVersion;

                    var bestVersion = versions.FirstOrDefault();
                    _logger.LogInformation($"Detected latest available Blender version: {bestVersion}");
                    return bestVersion;
                }
                
                _logger.LogWarning($"Could not parse versions from output: {output}");
                return "4.0.0"; 
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to detect blender version: {ex.Message}");
                return "unknown";
            }
        }

        private async Task SaveRawResultsAsync(BenchmarkResult result)
        {
            var resultPath = Path.Combine(_config.ResultsDir, $"full_benchmark_{DateTime.Now:yyyyMMdd_HHmmss}.json");
            var json = JsonConvert.SerializeObject(result, Formatting.Indented);
            await File.WriteAllTextAsync(resultPath, json);
            _logger.LogInformation($"📊 Raw results saved to: {resultPath}");
        }
    }
}