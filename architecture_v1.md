# 🎬 ClipForge – Architecture Document (v1.6.4 FINAL)

## 0. Context & Goals

**Objective:**
Build a desktop video editor that can import, trim, split, arrange, preview, record, and export clips to MP4 — all within a 72-hour MVP sprint.

**Primary Focus:**
Velocity and reliability over advanced effects.

**Non-Goals (initial release):**
- GPU effects
- Audio plugins
- Multi-track composition
- Color grading or transitions

---

## 1. High-Level System Overview

The application is composed of three core runtime domains:

**Renderer (React + Zustand)** — The front-end UI layer (timeline, media library, player, export).

**Preload (ContextBridge)** — A narrow, secure API surface for communication between Renderer and Main.

**Main (Electron + Node)** — Handles file access, encoding, recording, and project persistence.

FFmpeg and FFprobe binaries are bundled locally with the app to ensure deterministic, dependency-free behavior.

---

## 2. Technology Stack & Choices

| Component | Technology | Reasoning |
|-----------|-----------|----------|
| Desktop Runtime | Electron | Mature, fast to iterate, supports desktopCapturer and packaging. |
| Front-end | React + TypeScript + Zustand | Declarative UI, lightweight state management, strong typing. |
| Styling | TailwindCSS | Rapid UI iteration, consistent design tokens. |
| Encoding | FFmpeg + fluent-ffmpeg | Reliable cross-platform transcoding with easy Node bindings. |
| Preview | HTML5 `<video>` | Hardware-accelerated, stable playback for MVP. |
| Data Persistence | JSON Projects + fs API | Simple, human-readable save/load format. |

---

## 3. Key Architectural Principles

1. **Secure isolation** — only the Main process can access the file system.
2. **Deterministic encoding** — always re-encode on export to ensure success.
3. **Flat runtime state, nested persistence** — Zustand manages a flattened store; file I/O serializes/deserializes tracks.
4. **Performance first** — list virtualization, playhead throttling (~30 fps), GPU-based transforms.
5. **Portability** — media copied into `~/.clipforge/clips/` for stable paths.

---

## 4. Zustand Store Schema

```typescript
interface ClipForgeState {
  project: {
    id: string
    name: string
    version: string
    createdAt: string  // ISO 8601
    updatedAt: string  // ISO 8601
  }
  
  clips: {
    [id: string]: {
      id: string
      name: string
      path: string      // ~/.clipforge/clips/uuid.ext
      duration: number  // seconds
      width: number
      height: number
    }
  }
  
  trackItems: {
    [id: string]: {
      id: string
      clipId: string
      inSec: number      // trim start within clip
      outSec: number      // trim end within clip
      trackPosition: number  // absolute timeline position in seconds
    }
  }
  
  ui: {
    playheadSec: number  // current playback position
    zoom: number         // zoom level
    selectedId?: string  // selected trackItem ID
  }
}
```

---

## 5. File System Structure

```
~/.clipforge/
├── clips/           # Imported media files (copied here for portability)
│   └── {uuid}.{ext}
├── projects/        # Saved project files
│   └── project.json
└── autosave.json    # Auto-saved recovery file (every 30s)

~/Movies/ClipForge/
└── recordings/      # Screen/webcam recordings (user-visible)
    └── {timestamp}.webm
```

---

## 6. IPC Surface

| Function | Purpose |
|----------|---------|
| `openFiles()` | Show file dialog, return paths |
| `probe(path)` | Return { duration, width, height } metadata |
| `exportTimeline(project, outPath)` | Trigger FFmpeg export |
| `saveProject(project, path?)` | Write project JSON |
| `openProject()` | Load and parse project JSON |
| `startRecording(type, options)` | Begin screen/webcam recording |
| `stopRecording()` | Explicitly stop active recording |
| `onRecordingComplete(callback)` | Event callback for finished recordings |

---

## 7. Core Data Structures

### Clip (Runtime)
```typescript
type Clip = {
  id: string
  path: string          // ~/.clipforge/clips/{uuid}.{ext}
  name: string
  duration: number      // seconds
  width: number         // pixels
  height: number        // pixels
}
```

### TrackItem (Runtime)
```typescript
type TrackItem = {
  id: string
  clipId: string        // reference to clip
  inSec: number          // start time within clip (trim)
  outSec: number          // end time within clip (trim)
  trackPosition: number   // absolute timeline position (seconds)
}
```

### Project (Serialized)
```typescript
type Project = {
  id: string
  name: string
  version: "1"
  clips: Record<string, Clip>    // flattened on load
  tracks: Track[]               // nested on save
  createdAt: string             // ISO 8601
  updatedAt: string             // ISO 8601
}

type Track = {
  id: string
  kind: 'video' | 'overlay'
  items: TrackItem[]
}
```

**Serialization:**
- **On load**: `tracks[].items[]` → `trackItems: Record<string, TrackItem>`
- **On save**: `trackItems: Record<string, TrackItem>` → `tracks: [{ id: 'main', items: [...] }]`

---

## 8. Data Flow Overview

| Flow | Description |
|------|-------------|
| **Import** | Renderer → Preload → Main → FFprobe → metadata → Zustand store |
| **Edit** | Renderer modifies trackItems in state (trim, split, move) |
| **Playback** | `<video>` reflects current playheadSec; timeline syncs via RAF throttling |
| **Export** | Renderer calls exportTimeline(project, outPath) → Main → FFmpeg filter_complex |
| **Record** | Main captures via desktopCapturer / getUserMedia; on save emits recording:completed |
| **Autosave** | Interval-based (30s) project snapshot saved to disk |

---

## 9. Performance Plan

| Area | Strategy |
|------|----------|
| Timeline Rendering | Virtualized list via react-window; ≤ 100 visible clips |
| Playhead Updates | Throttled ~30 fps via requestAnimationFrame |
| Zoom | Multiplier-based slider (0.5×–10×) mapped to px/sec; min/max clamped |
| Encoding | libx264 -preset veryfast -crf 20 -c:a aac |
| Recording | Limit 30 min per session, persistent save path |
| Autosave | Every 30s, recovery on crash |

**Success Metrics:**
- Cold start: ≤ 5 seconds
- Timeline: ≥ 55 fps at 15-min project
- Export: ≤ real-time × 1.3 for 1080p30
- Export reliability: 100% success on mixed codecs

---

## 10. User Interaction Patterns

### Split Operations
- **Single click** → select trackItem
- **Double-click** → split at mouse cursor position
- **Cmd/Ctrl+Shift+S** → split selected trackItem at playhead position
- Splitting requires valid selection

### Zoom Controls
- Multiplier-based slider (0.5×–10×)
- Label: "Zoom x 1.0"
- Internally maps to px/sec (1× ≈ 50 px/sec)

### Deletion Safety
- Check if clip used in any trackItems before deletion
- Prompt confirmation if referenced

---

## 11. Future Enhancements (Post-MVP)

- Thumbnail extraction via `ffmpeg -frames:v 1`
- Undo/Redo history stack
- Audio waveform visualization
- Picture-in-Picture overlays
- Background export queue
- Multi-track timeline with transitions

---

## 12. Implementation Checklist

**Total PRs: 17**

- ✅ PR 1-2: Project Setup
- ✅ PR 3: IPC Layer
- ✅ PR 4: FFmpeg Integration
- ✅ PR 5-5b: Project Management
- ✅ PR 6: Media Library
- ✅ PR 7-8: Timeline UI
- ✅ PR 9-10: Playback System
- ✅ PR 11: Recording System
- ✅ PR 12-13: Export System
- ✅ PR 14-15: Performance & Stability
- ✅ PR 16-17: Packaging & QA

See `task.md` for detailed implementation checklist.

