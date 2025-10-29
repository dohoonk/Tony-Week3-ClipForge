import { contextBridge, ipcRenderer } from 'electron'

// Secure IPC API surface for ClipForge
contextBridge.exposeInMainWorld('clipforge', {
  // File operations
  openFiles: () => ipcRenderer.invoke('openFiles'),
  probe: (path: string) => ipcRenderer.invoke('probe', path),
  generateThumbnail: (path: string, timeOffset?: number) => 
    ipcRenderer.invoke('generateThumbnail', path, timeOffset),
  saveDroppedFile: (fileData: Uint8Array, fileName: string) => 
    ipcRenderer.invoke('saveDroppedFile', fileData, fileName),
  
  // Project operations
  saveProject: (project: any, path?: string) => 
    ipcRenderer.invoke('saveProject', project, path),
  openProject: () => ipcRenderer.invoke('openProject'),
  
  // Export operations
  exportTimeline: (project: any, outPath: string, resolution?: '720p' | '1080p' | 'source') => 
    ipcRenderer.invoke('exportTimeline', project, outPath, resolution),
  
  // Recording operations
  startRecording: (options: any) => 
    ipcRenderer.invoke('startRecording', options),
  stopRecording: () => ipcRenderer.invoke('stopRecording'),
  isRecording: () => ipcRenderer.invoke('isRecording'),
  resetRecordingState: () => ipcRenderer.invoke('resetRecordingState'),
  saveRecording: (uint8Array: Uint8Array, outputPath: string) => 
    ipcRenderer.invoke('saveRecording', uint8Array, outputPath),
  getScreenSources: () => ipcRenderer.invoke('getScreenSources'),
  
  // AI transcription operations
  transcribeClipByPath: (clipPath: string, clipHash?: string) => 
    ipcRenderer.invoke('transcribeClipByPath', clipPath, clipHash),
  detectFillers: (clipPath: string, clipId: string, clipHash?: string, options?: { confMin?: number }) => 
    ipcRenderer.invoke('detectFillers', clipPath, clipId, clipHash, options),
  
  // Event listeners
  onRecordingComplete: (callback: (path: string, metadata: any) => void) => {
    ipcRenderer.on('recording:completed', (_event, path: string, metadata: any) => 
      callback(path, metadata)
    )
  },
  
  onRecordingProcessing: (callback: (message: string, progress: number) => void) => {
    ipcRenderer.on('recording:processing', (_event, message: string, progress: number) => 
      callback(message, progress)
    )
  },
  
  onExportProgress: (callback: (data: { progress: number; timemark: string }) => void) => {
    ipcRenderer.on('export:progress', (_event, data: any) => 
      callback(data)
    )
  },
  
  onExportEnd: (callback: (data: { outputPath: string }) => void) => {
    ipcRenderer.on('export:end', (_event, data: any) => 
      callback(data)
    )
  },
  
  onTranscriptionProgress: (callback: (data: { percent: number; message: string }) => void) => {
    ipcRenderer.on('transcription:progress', (_event, data: any) => 
      callback(data)
    )
  },
  
  onTranscriptionError: (callback: (data: { message: string }) => void) => {
    ipcRenderer.on('transcription:error', (_event, data: any) => 
      callback(data)
    )
  },
})

