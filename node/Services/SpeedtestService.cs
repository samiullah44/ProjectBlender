using System;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Linq;

namespace BlendFarm.Node.Services
{
    public class SpeedtestService
    {
        private readonly ILogger<SpeedtestService> _logger;
        private readonly string _speedtestUrl = "https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-win64.zip";
        private readonly string _speedtestExeName = "speedtest.exe";

        public SpeedtestService(ILogger<SpeedtestService> logger)
        {
            _logger = logger;
        }

        public async Task<string> GetOrInstallSpeedtestAsync()
        {
            var currentDir = Directory.GetCurrentDirectory();
            var speedtestPath = Path.Combine(currentDir, _speedtestExeName);

            // 1. Check if already exists in current directory
            if (File.Exists(speedtestPath))
            {
                if (await TestSpeedtestExecutableAsync(speedtestPath))
                {
                    _logger.LogInformation($"[Speedtest] Found existing Speedtest CLI: {speedtestPath}");
                    return speedtestPath;
                }
            }

            // 2. Check in PATH
            var pathSpeedtest = await FindSpeedtestInPathAsync();
            if (!string.IsNullOrEmpty(pathSpeedtest))
            {
                _logger.LogInformation($"[Speedtest] Found Speedtest CLI in PATH: {pathSpeedtest}");
                return pathSpeedtest;
            }

            // 3. Download if missing
            _logger.LogWarning("[Speedtest] Speedtest CLI not found. Downloading automatically...");
            return await DownloadSpeedtestAsync(speedtestPath);
        }

        private async Task<string> DownloadSpeedtestAsync(string outputPath)
        {
            var tempZip = Path.Combine(Path.GetTempPath(), "speedtest-cli.zip");
            var extractPath = Path.GetTempPath() + "_speedtest_extract";

            try
            {
                using var client = new HttpClient();
                client.Timeout = TimeSpan.FromMinutes(5);

                _logger.LogInformation($"[Speedtest] Downloading from {_speedtestUrl}...");
                var response = await client.GetAsync(_speedtestUrl);
                response.EnsureSuccessStatusCode();

                using (var fs = new FileStream(tempZip, FileMode.Create))
                {
                    await response.Content.CopyToAsync(fs);
                }

                _logger.LogInformation("[Speedtest] Extracting binary...");
                if (Directory.Exists(extractPath)) Directory.Delete(extractPath, true);
                Directory.CreateDirectory(extractPath);

                ZipFile.ExtractToDirectory(tempZip, extractPath);

                var extractedExe = Directory.GetFiles(extractPath, _speedtestExeName, SearchOption.AllDirectories).FirstOrDefault();
                if (extractedExe != null)
                {
                    File.Copy(extractedExe, outputPath, true);
                    _logger.LogInformation($"[Speedtest] Successfully installed to {outputPath}");
                    
                    // Cleanup
                    try { Directory.Delete(extractPath, true); File.Delete(tempZip); } catch { }
                    
                    return outputPath;
                }
                else
                {
                    throw new Exception("Could not find speedtest.exe in downloaded ZIP");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"[Speedtest] Failed to download/install: {ex.Message}");
                return null;
            }
        }

        private async Task<bool> TestSpeedtestExecutableAsync(string path)
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = path,
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                return process.ExitCode == 0 && output.Contains("Speedtest");
            }
            catch
            {
                return false;
            }
        }

        private async Task<string> FindSpeedtestInPathAsync()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "where",
                        Arguments = "speedtest",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0)
                {
                    var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        if (await TestSpeedtestExecutableAsync(line.Trim()))
                            return line.Trim();
                    }
                }
            }
            catch { }
            return null;
        }
    }
}
