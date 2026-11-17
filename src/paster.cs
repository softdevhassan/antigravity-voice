using System;
using System.Runtime.InteropServices;
using System.Threading;

class Paster {
    [DllImport("user32.dll")]
    static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    const byte VK_CONTROL = 0x11;
    const byte VK_V = 0x56;
    const uint KEYEVENTF_KEYUP = 0x0002;

    [STAThread]
    static void Main(string[] args) {
        int delay = 150;
        if (args.Length > 0) {
            int d;
            if (int.TryParse(args[0], out d)) {
                delay = d;
            }
        }
        Thread.Sleep(delay);

        // Hardware keybd_event for Ctrl+V
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        keybd_event(VK_V, 0, 0, UIntPtr.Zero);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
