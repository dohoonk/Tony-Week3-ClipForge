# Active Context: ClipForge

## Current Focus
**Phase**: Project Initialization
**Status**: Ready to begin implementation
**Timeline**: 72-hour development sprint

## What We're Working On
Starting fresh implementation of the ClipForge desktop video editor. Task breakdown v1.5 is finalized with 17 PRs from setup to QA.

## Recent Changes
- Memory Bank initialized and documented
- Task breakdown refined to v1.5
- File portability issue resolved (PR 5b: copy to ~/.clipforge/clips/)
- Split logic clarified (PR 7: Cmd+Shift+S at playhead)
- Recording flow uses IPC events (onRecordingComplete)

## Next Steps
1. **PR 1: Project Setup** (Starting Now)
   - Initialize Electron + React + TypeScript project
   - Configure Vite for renderer bundling
   - Set up main.ts, preload.ts, renderer entry
   - Enable contextIsolation and test hot reload

2. **PR 2: Project Structure**
   - Create directory structure (/src/main, /preload, /renderer, /shared)
   - Add TailwindCSS configuration
   - Create placeholder components
   - Set up tsconfig paths

3. **PR 3: IPC Layer** (Critical Path)
   - Define all IPC channels
   - Implement secure preload bridge
   - Add validation and sanitization
   - Write integration tests

4. **PR 4-6: Core Features**
   - FFmpeg integration and probe
   - Project file I/O with file copying
   - Media library UI and import flow

## Active Decisions

### Determined
- **Use fluent-ffmpeg** for all FFmpeg operations
- **Single-pass filter_complex** export pipeline
- **DOM-based timeline** with react-window virtualization
- **Project = JSON** for persistence with file copying to ~/.clipforge/clips/
- **TailwindCSS** for styling (MVP choice)
- **Single track** timeline for MVP
- **Split operation** via Cmd+Shift+S at playhead
- **Recording** saves as .webm to ~/Movies/ClipForge/recordings/

### Pending Clarification
- **TrackItem.startSec vs playheadSec**: Need to clarify relationship
- **Zustand store structure**: Single store vs separate concerns?
- **Drag-drop UX**: HTML5 drag API implementation details
- **Recording IPC method**: Add `onRecordingComplete` to PR 3 channels
- **Zoom limits**: Specific min/max px/sec values and behavior

## Current Considerations

### Technical
- Need to verify FFmpeg binary compatibility with target Mac models
- Consider fallback strategies for unsupported video codecs
- Plan for graceful error handling in export pipeline

### Design
- Timeline interaction patterns (drag-drop, snapping, etc.)
- Playhead syncing between player and timeline
- Clip thumbnail generation strategy

## Blockers
None currently - ready to start implementation.

## Finalized Decisions (v1.6.2)
- **Zustand Store**: Single store with flattened structure (project, clips, trackItems, ui)
- **TrackItem.trackPosition**: Absolute timeline position in seconds
- **Drag/Drop**: HTML5 drag API with position calculated from mouseX/pixelsPerSec
- **Zoom UX**: Multiplier-based slider (0.5×–10×) with label, internally mapped to px/sec
- **Autosave**: 30-second interval to ~/.clipforge/autosave.json with recovery on startup
- **Recording**: 30-min timeout with disk space check
- **Deletion Safety**: Check if clip is used in trackItems before deletion with confirmation
- **Serialization**: Nested ↔ flat conversion on load/save
- **Clip Metadata**: Includes width/height for export validation

## Notes
- Task breakdown: 17 PRs total (v1.6.2 - FINAL)
- Benchmark target: 1080p30 H.264 on 2023+ MacBook hardware
- Export performance: ≤ real-time × 1.3 for 1080p30
- Timeline performance: ≥55 fps at 15-min project
- File portability: All imports copied to ~/.clipforge/clips/ for reliable projects
- All architectural decisions locked and documented

