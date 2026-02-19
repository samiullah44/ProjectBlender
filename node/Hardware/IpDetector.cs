using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Hardware
{
    public class IpDetector
    {
        private readonly ILogger _logger;

        public IpDetector(ILogger logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IpInfo> DetectAsync()
        {
            var info = new IpInfo();

            // Hostname
            try
            {
                info.Hostname = Dns.GetHostName();
                _logger.LogInformation($"🖥️  Hostname: {info.Hostname}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Could not resolve hostname: {ex.Message}");
                info.Hostname = "Unknown";
            }

            // Local (LAN) IP — first IPv4 that isn't loopback
            info.LocalIP = GetLocalIPAddress();
            _logger.LogInformation($"🔌 Local IP: {info.LocalIP}");

            // All local IPv4 addresses (multi-NIC support)
            info.AllLocalIPs = GetAllLocalIPAddresses();

            // Public (WAN) IP via external API fallbacks
            info.PublicIP = await GetPublicIPAddressAsync();
            _logger.LogInformation($"🌐 Public IP: {info.PublicIP}");

            return info;
        }

        // ─── Helpers ──────────────────────────────────────────────────────────────

        private string GetLocalIPAddress()
        {
            try
            {
                // Use UDP trick: connect to external address to get the preferred outbound IP
                using var socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0);
                socket.Connect("8.8.8.8", 65530);
                if (socket.LocalEndPoint is IPEndPoint ep)
                    return ep.Address.ToString();
            }
            catch { }

            // Fallback: enumerate adapters
            try
            {
                var host = Dns.GetHostEntry(Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork)
                        return ip.ToString();
                }
            }
            catch { }

            return "127.0.0.1";
        }

        private List<string> GetAllLocalIPAddresses()
        {
            var ips = new List<string>();
            try
            {
                foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus != OperationalStatus.Up ||
                        nic.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                        continue;

                    foreach (var addr in nic.GetIPProperties().UnicastAddresses)
                    {
                        if (addr.Address.AddressFamily == AddressFamily.InterNetwork)
                            ips.Add(addr.Address.ToString());
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Could not enumerate all local IPs: {ex.Message}");
            }

            return ips;
        }

        private async Task<string> GetPublicIPAddressAsync()
        {
            string[] services =
            {
                "https://api.ipify.org",
                "https://icanhazip.com",
                "https://ifconfig.me/ip",
                "https://api.my-ip.io/ip",
                "https://checkip.amazonaws.com"
            };

            foreach (var service in services)
            {
                try
                {
                    using var client = new HttpClient();
                    client.Timeout = TimeSpan.FromSeconds(5);
                    client.DefaultRequestHeaders.Add("User-Agent", "BlendFarm-Node/1.0");
                    var ip = await client.GetStringAsync(service);
                    ip = ip.Trim();
                    if (!string.IsNullOrWhiteSpace(ip) && IPAddress.TryParse(ip, out _))
                    {
                        _logger.LogInformation($"✅ Public IP resolved via {new Uri(service).Host}: {ip}");
                        return ip;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug($"IP service {service} failed: {ex.Message}");
                }
            }

            _logger.LogWarning("⚠️  Could not resolve public IP from any service.");
            return "Unknown";
        }
    }
}
