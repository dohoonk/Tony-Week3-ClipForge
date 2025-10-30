# **ClipForge – Product Requirements Document (PRD)**  
**Version:** 1.2  
**Date:** Oct 2025  
**Owner:** Tony Kim  

---

## **1. Overview**

### **1.1 Objective**
ClipForge enables creators to import video clips, arrange them on a timeline, preview edits in real time, record screen/webcam, and export a final MP4 — all within a lightweight, cross-platform desktop application.  

The MVP focuses on **core editing flow**, not advanced effects or collaborative features.

### **1.2 Non-Goals**
- GPU filter effects, LUTs, or color grading  
- Multi-user collaboration  
- Advanced transitions or animation  
- Audio waveform visualization beyond basic trim support  
- **Picture-in-Picture (PiP)** or multi-track overlay export  
- Mobile platform support  

---

## **3. Success Metrics**

| Metric | Target |
|--------|--------|
| App installs (macOS) | ≥ 50 internal testers |
| Cold start time | ≤ 5 s |
| Timeline scroll/zoom | ≥ 55 fps at 15 min project |
| Export reliability | 100 % success on mixed codecs |
| **Export duration** | ≤ real-time × 1.3 for **1080p30 H.264** (`-preset veryfast -crf 20`) |
| Crashes | 0 blocking issues in smoke test |

> Performance benchmark measured using 1080p 30 fps H.264 sources on 2023+ MacBook hardware.

---

## **4. Core MVP Features**

### **4.1 Import**
- Select local MP4/MOV/WebM files via system dialog  
- Auto-probe metadata using bundled **FFprobe** to extract duration, width, height
- **Files are copied to `~/.clipforge/clips/`** for portability (uuidv4 + extension naming)
- **MVP Media Library** displays:  
  - Neutral gray placeholder (16:9)  
  - Clip filename (e.g., `intro.mp4`)  
  - Duration text  
- Thumbnail extraction deferred to post-MVP (e.g., via `ffmpeg -frames:v 1`)
- Deletion requires confirmation if clip is used in timeline

---

### **4.2 Timeline & Editing**
- **Single track** timeline for MVP
- Drag/drop clips from library to timeline
- Position clips by dropping at desired timeline position (click-time → seconds conversion)
- **Split operations:**
  - Single click: select clip
  - Double-click: split at mouse cursor position
  - Cmd/Ctrl+Shift+S: split at playhead position
- Split requires valid clip selection
- TrackItems reference clips via clipId (no paths in timeline)
- Throttled playhead updates (~30 fps) for smooth scrubbing

### **4.3 Playback & Preview**
- Native `<video>` element for **video + audio playback**  
- Supports `file://` paths (local files)  
- Scrubbing, pause/play, loop  
- Syncs playhead position with timeline (via Zustand store)  
- HTML5 `<video>` handles both video and audio streams by default
- Bi-directional sync: video.timeupdate → playhead AND dragging playhead → video.currentTime

---

### **4.4 Recording**
- Record screen or webcam via system APIs
- **Screen recording:** via desktopCapturer API
- **Webcam recording:** via getUserMedia API
- Save as `.webm` (VP8/Opus codec) to `~/Movies/ClipForge/recordings/`
- 30-minute timeout per recording session
- Disk space validation before recording starts
- Auto-add completed recordings to media library via IPC events
- Recording status displayed in UI

### **4.5 Export**
- Single-pass `filter_complex` FFmpeg pipeline  
- All trims and concatenations applied logically in one encode  
- `libx264 + aac`, preset = `veryfast`, crf = 20  
- Live progress (0–100 %) via `fluent-ffmpeg` progress events  
- Deterministic outputs regardless of input codec  
- **No Picture-in-Picture or overlay filters** in MVP scope  

---

### **4.6 Project I/O**
- Save/Load project as JSON with ISO 8601 timestamps
- **Autosave:** every 30 seconds to `~/.clipforge/autosave.json`
- **Recovery:** prompt on startup if autosave exists
- **Serialization format:**
  - **Runtime:** flat structure in Zustand (clips: Record, trackItems: Record)
  - **Persistence:** nested structure (tracks[] with items[] array)
  - Conversion handled automatically on save/load

### **4.7 AI Assistant — Filler Word Removal**
- **Local transcription:** Whisper.cpp (ggml-base.en.bin) for word-level timestamps
- **Offline-first:** No cloud dependencies, all processing local
- **Cache system:** Transcripts cached by file hash in `~/.clipforge/cache/transcripts/`
- **Filler detection:** Detect common filler words ("um", "uh", "like", "you know", "so", "actually", "well")
- **Preview workflow:**
  - User selects clip → "Analyze Speech" → Transcribe → Detect fillers
  - Display detected fillers with timestamps and confidence scores
  - User can preview each filler (play 1 sec before/after)
  - Adjustable confidence threshold (0.25–0.60, default 0.35)
  - Select individual fillers or remove all
- **Timeline editing:**
  - Generate cut plan based on selected fillers
  - Apply cuts automatically (respects existing trim bounds)
  - Single undo action for all AI edits
  - Playhead adjustment if inside removed region
- **Error handling:**
  - Missing Whisper binary → Disable analyze, show instructions
  - Transcription failure → Show error with retry option
  - No fillers detected → Suggest confidence adjustment
- **Performance:** Transcription runs in background with progress updates, non-blocking UI
- Example JSON:
  ```json
  {
    "version": "1",
    "name": "demo",
    "clips": {
      "uuid-1": { 
        "id": "uuid-1",
        "name": "intro.mp4", 
        "path": "~/.clipforge/clips/uuid-1.mp4", 
        "duration": 12.3,
        "width": 1920, 
        "height": 1080 
      }
    },
    "tracks": [
      { 
        "id": "main", 
        "kind": "video", 
        "items": [
          { 
            "id": "ti-1",
            "clipId": "uuid-1", 
            "inSec": 0, 
            "outSec": 12.3,
            "trackPosition": 0.0
          } 
        ] 
      }
    ],
    "createdAt": "2025-10-27T17:25:00Z",
    "updatedAt": "2025-10-27T17:25:00Z"
  }
  ```

---

## **7. Data Model**

### Runtime (Zustand Store)
```ts
type Clip = {
  id: string;
  name: string;  // display name
  path: string;  // ~/.clipforge/clips/{uuid}.{ext}
  duration: number;  // seconds
  width: number;
  height: number;
  hash?: string;  // SHA-1 hash for transcript caching
};

type TrackItem = {
  id: string;
  clipId: string;  // reference to clip
  inSec: number;   // trim start within clip
  outSec: number;   // trim end within clip
  trackPosition: number;  // absolute timeline position (seconds)
};

type ClipForgeState = {
  project: {
    id: string;
    name: string;
    version: string;
    createdAt: string;  // ISO 8601
    updatedAt: string;  // ISO 8601
  };
  clips: Record<string, Clip>;
  trackItems: Record<string, TrackItem>;
  ui: {
    playheadSec: number;
    zoom: number;  // multiplier (0.5× - 10×)
    selectedId?: string;  // selected trackItem
    isPlaying: boolean;
    snapEnabled: boolean;
    snapInterval: number;
    snapToEdges: boolean;
  };
};

// AI-related types
type Transcript = {
  words: Array<{
    text: string;
    startSec: number;
    endSec: number;
    confidence: number;
  }>;
  durationSec: number;
  audioDurationSec: number;
  modelVersion: string;
};

type FillerSpan = {
  clipId: string;
  word: string;
  startSec: number;
  endSec: number;
  confidence: number;
  paddedStart: number;
  paddedEnd: number;
};

type CutPlan = {
  trackItemId: string;
  cuts: Array<{
    startSec: number;
    endSec: number;
  }>;
};
```

### Serialized (Project JSON)
```ts
type Track = {
  id: string;
  kind: 'video' | 'overlay';
  items: TrackItem[];
};

type Project = {
  id: string;
  name: string;
  version: string;
  clips: Record<string, Clip>;
  tracks: Track[];  // nested structure for persistence
  createdAt: string;  // ISO 8601 UTC timestamp
  updatedAt: string;  // ISO 8601 UTC timestamp
};
```

---

## **8. User Interaction Patterns**

### Timeline Zoom
- Multiplier-based slider: 0.5× to 10×
- Label: "Zoom x 1.0" (live update)
- Internally maps to pixels-per-second
- Smooth scaling with GPU transforms

### Timeline Performance
- Virtualized rendering: ≤100 visible TrackItems
- Target: ≥55 fps at 15-minute project
- Throttled events: scroll, zoom, drag
- GPU-accelerated playhead animation

### File Portability
- All imported clips copied to `~/.clipforge/clips/`
- Normalized filenames: uuidv4.extension
- Project files reference copied paths
- No dependency on original file locations

---

## **9. Additional Notes**

- Recording format: `.webm` (VP8/Opus) for screen/webcam capture
- Export format: `.mp4` (H.264 + AAC) for final output
- Platform: macOS initially (universal binary: Intel + Apple Silicon)
- Bundle size: ~750 MB (includes FFmpeg binaries + Whisper.cpp + ggml-base.en.bin model)
- Battery: Export optimized for <1.3× real-time to conserve power
- AI processing: Local Whisper.cpp for offline transcription (no network required)

