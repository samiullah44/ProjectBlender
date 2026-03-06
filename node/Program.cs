using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using BlendFarm.Node.Services;
using BlendFarm.Node.Models;
using System;
using System.IO;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Net.Http;
using System.IO.Compression;
using System.Linq;
using System.Text.RegularExpressions;

namespace BlendFarm.Node
{
    public static class BlenderFinder
    {
        
        public static async Task<string> FindBlenderAsync(ILogger logger, string targetVersion)
        {
            logger.LogInformation($"[System] Searching for Blender {targetVersion} installation...");
            
            // 1. First check manually if the SPECIFIC VERSION of Blender is in PATH
            logger.LogInformation("[System] Checking if requested Blender version is in PATH...");
            var blenderInPath = await CheckSpecificBlenderVersionInPathAsync(targetVersion);
            if (!string.IsNullOrEmpty(blenderInPath))
            {
                logger.LogInformation($"[System]   -> Blender {targetVersion} found in PATH: {blenderInPath}");
                return blenderInPath;
            }
            
            // 2. Check common installation directories for SPECIFIC VERSION
            logger.LogInformation("[System] Checking common installation directories for specific version...");
            var installedBlender = FindSpecificVersionInstalledBlender(targetVersion);
            if (!string.IsNullOrEmpty(installedBlender))
            {
                logger.LogInformation($"[System]   -> Found installed Blender {targetVersion}: {installedBlender}");
                return installedBlender;
            }
            
            // 3. Check our custom installation directory for SPECIFIC VERSION
            var customPathBlender = await CheckCustomInstallationForVersionAsync(targetVersion);
            if (!string.IsNullOrEmpty(customPathBlender))
            {
                logger.LogInformation($"[System]   -> Found Blender {targetVersion} in custom location: {customPathBlender}");
                return customPathBlender;
            }
            
            // 4. Download SPECIFIC VERSION to current directory
            logger.LogWarning($"[System] Warning: Blender {targetVersion} not found. Downloading to current directory...");
            return await DownloadBlenderToCurrentDirectoryAsync(logger, targetVersion);
        }
        
        private static async Task<string> CheckSpecificBlenderVersionInPathAsync(string targetVersion)
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "blender",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8
                    }
                };
                
                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                if (process.ExitCode == 0 && output.Contains("Blender"))
                {
                    // Parse Blender version from output
                    var version = ParseBlenderVersion(output);
                    if (version == targetVersion)
                    {
                        // Get the actual path from where command
                        var whereProcess = new Process
                        {
                            StartInfo = new ProcessStartInfo
                            {
                                FileName = "where",
                                Arguments = "blender",
                                RedirectStandardOutput = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            }
                        };
                        
                        whereProcess.Start();
                        var whereOutput = await whereProcess.StandardOutput.ReadToEndAsync();
                        await whereProcess.WaitForExitAsync();
                        
                        var lines = whereOutput.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                        return lines.Length > 0 ? lines[0].Trim() : "blender";
                    }
                    else
                    {
                        Console.WriteLine($"Found Blender {version} in PATH, but looking for {targetVersion}");
                    }
                }
            }
            catch { }
            
            return null;
        }
        
        private static string FindSpecificVersionInstalledBlender(string targetVersion)
        {
            // Common installation paths for Blender
            var possiblePaths = new[]
            {
                // Default installation paths
                @"C:\Program Files\Blender Foundation\Blender",
                @"C:\Program Files (x86)\Blender Foundation\Blender",
                @"D:\Program Files\Blender Foundation\Blender",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Blender Foundation", "Blender"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Blender Foundation", "Blender"),
                
                // Portable installations
                @"C:\Blender",
                @"D:\Blender",
                
                // User directories
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Blender"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Blender"),
                
                // Current directory
                Path.Combine(Directory.GetCurrentDirectory(), "Blender")
            };
            
            foreach (var basePath in possiblePaths)
            {
                if (Directory.Exists(basePath))
                {
                    try
                    {
                        // First, check for exact version directory
                        var versionDir = Path.Combine(basePath, $"blender-{targetVersion}-windows-x64");
                        if (Directory.Exists(versionDir))
                        {
                            var blenderExe = Path.Combine(versionDir, "blender.exe");
                            if (File.Exists(blenderExe) && TestBlenderExecutable(blenderExe, targetVersion))
                                return blenderExe;
                        }
                        
                        // Search for blender.exe and check version
                        var blenderExes = Directory.GetFiles(basePath, "blender.exe", SearchOption.AllDirectories);
                        foreach (var exe in blenderExes)
                        {
                            if (TestBlenderExecutable(exe, targetVersion))
                                return exe;
                        }
                    }
                    catch (Exception)
                    {
                        // Ignore errors and continue searching
                    }
                }
            }
            
            return null;
        }
        
        private static async Task<string> CheckCustomInstallationForVersionAsync(string targetVersion)
        {
            var currentDir = Directory.GetCurrentDirectory();
            var customDir = Path.Combine(currentDir, "Blender");
            
            if (Directory.Exists(customDir))
            {
                // Check for exact version directory
                var versionDir = Path.Combine(customDir, $"blender-{targetVersion}-windows-x64");
                if (Directory.Exists(versionDir))
                {
                    var blenderExe = Path.Combine(versionDir, "blender.exe");
                    if (File.Exists(blenderExe) && await TestBlenderExecutableAsync(blenderExe, targetVersion))
                        return blenderExe;
                }
                
                // Search all blender.exe files and prioritize target version
                var foundExe = FindBlenderInDirectory(customDir, targetVersion);
                if (!string.IsNullOrEmpty(foundExe) && await TestBlenderExecutableAsync(foundExe, targetVersion))
                {
                    return foundExe;
                }
            }
            
            return null;
        }
        
        private static async Task<string> DownloadBlenderToCurrentDirectoryAsync(ILogger logger, string targetVersion)
        {
            var currentDir = Directory.GetCurrentDirectory();
            var downloadDir = Path.Combine(currentDir, "Blender");
            var versionDir = Path.Combine(downloadDir, $"blender-{targetVersion}-windows-x64");
            
            // Check if already downloaded with correct version
            if (Directory.Exists(versionDir))
            {
                var existingBlender = Path.Combine(versionDir, "blender.exe");
                if (File.Exists(existingBlender) && await TestBlenderExecutableAsync(existingBlender, targetVersion))
                {
                    logger.LogInformation($"[System]   -> Using existing Blender {targetVersion} installation: {existingBlender}");
                    return existingBlender;
                }
            }
            
            // Determine version prefix for the release folder:
            // Blender < 3.0 has 4-digit minor (e.g. "2.93"), >= 3.0 has 3-digit (e.g. "4.1")
            var versionPrefix = (Version.TryParse(targetVersion, out var parsedVer) && parsedVer.Major < 3)
                ? targetVersion.Substring(0, 4)
                : targetVersion.Substring(0, 3);
            
            // Try different URLs for Blender download
            var urlsToTry = new[]
            {
                // Primary URL - Direct download from blender.org
                $"https://download.blender.org/release/Blender{versionPrefix}/blender-{targetVersion}-windows-x64.zip",
                
                // Alternative URL structure
                $"https://download.blender.org/release/Blender{versionPrefix}/blender-{targetVersion}-windows64.zip",
                
                // Mirror URL
                $"https://mirror.clarkson.edu/blender/release/Blender{versionPrefix}/blender-{targetVersion}-windows-x64.zip",
                
                // If 5.0.1 fails, try 4.1.1 as fallback
                "https://download.blender.org/release/Blender4.1/blender-4.1.1-windows-x64.zip"
            };
            
            var tempZip = Path.GetTempFileName() + ".zip";
            
            foreach (var downloadUrl in urlsToTry)
            {
                try
                {
                    logger.LogInformation($"[Download] Trying URL: {downloadUrl}");
                    
                    using (var client = new HttpClient())
                    {
                        client.Timeout = TimeSpan.FromMinutes(10);
                        
                        // Try to download with progress tracking
                        using (var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead))
                        {
                            if (response.IsSuccessStatusCode)
                            {
                                var totalBytes = response.Content.Headers.ContentLength ?? -1L;
                                var totalRead = 0L;
                                var buffer = new byte[8192];
                                var isMoreToRead = true;
                                
                                logger.LogInformation($"[Download] Downloading Blender {targetVersion} from: {downloadUrl}");
                                using (var stream = await response.Content.ReadAsStreamAsync())
                                using (var fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
                                {
                                    // Show initial progress
                                    if (totalBytes > 0)
                                    {
                                        Console.WriteLine($"Blender Size: {FormatBytes(totalBytes)}");
                                    }
                                    else
                                    {
                                        Console.WriteLine($"Blender Size: Unknown (streaming download)");
                                    }
                                    
                                    var lastProgressUpdate = DateTime.Now;
                                    var progressUpdateInterval = TimeSpan.FromSeconds(0.5);
                                    
                                    while (isMoreToRead)
                                    {
                                        var read = await stream.ReadAsync(buffer, 0, buffer.Length);
                                        if (read == 0)
                                        {
                                            isMoreToRead = false;
                                        }
                                        else
                                        {
                                            await fs.WriteAsync(buffer, 0, read);
                                            totalRead += read;
                                            
                                            // Show progress if we know total size
                                            if (DateTime.Now - lastProgressUpdate >= progressUpdateInterval)
                                            {
                                                if (totalBytes > 0)
                                                {
                                                    var progress = (double)totalRead / totalBytes * 100;
                                                    Console.Write($"\rDownloading Blender : [{progress:F1}% / 100%] ({FormatBytes(totalRead)} downloaded)   ");
                                                }
                                                else
                                                {
                                                    Console.Write($"\rDownloading Blender : ({FormatBytes(totalRead)} downloaded)   ");
                                                }
                                                lastProgressUpdate = DateTime.Now;
                                            }
                                        }
                                    }
                                    
                                    Console.WriteLine();
                                    // Show final download complete message
                                    logger.LogInformation($"[Download] Download complete: {FormatBytes(totalRead)}");
                                }
                                
                                logger.LogInformation("[System] Extracting Blender...");
                                
                                // Ensure directory exists
                                Directory.CreateDirectory(downloadDir);
                                
                                // Extract ZIP with progress
                                await ExtractZipWithProgressAsync(tempZip, downloadDir, logger);
                                
                                // Find blender.exe
                                var blenderExe = FindBlenderInDirectory(downloadDir, targetVersion);
                                
                                if (!string.IsNullOrEmpty(blenderExe) && await TestBlenderExecutableAsync(blenderExe, targetVersion))
                                {
                                    logger.LogInformation($"[System]   -> Blender {targetVersion} installed to: {blenderExe}");
                                    return blenderExe;
                                }
                                else if (!string.IsNullOrEmpty(blenderExe))
                                {
                                    // Found Blender but wrong version
                                    var version = await GetBlenderVersionAsync(blenderExe);
                                    logger.LogWarning($"[System] Warning: Found Blender {version}, but looking for {targetVersion}");
                                    // Continue to try next URL
                                }
                                else
                                {
                                    logger.LogWarning($"[System] Warning: Blender extracted but blender.exe not found");
                                }
                            }
                            else
                            {
                                logger.LogDebug($"URL returned: {response.StatusCode}");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    logger.LogDebug($"Download failed: {ex.Message}");
                    // Try next URL
                }
                finally
                {
                    // Clean up temp file
                    if (File.Exists(tempZip))
                    {
                        try { File.Delete(tempZip); } catch { }
                    }
                }
            }
            
            // If all URLs failed, try a manual approach
            logger.LogError("[Download] Error: All download URLs failed. Trying alternative approach...");
            return await DownloadBlenderManualFallbackAsync(logger, downloadDir, targetVersion);
        }
        
        // Helper method to extract ZIP with progress
        private static async Task ExtractZipWithProgressAsync(string zipPath, string extractPath, ILogger logger)
        {
            try
            {
                using (var archive = ZipFile.OpenRead(zipPath))
                {
                    var totalEntries = archive.Entries.Count;
                    
                    Console.Write("Extracting...   ");
                    
                    foreach (var entry in archive.Entries)
                    {
                        try
                        {
                            var destinationPath = Path.Combine(extractPath, entry.FullName);
                            var destinationDir = Path.GetDirectoryName(destinationPath);
                            
                            // Create directory if it doesn't exist
                            if (!string.IsNullOrEmpty(destinationDir) && !Directory.Exists(destinationDir))
                            {
                                Directory.CreateDirectory(destinationDir);
                            }
                            
                            // Skip directories
                            if (!string.IsNullOrEmpty(entry.Name))
                            {
                                entry.ExtractToFile(destinationPath, overwrite: true);
                            }
                        }
                        catch (Exception ex)
                        {
                            logger.LogDebug($"Failed to extract {entry.FullName}: {ex.Message}");
                        }
                    }
                    
                    Console.WriteLine($"\rExtracted {totalEntries} files        ");
                    logger.LogInformation($"[System]   -> Extraction complete: {totalEntries} files extracted");
                }
            }
            catch (Exception ex)
            {
                logger.LogError($"Failed to extract ZIP: {ex.Message}");
                throw;
            }
        }
        
        // Helper method to format bytes for display
        private static string FormatBytes(long bytes)
        {
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int suffixIndex = 0;
            double size = bytes;
            
            while (size >= 1024 && suffixIndex < suffixes.Length - 1)
            {
                size /= 1024;
                suffixIndex++;
            }
            
            return $"{size:0.##} {suffixes[suffixIndex]}";
        }
        
        private static async Task<string> DownloadBlenderManualFallbackAsync(ILogger logger, string downloadDir, string targetVersion)
        {
            try
            {
                // Try using PowerShell to download
                logger.LogInformation("[Download] Trying PowerShell download...");
                
                var psPrefix = (Version.TryParse(targetVersion, out var psFallbackVer) && psFallbackVer.Major < 3)
                    ? targetVersion.Substring(0, 4)
                    : targetVersion.Substring(0, 3);
                var psScript =
                    "$url = 'https://download.blender.org/release/Blender" + psPrefix + "/blender-" + targetVersion + "-windows-x64.zip'\n" +
                    "$output = $env:TEMP + '\\blender.zip'\n" +
                    "$installDir = '" + downloadDir.Replace("\\", "\\\\") + "'\n" +
                    "\n" +
                    "# Download\n" +
                    "Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing\n" +
                    "\n" +
                    "# Extract\n" +
                    "Expand-Archive -Path $output -DestinationPath $installDir -Force\n" +
                    "\n" +
                    "# Find blender.exe\n" +
                    "$blenderExe = Get-ChildItem -Path $installDir -Filter 'blender.exe' -Recurse | Select-Object -First 1\n" +
                    "if ($blenderExe) {\n" +
                    "    $blenderExe.FullName\n" +
                    "}\n";
                
                var tempScript = Path.GetTempFileName() + ".ps1";
                File.WriteAllText(tempScript, psScript);
                
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = $"-ExecutionPolicy Bypass -File \"{tempScript}\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                
                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                if (process.ExitCode == 0 && !string.IsNullOrEmpty(output))
                {
                    var blenderExe = output.Trim();
                    if (File.Exists(blenderExe))
                    {
                        if (await TestBlenderExecutableAsync(blenderExe, targetVersion))
                        {
                            logger.LogInformation($"[System] Blender {targetVersion} downloaded via PowerShell: {blenderExe}");
                            return blenderExe;
                        }
                        else
                        {
                            var version = await GetBlenderVersionAsync(blenderExe);
                            logger.LogWarning($"[System] Downloaded Blender {version}, but wanted {targetVersion}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogDebug($"PowerShell fallback failed: {ex.Message}");
            }
            
            // Last resort: Manual instructions
            logger.LogError($@"
[Download] Error: Failed to download Blender {targetVersion} automatically.

[MANUAL INSTALLATION REQUIRED]

1. Please download Blender {targetVersion} manually from:
   https://www.blender.org/download/

2. Choose: Blender {targetVersion}

3. Download the ZIP version (not installer)

4. Extract the ZIP to:
   {downloadDir}

5. Make sure 'blender.exe' is in:
   {downloadDir}\blender-{targetVersion}-windows-x64\blender.exe

6. Run the node again
");
            
            return null;
        }
        
        private static string FindBlenderInDirectory(string directory, string targetVersion = null)
        {
            if (!Directory.Exists(directory))
                return null;
            
            // Look for blender.exe
            var blenderExe = Path.Combine(directory, "blender.exe");
            if (File.Exists(blenderExe))
                return blenderExe;
            
            // Search subdirectories
            try
            {
                var files = Directory.GetFiles(directory, "blender.exe", SearchOption.AllDirectories);
                if (files.Length == 0) return null;

                if (!string.IsNullOrEmpty(targetVersion))
                {
                    // Prioritize path that contains the target version (e.g. "4.5.0")
                    var bestMatch = files.FirstOrDefault(f => f.Contains(targetVersion));
                    if (bestMatch != null) return bestMatch;
                    
                    // Fallback to major.minor (e.g. "4.5")
                    var shortVersion = targetVersion.Split('.').Take(2).Aggregate((a, b) => $"{a}.{b}");
                    bestMatch = files.FirstOrDefault(f => f.Contains(shortVersion));
                    if (bestMatch != null) return bestMatch;
                }

                return files.FirstOrDefault();
            }
            catch
            {
                return null;
            }
        }
        
        private static bool TestBlenderExecutable(string path, string expectedVersion)
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
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8
                    }
                };
                
                process.Start();
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit(5000); // 5 second timeout
                
                if (process.ExitCode == 0 && output.Contains("Blender"))
                {
                    var version = ParseBlenderVersion(output);
                    if (version == expectedVersion)
                        return true;
                }
            }
            catch { }
            
            // Fallback: check for a version-matching subfolder next to blender.exe
            // e.g. blender-windows64/2.93/ tells us this is a 2.93.x installation
            return CheckVersionSubfolder(path, expectedVersion);
        }
        
        private static async Task<bool> TestBlenderExecutableAsync(string path, string expectedVersion)
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
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8
                    }
                };
                
                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                if (process.ExitCode == 0 && output.Contains("Blender"))
                {
                    var version = ParseBlenderVersion(output);
                    if (version == expectedVersion)
                        return true;
                }
            }
            catch { }
            
            // Fallback: check for a version-matching subfolder next to blender.exe
            // e.g. blender-windows64/2.93/ tells us this is a 2.93.x installation
            return CheckVersionSubfolder(path, expectedVersion);
        }
        
        /// <summary>
        /// Checks if a subfolder whose name matches major.minor of <paramref name="expectedVersion"/>
        /// exists in the same directory as <paramref name="blenderExePath"/>.
        /// e.g. for "2.93.0" it looks for a subfolder called "2.93" next to blender.exe.
        /// </summary>
        private static bool CheckVersionSubfolder(string blenderExePath, string expectedVersion)
        {
            try
            {
                var blenderDir = Path.GetDirectoryName(blenderExePath);
                if (string.IsNullOrEmpty(blenderDir) || !Directory.Exists(blenderDir))
                    return false;
                
                // Build major.minor prefix from expectedVersion ("2.93.0" → "2.93")
                var parts = expectedVersion.Split('.');
                if (parts.Length < 2) return false;
                var majorMinor = $"{parts[0]}.{parts[1]}";
                
                // Look for a direct subfolder matching or starting with major.minor
                var subDirs = Directory.GetDirectories(blenderDir);
                foreach (var dir in subDirs)
                {
                    var dirName = Path.GetFileName(dir);
                    if (dirName == majorMinor || dirName.StartsWith(majorMinor + "."))
                        return true;
                }
            }
            catch { }
            
            return false;
        }
        
        private static async Task<string> GetBlenderVersionAsync(string path)
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
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8
                    }
                };
                
                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                if (process.ExitCode == 0 && output.Contains("Blender"))
                {
                    return ParseBlenderVersion(output);
                }
            }
            catch
            {
                return "unknown";
            }
            
            return "unknown";
        }
        
        private static string ParseBlenderVersion(string output)
        {
            try
            {
                // Typical Blender version output: "Blender 5.0.1"
                var lines = output.Split('\n');
                foreach (var line in lines)
                {
                    if (line.Contains("Blender"))
                    {
                        // Use regex to extract version number
                        var match = Regex.Match(line, @"Blender\s+([\d\.]+)");
                        if (match.Success)
                        {
                            return match.Groups[1].Value.Trim();
                        }
                        
                        // Fallback: split by space and find version-like string
                        var parts = line.Split(' ');
                        foreach (var part in parts)
                        {
                            if (part.Contains('.') && char.IsDigit(part[0]))
                            {
                                return part.Trim();
                            }
                        }
                    }
                }
            }
            catch
            {
                return "unknown";
            }
            
            return "unknown";
        }
    }

    class Program
    {
        private static string _targetVersion = "5.0.1";
        private static string _blenderPath = null;
        
        static async Task Main(string[] args)
        {
            // If started by Windows AutoStart, the default directory is System32. 
            // We must switch to the EXE directory so relative paths work.
            if (Directory.GetCurrentDirectory().Contains("System32", StringComparison.OrdinalIgnoreCase))
            {
                var exeDir = Path.GetDirectoryName(Environment.ProcessPath) ?? AppDomain.CurrentDomain.BaseDirectory;
                try { Directory.SetCurrentDirectory(exeDir); } catch { }
            }

            Console.Title = $"BlendFarm Node v1.0 (Blender {_targetVersion})";
            
            // Check if we should run a test
            if (args.Length > 0 && args[0].ToLower() == "test")
            {
                await RunBlenderTestAsync();
                return;
            }
            
            // Otherwise run as service
            await RunAsServiceAsync();
        }
        
        static async Task RunBlenderTestAsync(string targetVersion = "4.5.0")
        {
            Console.WriteLine($"[TEST] Testing Blender {targetVersion} + Python Integration...");
            Console.WriteLine(new string('-', 50));
            
            try
            {
                // Step 1: Check if test_scene.blend exists
                var testBlendFile = "test_scene.blend";
                if (!File.Exists(testBlendFile))
                {
                    Console.WriteLine("[TEST] Error: test_scene.blend not found!");
                    Console.WriteLine("   Creating a simple test file...");
                    
                    // Create a minimal test blend file using Blender
                    await CreateTestBlendFileAsync();
                    
                    if (!File.Exists(testBlendFile))
                    {
                        Console.WriteLine("[TEST] Warning: Please place a .blend file in this directory");
                        Console.WriteLine("   Or run: blender -b -o //test_scene.blend -F BLEND -f 1");
                        return;
                    }
                }
                
                Console.WriteLine($"[TEST] Found: {testBlendFile}");
                
                // Step 2: Check if Python scripts exist
                if (!File.Exists("Scripts/render.py"))
                {
                    Console.WriteLine("[TEST] Error: Scripts/render.py not found!");
                    return;
                }
                
                Console.WriteLine("[TEST] Found: Scripts/render.py");
                
                // Step 3: Get or install SPECIFIC VERSION of Blender
                _blenderPath = await GetOrInstallSpecificBlenderAsync(targetVersion);
                if (string.IsNullOrEmpty(_blenderPath))
                {
                    Console.WriteLine($"[TEST] Error: Failed to get Blender {targetVersion}!");
                    return;
                }
                
                // Verify version
                var actualVersion = await GetBlenderVersionAsync(_blenderPath);
                Console.WriteLine($"[TEST] Blender {actualVersion} found at: {_blenderPath}");
                
                if (actualVersion != targetVersion)
                {
                    Console.WriteLine($"[TEST] Warning: Found Blender {actualVersion}, but wanted {targetVersion}");
                }
                
                // Step 4: Check .blend file compatibility with installed Blender version
                var blendFileCompatible = await CheckBlendFileCompatibilityAsync(testBlendFile, _blenderPath);
                if (!blendFileCompatible)
                {
                    Console.WriteLine("[TEST] Warning: .blend file may not be compatible with installed Blender version");
                    Console.WriteLine("   Consider creating a new .blend file with this Blender version");
                }
                
                // Step 5: Run the PythonRunnerService test
                using var loggerFactory = LoggerFactory.Create(builder =>
                {
                    builder.AddConsole();
                    builder.SetMinimumLevel(LogLevel.Debug);
                });
                
                var logger = loggerFactory.CreateLogger<PythonRunnerService>();
                var runner = new PythonRunnerService(logger, _blenderPath);
                
                Console.WriteLine("\n[TEST] Starting render test...");
                Console.WriteLine(new string('-', 50));
                
                var outputFile = Path.Combine(Directory.GetCurrentDirectory(), $"test_output_{DateTime.Now:yyyyMMdd_HHmmss}.png");
                Console.WriteLine($"[TEST] Output will be at: {outputFile}");
                
                var success = await runner.RunRenderAsync(
                    blendFilePath: testBlendFile,
                    frame: 1,
                    outputPath: outputFile
                );
                
                Console.WriteLine(new string('-', 50));
                
                if (success)
                {
                    Console.WriteLine($"[TEST] PASSED! Output saved to: {outputFile}");
                    
                    if (File.Exists(outputFile))
                    {
                        var fileInfo = new FileInfo(outputFile);
                        Console.WriteLine($"[TEST] File size: {fileInfo.Length / 1024} KB");
                    }
                    
                    Console.WriteLine($"\n[TEST] Your C# + Python node with Blender {actualVersion} is working!");
                    Console.WriteLine("Next steps:");
                    Console.WriteLine("1. Run without 'test' argument to start the full service");
                    Console.WriteLine("2. Add more jobs to JobQueueService");
                    Console.WriteLine("3. Connect to your Node.js backend");
                }
                else
                {
                    Console.WriteLine("[TEST] FAILED - Check logs above");
                    Console.WriteLine("\n[Troubleshooting]:");
                    Console.WriteLine($"1. Check if Blender can run manually:");
                    Console.WriteLine($"   \"{_blenderPath}\" --version");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TEST] Error: Test failed with exception: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
            }
            
            Console.WriteLine("\nPress any key to exit...");
            Console.ReadKey();
        }
        
        static async Task<string> GetOrInstallSpecificBlenderAsync(string targetVersion)
        {
            Console.WriteLine($"\n[System] Looking for Blender {targetVersion} installation...");
            
            using var loggerFactory = LoggerFactory.Create(builder =>
            {
                builder.AddConsole();
                builder.SetMinimumLevel(LogLevel.Information);
            });
            
            var logger = loggerFactory.CreateLogger("BlenderFinder");
            
            // Use the improved BlenderFinder
            return await BlenderFinder.FindBlenderAsync(logger, targetVersion);
        }
        
        static async Task<string> GetBlenderVersionAsync(string blenderPath)
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = blenderPath,
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        StandardOutputEncoding = System.Text.Encoding.UTF8
                    }
                };
                
                process.Start();
                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();
                
                return ParseBlenderVersion(output);
            }
            catch
            {
                return "unknown";
            }
        }
        
        private static string ParseBlenderVersion(string output)
        {
            try
            {
                // Typical Blender version output: "Blender 5.0.1"
                var lines = output.Split('\n');
                foreach (var line in lines)
                {
                    if (line.Contains("Blender"))
                    {
                        // Use regex to extract version number
                        var match = Regex.Match(line, @"Blender\s+([\d\.]+)");
                        if (match.Success)
                        {
                            return match.Groups[1].Value.Trim();
                        }
                        
                        // Fallback: split by space and find version-like string
                        var parts = line.Split(' ');
                        foreach (var part in parts)
                        {
                            if (part.Contains('.') && char.IsDigit(part[0]))
                            {
                                return part.Trim();
                            }
                        }
                    }
                }
            }
            catch
            {
                return "unknown";
            }
            
            return "unknown";
        }
        
        static async Task<bool> CheckBlendFileCompatibilityAsync(string blendFile, string blenderPath)
        {
            try
            {
                var version = await GetBlenderVersionAsync(blenderPath);
                Console.WriteLine($"   🔍 Blender version: {version}");
                
                // Note: In a production system, you'd check .blend file version
                // using Blender Python API or file header, but for now we'll just warn
                // if the Blender version seems too old
                if (version.StartsWith("2.") || version.StartsWith("3.0") || version.StartsWith("3.1"))
                {
                    Console.WriteLine($"   ⚠️  Older Blender version ({version}) - some features may not work");
                    return false;
                }
                
                return true;
            }
            catch
            {
                return true; // Assume compatible if we can't check
            }
        }
        
        static async Task RunAsServiceAsync()
        {
            Console.WriteLine($"[System] Starting BlendFarm Node as Service (Blender default 4.5.0)...");
            
            using var loggerFactory = LoggerFactory.Create(builder =>
            {
                builder.AddConsole();
                builder.SetMinimumLevel(LogLevel.Information);
            });
            
            var logger = loggerFactory.CreateLogger<Program>();

            var configLogger = loggerFactory.CreateLogger<ConfigurationManagerService>();
            var configService = new ConfigurationManagerService(configLogger);

            var autoStartLogger = loggerFactory.CreateLogger<AutoStartService>();
            var autoStartService = new AutoStartService(autoStartLogger);

            // Silent Path Refresh: Every time the node starts, if auto-start is enabled, 
            // we refresh the registry key to point to the current location.
            // This handles cases where the user moves the folder to a different drive.
            if (configService.CurrentConfig.Permissions.AutoStart.Granted)
            {
                await autoStartService.RegisterAutoStartAsync();
            }

            if (Environment.UserInteractive)
            {
                var interactiveStartup = new InteractiveStartupService(configService, autoStartService);
                bool proceed = await interactiveStartup.RunStartupInteractiveFlowAsync();
                if (!proceed)
                {
                    return;
                }
            }
            
            // Find or download SPECIFIC VERSION of Blender
            string defaultTargetVersion = "4.5.0";
            _blenderPath = await BlenderFinder.FindBlenderAsync(logger, defaultTargetVersion);
            if (string.IsNullOrEmpty(_blenderPath))
            {
                Console.WriteLine($"[System] Error: Failed to find or install Blender {defaultTargetVersion}. Service cannot start.");
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }
            
            var actualVersion = await GetBlenderVersionAsync(_blenderPath);
            Console.WriteLine($"[System] Using Blender {actualVersion}: {_blenderPath}");
            
            if (actualVersion != defaultTargetVersion)
            {
                Console.WriteLine($"[System] Warning: Using Blender {actualVersion} instead of requested {defaultTargetVersion}");
            }
            
            // Check if Scripts directory exists
            var scriptsDir = Path.Combine(Directory.GetCurrentDirectory(), "Scripts");
            if (!Directory.Exists(scriptsDir))
            {
                Directory.CreateDirectory(scriptsDir);
                Console.WriteLine($"[System] Created Scripts directory: {scriptsDir}");
                
                // Create a simple render script
                File.WriteAllText(Path.Combine(scriptsDir, "render.py"), 
                    "# Render script will be generated automatically");
            }
            // Handle Persistent Friendly Name
            var exePath = Environment.ProcessPath ?? AppDomain.CurrentDomain.BaseDirectory;
            var baseDir = Path.GetDirectoryName(exePath) ?? AppDomain.CurrentDomain.BaseDirectory;
            
            // Ensure appsettings.json exists (David fallback)
            EnsureAppSettingsExists(baseDir);

            var config = new ConfigurationBuilder()
                .SetBasePath(baseDir)
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .Build();

            string currentFriendlyName = config["NodeSettings:FriendlyName"] ?? "node_auto";
            string finalFriendlyName = currentFriendlyName;

            if (currentFriendlyName == "node_auto")
            {
                Console.Write("\n[Config] Enter a friendly name for this node (e.g. 'David-node') or leave empty for auto: ");
                string inputName = Console.ReadLine();
                if (!string.IsNullOrWhiteSpace(inputName))
                {
                    finalFriendlyName = inputName.Trim();
                    SaveFriendlyName(finalFriendlyName);
                    Console.WriteLine($"[Config] Friendly name '{finalFriendlyName}' saved to appsettings.json");
                }
            }

            var identityLogger = loggerFactory.CreateLogger<NodeIdentityService>();
            var identityService = new NodeIdentityService(finalFriendlyName == "node_auto" ? null : finalFriendlyName, identityLogger);
            
            // Try to load existing identity early so background services (like CleanupService) have access to it
            identityService.TryLoadIdentity();

            // Build the host - pass blender path as parameter
           var host = Host.CreateDefaultBuilder()
    .ConfigureServices((context, services) =>
    {
        // Register config service
        services.AddSingleton(configService);
        
        // Register identity service
        services.AddSingleton(identityService);

        // Register AutoStart service
        services.AddSingleton(autoStartService);

        // Register PythonRunnerService
        services.AddSingleton<PythonRunnerService>(provider => 
            new PythonRunnerService(
                provider.GetRequiredService<ILogger<PythonRunnerService>>(), 
                _blenderPath));
        
        // Register NodeBackendService - ILoggerFactory will be auto-injected
        services.AddHostedService<NodeBackendService>();

        // Register CleanupService
        services.AddHostedService<CleanupService>();

        // Register HttpClient
        services.AddHttpClient();
        
        // Configure logging
        services.AddLogging(configure =>
        {
            configure.AddConsole();
            configure.SetMinimumLevel(LogLevel.Information);
        });
    })
    .UseConsoleLifetime()
    .Build();

            Console.WriteLine("[System] Press Ctrl+C to stop the node");
            Console.WriteLine($"[System] Version: 1.0 | Blender: {actualVersion} | .NET 10.0.102");
            Console.WriteLine(new string('-', 50));
            
            await host.RunAsync();
        }

        private static void SaveFriendlyName(string name)
        {
            try
            {
                var exePath = Environment.ProcessPath ?? AppDomain.CurrentDomain.BaseDirectory;
                var baseDir = Path.GetDirectoryName(exePath) ?? AppDomain.CurrentDomain.BaseDirectory;
                var appSettingsPath = Path.Combine(baseDir, "appsettings.json");
                if (!File.Exists(appSettingsPath)) return;

                var json = File.ReadAllText(appSettingsPath);
                dynamic config = Newtonsoft.Json.JsonConvert.DeserializeObject(json);
                
                if (config.NodeSettings == null) config.NodeSettings = new Newtonsoft.Json.Linq.JObject();
                config.NodeSettings.FriendlyName = name;

                string updatedJson = Newtonsoft.Json.JsonConvert.SerializeObject(config, Newtonsoft.Json.Formatting.Indented);
                File.WriteAllText(appSettingsPath, updatedJson);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Config] Error: Failed to save friendly name to appsettings.json: {ex.Message}");
            }
        }

        private static void EnsureAppSettingsExists(string baseDir)
        {
            var appSettingsPath = Path.Combine(baseDir, "appsettings.json");
            if (File.Exists(appSettingsPath)) return;

            try
            {
                Console.WriteLine("[Config] appsettings.json not found. Generating default configuration...");
                var defaultConfig = new
                {
                    Logging = new
                    {
                        LogLevel = new
                        {
                            Default = "Information",
                            Microsoft = "Warning",
                            Microsoft_Hosting_Lifetime = "Information",
                            System_Net_Http_HttpClient = "Warning"
                        }
                    },
                    NodeSettings = new
                    {
                        NodeId = "node_auto",
                        FriendlyName = "node_auto",
                        MaxConcurrentJobs = 1,
                        HeartbeatIntervalSeconds = 30,
                        BlenderPath = "blender",
                        EnableDebugLogging = true,
                        DownloadRetryCount = 3,
                        DownloadTimeoutMinutes = 15
                    },
                    Backend = new
                    {
                        Url = "http://localhost:3000",
                        HealthCheckEndpoint = "/health",
                        ApiTimeoutSeconds = 120,
                        EnableSslVerification = true
                    }
                };

                // Fix dot in keys which dynamic doesn't like well
                string json = Newtonsoft.Json.JsonConvert.SerializeObject(defaultConfig, Newtonsoft.Json.Formatting.Indented)
                    .Replace("Microsoft_Hosting_Lifetime", "Microsoft.Hosting.Lifetime")
                    .Replace("System_Net_Http_HttpClient", "System.Net.Http.HttpClient");

                File.WriteAllText(appSettingsPath, json);
                Console.WriteLine($"[Config] Generated: {appSettingsPath}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Config] Error: Failed to generate default appsettings.json: {ex.Message}");
            }
        }
        
        static async Task CreateTestBlendFileAsync()
        {
            // Your existing CreateTestBlendFileAsync method
            // Keep it as is
        }
    } 
    // Service to hold Blender path
    public class BlenderPathService
    {
        public string BlenderPath { get; }
        public string BlenderVersion { get; }
        
        public BlenderPathService(string blenderPath, string blenderVersion)
        {
            BlenderPath = blenderPath;
            BlenderVersion = blenderVersion;
        }
    }
}