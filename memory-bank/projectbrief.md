# Project Brief: ClipForge

## Core Mission
Build a lightweight, cross-platform desktop video editor that enables creators to import video clips, arrange them on a timeline, preview edits in real time, record screen/webcam, and export a final MP4 video.

## Objectives
- **Primary Goal**: Ship a functional MVP within 72 hours
- **Focus**: Core editing flow (import, arrange, trim, preview, export, record)
- **Platform**: Desktop (macOS initially, cross-platform capable)
- **Target**: 50+ internal testers

## Success Metrics
| Metric | Target |
|--------|--------|
| App installs (macOS) | ≥ 50 internal testers |
| Cold start time | ≤ 5 s |
| Timeline scroll/zoom | ≥ 55 fps at 15 min project |
| Export reliability | 100% success on mixed codecs |
| Export duration | ≤ real-time × 1.3 for 1080p30 H.264 |
| Crashes | 0 blocking issues in smoke test |

## Out of Scope (MVP)
- GPU filter effects, LUTs, or color grading
- Multi-user collaboration
- Advanced transitions or animation
- Advanced audio waveform visualization
- Picture-in-Picture (PiP) or multi-track overlay export
- Mobile platform support

## Project Type
Desktop application using Electron with React/TypeScript frontend, Node.js backend with fluent-ffmpeg for video processing.

## Key Stakeholders
- Owner: Tony Kim
- Development Team: (To be determined)

## Current Status
Project initialization phase - architecture defined, ready to begin implementation.


