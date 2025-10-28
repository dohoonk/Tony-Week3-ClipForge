import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

export class FileIngestService {
  private readonly CLIPS_DIR = join(homedir(), '.clipforge', 'clips')

  constructor() {
    this.ensureClipsDir()
  }

  /**
   * Ensure the clips directory exists
   */
  private ensureClipsDir() {
    if (!existsSync(this.CLIPS_DIR)) {
      mkdirSync(this.CLIPS_DIR, { recursive: true })
      console.log(`[FileIngest] Created clips directory: ${this.CLIPS_DIR}`)
    }
  }

  /**
   * Ingest a file by copying it to ~/.clipforge/clips/ with a UUID filename
   * @param sourcePath Original file path
   * @returns New file path in clips directory
   */
  ingestFile(sourcePath: string): string {
    if (!existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`)
    }

    // Get original extension
    const extension = extname(sourcePath)
    
    // Generate UUID filename
    const uuid = randomUUID()
    const newFilename = `${uuid}${extension}`
    const targetPath = join(this.CLIPS_DIR, newFilename)

    // Copy file to clips directory
    copyFileSync(sourcePath, targetPath)
    
    console.log(`[FileIngest] Copied ${basename(sourcePath)} → ${newFilename}`)
    console.log(`[FileIngest] Source: ${sourcePath}`)
    console.log(`[FileIngest] Target: ${targetPath}`)

    return targetPath
  }

  /**
   * Get the clips directory path
   */
  getClipsDir(): string {
    return this.CLIPS_DIR
  }
}

// Singleton instance
export const fileIngestService = new FileIngestService()

