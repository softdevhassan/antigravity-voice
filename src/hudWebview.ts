import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class HudWebview {
  public static currentPanel: vscode.WebviewPanel | undefined;

  public static show(
    extensionUri: vscode.Uri,
    onAudioReady: (base64Data: string, format: string) => void,
    onCancel?: () => void
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    // If panel already exists, reveal it
    if (HudWebview.currentPanel) {
      HudWebview.currentPanel.reveal(column);
      return;
    }

    // Create a new webview panel
    const panel = vscode.window.createWebviewPanel(
      'antigravityVoiceHud',
      'Voice Prompt Recording',
      { viewColumn: column, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    HudWebview.currentPanel = panel;

    // Set panel icon
    try {
      panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'icon.svg');
    } catch {
      // Icon is optional fallback
    }

    let hasHandledOutcome = false;

    // Load webview HTML
    panel.webview.html = HudWebview.getHtmlForWebview(panel.webview, extensionUri);

    // Handle messages sent from the webview script
    const messageListener = panel.webview.onDidReceiveMessage(
      (message: { type: string; base64?: string; format?: string; message?: string }) => {
        switch (message.type) {
          case 'audio-ready':
            if (message.base64 && !hasHandledOutcome) {
              hasHandledOutcome = true;
              onAudioReady(message.base64, message.format || 'ogg');
              panel.dispose();
            }
            break;

          case 'cancel':
            if (!hasHandledOutcome) {
              hasHandledOutcome = true;
              onCancel?.();
              panel.dispose();
            }
            break;

          case 'error':
            vscode.window.showErrorMessage(
              `Antigravity Voice: ${message.message || 'An error occurred during audio recording.'}`
            );
            break;
        }
      }
    );

    // Reset reference when panel is closed
    panel.onDidDispose(() => {
      messageListener.dispose();
      if (!hasHandledOutcome) {
        hasHandledOutcome = true;
        onCancel?.();
      }
      HudWebview.currentPanel = undefined;
    });
  }

  public static close(): void {
    if (HudWebview.currentPanel) {
      HudWebview.currentPanel.dispose();
      HudWebview.currentPanel = undefined;
    }
  }

  private static getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'hud.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'hud.js'));
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'icon.svg'));

    const htmlPath = path.join(extensionUri.fsPath, 'media', 'hud.html');
    let htmlContent = '';

    try {
      htmlContent = fs.readFileSync(htmlPath, 'utf8');
      htmlContent = htmlContent
        .replace(/{{cspSource}}/g, webview.cspSource)
        .replace(/{{cssUri}}/g, cssUri.toString())
        .replace(/{{jsUri}}/g, jsUri.toString())
        .replace(/{{iconUri}}/g, iconUri.toString());
    } catch (err) {
      // In case template read fails, provide inline fallback
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; media-src blob: mediastream:; connect-src mediastream: blob:;">
  <link rel="stylesheet" href="${cssUri}">
  <title>Voice Prompt Recording</title>
</head>
<body>
  <div class="hud-container">
    <header class="hud-header">
      <div class="hud-title-wrap">
        <h1 class="hud-title">Antigravity Voice Note</h1>
      </div>
      <div id="statusBadge" class="hud-status-badge">
        <span class="status-dot"></span>
        <span id="statusText">Recording</span>
      </div>
    </header>
    <div class="visualizer-wrapper">
      <canvas id="waveformCanvas" width="480" height="90"></canvas>
      <div class="metrics-row">
        <div class="timer-box">
          <span class="timer-label">Elapsed:</span>
          <span id="timerDisplay">00:00</span>
        </div>
      </div>
    </div>
    <div class="hud-actions">
      <button id="btnDone" class="btn-primary"><span>Done & Paste</span></button>
      <button id="btnPause" class="btn-secondary"><span id="pauseBtnLabel">Pause</span></button>
      <button id="btnCancel" class="btn-danger"><span>Cancel</span></button>
    </div>
  </div>
  <script src="${jsUri}"></script>
</body>
</html>`;
    }

    return htmlContent;
  }
}
