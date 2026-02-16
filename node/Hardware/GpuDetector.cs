using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;
using Microsoft.Win32;

namespace BlendFarm.Node.Hardware
{
    public class GpuDetector
    {
        private readonly ILogger _logger;

        public GpuDetector(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<List<GpuInfo>> DetectAsync()
        {
            var gpus = new List<GpuInfo>();

            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                gpus = await DetectWindowsGpusAsync();
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                gpus = await DetectLinuxGpusAsync();
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                gpus = await DetectMacGpusAsync();
            }

            if (gpus.Count == 0)
            {
                gpus.Add(new GpuInfo
                {
                    Index = 0,
                    Model = "Unknown GPU",
                    Vendor = "Unknown",
                    VramMB = 0,
                    DriverVersion = "Unknown",
                    CudaSupported = false,
                    OptixSupported = false,
                    HipSupported = false,
                    OpenCLSupported = false
                });
            }

            return gpus;
        }

        private async Task<List<GpuInfo>> DetectWindowsGpusAsync()
        {
            var gpus = new List<GpuInfo>();
            int index = 0;

            // METHOD 1: nvidia-smi (BEST for NVIDIA)
            try
            {
                var nvidiaGpus = await GetNvidiaSmiInfoAsync();
                foreach (var gpu in nvidiaGpus)
                {
                    gpu.Index = index++;
                    gpus.Add(gpu);
                    _logger.LogInformation($"✅ Detected NVIDIA GPU via nvidia-smi: {gpu.Model} with {gpu.VramMB}MB VRAM");
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"nvidia-smi failed: {ex.Message}");
            }

            // METHOD 2: Windows Registry (works for all GPUs)
            if (gpus.Count == 0)
            {
                try
                {
                    var registryGpus = await GetGpusFromRegistryAsync();
                    foreach (var gpu in registryGpus)
                    {
                        if (!gpus.Exists(g => g.Model.Contains(gpu.Model) || gpu.Model.Contains(g.Model)))
                        {
                            gpu.Index = index++;
                            gpus.Add(gpu);
                            _logger.LogInformation($"✅ Detected GPU via Registry: {gpu.Model}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"Registry GPU detection failed: {ex.Message}");
                }
            }

            // METHOD 3: WMI (if available)
            if (gpus.Count == 0)
            {
                try
                {
                    using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_VideoController");
                    
                    foreach (var item in searcher.Get())
                    {
                        var name = item["Name"]?.ToString() ?? "";
                        if (gpus.Exists(g => g.Model.Contains(name) || name.Contains(g.Model)))
                            continue;

                        var gpu = new GpuInfo
                        {
                            Index = index++,
                            Model = name,
                            Vendor = GetVendorFromName(name),
                            DriverVersion = item["DriverVersion"]?.ToString() ?? "Unknown",
                            VramMB = ParseVRAM(item["AdapterRAM"]?.ToString()),
                            CudaSupported = name.Contains("NVIDIA"),
                            OptixSupported = name.Contains("RTX"),
                            HipSupported = name.Contains("AMD") || name.Contains("Radeon"),
                            OpenCLSupported = true
                        };

                        if (item["DriverDate"] != null)
                        {
                            if (DateTime.TryParse(item["DriverDate"].ToString(), out var driverDate))
                            {
                                gpu.DriverDate = driverDate;
                            }
                        }

                        gpus.Add(gpu);
                        _logger.LogInformation($"✅ Detected GPU via WMI: {gpu.Model}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"WMI GPU detection failed: {ex.Message}");
                }
            }

            return gpus;
        }

        private async Task<List<GpuInfo>> GetGpusFromRegistryAsync()
        {
            var gpus = new List<GpuInfo>();
            
            try
            {
                // Registry path for video controllers
                string[] registryPaths = new[]
                {
                    @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000",
                    @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0001",
                    @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0002"
                };

                foreach (var path in registryPaths)
                {
                    try
                    {
                        using var key = Registry.LocalMachine.OpenSubKey(path);
                        if (key != null)
                        {
                            var model = key.GetValue("DriverDesc")?.ToString();
                            var vram = key.GetValue("HardwareInformation.qwMemorySize");
                            var driverVersion = key.GetValue("DriverVersion")?.ToString();
                            
                            if (!string.IsNullOrEmpty(model) && !model.Contains("Microsoft") && !model.Contains("Basic Display"))
                            {
                                ulong vramMB = 0;
                                if (vram != null && ulong.TryParse(vram.ToString(), out ulong bytes))
                                {
                                    vramMB = bytes / (1024 * 1024);
                                }
                                
                                // Try to get VRAM from another location if still 0
                                if (vramMB == 0)
                                {
                                    var vramReg = key.GetValue("HardwareInformation.MemorySize");
                                    if (vramReg != null && ulong.TryParse(vramReg.ToString(), out ulong vramBytes))
                                    {
                                        vramMB = vramBytes / (1024 * 1024);
                                    }
                                }

                                var gpu = new GpuInfo
                                {
                                    Model = model,
                                    Vendor = GetVendorFromName(model),
                                    VramMB = vramMB,
                                    DriverVersion = driverVersion ?? "Unknown",
                                    OpenCLSupported = true,
                                    CudaSupported = model.Contains("NVIDIA"),
                                    OptixSupported = model.Contains("RTX"),
                                    HipSupported = model.Contains("AMD") || model.Contains("Radeon")
                                };

                                // Try to get driver date from file
                                if (!string.IsNullOrEmpty(driverVersion))
                                {
                                    // Driver version often contains date info
                                }

                                gpus.Add(gpu);
                            }
                        }
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"Registry enumeration failed: {ex.Message}");
            }

            return gpus;
        }

        private async Task<List<GpuInfo>> GetNvidiaSmiInfoAsync()
        {
            var gpus = new List<GpuInfo>();

            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "nvidia-smi",
                        Arguments = "--query-gpu=index,name,memory.total,memory.free,driver_version,temperature.gpu,utilization.gpu,compute_cap --format=csv,noheader,nounits",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
                {
                    var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        var parts = line.Split(',');
                        if (parts.Length >= 5)
                        {
                            var gpu = new GpuInfo
                            {
                                Index = int.Parse(parts[0].Trim()),
                                Model = parts[1].Trim(),
                                Vendor = "NVIDIA",
                                VramMB = ParseMemoryString(parts[2].Trim()),
                                VramFreeMB = ParseMemoryString(parts[3].Trim()),
                                DriverVersion = parts[4].Trim(),
                                CudaSupported = true,
                                OptixSupported = parts[1].Contains("RTX"),
                                OpenCLSupported = true
                            };

                            if (parts.Length > 5 && int.TryParse(parts[5].Trim(), out int temp))
                                gpu.Temperature = temp;
                            
                            if (parts.Length > 6 && int.TryParse(parts[6].Trim(), out int util))
                                gpu.Utilization = util;
                            
                            if (parts.Length > 7 && double.TryParse(parts[7].Trim(), out double cc))
                                gpu.ComputeCapability = (int)(cc * 10);

                            gpus.Add(gpu);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"nvidia-smi failed: {ex.Message}");
            }

            return gpus;
        }

        private async Task<List<GpuInfo>> DetectLinuxGpusAsync()
        {
            var gpus = new List<GpuInfo>();
            int index = 0;

            try
            {
                var nvidiaGpus = await GetNvidiaSmiInfoAsync();
                foreach (var gpu in nvidiaGpus)
                {
                    gpu.Index = index++;
                    gpus.Add(gpu);
                }
            }
            catch { }

            if (gpus.Count == 0)
            {
                try
                {
                    var output = await RunBashCommandAsync("lspci | grep -E 'VGA|3D|Display'");
                    var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                    
                    foreach (var line in lines)
                    {
                        if (gpus.Exists(g => line.Contains(g.Model) || g.Model.Contains(line)))
                            continue;

                        var gpu = new GpuInfo
                        {
                            Index = index++,
                            Model = line.Contains("VGA") ? line.Split(':')[2].Trim() : line,
                            Vendor = line.Contains("NVIDIA") ? "NVIDIA" : 
                                    line.Contains("AMD") || line.Contains("Radeon") ? "AMD" :
                                    line.Contains("Intel") ? "Intel" : "Unknown",
                            VramMB = await GetLinuxGpuVramAsync(line),
                            DriverVersion = await GetLinuxDriverVersionAsync(line),
                            CudaSupported = line.Contains("NVIDIA"),
                            OptixSupported = line.Contains("RTX"),
                            HipSupported = line.Contains("AMD") || line.Contains("Radeon"),
                            OpenCLSupported = true
                        };

                        gpus.Add(gpu);
                    }
                }
                catch { }
            }

            return gpus;
        }

        private async Task<List<GpuInfo>> DetectMacGpusAsync()
        {
            var gpus = new List<GpuInfo>();

            try
            {
                var output = await RunBashCommandAsync("system_profiler SPDisplaysDataType | grep -E 'Chipset Model|VRAM'");
                var lines = output.Split('\n');
                
                GpuInfo currentGpu = null;
                
                foreach (var line in lines)
                {
                    if (line.Contains("Chipset Model"))
                    {
                        if (currentGpu != null)
                            gpus.Add(currentGpu);
                            
                        currentGpu = new GpuInfo
                        {
                            Index = gpus.Count,
                            Model = line.Split(':')[1].Trim(),
                            Vendor = line.Contains("Apple") ? "Apple" :
                                    line.Contains("AMD") ? "AMD" :
                                    line.Contains("Intel") ? "Intel" : "Unknown",
                            DriverVersion = "macOS",
                            OpenCLSupported = true
                        };
                    }
                    else if (line.Contains("VRAM") && currentGpu != null)
                    {
                        currentGpu.VramMB = ParseMemoryString(line.Split(':')[1].Trim());
                    }
                }
                
                if (currentGpu != null)
                    gpus.Add(currentGpu);
            }
            catch { }

            return gpus;
        }

        private string GetVendorFromName(string name)
        {
            if (name.Contains("NVIDIA")) return "NVIDIA";
            if (name.Contains("AMD") || name.Contains("Radeon")) return "AMD";
            if (name.Contains("Intel")) return "Intel";
            if (name.Contains("Microsoft") && name.Contains("Hyper-V")) return "Virtual";
            return "Unknown";
        }

        private ulong ParseVRAM(string vramStr)
        {
            if (string.IsNullOrEmpty(vramStr)) return 0;
            
            if (ulong.TryParse(vramStr, out ulong bytes))
            {
                return bytes / (1024 * 1024);
            }
            
            return 0;
        }

        private ulong ParseMemoryString(string memStr)
        {
            var match = Regex.Match(memStr, @"(\d+)\s*([GM]i?B?)", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                if (ulong.TryParse(match.Groups[1].Value, out ulong value))
                {
                    var unit = match.Groups[2].Value.ToUpper();
                    if (unit.StartsWith("G")) return value * 1024;
                    return value;
                }
            }
            
            if (ulong.TryParse(memStr, out ulong numeric))
                return numeric;
            
            return 0;
        }

        private async Task<int> GetGpuUtilizationAsync(int gpuIndex)
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "nvidia-smi",
                        Arguments = $"--query-gpu=utilization.gpu --format=csv,noheader -i {gpuIndex}",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0 && int.TryParse(output.Trim().Replace("%", ""), out int util))
                {
                    return util;
                }
            }
            catch { }

            return 0;
        }

        private async Task<string> GetLinuxDriverVersionAsync(string gpuInfo)
        {
            try
            {
                if (gpuInfo.Contains("NVIDIA"))
                {
                    var output = await RunBashCommandAsync("nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1");
                    return output.Trim();
                }
                else if (gpuInfo.Contains("AMD"))
                {
                    var output = await RunBashCommandAsync("modinfo amdgpu | grep ^version | awk '{print $2}'");
                    return output.Trim();
                }
                else if (gpuInfo.Contains("Intel"))
                {
                    var output = await RunBashCommandAsync("modinfo i915 | grep ^version | awk '{print $2}'");
                    return output.Trim();
                }
            }
            catch { }

            return "Unknown";
        }

        private async Task<ulong> GetLinuxGpuVramAsync(string gpuModel)
        {
            try
            {
                if (gpuModel.Contains("NVIDIA"))
                {
                    var output = await RunBashCommandAsync("nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -1");
                    return ParseMemoryString(output);
                }
                else if (gpuModel.Contains("AMD"))
                {
                    var output = await RunBashCommandAsync("cat /sys/class/drm/card0/device/mem_info_vram_total");
                    if (ulong.TryParse(output.Trim(), out ulong bytes))
                    {
                        return bytes / (1024 * 1024);
                    }
                }
            }
            catch { }

            return 0;
        }

        private async Task<string> RunBashCommandAsync(string command)
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "/bin/bash",
                    Arguments = $"-c \"{command}\"",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            process.Start();
            string result = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();
            
            return result.Trim();
        }
    }
}