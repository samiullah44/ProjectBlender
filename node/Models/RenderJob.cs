using System;

namespace BlendFarm.Node.Models
{
    public class RenderJob
    {
        public string JobId { get; set; } = Guid.NewGuid().ToString();
        public string BlendFilePath { get; set; } = string.Empty;
        public int Frame { get; set; } = 1;
        public string OutputPath { get; set; } = string.Empty;
        public DateTime EnqueuedAt { get; set; } = DateTime.UtcNow;
        public JobStatus Status { get; set; } = JobStatus.Pending;
    }

    public enum JobStatus
    {
        Pending,
        Processing,
        Completed,
        Failed
    }
}