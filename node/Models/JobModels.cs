using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BlendFarm.Node.Models
{
    public class JobAssignment
    {
        [JsonConstructor]
        public JobAssignment() { }

        [JsonPropertyName("jobId")]
        public string? JobId { get; set; }
        
        [JsonPropertyName("frames")]
        public List<int>? Frames { get; set; }
        
        [JsonPropertyName("blendFileUrl")]
        public string? BlendFileUrl { get; set; }
        
        [JsonPropertyName("frameUploadUrls")]
        public Dictionary<string, FrameUploadInfo>? FrameUploadUrls { get; set; }
        
        [JsonPropertyName("settings")]
        public RenderSettings? Settings { get; set; }
        
        [JsonPropertyName("totalFrames")]
        public int? TotalFrames { get; set; }
        
        [JsonPropertyName("assignedFramesCount")]
        public int? AssignedFramesCount { get; set; }

        [JsonPropertyName("selectedFrames")]
        public List<int>? SelectedFrames { get; set; }
        
        [JsonPropertyName("jobProgress")]
        public int? JobProgress { get; set; }
        
        [JsonPropertyName("isResume")]
        public bool? IsResume { get; set; }

        [JsonPropertyName("inputType")]
        public string? InputType { get; set; }
    }

    public class FrameUploadInfo
    {
        [JsonConstructor]
        public FrameUploadInfo() { }

        [JsonPropertyName("uploadUrl")]
        public string UploadUrl { get; set; }
        
        [JsonPropertyName("s3Key")]
        public string S3Key { get; set; }
    }

    public class RenderSettings
    {
        [JsonConstructor]
        public RenderSettings() { }

        [JsonPropertyName("engine")]
        public string? Engine { get; set; }
        
        [JsonPropertyName("device")]
        public string? Device { get; set; }
        
        [JsonPropertyName("samples")]
        public int Samples { get; set; }
        
        [JsonPropertyName("resolutionX")]
        public int ResolutionX { get; set; }
        
        [JsonPropertyName("resolutionY")]
        public int ResolutionY { get; set; }
        
        [JsonPropertyName("denoiser")]
        public string? Denoiser { get; set; }
        
        [JsonPropertyName("tileSize")]
        public int TileSize { get; set; }
        
        [JsonPropertyName("outputFormat")]
        public string? OutputFormat { get; set; } = "PNG";

        [JsonPropertyName("colorMode")]
        public string? ColorMode { get; set; } = "RGBA";

        [JsonPropertyName("colorDepth")]
        public string? ColorDepth { get; set; } = "8";

        [JsonPropertyName("compression")]
        public int Compression { get; set; } = 90;

        [JsonPropertyName("exrCodec")]
        public string? ExrCodec { get; set; } = "ZIP";

        [JsonPropertyName("tiffCodec")]
        public string? TiffCodec { get; set; } = "DEFLATE";

        [JsonPropertyName("scene")]
        public string? Scene { get; set; }

        [JsonPropertyName("camera")]
        public string? Camera { get; set; }

        [JsonPropertyName("creditsPerFrame")]
        public double CreditsPerFrame { get; set; } = 1.0;

        [JsonPropertyName("blenderVersion")]
        public string? BlenderVersion { get; set; } = "4.5.0";
    }

    public class UploadUrlResponse
    {
        [JsonConstructor]
        public UploadUrlResponse() { }

        [JsonPropertyName("success")]
        public bool Success { get; set; }
        
        [JsonPropertyName("uploadUrl")]
        public string UploadUrl { get; set; }
        
        [JsonPropertyName("s3Key")]
        public string S3Key { get; set; }
    }

    public class FrameCompletionReport
    {
        [JsonPropertyName("jobId")]
        public string JobId { get; set; }
        
        [JsonPropertyName("frame")]
        public int Frame { get; set; }
        
        [JsonPropertyName("renderTime")]
        public int RenderTime { get; set; }
        
        [JsonPropertyName("s3Key")]
        public string S3Key { get; set; }
        
        [JsonPropertyName("fileSize")]
        public long FileSize { get; set; }
        
        [JsonPropertyName("nodeId")]
        public string NodeId { get; set; }
        
        [JsonPropertyName("success")]
        public bool Success { get; set; } = true;
    }

    public class FrameFailureReport
    {
        [JsonPropertyName("nodeId")]
        public string NodeId { get; set; }
        
        [JsonPropertyName("jobId")]
        public string JobId { get; set; }
        
        [JsonPropertyName("frame")]
        public int Frame { get; set; }
        
        [JsonPropertyName("error")]
        public string Error { get; set; }
        
        [JsonPropertyName("s3Key")]
        public string? S3Key { get; set; }
    }

    public class RenderConfig
    {
        [JsonConstructor]
        public RenderConfig() { }

        [JsonPropertyName("frame")]
        public int Frame { get; set; }

        [JsonPropertyName("output")]
        public string Output { get; set; }

        [JsonPropertyName("samples")]
        public int Samples { get; set; }

        [JsonPropertyName("engine")]
        public string Engine { get; set; }

        [JsonPropertyName("device")]
        public string Device { get; set; }

        [JsonPropertyName("resolution_x")]
        public int ResolutionX { get; set; }

        [JsonPropertyName("resolution_y")]
        public int ResolutionY { get; set; }

        [JsonPropertyName("output_format")]
        public string OutputFormat { get; set; }

        [JsonPropertyName("color_mode")]
        public string ColorMode { get; set; }

        [JsonPropertyName("color_depth")]
        public string ColorDepth { get; set; }

        [JsonPropertyName("compression")]
        public int Compression { get; set; }

        [JsonPropertyName("exr_codec")]
        public string ExrCodec { get; set; }

        [JsonPropertyName("tiff_codec")]
        public string TiffCodec { get; set; }

        [JsonPropertyName("scene")]
        public string? Scene { get; set; }

        [JsonPropertyName("camera")]
        public string? Camera { get; set; }

        [JsonPropertyName("denoiser")]
        public string Denoiser { get; set; }

        [JsonPropertyName("tile_size")]
        public int TileSize { get; set; }

        [JsonPropertyName("use_animation_settings")]
        public bool UseAnimationSettings { get; set; }
    }
}
