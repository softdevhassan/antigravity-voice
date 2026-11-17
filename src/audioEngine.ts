import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AudioSaveResult {
  filePath: string;
  durationSec?: number;
  format: 'ogg' | 'wav';
  sizeBytes: number;
}

export class AudioEngine {
  private static readonly DIR_NAME = '.antigravity-voice';
  private static readonly RECORDINGS_SUBDIR = 'recordings';

  /**
   * Returns the absolute directory path where recordings are stored: ~/.antigravity-voice/recordings
   * Automatically creates the directory recursively if it does not already exist.
   */
  static getRecordingsDir(): string {
    const baseDir = path.join(os.homedir(), this.DIR_NAME, this.RECORDINGS_SUBDIR);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  }

  /**
   * Saves a base64 encoded audio string to disk.
   * Strips data URI prefix if present (e.g. data:audio/ogg;base64,...).
   * Generates a clean timestamped filename: voice_prompt_YYYYMMDD_HHMMSS.<format>
   *
   * @param base64Data Base64 string of the audio (with or without data URI header)
   * @param format Container format ('ogg' | 'wav'). Defaults to 'ogg' or inferred from data URI.
   */
  static async saveAudioBase64(
    base64Data: string,
    format?: 'ogg' | 'wav'
  ): Promise<AudioSaveResult> {
    if (!base64Data || typeof base64Data !== 'string') {
      throw new Error('Invalid audio data: base64 string is required');
    }

    // Determine target format
    let targetFormat: 'ogg' | 'wav' = format || 'ogg';
    if (!format) {
      if (base64Data.startsWith('data:audio/wav')) {
        targetFormat = 'wav';
      } else {
        targetFormat = 'ogg';
      }
    }

    // Strip data URI scheme if present (e.g. data:audio/ogg;codecs=opus;base64,...)
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').trim();
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      throw new Error('Decoded audio buffer is empty');
    }

    // Prepare destination directory
    const dir = this.getRecordingsDir();

    // Timestamp formatting: YYYYMMDD_HHMMSS
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const HH = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const timestamp = `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;

    let filename = `voice_prompt_${timestamp}.${targetFormat}`;
    let filePath = path.join(dir, filename);

    // Collision avoidance if multiple recordings occur in the same second
    let counter = 1;
    while (fs.existsSync(filePath)) {
      filename = `voice_prompt_${timestamp}_${counter}.${targetFormat}`;
      filePath = path.join(dir, filename);
      counter++;
    }

    // Write binary buffer to disk
    await fs.promises.writeFile(filePath, buffer);

    // Calculate approximate duration for WAV files if valid RIFF header exists
    let durationSec: number | undefined;
    if (targetFormat === 'wav' && buffer.length >= 44) {
      try {
        if (
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WAVE'
        ) {
          const byteRate = buffer.readUInt32LE(28);
          if (byteRate > 0) {
            durationSec = Math.round(((buffer.length - 44) / byteRate) * 10) / 10;
          }
        }
      } catch {
        // Leave durationSec undefined on parse failure
      }
    }

    const result: AudioSaveResult = {
      filePath,
      durationSec,
      format: targetFormat,
      sizeBytes: buffer.length
    };

    // Enable transparent string coercion so callers treating result as string (e.g. `${result}`) get the file path
    Object.defineProperty(result, 'toString', {
      value: () => filePath,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(result, 'valueOf', {
      value: () => filePath,
      enumerable: false,
      configurable: true
    });

    return result;
  }

  /**
   * Cleans up recordings older than maxAgeHours (default: 24 hours).
   * Safe execution that silently ignores individual file access errors.
   */
  static cleanupOldFiles(maxAgeHours: number = 24): void {
    try {
      const dir = this.getRecordingsDir();
      if (!fs.existsSync(dir)) {
        return;
      }

      const files = fs.readdirSync(dir);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('voice_prompt_')) {
          continue;
        }
        const fullPath = path.join(dir, file);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && (now - stats.mtimeMs > maxAgeMs)) {
            fs.unlinkSync(fullPath);
          }
        } catch {
          // Ignore individual file errors (e.g. locked or deleted)
        }
      }
    } catch (error) {
      console.error('[AudioEngine] Error during cleanupOldFiles:', error);
    }
  }
}
