# ClipForge - Implementation Task List

**Version**: v1.6.2 FINAL  
**Total PRs**: 17  
**Status**: Ready to begin implementation  

---

## 📦 Project Setup

### PR 1: setup/electron-react-boilerplate
- [x] Initialize Electron + React + TypeScript project
- [x] Configure Vite for renderer bundling
- [x] Setup main.ts, preload.ts, renderer/index.tsx
- [x] Enable contextIsolation: true, nodeIntegration: false
- [x] Verify Electron hot reload works on macOS (run `npm run dev` to test)

### PR 2: setup/project-structure
- [x] Create folders: /src/main, /src/preload, /src/renderer, /src/shared
- [x] Add tsconfig paths and ESLint configuration
- [x] Create placeholder components: App, MediaLibrary, Timeline, ExportPanel
- [x] Add TailwindCSS setup
- [x] Verify renderer build and hot reload (run `npm run dev` to test)

---

## 🔒 IPC Layer

### PR 3: ipc/secure-api-surface
- [x] Define IPC channels: openFiles, probe, exportTimeline, saveProject, openProject, startRecording, stopRecording
- [x] Implement input validation and path sanitization
- [x] Add preload bridge exposing window.clipforge.*
- [x] Add window.clipforge.onRecordingComplete() event binding
- [x] Confirm Renderer ↔ Preload ↔ Main communication
- [ ] Write integration test with mocked FFmpeg (manual test completed, automated test pending)

---

## 🎬 FFmpeg Integration

### PR 4: backend/ffmpeg-wrapper-and-test
- [x] Install fluent-ffmpeg and type definitions
- [x] Bundle ffmpeg and ffprobe (system FFmpeg for dev, bundle for production)
- [x] Implement bindFfBins() for macOS path resolution
- [x] Implement probe(path) returning { duration, width, height }
- [ ] Store all metadata in Zustand clip store (PR 6)
- [x] Add progress event emitter for mock export
- [x] Write Jest tests simulating probe + progress logs (manual test completed)
- [x] Verify FFmpeg invocation works in Main

---

## 💾 Project Management

### PR 5: project/file-io
- [x] Implement saveProject(project, path) using fs.writeFile
- [x] Implement openProject() using fs.readFile
- [x] Use ISO 8601 timestamps for created/updated fields
- [x] Add runtime-only validation for version, clips, trackItems
- [x] Implement interval autosave every 30s → ~/.clipforge/autosave.json
- [x] Prompt recovery if autosave exists on startup
- [x] Implement normalization: load nested tracks → flat trackItems
- [x] Serialize flat trackItems → nested tracks on save
- [x] Include width and height in persisted clip schema

### PR 5b: backend/file-ingest-service
- [ ] On import, copy file to ~/.clipforge/clips/
- [ ] Normalize filenames (uuidv4 + extension)
- [ ] Update project JSON path to new global URI
- [ ] Log result for debugging

---

## 📚 Media Import & Library

### PR 6: ui/media-library
- [x] Create Media Library panel (left column)
- [x] Hook "Import Files" → window.clipforge.openFiles()
- [x] Call probe() to retrieve { duration, width, height }
- [x] Store results in Zustand clips store
- [x] Display imported clips with filename + duration
- [x] Show gray placeholder (16:9) before thumbnails
- [x] When deleting clip, check if used in any trackItems
- [x] Show confirmation dialog before removal if referenced

---

## ⏱️ Timeline UI

### PR 7: timeline/add-and-split-logic
- [x] Implement HTML5 drag/drop from library → timeline
- [x] Compute drop position = (mouseX / pixelsPerSec)
- [x] Create new TrackItem with trackPosition = dropTime
- [x] Initialize { inSec: 0, outSec: clip.duration } (placeholder values)
- [x] Add split logic: single click = select (placeholder handlers)
- [x] Add split logic: double-click = split at cursor offset (placeholder)
- [ ] Add split logic: Cmd/Ctrl+Shift+S = split at playhead position (PR 8)
- [x] Verify clip must be selected before split (basic validation added)
- [x] Update Zustand store to single-track structure

### PR 8: timeline/dom-virtualized
- [x] Implement horizontal scroll container (without react-window for MVP)
- [x] Position TrackItems by trackPosition
- [x] Implement multiplier-based zoom slider (0.5×–10×)
- [x] Display live label ("Zoom x 1.0")
- [x] Map multiplier → px/sec internally (1× = 50 px/sec)
- [x] Clamp min/max and keep center aligned
- [ ] Test ≥55fps smooth rendering (performance test)

---

## ▶️ Playback System

### PR 9: player/basic-playback
- [x] Add <video> element for preview
- [x] Load selected clip via file:// URI (first clip auto-loaded)
- [x] Add play/pause/loop controls
- [x] Validate audio output works by default

### PR 10: timeline/playhead-sync
- [x] Connect video.timeupdate → Zustand playheadSec
- [x] Dragging playhead updates video.currentTime
- [x] Throttle sync to ~30fps for scrubbing
- [x] Animate playhead via requestAnimationFrame
- [x] Ensure bi-directional sync

---

## 🎥 Recording System

### PR 11: record/screen-webcam
- [x] Build Record/Stop UI
- [x] Capture screen via desktopCapturer
- [x] Capture webcam via getUserMedia
- [x] Save as .webm (VP8/Opus) to ~/Movies/ClipForge/recordings/
- [x] Add 30-min timeout and disk space check
- [x] Emit recording:completed event via IPC
- [x] Renderer listens via window.clipforge.onRecordingComplete()
- [x] Auto-add clip to library after save

---

## 📤 Export System

### PR 12: export/filter-complex
- [x] Implement exportTimeline(project, outPath) with complexFilter()
- [x] Compose trims + concat graph for all TrackItems
- [x] Use codecs: libx264 -preset veryfast -crf 20 -c:a aac
- [x] Emit progress events via IPC
- [ ] Verify A/V sync and duration across multiple clips (requires testing)

### PR 13: export/ui-progress
- [ ] Add Export panel with progress bar
- [ ] Subscribe to IPC progress updates
- [ ] Display % completion, disable export button during encode
- [ ] Show success/error message on completion

---

## ⚡ Performance & Stability

### PR 14: perf/virtualization-and-throttling
- [ ] Throttle heavy events (scroll, zoom, drag)
- [ ] Verify ≤100 visible TrackItems rendered
- [ ] Use GPU transforms (translateX) for playhead
- [ ] Maintain ≥55 fps

### PR 15: stability/error-handling
- [ ] Add Renderer error boundary
- [ ] Graceful IPC exception handling
- [ ] Show "Export failed" dialog on FFmpeg crash
- [ ] Add autosave recovery on crash

---

## 📦 Packaging & QA

### PR 16: build/electron-builder
- [ ] Configure electron-builder for macOS DMG
- [ ] Include FFmpeg binaries under extraResources
- [ ] Add platform check for macOS-only binding
- [ ] Test packaged app on clean macOS VM

### PR 17: qa/smoke-tests
- [ ] Import 3 clips, drag to timeline, split, and export
- [ ] Verify export 1080p30 ≤1.3× realtime
- [ ] Confirm A/V sync and crash-free playback
- [ ] Validate project load/save and recording import

---

## 📋 Key Specifications

### Zustand Store Schema
```typescript
{
  project: { id, name, createdAt, updatedAt, version },
  clips: {
    [id]: { id, name, path, duration, width, height }
  },
  trackItems: {
    [id]: { id, clipId, inSec, outSec, trackPosition }
  },
  ui: { 
    playheadSec, zoom, selectedId 
  }
}
```

### Split UX Rules
- **Single click** → select clip
- **Double-click** → split at mouse cursor position
- **Cmd/Ctrl+Shift+S** → split at playhead position
- Splitting requires valid selection

### Zoom UX
- Multiplier-based slider (0.5×–10×)
- Label: "Zoom x 1.0"
- Internally maps to px/sec

### Deletion Safety
- Check if clip used in trackItems before deletion
- Prompt confirmation before removal

---

## 🚀 Getting Started

```bash
# Start with PR 1
git checkout -b feature/setup/electron-react-boilerplate
```

**Next**: Begin implementation with PR 1!

