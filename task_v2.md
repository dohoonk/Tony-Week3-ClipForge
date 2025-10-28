# ClipForge v2 - Task Breakdown

## 🎯 Phase 2 Goals
- Multi-track timeline editor
- Professional recording system
- Text overlays and basic effects
- Export queue and presets
- Enhanced UX and performance

---

## 📹 Recording System v2

### PR 18: screen-recording-implementation
- [ ] Implement desktopCapturer integration
- [ ] Add MediaRecorder wrapper service
- [ ] Create recording UI with source selection
- [ ] Add 3-second countdown timer
- [ ] Implement recording indicator + duration
- [ ] Save to ~/Movies/ClipForge/recordings/
- [ ] Add 30-minute recording cap
- [ ] Handle low storage gracefully
- [ ] Auto-import completed recordings to media library
- [ ] Probe recording metadata on save

### PR 19: webcam-recording-support
- [ ] Add getUserMedia() for webcam capture
- [ ] Create webcam preview component
- [ ] Implement webcam-only recording mode
- [ ] Add microphone audio capture
- [ ] Handle permissions and device selection

### PR 20: pip-recording-system
- [ ] Implement simultaneous screen + webcam capture
- [ ] Add FFmpeg overlay filter for PiP
- [ ] Create live PiP preview (pre-record)
- [ ] Handle stream synchronization
- [ ] Optimize CPU usage for dual capture

---

## 🎬 Multi-Track Timeline

### PR 21: multi-track-foundation
- [ ] Add trackId field to TrackItem type definition
- [ ] Add tracks metadata to Zustand store (order, kind, visible)
- [ ] Implement track ordering system (move up/down)
- [ ] Add track creation/deletion UI (timeline header)
- [ ] Update timeline rendering for multiple track rows
- [ ] Ensure all serialization includes trackId

### PR 22: track-interactions
- [ ] Enable drag-drop across tracks
- [ ] Implement track-specific drag zones
- [ ] Add track height management
- [ ] Create track labels and controls
- [ ] Handle track visibility toggles
- [ ] Implement timeline virtualization (react-window)
- [ ] Render only visible track items
- [ ] Optimize scroll/zoom performance
- [ ] Add throttled scroll sync between tracks/ruler (30fps) to prevent jitter

### PR 23: trim-controls-ui
- [ ] Add trim handles to timeline clips
- [ ] Implement drag-to-resize functionality
- [ ] Update inSec/outSec on trim
- [ ] Add visual feedback for trim bounds
- [ ] Validate trim constraints

---

## ✨ Effects & Overlays

### PR 24: text-overlay-system
- [ ] Create text overlay component
- [ ] Add text properties (font, size, color, shadow)
- [ ] Implement text positioning on timeline
- [ ] Add FFmpeg drawtext filter integration
- [ ] Create text animation presets (fade, slide, zoom)

### PR 25: basic-transitions
- [ ] Implement crossfade transition
- [ ] Add slide transition effects
- [ ] Create dip-to-black transition
- [ ] Add transition markers on timeline
- [ ] Handle transition timing and alignment

### PR 26: color-filters
- [ ] Add brightness adjustment filter
- [ ] Implement contrast control
- [ ] Add saturation adjustment
- [ ] Create preview via CSS filters
- [ ] Export via FFmpeg eq filter

---

## 🎵 Audio Controls

### PR 27: audio-management
- [ ] Add per-clip volume controls
- [ ] Implement fade in/out effects
- [ ] Create global mix level control
- [ ] Add audio waveform visualization
- [ ] Handle audio track management

---

## 📤 Export & Sharing

### PR 28: export-presets
- [ ] Create YouTube 1080p preset
- [ ] Add TikTok 720p vertical preset
- [ ] Implement Instagram 1:1 square preset
- [ ] Add custom resolution options (720p-4K)
- [ ] Support frame rate selection (24/30/60fps)

### PR 29: export-queue-system
- [ ] Create export job manager class
- [ ] Implement serialized job processing (one at a time)
- [ ] Add job progress tracking via IPC events
- [ ] Persist queue state to ~/.clipforge/queue.json
- [ ] Load pending jobs on app startup
- [ ] Handle crash recovery for interrupted exports
- [ ] Create export queue UI component
- [ ] Handle job cancellation and retry

### PR 30: export-ui-enhancements
- [ ] Add export progress with ETA calculation
- [ ] Create success/failure dialogs with details
- [ ] Implement file naming patterns (projectName_date.mp4)
- [ ] Add post-export share options (Drive/Dropbox)
- [ ] Implement retry logic on I/O errors (aligned with PR 37)
- [ ] Show detailed error messages to user

---

## 🔄 Project System

### PR 31: undo-redo-system
- [ ] Implement Zustand history middleware
- [ ] Add undo/redo actions to store
- [ ] **Scope:** Track timeline operations (add/remove/trim/split/move trackItems)
- [ ] **Exclude:** Async operations (import, export, recording)
- [ ] Limit history to 50 actions
- [ ] Add keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
- [ ] Create undo/redo UI controls in toolbar

### PR 32: autosave-v2
- [ ] Implement 15-second autosave interval
- [ ] Add version history system (keep last 10 versions)
- [ ] Create recovery dialog on crash
- [ ] Add manual save indicators in UI
- [ ] Handle concurrent save conflicts
- [ ] Ensure serialization handles flat trackItems with trackId
- [ ] Normalize nested→flat conversion on load

---

## 🎨 UI/UX Enhancements

### PR 33: timeline-improvements
- [ ] Add snap-to-grid functionality
- [ ] Implement snap-to-edges toggle
- [ ] Create timeline ruler with time markers
- [ ] Add zoom presets (25%, 50%, 100%, 200%)
- [ ] Improve timeline scrolling performance

### PR 34: media-library-v2
- [ ] **Depends on:** PR 18-20 (recording auto-import)
- [ ] Add thumbnail generation for clips (ffmpeg -frames:v 1)
- [ ] Implement lazy loading for thumbnails
- [ ] Create clip metadata display (duration, resolution, size)
- [ ] Add file size information to UI
- [ ] Implement clip search/filter functionality

### PR 35: preview-system
- [ ] Add loop region support
- [ ] Implement scrubbing with drag-playhead
- [ ] Create visual overlays for trim bounds
- [ ] Add transition preview markers
- [ ] Optimize preview performance

### PR 35b: preview-compositor-engine
- [ ] Create WebGL compositor using OffscreenCanvas
- [ ] Implement multi-track preview rendering
- [ ] Add CSS filter approximation for real-time preview
- [ ] Create compositor manager for effect layering
- [ ] Handle preview performance metrics

### PR 35c: proxy-media-manager
- [ ] Generate 540p proxy media on import
- [ ] Store proxies in ~/.clipforge/proxies/
- [ ] Switch to proxy playback for heavy timelines
- [ ] Auto-delete proxies on clip removal
- [ ] Add proxy generation progress UI

---

## ⚡ Performance & Stability

### PR 36: performance-optimizations
- [ ] Optimize FFmpeg filter_complex usage
- [ ] Add memory usage monitoring
- [ ] Implement GPU acceleration where possible
- [ ] Profile and optimize critical paths
- [ ] Add performance metrics to UI

### PR 37: error-handling-v2
- [ ] Enhance error boundary coverage
- [ ] Add graceful degradation for effects
- [ ] Implement retry logic for failed operations
- [ ] Create user-friendly error messages
- [ ] Add crash reporting system

---

## 📚 Documentation & Onboarding

### PR 38: documentation
- [ ] Update README with v2 features
- [ ] Create user guide documentation
- [ ] Add developer setup instructions
- [ ] Document FFmpeg filter patterns
- [ ] Create troubleshooting guide

### PR 39: onboarding-experience
- [ ] Create in-app onboarding tour (first launch)
- [ ] Add interactive tutorial for key features
- [ ] Provide sample project & timeline demo
- [ ] Include onboarding tips overlay
- [ ] Add skip/restart options
- [ ] Link to user guide documentation
- [ ] Create welcome screen for new users

---

## 📋 Key Specifications

### Multi-Track Schema
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
```

### Recording Pipeline
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

### Export Queue
```typescript
type ExportJob = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  preset: string
  outputPath: string
  createdAt: string
}
```

### Export Job Schema
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

## 📝 Change Summary (Based on Feedback)

### ✅ Clarifications Made
- **PR 18**: Added auto-import for completed recordings
- **PR 21**: Explicit trackId field and serialization handling
- **PR 22**: Moved virtualization earlier + scroll sync throttling
- **PR 29**: Added export queue persistence and crash recovery
- **PR 30**: Explicit retry logic alignment with PR 37
- **PR 31**: Clarified undo/redo scope (timeline ops only, not async)
- **PR 32**: Added trackId to serialization requirements
- **PR 34**: Documented dependency on PR 18-20
- **PR 35b-35c**: Split preview compositor and proxy media into separate PRs
- **PR 36**: Removed duplication, now focuses on performance profiling
- **PR 39**: Added onboarding experience for new users

### 🎯 Key Decisions
1. **Undo/Redo Scope**: Timeline operations only (no async actions)
2. **Export Queue**: Persistent to disk for crash recovery
3. **Recording**: Auto-import to media library
4. **Virtualization**: Integrated with multi-track from start
5. **Preview**: Split into separate compositor (PR 35b) and proxy (PR 35c)
6. **Testing**: Vitest (unit), Playwright (E2E), custom IPC mocks

---

## 🎯 Milestones

### M0 - Recording Foundation (Nov 10-15)
- PR 18: Screen recording implementation
- PR 19: Webcam recording support
- Target: Basic recording functionality

### M1 - Multi-Track Timeline (Nov 16-20)
- PR 21: Multi-track foundation
- PR 22: Track interactions
- PR 23: Trim controls UI
- Target: Professional timeline editor

### M2 - Effects & Audio (Nov 21-25)
- PR 24: Text overlay system
- PR 25: Basic transitions
- PR 26: Color filters
- PR 27: Audio management
- Target: Creative editing tools

### M3 - Export & Polish (Nov 26-30)
- PR 28: Export presets
- PR 29: Export queue system
- PR 30: Export UI enhancements
- Target: Professional export workflow

### M4 - Stability & Performance (Dec 1-5)
- PR 31: Undo/redo system
- PR 32: Autosave v2
- PR 33: Timeline improvements
- PR 34: Media library v2
- PR 35: Preview system
- PR 35b: Preview compositor engine
- PR 35c: Proxy media manager
- PR 36: Performance optimizations
- PR 37: Error handling v2
- PR 38: Documentation
- PR 39: Onboarding experience
- Target: Production-ready stability with user onboarding

---

## 🚀 Stretch Goals

### Advanced Features
- [ ] LUT color grading support
- [ ] Motion-tracked text placement
- [ ] Batch export queue
- [ ] GPU-accelerated filters
- [ ] Real-time collaboration

### Platform Expansion
- [ ] Windows support
- [ ] Linux support
- [ ] Mobile companion app
- [ ] Cloud project sync

---

## 📊 Success Metrics

### Performance Targets
- Timeline rendering: ≥55 fps
- Export speed: ≤1.3× realtime for 1080p30
- Memory usage: <2GB for typical projects
- Startup time: <3 seconds

### User Experience
- Recording setup: <30 seconds
- Timeline editing: Intuitive drag-drop
- Export workflow: <5 clicks to export
- Error recovery: Graceful degradation

### Technical Debt
- TypeScript strict mode
- Test coverage >80%
- Documentation completeness
- Performance monitoring
