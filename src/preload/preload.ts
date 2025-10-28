import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('clipforge', {
  // Placeholder IPC methods - will be implemented in PR 3
  openFiles: () => ipcRenderer.invoke('openFiles'),
  probe: (path: string) => ipcRenderer.invoke('probe', path),
})

