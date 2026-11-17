import * as vscode from 'vscode';

export class VoiceSettings {
  private static readonly SECTION = 'antigravityVoice';

  /**
   * Audio container format for recorded voice files ('ogg' or 'wav').
   */
  static getAudioFormat(): 'ogg' | 'wav' {
    const config = vscode.workspace.getConfiguration(this.SECTION);
    const format = config.get<string>('audioFormat', 'ogg');
    return format === 'wav' ? 'wav' : 'ogg';
  }

  /**
   * Whether to automatically paste the recorded voice note into the Antigravity chat input.
   */
  static isAutoPasteEnabled(): boolean {
    const config = vscode.workspace.getConfiguration(this.SECTION);
    return config.get<boolean>('autoPaste', true);
  }

  /**
   * Whether to automatically trigger prompt submit/send after pasting.
   */
  static isAutoSendEnabled(): boolean {
    const config = vscode.workspace.getConfiguration(this.SECTION);
    return config.get<boolean>('autoSend', false);
  }

  /**
   * Whether auditory feedback sounds are played for recording states.
   */
  static isSoundEffectsEnabled(): boolean {
    const config = vscode.workspace.getConfiguration(this.SECTION);
    return config.get<boolean>('soundEffects', true);
  }

  /**
   * Configured language tag for speech or voice notes.
   */
  static getLanguage(): string {
    const config = vscode.workspace.getConfiguration(this.SECTION);
    return config.get<string>('language', 'en-US');
  }
}
