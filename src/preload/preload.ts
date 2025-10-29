import { contextBridge, ipcRenderer } from 'electron'

// Secure IPC API surface for ClipForge
contextBridge.exposeInMainWorld('clipforge', {
  // File operations
  openFiles: () => ipcRenderer.invoke('openFiles'),
  probe: (path: string) => ipcRenderer.invoke('probe', path),
  generateThumbnail: (path: string, timeOffset?: number) => 
    ipcRenderer.invoke('generateThumbnail', path, timeOffset),
  
  // Project operations
  saveProject: (project: any, path?: string) => 
    ipcRenderer.invoke('saveProject', project, path),
  openProject: () => ipcRenderer.invoke('openProject'),
  
  // Export operations
  exportTimeline: (project: any, outPath: string) => 
    ipcRenderer.invoke('exportTimeline', project, outPath),
  
  // Recording operations
  startRecording: (options: any) => 
    ipcRenderer.invoke('startRecording', options),
  stopRecording: () => ipcRenderer.invoke('stopRecording'),
  isRecording: () => ipcRenderer.invoke('isRecording'),
  resetRecordingState: () => ipcRenderer.invoke('resetRecordingState'),
  saveRecording: (uint8Array: Uint8Array, outputPath: string) => 
    ipcRenderer.invoke('saveRecording', uint8Array, outputPath),
  getScreenSources: () => ipcRenderer.invoke('getScreenSources'),
  
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
})

