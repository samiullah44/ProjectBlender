using System;
using System.Threading.Tasks;
using BlendFarm.Node.Services;
using Microsoft.Extensions.Logging;

class TestRun
{
    static async Task TestMain()
    {
        Console.WriteLine("🧪 Testing C# + Python Integration...");
        
        // Create a logger
        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Debug);
        });
        
        var logger = loggerFactory.CreateLogger<PythonRunnerService>();
        var runner = new PythonRunnerService(logger);
        
        // Test with a sample .blend file (you need to create one)
        var testBlendFile = "test_scene.blend";
        
        if (!System.IO.File.Exists(testBlendFile))
        {
            Console.WriteLine("⚠️  Create a simple test.blend file first!");
            Console.WriteLine("   Or use an existing .blend file");
            return;
        }
        
        Console.WriteLine($"Testing with: {testBlendFile}");
        
        var success = await runner.RunRenderAsync(
            blendFilePath: testBlendFile,
            frame: 1,
            outputPath: $"render_test_{DateTime.Now:yyyyMMdd_HHmmss}.png"
        );
        
        Console.WriteLine(success ? "✅ Test passed!" : "❌ Test failed");
    }
}