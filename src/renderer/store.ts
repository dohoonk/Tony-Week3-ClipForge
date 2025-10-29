import { create } from 'zustand'
import { ClipForgeState, Clip } from '@shared/types'

const MIN_TRACK_HEIGHT = 60
const MAX_TRACK_HEIGHT = 120

interface Track {
  id: string
  kind: 'video' | 'overlay'
  order: number
  visible: boolean
  name: string
  height: number // NEW: Track height management
}

interface ClipForgeActions {
  // Clip actions
  addClip: (clip: Clip) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  updateClipDuration: (clipId: string, duration: number) => void
  
  // Track actions
  addTrack: (track: Track) => void
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, updates: Partial<Track>) => void
  moveTrackUp: (trackId: string) => void
  moveTrackDown: (trackId: string) => void
  setTrackHeight: (trackId: string, height: number) => void
  toggleTrackVisibility: (trackId: string) => void
  
  // TrackItem actions
  addTrackItem: (item: any) => void
  removeTrackItem: (itemId: string) => void
  updateTrackItem: (itemId: string, updates: Partial<any>) => void
  
  // UI actions
  setPlayheadSec: (seconds: number) => void
  setZoom: (zoom: number) => void
  setSelectedId: (id?: string) => void
  setIsPlaying: (isPlaying: boolean) => void
}

type ClipForgeStore = ClipForgeState & ClipForgeActions

export const useStore = create<ClipForgeStore>((set) => ({
  // State
  project: {
    id: '',
    name: 'Untitled Project',
    version: '1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  clips: {},
  tracks: {
    'track-1': {
      id: 'track-1',
      kind: 'video',
      order: 0,
      visible: true,
      name: 'Video Track 1',
      height: 80 // Default track height
    }
  },
  trackItems: {},
  ui: {
    playheadSec: 0,
    zoom: 1,
    selectedId: undefined,
    isPlaying: false,
  },
  
  // Actions
  addClip: (clip: Clip) => set((state) => ({
    clips: { ...state.clips, [clip.id]: clip }
  })),
  
  removeClip: (clipId: string) => set((state) => {
    const { [clipId]: _, ...clips } = state.clips
    return { clips }
  }),
  
  updateClip: (clipId: string, updates: Partial<Clip>) => set((state) => ({
    clips: { ...state.clips, [clipId]: { ...state.clips[clipId], ...updates } }
  })),
  
  updateClipDuration: (clipId: string, duration: number) => set((state) => ({
    clips: { ...state.clips, [clipId]: { ...state.clips[clipId], duration } }
  })),
  
  // Track actions
  addTrack: (track: Track) => set((state) => ({
    tracks: { ...state.tracks, [track.id]: track }
  })),
  
  removeTrack: (trackId: string) => set((state) => {
    const { [trackId]: _, ...tracks } = state.tracks
    // Also remove trackItems that belong to this track
    const trackItems = Object.fromEntries(
      Object.entries(state.trackItems).filter(([_, item]) => item.trackId !== trackId)
    )
    return { tracks, trackItems }
  }),
  
  updateTrack: (trackId: string, updates: Partial<Track>) => set((state) => ({
    tracks: { ...state.tracks, [trackId]: { ...state.tracks[trackId], ...updates } }
  })),
  
  moveTrackUp: (trackId: string) => set((state) => {
    const track = state.tracks[trackId]
    if (!track) return state
    
    const sortedTracks = Object.values(state.tracks).sort((a, b) => a.order - b.order)
    const currentIndex = sortedTracks.findIndex(t => t.id === trackId)
    
    if (currentIndex > 0) {
      const prevTrack = sortedTracks[currentIndex - 1]
      const newTracks = { ...state.tracks }
      newTracks[trackId] = { ...track, order: prevTrack.order }
      newTracks[prevTrack.id] = { ...prevTrack, order: track.order }
      return { tracks: newTracks }
    }
    return state
  }),
  
      moveTrackDown: (trackId: string) => set((state) => {
        const track = state.tracks[trackId]
        if (!track) return state
        
        const sortedTracks = Object.values(state.tracks).sort((a, b) => a.order - b.order)
        const currentIndex = sortedTracks.findIndex(t => t.id === trackId)
        
        if (currentIndex < sortedTracks.length - 1) {
          const nextTrack = sortedTracks[currentIndex + 1]
          const newTracks = { ...state.tracks }
          newTracks[trackId] = { ...track, order: nextTrack.order }
          newTracks[nextTrack.id] = { ...nextTrack, order: track.order }
          return { tracks: newTracks }
        }
        return state
      }),
      
      setTrackHeight: (trackId: string, height: number) => set((state) => {
        const track = state.tracks[trackId]
        if (!track) return state
        
        const clampedHeight = Math.max(MIN_TRACK_HEIGHT, Math.min(MAX_TRACK_HEIGHT, height))
        return {
          tracks: { ...state.tracks, [trackId]: { ...track, height: clampedHeight } }
        }
      }),
      
      toggleTrackVisibility: (trackId: string) => set((state) => {
        const track = state.tracks[trackId]
        if (!track) return state
        
        return {
          tracks: { ...state.tracks, [trackId]: { ...track, visible: !track.visible } }
        }
      }),
  
  addTrackItem: (item: any) => set((state) => ({
    trackItems: { ...state.trackItems, [item.id]: item }
  })),
  
  removeTrackItem: (itemId: string) => set((state) => {
    const { [itemId]: _, ...trackItems } = state.trackItems
    return { trackItems }
  }),
  
  updateTrackItem: (itemId: string, updates: Partial<any>) => set((state) => ({
    trackItems: { ...state.trackItems, [itemId]: { ...state.trackItems[itemId], ...updates } }
  })),
  
  setPlayheadSec: (seconds: number) => set((state) => ({
    ui: { ...state.ui, playheadSec: seconds }
  })),
  
  setZoom: (zoom: number) => set((state) => ({
    ui: { ...state.ui, zoom }
  })),
  
  setSelectedId: (id?: string) => set((state) => ({
    ui: { ...state.ui, selectedId: id }
  })),
  
  setIsPlaying: (isPlaying: boolean) => set((state) => ({
    ui: { ...state.ui, isPlaying }
  })),
}))

