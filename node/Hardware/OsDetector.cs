using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;
using System.IO;

namespace BlendFarm.Node.Hardware
{
    public class OsDetector
    {
        private readonly ILogger _logger;

        public OsDetector(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<OsInfo> DetectAsync()
        {
            var os = new OsInfo();

            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    return await DetectWindowsOsAsync();
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    return await DetectLinuxOsAsync();
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    return await DetectMacOsAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"OS detection failed: {ex.Message}");
            }

            // Fallback
            os.Name = RuntimeInformation.OSDescription;
            os.Version = Environment.OSVersion.Version.ToString();
            os.Architecture = RuntimeInformation.OSArchitecture.ToString();
            os.Is64Bit = Environment.Is64BitOperatingSystem;
            os.DotNetVersion = RuntimeInformation.FrameworkDescription;
            
            return os;
        }

        private async Task<OsInfo> DetectWindowsOsAsync()
        {
            var os = new OsInfo();

            try
            {
                using var searcher = new System.Management.ManagementObjectSearcher(
                    "SELECT * FROM Win32_OperatingSystem");
                
                foreach (var item in searcher.Get())
                {
                    os.Name = $"{item["Caption"]} {item["Edition"]}".Trim();
                    os.Version = item["Version"]?.ToString() ?? "";
                    os.BuildNumber = item["BuildNumber"]?.ToString() ?? "";
                    os.Architecture = item["OSArchitecture"]?.ToString() ?? "64-bit";
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"WMI OS detection failed: {ex.Message}");
                
                // Fallback
                os.Name = RuntimeInformation.OSDescription;
                os.Version = Environment.OSVersion.Version.ToString();
            }

            os.Is64Bit = Environment.Is64BitOperatingSystem;
            os.DotNetVersion = RuntimeInformation.FrameworkDescription;
            
            return os;
        }

        private async Task<OsInfo> DetectLinuxOsAsync()
        {
            var os = new OsInfo();

            try
            {
                // Try /etc/os-release first
                if (File.Exists("/etc/os-release"))
                {
                    var lines = await File.ReadAllLinesAsync("/etc/os-release");
                    foreach (var line in lines)
                    {
                        if (line.StartsWith("PRETTY_NAME="))
                        {
                            os.Name = line.Replace("PRETTY_NAME=", "").Trim('"');
                        }
                        else if (line.StartsWith("VERSION_ID="))
                        {
                            os.Version = line.Replace("VERSION_ID=", "").Trim('"');
                        }
                    }
                }

                // Get kernel version
                var kernelVersion = await RunBashCommandAsync("uname -r");
                os.BuildNumber = kernelVersion.Trim();
                
                os.Architecture = RuntimeInformation.OSArchitecture.ToString();
                os.Is64Bit = Environment.Is64BitOperatingSystem;
                os.DotNetVersion = RuntimeInformation.FrameworkDescription;
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"Linux OS detection failed: {ex.Message}");
                
                os.Name = "Linux";
                os.Version = "Unknown";
            }

            return os;
        }

        private async Task<OsInfo> DetectMacOsAsync()
        {
            var os = new OsInfo();

            try
            {
                var productName = await RunBashCommandAsync("sw_vers -productName");
                var productVersion = await RunBashCommandAsync("sw_vers -productVersion");
                var buildVersion = await RunBashCommandAsync("sw_vers -buildVersion");
                
                os.Name = $"{productName} {productVersion}".Trim();
                os.Version = productVersion.Trim();
                os.BuildNumber = buildVersion.Trim();
                os.Architecture = RuntimeInformation.OSArchitecture.ToString();
                os.Is64Bit = Environment.Is64BitOperatingSystem;
                os.DotNetVersion = RuntimeInformation.FrameworkDescription;
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"macOS detection failed: {ex.Message}");
                
                os.Name = "macOS";
                os.Version = "Unknown";
            }

            return os;
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
    }
}