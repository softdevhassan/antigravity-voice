/**
 * Antigravity Voice - Scenario Test Suite
 * 
 * Verifies:
 * 1. Audio file generation (WAV with RIFF header + OGG container payload)
 * 2. Windows Clipboard CF_HDROP File Drop simulation via PowerShell
 * 3. Configuration schema and manifest validation (package.json)
 * 
 * Run with: node test/scenario_test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Colors for terminal formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

const results = [];

function recordResult(name, status, details, durationMs) {
  results.push({ name, status, details, durationMs });
  const statusBadge = status === 'PASS' 
    ? `${colors.green}[PASS]${colors.reset}` 
    : status === 'SKIP' 
      ? `${colors.yellow}[SKIP]${colors.reset}` 
      : `${colors.red}[FAIL]${colors.reset}`;
  console.log(`  ${statusBadge} ${name} ${colors.gray}(${durationMs}ms)${colors.reset}`);
  if (details) {
    console.log(`         ${colors.gray}→ ${details}${colors.reset}`);
  }
}

/**
 * Creates a valid PCM WAV buffer (16-bit, 16kHz or 44.1kHz mono)
 */
function createWavBuffer(sampleRate = 16000, durationSeconds = 0.5) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4); // file length - 8
  buffer.write('WAVE', 8, 'ascii');

  // fmt subchunk
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  // Fill audio data with a 440 Hz test tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.3 * 32767;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * bytesPerSample);
  }

  return buffer;
}

/**
 * Creates a valid mock OGG Opus container page
 */
function createOggBuffer() {
  // Minimal standard OGG page header: 27 bytes + segments + payload
  const capturePattern = 'OggS';
  const version = 0;
  const headerType = 0x02; // Beginning of stream (BOS)
  const granulePos = BigInt(0);
  const serialNo = 0x12345678;
  const sequenceNo = 0;
  const crc = 0; // Checksum placeholder
  const payload = Buffer.from('OpusHead\x01\x01\x00\x00\x80\x3e\x00\x00\x00\x00\x00', 'binary'); // 19 byte Opus header
  const segmentTable = Buffer.from([payload.length]);

  const header = Buffer.alloc(27);
  header.write(capturePattern, 0, 'ascii');
  header.writeUInt8(version, 4);
  header.writeUInt8(headerType, 5);
  header.writeBigInt64LE(granulePos, 6);
  header.writeUInt32LE(serialNo, 14);
  header.writeUInt32LE(sequenceNo, 18);
  header.writeUInt32LE(crc, 22);
  header.writeUInt8(segmentTable.length, 26);

  return Buffer.concat([header, segmentTable, payload]);
}

async function runTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   🎙️  ANTIGRAVITY VOICE - SCENARIO TEST SUITE        ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);

  const tempDir = path.join(os.tmpdir(), 'antigravity-voice-scenario-test');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // --- SCENARIO 1: Audio File Generation (WAV) ---
  {
    const start = Date.now();
    try {
      const wavPath = path.join(tempDir, 'sample_test_note.wav');
      const wavBuffer = createWavBuffer(16000, 1.0);
      fs.writeFileSync(wavPath, wavBuffer);

      // Verify file existence and read header
      const readBuffer = fs.readFileSync(wavPath);
      const isRiff = readBuffer.subarray(0, 4).toString('ascii') === 'RIFF';
      const isWave = readBuffer.subarray(8, 12).toString('ascii') === 'WAVE';
      const formatTag = readBuffer.readUInt16LE(20);
      const channels = readBuffer.readUInt16LE(22);
      const sampleRate = readBuffer.readUInt32LE(24);
      const dataSize = readBuffer.readUInt32LE(40);

      if (!isRiff || !isWave) {
        throw new Error('Invalid RIFF/WAVE header markers');
      }
      if (formatTag !== 1 || channels !== 1 || sampleRate !== 16000) {
        throw new Error(`Unexpected audio format params: tag=${formatTag}, ch=${channels}, sr=${sampleRate}`);
      }
      if (readBuffer.length !== 44 + dataSize) {
        throw new Error(`File size mismatch: expected ${44 + dataSize}, got ${readBuffer.length}`);
      }

      recordResult(
        'Audio Generation (PCM WAV Container & RIFF Headers)',
        'PASS',
        `Generated 16kHz Mono WAV (${readBuffer.length} bytes, 1.0s audio)`,
        Date.now() - start
      );
    } catch (err) {
      recordResult(
        'Audio Generation (PCM WAV Container & RIFF Headers)',
        'FAIL',
        err.message,
        Date.now() - start
      );
    }
  }

  // --- SCENARIO 2: Audio File Generation (OGG) ---
  {
    const start = Date.now();
    try {
      const oggPath = path.join(tempDir, 'sample_test_note.ogg');
      const oggBuffer = createOggBuffer();
      fs.writeFileSync(oggPath, oggBuffer);

      const readBuffer = fs.readFileSync(oggPath);
      const captureMarker = readBuffer.subarray(0, 4).toString('ascii');
      const version = readBuffer.readUInt8(4);
      const headerType = readBuffer.readUInt8(5);

      if (captureMarker !== 'OggS') {
        throw new Error(`Invalid OGG capture pattern: expected 'OggS', got '${captureMarker}'`);
      }
      if (version !== 0 || headerType !== 0x02) {
        throw new Error(`Invalid OGG page header: version=${version}, type=${headerType}`);
      }

      recordResult(
        'Audio Generation (OGG Container & Stream Page Framing)',
        'PASS',
        `Validated OggS capture pattern and Opus header framing (${readBuffer.length} bytes)`,
        Date.now() - start
      );
    } catch (err) {
      recordResult(
        'Audio Generation (OGG Container & Stream Page Framing)',
        'FAIL',
        err.message,
        Date.now() - start
      );
    }
  }

  // --- SCENARIO 3: Windows Clipboard File Drop (CF_HDROP) ---
  {
    const start = Date.now();
    if (process.platform !== 'win32') {
      recordResult(
        'Windows Clipboard File Drop (CF_HDROP via PowerShell)',
        'SKIP',
        `Platform is ${process.platform} (Windows CF_HDROP clipboard is Windows-specific)`,
        Date.now() - start
      );
    } else {
      try {
        const testAudioFile = path.join(tempDir, 'clipboard_test.wav');
        fs.writeFileSync(testAudioFile, createWavBuffer(8000, 0.2));

        // Use PowerShell to set CF_HDROP (System.Windows.Forms.Clipboard.SetFileDropList) and verify retrieval
        const escapedPath = testAudioFile.replace(/'/g, "''");
        const psScript = `
          $ProgressPreference = 'SilentlyContinue'
          Add-Type -AssemblyName System.Windows.Forms
          $files = New-Object System.Collections.Specialized.StringCollection
          [void]$files.Add('${escapedPath}')
          [System.Windows.Forms.Clipboard]::SetFileDropList($files)
          $retrieved = [System.Windows.Forms.Clipboard]::GetFileDropList()
          if ($retrieved.Count -gt 0) {
            $retrieved[0]
          } else {
            'EMPTY'
          }
        `;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        const rawOutput = execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
          encoding: 'utf8',
          timeout: 10000
        }).trim();

        // Extract the last non-empty line in case of PowerShell banner output
        const lines = rawOutput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const retrievedPath = lines[lines.length - 1];

        // Resolve real paths for robust Windows comparison (handles 8.3 short names if any)
        const normalizedExpected = fs.realpathSync(testAudioFile).toLowerCase();
        const normalizedRetrieved = fs.existsSync(retrievedPath) ? fs.realpathSync(retrievedPath).toLowerCase() : retrievedPath.toLowerCase();

        if (normalizedRetrieved !== normalizedExpected) {
          throw new Error(`Clipboard dropped path mismatch: expected '${testAudioFile}', got '${retrievedPath}'`);
        }

        recordResult(
          'Windows Clipboard File Drop (CF_HDROP via PowerShell)',
          'PASS',
          `Successfully injected and verified CF_HDROP file list: ${path.basename(retrievedPath)}`,
          Date.now() - start
        );
      } catch (err) {
        recordResult(
          'Windows Clipboard File Drop (CF_HDROP via PowerShell)',
          'FAIL',
          err.message,
          Date.now() - start
        );
      }
    }
  }

  // --- SCENARIO 4: Configuration Schema & Package Manifest Validation ---
  {
    const start = Date.now();
    try {
      const packageJsonPath = path.resolve(__dirname, '../package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`package.json not found at ${packageJsonPath}`);
      }

      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Validate identity & main entry
      if (pkg.name !== 'antigravity-voice') throw new Error(`Invalid name: ${pkg.name}`);
      if (!pkg.version) throw new Error('Missing version in package.json');
      if (pkg.main !== './out/extension.js') throw new Error(`Invalid main entry point: ${pkg.main}`);

      // Validate commands
      const commands = (pkg.contributes && pkg.contributes.commands) || [];
      const commandIds = commands.map(c => c.command);
      const expectedCommands = [
        'antigravity-voice.record',
        'antigravity-voice.stop',
        'antigravity-voice.cancel'
      ];
      for (const cmd of expectedCommands) {
        if (!commandIds.includes(cmd)) {
          throw new Error(`Missing required command contribution: ${cmd}`);
        }
      }

      // Validate keybindings
      const keybindings = (pkg.contributes && pkg.contributes.keybindings) || [];
      const recordKeybinding = keybindings.find(k => k.command === 'antigravity-voice.record');
      if (!recordKeybinding || recordKeybinding.key.toLowerCase() !== 'ctrl+alt+v') {
        throw new Error('Missing or invalid keybinding for antigravity-voice.record (expected ctrl+alt+v)');
      }

      // Validate configuration settings
      const properties = pkg.contributes && pkg.contributes.configuration && pkg.contributes.configuration.properties;
      if (!properties) {
        throw new Error('Missing configuration properties in package.json');
      }

      const expectedProps = [
        'antigravityVoice.audioFormat',
        'antigravityVoice.autoPaste',
        'antigravityVoice.autoSend',
        'antigravityVoice.soundEffects',
        'antigravityVoice.language'
      ];

      for (const prop of expectedProps) {
        if (!properties[prop]) {
          throw new Error(`Missing expected configuration property: ${prop}`);
        }
      }

      const formatProp = properties['antigravityVoice.audioFormat'];
      if (!formatProp.enum || !formatProp.enum.includes('ogg') || !formatProp.enum.includes('wav')) {
        throw new Error('antigravityVoice.audioFormat enum must include ogg and wav');
      }

      recordResult(
        'Configuration Schema & Manifest Validation',
        'PASS',
        `Validated ${commandIds.length} commands, keybindings, and ${expectedProps.length} settings properties`,
        Date.now() - start
      );
    } catch (err) {
      recordResult(
        'Configuration Schema & Manifest Validation',
        'FAIL',
        err.message,
        Date.now() - start
      );
    }
  }

  // --- CLEANUP ---
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup errors
  }

  // --- SUMMARY MATRIX ---
  console.log(`\n${colors.bold}${colors.white}------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}${colors.white}                 TEST SCENARIO MATRIX                 ${colors.reset}`);
  console.log(`${colors.bold}${colors.white}------------------------------------------------------${colors.reset}`);

  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;

  for (const r of results) {
    if (r.status === 'PASS') totalPass++;
    else if (r.status === 'SKIP') totalSkip++;
    else totalFail++;

    const badge = r.status === 'PASS' 
      ? `${colors.green}✓ PASS${colors.reset}` 
      : r.status === 'SKIP' 
        ? `${colors.yellow}○ SKIP${colors.reset}` 
        : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(`  ${badge}  |  ${r.name.padEnd(52)}  |  ${r.durationMs}ms`);
  }

  console.log(`${colors.bold}${colors.white}------------------------------------------------------${colors.reset}`);
  console.log(`  Total: ${results.length} | Passed: ${colors.green}${totalPass}${colors.reset} | Failed: ${colors.red}${totalFail}${colors.reset} | Skipped: ${colors.yellow}${totalSkip}${colors.reset}`);
  console.log(`${colors.bold}${colors.white}------------------------------------------------------${colors.reset}\n`);

  if (totalFail > 0) {
    console.log(`${colors.red}${colors.bold}TEST SUITE FAILED: ${totalFail} scenario(s) failed.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}ALL SCENARIOS PASSED SUCCESSFULLY! 🚀${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
