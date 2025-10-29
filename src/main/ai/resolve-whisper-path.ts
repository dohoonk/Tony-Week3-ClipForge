import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/**
 * Resolve Whisper.cpp binary path
 * Follows the same pattern as FFmpeg resolution
 * 
 * Development paths:
 *   - bin/whisper/darwin/whisper
 *   - bin/whisper/win/whisper.exe
 *   - bin/whisper/linux/whisper
 * 
 * Production paths:
 *   - resources/bin/whisper/{platform}/whisper
 * 
 * @returns Absolute path to Whisper binary, or null if not found
 */
export function resolveWhisperBinary(): string | null {
  const isPackaged = app.isPackaged
  const platform = process.platform
  const platformDir = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win' : 'linux'
  const binaryName = platform === 'win32' ? 'whisper.exe' : 'whisper'
  
  // Build possible paths in priority order
  const possiblePaths: string[] = []
  
  if (isPackaged) {
    // Production: bundled binaries
    possiblePaths.push(
      join(process.resourcesPath, 'bin', 'whisper', platformDir, binaryName)
    )
  } else {
    // Development: local binaries
    possiblePaths.push(
      join(process.cwd(), 'bin', 'whisper', platformDir, binaryName)
    )
    // Also try system PATH (unlikely, but possible)
    possiblePaths.push('whisper')
  }
  
  // Test each path
  for (const testPath of possiblePaths) {
    try {
      // For system PATH binaries, just check if command exists (we can't reliably check this)
      if (!testPath.includes('/') && !testPath.includes('\\')) {
        // Skip system PATH check - we'll let spawn fail if it doesn't exist
        continue
      }
      
      if (existsSync(testPath)) {
        console.log(`[Whisper] Found binary at: ${testPath}`)
        return testPath
      }
    } catch (error) {
      // Continue to next path
      continue
    }
  }
  
  console.warn(`[Whisper] Binary not found. Tried paths: ${possiblePaths.join(', ')}`)
  return null
}

/**
 * Resolve Whisper model file path
 * 
 * Development path:
 *   - resources/models/whisper/{modelName}
 * 
 * Production path:
 *   - resources/models/whisper/{modelName}
 * 
 * @param modelName Model filename (e.g., 'ggml-base.en.bin')
 * @returns Absolute path to model file, or null if not found
 */
export function resolveWhisperModel(modelName: string): string | null {
  const isPackaged = app.isPackaged
  
  const possiblePaths: string[] = []
  
  if (isPackaged) {
    // Production: bundled resources
    possiblePaths.push(
      join(process.resourcesPath, 'models', 'whisper', modelName)
    )
  } else {
    // Development: local resources
    possiblePaths.push(
      join(process.cwd(), 'resources', 'models', 'whisper', modelName)
    )
  }
  
  // Test each path
  for (const testPath of possiblePaths) {
    try {
      if (existsSync(testPath)) {
        console.log(`[Whisper] Found model at: ${testPath}`)
        return testPath
      }
    } catch (error) {
      // Continue to next path
      continue
    }
  }
  
  console.warn(`[Whisper] Model not found: ${modelName}. Tried paths: ${possiblePaths.join(', ')}`)
  return null
}

