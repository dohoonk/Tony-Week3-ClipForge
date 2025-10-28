# ClipForge

A lightweight desktop video editor built with Electron, React, and TypeScript.

## Features

- Import video clips (MP4, MOV, WebM)
- Timeline-based editing with trim and split
- Screen and webcam recording
- Real-time preview with playback
- Export to MP4 with H.264 encoding

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for macOS
npm run package
```

### Project Structure

```
src/
├── main/          # Electron main process
├── preload/       # Context bridge
├── renderer/      # React UI
└── shared/        # Shared types
```

## Task List

See `task_v1.md` for the complete implementation roadmap (17 PRs).

Current Status: PR 1 & 2 complete - Starting PR 3 (IPC Layer)

