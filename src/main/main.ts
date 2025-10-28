import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { setupIpcHandlers } from './ipc-handlers'
import { projectIO } from './project-io'

// Platform check: macOS only
if (process.platform !== 'darwin') {
  console.error('ClipForge is only supported on macOS')
  app.quit()
  process.exit(1)
}

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow local file:// URLs for video playback
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Setup autosave when content is ready
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[Main] Window ready, autosave will start when project loaded')
  })
}

app.whenReady().then(async () => {
  // Setup IPC handlers before creating window
  setupIpcHandlers()

  createWindow()

  // Check for autosave recovery after window is created
  const autosaveProject = await projectIO.checkAutosave()
  if (autosaveProject && mainWindow) {
    mainWindow.webContents.send('project:autosave-recovery', autosaveProject)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

