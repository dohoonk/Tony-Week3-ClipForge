# Technical Context: InterviewMate

## Technology Stack

### Core Framework
- **Electron**: Desktop application framework
- **React**: UI component library
- **TypeScript**: Type-safe JavaScript

### Video Processing
- **FFmpeg/FFprobe**: Bundled binaries in `process.resourcesPath/bin/`
- **fluent-ffmpeg**: Node.js wrapper for FFmpeg (v2.1.2+)

### UI Libraries
- **React**: Component framework
- **Zustand**: State management (minimal boilerplate)
- **react-window**: List virtualization

### Media Playback
- **HTML5 `<video>`**: Native browser video element
- Supports `file://` paths for local playback

## Development Setup

### Platform Support
- **Primary**: macOS (initial target)
- **Architecture**: Universal (Intel + Apple Silicon)
- **Build Tool**: electron-builder

### File Structure (Planned)
```
/
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # React app
│   ├── preload/       # Context bridge
│   └── shared/        # TypeScript types
├── bin/               # FFmpeg binaries per platform
└── package.json
```

### Build Configuration
- FFmpeg/FFprobe bundled via `extraResources` in electron-builder
- Binaries located at: `process.resourcesPath/bin/`
- Development: `process.cwd()/bin/${platform}/`

## Dependencies

### Runtime Dependencies
- `electron`: Desktop framework
- `fluent-ffmpeg`: FFmpeg wrapper
- `react`, `react-dom`: UI library
- `zustand`: State management
- `react-window`: Virtualization

### Development Dependencies
- `typescript`: Type checking
- `vite`: Build tool
- `electron-builder`: App packaging
- `@types/*`: TypeScript definitions

## Platform Constraints

### macOS Permissions
- Camera/Microphone: Requires user permission
- Screen Recording: Requires permissions in System Preferences
- File Access: Sandboxed except for user-selected files

### Binary Management
- Bundle size: ~200 MB (FFmpeg binaries)
- Platform-specific binaries in separate folders
- Runtime detection: `process.platform` (darwin, win32, linux)

## Technical Constraints

### Export Pipeline
- Codec: H.264 (`libx264`) + AAC audio
- Preset: `veryfast` (speed optimization)
- CRF: 20 (quality setting)
- Target: 1080p30 H.264 output
- Export ratio: ≤ real-time × 1.3

### Performance Budgets
- Cold start: ≤ 5 seconds
- Timeline: ≥ 55 fps with 15-min project
- Memory: Release MediaRecorder blobs after save
- Temp files: Clean after export

### Codec Compatibility
- Input formats: MP4, MOV, WebM
- Auto-probe with FFprobe for metadata
- Re-encode if necessary for mixed codecs

## Development Workflow

### Building
```bash
npm run build        # Build renderer
npm run start        # Dev mode
npm run package      # Create DMG
```

### FFmpeg Integration
```typescript
const base = app.isPackaged
  ? path.join(process.resourcesPath, 'bin')
  : path.join(process.cwd(), 'bin', process.platform);

ffmpeg.setFfmpegPath(path.join(base, 'ffmpeg'));
ffmpeg.setFfprobePath(path.join(base, 'ffprobe'));
```

### Type Definitions
Located in `src/shared/types.ts`:
- Clip, TrackItem, Track, Project types
- IPC message types
- Export progress events

## Future Considerations
- Per-platform binary optimization
- Codec-specific edge case handling (HEVC, MKV)
- GPU-accelerated encoding (post-MVP)
- Progressive thumbnail generation


