# Antigravity Voice

> Created by **Hassan Ali** ([softdevhassan.com](https://softdevhassan.com))  
> Social: [@softdevhassan](https://softdevhassan.com)

Native voice messaging and prompt recording tool for Google Antigravity IDE.

---

## Overview

Recent updates to Antigravity IDE discontinued direct microphone input in the AI panel. This tool restores voice workflows by capturing audio locally on Windows and attaching it straight into the active AI conversation.

- **Direct Capture**: Records 16-bit PCM mono audio using Windows audio APIs without sandbox permission prompts.
- **Auto Attachment**: Uses clipboard data descriptors and focus automation to attach recordings right into the prompt bar.
- **Multilingual Support**: Supports voice prompting in Urdu, Roman Urdu, English, Hindi, and regional dialects.
- **One-Click Hotkey**: Toggle recording instantly with `Ctrl + Alt + V`.

---

## Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Ctrl + Alt + V` | Start or stop voice recording |
| `Escape` | Cancel recording and discard audio |

---

## How It Works

1. Press `Ctrl + Alt + V` or click **Voice Note** in the status bar.
2. Speak your instructions or thoughts in any language.
3. Press `Ctrl + Alt + V` again to finish.
4. The recording attaches to the chat panel, ready to send.

---

## Configuration

In Antigravity IDE Settings (`Ctrl + ,`):

- `antigravityVoice.audioFormat`: Choose between `ogg` (Opus) and `wav`.
- `antigravityVoice.autoPaste`: Automatically paste recording into chat (default: `true`).
- `antigravityVoice.autoSend`: Automatically send prompt upon attachment (default: `false`).

---

## Author & Attribution

- **Author**: Hassan Ali
- **Website**: [softdevhassan.com](https://softdevhassan.com)
- **License**: MIT
