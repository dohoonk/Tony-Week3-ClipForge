// Core data types for ClipForge

export type Clip = {
  id: string
  name: string
  path: string
  duration: number // seconds
  width: number
  height: number
  fileSize?: number // File size in bytes
  thumbnailPath?: string // Path to generated thumbnail image
  hash?: string // SHA-1 hash for transcript caching (AI feature)
}

export type TrackItem = {
  id: string
  clipId: string
  trackId: string // NEW: Track association
  inSec: number // trim start within clip
  outSec: number // trim end within clip
  trackPosition: number // absolute timeline position (seconds)
}

export type Track = {
  id: string
  kind: 'video' | 'overlay'
  order: number
  visible: boolean
  name: string
}

export type Project = {
  id: string
  name: string
  version: string
  clips: Record<string, Clip>
  tracks: Track[]
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export type ClipForgeState = {
  project: {
    id: string
    name: string
    version: string
    createdAt: string
    updatedAt: string
  }
  clips: Record<string, Clip>
  tracks: Record<string, Track>
  trackItems: Record<string, TrackItem>
  ui: {
    playheadSec: number
    zoom: number // multiplier (0.5x - 10x)
    selectedId?: string // selected trackItem
    isPlaying: boolean
    snapEnabled: boolean // snap-to-grid enabled
    snapInterval: number // snap grid interval in seconds (e.g., 0.5)
    snapToEdges: boolean // snap to clip edges enabled
  }
}

// AI-related types for transcription and filler detection
export type Transcript = {
  words: Array<{
    text: string
    startSec: number
    endSec: number
    confidence: number
  }>
  durationSec: number
  audioDurationSec: number
  modelVersion: string
}

export type FillerSpan = {
  clipId: string
  word: string
  startSec: number
  endSec: number
  confidence: number
  paddedStart: number
  paddedEnd: number
}

export type CutPlan = {
  trackItemId: string
  cuts: Array<{
    startSec: number
    endSec: number
  }>
}

// Config types for settings
export type Config = {
  openaiApiKey?: string
}

export type ScriptReview = {
  summary: string
  clarityNotes: string[]
  pacingNotes: string[]
  fillerNotes: string[]
  suggestions: Array<{
    original: string
    improved: string
  }>
}

