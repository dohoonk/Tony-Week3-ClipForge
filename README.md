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

### System Requirements
- **macOS 12+** (Intel or Apple Silicon)
- **Node.js 18+** and npm (verify with `node --version` and `npm --version`)
- **FFmpeg/FFprobe** available on PATH (for development; bundled in packaged builds)

### Optional Dependencies
- **Whisper.cpp binaries** (bundled in packaged app, optional for dev)
- **OpenAI API key** (optional, for Script Review feature)

### Installing FFmpeg (Development)

**macOS (Homebrew):**
```bash
brew install ffmpeg

# Verify installation
ffmpeg -version
ffprobe -version
```

---

## 🚀 Development

### Quick Start

```bash
# Install dependencies
npm install

# Start development server (Vite + Electron)
npm run dev
```

### Development Scripts

```bash
# Start both Vite and Electron (recommended)
npm run dev

# Start only Vite dev server
npm run dev:vite

# Start only Electron (after Vite is running)
npm run dev:electron
```

### Development Behavior

- **Hot Module Replacement**: React components auto-reload on save
- **TypeScript**: Type checking runs in background (check terminal for errors)
- **Dev Tools**: Available via `Cmd+Option+I` on macOS
- **Console Logs**: 
  - Main process logs in terminal
  - Renderer logs in Electron DevTools console

### Development Server

- **Vite Dev Server**: Runs on `http://localhost:5173/`
- **Electron**: Launches automatically after Vite is ready
- **Auto-reload**: Code changes trigger automatic reload

### Troubleshooting Development

**Port 5173 already in use:**
```bash
lsof -ti:5173 | xargs kill -9
```

**Electron window doesn't open:**
- Check terminal for errors
- Ensure Vite is running on `http://localhost:5173/`
- Try restarting: `npm run dev`

**FFmpeg not found:**
- Install FFmpeg: `brew install ffmpeg`
- Verify installation: `which ffmpeg`
- Development uses system FFmpeg; packaged builds use bundled binaries

## 🛠️ Build

```bash
# compile main (tsc) and renderer (vite)
npm run build
```

Outputs:
- `dist/main/` (Electron main)
- `dist/renderer/` (bundled renderer)

### Detailed Build Instructions

The build process consists of two steps:

**1. Main Process Build:**
```bash
npm run build:main
# Compiles TypeScript files in src/main/ → dist/main/
# Uses tsconfig.main.json configuration
```

**2. Renderer Build:**
```bash
npm run build:renderer
# Bundles React app with Vite → dist/renderer/
# Optimizes and minifies production code
```

**Production Build Features:**
- **Minification**: JavaScript and CSS are minified
- **Tree Shaking**: Unused code is removed
- **Source Maps**: Generated for debugging
- **Type Checking**: TypeScript errors will fail the build

---

## 📦 Packaging for Distribution

### Prerequisites

Before packaging, ensure you have:

1. **FFmpeg Binaries** in `bin/mac/`:
   ```bash
   mkdir -p bin/mac
   cp $(which ffmpeg) bin/mac/
   cp $(which ffprobe) bin/mac/
   chmod +x bin/mac/ffmpeg bin/mac/ffprobe
   ```

2. **Whisper Binaries** in `bin/whisper/darwin/`

3. **Model File** in `resources/models/whisper/ggml-base.en.bin`

### Creating DMG Installers

```bash
# Build the application first
npm run build

# Package for macOS (creates both x64 and arm64 DMGs)
npm run package:mac
```

### Package Outputs

After packaging, you'll find DMG files in `release/`:
- `InterviewMate-1.0.0.dmg` (Intel x64)
- `InterviewMate-1.0.0-arm64.dmg` (Apple Silicon)

See section below for installation and running instructions.

---

## 🚀 Running the Packaged Application

### Installation Steps

1. **Open the DMG**:
   ```bash
   open release/InterviewMate-1.0.0-arm64.dmg  # For Apple Silicon
   # or
   open release/InterviewMate-1.0.0.dmg        # For Intel Macs
   ```

2. **Drag to Applications**:
   - Drag `InterviewMate.app` from DMG to Applications folder

3. **Launch from Applications**:
   - Open Applications folder → Double-click `InterviewMate.app`

### Handling macOS Security (Unsigned Builds)

Since builds are currently unsigned, you may need to bypass Gatekeeper:

**Method 1: Right-click Open (Recommended)**
- Right-click `InterviewMate.app` → Open
- Click "Open" in the security dialog

**Method 2: Remove Quarantine Attribute**
```bash
xattr -dr com.apple.quarantine /Applications/InterviewMate.app
```

**Method 3: System Settings**
- System Preferences → Security & Privacy → Click "Open Anyway"

### First Launch

On first launch, the app will:
- Create user directories:
  - `~/.interviewmate/` (config and cache)
  - `~/Movies/InterviewMate/recordings/` (recordings)
- Request macOS permissions:
  - **Screen Recording**: Required for screen capture
  - **Camera**: Required for webcam recording  
  - **Microphone**: Required for audio recording

Grant permissions in System Preferences → Security & Privacy if prompted.

---

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

---

## 📋 Complete Development Workflow

### Full Setup from Scratch

```bash
# 1. Clone repository
git clone <repository-url>
cd Week3-ClipForge

# 2. Install dependencies
npm install

# 3. Install FFmpeg (for development)
brew install ffmpeg

# 4. Set up Whisper (if AI features needed)
# See WHISPER_SETUP.md for detailed instructions
# Or use pre-bundled binaries if available

# 5. Prepare FFmpeg for packaging
mkdir -p bin/mac
cp $(which ffmpeg) bin/mac/
cp $(which ffprobe) bin/mac/
chmod +x bin/mac/ffmpeg bin/mac/ffprobe

# 6. Build the application
npm run build

# 7. Package for distribution
npm run package:mac
```

### Development Workflow

```bash
# Daily development cycle
npm run dev          # Start dev server + Electron
# ... make changes ...
# Auto-reloads in browser
# Check terminal for errors

# Test build
npm run build        # Ensure production build works
npm run dev          # Test production build locally

# Before packaging
npm run build        # Fresh build
npm run package:mac  # Create DMGs
```

---

## 🔍 Verifying Your Setup

### Check Dependencies

```bash
# Node.js version (should be 18+)
node --version

# npm version
npm --version

# FFmpeg installation
ffmpeg -version
ffprobe -version

# FFmpeg in bin/mac (for packaging)
ls -lh bin/mac/ffmpeg bin/mac/ffprobe

# Whisper binary (for AI features)
ls -lh bin/whisper/darwin/whisper

# Whisper model (for AI features)
ls -lh resources/models/whisper/ggml-base.en.bin
```

### Test Build

```bash
# Clean build
rm -rf dist/
npm run build

# Verify outputs
ls -la dist/main/    # Should contain .js files
ls -la dist/renderer/  # Should contain index.html and assets/
```

### Test Packaging

```bash
# Clean previous packages
rm -rf release/

# Package
npm run package:mac

# Verify DMGs created
ls -lh release/*.dmg

# Test DMG (mount and check contents)
hdiutil attach release/InterviewMate-1.0.0-arm64.dmg
ls -la /Volumes/InterviewMate/
hdiutil detach /Volumes/InterviewMate/
```

---

## 📝 Additional Notes

- **Development**: System FFmpeg is used. Packaged builds use bundled binaries from `bin/mac/`.
- **AI Features**: Whisper.cpp binaries and model files are bundled in packaged app at `process.resourcesPath/bin/whisper/` and `process.resourcesPath/resources/models/whisper/`.
- **WebM Duration**: "Infinity duration" is handled via a guarded metadata workaround.
- **Bundle Size**: ~750 MB due to FFmpeg (~50MB), Whisper.cpp (~5MB), Model (~141MB), Electron (~150MB), and dependencies (~400MB).
- **Code Signing**: Currently unsigned. For distribution, you'll need an Apple Developer certificate.

---

Copyright © 2025