using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.Net.Http;
using System.IO.Compression;
using Newtonsoft.Json;
using Microsoft.Extensions.Logging;

namespace BlendFarm.Node.Services
{
    public class PythonRunnerService
    {
        private readonly ILogger<PythonRunnerService> _logger;
        private readonly string _scriptsDirectory;
        private string _blenderPath;
        
        public PythonRunnerService(ILogger<PythonRunnerService> logger)
        {
            _logger = logger;
            _scriptsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Scripts");
            _blenderPath = "blender";
            
            Directory.CreateDirectory(_scriptsDirectory);
            _logger.LogInformation($"📁 Scripts directory: {_scriptsDirectory}");
        }
        
        /// <summary>
        /// Gets the current Blender path
        /// </summary>
        public string GetBlenderPath()
        {
            return _blenderPath;
        }
        
        /// <summary>
        /// Allows setting Blender path externally
        /// </summary>
        public void SetBlenderPath(string blenderPath)
        {
            if (!string.IsNullOrEmpty(blenderPath) && (File.Exists(blenderPath) || blenderPath == "blender"))
            {
                _blenderPath = blenderPath;
                _logger.LogInformation($"🎬 Blender path updated to: {blenderPath}");
            }
        }
        
        public PythonRunnerService(ILogger<PythonRunnerService> logger, string blenderPath)
        {
            _logger = logger;
            _scriptsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Scripts");
            _blenderPath = blenderPath;
            
            Directory.CreateDirectory(_scriptsDirectory);
            _logger.LogInformation($"📁 Scripts directory: {_scriptsDirectory}");
            _logger.LogInformation($"🎬 Using Blender at: {_blenderPath}");
        }
        
        /// <summary>
        /// Run Blender render using Python script - UPDATED for both animation and image rendering
        /// </summary>
        public async Task<bool> RunRenderAsync(
            string blendFilePath, 
            int frame, 
            string outputPath,
            int samples = 30,
            string engine = "CYCLES",
            string device = "GPU",
            int resolutionX = 1920,
            int resolutionY = 1080,
            string outputFormat = "PNG",
            bool useAnimationSettings = false,
            CancellationToken cancellationToken = default)
        {
            try
            {
                _logger.LogInformation($"🎬 Starting render: {Path.GetFileName(blendFilePath)} Frame {frame}");
                _logger.LogInformation($"⚙️  Settings: {samples} samples, {engine}, {device}, {resolutionX}x{resolutionY}, Format: {outputFormat}");
                _logger.LogInformation($"📽️  Mode: {(useAnimationSettings ? "Animation" : "Single Frame")}");
                
                // Get or install Blender if needed
                var blenderExe = await GetOrInstallBlenderAsync();
                if (string.IsNullOrEmpty(blenderExe))
                {
                    _logger.LogError("❌ Failed to get Blender installation");
                    return false;
                }
                
                _logger.LogInformation($"🎬 Using Blender: {blenderExe}");
                
                // Get absolute output path
                var absoluteOutputPath = GetAbsoluteOutputPath(outputPath);
                _logger.LogInformation($"📁 Output will be saved to: {absoluteOutputPath}");
                
                // Check if output directory exists
                var outputDir = Path.GetDirectoryName(absoluteOutputPath);
                if (!Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                    _logger.LogInformation($"📁 Created output directory: {outputDir}");
                }
                
                // Create Python script dynamically
                var pythonScript = await CreatePythonScriptAsync();
                
                // Run Blender directly with Python script
                return await RunBlenderWithPythonAsync(
                    blenderExe, 
                    blendFilePath, 
                    frame, 
                    absoluteOutputPath,
                    pythonScript,
                    samples,
                    engine,
                    device,
                    resolutionX,
                    resolutionY,
                    outputFormat,
                    useAnimationSettings,
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Render was cancelled");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error during render");
                return false;
            }
        }

        private async Task<bool> RunBlenderWithPythonAsync(
            string blenderExe, 
            string blendFile, 
            int frame, 
            string outputPath,
            string pythonScript,
            int samples,
            string engine,
            string device,
            int resolutionX,
            int resolutionY,
            string outputFormat,
            bool useAnimationSettings,
            CancellationToken cancellationToken)
        {
            // Create config file with proper settings from parameters
            var config = new[]
            {
                new
                {
                    frame = frame,
                    output = outputPath,
                    samples = samples,
                    engine = engine,
                    device = device,
                    resolution_x = resolutionX,
                    resolution_y = resolutionY,
                    output_format = outputFormat,
                    use_animation_settings = useAnimationSettings
                }
            };
            
            var tempConfig = Path.GetTempFileName();
            tempConfig = Path.ChangeExtension(tempConfig, ".json");
            File.WriteAllText(tempConfig, JsonConvert.SerializeObject(config, Formatting.Indented));
            
            _logger.LogInformation($"📝 Created config file: {tempConfig}");
            _logger.LogDebug($"⚙️  Config: {File.ReadAllText(tempConfig)}");
            
            try
            {
                // Use correct Blender command line format
                var arguments = $"-b \"{blendFile}\" -P \"{pythonScript}\" -- \"{tempConfig}\"";
                
                _logger.LogInformation($"🚀 Command: {blenderExe} {arguments}");
                
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = blenderExe,
                        Arguments = arguments,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WorkingDirectory = Path.GetDirectoryName(blendFile) ?? Directory.GetCurrentDirectory(),
                        StandardOutputEncoding = Encoding.UTF8,
                        StandardErrorEncoding = Encoding.UTF8
                    }
                };
                
                var outputBuilder = new StringBuilder();
                var errorBuilder = new StringBuilder();
                var hasError = false;
                var processExited = false;
                
                process.OutputDataReceived += (sender, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        outputBuilder.AppendLine(e.Data);
                        _logger.LogDebug($"🎬 Output: {e.Data}");
                        
                        // Check for specific messages
                        if (e.Data.Contains("ERROR") || e.Data.Contains("Error:"))
                        {
                            hasError = true;
                            _logger.LogError($"🔴 {e.Data}");
                        }
                        else if (e.Data.Contains("SUCCESS") || e.Data.Contains("Saved:"))
                        {
                            _logger.LogInformation($"✅ {e.Data}");
                        }
                        else if (e.Data.Contains("Sample") || e.Data.Contains("Rendering") || e.Data.Contains("Time:"))
                        {
                            _logger.LogInformation($"⏳ {e.Data}");
                        }
                    }
                };
                
                process.ErrorDataReceived += (sender, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        errorBuilder.AppendLine(e.Data);
                        _logger.LogDebug($"🔴 Error: {e.Data}");
                        
                        if (!e.Data.Contains("Warning: region type"))
                        {
                            hasError = true;
                        }
                    }
                };
                
                process.Exited += (sender, e) =>
                {
                    processExited = true;
                    _logger.LogDebug("Blender process exited");
                };
                
                _logger.LogInformation("Starting Blender process...");
                
                if (!process.Start())
                {
                    _logger.LogError("Failed to start Blender process");
                    return false;
                }
                
                _logger.LogInformation($"Blender process started with ID: {process.Id}");
                
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                
                // Calculate timeout based on samples and device
                // More sophisticated timeout calculation
                var baseTimeout = device.ToUpper() == "GPU" ? 30 : 120; // seconds per sample
                var timeoutSeconds = Math.Max(30, samples * (baseTimeout / 10)); // Scale with samples
                
                // Add extra time for high resolutions
                var resolutionFactor = (resolutionX * resolutionY) / (1920 * 1080.0);
                timeoutSeconds = (int)(timeoutSeconds * Math.Max(1.0, resolutionFactor * 0.5));
                
                var timeout = TimeSpan.FromSeconds(timeoutSeconds);
                _logger.LogInformation($"⏱️  Timeout set to: {timeout.TotalSeconds} seconds (samples: {samples}, resolution: {resolutionX}x{resolutionY})");
                
                try
                {
                    // Wait for process to exit with timeout
                    var processTask = Task.Run(() => 
                    {
                        process.WaitForExit();
                        return process.ExitCode;
                    }, cancellationToken);
                    
                    var timeoutTask = Task.Delay(timeout, cancellationToken);
                    
                    var completedTask = await Task.WhenAny(processTask, timeoutTask);
                    
                    if (completedTask == timeoutTask)
                    {
                        _logger.LogError($"⚠️  Render timeout after {timeout.TotalSeconds} seconds");
                        
                        if (!process.HasExited)
                        {
                            _logger.LogWarning("Killing Blender process...");
                            try
                            {
                                process.Kill(true);
                                await Task.Delay(1000);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogDebug($"Error killing process: {ex.Message}");
                            }
                        }
                        
                        return false;
                    }
                    
                    var exitCode = await processTask;
                    
                    // Give time for all output to be captured
                    await Task.Delay(500);
                    
                    _logger.LogInformation($"📊 Blender process exited with code: {exitCode}");
                    
                    if (exitCode == 0 && !hasError)
                    {
                        _logger.LogInformation($"✅ Blender render completed successfully");
                        
                        // Check output file
                        if (File.Exists(outputPath))
                        {
                            var fileInfo = new FileInfo(outputPath);
                            _logger.LogInformation($"📊 Output file created: {fileInfo.FullName} ({fileInfo.Length / 1024} KB)");
                            return true;
                        }
                        else
                        {
                            // Try to find output in alternative locations
                            _logger.LogWarning($"⚠️  Output file not found at expected location: {outputPath}");
                            
                            // Check for any output file in output directory
                            var outputDir = Path.GetDirectoryName(outputPath);
                            if (Directory.Exists(outputDir))
                            {
                                // Check for numbered frames
                                var baseName = Path.GetFileNameWithoutExtension(outputPath);
                                var fileExt = Path.GetExtension(outputPath);
                                
                                // Try various patterns based on format
                                string[] patterns = outputFormat.ToUpper() switch
                                {
                                    "PNG" => new[] { $"*{frame:0000}*.png", "*.png" },
                                    "JPEG" or "JPG" => new[] { $"*{frame:0000}*.jpg", $"*{frame:0000}*.jpeg", "*.jpg", "*.jpeg" },
                                    "EXR" => new[] { $"*{frame:0000}*.exr", "*.exr" },
                                    _ => new[] { $"*{frame:0000}*.*", "*.*" }
                                };
                                
                                foreach (var pattern in patterns)
                                {
                                    var outputFiles = Directory.GetFiles(outputDir, pattern, SearchOption.TopDirectoryOnly);
                                    if (outputFiles.Length > 0)
                                    {
                                        var foundFile = outputFiles[0];
                                        _logger.LogInformation($"📊 Found output file: {foundFile}");
                                        
                                        // If it's not already the expected name, copy it
                                        if (!foundFile.Equals(outputPath, StringComparison.OrdinalIgnoreCase))
                                        {
                                            File.Copy(foundFile, outputPath, true);
                                            _logger.LogInformation($"📋 Copied to expected location: {outputPath}");
                                        }
                                        return true;
                                    }
                                }
                            }
                            
                            _logger.LogError($"❌ Output file not found anywhere");
                            return false;
                        }
                    }
                    else
                    {
                        _logger.LogError($"❌ Blender failed with exit code: {exitCode}");
                        
                        // Log captured output for debugging
                        if (outputBuilder.Length > 0)
                        {
                            var output = outputBuilder.ToString();
                            var lastLines = output.Split('\n').TakeLast(20).ToArray();
                            _logger.LogDebug($"Last 20 lines of output:\n{string.Join("\n", lastLines)}");
                        }
                        
                        return false;
                    }
                }
                catch (TaskCanceledException)
                {
                    _logger.LogWarning("Render was cancelled");
                    
                    if (!process.HasExited)
                    {
                        try
                        {
                            process.Kill(true);
                        }
                        catch { }
                    }
                    
                    return false;
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Render process error: {ex.Message}");
                    return false;
                }
            }
            finally
            {
                // Clean up temp file
                try
                {
                    if (File.Exists(tempConfig))
                        File.Delete(tempConfig);
                }
                catch { }
            }
        }

        private async Task<string> CreatePythonScriptAsync()
        {
            var scriptPath = Path.Combine(_scriptsDirectory, "render_frame.py");
            
            // Always create/update script to ensure we have latest version
            Directory.CreateDirectory(_scriptsDirectory);
            
            // ENHANCED: Python script that respects all backend settings for both animation and image
            var pythonScript = @"
import bpy
import sys
import os
import json
import time

print('=== BlendFarm Render Script Started ===')

# Find config file from arguments
config_file = None
for i, arg in enumerate(sys.argv):
    if arg == '--' and i + 1 < len(sys.argv):
        config_file = sys.argv[i + 1]
        break

if not config_file or not os.path.exists(config_file):
    print('ERROR: No valid config file provided')
    print(f'Arguments: {sys.argv}')
    sys.exit(1)

print(f'Config file: {config_file}')

# Read config
with open(config_file, 'r') as f:
    config_data = json.load(f)

if isinstance(config_data, list) and len(config_data) > 0:
    config = config_data[0]
else:
    config = config_data

frame_num = config.get('frame', 1)
output_path = config.get('output', '//output.png')
samples = config.get('samples', 30)
engine = config.get('engine', 'CYCLES').upper()
device_type = config.get('device', 'GPU').upper()
resolution_x = config.get('resolution_x', 1920)
resolution_y = config.get('resolution_y', 1080)
output_format = config.get('output_format', 'PNG').upper()
use_animation_settings = config.get('use_animation_settings', False)

print(f'=== Render Settings ===')
print(f'  Frame: {frame_num}')
print(f'  Output: {output_path}')
print(f'  Samples: {samples}')
print(f'  Engine: {engine}')
print(f'  Device: {device_type}')
print(f'  Resolution: {resolution_x}x{resolution_y}')
print(f'  Format: {output_format}')
print(f'  Animation Mode: {use_animation_settings}')

# Apply ALL settings
scene = bpy.context.scene
scene.frame_set(frame_num)

# Set engine and device - FIXED: No conflicting overrides
if engine == 'CYCLES':
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    
    # Set denoising if available and if samples are high
    if samples >= 32:
        try:
            scene.cycles.use_denoising = True
            scene.cycles.denoiser = 'OPENIMAGEDENOISE'
            print('Enabled denoising with OpenImageDenoise')
        except:
            try:
                scene.cycles.use_denoising = True
                print('Enabled denoising (fallback)')
            except:
                print('Could not enable denoising')
    
    # FIXED: Use device from config
    if device_type == 'GPU':
        try:
            # Try to enable GPU devices
            import addon_utils
            addon_utils.enable('cycles')
            
            # Set compute device type
            if hasattr(bpy.context.preferences.addons['cycles'], 'preferences'):
                prefs = bpy.context.preferences.addons['cycles'].preferences
                
                # Try CUDA first, then OPTIX, then CPU
                for compute_device_type in ['CUDA', 'OPTIX', 'CPU']:
                    try:
                        prefs.compute_device_type = compute_device_type
                        print(f'Trying compute device type: {compute_device_type}')
                        break
                    except:
                        continue
                
                # Refresh and enable devices
                prefs.get_devices()
                for device in prefs.devices:
                    device.use = True
                    print(f'Enabled device: {device.name}')
            
            scene.cycles.device = 'GPU'
            print('GPU rendering enabled')
        except Exception as e:
            print(f'Failed to initialize GPU: {e}')
            print('Falling back to CPU rendering')
            scene.cycles.device = 'CPU'
    else:
        scene.cycles.device = 'CPU'
        print('CPU rendering enabled as configured')
        
elif engine == 'EEVEE':
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = samples
    print(f'Eevee engine with {samples} samples')

# Set resolution
scene.render.resolution_x = resolution_x
scene.render.resolution_y = resolution_y
scene.render.resolution_percentage = 100

# Set animation settings if needed
if use_animation_settings:
    # Ensure we're not using animation frames for single frame renders
    scene.frame_start = frame_num
    scene.frame_end = frame_num
    scene.frame_current = frame_num
    print(f'Animation settings: Frame range {frame_num}-{frame_num}')

# Set output path
if output_path.startswith('//'):
    output_path = os.path.join(os.path.dirname(bpy.data.filepath), output_path[2:])
output_path = os.path.abspath(output_path)

# Ensure directory exists
output_dir = os.path.dirname(output_path)
if not os.path.exists(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    print(f'Created directory: {output_dir}')

# Set render output and format
scene.render.filepath = output_path

# Set output format based on configuration
format_settings = scene.render.image_settings
if output_format == 'PNG':
    format_settings.file_format = 'PNG'
    format_settings.color_mode = 'RGBA'
    format_settings.color_depth = '16'  # 16-bit PNG for better quality
    format_settings.compression = 90    # High compression
elif output_format == 'JPEG' or output_format == 'JPG':
    format_settings.file_format = 'JPEG'
    format_settings.color_mode = 'RGB'
    format_settings.quality = 95        # High quality JPEG
elif output_format == 'EXR':
    format_settings.file_format = 'OPEN_EXR'
    format_settings.color_mode = 'RGBA'
    format_settings.color_depth = '32'
    format_settings.exr_codec = 'ZIP'   # Compressed EXR
elif output_format == 'TIFF':
    format_settings.file_format = 'TIFF'
    format_settings.color_mode = 'RGBA'
    format_settings.color_depth = '16'
    format_settings.tiff_codec = 'DEFLATE'  # Compressed TIFF
else:
    format_settings.file_format = 'PNG'
    format_settings.color_mode = 'RGBA'
    print(f'Warning: Unknown format {output_format}, defaulting to PNG')

print(f'Output format set to: {format_settings.file_format}')

print('=== Starting Render ===')

try:
    start_time = time.time()
    
    # Determine if we need to render animation or single frame
    if use_animation_settings and frame_num != scene.frame_current:
        # For true animation rendering across frames
        print(f'Rendering animation frames {scene.frame_start}-{scene.frame_end}')
        scene.frame_set(frame_num)
        bpy.ops.render.render(write_still=True, animation=False)
    else:
        # Single frame render
        print(f'Rendering single frame {frame_num}')
        bpy.ops.render.render(write_still=True, animation=False)
    
    end_time = time.time()
    
    print(f'=== Render Completed ===')
    print(f'Render time: {end_time - start_time:.2f} seconds')
    
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        print(f'SUCCESS: File saved successfully')
        print(f'File size: {file_size} bytes ({file_size/1024:.1f} KB)')
        print(f'Location: {output_path}')
        sys.exit(0)
    else:
        print(f'ERROR: File not found at: {output_path}')
        # Check what files were actually created
        if os.path.exists(output_dir):
            created_files = os.listdir(output_dir)
            print(f'Files in output directory: {created_files}')
            
            # Try to find any recently created image files
            for filename in created_files:
                if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.exr', '.tiff', '.tif')):
                    print(f'Found potential output file: {filename}')
                    # Check if it contains our frame number
                    if str(frame_num) in filename:
                        found_path = os.path.join(output_dir, filename)
                        print(f'Found matching file: {found_path}')
                        # Copy to expected location
                        os.rename(found_path, output_path)
                        print(f'Moved to expected location: {output_path}')
                        if os.path.exists(output_path):
                            sys.exit(0)
        
        sys.exit(1)
        
except Exception as e:
    print(f'ERROR during render: {str(e)}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
";
    
            await File.WriteAllTextAsync(scriptPath, pythonScript);
            _logger.LogInformation($"📝 Created/Updated Python script: {scriptPath}");
            
            return scriptPath;
        }

        /// <summary>
        /// Get or install Blender automatically
        /// </summary>
        private async Task<string> GetOrInstallBlenderAsync()
        {
            // 1. First check if a specific path was provided and it exists
            if (!string.IsNullOrEmpty(_blenderPath) && _blenderPath != "blender")
            {
                if (File.Exists(_blenderPath))
                {
                    _logger.LogInformation($"✅ Using provided Blender path: {_blenderPath}");
                    return _blenderPath;
                }
            }
            
            _logger.LogInformation("🔍 Looking for Blender installation...");
            
            // 2. Check current directory for Blender installation
            var currentDirBlender = FindBlenderInCurrentDirectory();
            if (!string.IsNullOrEmpty(currentDirBlender))
            {
                _logger.LogInformation($"✅ Found Blender in current directory: {currentDirBlender}");
                return currentDirBlender;
            }
            
            // 3. Check system PATH
            var pathBlender = await FindBlenderInPathAsync();
            if (!string.IsNullOrEmpty(pathBlender))
            {
                _logger.LogInformation($"✅ Found Blender in PATH: {pathBlender}");
                return pathBlender;
            }
            
            // 4. Check Windows Registry for installed Blender (Windows-only)
            if (OperatingSystem.IsWindows())
            {
                var installedBlender = FindInstalledBlenderInRegistry();
                if (!string.IsNullOrEmpty(installedBlender))
                {
                    _logger.LogInformation($"✅ Found Blender via Registry: {installedBlender}");
                    return installedBlender;
                }
            }
            
            // 5. Check common installation directories
            var commonBlender = FindBlenderInCommonLocations();
            if (!string.IsNullOrEmpty(commonBlender))
            {
                _logger.LogInformation($"✅ Found Blender in common location: {commonBlender}");
                return commonBlender;
            }
            
            // 6. Download to current directory
            _logger.LogWarning("⚠️  Blender not found. Downloading to current directory...");
            return await DownloadBlenderToCurrentDirectoryAsync();
        }
        
        private bool TestBlenderExecutable(string blenderPath)
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
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                
                process.Start();
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit(5000);
                
                return process.ExitCode == 0 && output.Contains("Blender");
            }
            catch
            {
                return false;
            }
        }
        
        private async Task<string> FindBlenderInPathAsync()
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
                        CreateNoWindow = true
                    }
                };
                
                process.Start();
                await process.WaitForExitAsync();
                
                if (process.ExitCode == 0)
                {
                    return "blender";
                }
            }
            catch { }
            
            return null;
        }
        
        private string FindBlenderInCurrentDirectory()
        {
            try
            {
                var currentDir = Directory.GetCurrentDirectory();
                
                // Check for blender.exe in current directory
                var blenderExe = Path.Combine(currentDir, "blender.exe");
                if (File.Exists(blenderExe))
                {
                    if (TestBlenderExecutable(blenderExe))
                        return blenderExe;
                }
                
                // Check for Blender directory in current directory
                var blenderDir = Path.Combine(currentDir, "Blender");
                if (Directory.Exists(blenderDir))
                {
                    // Look for blender.exe in Blender directory
                    blenderExe = Path.Combine(blenderDir, "blender.exe");
                    if (File.Exists(blenderExe) && TestBlenderExecutable(blenderExe))
                        return blenderExe;
                    
                    // Search recursively in Blender directory
                    var blenderExes = Directory.GetFiles(blenderDir, "blender.exe", SearchOption.AllDirectories);
                    foreach (var exe in blenderExes)
                    {
                        if (TestBlenderExecutable(exe))
                            return exe;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"Error searching current directory: {ex.Message}");
            }
            
            return null;
        }
        
        private string FindInstalledBlenderInRegistry()
        {
            if (!OperatingSystem.IsWindows())
                return null;
                
            try
            {
                var registryPaths = new[]
                {
                    @"SOFTWARE\Blender Foundation\Blender",
                    @"SOFTWARE\WOW6432Node\Blender Foundation\Blender"
                };
                
                foreach (var registryPath in registryPaths)
                {
                    try
                    {
                        using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(registryPath))
                        {
                            if (key != null)
                            {
                                var subKeyNames = key.GetSubKeyNames();
                                foreach (var subKeyName in subKeyNames.OrderByDescending(x => x))
                                {
                                    using (var subKey = key.OpenSubKey(subKeyName))
                                    {
                                        if (subKey != null)
                                        {
                                            var path = subKey.GetValue("InstallPath") as string;
                                            
                                            if (!string.IsNullOrEmpty(path))
                                            {
                                                var blenderExe = Path.Combine(path, "blender.exe");
                                                if (File.Exists(blenderExe) && TestBlenderExecutable(blenderExe))
                                                    return blenderExe;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                }
            }
            catch { }
            
            return null;
        }
        
        private string FindBlenderInCommonLocations()
        {
            var possiblePaths = new[]
            {
                @"C:\Program Files\Blender Foundation\Blender",
                @"C:\Program Files (x86)\Blender Foundation\Blender",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Blender Foundation", "Blender"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Blender Foundation", "Blender"),
                Path.Combine(Directory.GetCurrentDirectory(), "Blender")
            };
            
            foreach (var basePath in possiblePaths)
            {
                if (Directory.Exists(basePath))
                {
                    try
                    {
                        // Check directly for blender.exe
                        var blenderExe = Path.Combine(basePath, "blender.exe");
                        if (File.Exists(blenderExe) && TestBlenderExecutable(blenderExe))
                            return blenderExe;
                        
                        // Search subdirectories
                        var blenderExes = Directory.GetFiles(basePath, "blender.exe", SearchOption.AllDirectories);
                        foreach (var exe in blenderExes)
                        {
                            if (TestBlenderExecutable(exe))
                                return exe;
                        }
                    }
                    catch { }
                }
            }
            
            return null;
        }
        
        private async Task<string> DownloadBlenderToCurrentDirectoryAsync(string version = "4.1.1")
        {
            var currentDir = Directory.GetCurrentDirectory();
            var downloadDir = Path.Combine(currentDir, "Blender");
            
            // Check if already downloaded
            var existingBlender = FindBlenderInDirectory(downloadDir);
            if (!string.IsNullOrEmpty(existingBlender) && TestBlenderExecutable(existingBlender))
            {
                _logger.LogInformation($"✅ Found existing Blender installation: {existingBlender}");
                return existingBlender;
            }
            
            var downloadUrl = $"https://download.blender.org/release/Blender{version.Substring(0, 3)}/blender-{version}-windows-x64.zip";
            var tempZip = Path.Combine(Path.GetTempPath(), $"blender-{version}.zip");
            
            try
            {
                _logger.LogInformation($"📥 Downloading Blender {version}...");
                
                using (var httpClient = new HttpClient())
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(15);
                    using (var stream = await httpClient.GetStreamAsync(downloadUrl))
                    using (var fileStream = new FileStream(tempZip, FileMode.Create))
                    {
                        await stream.CopyToAsync(fileStream);
                    }
                }
                
                Directory.CreateDirectory(downloadDir);
                
                _logger.LogInformation($"📦 Extracting Blender...");
                
                ZipFile.ExtractToDirectory(tempZip, downloadDir, overwriteFiles: true);
                
                File.Delete(tempZip);
                
                var blenderExe = FindBlenderInDirectory(downloadDir);
                
                if (!string.IsNullOrEmpty(blenderExe))
                {
                    _logger.LogInformation($"✅ Blender {version} installed to: {blenderExe}");
                    return blenderExe;
                }
                else
                {
                    _logger.LogError($"❌ Could not find blender.exe after extraction");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Failed to download/install Blender: {ex.Message}");
            }
            
            return null;
        }
        
        private string FindBlenderInDirectory(string directory)
        {
            if (!Directory.Exists(directory))
                return null;
            
            try
            {
                var blenderExes = Directory.GetFiles(directory, "blender.exe", SearchOption.AllDirectories);
                return blenderExes.FirstOrDefault();
            }
            catch
            {
                return null;
            }
        }
        
        private string GetAbsoluteOutputPath(string outputPath)
        {
            if (Path.IsPathRooted(outputPath))
                return outputPath;
            
            return Path.Combine(Directory.GetCurrentDirectory(), outputPath);
        }
    }
    
    // Extension method for async process waiting
    public static class ProcessExtensions
    {
        public static Task WaitForExitAsync(this Process process, CancellationToken cancellationToken = default)
        {
            var tcs = new TaskCompletionSource<bool>();
            process.EnableRaisingEvents = true;
            process.Exited += (sender, args) => tcs.TrySetResult(true);
            
            if (cancellationToken != default)
            {
                cancellationToken.Register(() => tcs.TrySetCanceled());
            }
            
            return process.HasExited ? Task.CompletedTask : tcs.Task;
        }
    }
}