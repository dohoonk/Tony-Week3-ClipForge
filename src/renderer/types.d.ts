import { Project, Transcript } from '@shared/types'

interface Window {
  clipforge: {
    // File operations
    openFiles: () => Promise<Array<{ path: string; hash: string }>>
    probe: (path: string) => Promise<{ duration: number; width: number; height: number; fileSize?: number }>
    generateThumbnail: (path: string, timeOffset?: number) => Promise<string>
    saveDroppedFile: (fileData: Uint8Array, fileName: string) => Promise<{ path: string; hash: string }>
    
    // Project operations
    saveProject: (project: Project, path?: string) => Promise<string>
    openProject: () => Promise<Project | null>
    
    // Export operations
    exportTimeline: (project: Project, outPath: string, resolution?: '720p' | '1080p' | 'source') => Promise<void>
    
    // Recording operations
    startRecording: (options: { type: 'screen' | 'webcam' | 'pip' }) => Promise<{ success: boolean }>
    stopRecording: () => Promise<{ success: boolean }>
    isRecording: () => Promise<boolean>
    resetRecordingState: () => Promise<{ success: boolean }>
    saveRecording: (uint8Array: Uint8Array, outputPath: string) => Promise<{ success: boolean; path: string }>
    getScreenSources: () => Promise<any[]>
    
    // AI transcription operations
    transcribeClipByPath: (clipPath: string, clipHash?: string) => Promise<Transcript>
    
    // Event listeners
    onRecordingComplete: (callback: (path: string, metadata: any) => void) => void
    onRecordingProcessing: (callback: (message: string, progress: number) => void) => void
    onExportProgress: (callback: (data: { progress: number; timemark: string }) => void) => void
    onExportEnd: (callback: (data: { outputPath: string }) => void) => void
    onTranscriptionProgress: (callback: (data: { percent: number; message: string }) => void) => void
    onTranscriptionError: (callback: (data: { message: string }) => void) => void
  }
}

