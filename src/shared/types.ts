// Core data types for ClipForge

export type Clip = {
  id: string
  name: string
  path: string
  duration: number // seconds
  width: number
  height: number
}

export type TrackItem = {
  id: string
  clipId: string
  inSec: number // trim start within clip
  outSec: number // trim end within clip
  trackPosition: number // absolute timeline position (seconds)
}

export type Track = {
  id: string
  kind: 'video' | 'overlay'
  items: TrackItem[]
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
  trackItems: Record<string, TrackItem>
  ui: {
    playheadSec: number
    zoom: number // multiplier (0.5x - 10x)
    selectedId?: string // selected trackItem
  }
}

