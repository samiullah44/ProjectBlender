using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;
using System.Linq;
using System.Diagnostics;

namespace BlendFarm.Node.Hardware
{
    public class NetworkDetector
    {
        private readonly ILogger _logger;
        private const int TestFileSizeBytes = 10 * 1024 * 1024; // 10MB test file

        public NetworkDetector(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<NetworkInfo> DetectAsync(string serverUrl)
        {
            var network = new NetworkInfo();

            try
            {
                // Get local IP
                network.LocalIP = GetLocalIPAddress();
                
                // Get MAC address
                network.MacAddress = GetMacAddress();
                
                // Get interface name
                network.InterfaceName = GetActiveInterfaceName();
                
                // Get public IP
                network.PublicIP = await GetPublicIPAddressAsync();
                
                // Measure latency (ping)
                network.LatencyMs = await MeasureLatencyAsync(serverUrl);
                
                // Measure upload/download speeds
                var speeds = await MeasureNetworkSpeedAsync(serverUrl);
                network.UploadSpeedMbps = speeds.upload;
                network.DownloadSpeedMbps = speeds.download;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Network detection failed: {ex.Message}");
                
                // Provide fallback values
                network.UploadSpeedMbps = 50;
                network.DownloadSpeedMbps = 100;
                network.LatencyMs = 50;
                network.LocalIP = GetLocalIPAddress() ?? "127.0.0.1";
            }

            return network;
        }

        private string GetLocalIPAddress()
        {
            try
            {
                var host = Dns.GetHostEntry(Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork)
                    {
                        return ip.ToString();
                    }
                }
            }
            catch { }

            return "127.0.0.1";
        }

        private string GetMacAddress()
        {
            try
            {
                foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus == OperationalStatus.Up &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Tunnel)
                    {
                        var address = nic.GetPhysicalAddress();
                        if (address != null && address.ToString() != "")
                        {
                            return string.Join("-", address.GetAddressBytes().Select(b => b.ToString("X2")));
                        }
                    }
                }
            }
            catch { }

            return "00-00-00-00-00-00";
        }

        private string GetActiveInterfaceName()
        {
            try
            {
                foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus == OperationalStatus.Up &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        nic.Speed > 0)
                    {
                        return nic.Name;
                    }
                }
            }
            catch { }

            return "Unknown";
        }

        private async Task<string> GetPublicIPAddressAsync()
        {
            try
            {
             // WITH THIS:
using (var client = new HttpClient())
{
    client.Timeout = TimeSpan.FromSeconds(10);
    return await client.GetStringAsync("https://api.ipify.org");
}
            }
            catch
            {
                try
                {using (var client = new HttpClient())
{
    client.Timeout = TimeSpan.FromSeconds(10);
    return await client.GetStringAsync("https://icanhazip.com");
}
                }
                catch
                {
                    return "Unknown";
                }
            }
        }

        private async Task<double> MeasureLatencyAsync(string serverUrl)
        {
            try
            {
                var uri = new Uri(serverUrl);
                var host = uri.Host;

                using var ping = new Ping();
                var reply = await ping.SendPingAsync(host, 5000); // 5 second timeout

                if (reply.Status == IPStatus.Success)
                {
                    return reply.RoundtripTime;
                }
            }
            catch { }

            return 999; // High latency if can't measure
        }

        private async Task<(double upload, double download)> MeasureNetworkSpeedAsync(string serverUrl)
        {
            // Ensure URL ends with /
            if (!serverUrl.EndsWith("/"))
                serverUrl += "/";

            // Create test client
            using var client = new System.Net.Http.HttpClient();
            client.Timeout = TimeSpan.FromSeconds(60);

            // Generate random test data
            var random = new Random();
            byte[] uploadData = new byte[TestFileSizeBytes];
            random.NextBytes(uploadData);

            try
            {
                // Test Download Speed
                _logger.LogDebug("Testing download speed...");
                var downloadStart = DateTime.Now;
                
                var downloadResponse = await client.GetAsync($"{serverUrl}api/network/test");
                var downloadData = await downloadResponse.Content.ReadAsByteArrayAsync();
                
                var downloadTime = (DateTime.Now - downloadStart).TotalSeconds;
                var downloadSpeedMbps = (downloadData.Length * 8) / (1024.0 * 1024.0) / downloadTime;

                // Test Upload Speed
                _logger.LogDebug("Testing upload speed...");
                var uploadStart = DateTime.Now;
                
                using var content = new System.Net.Http.ByteArrayContent(uploadData);
                content.Headers.Add("Content-Type", "application/octet-stream");
                
                var uploadResponse = await client.PostAsync($"{serverUrl}api/network/test", content);
                
                var uploadTime = (DateTime.Now - uploadStart).TotalSeconds;
                var uploadSpeedMbps = (uploadData.Length * 8) / (1024.0 * 1024.0) / uploadTime;

                return (Math.Round(uploadSpeedMbps, 1), Math.Round(downloadSpeedMbps, 1));
            }
            catch (Exception ex)
            {
                _logger.LogDebug($"Speed test failed: {ex.Message}");
                
                // Try alternative method using ping timing as estimate
                return await MeasureSpeedViaLatencyAsync(serverUrl);
            }
        }

        private async Task<(double upload, double download)> MeasureSpeedViaLatencyAsync(string serverUrl)
        {
            try
            {
                var uri = new Uri(serverUrl);
                var host = uri.Host;

                // Measure baseline latency
                using var ping = new Ping();
                var baseline = await ping.SendPingAsync(host, 2000);
                
                if (baseline.Status != IPStatus.Success)
                    return (10, 20); // Very conservative fallback

                // Rough estimate based on latency
                // This is very approximate, but better than nothing
                double latencyMs = baseline.RoundtripTime;
                
                // Detect if host is local
                bool isLocal = host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || 
                             host.Equals("127.0.0.1") || 
                             host.Equals("::1");

                // Very rough speed estimation based on latency
                // Lower latency generally means faster connection
                double uploadSpeed, downloadSpeed;
                
                if (isLocal)
                {
                    uploadSpeed = 1000; // Gigalocal
                    downloadSpeed = 2500;
                }
                else if (latencyMs < 10)
                {
                    uploadSpeed = 100; // Fiber
                    downloadSpeed = 500;
                }
                else if (latencyMs < 30)
                {
                    uploadSpeed = 50;  // Cable
                    downloadSpeed = 200;
                }
                else if (latencyMs < 60)
                {
                    uploadSpeed = 20;  // DSL
                    downloadSpeed = 50;
                }
                else
                {
                    uploadSpeed = 5;   // Satellite/Mobile
                    downloadSpeed = 20;
                }

                return (uploadSpeed, downloadSpeed);
            }
            catch
            {
                return (25, 50); // Conservative fallback
            }
        }
    }
}