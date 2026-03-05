using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Models
{
    [JsonSourceGenerationOptions(
        WriteIndented = true,
        PropertyNamingPolicy = JsonKnownNamingPolicy.Unspecified,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonSerializable(typeof(NodeConfiguration))]
    [JsonSerializable(typeof(JobAssignment))]
    [JsonSerializable(typeof(FrameUploadInfo))]
    [JsonSerializable(typeof(RenderSettings))]
    [JsonSerializable(typeof(UploadUrlResponse))]
    [JsonSerializable(typeof(HardwareInfo))]
    [JsonSerializable(typeof(CpuInfo))]
    [JsonSerializable(typeof(RamInfo))]
    [JsonSerializable(typeof(GpuInfo))]
    [JsonSerializable(typeof(StorageInfo))]
    [JsonSerializable(typeof(OsInfo))]
    [JsonSerializable(typeof(NetworkInfo))]
    [JsonSerializable(typeof(IpInfo))]
    [JsonSerializable(typeof(FingerprintInfo))]
    [JsonSerializable(typeof(FrameCompletionReport))]
    [JsonSerializable(typeof(FrameFailureReport))]
    [JsonSerializable(typeof(RenderConfig[]))]
    public partial class NodeJsonContext : JsonSerializerContext
    {
    }
}
