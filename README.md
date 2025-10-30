# InterviewMate

Desktop Electron video editor for interview preparation and editing: record (Screen/Webcam/PiP), arrange on a multi-track timeline, preview, and export with AI-powered filler removal.

## ✨ Features

- **Multi-track timeline editor**
  - Drag from Media Library; cross-track drag-drop
  - Trim handles; track visibility; adjustable track heights
  - Global playhead with smooth DOM transform animation
  - Continuous playback; gaps show black until the next clip

- **Recording**
  - Screen, Webcam, PiP (Screen + Webcam) with live preview
  - Auto-import to Media Library from `~/Movies/InterviewMate/recordings/`

- **Project IO**
  - Robust serialize/deserialize; preserves empty tracks and correct order

- **Playback**
  - Decoder-synced playhead (requestVideoFrameCallback with rAF fallback)
  - Timeline-first behavior: no auto-jump when starting in gaps

- **Export (FFmpeg)**
  - Per-item trim/offset, concat to MP4 (H.264)
  - Handles silent inputs (video-only export when no audio)

- **AI-Powered Features**
  - Automatic filler word detection and removal
  - Script review and improvement suggestions
  - Local Whisper.cpp transcription (no cloud required)

## ✅ Requirements

- macOS 12+
- Node.js 18+ and npm
- FFmpeg/FFprobe available on PATH (recommended in dev)

## 🚀 Development

```bash
# install deps
npm install

# run (Vite + Electron)
npm run dev
```

- Vite dev server: `http://localhost:5173/`
- Electron main process launches after Vite is ready.

## 🛠️ Build

```bash
# compile main (tsc) and renderer (vite)
npm run build
```

Outputs:
- `dist/main/` (Electron main)
- `dist/renderer/` (bundled renderer)

## 📦 Package (macOS)

```bash
# build unsigned DMGs for Intel and Apple Silicon
npm run package:mac
```

Artifacts in `release/`:
- `InterviewMate-<version>.dmg` (Intel x64)
- `InterviewMate-<version>-arm64.dmg` (Apple Silicon)

Unsigned app: right-click → Open. If Gatekeeper blocks:
```bash
xattr -dr com.apple.quarantine /Applications/InterviewMate.app
```

## 🧭 Workflow

1) Import media (Media Library → Import, or drag files)
2) Build a sequence (drag to timeline, trim with handles, set visibility)
3) Preview (Play; black on gaps; seamless advance at clip starts)
4) Save/Load project
5) Export to MP4 (FFmpeg)

## 🔧 Troubleshooting

- **Playback jumps at seams**
  - End boundaries are exclusive with a small epsilon; ensure no overlaps.

- **Play from gaps**
  - Starting in a gap keeps video paused and advances the timeline until the next clip.

- **Export: "Error binding filtergraph inputs/outputs"**
  - Silent inputs: export now skips audio concat and maps video-only (-an).

- **Electron security warnings**
  - Expected in dev; disappear in packaged builds.

## 🗑️ Uninstall/Reinstall (macOS)

1) Quit InterviewMate
2) Delete `/Applications/InterviewMate.app`
3) Optional reset: `~/Library/Application Support/InterviewMate/`, `~/.interviewmate/`, `~/Movies/InterviewMate/`
4) Install the correct DMG (x64 for Intel, arm64 for Apple Silicon)

## 📁 Project Structure

```
src/
├─ main/           # Electron main, IPC, FFmpeg wrapper
├─ preload/        # Context bridge
├─ renderer/       # React UI (Vite), Zustand store
└─ shared/         # Shared types
```

## 📝 Notes

- In dev, system FFmpeg is used. Packaged builds set paths via the wrapper.
- AI features require Whisper.cpp binaries and model files (bundled in packaged app).
- WebM "Infinity duration" is handled via a guarded metadata workaround.

---

Copyright © 2025