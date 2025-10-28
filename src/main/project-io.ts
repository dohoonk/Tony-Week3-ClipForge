import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { dialog } from 'electron'

// Project I/O for ClipForge
export class ProjectIO {
  private autosaveInterval: NodeJS.Timeout | null = null
  private autosavePath: string
  private dataDir: string

  constructor() {
    this.dataDir = path.join(app.getPath('home'), '.clipforge')
    this.autosavePath = path.join(this.dataDir, 'autosave.json')
    
    // Ensure data directory exists
    this.ensureDataDirectory()
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  /**
   * Save project to disk
   * @param project Project object
   * @param filePath Optional file path (uses dialog if not provided)
   * @returns Path where project was saved
   */
  async saveProject(project: any, filePath?: string): Promise<string> {
    // Validate project structure
    this.validateProject(project)

    // Serialize nested tracks to flat trackItems if needed
    const serializedProject = this.serializeProject(project)

    // Use provided path or show save dialog
    let savePath = filePath
    if (!savePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Project',
        defaultPath: path.join(this.dataDir, 'projects', `${project.name || 'untitled'}.json`),
        filters: [
          { name: 'ClipForge Project', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })

      if (result.canceled) {
        throw new Error('Save canceled by user')
      }

      savePath = result.filePath!
    }

    // Ensure directory exists
    const dir = path.dirname(savePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Update timestamps
    serializedProject.updatedAt = new Date().toISOString()
    if (!serializedProject.createdAt) {
      serializedProject.createdAt = new Date().toISOString()
    }

    // Write to file
    fs.writeFileSync(savePath, JSON.stringify(serializedProject, null, 2))

    console.log(`[ProjectIO] Saved project to: ${savePath}`)
    return savePath
  }

  /**
   * Load project from disk
   * @returns Project object or null if canceled
   */
  async openProject(): Promise<any | null> {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      defaultPath: path.join(this.dataDir, 'projects'),
      filters: [
        { name: 'ClipForge Project', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled) {
      return null
    }

    const filePath = result.filePaths[0]
    const data = fs.readFileSync(filePath, 'utf-8')
    const project = JSON.parse(data)

    // Deserialize flat trackItems to nested tracks
    const deserializedProject = this.deserializeProject(project)

    // Validate loaded project
    this.validateProject(deserializedProject)

    console.log(`[ProjectIO] Loaded project from: ${filePath}`)
    return deserializedProject
  }

  /**
   * Check if autosave exists and prompt for recovery
   */
  async checkAutosave(): Promise<any | null> {
    if (!fs.existsSync(this.autosavePath)) {
      return null
    }

    const response = await dialog.showMessageBox({
      type: 'warning',
      title: 'Autosave Recovery',
      message: 'An autosave file was found.',
      detail: 'Would you like to restore your work from the autosave file?',
      buttons: ['Restore', 'Dismiss'],
      defaultId: 0,
      cancelId: 1,
    })

    if (response.response === 0) {
      const data = fs.readFileSync(this.autosavePath, 'utf-8')
      const project = JSON.parse(data)
      const deserializedProject = this.deserializeProject(project)
      this.validateProject(deserializedProject)
      console.log('[ProjectIO] Autosave recovered')
      return deserializedProject
    }

    return null
  }

  /**
   * Start autosave interval (30 seconds)
   * @param project Current project state
   */
  startAutosave(project: any) {
    // Clear existing interval
    this.stopAutosave()

    // Save every 30 seconds
    this.autosaveInterval = setInterval(() => {
      try {
        const serialized = this.serializeProject(project)
        serialized.updatedAt = new Date().toISOString()
        fs.writeFileSync(this.autosavePath, JSON.stringify(serialized, null, 2))
        console.log('[ProjectIO] Autosaved')
      } catch (error) {
        console.error('[ProjectIO] Autosave failed:', error)
      }
    }, 30000) // 30 seconds
  }

  /**
   * Stop autosave interval
   */
  stopAutosave() {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval)
      this.autosaveInterval = null
    }
  }

  /**
   * Clear autosave file
   */
  clearAutosave() {
    if (fs.existsSync(this.autosavePath)) {
      fs.unlinkSync(this.autosavePath)
    }
  }

  /**
   * Validate project structure
   */
  private validateProject(project: any) {
    if (!project || typeof project !== 'object') {
      throw new Error('Invalid project: must be an object')
    }

    if (!project.version || typeof project.version !== 'string') {
      throw new Error('Invalid project: missing or invalid version')
    }

    if (!project.clips || typeof project.clips !== 'object') {
      throw new Error('Invalid project: missing or invalid clips')
    }

    if (!Array.isArray(project.tracks) && !project.trackItems) {
      throw new Error('Invalid project: missing tracks or trackItems')
    }
  }

  /**
   * Serialize project: flatten tracks to trackItems
   * Runtime state -> File format
   */
  private serializeProject(project: any): any {
    // If already has tracks format, return as is
    if (Array.isArray(project.tracks)) {
      return project
    }

    // Convert flat trackItems back to nested tracks, organized by trackId
    const serialized = { ...project }
    
    if (project.trackItems && project.tracks) {
      // Group trackItems by trackId
      const tracksMap: Record<string, any[]> = {}
      Object.values(project.trackItems).forEach((item: any) => {
        const trackId = item.trackId || 'track-1' // fallback to default track
        if (!tracksMap[trackId]) {
          tracksMap[trackId] = []
        }
        tracksMap[trackId].push(item)
      })
      
      // Convert to array of tracks with their items
      serialized.tracks = Object.entries(tracksMap).map(([trackId, items]) => {
        const track = project.tracks[trackId] || {
          id: trackId,
          kind: 'video',
          order: 0,
          visible: true,
          name: trackId
        }
        return {
          ...track,
          items
        }
      }).sort((a, b) => (a.order || 0) - (b.order || 0))
      
      delete serialized.trackItems
      delete serialized.tracks // Remove the flat tracks object
    }

    return serialized
  }

  /**
   * Deserialize project: convert nested tracks to flat trackItems
   * File format -> Runtime state
   */
  private deserializeProject(project: any): any {
    const deserialized = { ...project }

    if (Array.isArray(project.tracks)) {
      // Restore tracks as a record
      deserialized.tracks = {}
      project.tracks.forEach((track: any) => {
        const { items, ...trackData } = track
        deserialized.tracks[track.id] = {
          ...trackData,
          order: trackData.order || trackData.id ? parseInt(trackData.id.split('-')[1] || '0') : 0,
          visible: trackData.visible !== undefined ? trackData.visible : true,
          name: trackData.name || `Track ${trackData.order || 0}`
        }
      })
      
      // Convert nested items to flat trackItems with trackId
      deserialized.trackItems = {}
      project.tracks.forEach((track: any) => {
        if (track.items) {
          track.items.forEach((item: any) => {
            deserialized.trackItems[item.id] = {
              ...item,
              trackId: item.trackId || track.id // Ensure trackId is set
            }
          })
        }
      })
      
      // Remove the array tracks
      delete deserialized.tracks
    }

    return deserialized
  }
}

// Singleton instance
export const projectIO = new ProjectIO()

