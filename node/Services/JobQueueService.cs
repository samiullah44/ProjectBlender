using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace BlendFarm.Node.Services
{
    public class JobQueueService : IHostedService
    {
        private readonly ILogger<JobQueueService> _logger;
        private readonly PythonRunnerService _pythonRunner;
        private readonly ConcurrentQueue<Models.RenderJob> _jobs = new();
        
        public JobQueueService(
            ILogger<JobQueueService> logger,
            PythonRunnerService pythonRunner)
        {
            _logger = logger;
            _pythonRunner = pythonRunner;
        }
        
        public Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Job Queue Service started");
            return Task.CompletedTask;
        }
        
        public Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Job Queue Service stopped");
            return Task.CompletedTask;
        }
        
        public void EnqueueJob(Models.RenderJob job)
        {
            _jobs.Enqueue(job);
            _logger.LogInformation($"Job {job.JobId} enqueued");
        }
    }
}