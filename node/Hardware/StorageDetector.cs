using System;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;
using System.Text.RegularExpressions;

namespace BlendFarm.Node.Hardware
{
    public class StorageDetector
    {
        private readonly ILogger _logger;

        public StorageDetector(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<StorageInfo> DetectAsync()
        {
            var storage = new StorageInfo();

            try
            {
                // Get info about the drive where the app is running
                var currentDrive = Path.GetPathRoot(Environment.CurrentDirectory);
                storage.DriveLetter = currentDrive;

                var driveInfo = new DriveInfo(currentDrive);
                
                storage.TotalGB = (ulong)(driveInfo.TotalSize / (1024 * 1024 * 1024));
                storage.FreeGB = (ulong)(driveInfo.AvailableFreeSpace / (1024 * 1024 * 1024));
                storage.FileSystem = driveInfo.DriveFormat;

                // Detect drive type (SSD/HDD)
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    storage.Type = await DetectWindowsDriveTypeAsync(currentDrive);
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    storage.Type = await DetectLinuxDriveTypeAsync(currentDrive);
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    storage.Type = await DetectMacDriveTypeAsync(currentDrive);
                }

                // Perform quick speed test (optional, can be slow)
                try
                {
                    var speeds = await MeasureDiskSpeedAsync(currentDrive);
                    storage.ReadSpeedMBs = speeds.read;
                    storage.WriteSpeedMBs = speeds.write;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"Disk speed test failed: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Storage detection failed: {ex.Message}");
                return GetFallbackStorageInfo();
            }

            return storage;
        }

        private async Task<string> DetectWindowsDriveTypeAsync(string driveLetter)
        {
            try
            {
                using var searcher = new ManagementObjectSearcher(
                    $"SELECT * FROM Win32_DiskDrive WHERE Index = (SELECT Index FROM Win32_LogicalDiskToPartition " +
                    $"WHERE LogicalDisk = '{driveLetter.Replace("\\", "")}')");
                
                foreach (var item in searcher.Get())
                {
                    if (item["MediaType"] != null)
                    {
                        var mediaType = item["MediaType"].ToString();
                        if (mediaType.Contains("SSD") || mediaType.Contains("Solid State"))
                            return "SSD";
                        if (mediaType.Contains("HDD") || mediaType.Contains("Fixed"))
                            return "HDD";
                    }
                    
                    // Check if it's NVMe
                    if (item["Model"] != null)
                    {
                        var model = item["Model"].ToString();
                        if (model.Contains("NVMe"))
                            return "NVMe";
                        if (model.Contains("SSD"))
                            return "SSD";
                    }
                }
                
                // Fallback to checking if it's an SSD via Win32_PhysicalMedia
                using var mediaSearcher = new ManagementObjectSearcher(
                    "SELECT * FROM Win32_PhysicalMedia");
                
                foreach (var item in mediaSearcher.Get())
                {
                    if (item["Tag"] != null && item["Tag"].ToString().Contains(driveLetter))
                    {
                        if (item["Description"] != null)
                        {
                            var desc = item["Description"].ToString();
                            if (desc.Contains("SSD")) return "SSD";
                            if (desc.Contains("NVMe")) return "NVMe";
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"WMI drive type detection failed: {ex.Message}. Trying PowerShell fallback...");
            }

            // Fallback to PowerShell
            var psType = await DetectWindowsDriveTypeViaPowerShellAsync(driveLetter);
            if (psType != "Unknown") return psType;

            // Assume HDD if can't detect
            return "HDD";
        }

        private async Task<string> DetectWindowsDriveTypeViaPowerShellAsync(string driveLetter)
        {
            try
            {
                // Remove trailing backslash if present
                var cleanDrive = driveLetter.TrimEnd('\\');
                
                // PowerShell command to get drive type
                var script = $"Get-PhysicalDisk | Where-Object {{ $_.DeviceID -eq (Get-Partition -DriveLetter {cleanDrive.Replace(":", "")} | Get-Disk).Number }} | Select-Object -ExpandProperty MediaType";
                
                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{script}\"",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = System.Diagnostics.Process.Start(psi);
                if (process != null)
                {
                    string output = (await process.StandardOutput.ReadToEndAsync()).Trim();
                    await process.WaitForExitAsync();

                    if (output.Contains("SSD")) return "SSD";
                    if (output.Contains("HDD")) return "HDD";
                    if (output.Contains("SCM")) return "SSD"; // Storage Class Memory (likely NVMe/Intel Optane)
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"PowerShell drive type detection failed: {ex.Message}");
            }

            return "Unknown";
        }

        private async Task<string> DetectLinuxDriveTypeAsync(string mountPoint)
        {
            try
            {
                // Check if it's an SSD by looking at rotational flag
                var device = await RunBashCommandAsync($"df {mountPoint} | tail -1 | awk '{{print $1}}'");
                device = device.Replace("/dev/", "");
                
                if (!string.IsNullOrEmpty(device))
                {
                    var rotational = await RunBashCommandAsync($"cat /sys/block/{device}/queue/rotational");
                    if (rotational.Trim() == "0")
                        return "SSD";
                    else if (rotational.Trim() == "1")
                        return "HDD";
                }
                
                // Check if it's NVMe
                if (device.Contains("nvme"))
                    return "NVMe";
            }
            catch { }

            return "Unknown";
        }

        private async Task<string> DetectMacDriveTypeAsync(string mountPoint)
        {
            try
            {
                var output = await RunBashCommandAsync($"diskutil info {mountPoint} | grep 'Solid State'");
                if (output.Contains("Yes"))
                    return "SSD";
                if (output.Contains("No"))
                    return "HDD";
                
                // Check if it's Apple Silicon
                if (mountPoint.StartsWith("/"))
                {
                    var model = await RunBashCommandAsync("sysctl -n hw.model");
                    if (model.Contains("Mac") && !model.Contains("Intel"))
                        return "SSD"; // Apple Silicon always SSD
                }
            }
            catch { }

            return "Unknown";
        }

        private async Task<(double read, double write)> MeasureDiskSpeedAsync(string drivePath)
        {
            // Simple speed test - write and read a 100MB test file
            string testFile = Path.Combine(drivePath, "speed_test.tmp");
            const int testSizeMB = 100;
            const int testSizeBytes = testSizeMB * 1024 * 1024;
            
            var random = new Random();
            byte[] data = new byte[testSizeBytes];
            random.NextBytes(data);

            try
            {
                // Write test
                var writeTimer = System.Diagnostics.Stopwatch.StartNew();
                await File.WriteAllBytesAsync(testFile, data);
                writeTimer.Stop();
                var writeTime = writeTimer.Elapsed.TotalSeconds;
                
                // Read test
                var readTimer = System.Diagnostics.Stopwatch.StartNew();
                var readData = await File.ReadAllBytesAsync(testFile);
                readTimer.Stop();
                var readTime = readTimer.Elapsed.TotalSeconds;
                
                // Clean up
                File.Delete(testFile);
                
                // Calculate speeds
                double writeSpeedMBs = testSizeMB / writeTime;
                double readSpeedMBs = testSizeMB / readTime;
                
                return (readSpeedMBs, writeSpeedMBs);
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"Disk speed test failed: {ex.Message}");
                return (0, 0);
            }
        }

        private async Task<string> RunBashCommandAsync(string command)
        {
            using var process = new System.Diagnostics.Process
            {
                StartInfo = new System.Diagnostics.ProcessStartInfo
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

        private StorageInfo GetFallbackStorageInfo()
        {
            var drive = new DriveInfo(Path.GetPathRoot(Environment.CurrentDirectory));
            
            return new StorageInfo
            {
                DriveLetter = drive.Name,
                TotalGB = (ulong)(drive.TotalSize / (1024 * 1024 * 1024)),
                FreeGB = (ulong)(drive.AvailableFreeSpace / (1024 * 1024 * 1024)),
                Type = "Unknown",
                FileSystem = drive.DriveFormat,
                ReadSpeedMBs = 500, // Approximate
                WriteSpeedMBs = 400
            };
        }
    }
}