using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class Program {
    [DllImport("winmm.dll", EntryPoint = "mciSendStringA", CharSet = CharSet.Ansi)]
    private static extern int mciSendString(string command, StringBuilder returnString, int returnLength, IntPtr hwndCallback);

    public static void Main(string[] args) {
        if (args.Length < 1) {
            Console.WriteLine("ERROR: Output path argument required");
            return;
        }

        string outputPath = Path.GetFullPath(args[0]);
        string dir = Path.GetDirectoryName(outputPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) {
            Directory.CreateDirectory(dir);
        }

        if (File.Exists(outputPath)) {
            try { File.Delete(outputPath); } catch { }
        }

        // Close any prior session if left open
        mciSendString("close recsound", null, 0, IntPtr.Zero);

        // Open 16-bit 16kHz waveaudio format
        mciSendString("open new type waveaudio alias recsound", null, 0, IntPtr.Zero);
        mciSendString("set recsound time format ms bitspersample 16 channels 1 samplespersec 16000 bytespersec 32000 alignment 2", null, 0, IntPtr.Zero);
        
        int res = mciSendString("record recsound", null, 0, IntPtr.Zero);
        if (res != 0) {
            Console.WriteLine("ERROR: mciSendString record failed with code " + res);
            return;
        }

        Console.WriteLine("RECORDING_STARTED");

        // Wait for stdin stop command or stream termination
        string line = Console.ReadLine();

        mciSendString("stop recsound", null, 0, IntPtr.Zero);
        mciSendString("save recsound \"" + outputPath + "\"", null, 0, IntPtr.Zero);
        mciSendString("close recsound", null, 0, IntPtr.Zero);

        Console.WriteLine("RECORDING_SAVED:" + outputPath);
    }
}
