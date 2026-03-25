using System;
using System.Text.Json.Serialization;

namespace BlendFarm.Node.Models
{
    [JsonSerializable(typeof(NodeConfiguration))]
    [JsonSourceGenerationOptions(WriteIndented = true)]
    public partial class NodeConfigurationContext : JsonSerializerContext
    {
    }

    public class NodeConfiguration
    {
        [JsonPropertyName("nodeId")]
        public string NodeId { get; set; } = Guid.NewGuid().ToString();

        [JsonPropertyName("registeredAtUtc")]
        public DateTime RegisteredAtUtc { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("permissions")]
        public PermissionsConfig Permissions { get; set; } = new PermissionsConfig();

        [JsonPropertyName("paths")]
        public PathsConfig Paths { get; set; } = new PathsConfig();

        [JsonPropertyName("server")]
        public ServerConfig Server { get; set; } = new ServerConfig();

        [JsonPropertyName("ethicalPromise")]
        public EthicalPromiseConfig EthicalPromise { get; set; } = new EthicalPromiseConfig();
    }

    public class PermissionsConfig
    {
        [JsonPropertyName("hardwareProfiling")]
        public PermissionEntry HardwareProfiling { get; set; } = new();

        [JsonPropertyName("softwareInstallation")]
        public PermissionEntry SoftwareInstallation { get; set; } = new();

        [JsonPropertyName("cpuUsage")]
        public UsagePermissionEntry CpuUsage { get; set; } = new();

        [JsonPropertyName("gpuUsage")]
        public UsagePermissionEntry GpuUsage { get; set; } = new();

        [JsonPropertyName("networkAccess")]
        public PermissionEntry NetworkAccess { get; set; } = new();

        [JsonPropertyName("autoStart")]
        public PermissionEntry AutoStart { get; set; } = new();

        [JsonPropertyName("autoUpdate")]
        public PermissionEntry AutoUpdate { get; set; } = new();
    }

    public class PermissionEntry
    {
        [JsonPropertyName("granted")]
        public bool Granted { get; set; }

        [JsonPropertyName("grantedAtUtc")]
        public DateTime? GrantedAtUtc { get; set; }
    }

    public class UsagePermissionEntry : PermissionEntry
    {
        [JsonPropertyName("limitPercent")]
        public int LimitPercent { get; set; }
    }

    public class PathsConfig
    {
        [JsonPropertyName("blenderDirectory")]
        public string BlenderDirectory { get; set; } = @"C:\ProgramData\RenderFarmNode\Blender";

        [JsonPropertyName("cacheDirectory")]
        public string CacheDirectory { get; set; } = @"C:\ProgramData\RenderFarmNode\Cache";

        [JsonPropertyName("logDirectory")]
        public string LogDirectory { get; set; } = @"C:\ProgramData\RenderFarmNode\Logs";
    }

    public class ServerConfig
    {
        [JsonPropertyName("heartbeatIntervalSeconds")]
        public int HeartbeatIntervalSeconds { get; set; } = 30;
    }

    public class EthicalPromiseConfig
    {
        [JsonPropertyName("noCryptoMining")]
        public bool NoCryptoMining { get; set; }

        [JsonPropertyName("noPersonalFileAccess")]
        public bool NoPersonalFileAccess { get; set; }

        [JsonPropertyName("noWebcamAccess")]
        public bool NoWebcamAccess { get; set; }

        [JsonPropertyName("noMicrophoneAccess")]
        public bool NoMicrophoneAccess { get; set; }

        [JsonPropertyName("noBrowserData")]
        public bool NoBrowserData { get; set; }

        [JsonPropertyName("noHiddenProcesses")]
        public bool NoHiddenProcesses { get; set; }

        [JsonPropertyName("noRegistryTampering")]
        public bool NoRegistryTampering { get; set; }

        [JsonPropertyName("noDataSelling")]
        public bool NoDataSelling { get; set; }
    }
}
