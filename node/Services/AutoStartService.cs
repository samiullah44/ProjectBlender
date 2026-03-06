using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using System.IO;

namespace BlendFarm.Node.Services
{
    public class AutoStartService
    {
        private readonly ILogger<AutoStartService> _logger;
        private const string RegistryKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string AppName = "BlendFarmNode";

        public AutoStartService(ILogger<AutoStartService> logger)
        {
            _logger = logger;
        }

        public async Task<bool> RegisterAutoStartAsync()
        {
            try
            {
                // Get the current EXE path
                var exePath = Environment.ProcessPath;
                
                if (string.IsNullOrEmpty(exePath))
                {
                    _logger.LogWarning("[System] Warning: Cannot register auto-start: Process path is null.");
                    return false;
                }

                _logger.LogInformation($"[System] Registering auto-start for: {exePath}");

                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, true))
                {
                    if (key == null)
                    {
                        _logger.LogError("[System] Error: Registry key path not found.");
                        return false;
                    }

                    // Set the value with double quotes to handle paths with spaces
                    key.SetValue(AppName, $"\"{exePath}\"");
                }

                _logger.LogInformation("[System] Auto-start registered successfully in Registry.");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"[System] Error: Failed to register auto-start in registry: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> UnregisterAutoStartAsync()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, true))
                {
                    if (key != null)
                    {
                        key.DeleteValue(AppName, false);
                    }
                }
                _logger.LogInformation("[System] Auto-start unregistered from Registry.");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"[System] Error: Failed to unregister auto-start: {ex.Message}");
                return false;
            }
        }
    }
}
