using System;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Extensions.Logging;

#if WINDOWS
using System.Management;
#endif

namespace BlendFarm.Node.Hardware
{
    /// <summary>
    /// Collects low-level hardware identifiers that form the basis of a
    /// tamper-resistant machine fingerprint: BIOS UUID, motherboard serial,
    /// and boot-disk serial.  All methods handle WMI / platform failures
    /// gracefully and return "Unknown" so the fingerprint always succeeds.
    /// </summary>
    public class FingerprintDetector
    {
        private readonly ILogger _logger;

        public FingerprintDetector(ILogger logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // ─── Public API ───────────────────────────────────────────────────────────

        /// <summary>BIOS / UEFI UUID from Win32_ComputerSystemProduct.UUID</summary>
        public string GetBiosUuid()
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                return GetLinuxBiosUuid();

            var uuid = QueryWmi(
                "SELECT UUID FROM Win32_ComputerSystemProduct",
                "UUID",
                "BIOS UUID");

            if (uuid == "Unknown")
            {
                _logger.LogWarning("⚠️ WMI BIOS UUID failed, trying PowerShell...");
                uuid = RunPowerShellCommand("(Get-CimInstance Win32_ComputerSystemProduct).UUID");
            }

            return uuid;
        }

        /// <summary>Motherboard serial from Win32_BaseBoard.SerialNumber</summary>
        public string GetMotherboardSerial()
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                return "Unknown";

            var serial = QueryWmi(
                "SELECT SerialNumber FROM Win32_BaseBoard",
                "SerialNumber",
                "Motherboard serial");

            if (serial == "Unknown")
            {
                _logger.LogWarning("⚠️ WMI Motherboard serial failed, trying PowerShell...");
                serial = RunPowerShellCommand("(Get-CimInstance Win32_BaseBoard).SerialNumber");
            }

            return serial;
        }

        /// <summary>Boot disk serial from Win32_DiskDrive WHERE Index=0</summary>
        public string GetDiskSerial()
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                return GetLinuxDiskSerial();

            var serial = QueryWmi(
                "SELECT SerialNumber FROM Win32_DiskDrive WHERE Index=0",
                "SerialNumber",
                "Disk serial");

            if (serial == "Unknown")
            {
                _logger.LogWarning("⚠️ WMI Disk serial failed, trying PowerShell...");
                serial = RunPowerShellCommand("(Get-CimInstance Win32_DiskDrive | Where-Object { $_.Index -eq 0 }).SerialNumber");
            }

            return serial;
        }

        /// <summary>
        /// Returns a composite fingerprint string built from all three identifiers,
        /// separated by '|'.  Suitable for feeding into SHA-256.
        /// </summary>
        public string BuildRawComponents()
        {
            var biosUuid        = GetBiosUuid();
            var mbSerial        = GetMotherboardSerial();
            var diskSerial      = GetDiskSerial();

            _logger.LogDebug($"🔏 Fingerprint components → BIOS: {biosUuid} | MB: {mbSerial} | Disk: {diskSerial}");

            return $"{biosUuid}|{mbSerial}|{diskSerial}";
        }

        // ─── Private helpers ──────────────────────────────────────────────────────

        private string RunPowerShellCommand(string command)
        {
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{command}\"",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = System.Diagnostics.Process.Start(psi);
                if (process == null) return "Unknown";

                var output = process.StandardOutput.ReadToEnd().Trim();
                process.WaitForExit(3000);

                if (!string.IsNullOrWhiteSpace(output))
                {
                    _logger.LogInformation($"✅ PowerShell result: {output}");
                    return output;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"PowerShell command failed: {ex.Message}");
            }
            return "Unknown";
        }

        private string QueryWmi(string query, string property, string label)
        {
#if WINDOWS
            try
            {
                using var searcher = new ManagementObjectSearcher(query);
                foreach (ManagementObject obj in searcher.Get())
                {
                    var value = obj[property]?.ToString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(value) &&
                        value != "None" &&
                        value != "Not Specified" &&
                        value != "To be filled by O.E.M." &&
                        value != "Default string")
                    {
                        _logger.LogDebug($"✅ {label}: {value}");
                        return value;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"WMI query failed ({label}): {ex.Message}");
            }
#endif
            return "Unknown";
        }

        private static string GetLinuxBiosUuid()
        {
            // /sys/class/dmi/id/product_uuid (root) or /etc/machine-id (always readable)
            try
            {
                if (System.IO.File.Exists("/sys/class/dmi/id/product_uuid"))
                    return System.IO.File.ReadAllText("/sys/class/dmi/id/product_uuid").Trim();

                if (System.IO.File.Exists("/etc/machine-id"))
                    return System.IO.File.ReadAllText("/etc/machine-id").Trim();
            }
            catch { }
            return "Unknown";
        }

        private static string GetLinuxDiskSerial()
        {
            try
            {
                // hdparm / udevadm not reliably available; use /sys
                var sysBlock = "/sys/block";
                if (System.IO.Directory.Exists(sysBlock))
                {
                    foreach (var dev in System.IO.Directory.GetDirectories(sysBlock))
                    {
                        var serialPath = System.IO.Path.Combine(dev, "device", "serial");
                        if (System.IO.File.Exists(serialPath))
                            return System.IO.File.ReadAllText(serialPath).Trim();
                    }
                }
            }
            catch { }
            return "Unknown";
        }
    }
}
