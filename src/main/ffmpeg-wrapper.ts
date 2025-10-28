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
   * Export timeline with filter_complex for trimmed concatenation
   * @param project Project data with clips and trackItems (flat or nested)
   * @param outputPath Output file path
   */
  async exportTimeline(project: any, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Handle both flat (from Zustand) and nested (from Project type) structures
      let clips = project.clips
      let trackItems = project.trackItems
      
      // If nested structure (with tracks), flatten it
      if (project.tracks && !trackItems) {
        trackItems = {}
        for (const track of project.tracks) {
          for (const item of track.items) {
            trackItems[item.id] = item
          }
        }
      }
      
      // Sort trackItems by position
      const sortedItems = Object.values(trackItems as any[]).sort((a: any, b: any) => 
        a.trackPosition - b.trackPosition
      )
      
      if (sortedItems.length === 0) {
        reject(new Error('No track items to export'))
        return
      }
      
      // Build FFmpeg command with filter_complex
      let command = ffmpeg()
      
      // Add input files (we need one input per unique clipId)
      const uniqueClipIds = [...new Set(sortedItems.map((item: any) => item.clipId))]
      
      for (const clipId of uniqueClipIds) {
        const clip = clips[clipId]
        if (!clip) {
          console.warn(`[FFmpeg] Clip not found: ${clipId}`)
          continue
        }
        command.input(clip.path)
      }
      
      // Build filter_complex string:
      // For each trackItem: trim + setpts (offset by trackPosition)
      const filterParts: string[] = []
      const videoConcatInputs: string[] = []
      const audioConcatInputs: string[] = []
      
      // Map clip inputs by their index
      const clipIndexMap: Record<string, number> = {}
      let inputIndex = 0
      
      for (const clipId of uniqueClipIds) {
        clipIndexMap[clipId] = inputIndex++
      }
      
      // Generate trim filters for each trackItem
      let streamIndex = 0
      for (const item of sortedItems) {
        const itemData = item as any
        const clip = clips[itemData.clipId]
        if (!clip) continue
        
        const inputIndex = clipIndexMap[itemData.clipId]
        
        // Calculate trim: [inSec, outSec]
        // Then offset by trackPosition for placement
        const inSec = itemData.inSec || 0
        const outSec = itemData.outSec || clip.duration
        const position = itemData.trackPosition || 0
        
        // Trim video and audio
        const videoLabel = `v${streamIndex}`
        const audioLabel = `a${streamIndex}`
        
        // Video filter
        filterParts.push(`[${inputIndex}:v]trim=${inSec}:${outSec},setpts=PTS-STARTPTS+${position}/TB[${videoLabel}]`)
        videoConcatInputs.push(`[${videoLabel}]`)
        
        // Audio filter
        filterParts.push(`[${inputIndex}:a]atrim=${inSec}:${outSec},asetpts=PTS-STARTPTS+${position}/TB[${audioLabel}]`)
        audioConcatInputs.push(`[${audioLabel}]`)
        
        streamIndex++
      }
      
      // Concatenate all trimmed segments (video and audio)
      if (videoConcatInputs.length > 0) {
        filterParts.push(`${videoConcatInputs.join('')}concat=n=${videoConcatInputs.length}:v=1:a=0[outv]`)
        filterParts.push(`${audioConcatInputs.join('')}concat=n=${audioConcatInputs.length}:v=0:a=1[outa]`)
        
        const filterComplex = filterParts.join(';')
        console.log(`[FFmpeg] Filter complex: ${filterComplex}`)
        
        command
          .complexFilter(filterComplex)
          .outputOptions(['-map [outv]'])
          .outputOptions(['-map [outa]'])
          .outputOptions(['-c:v libx264', '-preset veryfast', '-crf 20'])
          .outputOptions(['-c:a aac', '-b:a 192k'])
          .on('start', (cmdline) => {
            console.log('[FFmpeg] Export started:', cmdline)
          })
          .on('progress', (progress) => {
            // Emit progress updates
            const percent = progress.percent || 0
            this.emit('export:progress', { 
              progress: percent, 
              timemark: progress.timemark || '0:00:00'
            })
          })
          .on('end', () => {
            console.log('[FFmpeg] Export completed')
            this.emit('export:end', { outputPath })
            resolve()
          })
          .on('error', (err) => {
            console.error('[FFmpeg] Export error:', err)
            reject(err)
          })
          .save(outputPath)
      } else {
        reject(new Error('No valid track items found'))
      }
    })
  }
}

// Singleton instance
export const ffmpegWrapper = new FFmpegWrapper()

