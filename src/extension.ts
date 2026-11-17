import * as vscode from 'vscode';
import { WindowsClipboard } from './clipboard';
import { ChatInjector } from './chatInjector';
import { VoiceSettings } from './settings';
import { NativeAudioRecorder } from './nativeAudioRecorder';
import { RecorderServer } from './recorderServer';

let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 1. Start the native background bridge server for direct Chat Box mic integration
  try {
    await RecorderServer.start(context.extensionUri);
  } catch (err) {
    console.error('[AntigravityVoice] Failed to start local recorder server:', err);
  }

  // 2. Create Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(mic) Voice Note';
  statusBarItem.tooltip = 'Click or press Ctrl+Alt+V to record voice prompt for Antigravity AI Chat';
  statusBarItem.command = 'antigravity-voice.record';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  vscode.commands.executeCommand('setContext', 'antigravityVoiceRecording', false);

  // 3. Toggle Record Command (Ctrl+Alt+V / Status Bar)
  const recordCommand = vscode.commands.registerCommand('antigravity-voice.record', async () => {
    if (NativeAudioRecorder.isRecording()) {
      await finishAndPasteAudio();
    } else {
      await startNativeRecording(context);
    }
  });

  // 4. Stop Command
  const stopCommand = vscode.commands.registerCommand('antigravity-voice.stop', async () => {
    if (NativeAudioRecorder.isRecording()) {
      await finishAndPasteAudio();
    }
  });

  // 5. Cancel Command (Escape)
  const cancelCommand = vscode.commands.registerCommand('antigravity-voice.cancel', () => {
    if (NativeAudioRecorder.isRecording()) {
      NativeAudioRecorder.cancelRecording();
      setRecordingState(false);
      vscode.window.showInformationMessage('Voice recording cancelled.');
    }
  });

  context.subscriptions.push(recordCommand, stopCommand, cancelCommand);
}

async function startNativeRecording(context: vscode.ExtensionContext): Promise<void> {
  try {
    setRecordingState(true);

    await NativeAudioRecorder.startRecording(context.extensionUri, (elapsedSec: number) => {
      const minutes = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
      const seconds = (elapsedSec % 60).toString().padStart(2, '0');
      if (statusBarItem) {
        statusBarItem.text = `$(record) [${minutes}:${seconds}] Recording... (Ctrl+Alt+V to Send)`;
      }
    });

    vscode.window.showInformationMessage(
      '🎙️ Recording started! Speak your prompt, then press Ctrl+Alt+V to attach.'
    );
  } catch (error) {
    setRecordingState(false);
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to start native microphone recorder: ${msg}`);
  }
}

async function finishAndPasteAudio(): Promise<void> {
  try {
    if (statusBarItem) {
      statusBarItem.text = '$(sync~spin) Attaching to Chat...';
    }

    const recordedFilePath = await NativeAudioRecorder.stopRecording();

    if (VoiceSettings.isAutoPasteEnabled()) {
      // Put onto Windows Clipboard with CF_HDROP format
      await WindowsClipboard.setFileDrop(recordedFilePath);

      // Focus Antigravity AI Chat panel and trigger Ctrl+V
      await ChatInjector.focusChatAndPaste(
        recordedFilePath,
        VoiceSettings.isAutoSendEnabled()
      );

      vscode.window.showInformationMessage(
        '✅ Voice prompt attached into Antigravity AI Chat!'
      );
    } else {
      vscode.window.showInformationMessage(
        `✅ Voice note saved to: ${recordedFilePath}`
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Voice processing error: ${msg}`);
  } finally {
    setRecordingState(false);
  }
}

function setRecordingState(isRecording: boolean): void {
  vscode.commands.executeCommand('setContext', 'antigravityVoiceRecording', isRecording);
  if (statusBarItem) {
    if (isRecording) {
      statusBarItem.text = '$(record) [00:00] Recording... (Ctrl+Alt+V to Send)';
      statusBarItem.tooltip = 'Voice recording active - Click to send or press Esc to cancel';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
      statusBarItem.text = '$(mic) Voice Note';
      statusBarItem.tooltip = 'Click or press Ctrl+Alt+V to record voice prompt for Antigravity AI Chat';
      statusBarItem.backgroundColor = undefined;
    }
  }
}

export function deactivate(): void {
  RecorderServer.stop();
  if (NativeAudioRecorder.isRecording()) {
    NativeAudioRecorder.cancelRecording();
  }
}
