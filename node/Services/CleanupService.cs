using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

namespace BlendFarm.Node.Services
{
    public class CleanupService : BackgroundService
    {
        private readonly ILogger<CleanupService> _logger;
        private readonly NodeIdentityService _identityService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _backendUrl;
        private readonly string _baseJobDirectory;
        private readonly string _baseCacheDirectory;

        public CleanupService(
            ILogger<CleanupService> logger,
            NodeIdentityService identityService,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _logger = logger;
            _identityService = identityService;
            _httpClientFactory = httpClientFactory;
            _backendUrl = configuration["Backend:Url"] ?? "http://localhost:3000";
            _baseJobDirectory = Path.Combine(Path.GetTempPath(), "BlendFarm", "Jobs");
            _baseCacheDirectory = Path.Combine(Path.GetTempPath(), "BlendFarm", "Cache");

            _logger.LogInformation("[System] Cleanup Service initialized.\n   Jobs: {JobsPath}\n   Cache: {CachePath}", _baseJobDirectory, _baseCacheDirectory);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[System] Cleanup Service starting...");

            // Wait a short bit on startup to allow NodeBackendService to complete registration/identity loading
            await Task.Delay(TimeSpan.FromSeconds(50), stoppingToken);

            // Initial cleanup on startup
            try
            {
                await PerformCleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[System] Error: Initial cleanup cycle failed");
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                // Run every 1 hour
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);

                try
                {
                    await PerformCleanupAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[System] Error: Error during cleanup cycle");
                }
            }
        }

        private async Task PerformCleanupAsync(CancellationToken stoppingToken)
        {
            if (!_identityService.IsRegistered)
            {
                _logger.LogWarning("[System] Warning: Node is not yet registered with an identity. Skipping cleanup to avoid Unauthorized errors.");
                return;
            }

            _logger.LogInformation("[System] Starting scheduled cleanup cycle...");

            // Cleanup Jobs
            if (Directory.Exists(_baseJobDirectory))
            {
                var jobDirectories = Directory.GetDirectories(_baseJobDirectory);
                _logger.LogInformation("[System] Checking {Count} job directories in {Path}...", jobDirectories.Length, _baseJobDirectory);

                foreach (var dir in jobDirectories)
                {
                    if (stoppingToken.IsCancellationRequested) break;

                    try
                    {
                        await ProcessJobDirectoryAsync(dir, stoppingToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[System] Warning: Failed to process job directory {Dir} for cleanup", dir);
                    }
                }
            }

            // Cleanup Cache
            if (Directory.Exists(_baseCacheDirectory))
            {
                var cachedFiles = Directory.GetFiles(_baseCacheDirectory, "blendfile_*.blend");
                _logger.LogInformation("[System] Checking {Count} cached blend files in {Path}...", cachedFiles.Length, _baseCacheDirectory);

                foreach (var file in cachedFiles)
                {
                    if (stoppingToken.IsCancellationRequested) break;

                    try
                    {
                        await ProcessCachedFileAsync(file, stoppingToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[System] Warning: Failed to process cached file {File} for cleanup", file);
                    }
                }
            }
            
            _logger.LogInformation("[System] Cleanup cycle complete.");
        }

        private async Task ProcessJobDirectoryAsync(string directoryPath, CancellationToken stoppingToken)
        {
            var jobId = Path.GetFileName(directoryPath);
            var dirInfo = new DirectoryInfo(directoryPath);
            var age = DateTime.UtcNow - dirInfo.LastWriteTimeUtc;

            // Strict policy: Only clean up if >= 2 hours old
            if (age.TotalHours < 2)
            {
                _logger.LogInformation("[System] Skipping job folder {JobId}: too new ({Age:F1} hours old, threshold is 2.0)", jobId, age.TotalHours);
                return;
            }

            _logger.LogInformation("[System] Verifying status for 2h+ old job: {JobId}...", jobId);
            bool isFinished = await IsJobFinishedAsync(jobId, stoppingToken);

            if (isFinished)
            {
                _logger.LogInformation("[System] Deleting job folder: {JobId} (Age: {Age:F1} hours)", jobId, age.TotalHours);
                try { Directory.Delete(directoryPath, true); } catch (Exception ex) { _logger.LogWarning("Failed to delete {Dir}: {Msg}", directoryPath, ex.Message); }
            }
            else
            {
                _logger.LogInformation("[System] Job {JobId} is still active on backend, keeping associated files.", jobId);
            }
        }

        private async Task ProcessCachedFileAsync(string filePath, CancellationToken stoppingToken)
        {
            // Filename format: blendfile_{jobId}.blend
            var fileName = Path.GetFileNameWithoutExtension(filePath);
            var jobId = fileName.Replace("blendfile_", "");
            var fileInfo = new FileInfo(filePath);
            var age = DateTime.UtcNow - fileInfo.LastWriteTimeUtc;

            // Strict policy: Only clean up if >= 2 hours old
            if (age.TotalHours < 2)
            {
                _logger.LogInformation("[System] Skipping cached file {JobId}: too new ({Age:F1} hours old, threshold is 2.0)", jobId, age.TotalHours);
                return;
            }

            _logger.LogInformation("[System] Verifying status for 2h+ old cache: {JobId}...", jobId);
            if (await IsJobFinishedAsync(jobId, stoppingToken))
            {
                _logger.LogInformation("[System] Deleting cached blend file: {JobId} (Age: {Age:F1} hours)", jobId, age.TotalHours);
                try { File.Delete(filePath); } catch (Exception ex) { _logger.LogWarning("Failed to delete {File}: {Msg}", filePath, ex.Message); }
            }
            else
            {
                _logger.LogInformation("[System] Job {JobId} for cached file is still active, keeping.", jobId);
            }
        }

        private async Task<bool> IsJobFinishedAsync(string jobId, CancellationToken stoppingToken)
        {
            if (string.IsNullOrEmpty(jobId)) return false;

            try
            {
                using var client = _httpClientFactory.CreateClient();
                
                // Double check identity before request
                if (!_identityService.IsRegistered)
                {
                    _logger.LogWarning("[System] Warning: Cannot check job {JobId} status: Node identity lost or not loaded.", jobId);
                    return false;
                }

                client.DefaultRequestHeaders.Add("X-Node-Id", _identityService.NodeId);
                client.DefaultRequestHeaders.Add("X-Node-Secret", _identityService.NodeSecret);

                var response = await client.GetAsync($"{_backendUrl.TrimEnd('/')}/api/jobs/{jobId}/status-for-node", stoppingToken);
                
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    _logger.LogDebug("[System] Job {JobId} not found on backend. Marking as finished.", jobId);
                    return true;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    _logger.LogWarning("[System] Warning: Backend rejected node credentials (401 Unauthorized) for job {JobId}. Check if node_identity.json is valid.", jobId);
                    return false;
                }

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[System] Warning: Backend status check failed for job {JobId} (Status: {Code})", jobId, response.StatusCode);
                    return false;
                }

                var content = await response.Content.ReadAsStringAsync(stoppingToken);
                var result = JsonConvert.DeserializeObject<JobStatusResponse>(content);

                if (result == null) return false;

                // If job is completed, failed, or cancelled, it's safe to delete on the node
                bool isFinished = result.Status == "completed" || result.Status == "failed" || result.Status == "cancelled" || result.Status == "not_found";
                
                if (isFinished)
                {
                    _logger.LogInformation("[System] Job {JobId} is confirmed finished (Status: {Status})", jobId, result.Status);
                }
                
                return isFinished;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[System] Warning: Error checking status for job {JobId}", jobId);
                return false;
            }
        }

        private class JobStatusResponse
        {
            [JsonProperty("success")]
            public bool Success { get; set; }
            
            [JsonProperty("status")]
            public string Status { get; set; }
            
            [JsonProperty("jobId")]
            public string JobId { get; set; }
        }
    }
}
