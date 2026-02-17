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
using System.Management;
using System.Collections.Generic;

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
                // PRIMARY: GlobalMemoryStatusEx (ALWAYS works) - NOW WITH DECIMALS
                var memStatus = new MEMORYSTATUSEX();
                memStatus.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
                
                if (GlobalMemoryStatusEx(ref memStatus))
                {
                    // Convert to GB with 1 decimal place
                    ram.TotalGB = Math.Round(memStatus.ullTotalPhys / (1024.0 * 1024.0 * 1024.0), 1);
                    ram.AvailableGB = Math.Round(memStatus.ullAvailPhys / (1024.0 * 1024.0 * 1024.0), 1);
                    
                    _logger.LogDebug($"GlobalMemoryStatusEx: Total={ram.TotalGB}GB, Available={ram.AvailableGB}GB");
                }

                // Try multiple methods for RAM type and speed
                bool typeDetected = false;

                // METHOD 1: WMI (most accurate)
                try
                {
                    var (type, speed, moduleCount) = await GetRamInfoFromWmiAsync();
                    if (!string.IsNullOrEmpty(type) && speed > 0)
                    {
                        ram.Type = type;
                        ram.SpeedMHz = speed;
                        typeDetected = true;
                        _logger.LogDebug($"WMI detected: {type} @ {speed}MHz across {moduleCount} modules");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"WMI RAM detection failed: {ex.Message}");
                }

                // METHOD 2: PowerShell (if WMI fails)
                if (!typeDetected)
                {
                    try
                    {
                        var (type, speed, moduleCount) = await GetRamInfoFromPowerShellAsync();
                        if (!string.IsNullOrEmpty(type) && speed > 0)
                        {
                            ram.Type = type;
                            ram.SpeedMHz = speed;
                            typeDetected = true;
                            _logger.LogDebug($"PowerShell detected: {type} @ {speed}MHz across {moduleCount} modules");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug($"PowerShell RAM detection failed: {ex.Message}");
                    }
                }

                // METHOD 3: Registry + CPU-based estimation
                if (!typeDetected)
                {
                    var (type, speed) = GetRamInfoFromRegistry();
                    if (!string.IsNullOrEmpty(type))
                    {
                        ram.Type = type;
                        ram.SpeedMHz = speed;
                        typeDetected = true;
                        _logger.LogDebug($"Registry/CPU estimation: {type} @ {speed}MHz");
                    }
                }

                // METHOD 4: Command line tools (wmic)
                if (!typeDetected)
                {
                    try
                    {
                        var (type, speed) = await GetRamInfoFromWmicAsync();
                        if (!string.IsNullOrEmpty(type))
                        {
                            ram.Type = type;
                            ram.SpeedMHz = speed;
                            typeDetected = true;
                            _logger.LogDebug($"WMIC detected: {type} @ {speed}MHz");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug($"WMIC detection failed: {ex.Message}");
                    }
                }

                // Final fallback
                if (!typeDetected)
                {
                    ram.Type = "Unknown";
                    ram.SpeedMHz = EstimateRamSpeedFromCpu();
                    _logger.LogDebug($"Using CPU-based estimation: {ram.SpeedMHz}MHz");
                }

                // Log total modules/slots if available
                try
                {
                    var slots = await GetRamSlotInfoAsync();
                    if (slots > 0)
                    {
                        _logger.LogDebug($"Detected {slots} RAM modules installed");
                    }
                }
                catch { }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Windows RAM detection failed: {ex.Message}");
                return GetFallbackRamInfo();
            }

            return ram;
        }

        private async Task<(string type, int speed, int moduleCount)> GetRamInfoFromWmiAsync()
        {
            string type = "Unknown";
            int speed = 3200;
            int moduleCount = 0;
            List<int> speeds = new List<int>();
            List<int> typeCodes = new List<int>();

            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_PhysicalMemory");
                
                foreach (var item in searcher.Get())
                {
                    moduleCount++;
                    
                    // Get speed
                    if (item["Speed"] != null && int.TryParse(item["Speed"].ToString(), out int moduleSpeed))
                    {
                        speeds.Add(moduleSpeed);
                    }
                    
                    // Get memory type from SMBIOSMemoryType
                    if (item["SMBIOSMemoryType"] != null && int.TryParse(item["SMBIOSMemoryType"].ToString(), out int typeCode))
                    {
                        typeCodes.Add(typeCode);
                    }
                    
                    // Also check MemoryType (older systems)
                    if (item["MemoryType"] != null && int.TryParse(item["MemoryType"].ToString(), out int memType) && typeCodes.Count == 0)
                    {
                        typeCodes.Add(memType);
                    }
                }

                // Calculate average speed
                if (speeds.Count > 0)
                {
                    speed = (int)Math.Round(speeds.Average());
                }

                // Determine RAM type from type codes
                if (typeCodes.Count > 0)
                {
                    int mainTypeCode = typeCodes.GroupBy(x => x)
                                                .OrderByDescending(g => g.Count())
                                                .First().Key;
                    
                    type = mainTypeCode switch
                    {
                        34 => "DDR5",
                        26 => "DDR4",
                        24 => "DDR3",
                        21 => "DDR2",
                        20 => "DDR",
                        0 => "Unknown",
                        _ => mainTypeCode >= 34 ? "DDR5" : 
                             mainTypeCode >= 26 ? "DDR4" : 
                             mainTypeCode >= 24 ? "DDR3" : "Unknown"
                    };
                }
                else if (speed >= 6400)
                {
                    type = "DDR5";
                }
                else if (speed >= 3200)
                {
                    type = "DDR4";
                }
                else if (speed >= 1600)
                {
                    type = "DDR3";
                }
                else if (speed >= 800)
                {
                    type = "DDR2";
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"WMI detailed detection failed: {ex.Message}");
                throw;
            }

            return (type, speed, moduleCount);
        }

        private async Task<(string type, int speed, int moduleCount)> GetRamInfoFromPowerShellAsync()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "Get-WmiObject -Class Win32_PhysicalMemory | Select-Object Speed, SMBIOSMemoryType, MemoryType, Capacity | ConvertTo-Json",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    StandardOutputEncoding = System.Text.Encoding.UTF8
                };
                
                using var process = Process.Start(psi);
                if (process != null)
                {
                    var output = await process.StandardOutput.ReadToEndAsync();
                    await process.WaitForExitAsync();
                    
                    if (!string.IsNullOrWhiteSpace(output) && output != "null" && output != "[]")
                    {
                        var token = JToken.Parse(output);
                        var modules = token is JArray ? token as JArray : new JArray { token };
                        
                        int moduleCount = modules.Count;
                        List<int> speeds = new List<int>();
                        List<int> typeCodes = new List<int>();
                        
                        foreach (var module in modules)
                        {
                            // Get speed
                            if (module["Speed"] != null)
                            {
                                int speed = module["Speed"].ToObject<int>();
                                if (speed > 0) speeds.Add(speed);
                            }
                            
                            // Get SMBIOS type
                            if (module["SMBIOSMemoryType"] != null)
                            {
                                int typeCode = module["SMBIOSMemoryType"].ToObject<int>();
                                if (typeCode > 0) typeCodes.Add(typeCode);
                            }
                            
                            // Fallback to MemoryType
                            if (typeCodes.Count == 0 && module["MemoryType"] != null)
                            {
                                int memType = module["MemoryType"].ToObject<int>();
                                if (memType > 0) typeCodes.Add(memType);
                            }
                        }
                        
                        int avgSpeed = speeds.Count > 0 ? (int)Math.Round(speeds.Average()) : 3200;
                        string type = DetermineRamType(typeCodes, avgSpeed);
                        
                        return (type, avgSpeed, moduleCount);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"PowerShell RAM detection failed: {ex.Message}");
            }
            
            return ("Unknown", 3200, 0);
        }

        private async Task<(string type, int speed)> GetRamInfoFromWmicAsync()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "wmic",
                    Arguments = "memorychip get Speed,MemoryType,SMBIOSMemoryType /format:csv",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                
                using var process = Process.Start(psi);
                if (process != null)
                {
                    var output = await process.StandardOutput.ReadToEndAsync();
                    await process.WaitForExitAsync();
                    
                    var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                    List<int> speeds = new List<int>();
                    List<int> typeCodes = new List<int>();
                    
                    foreach (var line in lines.Skip(1)) // Skip header
                    {
                        var parts = line.Split(',');
                        if (parts.Length >= 3)
                        {
                            if (int.TryParse(parts[1], out int speed) && speed > 0)
                                speeds.Add(speed);
                            
                            if (parts.Length >= 3 && int.TryParse(parts[2], out int typeCode))
                                typeCodes.Add(typeCode);
                        }
                    }
                    
                    int avgSpeed = speeds.Count > 0 ? (int)Math.Round(speeds.Average()) : 3200;
                    string type = DetermineRamType(typeCodes, avgSpeed);
                    
                    return (type, avgSpeed);
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"WMIC detection failed: {ex.Message}");
            }
            
            return ("Unknown", 3200);
        }

        private async Task<int> GetRamSlotInfoAsync()
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_PhysicalMemory");
                int count = 0;
                foreach (var item in searcher.Get())
                {
                    count++;
                }
                return count;
            }
            catch
            {
                return 0;
            }
        }

        private string DetermineRamType(List<int> typeCodes, int speed)
        {
            if (typeCodes.Count > 0)
            {
                int mainTypeCode = typeCodes.GroupBy(x => x)
                                            .OrderByDescending(g => g.Count())
                                            .First().Key;
                
                return mainTypeCode switch
                {
                    34 => "DDR5",
                    26 => "DDR4",
                    24 => "DDR3",
                    21 => "DDR2",
                    20 => "DDR",
                    0 => "Unknown",
                    _ => mainTypeCode >= 34 ? "DDR5" : 
                         mainTypeCode >= 26 ? "DDR4" : 
                         mainTypeCode >= 24 ? "DDR3" : "Unknown"
                };
            }
            
            // Fallback to speed-based detection
            return speed switch
            {
                >= 6400 => "DDR5",
                >= 3200 => "DDR4",
                >= 1600 => "DDR3",
                >= 800 => "DDR2",
                _ => "Unknown"
            };
        }

        private (string type, int speed) GetRamInfoFromRegistry()
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                if (key != null)
                {
                    var cpuName = key.GetValue("ProcessorNameString")?.ToString() ?? "";
                    
                    // Based on CPU generation
                    if (cpuName.Contains("12th") || cpuName.Contains("13th") || cpuName.Contains("14th") || 
                        cpuName.Contains("Ryzen 7") || cpuName.Contains("Ryzen 9"))
                        return ("DDR5", 5600);
                    else if (cpuName.Contains("10th") || cpuName.Contains("11th") || cpuName.Contains("Ryzen 5") || 
                             cpuName.Contains("Ryzen 3") || cpuName.Contains("Xeon"))
                        return ("DDR4", 3200);
                    else if (cpuName.Contains("6th") || cpuName.Contains("7th") || cpuName.Contains("8th") || 
                             cpuName.Contains("9th"))
                        return ("DDR4", 2666);
                    else if (cpuName.Contains("2nd") || cpuName.Contains("3rd") || cpuName.Contains("4th") || 
                             cpuName.Contains("5th"))
                        return ("DDR3", 1600);
                    else
                        return ("DDR4", 3200);
                }
            }
            catch { }
            
            return ("Unknown", 3200);
        }

        private int EstimateRamSpeedFromCpu()
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                if (key != null)
                {
                    var cpuName = key.GetValue("ProcessorNameString")?.ToString() ?? "";
                    
                    if (cpuName.Contains("Xeon") || cpuName.Contains("E3-1270"))
                        return 1600; // Your Xeon E3-1270 v3 uses DDR3 @ 1600MHz
                    else if (cpuName.Contains("12th") || cpuName.Contains("13th"))
                        return 5600;
                    else if (cpuName.Contains("10th") || cpuName.Contains("11th"))
                        return 3200;
                    else if (cpuName.Contains("6th") || cpuName.Contains("7th") || cpuName.Contains("8th") || cpuName.Contains("9th"))
                        return 2666;
                    else if (cpuName.Contains("2nd") || cpuName.Contains("3rd") || cpuName.Contains("4th") || cpuName.Contains("5th"))
                        return 1600;
                }
            }
            catch { }
            
            return 3200;
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
                    ram.TotalGB = Math.Round(totalKB / (1024.0 * 1024.0), 1);
                }
                
                var availMatch = Regex.Match(memInfo, @"MemAvailable:\s+(\d+) kB");
                if (availMatch.Success)
                {
                    var availKB = ulong.Parse(availMatch.Groups[1].Value);
                    ram.AvailableGB = Math.Round(availKB / (1024.0 * 1024.0), 1);
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
                    ram.TotalGB = Math.Round(totalBytes / (1024.0 * 1024.0 * 1024.0), 1);
                }
                
                var freeStr = await RunBashCommandAsync("memory_pressure | grep \"System-wide memory free percentage:\"");
                var percentMatch = Regex.Match(freeStr, @"(\d+)%");
                if (percentMatch.Success && int.TryParse(percentMatch.Groups[1].Value, out int freePercent))
                {
                    ram.AvailableGB = Math.Round((double)ram.TotalGB * freePercent / 100.0, 1);
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
                TotalGB = Math.Round(totalBytes / (1024.0 * 1024.0 * 1024.0), 1),
                AvailableGB = Math.Round((totalBytes - GC.GetTotalMemory(false)) / (1024.0 * 1024.0 * 1024.0), 1),
                Type = "Unknown",
                SpeedMHz = 3200
            };
        }
    }
}