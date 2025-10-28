import ffmpeg from 'fluent-ffmpeg'
import { EventEmitter } from 'events'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const existsSync = fs.existsSync

// FFmpeg wrapper for ClipForge
export class FFmpegWrapper extends EventEmitter {
  private ffmpegPath: string = 'ffmpeg'
  private ffprobePath: string = 'ffprobe'

  constructor() {
    super()
    this.bindFfBins()
  }

  /**
   * Binds FFmpeg and FFprobe binary paths
   * - In development: uses system binaries or looks in bin/mac/
   * - In production: uses bundled binaries from app.asar
   */
  bindFfBins() {
    const isPackaged = app.isPackaged
    const platform = process.platform
    
    if (platform === 'darwin') {
      // Try multiple locations
      const possiblePaths = [
        // Bundled binaries (production)
        ...(isPackaged 
          ? [path.join(process.resourcesPath, 'bin', 'ffmpeg')]
          : []
        ),
        // Development binaries
        path.join(process.cwd(), 'bin', 'mac', 'ffmpeg'),
        // System binaries (fallback)
        'ffmpeg',
      ]

      for (const testPath of possiblePaths) {
        try {
          if (existsSync(testPath) || !testPath.includes('/')) {
            this.ffmpegPath = testPath
            this.ffprobePath = testPath.replace('ffmpeg', 'ffprobe')
            console.log(`[FFmpeg] Using binaries at: ${this.ffmpegPath}`)
            break
          }
        } catch (error) {
          continue
        }
      }

      // Set paths in fluent-ffmpeg
      ffmpeg.setFfmpegPath(this.ffmpegPath)
      ffmpeg.setFfprobePath(this.ffprobePath)
    } else {
      console.warn('[FFmpeg] macOS only for now')
    }
  }

  /**
   * Probe video file to extract metadata
   * @param filePath Path to video file
   * @returns Metadata object with duration, width, height
   */
  async probe(filePath: string): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .ffprobe((err, metadata) => {
          if (err) {
            console.error('[FFmpeg] Probe error:', err)
            reject(new Error(`Failed to probe video: ${err.message}`))
            return
          }

          const videoStream = metadata.streams?.find(s => s.codec_type === 'video')
          if (!videoStream) {
            reject(new Error('No video stream found'))
            return
          }

          resolve({
            duration: metadata.format.duration || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
          })
        })
    })
  }

  /**
   * Mock export with progress events (placeholder for PR 12)
   * @param project Project data
   * @param outputPath Output file path
   */
  async exportTimeline(project: any, outputPath: string): Promise<void> {
    // This is a mock implementation for PR 4
    // Real export will be implemented in PR 12
    
    return new Promise((resolve) => {
      let progress = 0
      
      const interval = setInterval(() => {
        progress += 10
        this.emit('export:progress', { progress, timemark: `${progress}` })
        
        if (progress >= 100) {
          clearInterval(interval)
          this.emit('export:end', { outputPath })
          resolve()
        }
      }, 100)
    })
  }
}

// Singleton instance
export const ffmpegWrapper = new FFmpegWrapper()

