import { desktopCapturer, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import { ffmpegWrapper } from './ffmpeg-wrapper'

type RecordingOptions = {
  type: 'screen' | 'webcam' | 'pip'
}

export class RecordingService extends EventEmitter {
  public isRecording = false
  private recordingType: 'screen' | 'webcam' | 'pip' | null = null
  private timeoutId: NodeJS.Timeout | null = null
  private readonly MAX_RECORDING_DURATION = 30 * 60 * 1000 // 30 minutes
  private readonly RECORDINGS_DIR = join(homedir(), 'Movies', 'InterviewMate', 'recordings')
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
      console.log('[RecordingService] Recording already in progress, ignoring duplicate start request')
      return // Return instead of throwing to prevent UI errors
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
      } else if (options.type === 'webcam') {
        await this.startWebcamRecording(outputPath)
      } else if (options.type === 'pip') {
        await this.startPiPRecording(outputPath)
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
              // Request webcam access with audio
              const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  frameRate: { ideal: 30 }
                },
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true
                }
              })
              
              console.log('[Recording] Webcam stream obtained:', stream)
              
              // Create MediaRecorder for webcam
              const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") 
                ? "video/webm;codecs=vp8" 
                : "video/webm"
              
              console.log('[Recording] Using mimeType:', mimeType)
              
              const mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 2500000, // 2.5 Mbps
                audioBitsPerSecond: 128000 // 128 kbps
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

  private async startPiPRecording(outputPath: string): Promise<void> {
    try {
      console.log(`[RecordingService] Starting PiP recording to: ${outputPath}`)
      
      // Store the output path for later use
      this.currentOutputPath = outputPath
      
      // Start PiP recording in the renderer process
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        await mainWindow.webContents.executeJavaScript(`
          (async () => {
            try {
              // Get screen sources using desktopCapturer (Electron API)
              const sources = await window.clipforge.getScreenSources()
              
              if (sources.length === 0) {
                throw new Error('No screen sources available')
              }
              
              const sourceId = sources[0].id
              console.log('[Recording] Using screen source:', sourceId)
              
              // Get screen capture stream without audio to avoid crashes
              const screenStream = await navigator.mediaDevices.getUserMedia({
                audio: false, // Disable audio to prevent crashes
                video: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1280,
                    maxWidth: 1920,
                    minHeight: 720,
                    maxHeight: 1080
                  }
                }
              })
              
              // Get webcam stream
              const webcamStream = await navigator.mediaDevices.getUserMedia({
                video: {
                  width: { ideal: 320 },
                  height: { ideal: 240 },
                  frameRate: { ideal: 30 }
                },
                audio: false // Audio comes from screen capture
              })
              
              console.log('[Recording] PiP streams obtained:', { screenStream, webcamStream })
              
              // Create MediaRecorder for screen capture
              const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") 
                ? "video/webm;codecs=vp8" 
                : "video/webm"
              
              console.log('[Recording] Using mimeType:', mimeType)
              
              // Record screen stream (main content)
              const screenRecorder = new MediaRecorder(screenStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 5000000, // 5 Mbps for higher quality
                audioBitsPerSecond: 128000 // 128 kbps for audio
              })
              
              // Record webcam stream separately for overlay (video only)
              const webcamRecorder = new MediaRecorder(webcamStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 1000000, // 1 Mbps for webcam
                audioBitsPerSecond: 0 // No audio for webcam
              })
              
              // Store references for cleanup
              window.recordingService = {
                screenRecorder: screenRecorder,
                webcamRecorder: webcamRecorder,
                screenStream: screenStream,
                webcamStream: webcamStream
              }
              
              const screenChunks = []
              const webcamChunks = []
              
              screenRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  screenChunks.push(event.data)
                }
              }
              
              webcamRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  webcamChunks.push(event.data)
                }
              }
              
              let screenSaved = false
              let webcamSaved = false
              
              screenRecorder.onstop = async () => {
                console.log('[Recording] Screen recording stopped, saving...')
                
                try {
                  const blob = new Blob(screenChunks, { type: mimeType })
                  const arrayBuffer = await blob.arrayBuffer()
                  const uint8Array = new Uint8Array(arrayBuffer)
                  
                  // Save the screen recording
                  const result = await window.clipforge.saveRecording(uint8Array, ${JSON.stringify(outputPath)})
                  
                  if (result.success) {
                    console.log('[Recording] Screen recording saved successfully')
                    screenSaved = true
                  } else {
                    console.error('[Recording] Failed to save screen recording')
                    screenSaved = false
                  }
                } catch (error) {
                  console.error('[Recording] Error saving screen recording:', error)
                  screenSaved = false
                } finally {
                  // Clean up screen stream
                  if (screenStream) {
                    screenStream.getTracks().forEach(track => track.stop())
                    console.log('[Recording] Screen stream tracks stopped')
                  }
                }
              }
              
              webcamRecorder.onstop = async () => {
                console.log('[Recording] Webcam recording stopped, saving...')
                
                try {
                  const blob = new Blob(webcamChunks, { type: mimeType })
                  const arrayBuffer = await blob.arrayBuffer()
                  const uint8Array = new Uint8Array(arrayBuffer)
                  
                  // Save webcam recording with _webcam suffix
                  const webcamPath = ${JSON.stringify(outputPath)}.replace('.webm', '_webcam.webm')
                  const result = await window.clipforge.saveRecording(uint8Array, webcamPath)
                  
                  if (result.success) {
                    console.log('[Recording] Webcam recording saved successfully')
                    webcamSaved = true
                  } else {
                    console.error('[Recording] Failed to save webcam recording')
                    webcamSaved = false
                  }
                } catch (error) {
                  console.error('[Recording] Error saving webcam recording:', error)
                  webcamSaved = false
                } finally {
                  // Clean up webcam stream
                  if (webcamStream) {
                    webcamStream.getTracks().forEach(track => track.stop())
                    console.log('[Recording] Webcam stream tracks stopped')
                  }
                }
              }
              
              // Start both recorders
              screenRecorder.start(1000) // Collect data every second
              webcamRecorder.start(1000)
              console.log('[Recording] PiP recording started (both streams)')
              
              // Store completion check function
              window.checkPiPRecordingComplete = () => {
                return screenSaved && webcamSaved
              }
              
              return true
            } catch (error) {
              console.error('[Recording] Failed to start PiP recording:', error)
              return false
            }
          })()
        `)
      }
      
      console.log('[RecordingService] PiP recording started successfully')
      
    } catch (error) {
      console.error('[RecordingService] Failed to start PiP recording:', error)
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
      
      // Emit stopped event immediately for UI feedback (before FFmpeg processing)
      const outputPath = this.currentOutputPath || join(this.RECORDINGS_DIR, `recording_${Date.now()}.webm`)
      const actualDuration = this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0
      
      // Emit stopped event immediately for all recording types
      this.emit('stopped', {
        path: outputPath,
        metadata: {
          duration: actualDuration,
          width: 1920,
          height: 1080,
          type: this.recordingType
        }
      })
      
      // Stop the MediaRecorder(s) in the renderer process
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        await mainWindow.webContents.executeJavaScript(`
          (async () => {
            if (window.recordingService) {
              // Stop both recorders for PiP, or single recorder for others
              if (window.recordingService.screenRecorder && window.recordingService.webcamRecorder) {
                // PiP recording - stop both recorders
                window.recordingService.screenRecorder.stop()
                window.recordingService.webcamRecorder.stop()
                
                // Wait for both recordings to be saved
                let attempts = 0
                while (attempts < 50) {
                  if (window.checkPiPRecordingComplete && window.checkPiPRecordingComplete()) {
                    break
                  }
                  await new Promise(resolve => setTimeout(resolve, 100))
                  attempts++
                }
                
                return window.checkPiPRecordingComplete ? window.checkPiPRecordingComplete() : false
              } else if (window.recordingService.mediaRecorder) {
                // Single recorder (screen or webcam)
                window.recordingService.mediaRecorder.stop()
                
                // Wait for the recording to be saved
                let attempts = 0
                while (window.recordingSaved === undefined && attempts < 50) {
                  await new Promise(resolve => setTimeout(resolve, 100))
                  attempts++
                }
                
                return window.recordingSaved === true
              }
            }
            return false
          })()
        `)
      }

      // Wait a bit more to ensure files are written to disk
      await new Promise(resolve => setTimeout(resolve, 1000))

      this.currentOutputPath = null
      console.log(`[RecordingService] Actual recording duration: ${actualDuration}s`)
      console.log(`[RecordingService] Recording start time: ${this.recordingStartTime}`)
      console.log(`[RecordingService] Recording stop time: ${Date.now()}`)
      console.log(`[RecordingService] Time difference: ${Date.now() - (this.recordingStartTime || 0)}ms`)

      // For PiP recordings, we need to combine the streams using FFmpeg
      if (this.recordingType === 'pip') {
        const webcamPath = outputPath.replace('.webm', '_webcam.webm')
        const finalPath = outputPath.replace('.webm', '_pip.webm')
        
        console.log('[RecordingService] Checking if PiP files exist...')
        console.log(`[RecordingService] Screen file: ${outputPath}`)
        console.log(`[RecordingService] Webcam file: ${webcamPath}`)
        
        // Check if files exist
        const fs = require('fs')
        const screenExists = fs.existsSync(outputPath)
        const webcamExists = fs.existsSync(webcamPath)
        
        console.log(`[RecordingService] Screen file exists: ${screenExists}`)
        console.log(`[RecordingService] Webcam file exists: ${webcamExists}`)
        
        if (!screenExists || !webcamExists) {
          console.error('[RecordingService] One or both PiP files missing, falling back to screen only')
          const fallbackMetadata = {
            duration: actualDuration,
            width: 1920,
            height: 1080,
            type: 'screen'
          }
          
          this.emit('stopped', {
            path: screenExists ? outputPath : webcamPath,
            metadata: fallbackMetadata
          })
          
          this.isRecording = false
          this.recordingType = null
          
          return {
            path: screenExists ? outputPath : webcamPath,
            metadata: fallbackMetadata
          }
        }
        
        try {
          console.log('[RecordingService] Combining PiP streams with FFmpeg overlay')
          
          // Emit processing event immediately for UI feedback
          this.emit('processing', {
            message: 'Combining screen and webcam streams...',
            progress: 0
          })
          
          await this.combinePiPStreams(outputPath, webcamPath, finalPath)
          
          // Update output path to the final combined file
          const finalOutputPath = finalPath
          
          // Probe the final combined file
          let metadata = {
            duration: actualDuration,
            width: 1920,
            height: 1080,
            type: this.recordingType
          }

          try {
            const probeResult = await ffmpegWrapper.probe(finalOutputPath)
            metadata = {
              duration: actualDuration, // Always use actual recording duration for WebM
              width: probeResult.width,
              height: probeResult.height,
              type: this.recordingType
            }
            console.log('[RecordingService] Successfully probed PiP recording:', metadata)
          } catch (error) {
            console.warn('[RecordingService] Failed to probe PiP recording metadata:', error)
          }

          // Clean up temporary files
          try {
            const fs = require('fs')
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
            if (fs.existsSync(webcamPath)) fs.unlinkSync(webcamPath)
            console.log('[RecordingService] Cleaned up temporary PiP files')
          } catch (error) {
            console.warn('[RecordingService] Failed to clean up temporary files:', error)
          }

          // Emit completion event with final PiP file path
          this.emit('stopped', {
            path: finalOutputPath,
            metadata
          })

          // Set recording state to false AFTER emitting the event
          this.isRecording = false
          this.recordingType = null

          return {
            path: finalOutputPath,
            metadata
          }
        } catch (error) {
          console.error('[RecordingService] Failed to combine PiP streams:', error)
          // Fall back to screen recording only
          const fallbackMetadata = {
            duration: actualDuration,
            width: 1920,
            height: 1080,
            type: 'screen' // Fallback to screen type
          }
          
          this.emit('stopped', {
            path: outputPath,
            metadata: fallbackMetadata
          })

          this.isRecording = false
          this.recordingType = null

          return {
            path: outputPath,
            metadata: fallbackMetadata
          }
        }
      } else {
        // Regular screen or webcam recording
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

        // Emit completion event (already emitted above for immediate UI feedback)
        // this.emit('stopped', {
        //   path: outputPath,
        //   metadata
        // })

        // Set recording state to false AFTER emitting the event
        this.isRecording = false
        this.recordingType = null

        return {
          path: outputPath,
          metadata
        }
      }
    } catch (error) {
      this.isRecording = false
      this.recordingType = null
      this.currentOutputPath = null
      throw error
    }
  }

  private async combinePiPStreams(screenPath: string, webcamPath: string, outputPath: string): Promise<void> {
    try {
      console.log('[RecordingService] Starting FFmpeg PiP overlay process')
      console.log(`[RecordingService] Screen: ${screenPath}`)
      console.log(`[RecordingService] Webcam: ${webcamPath}`)
      console.log(`[RecordingService] Output: ${outputPath}`)

      // Use FFmpeg to overlay webcam on screen recording
      // The overlay filter places webcam in bottom-right corner with some padding
      const ffmpeg = require('fluent-ffmpeg')
      
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(screenPath)
          .input(webcamPath)
          .complexFilter([
            // Scale webcam to 320x240 and position in bottom-right corner
            '[1:v]scale=320:240[webcam_scaled]',
            // Overlay webcam on screen with padding from edges
            '[0:v][webcam_scaled]overlay=W-w-20:H-h-20[output]'
          ])
          .outputOptions([
            '-map', '[output]',
            // No audio mapping - recordings are video-only
            '-c:v', 'libvpx-vp9',
            '-b:v', '5000k',
            '-crf', '30',
            '-preset', 'fast'
          ])
          .output(outputPath)
          .on('start', (commandLine: string) => {
            console.log('[RecordingService] FFmpeg command:', commandLine)
            // Emit processing start event immediately
            this.emit('processing', {
              message: 'Combining screen and webcam streams...',
              progress: 0
            })
          })
          .on('progress', (progress: any) => {
            console.log('[RecordingService] FFmpeg progress:', progress.percent + '%')
            // Emit progress updates for UI feedback
            this.emit('processing', {
              message: 'Combining streams...',
              progress: progress.percent || 0
            })
          })
          .on('end', () => {
            console.log('[RecordingService] FFmpeg PiP overlay completed successfully')
            resolve()
          })
          .on('error', (error: Error, stdout: string, stderr: string) => {
            console.error('[RecordingService] FFmpeg PiP overlay failed:', error)
            console.error('[RecordingService] FFmpeg stdout:', stdout)
            console.error('[RecordingService] FFmpeg stderr:', stderr)
            reject(error)
          })
          .run()
      })
    } catch (error) {
      console.error('[RecordingService] Failed to combine PiP streams:', error)
      throw error
    }
  }
}

export const recordingService = new RecordingService()


