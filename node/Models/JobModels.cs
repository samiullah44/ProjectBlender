using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BlendFarm.Node.Models
{
    public class JobAssignment
    {
        [JsonProperty("jobId")]
        public string? JobId { get; set; }
        
        [JsonProperty("frames")]
        public List<int>? Frames { get; set; }
        
        [JsonProperty("blendFileUrl")]
        public string? BlendFileUrl { get; set; }
        
        [JsonProperty("frameUploadUrls")]
        public Dictionary<string, FrameUploadInfo>? FrameUploadUrls { get; set; }
        
        [JsonProperty("settings")]
        public RenderSettings? Settings { get; set; }
        
        [JsonProperty("totalFrames")]
        public int? TotalFrames { get; set; }
        
        [JsonProperty("assignedFramesCount")]
        public int? AssignedFramesCount { get; set; }

        [JsonProperty("selectedFrames")]
        public List<int>? SelectedFrames { get; set; }
        
        [JsonProperty("jobProgress")]
        public int? JobProgress { get; set; }
        
        [JsonProperty("isResume")]
        public bool? IsResume { get; set; }
    }

    public class FrameUploadInfo
    {
        [JsonProperty("uploadUrl")]
        public string UploadUrl { get; set; }
        
        [JsonProperty("s3Key")]
        public string S3Key { get; set; }
    }

    public class RenderSettings
    {
        public string? Engine { get; set; }
        public string? Device { get; set; }
        public int Samples { get; set; }
        public int ResolutionX { get; set; }
        public int ResolutionY { get; set; }
        public string? Denoiser { get; set; }
        public int TileSize { get; set; }
        public string? OutputFormat { get; set; } = "PNG";
        public int CreditsPerFrame { get; set; } = 1;
    }

    public class UploadUrlResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("uploadUrl")]
        public string UploadUrl { get; set; }
        
        [JsonProperty("s3Key")]
        public string S3Key { get; set; }
    }
}
