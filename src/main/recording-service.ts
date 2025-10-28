import { desktopCapturer } from 'electron'
import { existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import { ffmpegWrapper } from './ffmpeg-wrapper'

type RecordingOptions = {
  type: 'screen' | 'webcam'
}

export class RecordingService extends EventEmitter {
  private isRecording = false
  private recordingType: 'screen' | 'webcam' | null = null
  private ffmpegProcess: any = null
  private timeoutId: NodeJS.Timeout | null = null
  private readonly MAX_RECORDING_DURATION = 30 * 60 * 1000 // 30 minutes
  private readonly RECORDINGS_DIR = join(homedir(), 'Movies', 'ClipForge', 'recordings')

  constructor() {
    super()
    this.ensureRecordingsDir()
  }

  private ensureRecordingsDir() {
    if (!existsSync(this.RECORDINGS_DIR)) {
      mkdirSync(this.RECORDINGS_DIR, { recursive: true })
    }
  }

  private checkDiskSpace(): boolean {
    try {
      const stats = statSync(this.RECORDINGS_DIR)
      // Basic check - ensure we have at least 1GB free
      // In production, use proper disk space checking
      return true
    } catch (error) {
      console.error('[RecordingService] Disk space check failed:', error)
      return false
    }
  }

  async startRecording(options: RecordingOptions): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress')
    }

    if (!this.checkDiskSpace()) {
      throw new Error('Insufficient disk space for recording')
    }

    try {
      this.recordingType = options.type
      this.isRecording = true
      
      console.log(`[RecordingService] Starting ${options.type} recording`)

      // Generate output filename
      const timestamp = Date.now()
      const filename = `recording_${timestamp}.webm`
      const outputPath = join(this.RECORDINGS_DIR, filename)

      if (options.type === 'screen') {
        await this.startScreenRecording(outputPath)
      } else {
        await this.startWebcamRecording(outputPath)
      }

      // Set timeout for maximum recording duration
      this.timeoutId = setTimeout(() => {
        console.log('[RecordingService] Recording timeout reached (30 minutes)')
        this.stopRecording()
      }, this.MAX_RECORDING_DURATION)

      this.emit('started', { outputPath })
      
    } catch (error) {
      this.isRecording = false
      this.recordingType = null
      throw error
    }
  }

  private async startScreenRecording(outputPath: string): Promise<void> {
    // Get screen sources using desktopCapturer
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })

    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }

    console.log(`[RecordingService] Available screens: ${sources.length}`)
    
    // Use the first screen source
    const sourceId = sources[0].id
    console.log(`[RecordingService] Recording screen: ${sourceId}`)

    // For now, return success - real implementation will use MediaRecorder API
    // This is a placeholder for the MVP
    console.log(`[RecordingService] Would record to: ${outputPath}`)
    
    // TODO: Implement actual screen recording using MediaRecorder API
    // This requires more complex setup and will be implemented fully in production
  }

  private async startWebcamRecording(outputPath: string): Promise<void> {
    // For now, return success - real implementation will use getUserMedia API
    // This is a placeholder for the MVP
    console.log(`[RecordingService] Would record webcam to: ${outputPath}`)
    
    // TODO: Implement actual webcam recording using getUserMedia API
    // This requires more complex setup and will be implemented fully in production
  }

  async stopRecording(): Promise<{ path: string; metadata: any }> {
    if (!this.isRecording) {
      throw new Error('No recording in progress')
    }

    try {
      // Clear timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }

      console.log('[RecordingService] Stopping recording')
      
      // Stop the FFmpeg process if it exists
      if (this.ffmpegProcess) {
        this.ffmpegProcess.kill('SIGTERM')
        this.ffmpegProcess = null
      }

      // Generate mock output path for MVP
      const timestamp = Date.now()
      const filename = `recording_${timestamp}.webm`
      const outputPath = join(this.RECORDINGS_DIR, filename)

      this.isRecording = false
      this.recordingType = null

      // Emit completion event with mock metadata
      this.emit('stopped', {
        path: outputPath,
        metadata: {
          duration: 0,
          width: 1920,
          height: 1080,
          type: this.recordingType
        }
      })

      return {
        path: outputPath,
        metadata: {
          duration: 0,
          width: 1920,
          height: 1080,
          type: this.recordingType
        }
      }
    } catch (error) {
      this.isRecording = false
      this.recordingType = null
      throw error
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording
  }
}

export const recordingService = new RecordingService()


