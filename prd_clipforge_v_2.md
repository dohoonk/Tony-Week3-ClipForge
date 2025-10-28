# **ClipForge – Product Requirements Document (PRD)**  
**Version:** 2.0  
**Date:** Nov 2025  
**Owner:** Tony Kim  

---

## **1. Overview**

### **1.1 Objective**
ClipForge enables creators to import video clips, arrange them on a multi-track timeline, preview edits in real time, record screen/webcam with PiP support, apply text overlays and transitions, and export professional-quality MP4s — all within a lightweight, cross-platform desktop application.

The v2 release focuses on **professional editing workflow** with multi-track support, real recording capabilities, and creative effects.

### **1.2 Non-Goals**
- GPU filter effects, LUTs, or color grading  
- Multi-user collaboration  
- Advanced animation or motion graphics
- Audio waveform visualization beyond basic trim support  
- Mobile platform support
- Real-time collaboration

---

## **2. Success Metrics**

| Metric | Target |
|--------|--------|
| App installs (macOS) | ≥ 200 beta users |
| Cold start time | ≤ 3 s |
| Timeline scroll/zoom | ≥ 55 fps at 30 min project with 5+ tracks |
| Export reliability | 100% success on mixed codecs |
| **Export duration** | ≤ real-time × 1.3 for **1080p30 H.264** (`-preset veryfast -crf 20`) |
| Recording quality | 1080p30 screen + 720p webcam PiP |
| Effects preview | ≥ 30 fps with text overlays and transitions |
| Crashes | 0 blocking issues in smoke test |

> Performance benchmark measured using 1080p 30 fps H.264 sources on 2023+ MacBook hardware.

---

## **3. Core v2 Features**

### **3.1 Multi-Track Timeline**
- **Multiple video tracks** with drag-drop between tracks
- **Overlay track** for text and graphics
- **Audio tracks** with volume control
- Track ordering (move up/down)
- Track visibility toggles
- Snap-to-grid and snap-to-edges
- Trim controls with visual handles
- Split at playhead (Cmd+Shift+S)
- Undo/Redo (50 actions) for timeline operations

### **3.2 Professional Recording System**
- **Screen recording** with source selection (full screen, window, region)
- **Webcam recording** with device selection
- **Picture-in-Picture (PiP)** recording (screen + webcam simultaneously)
- 3-second countdown timer
- Recording indicator with duration
- Auto-save to `~/Movies/ClipForge/recordings/`
- 30-minute recording cap
- Low storage detection and graceful handling
- Auto-import completed recordings to media library

### **3.3 Effects & Overlays**
- **Text overlays** with font, size, color, shadow, animations
- **Basic transitions** (crossfade, slide, dip-to-black)
- **Color filters** (brightness, contrast, saturation)
- **Preview system** with CSS/WebGL approximation
- **Export system** with FFmpeg filter_complex authoritative rendering

### **3.4 Enhanced Media Library**
- **Thumbnail generation** for all imported clips
- **Lazy loading** for performance
- **Metadata display** (duration, resolution, file size)
- **Search/filter** functionality
- **Auto-import** from recordings
- **Bulk cleanup** for short clips

### **3.5 Export Queue & Presets**
- **Export presets**: YouTube 1080p, TikTok 720p vertical, Instagram 1:1 square
- **Custom options**: Resolution (720p-4K), frame rate (24/30/60fps)
- **Export queue** with job management
- **Queue persistence** to disk for crash recovery
- **Progress tracking** with ETA
- **Retry logic** for failed exports
- **File naming** patterns (projectName_date.mp4)

### **3.6 Project System Enhancements**
- **Autosave** every 15 seconds with version history
- **Undo/Redo** system with 50-action history
- **Project recovery** on crash
- **Multi-track schema** support
- **Backward compatibility** with v1 projects

---

## **4. Technical Architecture**

### **4.1 State Management**
```typescript
type TrackItem = {
  id: string
  clipId: string
  trackId: string        // NEW: Track association
  inSec: number
  outSec: number
  trackPosition: number
}

type Track = {
  id: string
  kind: 'video' | 'overlay' | 'audio'
  order: number
  items: TrackItem[]
}

type ClipForgeState = {
  project: ProjectInfo
  clips: Record<string, Clip>
  trackItems: Record<string, TrackItem>  // Flat structure for undo/redo
  tracks: Record<string, Track>          // Track metadata
  ui: {
    playheadSec: number
    zoom: number
    selectedId?: string
    isPlaying: boolean
  }
}
```

### **4.2 Recording Pipeline**
```typescript
// Screen capture
desktopCapturer.getSources() → MediaRecorder

// Webcam capture  
getUserMedia({ video: true, audio: true }) → MediaRecorder

// PiP muxing
ffmpeg -i screen.webm -i webcam.webm 
  -filter_complex "[1]scale=320:240[v2]; [0][v2]overlay=W-w-20:H-h-20"
  output.webm
```

### **4.3 Preview System**
- **Tier 1**: DOM + WebGL compositor for real-time preview
- **Tier 2**: Proxy media (540p) for heavy timelines
- **Effects**: CSS filters for preview, FFmpeg for export
- **Performance**: ≥30 fps with effects, ≥55 fps without

### **4.4 Export Queue**
```typescript
type ExportJob = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  preset: string
  outputPath: string
  createdAt: string
  // Saved to ~/.clipforge/queue.json
}
```

---

## **5. User Experience**

### **5.1 Onboarding**
- **Welcome screen** for first-time users
- **Interactive tour** highlighting key features
- **Sample project** with pre-imported clips
- **Contextual tips** during first use
- **Skip/restart** options
- **Link to documentation**

### **5.2 Workflow**
1. **Import** videos via drag-drop or file picker
2. **Record** screen/webcam with PiP
3. **Arrange** clips on multi-track timeline
4. **Add** text overlays and transitions
5. **Preview** with real-time effects
6. **Export** with presets or custom settings

### **5.3 Performance**
- **Timeline virtualization** for smooth scrolling
- **Throttled scroll sync** between tracks (30fps)
- **GPU transforms** for playhead movement
- **Memory monitoring** and optimization

---

## **6. Data Model**

```typescript
type Clip = {
  id: string
  name: string
  path: string
  duration: number
  width: number
  height: number
}

type TrackItem = {
  id: string
  clipId: string
  trackId: string        // NEW: Track association
  inSec: number
  outSec: number
  trackPosition: number
}

type Track = {
  id: string
  kind: 'video' | 'overlay' | 'audio'
  order: number
  items: TrackItem[]
}

type Project = {
  id: string
  name: string
  version: string
  clips: Record<string, Clip>
  tracks: Track[]
  createdAt: string
  updatedAt: string
}
```

---

## **7. Success Criteria**

### **7.1 Feature Completeness**
- [ ] Multi-track timeline with drag-drop
- [ ] Screen + webcam recording with PiP
- [ ] Text overlays and basic transitions
- [ ] Export queue with presets
- [ ] Undo/redo system
- [ ] Onboarding experience

### **7.2 Performance Targets**
- [ ] Timeline rendering: ≥55 fps
- [ ] Export speed: ≤1.3× realtime for 1080p30
- [ ] Memory usage: <2GB for typical projects
- [ ] Startup time: <3 seconds

### **7.3 User Experience**
- [ ] Recording setup: <30 seconds
- [ ] Timeline editing: Intuitive drag-drop
- [ ] Export workflow: <5 clicks to export
- [ ] Error recovery: Graceful degradation

---

## **8. Risks & Mitigation**

| Risk | Mitigation |
|------|------------|
| High CPU for PiP recording | Hardware decode + GPU overlay |
| Audio drift in exports | Force PTS re-timestamp |
| Multi-track complexity | Flat state with trackId, global undo stack |
| Export failures | Serialized jobs + retry logic |
| Performance degradation | Virtualization + proxy media |

---

## **9. Milestones**

### **M0 - Recording Foundation (Nov 10-15)**
- Screen recording implementation
- Webcam recording support
- Target: Basic recording functionality

### **M1 - Multi-Track Timeline (Nov 16-20)**
- Multi-track foundation
- Track interactions
- Trim controls UI
- Target: Professional timeline editor

### **M2 - Effects & Audio (Nov 21-25)**
- Text overlay system
- Basic transitions
- Color filters
- Audio management
- Target: Creative editing tools

### **M3 - Export & Polish (Nov 26-30)**
- Export presets
- Export queue system
- Export UI enhancements
- Target: Professional export workflow

### **M4 - Stability & Performance (Dec 1-5)**
- Undo/redo system
- Autosave v2
- Performance optimizations
- Error handling v2
- Documentation
- Onboarding experience
- Target: Production-ready stability with user onboarding

---

## **10. Future Considerations**

### **10.1 Stretch Goals**
- LUT color grading support
- Motion-tracked text placement
- Batch export queue
- GPU-accelerated filters
- Real-time collaboration

### **10.2 Platform Expansion**
- Windows support
- Linux support
- Mobile companion app
- Cloud project sync

---

*This PRD v2.0 supersedes v1.1 and defines the complete feature set for ClipForge's professional video editing capabilities.*
