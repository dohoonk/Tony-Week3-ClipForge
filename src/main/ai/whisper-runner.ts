import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { resolveWhisperBinary, resolveWhisperModel } from './resolve-whisper-path'
import type { Transcript } from '../../shared/types'
import ffmpeg from 'fluent-ffmpeg'
import { app } from 'electron'

/**
 * Whisper Runner
 * 
 * Spawns Whisper.cpp process and parses JSON output.
 * Emits progress events during transcription.
 */
export class WhisperRunner extends EventEmitter {
  private process: ChildProcess | null = null
  private modelName: string = 'ggml-base.en.bin'

  constructor() {
    super()
    this.configureFFmpeg()
  }

  /**
   * Configure FFmpeg paths for the packaged app
   */
  private configureFFmpeg(): void {
    const isPackaged = app.isPackaged
    const platform = process.platform
    
    if (platform === 'darwin') {
      // Try multiple locations for FFmpeg binaries
      const possiblePaths = [
        // Bundled binaries (production)
        ...(isPackaged 
          ? [join(process.resourcesPath, 'bin', 'ffmpeg')]
          : []
        ),
        // Development binaries
        join(process.cwd(), 'bin', 'mac', 'ffmpeg'),
        // System binaries (fallback)
        'ffmpeg',
      ]

      for (const testPath of possiblePaths) {
        try {
          if (existsSync(testPath) || !testPath.includes('/')) {
            ffmpeg.setFfmpegPath(testPath)
            ffmpeg.setFfprobePath(testPath.replace('ffmpeg', 'ffprobe'))
            console.log(`[Whisper] Using FFmpeg at: ${testPath}`)
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }

  /**
   * Extract audio from video file for Whisper (16kHz mono WAV)
   * @param videoPath Path to video file
   * @returns Path to extracted audio temp file
   */
  private async extractAudioForWhisper(videoPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempAudioPath = join(tmpdir(), `clipforge-whisper-${randomUUID()}.wav`)
      
      console.log(`[Whisper] Extracting audio to: ${tempAudioPath}`)
      
      ffmpeg(videoPath)
        .audioChannels(1) // Mono
        .audioFrequency(16000) // 16kHz (Whisper recommended)
        .format('wav')
        .on('end', () => {
          console.log(`[Whisper] Audio extraction complete`)
          resolve(tempAudioPath)
        })
        .on('error', (error) => {
          console.error(`[Whisper] Audio extraction failed:`, error)
          reject(new Error(`Failed to extract audio: ${error.message}`))
        })
        .save(tempAudioPath)
    })
  }

  /**
   * Clean up temporary audio file
   */
  private cleanupTempAudio(audioPath: string): void {
    try {
      if (existsSync(audioPath)) {
        unlinkSync(audioPath)
        console.log(`[Whisper] Cleaned up temp audio: ${audioPath}`)
      }
    } catch (error) {
      console.warn(`[Whisper] Failed to clean up temp audio: ${audioPath}`, error)
    }
  }

  /**
   * Transcribe audio/video file to text with word-level timestamps
   * 
   * For video files, extracts audio first (16kHz mono WAV) for optimal Whisper performance.
   * For audio files, uses directly.
   * 
   * @param mediaPath Path to audio/video file
   * @param modelPath Optional model path (defaults to ggml-base.en.bin)
   * @returns Transcript with words array
   */
  async transcribe(mediaPath: string, modelPath?: string): Promise<Transcript> {
    // Resolve binary path
    const binaryPath = resolveWhisperBinary()
    if (!binaryPath) {
      throw new Error('Whisper binary not found. Please ensure binaries are downloaded and placed in bin/whisper/{platform}/')
    }

    // Resolve model path
    const resolvedModelPath = modelPath || resolveWhisperModel(this.modelName)
    if (!resolvedModelPath) {
      throw new Error(`Whisper model not found: ${this.modelName}. Please ensure model is downloaded and placed in resources/models/whisper/`)
    }

    // Verify input file exists
    if (!existsSync(mediaPath)) {
      throw new Error(`Media file not found: ${mediaPath}`)
    }

    // Determine if we need to extract audio
    const isVideo = /\.(mp4|mov|webm|mkv|avi)$/i.test(mediaPath)
    let audioPath = mediaPath
    let tempAudioPath: string | null = null

    try {
      // Extract audio if it's a video file
      if (isVideo) {
        console.log(`[Whisper] Extracting audio from video...`)
        tempAudioPath = await this.extractAudioForWhisper(mediaPath)
        audioPath = tempAudioPath
      }

      console.log(`[Whisper] Starting transcription: ${mediaPath}`)
      console.log(`[Whisper] Using model: ${resolvedModelPath}`)
      console.log(`[Whisper] Using binary: ${binaryPath}`)
      console.log(`[Whisper] Audio path: ${audioPath}`)

      return new Promise<Transcript>(async (resolve, reject) => {
      let stderr = ''
      let lastProgressUpdate = 0

      // Whisper outputs JSON to a file: {audioPath}.json
      const jsonOutputPath = `${audioPath}.json`

      // Spawn Whisper process
      // Flags:
      //   -m: model path
      //   -f: input file path
      //   -ojf: output JSON full format (includes word-level timestamps)
      //   -pp: print progress
      //   -l en: language (English)
      const args = [
        '-m', resolvedModelPath,
        '-f', audioPath,
        '-ojf',  // output JSON full (includes word timestamps)
        '-pp',  // print progress
        '-l', 'en'
      ]

      this.process = spawn(binaryPath, args)

      // Capture stderr (progress output and info)
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8')
        stderr += text
        
        // Parse progress from stderr
        // Whisper.cpp -pp output format: "whisper_print_progress_callback: progress = 100%"
        const progressMatch = text.match(/progress\s*=\s*(\d+(?:\.\d+)?)\s*%/i)
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1])
          if (percent !== lastProgressUpdate) {
            lastProgressUpdate = percent
            this.emit('progress', { percent, message: `Transcribing: ${percent.toFixed(1)}%` })
          }
        }
        
        console.log(`[Whisper] stderr:`, text)
      })

      // Handle process exit
      this.process.on('close', async (code) => {
        this.process = null

        if (code !== 0) {
          const errorMessage = stderr || 'Unknown error'
          console.error(`[Whisper] Process exited with code ${code}`)
          console.error(`[Whisper] stderr:`, stderr)
          // Clean up temp files
          if (tempAudioPath) {
            this.cleanupTempAudio(tempAudioPath)
          }
          // Try to clean up JSON file if it was created
          try {
            if (existsSync(jsonOutputPath)) {
              unlinkSync(jsonOutputPath)
            }
          } catch {}
          reject(new Error(`Whisper transcription failed (exit code ${code}): ${errorMessage}`))
          return
        }

        // Read JSON from file
        try {
          // Wait a bit for file to be written (safety)
          await new Promise(resolve => setTimeout(resolve, 100))
          
          if (!existsSync(jsonOutputPath)) {
            throw new Error(`JSON output file not found: ${jsonOutputPath}`)
          }

          const jsonContent = readFileSync(jsonOutputPath, 'utf-8')
          const whisperOutput = JSON.parse(jsonContent)

          // Transform Whisper.cpp JSON format to our Transcript type
          const transcript = this.parseWhisperOutput(whisperOutput, mediaPath)
          
          console.log(`[Whisper] Transcription complete: ${transcript.words.length} words`)
          
          // Clean up JSON file
          try {
            unlinkSync(jsonOutputPath)
          } catch (err) {
            console.warn(`[Whisper] Failed to clean up JSON file:`, err)
          }
          
          resolve(transcript)
        } catch (parseError: any) {
          console.error(`[Whisper] Failed to parse output:`, parseError)
          console.error(`[Whisper] Expected JSON file:`, jsonOutputPath)
          reject(new Error(`Failed to parse Whisper output: ${parseError.message}`))
        } finally {
          // Clean up temp audio file if we created one
          if (tempAudioPath) {
            this.cleanupTempAudio(tempAudioPath)
          }
        }
      })

      // Handle spawn errors
      this.process.on('error', (error) => {
        this.process = null
        console.error(`[Whisper] Spawn error:`, error)
        // Clean up temp audio file if we created one
        if (tempAudioPath) {
          this.cleanupTempAudio(tempAudioPath)
        }
        reject(new Error(`Failed to start Whisper process: ${error.message}`))
      })
    })
    } catch (extractError) {
      // If audio extraction failed, clean up and rethrow
      if (tempAudioPath) {
        this.cleanupTempAudio(tempAudioPath)
      }
      throw extractError
    }
  }

  /**
   * Parse Whisper.cpp JSON output format to Transcript type
   * 
   * Whisper.cpp JSON format:
   * {
   *   "text": "...",
   *   "segments": [
   *     {
   *       "id": 0,
   *       "seek": 0,
   *       "start": 0.0,
   *       "end": 5.0,
   *       "text": "...",
   *       "words": [
   *         {
   *           "text": "hello",
   *           "start": 0.0,
   *           "end": 0.5,
   *           "probability": 0.95
   *         }
   *       ]
   *     }
   *   ]
   * }
   */
  private parseWhisperOutput(whisperOutput: any, audioPath: string): Transcript {
    const words: Transcript['words'] = []
    let maxEnd = 0

    // Try parsing segments format (with word-level timestamps)
    if (whisperOutput.segments && Array.isArray(whisperOutput.segments)) {
      for (const segment of whisperOutput.segments) {
        if (segment.words && Array.isArray(segment.words)) {
          for (const word of segment.words) {
            words.push({
              text: word.text?.trim() || '',
              startSec: Number(word.start) || 0,
              endSec: Number(word.end) || 0,
              confidence: Number(word.probability) || 0,
            })
            
            if (word.end > maxEnd) {
              maxEnd = word.end
            }
          }
        }
      }
    }

    // If no words from segments, try transcription format (segment-level only)
    // Convert segment timestamps to approximate word-level
    if (words.length === 0 && whisperOutput.transcription && Array.isArray(whisperOutput.transcription)) {
      for (const segment of whisperOutput.transcription) {
        const text = segment.text?.trim() || ''
        if (!text) continue

        // Parse timestamps: "00:00:09,720" -> seconds
        const parseTimestamp = (ts: string): number => {
          const parts = ts.split(':')
          if (parts.length === 3) {
            const hours = parseFloat(parts[0])
            const mins = parseFloat(parts[1])
            const secs = parseFloat(parts[2].replace(',', '.'))
            return hours * 3600 + mins * 60 + secs
          }
          // Fallback to offsets (milliseconds)
          return (segment.offsets?.from || 0) / 1000
        }

        const startSec = segment.timestamps?.from 
          ? parseTimestamp(segment.timestamps.from)
          : (segment.offsets?.from || 0) / 1000
        
        const endSec = segment.timestamps?.to
          ? parseTimestamp(segment.timestamps.to)
          : (segment.offsets?.to || 0) / 1000

        // Split text into words and distribute evenly across segment duration
        const textWords = text.split(/\s+/).filter((w: string) => w.trim().length > 0)
        const duration = endSec - startSec
        const wordDuration = textWords.length > 0 ? duration / textWords.length : duration

        textWords.forEach((word: string, index: number) => {
          const wordStart = startSec + (index * wordDuration)
          const wordEnd = index < textWords.length - 1 
            ? startSec + ((index + 1) * wordDuration)
            : endSec

          words.push({
            text: word.replace(/[.,!?;:]/g, ''), // Remove punctuation for matching
            startSec: wordStart,
            endSec: wordEnd,
            confidence: 0.8, // Default confidence for approximated words
          })

          if (wordEnd > maxEnd) {
            maxEnd = wordEnd
          }
        })
      }
    }

    // If still no words, try fallback to text field
    if (words.length === 0 && whisperOutput.text) {
      const text = whisperOutput.text.trim()
      if (text.length > 0) {
        words.push({
          text,
          startSec: 0,
          endSec: maxEnd || 1,
          confidence: 0.5,
        })
        maxEnd = maxEnd || 1
      }
    }

    return {
      words,
      durationSec: maxEnd,
      audioDurationSec: maxEnd,
      modelVersion: 'ggml-base.en',
    }
  }

  /**
   * Cancel running transcription
   */
  cancel(): void {
    if (this.process) {
      console.log('[Whisper] Cancelling transcription')
      this.process.kill()
      this.process = null
      this.emit('cancelled')
    }
  }

  /**
   * Check if transcription is in progress
   */
  isRunning(): boolean {
    return this.process !== null
  }
}

