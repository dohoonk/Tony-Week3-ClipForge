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
- [x] Implement desktopCapturer integration
- [x] Add MediaRecorder wrapper service
- [x] Create recording UI with source selection
- [x] Add 3-second countdown timer
- [x] Implement recording indicator + duration
- [x] Save to ~/Movies/ClipForge/recordings/
- [x] Add 30-minute recording cap
- [x] Handle low storage gracefully
- [x] Auto-import completed recordings to media library
- [x] Probe recording metadata on save

### PR 19: webcam-recording-support
- [x] Add getUserMedia() for webcam capture ✅
- [x] Create webcam preview component ✅
- [x] Implement webcam-only recording mode ✅
- [x] Add microphone audio capture ✅
- [x] Handle permissions and device selection ✅

### PR 20: pip-recording-system
- [x] Implement simultaneous screen + webcam capture
- [x] Add FFmpeg overlay filter for PiP
- [x] Create live PiP preview (pre-record)
- [ ] **Stretch:** Handle stream synchronization
- [ ] **Stretch:** Optimize CPU usage for dual capture

---

## 🎬 Multi-Track Timeline

### PR 21: multi-track-foundation
- [x] Add trackId field to TrackItem type definition
- [x] Add tracks metadata to Zustand store (order, kind, visible)
- [x] Implement track ordering system (move up/down)
- [x] Add track creation/deletion UI (timeline header)
- [x] Update timeline rendering for multiple track rows
- [x] Ensure all serialization includes trackId

### PR 22: track-interactions
- [x] Enable drag-drop across tracks
- [x] Implement track-specific drag zones
- [x] Add track height management
- [x] Create track labels and controls
- [x] Handle track visibility toggles
- [x] Render only visible track items
- [x] Optimize scroll/zoom performance
- [ ] **Stretch:** Add throttled scroll sync between tracks/ruler (30fps) to prevent jitter
- [ ] **Stretch:** Implement timeline virtualization (react-window)

### PR 23: timeline-sequence-playback
- [x] Implement continuous timeline playback
- [x] Add sequence logic to detect next clip
- [x] Handle automatic playhead advancement
- [x] Support multi-track playback priority
- [x] Add timeline play/pause controls
- [x] Handle gaps and overlaps between clips

### PR 24: trim-controls-ui
- [x] Add trim handles to timeline clips
- [x] Implement drag-to-resize functionality
- [x] Update inSec/outSec on trim
- [x] Add visual feedback for trim bounds
- [x] Validate trim constraints

---

## 🚨 Must-Have Requirements (Before Deadline)

### PR 23.1: media-library-thumbnails
- [x] Generate thumbnail previews for video clips
- [x] Display thumbnails in media library grid
- [x] Cache thumbnails for performance
- [x] Show thumbnail on hover or in clip card

### PR 23.2: media-metadata-display
- [x] Display clip duration in media library
- [x] Show video resolution (width x height)
- [x] Display file size (MB/GB)
- [x] Add metadata tooltip or info panel
- [x] Format metadata values (e.g., "1920x1080", "125.5 MB")

### PR 23.3: drag-drop-video-import
- [ ] Accept MP4 files via drag-drop
- [ ] Accept MOV files via drag-drop
- [ ] Accept WebM files via drag-drop
- [ ] Handle file drop on media library area
- [ ] Validate file types before import
- [ ] Show import progress/feedback

### PR 23.4: clip-split-at-playhead
- [ ] Add "Split" button to timeline controls
- [ ] Split clip at current playhead position
- [ ] Create two track items from one (left/right halves)
- [ ] Update inSec/outSec for split clips
- [ ] Maintain clip references correctly

### PR 23.5: snap-to-grid-edges
- [ ] Implement snap-to-grid (e.g., 0.5s intervals)
- [ ] Implement snap-to-clip edges
- [ ] Toggle snap on/off in UI
- [ ] Visual feedback when snapping
- [ ] Apply snap during drag-drop and trim

### PR 23.6: export-resolution-options
- [ ] Add resolution selector to export panel
- [ ] Support 720p (1280x720)
- [ ] Support 1080p (1920x1080)
- [ ] Support source resolution (use original)
- [ ] Apply resolution via FFmpeg scale filter
- [ ] Update export UI with resolution dropdown

---

## ✨ Effects & Overlays

### PR 24.1: text-overlay-ui
- [ ] Create text overlay data structure and types
- [ ] Add text overlay UI panel (properties editor)
- [ ] Implement "Add Text Overlay" button
- [ ] Add text properties (font, size, color, shadow)
- [ ] Enable text positioning on timeline

### PR 24.2: text-overlay-rendering
- [ ] Render text overlays in Player component
- [ ] Implement timeline visualization for text overlays
- [ ] Add text overlay tracks to timeline
- [ ] Enable drag-drop and positioning of text overlays

### PR 24.3: text-overlay-ffmpeg
- [ ] Add FFmpeg drawtext filter integration
- [ ] Implement text rendering during export
- [ ] Handle text overlay timestamps and positioning
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
- PR 23: Timeline sequence playback
- PR 24: Trim controls UI
- Target: Professional timeline editor

### M2 - Effects & Audio (Nov 21-25)
- PR 25: Text overlay system
- PR 26: Basic transitions
- PR 27: Color filters
- PR 28: Audio management
- Target: Creative editing tools

### M3 - Export & Polish (Nov 26-30)
- PR 29: Export presets
- PR 30: Export queue system
- PR 31: Export UI enhancements
- Target: Professional export workflow

### M4 - Stability & Performance (Dec 1-5)
- PR 32: Undo/redo system
- PR 33: Autosave v2
- PR 34: Timeline improvements
- PR 35: Media library v2
- PR 36: Preview system
- PR 36b: Preview compositor engine
- PR 36c: Proxy media manager
- PR 37: Performance optimizations
- PR 38: Error handling v2
- PR 39: Documentation
- PR 40: Onboarding experience
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
