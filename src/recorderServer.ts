import * as http from 'http';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { NativeAudioRecorder } from './nativeAudioRecorder';

export class RecorderServer {
  private static server: http.Server | null = null;
  public static readonly PORT = 45454;
  private static startTime: number = 0;

  public static start(extensionUri: vscode.Uri): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve();
        return;
      }

      const s = http.createServer(async (req, res) => {
        // Universal CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        const url = req.url || '';

        try {
          if (url === '/start' && req.method === 'POST') {
            if (NativeAudioRecorder.isRecording()) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, alreadyRecording: true }));
              return;
            }

            this.startTime = Date.now();
            await NativeAudioRecorder.startRecording(extensionUri);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } else if (url === '/stop' && req.method === 'POST') {
            if (!NativeAudioRecorder.isRecording()) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'Not recording' }));
              return;
            }

            const filePath = await NativeAudioRecorder.stopRecording();
            const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 1;
            this.startTime = 0;

            if (fs.existsSync(filePath)) {
              const buffer = fs.readFileSync(filePath);
              const isOgg = filePath.toLowerCase().endsWith('.ogg');
              const mimeType = isOgg ? 'audio/ogg' : 'audio/wav';

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  ok: true,
                  base64: buffer.toString('base64'),
                  mimeType,
                  duration,
                  filePath
                })
              );
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'Recorded file not found on disk' }));
            }
          } else if (url === '/cancel' && req.method === 'POST') {
            NativeAudioRecorder.cancelRecording();
            this.startTime = 0;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } else if (url === '/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                ok: true,
                isRecording: NativeAudioRecorder.isRecording(),
                elapsedSec: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
              })
            );
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Not found' }));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: msg }));
        }
      });

      s.on('error', (e: NodeJS.ErrnoException) => {
        if (e.code === 'EADDRINUSE') {
          // Port already in use (e.g. from previous window or reload), treat as ready
          resolve();
        } else {
          reject(e);
        }
      });

      s.listen(this.PORT, '127.0.0.1', () => {
        this.server = s;
        resolve();
      });
    });
  }

  public static stop(): void {
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }
  }
}
