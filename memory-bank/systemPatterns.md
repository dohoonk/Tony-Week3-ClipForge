# System Patterns: InterviewMate

## Architecture Overview

### Process Topology
```
┌─────────────────────────────────────────┐
│        Electron Main (Node.js)          │
│  - App lifecycle & window management   │
│  - IPC router & dialogs                │
│  - Project I/O & file operations       │
│  - fluent-ffmpeg wrapper               │
└──────────────┬──────────────────────────┘
               │
               │ IPC (ContextBridge)
               │
┌──────────────▼──────────────────────────┐
│          Preload Script                 │
│  - Exposes window.clipforge/* API       │
│  - Type-safe IPC surface                │
└──────────────┬──────────────────────────┘
               │
               │
┌──────────────▼──────────────────────────┐
│      Renderer (React + TypeScript)      │
│  - Media Library                        │
│  - Timeline (DOM, virtualized)         │
│  - Player (HTML5 video)                │
│  - Recorder Orchestrator               │
│  - Export Panel                        │
│  - Project Store (Zustand)             │
└─────────────────────────────────────────┘
```

## Key Design Patterns

### 1. Process Isolation
- **Main Process**: Full Node.js access to file system, FFmpeg
- **Renderer Process**: Sandboxed, no direct file access
- **Bridge**: Preload script provides controlled API surface
- **Rationale**: Security and separation of concerns

### 2. Single-Pass Export Pipeline
- Uses `filter_complex` to apply all operations in one FFmpeg pass
- Each TrackItem gets trim/atrim filters applied
- All outputs fed into concat filter
- **Benefit**: Deterministic, codec-agnostic, no temp files

### 3. Normalized Data Model
- Clips stored separately from track items
- TrackItems reference clipIds, not paths
- **Benefit**: Reusability, versioning, cleaner serialization

### 4. Virtualized Timeline
- DOM-based with `react-window` for performance
- Only renders visible track items
- CSS transforms for zoom (GPU-accelerated)
- **Benefit**: Handles 100s of items smoothly

### 5. Project as JSON
- Human-readable, version-controlled
- Contains full project state (clips + tracks)
- ISO 8601 timestamps for created/updated
- **Benefit**: Portable, debuggable, extensible

## Component Relationships

### Media Flow
```
File System → IPC → Media Library → Timeline → Export → FFmpeg → Output
```

### State Flow
```
User Action → React Component → Zustand Store → IPC → Main Process → Response
```

### Recording Flow
```
User Initiates → getUserMedia/desktopCapturer → MediaRecorder → File System → Library
```

## Key Technical Decisions

### Why Electron over Tauri
- `desktopCapturer` mature and reliable
- Familiar tooling for team
- Faster implementation for screen capture

### Why fluent-ffmpeg
- Reliable progress parsing
- Battle-tested argument building
- Avoids custom child_process wrapper

### Why DOM Timeline over Canvas
- CSS/DOM hit-testing built-in
- Accessibility easier
- Mitigated with react-window virtualization

### Why filter_complex over Concat Demuxer
- Handles mixed codecs gracefully
- Single process, no temp files
- More reliable cross-codec results

## IPC Communication Pattern
All file system operations must go through IPC to maintain security:
- `openFiles()`: System file dialog
- `probe(path)`: FFprobe metadata extraction
- `exportTimeline(project, out)`: FFmpeg export
- `saveProject(project, path?)`: Serialize to disk
- `openProject()`: Deserialize from disk


