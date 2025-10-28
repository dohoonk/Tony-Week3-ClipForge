import { desktopCapturer, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import { ffmpegWrapper } from './ffmpeg-wrapper'

type RecordingOptions = {
  type: 'screen' | 'webcam'
}

export class RecordingService extends EventEmitter {
  public isRecording = false
  private recordingType: 'screen' | 'webcam' | null = null
  private timeoutId: NodeJS.Timeout | null = null
  private readonly MAX_RECORDING_DURATION = 30 * 60 * 1000 // 30 minutes
  private readonly RECORDINGS_DIR = join(homedir(), 'Movies', 'ClipForge', 'recordings')
  private currentOutputPath: string | null = null
  private recordingStartTime: number | null = null

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

  async resetRecordingState(): Promise<void> {
    console.log('[RecordingService] Resetting recording state')
    this.isRecording = false
    this.recordingType = null
    this.currentOutputPath = null
    this.recordingStartTime = null
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
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
      this.recordingStartTime = Date.now()
      
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
    try {
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

      // Get the main window to access navigator.mediaDevices
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        throw new Error('No main window available')
      }

      // Use webContents.executeJavaScript to access MediaRecorder API
      await mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            // Get screen capture stream
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: '${sourceId}',
                  minWidth: 1280,
                  maxWidth: 1920,
                  minHeight: 720,
                  maxHeight: 1080
                }
              }
            })

            // Check if MediaRecorder supports the format
            const supportedTypes = [
              'video/webm;codecs=vp8',
              'video/webm;codecs=vp9',
              'video/webm',
              'video/mp4'
            ]
            
            let mimeType = 'video/webm;codecs=vp8'
            for (const type of supportedTypes) {
              if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type
                break
              }
            }
            
            console.log('[Recording] Using mimeType:', mimeType)

            // Create MediaRecorder with more compatible settings
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: mimeType
            })

            const chunks = []
            
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                chunks.push(event.data)
              }
            }

            mediaRecorder.onstop = async () => {
              try {
                const blob = new Blob(chunks, { type: 'video/webm' })
                const arrayBuffer = await blob.arrayBuffer()
                
                // Convert to Uint8Array for IPC transmission
                const uint8Array = new Uint8Array(arrayBuffer)
                
                // Send the recording data to main process using the correct API
                await window.clipforge.saveRecording(uint8Array, ${JSON.stringify(outputPath)})
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop())
                
                // Notify that recording is saved
                window.recordingSaved = true
              } catch (error) {
                console.error('Error saving recording:', error)
                window.recordingSaved = false
              }
            }

            mediaRecorder.start(1000) // Record in 1-second chunks
            
            // Store references for cleanup
            window.recordingService = {
              mediaRecorder,
              stream,
              chunks
            }
            
            return true
          } catch (error) {
            console.error('Screen recording error:', error)
            throw error
          }
        })()
      `)

      this.currentOutputPath = outputPath
      console.log(`[RecordingService] Screen recording started: ${outputPath}`)
      
    } catch (error) {
      console.error('[RecordingService] Screen recording failed:', error)
      throw error
    }
  }

  private async startWebcamRecording(outputPath: string): Promise<void> {
    try {
      console.log(`[RecordingService] Starting webcam recording to: ${outputPath}`)
      
      // Store the output path for later use
      this.currentOutputPath = outputPath
      
      // Start webcam recording in the renderer process
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        await mainWindow.webContents.executeJavaScript(`
          (async () => {
            try {
              // Request webcam access
              const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  frameRate: { ideal: 30 }
                },
                audio: true
              })
              
              console.log('[Recording] Webcam stream obtained:', stream)
              
              // Create MediaRecorder for webcam
              const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") 
                ? "video/webm;codecs=vp8" 
                : "video/webm"
              
              console.log('[Recording] Using mimeType:', mimeType)
              
              const mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps
              })
              
              // Store references for cleanup
              window.recordingService = {
                mediaRecorder: mediaRecorder,
                stream: stream
              }
              
              const chunks = []
              
              mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  chunks.push(event.data)
                }
              }
              
              mediaRecorder.onstop = async () => {
                console.log('[Recording] Webcam recording stopped, saving...')
                
                try {
                  const blob = new Blob(chunks, { type: mimeType })
                  const arrayBuffer = await blob.arrayBuffer()
                  const uint8Array = new Uint8Array(arrayBuffer)
                  
                  // Save the recording
                  const result = await window.clipforge.saveRecording(uint8Array, ${JSON.stringify(outputPath)})
                  
                  if (result.success) {
                    console.log('[Recording] Webcam recording saved successfully')
                    window.recordingSaved = true
                  } else {
                    console.error('[Recording] Failed to save webcam recording')
                    window.recordingSaved = false
                  }
                } catch (error) {
                  console.error('[Recording] Error saving webcam recording:', error)
                  window.recordingSaved = false
                } finally {
                  // Clean up stream
                  if (window.recordingService && window.recordingService.stream) {
                    window.recordingService.stream.getTracks().forEach(track => track.stop())
                  }
                }
              }
              
              // Start recording
              mediaRecorder.start(1000) // Collect data every second
              console.log('[Recording] Webcam recording started')
              
              return true
            } catch (error) {
              console.error('[Recording] Failed to start webcam recording:', error)
              return false
            }
          })()
        `)
      }
      
      console.log('[RecordingService] Webcam recording started successfully')
      
    } catch (error) {
      console.error('[RecordingService] Failed to start webcam recording:', error)
      throw error
    }
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
      
      // Stop the MediaRecorder in the renderer process
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        await mainWindow.webContents.executeJavaScript(`
          (async () => {
            if (window.recordingService && window.recordingService.mediaRecorder) {
              window.recordingService.mediaRecorder.stop()
              
              // Wait for the recording to be saved
              let attempts = 0
              while (window.recordingSaved === undefined && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100))
                attempts++
              }
              
              return window.recordingSaved === true
            }
            return false
          })()
        `)
      }

      // Wait a bit more to ensure file is written to disk
      await new Promise(resolve => setTimeout(resolve, 1000))

      const outputPath = this.currentOutputPath || join(this.RECORDINGS_DIR, `recording_${Date.now()}.webm`)
      this.currentOutputPath = null

      // Calculate actual recording duration
      const actualDuration = this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0
      console.log(`[RecordingService] Actual recording duration: ${actualDuration}s`)
      console.log(`[RecordingService] Recording start time: ${this.recordingStartTime}`)
      console.log(`[RecordingService] Recording stop time: ${Date.now()}`)
      console.log(`[RecordingService] Time difference: ${Date.now() - (this.recordingStartTime || 0)}ms`)

      // Probe the recording for metadata
      let metadata = {
        duration: actualDuration, // Use calculated duration as fallback
        width: 1920,
        height: 1080,
        type: this.recordingType
      }

      try {
        const probeResult = await ffmpegWrapper.probe(outputPath)
        // For WebM files from MediaRecorder, duration is often N/A, so always use actualDuration
        metadata = {
          duration: actualDuration, // Always use actual recording duration for WebM
          width: probeResult.width,
          height: probeResult.height,
          type: this.recordingType
        }
        console.log('[RecordingService] Successfully probed recording:', metadata)
        console.log('[RecordingService] Using actual duration instead of probed duration')
      } catch (error) {
        console.warn('[RecordingService] Failed to probe recording metadata:', error)
        // Use calculated duration as fallback
        metadata = {
          duration: actualDuration,
          width: 1920,
          height: 1080,
          type: this.recordingType
        }
      }

      // Emit completion event
      this.emit('stopped', {
        path: outputPath,
        metadata
      })

      // Set recording state to false AFTER emitting the event
      this.isRecording = false
      this.recordingType = null

      return {
        path: outputPath,
        metadata
      }
    } catch (error) {
      this.isRecording = false
      this.recordingType = null
      this.currentOutputPath = null
      throw error
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording
  }
}

export const recordingService = new RecordingService()


