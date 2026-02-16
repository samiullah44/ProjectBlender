using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;
using System.IO;
using System.Text.RegularExpressions;
using System.Diagnostics;
using Microsoft.Win32;
using Newtonsoft.Json.Linq;

namespace BlendFarm.Node.Hardware
{
    public class RamDetector
    {
        private readonly ILogger _logger;

        public RamDetector(ILogger logger)
        {
            _logger = logger;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

        [StructLayout(LayoutKind.Sequential)]
        private struct MEMORYSTATUSEX
        {
            public uint dwLength;
            public uint dwMemoryLoad;
            public ulong ullTotalPhys;
            public ulong ullAvailPhys;
            public ulong ullTotalPageFile;
            public ulong ullAvailPageFile;
            public ulong ullTotalVirtual;
            public ulong ullAvailVirtual;
            public ulong ullAvailExtendedVirtual;
        }

        public async Task<RamInfo> DetectAsync()
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                return await DetectWindowsRamAsync();
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                return await DetectLinuxRamAsync();
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                return await DetectMacRamAsync();
            }
            
            throw new PlatformNotSupportedException("Unsupported OS");
        }

        private async Task<RamInfo> DetectWindowsRamAsync()
        {
            var ram = new RamInfo();

            try
            {
                // PRIMARY: GlobalMemoryStatusEx (ALWAYS works)
                var memStatus = new MEMORYSTATUSEX();
                memStatus.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
                
                if (GlobalMemoryStatusEx(ref memStatus))
                {
                    ram.TotalGB = memStatus.ullTotalPhys / (1024 * 1024 * 1024);
                    ram.AvailableGB = memStatus.ullAvailPhys / (1024 * 1024 * 1024);
                }

                // Try WMI for type/speed
                try
                {
                    using var searcher = new System.Management.ManagementObjectSearcher(
                        "SELECT * FROM Win32_PhysicalMemory");
                    
                    ulong totalSpeed = 0;
                    int moduleCount = 0;
                    
                    foreach (var item in searcher.Get())
                    {
                        if (item["Speed"] != null)
                        {
                            totalSpeed += Convert.ToUInt64(item["Speed"]);
                            moduleCount++;
                        }
                        
                        if (item["Speed"] != null)
                        {
                            var speed = Convert.ToInt32(item["Speed"]);
                            ram.SpeedMHz = Math.Max(ram.SpeedMHz, speed);
                            
                            ram.Type = speed switch
                            {
                                >= 6400 => "DDR5",
                                >= 3200 => "DDR4",
                                >= 1600 => "DDR3",
                                _ => "DDR"
                            };
                        }
                    }
                    
                    if (moduleCount > 0)
                    {
                        ram.SpeedMHz = (int)(totalSpeed / (ulong)moduleCount);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"WMI RAM detection failed, trying PowerShell: {ex.Message}");
                    
                    // FALLBACK: PowerShell
                    var (type, speed) = await GetRamInfoFromPowerShellAsync();
                    if (!string.IsNullOrEmpty(type))
                    {
                        ram.Type = type;
                        ram.SpeedMHz = speed;
                    }
                    
                    // Try Registry as last resort
                    if (string.IsNullOrEmpty(ram.Type))
                    {
                        var registryInfo = GetRamInfoFromRegistry();
                        ram.Type = registryInfo.type;
                        ram.SpeedMHz = registryInfo.speed;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Windows RAM detection failed: {ex.Message}");
                return GetFallbackRamInfo();
            }

            return ram;
        }

        private async Task<(string type, int speed)> GetRamInfoFromPowerShellAsync()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "Get-WmiObject -Class Win32_PhysicalMemory | Select-Object Speed, SMBIOSMemoryType | ConvertTo-Json",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                
                using var process = Process.Start(psi);
                if (process != null)
                {
                    var output = await process.StandardOutput.ReadToEndAsync();
                    await process.WaitForExitAsync();
                    
                    if (!string.IsNullOrWhiteSpace(output) && output != "null")
                    {
                        dynamic result = Newtonsoft.Json.JsonConvert.DeserializeObject(output);
                        if (result != null)
                        {
                            if (result is Newtonsoft.Json.Linq.JArray array && array.Count > 0)
                            {
                                int speed = array[0]["Speed"]?.ToObject<int>() ?? 3200;
                                int typeCode = array[0]["SMBIOSMemoryType"]?.ToObject<int>() ?? 0;
                                
                                string type = typeCode switch
                                {
                                    34 => "DDR5",
                                    26 => "DDR4",
                                    24 => "DDR3",
                                    _ => "Unknown"
                                };
                                
                                return (type, speed);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"PowerShell RAM detection failed: {ex.Message}");
            }
            
            return ("Unknown", 3200);
        }

        private (string type, int speed) GetRamInfoFromRegistry()
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                if (key != null)
                {
                    // This is a rough estimate based on CPU generation
                    var cpuName = key.GetValue("ProcessorNameString")?.ToString() ?? "";
                    
                    if (cpuName.Contains("12th") || cpuName.Contains("13th") || cpuName.Contains("14th"))
                        return ("DDR5", 5600);
                    else if (cpuName.Contains("10th") || cpuName.Contains("11th") || cpuName.Contains("Ryzen 5"))
                        return ("DDR4", 3200);
                    else if (cpuName.Contains("7th") || cpuName.Contains("8th") || cpuName.Contains("9th"))
                        return ("DDR4", 2666);
                    else
                        return ("DDR4", 3200); // Modern default
                }
            }
            catch { }
            
            return ("Unknown", 3200);
        }

        private async Task<RamInfo> DetectLinuxRamAsync()
        {
            var ram = new RamInfo();

            try
            {
                var memInfo = await File.ReadAllTextAsync("/proc/meminfo");
                
                var totalMatch = Regex.Match(memInfo, @"MemTotal:\s+(\d+) kB");
                if (totalMatch.Success)
                {
                    var totalKB = ulong.Parse(totalMatch.Groups[1].Value);
                    ram.TotalGB = totalKB / (1024 * 1024);
                }
                
                var availMatch = Regex.Match(memInfo, @"MemAvailable:\s+(\d+) kB");
                if (availMatch.Success)
                {
                    var availKB = ulong.Parse(availMatch.Groups[1].Value);
                    ram.AvailableGB = availKB / (1024 * 1024);
                }
                
                try
                {
                    var output = await RunBashCommandAsync("sudo dmidecode -t memory | grep -i 'Type:\\|Speed:'");
                    if (output.Contains("DDR5")) ram.Type = "DDR5";
                    else if (output.Contains("DDR4")) ram.Type = "DDR4";
                    else if (output.Contains("DDR3")) ram.Type = "DDR3";
                    
                    var speedMatch = Regex.Match(output, @"Speed:\s+(\d+)\s+MT/s");
                    if (speedMatch.Success)
                    {
                        ram.SpeedMHz = int.Parse(speedMatch.Groups[1].Value);
                    }
                }
                catch { }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Linux RAM detection failed: {ex.Message}");
                return GetFallbackRamInfo();
            }

            return ram;
        }

        private async Task<RamInfo> DetectMacRamAsync()
        {
            var ram = new RamInfo();

            try
            {
                var totalStr = await RunBashCommandAsync("sysctl -n hw.memsize");
                if (ulong.TryParse(totalStr, out ulong totalBytes))
                {
                    ram.TotalGB = totalBytes / (1024 * 1024 * 1024);
                }
                
                var freeStr = await RunBashCommandAsync("memory_pressure | grep \"System-wide memory free percentage:\"");
                var percentMatch = Regex.Match(freeStr, @"(\d+)%");
                if (percentMatch.Success && int.TryParse(percentMatch.Groups[1].Value, out int freePercent))
                {
                    ram.AvailableGB = (ulong)((double)ram.TotalGB * freePercent / 100.0);
                }
                
                var cpuType = await RunBashCommandAsync("sysctl -n machdep.cpu.brand_string");
                if (cpuType.Contains("Apple"))
                {
                    ram.Type = "Unified";
                    ram.SpeedMHz = 6400;
                }
                else
                {
                    ram.Type = "DDR4";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"macOS RAM detection failed: {ex.Message}");
                return GetFallbackRamInfo();
            }

            return ram;
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

        private RamInfo GetFallbackRamInfo()
        {
            var gcMemoryInfo = GC.GetGCMemoryInfo();
            var totalBytes = gcMemoryInfo.TotalAvailableMemoryBytes;
            
            return new RamInfo
            {
                TotalGB = (ulong)(totalBytes / (1024 * 1024 * 1024)),
                AvailableGB = (ulong)((totalBytes - GC.GetTotalMemory(false)) / (1024 * 1024 * 1024)),
                Type = "Unknown",
                SpeedMHz = 3200
            };
        }
    }
}