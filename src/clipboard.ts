import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class WindowsClipboard {
  /**
   * Sets the Windows Clipboard to CF_HDROP format (File Drop List) containing the specified file.
   * Enables native file pasting (Ctrl+V) into applications like WhatsApp, Discord, Slack,
   * VS Code / Antigravity AI Chat input, and Windows File Explorer.
   *
   * @param target File path string or an object containing a filePath string property.
   * @returns Promise<boolean> resolving to true on success, false on failure.
   */
  static async setFileDrop(target: string | { filePath: string }): Promise<boolean> {
    const rawPath = typeof target === 'string' ? target : target?.filePath;
    if (!rawPath || typeof rawPath !== 'string') {
      console.error('[WindowsClipboard] Invalid file path provided:', target);
      return false;
    }

    const resolvedPath = path.resolve(rawPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[WindowsClipboard] File not found: ${resolvedPath}`);
      return false;
    }

    // Escape single quotes for PowerShell single-quoted literal
    const escapedPath = resolvedPath.replace(/'/g, "''");

    // PowerShell script:
    // 1. $ProgressPreference = 'SilentlyContinue' suppresses CLIXML progress stream
    // 2. Add-Type loads System.Windows.Forms in STA apartment
    // 3. DataObject with SetFileDropList
    // 4. SetDataObject with $true (copy: true) ensures data persists in clipboard after process exits!
    const script = [
      `$ProgressPreference = 'SilentlyContinue';`,
      `Add-Type -AssemblyName System.Windows.Forms;`,
      `$data = New-Object System.Windows.Forms.DataObject;`,
      `$files = New-Object System.Collections.Specialized.StringCollection;`,
      `[void]$files.Add('${escapedPath}');`,
      `$data.SetFileDropList($files);`,
      `[System.Windows.Forms.Clipboard]::SetDataObject($data, $true);`
    ].join(' ');

    // Use UTF-16LE Base64 encoding (-EncodedCommand) for flawless cross-shell execution without escaping bugs
    const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');

    return new Promise<boolean>((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encodedCommand],
        {
          windowsHide: true,
          timeout: 5000,
          encoding: 'utf8'
        },
        (error, _stdout, stderr) => {
          if (error) {
            console.error('[WindowsClipboard] Failed to set file drop in clipboard:', error.message, stderr);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }
}
