import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { Transcript } from '../../shared/types'

/**
 * Transcript Cache Service
 * 
 * Caches Whisper transcription results to disk using file hash as key.
 * Cache directory: ~/.clipforge/cache/transcripts/
 * Cache file format: JSON files named by hash (e.g., `abc123def456.json`)
 */
export class TranscriptCache {
  private readonly CACHE_DIR = join(homedir(), '.clipforge', 'cache', 'transcripts')

  constructor() {
    this.ensureCacheDir()
  }

  /**
   * Ensure the cache directory exists
   */
  private ensureCacheDir(): void {
    if (!existsSync(this.CACHE_DIR)) {
      mkdirSync(this.CACHE_DIR, { recursive: true })
      console.log(`[TranscriptCache] Created cache directory: ${this.CACHE_DIR}`)
    }
  }

  /**
   * Get cache file path for a given hash
   */
  private getCacheFilePath(hash: string): string {
    return join(this.CACHE_DIR, `${hash}.json`)
  }

  /**
   * Get cached transcript for a file hash
   * @param hash SHA-1 hash of the file
   * @returns Transcript if cached, null otherwise
   */
  async getCachedTranscript(hash: string): Promise<Transcript | null> {
    try {
      const cachePath = this.getCacheFilePath(hash)
      
      if (!existsSync(cachePath)) {
        return null
      }

      const fileContent = readFileSync(cachePath, 'utf-8')
      const transcript: Transcript = JSON.parse(fileContent)
      
      // Validate transcript structure
      if (!transcript.words || !Array.isArray(transcript.words)) {
        console.warn(`[TranscriptCache] Invalid transcript cache for hash ${hash}, ignoring`)
        return null
      }

      console.log(`[TranscriptCache] Cache hit for hash: ${hash}`)
      return transcript
    } catch (error) {
      console.error(`[TranscriptCache] Failed to read cache for hash ${hash}:`, error)
      return null
    }
  }

  /**
   * Store transcript in cache
   * @param hash SHA-1 hash of the file
   * @param transcript Transcript to cache
   */
  async setCachedTranscript(hash: string, transcript: Transcript): Promise<void> {
    try {
      // Ensure cache directory exists (may have been deleted)
      this.ensureCacheDir()
      
      const cachePath = this.getCacheFilePath(hash)
      const jsonContent = JSON.stringify(transcript, null, 2)
      
      writeFileSync(cachePath, jsonContent, 'utf-8')
      console.log(`[TranscriptCache] Cached transcript for hash: ${hash}`)
    } catch (error) {
      console.error(`[TranscriptCache] Failed to write cache for hash ${hash}:`, error)
      throw error
    }
  }

  /**
   * Invalidate (delete) cached transcript
   * @param hash SHA-1 hash of the file
   */
  async invalidateTranscript(hash: string): Promise<void> {
    try {
      const cachePath = this.getCacheFilePath(hash)
      
      if (existsSync(cachePath)) {
        unlinkSync(cachePath)
        console.log(`[TranscriptCache] Invalidated cache for hash: ${hash}`)
      }
    } catch (error) {
      console.error(`[TranscriptCache] Failed to invalidate cache for hash ${hash}:`, error)
      // Don't throw - this is best-effort cleanup
    }
  }

  /**
   * Get cache directory path (for testing/debugging)
   */
  getCacheDir(): string {
    return this.CACHE_DIR
  }
}

// Singleton instance
export const transcriptCache = new TranscriptCache()

