(function () {
  // Acquire the VS Code API
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // DOM Elements
  const canvas = document.getElementById('waveformCanvas');
  const canvasCtx = canvas ? canvas.getContext('2d') : null;
  const timerDisplay = document.getElementById('timerDisplay');
  const meterFill = document.getElementById('meterFill');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const btnDone = document.getElementById('btnDone');
  const btnPause = document.getElementById('btnPause');
  const pauseBtnLabel = document.getElementById('pauseBtnLabel');
  const btnCancel = document.getElementById('btnCancel');
  const alertBox = document.getElementById('alertBox');
  const deviceInfo = document.getElementById('deviceInfo');

  // Audio & Recording State
  let mediaStream = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let audioContext = null;
  let analyserNode = null;
  let dataArray = null;
  let animationFrameId = null;

  let isRecording = false;
  let isPaused = false;
  let startTime = 0;
  let pausedDuration = 0;
  let pauseStartTime = 0;
  let timerInterval = null;
  let selectedMimeType = '';
  let audioContainerFormat = 'ogg';

  // Determine best supported MIME type
  function getSupportedMimeType() {
    const candidates = [
      { mime: 'audio/webm;codecs=opus', format: 'webm' },
      { mime: 'audio/ogg;codecs=opus', format: 'ogg' },
      { mime: 'audio/webm', format: 'webm' },
      { mime: 'audio/ogg', format: 'ogg' },
      { mime: 'audio/mp4', format: 'mp4' }
    ];

    if (typeof MediaRecorder !== 'undefined') {
      for (const item of candidates) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(item.mime)) {
          return item;
        }
      }
    }
    return { mime: '', format: 'ogg' };
  }

  // Format seconds into MM:SS
  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');
    return `${mStr}:${sStr}`;
  }

  // Timer runner
  function updateTimer() {
    if (!isRecording || isPaused) {
      return;
    }
    const elapsedMs = Date.now() - startTime - pausedDuration;
    const elapsedSec = Math.max(0, elapsedMs / 1000);
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(elapsedSec);
    }
  }

  // Error Alert Helper
  function showError(msg) {
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
    }
    vscode.postMessage({
      type: 'error',
      message: msg
    });
  }

  // Initialize Microphone & Recording
  async function initRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Web Audio / MediaDevices API is not supported in this environment.');
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Display device label if available
      const track = mediaStream.getAudioTracks()[0];
      if (track && deviceInfo) {
        deviceInfo.textContent = track.label ? `Mic: ${track.label.substring(0, 24)}` : 'Microphone connected';
      }

      // Setup Web Audio Analyser
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const sourceNode = audioContext.createMediaStreamSource(mediaStream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 512;
      analyserNode.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyserNode);

      const bufferLength = analyserNode.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      // Setup MediaRecorder
      const supported = getSupportedMimeType();
      selectedMimeType = supported.mime;
      audioContainerFormat = supported.format;

      const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
      mediaRecorder = new MediaRecorder(mediaStream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        handleRecordingComplete();
      };

      audioChunks = [];
      mediaRecorder.start(100); // 100ms time slice

      isRecording = true;
      isPaused = false;
      startTime = Date.now();
      pausedDuration = 0;
      timerInterval = setInterval(updateTimer, 200);

      renderWaveform();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Microphone access failed: ${message}`);
    }
  }

  // Draw Audio Waveform on Canvas
  function renderWaveform() {
    if (!canvas || !canvasCtx) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    canvasCtx.clearRect(0, 0, width, height);

    if (analyserNode && dataArray && isRecording && !isPaused) {
      analyserNode.getByteTimeDomainData(dataArray);

      // Compute RMS volume for the level meter
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const levelPercent = Math.min(100, Math.round(rms * 280));
      if (meterFill) {
        meterFill.style.width = `${levelPercent}%`;
      }

      // Draw subtle background grid lines
      canvasCtx.lineWidth = 1;
      canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, height / 2);
      canvasCtx.lineTo(width, height / 2);
      canvasCtx.stroke();

      // Draw Oscilloscope Glow Line
      const gradient = canvasCtx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#06b6d4');   // neon cyan
      gradient.addColorStop(0.5, '#6366f1'); // vibrant indigo
      gradient.addColorStop(1, '#a855f7');   // purple/violet

      canvasCtx.lineWidth = 2.5;
      canvasCtx.strokeStyle = gradient;
      canvasCtx.shadowBlur = 10;
      canvasCtx.shadowColor = 'rgba(99, 102, 241, 0.7)';
      canvasCtx.beginPath();

      const sliceWidth = width / (dataArray.length - 1);
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      canvasCtx.lineTo(width, height / 2);
      canvasCtx.stroke();
      canvasCtx.shadowBlur = 0;
    } else {
      // Idle / Paused line
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = isPaused ? 'rgba(234, 179, 8, 0.4)' : 'rgba(99, 102, 241, 0.3)';
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, height / 2);
      canvasCtx.lineTo(width, height / 2);
      canvasCtx.stroke();

      if (meterFill) {
        meterFill.style.width = '0%';
      }
    }

    animationFrameId = requestAnimationFrame(renderWaveform);
  }

  // Toggle Pause / Resume
  function togglePause() {
    if (!mediaRecorder || !isRecording) {
      return;
    }

    if (!isPaused) {
      // Pause
      mediaRecorder.pause();
      isPaused = true;
      pauseStartTime = Date.now();

      if (statusBadge) {
        statusBadge.classList.add('paused');
      }
      if (statusText) {
        statusText.textContent = 'Paused';
      }
      if (pauseBtnLabel) {
        pauseBtnLabel.textContent = '▶ Resume';
      }
    } else {
      // Resume
      pausedDuration += Date.now() - pauseStartTime;
      mediaRecorder.resume();
      isPaused = false;

      if (statusBadge) {
        statusBadge.classList.remove('paused');
      }
      if (statusText) {
        statusText.textContent = 'Recording';
      }
      if (pauseBtnLabel) {
        pauseBtnLabel.textContent = '⏸ Pause';
      }
    }
  }

  // Finish Recording
  function finishRecording() {
    if (!mediaRecorder || !isRecording) {
      return;
    }
    isRecording = false;

    // Disable buttons to prevent duplicate triggers
    if (btnDone) { btnDone.setAttribute('disabled', 'true'); }
    if (btnPause) { btnPause.setAttribute('disabled', 'true'); }
    if (btnCancel) { btnCancel.setAttribute('disabled', 'true'); }

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      handleRecordingComplete();
    }
  }

  // Cancel Recording
  function cancelRecording() {
    isRecording = false;

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    cleanupAudioResources();

    vscode.postMessage({
      type: 'cancel'
    });
  }

  // Clean up Web Audio and MediaStream
  function cleanupAudioResources() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }

    if (audioContext) {
      try {
        audioContext.close();
      } catch (e) {
        // ignore
      }
      audioContext = null;
    }
  }

  // Process and convert audio blob to base64
  function handleRecordingComplete() {
    cleanupAudioResources();

    if (!audioChunks || audioChunks.length === 0) {
      showError('No audio data was captured.');
      return;
    }

    const mime = selectedMimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunks, { type: mime });

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64Index = result.indexOf('base64,');
        const base64Data = base64Index !== -1 ? result.substring(base64Index + 7) : result;

        vscode.postMessage({
          type: 'audio-ready',
          base64: base64Data,
          format: audioContainerFormat
        });
      } else {
        showError('Failed to read recorded audio data.');
      }
    };

    reader.onerror = () => {
      showError('FileReader error occurred during audio processing.');
    };

    reader.readAsDataURL(audioBlob);
  }

  // Attach DOM Listeners
  if (btnDone) {
    btnDone.addEventListener('click', finishRecording);
  }

  if (btnPause) {
    btnPause.addEventListener('click', togglePause);
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', cancelRecording);
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishRecording();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelRecording();
    } else if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      togglePause();
    }
  });

  // Start recording as soon as Webview mounts
  window.addEventListener('load', () => {
    initRecording();
  });
})();
