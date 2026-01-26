using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace BlendFarm.Node.Services
{
    public class NodeHeartbeatService : BackgroundService
    {
        private readonly ILogger<NodeHeartbeatService> _logger;
        
        public NodeHeartbeatService(ILogger<NodeHeartbeatService> logger)
        {
            _logger = logger;
        }
        
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Heartbeat Service started");
            
            while (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("❤️ Heartbeat - Node is alive");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }
    }
}