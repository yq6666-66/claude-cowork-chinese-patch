// launcher.cs — tiny no-window stub (compiled as a WinExe so it never creates a console).
// It launches the sibling launch-claude-zh.ps1 hidden, giving a flash-free desktop shortcut.
// The .ps1 path is resolved relative to this executable, so the compiled exe stays portable.
//
// Build (see build-shortcut.ps1, which does this automatically when csc.exe is available):
//   csc -nologo -target:winexe -win32icon:claude.ico -out:claude-zh-launcher.exe launcher.cs
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class ClaudeZhLauncher
{
    static void Main()
    {
        try
        {
            string dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string ps1 = Path.Combine(dir, "launch-claude-zh.ps1");

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + ps1 + "\"";
            psi.UseShellExecute = false;   // direct CreateProcess
            psi.CreateNoWindow = true;     // no console for the child
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(psi);
        }
        catch
        {
            // The stub never shows errors; the .ps1 has its own fallbacks.
        }
    }
}
