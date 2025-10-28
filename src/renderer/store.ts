import { create } from 'zustand'
import { ClipForgeState } from '@shared/types'

export const useStore = create<ClipForgeState>((set) => ({
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
}))

