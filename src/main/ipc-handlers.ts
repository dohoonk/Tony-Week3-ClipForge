import { ipcMain, dialog, BrowserWindow } from 'electron'
import { ffmpegWrapper } from './ffmpeg-wrapper'
import { projectIO } from './project-io'
import { recordingService } from './recording-service'

// Type definitions for IPC handlers
type Clip = {
  id: string
  name: string
  path: string
  duration: number
  width: number
  height: number
}

type TrackItem = {
  id: string
  clipId: string
  inSec: number
  outSec: number
  trackPosition: number
}

type Project = {
  id: string
  name: string
  version: string
  clips: Record<string, Clip>
  tracks: any[]
  createdAt: string
  updatedAt: string
}

// IPC Handlers for PR 3
// These will be implemented with actual functionality in later PRs

export function setupIpcHandlers() {
  // openFiles - Show file dialog and return selected paths
  ipcMain.handle('openFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'webm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (result.canceled) {
      return []
    }

    return result.filePaths
  })

  // probe - Extract metadata from video file using FFprobe
  ipcMain.handle('probe', async (_event, filePath: string) => {
    // Input validation
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid path: path must be a non-empty string')
    }

    // Path sanitization - basic check for relative paths
    if (filePath.includes('..')) {
      throw new Error('Invalid path: directory traversal not allowed')
    }

    console.log(`[IPC] probe called for: ${filePath}`)
    
    try {
      const metadata = await ffmpegWrapper.probe(filePath)
      console.log(`[IPC] probe result:`, metadata)
      return metadata
    } catch (error) {
      console.error('[IPC] Probe failed:', error)
      throw error
    }
  })

  // exportTimeline - Export project to MP4 with progress events
  ipcMain.handle('exportTimeline', async (_event, project: Project, outPath: string) => {
    // Input validation
    if (!project || typeof project !== 'object') {
      throw new Error('Invalid project: must be a valid project object')
    }

    if (!outPath || typeof outPath !== 'string') {
      throw new Error('Invalid output path: must be a non-empty string')
    }

    console.log(`[IPC] exportTimeline called for: ${outPath}`)
    
    // Mock export with progress events (real implementation in PR 12)
    try {
      await ffmpegWrapper.exportTimeline(project, outPath)
      console.log('[IPC] exportTimeline completed')
      return
    } catch (error) {
      console.error('[IPC] Export failed:', error)
      throw error
    }
  })

  // Setup progress event forwarding to all windows
  const sendToAllWindows = (channel: string, ...args: any[]) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(channel, ...args)
    })
  }

  ffmpegWrapper.on('export:progress', (data: any) => {
    console.log('[IPC] Export progress:', data.progress + '%')
    sendToAllWindows('export:progress', data)
  })

  ffmpegWrapper.on('export:end', (data: any) => {
    console.log('[IPC] Export completed:', data.outputPath)
    sendToAllWindows('export:end', data)
  })

  // saveProject - Save project JSON to disk
  ipcMain.handle('saveProject', async (_event, project: Project, filePath?: string) => {
    console.log('[IPC] saveProject called')
    
    try {
      const savedPath = await projectIO.saveProject(project, filePath)
      return savedPath
    } catch (error: any) {
      console.error('[IPC] Save failed:', error)
      throw error
    }
  })

  // openProject - Load project JSON from disk
  ipcMain.handle('openProject', async () => {
    console.log('[IPC] openProject called')
    
    try {
      const project = await projectIO.openProject()
      return project
    } catch (error: any) {
      console.error('[IPC] Open failed:', error)
      throw error
    }
  })

  // startRecording - Begin screen/webcam recording
  ipcMain.handle('startRecording', async (event, type: 'screen' | 'webcam') => {
    console.log('[IPC] startRecording called for type:', type)
    
    try {
      if (!type || (type !== 'screen' && type !== 'webcam')) {
        throw new Error('Invalid recording type. Must be "screen" or "webcam"')
      }

      await recordingService.startRecording({ type })
      
      // Listen for recording events
      recordingService.on('started', (data: any) => {
        console.log('[IPC] Recording started:', data.outputPath)
      })

      recordingService.on('stopped', (data: any) => {
        console.log('[IPC] Recording stopped:', data)
        
        // Send to renderer
        const mainWindow = BrowserWindow.fromWebContents(event.sender)
        if (mainWindow) {
          mainWindow.webContents.send('recording:completed', data.path, data.metadata)
        }
      })

      return { success: true }
    } catch (error: any) {
      console.error('[IPC] Start recording failed:', error)
      throw error
    }
  })

  // stopRecording - Stop active recording
  ipcMain.handle('stopRecording', async (event) => {
    console.log('[IPC] stopRecording called')
    
    try {
      const result = await recordingService.stopRecording()
      
      // Send completion event to renderer
      const mainWindow = BrowserWindow.fromWebContents(event.sender)
      if (mainWindow) {
        mainWindow.webContents.send('recording:completed', result.path, result.metadata)
      }
      
      return result
    } catch (error: any) {
      console.error('[IPC] Stop recording failed:', error)
      throw error
    }
  })

  console.log('[IPC] All handlers registered successfully')
}

