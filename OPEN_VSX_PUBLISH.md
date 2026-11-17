# Open VSX Marketplace Publishing Guide

This document contains everything needed to publish **Antigravity Voice** to the Open VSX Registry (the extension engine used by Antigravity IDE and open-source VS Code distributions).

---

## Extension Metadata

- **Extension Name**: `antigravity-voice`
- **Display Name**: `Antigravity Voice`
- **Publisher Namespace**: `softdevhassan`
- **Author**: `Hassan Ali`
- **Homepage / Author URL**: `https://softdevhassan.com`
- **Repository**: `https://github.com/softdevhassan/antigravity-voice`
- **Categories**: `AI`, `Other`
- **Tags / Keywords**: `antigravity`, `voice`, `audio`, `speech`, `ai`, `gemini`, `microphone`, `voice-notes`
- **Short Summary**:
  > Native voice prompts and speech recording with automatic attachment in Antigravity AI Chat. Restores microphone dictation in any language.

---

## Option 1: Web UI Upload (Easiest)

1. Navigate to [open-vsx.org](https://open-vsx.org).
2. Log in using your GitHub account (`softdevhassan`).
3. Click your profile avatar in the upper right and select **Manage Extensions**.
4. If the namespace `softdevhassan` is not yet created, click **Create Namespace** and enter `softdevhassan`.
5. Click **Publish Extension**.
6. Drag and drop `antigravity-voice-1.0.0.vsix` into the upload field.
7. Confirm details and submit. The extension will be available immediately to all Antigravity IDE users.

---

## Option 2: CLI Publishing (`ovsx`)

Run from your terminal in `D:\PROJECTS\Experiments\add-voice-feature-to-antigravity`:

```bash
# 1. Install ovsx publishing tool
pnpm dlx ovsx --help

# 2. Publish package with your Open VSX personal access token
pnpm dlx ovsx publish antigravity-voice-1.0.0.vsix -p <YOUR_ACCESS_TOKEN>
```

---

## Local Installation in Antigravity IDE

Users can also install directly from the `.vsix` file:

1. Open Antigravity IDE.
2. Press `Ctrl + Shift + X` to open the Extensions view.
3. Click the `...` menu icon at the top of the Extensions view.
4. Select **Install from VSIX...**
5. Select `antigravity-voice-1.0.0.vsix`.
