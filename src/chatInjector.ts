import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';

/**
 * ChatInjector handles focusing the Antigravity AI Chat interface
 * and automating the paste operation for voice notes copied to the clipboard.
 */
export class ChatInjector {
  private static outputChannel: vscode.OutputChannel | null = null;

  public static getOutputChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Antigravity Voice');
    }
    return this.outputChannel;
  }

  private static log(message: string): void {
    const timestamp = new Date().toISOString();
    this.getOutputChannel().appendLine(`[${timestamp}] [ChatInjector] ${message}`);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static async focusChat(): Promise<boolean> {
    try {
      this.log('Focusing Antigravity Chat panel and input textarea...');
      // 1. Focus the sidebar / auxiliary panel first
      await vscode.commands.executeCommand('antigravity.panel.focus');
    } catch {}

    try {
      // 2. Focus the input textarea inside the webview view
      await vscode.commands.executeCommand('antigravity.toggleChatFocus');
      return true;
    } catch {
      return false;
    }
  }

  public static async executePaste(): Promise<void> {
    if (process.platform === 'win32') {
      const pasterBin = path.join(__dirname, '..', 'bin', 'win_paste.exe');
      if (fs.existsSync(pasterBin)) {
        return new Promise<void>((resolve) => {
          execFile(pasterBin, ['50'], { windowsHide: true }, () => {
            resolve();
          });
        });
      }
    }

    // Fallback: clipboard paste commands
    try {
      await vscode.commands.executeCommand('workbench.action.clipboardPasteAction');
    } catch {
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    }
  }

  public static async focusChatAndPaste(filePath: string, autoSend: boolean = false): Promise<boolean> {
    try {
      this.log(`Starting focusChatAndPaste for file: "${filePath}" (autoSend: ${autoSend})`);

      if (!filePath || !fs.existsSync(filePath)) {
        this.log(`File not found: ${filePath}`);
        return false;
      }

      // Step 1: Focus the Antigravity Chat panel / input
      await this.focusChat();
      await this.delay(200);

      // Step 2: Execute hardware paste
      await this.executePaste();

      // Step 3: Handle autoSend if enabled
      if (autoSend) {
        await this.delay(500);
        await vscode.commands.executeCommand('workbench.action.chat.submit');
      }

      return true;
    } catch (error) {
      this.log(`focusChatAndPaste error: ${error}`);
      return false;
    }
  }

  public static dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
      this.outputChannel = null;
    }
  }
}
