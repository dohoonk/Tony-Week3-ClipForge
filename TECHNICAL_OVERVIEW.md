# InterviewMate - Technical Overview Script

## 1. Introduction & Overview (30 seconds)

**"InterviewMate is a desktop video editor specifically designed for interview preparation and practice. Built with Electron, it combines traditional video editing capabilities with AI-powered features like automatic filler word removal and script review."**

### Key Statistics:
- **Platform**: macOS (Universal - Intel & Apple Silicon)
- **Bundle Size**: ~750 MB (includes FFmpeg + Whisper.cpp + model)
- **Tech Stack**: Electron + React + TypeScript + FFmpeg + Whisper.cpp
- **Primary Use Case**: Interview preparation video editing with AI assistance

---

## 2. High-Level Architecture (1 minute)

**"InterviewMate follows a three-process Electron architecture for security and performance:"**

### Process Topology:

```
┌─────────────────────────────────────────┐
│     Electron Main Process (Node.js)     │
│  • App lifecycle & window management    │
│  • File I/O (secure, sandboxed)         │
│  • FFmpeg video processing              │
│  • Whisper.cpp transcription            │
│  • Recording service                    │
│  • Project persistence                  │
└──────────────┬──────────────────────────┘
               │
               │ IPC (ContextBridge - Secure)
               │
┌──────────────▼──────────────────────────┐
│          Preload Script                 │
│  • Exposes window.interviewmate API     │
│  • Type-safe IPC surface                │
│  • Event listeners for progress         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    Renderer (React + TypeScript)        │
│  • UI Components (Timeline, Player)     │
│  • State Management (Zustand)           │
│  • Real-time preview                    │
│  • AI Assistant panels                  │
└─────────────────────────────────────────┘
```

### Key Architectural Principles:
1. **Security First**: Main process handles all file access; renderer is sandboxed
2. **Performance**: Virtualization, throttling, GPU-accelerated transforms
3. **Offline Capable**: All AI features run locally (no cloud dependencies)

---

## 3. Technology Stack (1 minute)

### Core Framework
- **Electron v39**: Desktop application runtime
- **React v19**: UI component library with hooks
- **TypeScript**: Type-safe JavaScript for reliability
- **Vite**: Fast build tool and dev server

### Video Processing
- **FFmpeg/FFprobe**: Bundled binaries for cross-platform compatibility
- **fluent-ffmpeg**: Node.js wrapper for FFmpeg operations
- **HTML5 Video**: Native browser playback for preview

### AI & Machine Learning
- **Whisper.cpp**: Local speech-to-text (offline transcription)
- **Model**: ggml-base.en.bin (~141MB) - Optimized for English
- **OpenAI API**: GPT-4o-mini for script review (optional feature)

### State Management & UI
- **Zustand**: Lightweight state management (no Redux overhead)
- **TailwindCSS v4**: Utility-first CSS framework
- **react-third**: Not used yet (future for effects)

### Packaging
- **electron-builder**: Creates DMG installers for macOS
- **Universal Binaries**: Supports both Intel (x64) and Apple Silicon (arm64)

---

## 4. Key Features & Implementation (2 minutes)

### 4.1 Multi-Track Timeline Editor

**"Our timeline uses a flat state structure for undo/redo compatibility:"**

```typescript
// Runtime state (flat for performance)
trackItems: Record<string, TrackItem>
  → { id, clipId, trackId, inSec, outSec, position }

// Persistence (nested for readability)
tracks: Track[]
  → { id, kind, order, items: TrackItem[] }
```

**Key Features:**
- Drag-and-drop from media library
- Trim handles for in/out point adjustment
- Split clips at playhead position
- Snap-to-grid and snap-to-edges
- Resizable timeline height
- Virtualized rendering for performance (react-window)

### 4.2 Recording System

**"Three recording modes: Screen, Webcam, and Picture-in-Picture (PiP):"**

- **Screen Capture**: Uses Electron's `desktopCapturer` API
- **Webcam**: HTML5 `getUserMedia` API
- **PiP Overlay**: FFmpeg post-processing combines screen + webcam with overlay filter

**Recording Flow:**
1. User selects source → MediaRecorder starts
2. Blobs saved to `~/Movies/InterviewMate/recordings/`
3. Auto-import to media library after completion
4. Metadata probed with FFprobe

### 4.3 AI-Powered Features

#### A) Filler Word Detection & Removal

**"Our AI pipeline is completely offline and uses local Whisper.cpp:"**

**Workflow:**
1. **Transcription**: Extract audio → Whisper.cpp → word-level timestamps
2. **Detection**: Match filler words ("um", "uh", "like") with confidence thresholds
3. **Cut Plan**: Generate timeline mutations (pure function, testable)
4. **Application**: Split track items, remove filler segments, ripple tighten gaps

**Technology:**
- Whisper.cpp binary bundled with app
- Model: ggml-base.en.bin (141MB, English-only)
- Cache: File-hash based transcript caching (currently disabled for testing)

#### B) Script Review (Optional OpenAI Integration)

**"Users can get AI-powered feedback on their interview delivery:"**

- **Fresh Transcription**: Always re-transcribes (no cache reuse)
- **Context Modes**: Casual, Interview, Social Media, Business
- **Feedback Structure**: Summary, clarity notes, pacing, filler usage, rewrite suggestions
- **Secure Storage**: OpenAI API key encrypted with Electron `safeStorage`

**Example Output:**
```json
{
  "summary": "...",
  "clarityNotes": ["...", "..."],
  "pacingNotes": ["..."],
  "suggestions": [
    { "original": "...", "improved": "..." }
  ]
}
```

### 4.4 Export System

**"Single-pass FFmpeg export with complex filter graphs:"**

**Export Pipeline:**
1. Collect all track items in timeline order
2. Build `filter_complex` with trim, setpts, scale, concat filters
3. Handle audio/video separately (skip audio if missing)
4. Scale to target resolution (720p, 1080p, or source)
5. Progress events via IPC to UI

**Export Options:**
- Resolution: 720p, 1080p, or source resolution
- Format: MP4 (H.264 + AAC)
- Codec: x264 with `veryfast` preset (speed optimization)

---

## 5. File Structure & Organization (30 seconds)

```
InterviewMate/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # App entry point
│   │   ├── ipc-handlers.ts # IPC router
│   │   ├── ffmpeg-wrapper.ts # Video processing
│   │   ├── recording-service.ts
│   │   └── ai/
│   │       ├── whisper-runner.ts
│   │       ├── transcript-cache.ts
│   │       ├── openai-service.ts
│   │       └── resolve-whisper-path.ts
│   ├── renderer/          # React UI
│   │   ├── components/
│   │   │   ├── Timeline.tsx
│   │   │   ├── Player.tsx
│   │   │   ├── MediaLibrary.tsx
│   │   │   ├── UnifiedToolsPanel.tsx
│   │   │   └── ...
│   │   ├── store.ts       # Zustand state
│   │   └── ai/
│   │       └── apply-cut-plan.ts
│   ├── preload/           # IPC bridge
│   │   └── preload.ts
│   └── shared/            # Shared types
│       └── types.ts
├── bin/                   # Bundled binaries
│   ├── mac/               # FFmpeg (per platform)
│   └── whisper/darwin/    # Whisper.cpp
├── resources/
│   └── models/whisper/    # AI model files
└── release/               # Packaged DMGs
```

---

## 6. Data Flow Examples (1 minute)

### Example 1: Filler Word Removal

```
User clicks "Analyze Speech"
  ↓
Renderer → IPC → Main: detectFillers(clipId)
  ↓
Main Process:
  1. Extract audio to temp WAV (FFmpeg)
  2. Run Whisper.cpp transcription
  3. Parse JSON output → Transcript
  4. Detect fillers (pure function)
  5. Generate cut plan (pure function)
  ↓
Return to Renderer: FillerSpan[]
  ↓
User clicks "Apply Cuts"
  ↓
Renderer: applyCutPlanToStore(cutPlan)
  ↓
Zustand Store:
  - Split track items
  - Remove filler segments
  - Ripple tighten gaps
  - Update timeline UI
```

### Example 2: Video Export

```
User clicks "Export Video"
  ↓
Renderer → IPC → Main: exportTimeline(project, outputPath, resolution)
  ↓
Main Process:
  1. Load all clips from project
  2. Build FFmpeg filter_complex:
     - [0:v]trim=start:end,setpts=PTS-STARTPTS[v0]
     - [0:v]scale=1920:1080[v0_scaled]
     - [v0_scaled][v1_scaled]concat=n=2:v=1[vout]
  3. Spawn FFmpeg process
  4. Emit progress events (percent, timemark)
  ↓
IPC Progress Events → Renderer UI
  ↓
On Complete: Show success message + file path
```

---

## 7. Security & Privacy (30 seconds)

**"InterviewMate prioritizes user privacy and security:"**

- **Local Processing**: All AI transcription runs offline (Whisper.cpp)
- **No Cloud**: Transcripts never leave the user's machine (unless OpenAI review is used)
- **Encrypted Storage**: API keys stored with Electron `safeStorage` (OS-native encryption)
- **Sandboxed Renderer**: UI has no direct file system access
- **Secure IPC**: ContextBridge provides controlled API surface

**Data Locations:**
- Config: `~/.interviewmate/config.json` (encrypted API keys)
- Cache: `~/.interviewmate/cache/transcripts/`
- Recordings: `~/Movies/InterviewMate/recordings/`
- Projects: User-selected save location

---

## 8. Performance Optimizations (30 seconds)

**"Performance is critical for smooth video editing:"**

1. **Timeline Virtualization**: Only visible items render (react-window)
2. **Playhead Throttling**: Updates limited to ~30fps to prevent jitter
3. **GPU Acceleration**: CSS `transform: translate3d` for hardware acceleration
4. **Request Video Frame Callback**: Frame-accurate playback sync
5. **Memoization**: React.memo on expensive components
6. **Batch Updates**: Zustand batches multiple state changes
7. **Lazy Loading**: Components load on demand

**Performance Targets:**
- Timeline scroll: ≥55 fps with 15-minute project
- Playback: Frame-accurate, no lag
- Export: ≤ real-time × 1.3 for 1080p30

---

## 9. Build & Deployment (30 seconds)

### Development
```bash
npm install
npm run dev          # Starts Vite dev server + Electron
```

### Production Build
```bash
npm run build        # Compiles TypeScript + bundles React
npm run package:mac  # Creates DMG installers (x64 + arm64)
```

### Packaging Details
- **DMG Format**: macOS disk image with auto-install
- **Universal Binary**: Single build supports both architectures
- **Bundled Binaries**: FFmpeg, Whisper.cpp, models included
- **Code Signing**: Optional (not configured yet - unsigned builds)

**Output**: `release/InterviewMate-1.0.0.dmg` (Intel) and `InterviewMate-1.0.0-arm64.dmg` (Apple Silicon)

---

## 10. Future Enhancements (30 seconds)

**"Potential features for future versions:"**

- **GPU Acceleration**: Video encoding using hardware encoders
- **Advanced Effects**: Transitions, filters, color grading
- **Audio Mixing**: Multi-track audio with levels
- **Proxy Media**: Lower-res proxies for faster editing
- **Cloud Sync**: Optional project syncing (user opt-in)
- **Multi-platform**: Windows and Linux support
- **Collaboration**: Multi-user editing (future consideration)

---

## 11. Closing Summary (30 seconds)

**"InterviewMate combines the power of traditional video editing with modern AI capabilities. Built on Electron for cross-platform potential, it uses local AI processing for privacy and offline capability. The architecture prioritizes security through process isolation, performance through virtualization and GPU acceleration, and user experience through intuitive UI and real-time feedback."**

**Key Strengths:**
- ✅ Offline AI transcription (privacy-first)
- ✅ Fast, responsive timeline editing
- ✅ Professional recording capabilities
- ✅ Secure, sandboxed architecture
- ✅ Ready for distribution (DMG packaging)

---

## Quick Reference: Technical Specifications

| Aspect | Technology/Value |
|--------|------------------|
| **Desktop Runtime** | Electron v39 |
| **Frontend** | React v19 + TypeScript |
| **State Management** | Zustand v5 |
| **Video Processing** | FFmpeg (bundled) + fluent-ffmpeg |
| **AI Transcription** | Whisper.cpp (local, offline) |
| **AI Model** | ggml-base.en.bin (141MB) |
| **Script Review** | OpenAI GPT-4o-mini (optional, cloud) |
| **Styling** | TailwindCSS v4 |
| **Build Tool** | Vite v7 |
| **Package Tool** | electron-builder v26 |
| **Bundle Size** | ~750 MB |
| **Platform** | macOS (Universal - Intel + Apple Silicon) |
| **Architecture** | Three-process (Main, Preload, Renderer) |
| **License** | ISC |

---

## Demo Flow Recommendations

If presenting live, demonstrate in this order:

1. **Recording** (30s): Show screen recording → auto-import
2. **Timeline Editing** (1min): Drag clips, trim, split, snap-to-grid
3. **Transcription** (1min): Transcribe clip → show full transcript
4. **Filler Detection** (1min): Analyze → detect fillers → apply cuts → show results
5. **Script Review** (1min): Generate review → show feedback and suggestions
6. **Export** (30s): Export at 1080p → show progress → completion

**Total Demo Time**: ~5 minutes

---

## Q&A Preparation

**Common Questions & Answers:**

**Q: Why Electron instead of native?**
A: Faster development, cross-platform potential, familiar web technologies, built-in recording APIs.

**Q: Is the AI really offline?**
A: Yes, Whisper.cpp runs completely locally. Only the optional Script Review feature uses OpenAI (requires API key).

**Q: How accurate is the transcription?**
A: Whisper base model achieves ~95% accuracy on clear English speech. Can upgrade to "medium" model for better accuracy (larger file size).

**Q: Why is the bundle size so large?**
A: FFmpeg binaries (~50MB) + Whisper.cpp (~5MB) + Model file (141MB) + Electron runtime (~150MB) + dependencies (~400MB).

**Q: Will this work on Windows/Linux?**
A: Architecture supports it, but currently only bundled for macOS. Would need platform-specific binary paths.

**Q: How does filler removal work exactly?**
A: Whisper provides word-level timestamps → we match filler words → generate cut plan → split timeline items → remove segments → ripple close gaps.

---

## Conclusion

This technical overview script provides a comprehensive foundation for presenting InterviewMate's architecture, features, and implementation details. Adjust timing based on audience and context.

