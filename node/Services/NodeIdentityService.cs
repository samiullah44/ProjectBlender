// node/Services/NodeIdentityService.cs
using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BlendFarm.Node.Services
{
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
        public NodeIdentityService(string name, ILogger<NodeIdentityService> logger = null)
        {
            UserProvidedName = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
            _logger = logger;

            // Store identity file next to the executable
            var exeDir = Path.GetDirectoryName(Environment.ProcessPath)
                         ?? AppDomain.CurrentDomain.BaseDirectory;
            _identityFilePath = Path.Combine(exeDir, IdentityFileName);
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
                var identity = JsonConvert.DeserializeObject<NodeIdentityFile>(json);

                if (identity == null || string.IsNullOrEmpty(identity.NodeId) || string.IsNullOrEmpty(identity.NodeSecret))
                    return false;

                NodeId     = identity.NodeId;
                NodeSecret = identity.NodeSecret;

                if (!string.IsNullOrEmpty(identity.FriendlyName) && string.IsNullOrEmpty(UserProvidedName))
                    UserProvidedName = identity.FriendlyName;

                _logger?.LogInformation($"✅ Loaded node identity from {IdentityFileName}: {NodeId}");
                return true;
            }
            catch (Exception ex)
            {
                _logger?.LogWarning($"⚠️ Could not load identity file: {ex.Message}");
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

                File.WriteAllText(_identityFilePath, JsonConvert.SerializeObject(identity, Formatting.Indented));
                _logger?.LogInformation($"💾 Node identity saved to {_identityFilePath}");
            }
            catch (Exception ex)
            {
                _logger?.LogError($"❌ Failed to save identity file: {ex.Message}");
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
            object hardwarePayload = null)
        {
            try
            {
                _logger?.LogInformation("🔑 Registering node with backend using registration token...");

                var payload = new System.Collections.Generic.Dictionary<string, object>
                {
                    ["registrationToken"] = registrationToken,
                    ["name"]              = UserProvidedName ?? "BlendFarm Node",
                };

                // Merge hardware data if provided
                if (hardwarePayload != null)
                {
                    var hwJson  = JsonConvert.SerializeObject(hardwarePayload);
                    var hwDict  = JsonConvert.DeserializeObject<System.Collections.Generic.Dictionary<string, object>>(hwJson);
                    if (hwDict != null)
                        foreach (var kv in hwDict)
                            payload[kv.Key] = kv.Value;
                }

                var json    = JsonConvert.SerializeObject(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await httpClient.PostAsync($"{backendUrl.TrimEnd('/')}/api/nodes/register-with-token", content);
                var body     = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger?.LogError($"❌ Token registration failed ({(int)response.StatusCode}): {body}");
                    return false;
                }

                dynamic result = JsonConvert.DeserializeObject(body);

                NodeId     = (string)result.nodeId;
                NodeSecret = (string)result.nodeSecret;

                if (string.IsNullOrEmpty(NodeId) || string.IsNullOrEmpty(NodeSecret))
                {
                    _logger?.LogError("❌ Backend returned empty nodeId or nodeSecret.");
                    return false;
                }

                SaveIdentity();

                _logger?.LogInformation($"✅ Node successfully registered! ID: {NodeId}");
                _logger?.LogInformation("🔐 nodeSecret saved. It will be used to authenticate future requests.");
                return true;
            }
            catch (Exception ex)
            {
                _logger?.LogError($"❌ RegisterWithTokenAsync failed: {ex.Message}");
                return false;
            }
        }

        // ── Data models ─────────────────────────────────────────────────────

        private class NodeIdentityFile
        {
            public string   NodeId       { get; set; }
            public string   NodeSecret   { get; set; }
            public string   FriendlyName { get; set; }
            public DateTime SavedAt      { get; set; }
        }
    }
}
