// node/Services/NodeIdentityService.cs
using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Services
{
    [JsonSerializable(typeof(NodeIdentityService.NodeIdentityFile))]
    [JsonSerializable(typeof(NodeIdentityService.RegistrationPayload))]
    [JsonSerializable(typeof(NodeIdentityService.RegistrationResponse))]
    [JsonSerializable(typeof(NodeIdentityService.ErrorResponse))]
    [JsonSerializable(typeof(System.Collections.Generic.Dictionary<string, object>))]
    [JsonSerializable(typeof(int))]
    [JsonSerializable(typeof(long))]
    [JsonSerializable(typeof(double))]
    [JsonSerializable(typeof(bool))]
    public partial class NodeIdentitySerializerContext : JsonSerializerContext
    {
    }

    /// <summary>
    /// Manages the node's permanent identity (nodeId + nodeSecret) and
    /// handles the one-time token-based registration flow.
    ///
    /// Identity is persisted to node_identity.json next to the executable so
    /// it survives restarts. The registration token (from the dashboard) is
    /// only used once and then discarded.
    /// </summary>
    public class NodeIdentityService
    {
        // ── Public properties ───────────────────────────────────────────────
        public string UserProvidedName { get; private set; }
        public string NodeId           { get; private set; }
        public string NodeSecret       { get; private set; }
        public bool   IsRegistered     => !string.IsNullOrEmpty(NodeId) && !string.IsNullOrEmpty(NodeSecret);

        // ── Private fields ──────────────────────────────────────────────────
        private readonly ILogger<NodeIdentityService> _logger;
        private readonly string _identityFilePath;

        private const string IdentityFileName = "node_identity.json";

        // ── Constructor ─────────────────────────────────────────────────────
        public NodeIdentityService(string name, ILogger<NodeIdentityService>? logger = null)
        {
            UserProvidedName = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
            _logger = logger;

            // Store identity file in a stable global location immune to build/publish path changes
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            var blendFarmDir = Path.Combine(appData, "BlendFarm");
            
            if (!Directory.Exists(blendFarmDir))
            {
                Directory.CreateDirectory(blendFarmDir);
            }
            
            _identityFilePath = Path.Combine(blendFarmDir, IdentityFileName);
        }

        // ── Load / Save identity ────────────────────────────────────────────

        /// <summary>
        /// Load a previously-saved identity. Returns true if identity was found.
        /// </summary>
        public bool TryLoadIdentity()
        {
            try
            {
                if (!File.Exists(_identityFilePath))
                    return false;

                var json = File.ReadAllText(_identityFilePath);
                var identity = System.Text.Json.JsonSerializer.Deserialize(
                    json,
                    NodeIdentitySerializerContext.Default.NodeIdentityFile);

                if (identity == null || string.IsNullOrEmpty(identity.NodeId) || string.IsNullOrEmpty(identity.NodeSecret))
                    return false;

                NodeId     = identity.NodeId;
                NodeSecret = identity.NodeSecret;

                if (!string.IsNullOrEmpty(identity.FriendlyName) && string.IsNullOrEmpty(UserProvidedName))
                    UserProvidedName = identity.FriendlyName;

                _logger?.LogInformation($"[Identity] Loaded node identity from {IdentityFileName}: {NodeId}");
                return true;
            }
            catch (Exception ex)
            {
                _logger?.LogWarning($"[Identity] Warning: Could not load identity file: {ex.Message}");
                return false;
            }
        }

        /// <summary>Directly set identity (e.g. from appsettings.json override). Does NOT persist to disk.</summary>
        public void SetIdentity(string nodeId, string nodeSecret)
        {
            NodeId     = nodeId;
            NodeSecret = nodeSecret;
        }

        /// <summary>Update the node's friendly name (e.g. from interactive prompt).</summary>
        public void SetFriendlyName(string name)
        {
            UserProvidedName = string.IsNullOrWhiteSpace(name) ? UserProvidedName : name.Trim();
        }

        /// <summary>
        /// Persist identity to disk after successful token registration.
        /// </summary>
        public void SaveIdentity()
        {
            try
            {
                var identity = new NodeIdentityFile
                {
                    NodeId       = NodeId,
                    NodeSecret   = NodeSecret,
                    FriendlyName = UserProvidedName,
                    SavedAt      = DateTime.UtcNow,
                };

                var jsonText = System.Text.Json.JsonSerializer.Serialize(
                    identity,
                    NodeIdentitySerializerContext.Default.NodeIdentityFile);
                File.WriteAllText(_identityFilePath, jsonText);
                _logger?.LogInformation($"[Identity] Node identity saved to {_identityFilePath}");
            }
            catch (Exception ex)
            {
                _logger?.LogError($"[Identity] Error: Failed to save identity file: {ex.Message}");
            }
        }

        // ── Token registration flow ─────────────────────────────────────────

        /// <summary>
        /// Call the backend's /api/nodes/register-with-token endpoint.
        /// On success, saves nodeId + nodeSecret and persists them to disk.
        /// </summary>
        public async Task<bool> RegisterWithTokenAsync(
            string registrationToken,
            string backendUrl,
            HttpClient httpClient,
            object? hardwarePayload = null)
        {
            try
            {
                _logger?.LogInformation("[Identity] Registering node with backend using registration token...");

                // Map the raw HardwareInfo to the exact flat schema the backend's 
                // register-with-token endpoint reads (hardware.ramGB, hardware.gpuVRAM, etc.)
                var payloadDict = new System.Collections.Generic.Dictionary<string, object>
                {
                    ["registrationToken"] = registrationToken,
                    ["name"]              = UserProvidedName ?? "BlendFarm Node"
                };

                if (hardwarePayload is HardwareInfo hw)
                {
                    var gpu = hw.Gpus?.Count > 0 ? hw.Gpus[0] : null;

                    // Top-level fields expected by register-with-token
                    payloadDict["os"]                  = hw.Os?.Name ?? "";
                    payloadDict["ipAddress"]           = hw.Ip?.LocalIP ?? "";
                    payloadDict["publicIp"]            = hw.Ip?.PublicIP ?? "";
                    payloadDict["hostname"]            = hw.Ip?.Hostname ?? "";
                    payloadDict["hardwareFingerprint"] = hw.HardwareFingerprint ?? "";

                    // Flat hardware object — these are the fields the backend validation reads
                    payloadDict["hardware"] = new System.Collections.Generic.Dictionary<string, object>
                    {
                        ["cpuModel"]          = hw.Cpu?.Model ?? "",
                        ["cpuCores"]          = hw.Cpu?.PhysicalCores ?? 0,
                        ["cpuThreads"]        = hw.Cpu?.LogicalCores ?? 0,
                        ["cpuSpeedGHz"]       = hw.Cpu?.BaseClockGHz ?? 0,
                        ["cpuScore"]          = hw.Cpu?.CpuScore ?? 0,
                        ["ramGB"]             = hw.Ram?.TotalGB ?? 0,
                        ["ramType"]           = hw.Ram?.Type ?? "",
                        ["gpuName"]           = gpu?.Model ?? "",
                        ["gpuVRAM"]           = gpu?.VramMB ?? 0,
                        ["storageFreeGB"]     = hw.Storage?.FreeGB ?? 0,
                        ["storageType"]       = hw.Storage?.Type ?? "",
                        ["uploadSpeedMbps"]   = hw.Network?.UploadSpeedMbps ?? 0,
                        ["downloadSpeedMbps"] = hw.Network?.DownloadSpeedMbps ?? 0,
                        ["latencyMs"]         = hw.Network?.LatencyMs ?? 0
                    };
                }

                var payloadJson = System.Text.Json.JsonSerializer.Serialize(
                    payloadDict, 
                    NodeIdentitySerializerContext.Default.DictionaryStringObject);
                var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");




                var response = await httpClient.PostAsync($"{backendUrl.TrimEnd('/')}/api/nodes/register-with-token", content);
                var body     = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    string errorMsg = body;
                    try 
                    {
                        var errorObj = System.Text.Json.JsonSerializer.Deserialize(
                            body, 
                            NodeIdentitySerializerContext.Default.ErrorResponse);
                        if (errorObj != null && !string.IsNullOrEmpty(errorObj.message))
                            errorMsg = errorObj.message;
                    } 
                    catch { }
                    
                    _logger?.LogError($"[Identity] Error: Registration Refused:");
                    _logger?.LogCritical($"{errorMsg}");
                    
                    // Stop the application from scrolling and immediately exiting
                    Console.WriteLine("\n════════════════════════════════════════════");
                    Console.WriteLine("    HARDWARE REQUIREMENTS NOT MET");
                    Console.WriteLine("════════════════════════════════════════════");
                    Console.WriteLine($"{errorMsg}");
                    Console.WriteLine("\nPress any key to exit...");
                    Console.ReadKey();
                    
                    // Kill the process immediately so it doesn't continue the background service loop
                    Environment.Exit(1);
                    return false;
                }

                var result = System.Text.Json.JsonSerializer.Deserialize(
                    body,
                    NodeIdentitySerializerContext.Default.RegistrationResponse);

                NodeId     = result?.nodeId;
                NodeSecret = result?.nodeSecret;

                if (string.IsNullOrEmpty(NodeId) || string.IsNullOrEmpty(NodeSecret))
                {
                    _logger?.LogError("[Identity] Error: Backend returned empty nodeId or nodeSecret.");
                    return false;
                }

                SaveIdentity();

                _logger?.LogInformation($"[Identity] Node successfully registered! ID: {NodeId}");
                _logger?.LogInformation("[Identity] nodeSecret saved. It will be used to authenticate future requests.");
                return true;
            }
            catch (Exception ex)
            {
                _logger?.LogError($"[Identity] Error: RegisterWithTokenAsync failed: {ex.Message}");
                return false;
            }
        }

        // ── Data models ─────────────────────────────────────────────────────

        public class RegistrationPayload
        {
            public string registrationToken { get; set; }
            public string name { get; set; }
            // hardware is omitted here — sent as raw JSON in the request body manually
        }

        public class RegistrationResponse
        {
            public string nodeId { get; set; }
            public string nodeSecret { get; set; }
        }

        public class ErrorResponse
        {
            public string message { get; set; }
        }

        public class NodeIdentityFile
        {
            public string   NodeId       { get; set; }
            public string   NodeSecret   { get; set; }
            public string   FriendlyName { get; set; }
            public DateTime SavedAt      { get; set; }
        }
    }
}
