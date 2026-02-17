using System;
using System.Collections.Generic;

namespace BlendFarm.Node.Models
{
    public class HardwareInfo
    {
        public string NodeId { get; set; }
        public DateTime DetectedAt { get; set; } = DateTime.UtcNow;
        public CpuInfo Cpu { get; set; } = new();
        public RamInfo Ram { get; set; } = new();
        public List<GpuInfo> Gpus { get; set; } = new();
        public StorageInfo Storage { get; set; } = new();
        public OsInfo Os { get; set; } = new();
        public NetworkInfo Network { get; set; } = new();
        public string HardwareFingerprint { get; set; }
    }

    public class CpuInfo
    {
        public string Model { get; set; }               // "Intel(R) Core(TM) i7-12700K"
        public string Manufacturer { get; set; }         // "Intel" or "AMD"
        public int PhysicalCores { get; set; }           // 8
        public int LogicalCores { get; set; }            // 16
        public double BaseClockGHz { get; set; }         // 3.6
        public double MaxClockGHz { get; set; }          // 5.0
        public string Architecture { get; set; }         // "x64"
        public bool SupportsAVX { get; set; }
        public bool SupportsAVX2 { get; set; }
        public bool SupportsSSE41 { get; set; }
        public bool SupportsSSE42 { get; set; }
        public int L2CacheKB { get; set; }
        public int L3CacheKB { get; set; }
    }

    public class RamInfo
{
    public double TotalGB { get; set; }        // Changed from ulong to double
    public double AvailableGB { get; set; }     // Changed from ulong to double
    public ulong TotalMB => (ulong)(TotalGB * 1024);
    public ulong AvailableMB => (ulong)(AvailableGB * 1024);
    public string Type { get; set; }            // "DDR3", "DDR4", "DDR5"
    public int SpeedMHz { get; set; }           // 1600, 3200, 5600 etc.
}


    public class GpuInfo
    {
        public int Index { get; set; }                     // 0, 1, 2...
        public string Model { get; set; }                  // "NVIDIA GeForce RTX 4090"
        public string Vendor { get; set; }                 // "NVIDIA", "AMD", "Intel"
        public ulong VramMB { get; set; }                  // 24576
        public ulong VramFreeMB { get; set; }              // 20000 (approx)
        public string DriverVersion { get; set; }          // "537.42"
        public DateTime DriverDate { get; set; }
        public bool CudaSupported { get; set; }            // true for NVIDIA
        public string CudaVersion { get; set; }            // "12.0"
        public bool OptixSupported { get; set; }           // true for RTX cards
        public bool HipSupported { get; set; }             // true for AMD
        public bool OpenCLSupported { get; set; }          // true for most
        public int ComputeCapability { get; set; }         // 89 for RTX 4090 (8.9)
        public int CoreCount { get; set; }                 // CUDA cores / Stream processors
        public int Temperature { get; set; }                // Current temp (if available)
        public int Utilization { get; set; }                // Current usage %
    }

    public class StorageInfo
    {
        public string DriveLetter { get; set; }            // "C:"
        public ulong TotalGB { get; set; }                  // 1000
        public ulong FreeGB { get; set; }                   // 500
        public ulong FreeMB => FreeGB * 1024;
        public string Type { get; set; }                    // "SSD", "HDD", "NVMe"
        public bool IsSSD => Type.Contains("SSD") || Type.Contains("NVMe");
        public string FileSystem { get; set; }              // "NTFS", "ext4"
        public double ReadSpeedMBs { get; set; }            // 3500 for NVMe
        public double WriteSpeedMBs { get; set; }           // 3000 for NVMe
    }

    public class OsInfo
    {
        public string Name { get; set; }                    // "Windows 11 Pro"
        public string Version { get; set; }                 // "10.0.22621"
        public string Architecture { get; set; }            // "x64"
        public string BuildNumber { get; set; }             // "22621"
        public string Edition { get; set; }                 // "Professional"
        public bool Is64Bit { get; set; } = true;
        public string DotNetVersion { get; set; }           // ".NET 8.0.0"
    }

    public class NetworkInfo
    {
        public double UploadSpeedMbps { get; set; }         // 100.5
        public double DownloadSpeedMbps { get; set; }       // 500.2
        public double LatencyMs { get; set; }               // 25
        public string LocalIP { get; set; }                 // "192.168.1.100"
        public string PublicIP { get; set; }                // "203.0.113.1"
        public string MacAddress { get; set; }              // "00-14-22-01-23-45"
        public string InterfaceName { get; set; }           // "Ethernet"
    }
}