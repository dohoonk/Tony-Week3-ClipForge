import { Project } from '@shared/types'

interface Window {
  clipforge: {
    // File operations
    openFiles: () => Promise<string[]>
    probe: (path: string) => Promise<{ duration: number; width: number; height: number }>
    
    // Project operations
    saveProject: (project: Project, path?: string) => Promise<string>
    openProject: () => Promise<Project | null>
    
    // Export operations
    exportTimeline: (project: Project, outPath: string) => Promise<void>
    
    // Recording operations
    startRecording: (options: { type: 'screen' | 'webcam' }) => Promise<{ success: boolean }>
    stopRecording: () => Promise<{ success: boolean }>
    
    // Event listeners
    onRecordingComplete: (callback: (path: string, metadata: any) => void) => void
    onExportProgress: (callback: (data: { progress: number; timemark: string }) => void) => void
    onExportEnd: (callback: (data: { outputPath: string }) => void) => void
  }
}

