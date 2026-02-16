using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Hardware
{
    public class HardwareDetector
    {
        private readonly ILogger<HardwareDetector> _logger;
        private readonly CpuDetector _cpuDetector;
        private readonly RamDetector _ramDetector;
        private readonly GpuDetector _gpuDetector;
        private readonly StorageDetector _storageDetector;
        private readonly OsDetector _osDetector;
        private readonly NetworkDetector _networkDetector;

        public HardwareDetector(ILogger<HardwareDetector> logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cpuDetector = new CpuDetector(logger);
            _ramDetector = new RamDetector(logger);
            _gpuDetector = new GpuDetector(logger);
            _storageDetector = new StorageDetector(logger);
            _osDetector = new OsDetector(logger);
            _networkDetector = new NetworkDetector(logger);
        }

        public async Task<HardwareInfo> DetectAllAsync(string nodeId, string? serverUrl = null)
        {
            _logger.LogInformation("🔍 Starting complete hardware detection...");
            
            var hardware = new HardwareInfo
            {
                NodeId = nodeId,
                DetectedAt = DateTime.UtcNow
            };

            try
            {
                // Step 1: CPU Detection
                _logger.LogInformation("⚡ Detecting CPU...");
                hardware.Cpu = await _cpuDetector.DetectAsync();
                _logger.LogInformation($"✅ CPU: {hardware.Cpu.Model} ({hardware.Cpu.PhysicalCores}C/{hardware.Cpu.LogicalCores}T @ {hardware.Cpu.BaseClockGHz:F1}GHz)");

                // Step 2: RAM Detection
                _logger.LogInformation("💾 Detecting RAM...");
                hardware.Ram = await _ramDetector.DetectAsync();
                _logger.LogInformation($"✅ RAM: {hardware.Ram.TotalGB}GB total, {hardware.Ram.AvailableGB}GB free ({hardware.Ram.Type} @ {hardware.Ram.SpeedMHz}MHz)");

                // Step 3: GPU Detection
                _logger.LogInformation("🎮 Detecting GPUs...");
                hardware.Gpus = await _gpuDetector.DetectAsync();
                foreach (var gpu in hardware.Gpus)
                {
                    _logger.LogInformation($"✅ GPU {gpu.Index}: {gpu.Model} ({gpu.VramMB}MB VRAM) CUDA:{gpu.CudaSupported} OptiX:{gpu.OptixSupported}");
                }

                // Step 4: Storage Detection
                _logger.LogInformation("💿 Detecting Storage...");
                hardware.Storage = await _storageDetector.DetectAsync();
                _logger.LogInformation($"✅ Storage: {hardware.Storage.TotalGB}GB total, {hardware.Storage.FreeGB}GB free on {hardware.Storage.Type}");

                // Step 5: OS Detection
                _logger.LogInformation("🖥️ Detecting OS...");
                hardware.Os = await _osDetector.DetectAsync();
                _logger.LogInformation($"✅ OS: {hardware.Os.Name} {hardware.Os.Architecture}");

                // Step 6: Network Detection
                if (!string.IsNullOrEmpty(serverUrl))
                {
                    _logger.LogInformation("🌐 Testing network speed (this may take 10-15 seconds)...");
                    hardware.Network = await _networkDetector.DetectAsync(serverUrl);
                    _logger.LogInformation($"✅ Network: ↑{hardware.Network.UploadSpeedMbps:F1} Mbps ↓{hardware.Network.DownloadSpeedMbps:F1} Mbps");
                }

                // Step 7: Generate fingerprint
                hardware.HardwareFingerprint = GenerateFingerprint(hardware);

                _logger.LogInformation("✅ Complete hardware detection finished!");
                return hardware;
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ Hardware detection failed: {ex.Message}");
                throw;
            }
        }

        private string GenerateFingerprint(HardwareInfo hw)
        {
            var components = new[]
            {
                hw.Cpu.Model,
                hw.Cpu.PhysicalCores.ToString(),
                hw.Ram.TotalGB.ToString(),
                string.Join("|", hw.Gpus.Select(g => $"{g.Model}-{g.VramMB}")),
                hw.Storage.DriveLetter,
                hw.Os.Version
            };

            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var hash = sha256.ComputeHash(
                System.Text.Encoding.UTF8.GetBytes(string.Join("|", components))
            );
            
            return Convert.ToBase64String(hash);
        }
    }
}