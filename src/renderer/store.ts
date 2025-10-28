import { create } from 'zustand'
import { ClipForgeState, Clip } from '@shared/types'

interface ClipForgeActions {
  // Clip actions
  addClip: (clip: Clip) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  
  // TrackItem actions
  addTrackItem: (item: any) => void
  removeTrackItem: (itemId: string) => void
  
  // UI actions
  setPlayheadSec: (seconds: number) => void
  setZoom: (zoom: number) => void
  setSelectedId: (id?: string) => void
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
  trackItems: {},
  ui: {
    playheadSec: 0,
    zoom: 1,
    selectedId: undefined,
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
  
  addTrackItem: (item: any) => set((state) => ({
    trackItems: { ...state.trackItems, [item.id]: item }
  })),
  
  removeTrackItem: (itemId: string) => set((state) => {
    const { [itemId]: _, ...trackItems } = state.trackItems
    return { trackItems }
  }),
  
  setPlayheadSec: (seconds: number) => set((state) => ({
    ui: { ...state.ui, playheadSec: seconds }
  })),
  
  setZoom: (zoom: number) => set((state) => ({
    ui: { ...state.ui, zoom }
  })),
  
  setSelectedId: (id?: string) => set((state) => ({
    ui: { ...state.ui, selectedId: id }
  })),
}))

