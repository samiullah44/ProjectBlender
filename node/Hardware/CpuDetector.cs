using System;
using System.Management;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;
using System.Text.RegularExpressions;
using System.IO;
using Microsoft.Win32;
using System.Diagnostics;

namespace BlendFarm.Node.Hardware
{
    public class CpuDetector
    {
        private readonly ILogger _logger;

        public CpuDetector(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<CpuInfo> DetectAsync()
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                return await DetectWindowsCpuAsync();
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                return await DetectLinuxCpuAsync();
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                return await DetectMacCpuAsync();
            }
            
            throw new PlatformNotSupportedException("Unsupported OS");
        }

        private async Task<CpuInfo> DetectWindowsCpuAsync()
        {
            var cpu = new CpuInfo();

            try
            {
                // TRY WMI FIRST
                using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_Processor");
                
                foreach (var item in searcher.Get())
                {
                    cpu.Model = item["Name"]?.ToString()?.Trim() ?? "Unknown";
                    cpu.Manufacturer = item["Manufacturer"]?.ToString() ?? "Unknown";
                    
                    if (item["NumberOfCores"] != null)
                        cpu.PhysicalCores = Convert.ToInt32(item["NumberOfCores"]);
                    
                    if (item["NumberOfLogicalProcessors"] != null)
                        cpu.LogicalCores = Convert.ToInt32(item["NumberOfLogicalProcessors"]);
                    
                    if (item["MaxClockSpeed"] != null)
                        cpu.MaxClockGHz = Convert.ToDouble(item["MaxClockSpeed"]) / 1000;
                    
                    if (item["CurrentClockSpeed"] != null)
                        cpu.BaseClockGHz = Convert.ToDouble(item["CurrentClockSpeed"]) / 1000;
                    
                    cpu.Architecture = item["Architecture"]?.ToString() switch
                    {
                        "0" => "x86",
                        "1" => "MIPS",
                        "2" => "Alpha",
                        "3" => "PowerPC",
                        "5" => "ARM",
                        "6" => "IA64",
                        "9" => "x64",
                        _ => "Unknown"
                    };
                    
                    if (item["L2CacheSize"] != null)
                        cpu.L2CacheKB = Convert.ToInt32(item["L2CacheSize"]);
                    
                    if (item["L3CacheSize"] != null)
                        cpu.L3CacheKB = Convert.ToInt32(item["L3CacheSize"]);
                    
                    break;
                }
                
                // Detect instruction sets
                cpu.SupportsAVX = true; // Assume modern CPU
                cpu.SupportsAVX2 = true;
                cpu.SupportsSSE41 = true;
                cpu.SupportsSSE42 = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"WMI CPU detection failed, using Registry fallback: {ex.Message}");
                cpu = await GetWindowsRegistryCpuInfo();
            }

            // Ensure we have values
            if (cpu.LogicalCores == 0) cpu.LogicalCores = Environment.ProcessorCount;
            if (cpu.PhysicalCores == 0) cpu.PhysicalCores = Math.Max(1, Environment.ProcessorCount / 2);
            if (cpu.BaseClockGHz == 0) cpu.BaseClockGHz = 2.5;
            if (cpu.MaxClockGHz == 0) cpu.MaxClockGHz = cpu.BaseClockGHz * 1.2;
            if (string.IsNullOrEmpty(cpu.Architecture)) cpu.Architecture = "x64";
            
            return cpu;
        }

        private async Task<CpuInfo> GetWindowsRegistryCpuInfo()
        {
            var cpu = new CpuInfo();
            
            try
            {
                // Get CPU name from registry
                using var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                if (key != null)
                {
                    cpu.Model = key.GetValue("ProcessorNameString")?.ToString()?.Trim() ?? "Unknown CPU";
                    cpu.Manufacturer = key.GetValue("VendorIdentifier")?.ToString() ?? "Unknown";
                    
                    var mhz = key.GetValue("~MHz");
                    if (mhz != null && int.TryParse(mhz.ToString(), out int mhzValue))
                    {
                        cpu.BaseClockGHz = mhzValue / 1000.0;
                        cpu.MaxClockGHz = cpu.BaseClockGHz * 1.1;
                    }
                }

                // Get core counts from environment
                cpu.LogicalCores = Environment.ProcessorCount;
                
                // Try PowerShell for physical cores
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = "(Get-WmiObject -Class Win32_Processor).NumberOfCores",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    
                    using var process = Process.Start(psi);
                    if (process != null)
                    {
                        var output = await process.StandardOutput.ReadToEndAsync();
                        await process.WaitForExitAsync();
                        
                        if (int.TryParse(output.Trim(), out int cores) && cores > 0)
                        {
                            cpu.PhysicalCores = cores;
                        }
                        else
                        {
                            cpu.PhysicalCores = Math.Max(1, cpu.LogicalCores / 2);
                        }
                    }
                }
                catch
                {
                    cpu.PhysicalCores = Math.Max(1, cpu.LogicalCores / 2);
                }

                cpu.Architecture = "x64";
                cpu.SupportsAVX = true;
                cpu.SupportsAVX2 = true;
                cpu.SupportsSSE41 = true;
                cpu.SupportsSSE42 = true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Registry CPU detection failed: {ex.Message}");
                return GetFallbackCpuInfo();
            }
            
            return cpu;
        }

        private async Task<CpuInfo> DetectLinuxCpuAsync()
        {
            var cpu = new CpuInfo();
            
            try
            {
                var cpuInfo = await File.ReadAllTextAsync("/proc/cpuinfo");
                var lines = cpuInfo.Split('\n');
                
                int physicalId = -1;
                var physicalCores = new System.Collections.Generic.HashSet<int>();
                
                foreach (var line in lines)
                {
                    if (line.StartsWith("model name"))
                    {
                        cpu.Model = line.Split(':')[1].Trim();
                    }
                    else if (line.StartsWith("cpu cores"))
                    {
                        cpu.PhysicalCores = int.Parse(line.Split(':')[1].Trim());
                    }
                    else if (line.StartsWith("processor"))
                    {
                        cpu.LogicalCores++;
                    }
                    else if (line.StartsWith("physical id"))
                    {
                        physicalId = int.Parse(line.Split(':')[1].Trim());
                    }
                    else if (line.StartsWith("core id") && physicalId != -1)
                    {
                        physicalCores.Add(physicalId * 1000 + int.Parse(line.Split(':')[1].Trim()));
                    }
                    else if (line.StartsWith("flags"))
                    {
                        var flags = line.Split(':')[1].Trim().Split(' ');
                        cpu.SupportsAVX = Array.IndexOf(flags, "avx") >= 0;
                        cpu.SupportsAVX2 = Array.IndexOf(flags, "avx2") >= 0;
                        cpu.SupportsSSE41 = Array.IndexOf(flags, "sse4_1") >= 0;
                        cpu.SupportsSSE42 = Array.IndexOf(flags, "sse4_2") >= 0;
                    }
                }
                
                if (cpu.PhysicalCores == 0)
                {
                    cpu.PhysicalCores = physicalCores.Count;
                }
                
                cpu.Architecture = RuntimeInformation.OSArchitecture.ToString().ToLower();
                
                // Get CPU speed
                try
                {
                    var cpuinfoMax = await File.ReadAllTextAsync("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq");
                    if (int.TryParse(cpuinfoMax.Trim(), out int maxKHz))
                    {
                        cpu.MaxClockGHz = maxKHz / 1000000.0;
                        cpu.BaseClockGHz = cpu.MaxClockGHz * 0.8;
                    }
                }
                catch
                {
                    foreach (var line in lines)
                    {
                        if (line.StartsWith("cpu MHz"))
                        {
                            if (double.TryParse(line.Split(':')[1].Trim(), out double mhz))
                            {
                                cpu.BaseClockGHz = mhz / 1000;
                                cpu.MaxClockGHz = cpu.BaseClockGHz * 1.2;
                                break;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Linux CPU detection failed: {ex.Message}");
                return GetFallbackCpuInfo();
            }
            
            return cpu;
        }

        private async Task<CpuInfo> DetectMacCpuAsync()
        {
            var cpu = new CpuInfo();
            
            try
            {
                cpu.Model = await RunBashCommandAsync("sysctl -n machdep.cpu.brand_string");
                cpu.PhysicalCores = int.Parse(await RunBashCommandAsync("sysctl -n hw.physicalcpu"));
                cpu.LogicalCores = int.Parse(await RunBashCommandAsync("sysctl -n hw.logicalcpu"));
                
                var freq = await RunBashCommandAsync("sysctl -n hw.cpufrequency");
                if (double.TryParse(freq, out double hz))
                {
                    cpu.BaseClockGHz = hz / 1000000000;
                    cpu.MaxClockGHz = cpu.BaseClockGHz * 1.2;
                }
                
                cpu.Architecture = RuntimeInformation.OSArchitecture.ToString().ToLower();
                
                var features = await RunBashCommandAsync("sysctl -n machdep.cpu.features");
                cpu.SupportsAVX = features.ToLower().Contains("avx");
                cpu.SupportsAVX2 = features.ToLower().Contains("avx2");
                cpu.SupportsSSE41 = features.ToLower().Contains("sse4.1");
                cpu.SupportsSSE42 = features.ToLower().Contains("sse4.2");
            }
            catch (Exception ex)
            {
                _logger.LogError($"macOS CPU detection failed: {ex.Message}");
                return GetFallbackCpuInfo();
            }
            
            return cpu;
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

        private CpuInfo GetFallbackCpuInfo()
        {
            return new CpuInfo
            {
                Model = "Unknown CPU",
                PhysicalCores = Environment.ProcessorCount / 2,
                LogicalCores = Environment.ProcessorCount,
                BaseClockGHz = 2.5,
                MaxClockGHz = 3.0,
                Architecture = RuntimeInformation.OSArchitecture.ToString(),
                SupportsAVX = true,
                SupportsAVX2 = true,
                SupportsSSE41 = true,
                SupportsSSE42 = true
            };
        }
    }
}