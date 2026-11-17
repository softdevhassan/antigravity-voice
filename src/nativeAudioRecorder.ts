import * as path from 'path';
import * as fs from 'fs';
import { spawn, execFile, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { AudioEngine } from './audioEngine';

export class NativeAudioRecorder {
  private static activeProcess: ChildProcess | null = null;
  private static currentOutputPath: string | null = null;
  private static startTime: number = 0;
  private static timerInterval: NodeJS.Timeout | null = null;
  private static onTickCallback: ((seconds: number) => void) | null = null;

  public static isRecording(): boolean {
    return this.activeProcess !== null;
  }

  public static getBinaryPath(extensionUri: vscode.Uri): string {
    return path.join(extensionUri.fsPath, 'bin', 'win_audio_recorder.exe');
  }

  public static async startRecording(
    extensionUri: vscode.Uri,
    onTick?: (seconds: number) => void
  ): Promise<string> {
    if (this.activeProcess) {
      throw new Error('Recording already in progress');
    }

    const binaryPath = this.getBinaryPath(extensionUri);
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Recorder binary not found at ${binaryPath}`);
    }

    const recordingsDir = AudioEngine.getRecordingsDir();
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15);
    const outputPath = path.join(recordingsDir, `voice_prompt_${timestamp}.wav`);
    this.currentOutputPath = outputPath;

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(binaryPath, [outputPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        this.activeProcess = child;
        this.startTime = Date.now();
        this.onTickCallback = onTick || null;

        let started = false;

        child.stdout?.on('data', (data: Buffer) => {
          const str = data.toString();
          if (str.includes('RECORDING_STARTED') && !started) {
            started = true;
            this.startTimer();
            resolve(outputPath);
          }
        });

        child.stderr?.on('data', (err: Buffer) => {
          console.error('[NativeRecorder] STDERR:', err.toString());
        });

        child.on('error', (err) => {
          this.cleanup();
          reject(err);
        });

        child.on('close', (_code) => {
          this.cleanup();
        });

        // Safety fallback timeout if stdout is delayed
        setTimeout(() => {
          if (!started) {
            started = true;
            this.startTimer();
            resolve(outputPath);
          }
        }, 1000);
      } catch (e) {
        this.cleanup();
        reject(e);
      }
    });
  }

  public static async stopRecording(): Promise<string> {
    const child = this.activeProcess;
    const outputPath = this.currentOutputPath;

    if (!child || !outputPath) {
      throw new Error('No active recording to stop');
    }

    return new Promise((resolve, reject) => {
      try {
        child.on('close', async (_code) => {
          this.cleanup();
          if (fs.existsSync(outputPath)) {
            const finalPath = await NativeAudioRecorder.convertToOggIfPossible(outputPath);
            resolve(finalPath);
          } else {
            reject(new Error(`Recorded audio file was not found at ${outputPath}`));
          }
        });

        // Send newline into stdin to trigger save & exit
        child.stdin?.write('stop\n');
        child.stdin?.end();

        // Safety fallback kill
        setTimeout(async () => {
          if (this.activeProcess) {
            try { child.kill(); } catch { }
            this.cleanup();
            if (fs.existsSync(outputPath)) {
              const finalPath = await NativeAudioRecorder.convertToOggIfPossible(outputPath);
              resolve(finalPath);
            } else {
              reject(new Error('Recorder process timed out saving audio file'));
            }
          }
        }, 3000);
      } catch (err) {
        this.cleanup();
        reject(err);
      }
    });
  }

  private static async convertToOggIfPossible(wavPath: string): Promise<string> {
    const oggPath = wavPath.replace(/\.wav$/i, '.ogg');
    return new Promise((resolve) => {
      execFile('ffmpeg', ['-y', '-i', wavPath, '-c:a', 'libopus', '-b:a', '64k', oggPath], (err) => {
        if (!err && fs.existsSync(oggPath)) {
          resolve(oggPath);
        } else {
          resolve(wavPath);
        }
      });
    });
  }

  public static cancelRecording(): void {
    if (this.activeProcess) {
      try { this.activeProcess.kill(); } catch { }
    }
    if (this.currentOutputPath && fs.existsSync(this.currentOutputPath)) {
      try { fs.unlinkSync(this.currentOutputPath); } catch { }
    }
    this.cleanup();
  }

  private static startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      if (this.onTickCallback && this.startTime) {
        const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
        this.onTickCallback(elapsedSec);
      }
    }, 1000);
  }

  private static cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.activeProcess = null;
    this.startTime = 0;
    this.onTickCallback = null;
  }
}
