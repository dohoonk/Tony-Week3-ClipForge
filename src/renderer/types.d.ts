import { Project } from '@shared/types'

interface Window {
  clipforge: {
    // File operations
    openFiles: () => Promise<string[]>
    probe: (path: string) => Promise<{ duration: number; width: number; height: number }>
    generateThumbnail: (path: string, timeOffset?: number) => Promise<string>
    
    // Project operations
    saveProject: (project: Project, path?: string) => Promise<string>
    openProject: () => Promise<Project | null>
    
    // Export operations
    exportTimeline: (project: Project, outPath: string) => Promise<void>
    
    // Recording operations
    startRecording: (options: { type: 'screen' | 'webcam' | 'pip' }) => Promise<{ success: boolean }>
    stopRecording: () => Promise<{ success: boolean }>
    isRecording: () => Promise<boolean>
    resetRecordingState: () => Promise<{ success: boolean }>
    saveRecording: (uint8Array: Uint8Array, outputPath: string) => Promise<{ success: boolean; path: string }>
    getScreenSources: () => Promise<any[]>
    
    // Event listeners
    onRecordingComplete: (callback: (path: string, metadata: any) => void) => void
    onRecordingProcessing: (callback: (message: string, progress: number) => void) => void
    onExportProgress: (callback: (data: { progress: number; timemark: string }) => void) => void
    onExportEnd: (callback: (data: { outputPath: string }) => void) => void
  }
}

