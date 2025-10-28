import { contextBridge, ipcRenderer } from 'electron'

// Secure IPC API surface for ClipForge
contextBridge.exposeInMainWorld('clipforge', {
  // File operations
  openFiles: () => ipcRenderer.invoke('openFiles'),
  probe: (path: string) => ipcRenderer.invoke('probe', path),
  
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
  
  // Event listeners
  onRecordingComplete: (callback: (path: string, metadata: any) => void) => {
    ipcRenderer.on('recording:completed', (_event, path: string, metadata: any) => 
      callback(path, metadata)
    )
  },
})

