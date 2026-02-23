using System;
using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Services
{
    public class ConfigurationManagerService
    {
        private readonly ILogger<ConfigurationManagerService> _logger;
        public readonly string ConfigPath = @"C:\ProgramData\RenderFarmNode\config.json";
        public NodeConfiguration CurrentConfig { get; private set; }

        public ConfigurationManagerService(ILogger<ConfigurationManagerService> logger)
        {
            _logger = logger;
            LoadOrInitializeConfig();
        }

        private void LoadOrInitializeConfig()
        {
            try
            {
                var directory = Path.GetDirectoryName(ConfigPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                if (File.Exists(ConfigPath))
                {
                    var json = File.ReadAllText(ConfigPath);
                    CurrentConfig = JsonSerializer.Deserialize(json, NodeConfigurationContext.Default.NodeConfiguration) ?? new NodeConfiguration();
                }
                else
                {
                    CurrentConfig = new NodeConfiguration();
                    SaveConfig();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load or initialize node configuration from {ConfigPath}.", ConfigPath);
                throw;
            }
        }

        public void SaveConfig()
        {
            try
            {
                var json = JsonSerializer.Serialize(CurrentConfig, NodeConfigurationContext.Default.NodeConfiguration);
                File.WriteAllText(ConfigPath, json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save node configuration to {ConfigPath}.", ConfigPath);
                throw;
            }
        }

        public bool AreAllRequiredPermissionsGranted()
        {
            var p = CurrentConfig.Permissions;
            var e = CurrentConfig.EthicalPromise;

            // Check if all permissions and ethical promises are acknowledged
            return p.HardwareProfiling.Granted &&
                   p.SoftwareInstallation.Granted &&
                   p.CpuUsage.Granted &&
                   p.GpuUsage.Granted &&
                   p.NetworkAccess.Granted &&
                   p.AutoStart.Granted &&
                   p.AutoUpdate.Granted &&
                   e.NoCryptoMining &&
                   e.NoPersonalFileAccess &&
                   e.NoWebcamAccess &&
                   e.NoMicrophoneAccess &&
                   e.NoBrowserData &&
                   e.NoHiddenProcesses &&
                   e.NoRegistryTampering &&
                   e.NoDataSelling;
        }
    }
}
