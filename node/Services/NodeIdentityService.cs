namespace BlendFarm.Node.Services
{
    public class NodeIdentityService
    {
        public string UserProvidedName { get; }
        public NodeIdentityService(string name)
        {
            UserProvidedName = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        }
    }
}
