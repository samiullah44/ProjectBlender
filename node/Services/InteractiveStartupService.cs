using System;
using System.Threading.Tasks;
using BlendFarm.Node.Models;

namespace BlendFarm.Node.Services
{
    public class InteractiveStartupService
    {
        private readonly ConfigurationManagerService _configService;
        private readonly AutoStartService _autoStartService;

        public InteractiveStartupService(
            ConfigurationManagerService configService,
            AutoStartService autoStartService)
        {
            _configService = configService;
            _autoStartService = autoStartService;
        }

        public async Task<bool> RunStartupInteractiveFlowAsync()
        {
            if (_configService.AreAllRequiredPermissionsGranted())
            {
                // All good! No need to prompt.
                return true;
            }

            Console.Clear();
            DrawBox("RENDER FARM NODE - FIRST RUN SETUP", ConsoleColor.Cyan);
            
            Console.WriteLine("\nWelcome to the Render Farm Node setup!");
            Console.WriteLine("Transparency and trust are our top priorities.");
            Console.WriteLine("To join the network and become a node provider, we need your explicit");
            Console.WriteLine("consent for how this software interacts with your machine.\n");
            
            PrintColor("If you reject any mandatory permissions, the node cannot operate,", ConsoleColor.Yellow);
            PrintColor("and you will not be able to provide rendering services or earn rewards.", ConsoleColor.Yellow);
            Console.WriteLine("However, your choice is fully respected.\n");

            var config = _configService.CurrentConfig;
            var p = config.Permissions;

            try
            {
                // 1. Hardware Profiling
                p.HardwareProfiling.Granted = PromptBoolean(
                    "Hardware Profiling",
                    "We need to detect and benchmark your CPU, GPU, RAM, Network capacity, and Disk Space\n" +
                    "to match you with compatible render jobs, calculate fair compensation, and establish your node score.\n" +
                    "We do not scan personal files.",
                    true);
                p.HardwareProfiling.GrantedAtUtc = DateTime.UtcNow;

                // 2. Software Installation (Blender)
                p.SoftwareInstallation.Granted = PromptBoolean(
                    "Software Installation",
                    "We need permission to automatically download, install, and update Blender (the 3D software)\n" +
                    "into isolated folders inside C:\\ProgramData\\RenderFarmNode\\. We will never install adware.",
                    true);
                p.SoftwareInstallation.GrantedAtUtc = DateTime.UtcNow;

                // 3. CPU Usage
                p.CpuUsage.Granted = PromptBoolean(
                    "CPU Usage",
                    "When rendering, we will utilize your CPU to process scenes. You retain control. \n" +
                    "Without this, we cannot process CPU-based jobs.",
                    true);
                if (p.CpuUsage.Granted)
                {
                    p.CpuUsage.LimitPercent = 100;
                }
                p.CpuUsage.GrantedAtUtc = DateTime.UtcNow;

                // 4. GPU Usage
                p.GpuUsage.Granted = PromptBoolean(
                    "GPU Usage",
                    "We will utilize your GPU for processing compatible scenes, which is much faster than CPU.\n" +
                    "Without this, we cannot process GPU-accelerated jobs.",
                    true);
                if (p.GpuUsage.Granted)
                {
                    p.GpuUsage.LimitPercent = 100;
                }
                p.GpuUsage.GrantedAtUtc = DateTime.UtcNow;

                // 5. Network Access
                p.NetworkAccess.Granted = PromptBoolean(
                    "Network Access",
                    "The node must connect securely over HTTPS to the central farm server to download jobs \n" +
                    "and upload finished frames.",
                    true);
                p.NetworkAccess.GrantedAtUtc = DateTime.UtcNow;

                // 6. Auto Start
                p.AutoStart.Granted = PromptBoolean(
                    "Auto Start",
                    "When enabled, the node will automatically open in a visible console window\n" +
                    "every time you log in to Windows. No background service — you will always see it.",
                    true);
                p.AutoStart.GrantedAtUtc = DateTime.UtcNow;

                // Register (or skip) the auto-start in registry based on choice
                if (p.AutoStart.Granted)
                {
                    await _autoStartService.RegisterAutoStartAsync();
                }

                // 7. Auto Update
                p.AutoUpdate.Granted = PromptBoolean(
                    "Auto Update",
                    "To maintain security and network compatibility, the node needs to automatically download \n" +
                    "and apply updates signed by the developers.",
                    true);
                p.AutoUpdate.GrantedAtUtc = DateTime.UtcNow;

                // 8. Ethical Promise
                Console.WriteLine();
                DrawBox("OUR ETHICAL PROMISE", ConsoleColor.Magenta);
                Console.WriteLine("We promise that this software will NEVER:");
                PrintColor(" ❌ Mine Crypto (No stealth mining allowed)", ConsoleColor.Red);
                PrintColor(" ❌ Access Personal Files outside of its designated work folders", ConsoleColor.Red);
                PrintColor(" ❌ Access your Webcam or Microphone", ConsoleColor.Red);
                PrintColor(" ❌ Access your Browser Data", ConsoleColor.Red);
                PrintColor(" ❌ Hide from your Task Manager (No rootkits or hidden processes)", ConsoleColor.Red);
                PrintColor(" ❌ Tamper with irrelevant System Registries", ConsoleColor.Red);
                PrintColor(" ❌ Sell you or your data to advertisers", ConsoleColor.Red);
                Console.WriteLine(new string('-', 73) + "\n");

                bool acceptEthics = PromptBoolean(
                    "Acknowledge Ethical Promise",
                    "Do you acknowledge and hold us to this ethical promise? Recognizing this establishes our mutual trust.",
                    true);

                if (acceptEthics)
                {
                    var e = config.EthicalPromise;
                    e.NoCryptoMining = true;
                    e.NoPersonalFileAccess = true;
                    e.NoWebcamAccess = true;
                    e.NoMicrophoneAccess = true;
                    e.NoBrowserData = true;
                    e.NoHiddenProcesses = true;
                    e.NoRegistryTampering = true;
                    e.NoDataSelling = true;
                }

                _configService.SaveConfig();

                if (_configService.AreAllRequiredPermissionsGranted())
                {
                    PrintColor("\n✅ All mandatory permissions granted. Thank you for trusting us!", ConsoleColor.Green);
                    PrintColor($"✅ Configuration securely saved to: {_configService.ConfigPath}", ConsoleColor.Green);
                    Console.WriteLine("Starting the node...\n");
                    await Task.Delay(2000);
                    return true;
                }
                else
                {
                    HandleRejection();
                    return false;
                }
            }
            catch (Exception ex)
            {
                PrintColor($"\n❌ An error occurred during setup: {ex.Message}", ConsoleColor.Red);
                return false;
            }
        }

        private void HandleRejection()
        {
            Console.Clear();
            DrawBox("SETUP INCOMPLETE", ConsoleColor.Red);
            Console.WriteLine("\nYou have opted to deny one or more mandatory permissions.");
            Console.WriteLine("Because of the nature of distributed rendering, the node requires");
            Console.WriteLine("these permissions to function reliably and securely.\n");
            
            PrintColor("What this means:", ConsoleColor.Yellow);
            Console.WriteLine("- You will not be able to become a node provider.");
            Console.WriteLine("- The node software will not execute background jobs.");
            Console.WriteLine("- No hardware profiling or automatic updates will occur.\n");
            
            Console.WriteLine("We respect your privacy and your system. If you change your mind,");
            Console.WriteLine("you can restart the application and go through the setup again.\n");
            
            PrintColor("Press any key to exit the application...", ConsoleColor.DarkGray);
            Console.ReadKey();
            Environment.Exit(0);
        }

        private bool PromptBoolean(string title, string why, bool isMandatory)
        {
            Console.WriteLine();
            PrintColor($">>> PERMISSION: {title.ToUpper()}", ConsoleColor.Cyan);
            Console.WriteLine($"WHY: {why}");
            
            while (true)
            {
                Console.ForegroundColor = isMandatory ? ConsoleColor.Yellow : ConsoleColor.DarkGray;
                Console.Write($"Do you grant this permission? [y/n] {(isMandatory ? "(Mandatory)" : "(Optional)")}: ");
                Console.ResetColor();

                var key = Console.ReadKey(intercept: true).KeyChar.ToString().ToLower();

                if (key == "y")
                {
                    PrintColor("y", ConsoleColor.Green);
                    return true;
                }
                if (key == "n")
                {
                    PrintColor("n", ConsoleColor.Red);
                    
                    if (isMandatory)
                    {
                        PrintColor("\n[!] MANDATORY PERMISSION DENIED [!]", ConsoleColor.Red);
                        Console.WriteLine("This permission is strictly required to run the node software and participate in the network.");
                        Console.WriteLine("We cannot allow the node to operate without this agreement.");
                        Console.WriteLine("If you do not wish to grant this, you can press Ctrl+C to exit setup entirely.");
                        PrintColor("Would you like to reconsider? Please answer below.\n", ConsoleColor.Yellow);
                        continue;
                    }

                    return false;
                }

                // Invalid key
                PrintColor("\nPlease enter 'y' or 'n'.", ConsoleColor.Red);
            }
        }

        private void PrintColor(string text, ConsoleColor color)
        {
            Console.ForegroundColor = color;
            Console.WriteLine(text);
            Console.ResetColor();
        }

        private void DrawBox(string title, ConsoleColor color)
        {
            string line = new string('=', 73);
            Console.ForegroundColor = color;
            Console.WriteLine(line);
            int padding = (73 - title.Length) / 2;
            Console.WriteLine(new string(' ', Math.Max(0, padding)) + title);
            Console.WriteLine(line);
            Console.ResetColor();
        }
    }
}
