import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { homedir } from 'os'
import { randomUUID, createHash } from 'crypto'

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
   * Calculate SHA-1 hash of file content
   * @param fileData File buffer
   * @returns SHA-1 hash hex string
   */
  private calculateHash(fileData: Buffer): string {
    return createHash('sha1').update(fileData).digest('hex')
  }

  /**
   * Ingest a file by copying it to ~/.clipforge/clips/ with a UUID filename
   * @param sourcePath Original file path
   * @returns Object with new file path and calculated hash
   */
  ingestFile(sourcePath: string): { path: string; hash: string } {
    if (!existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`)
    }

    // Read file content to calculate hash before copying
    const fileData = readFileSync(sourcePath)
    const hash = this.calculateHash(fileData)

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
    console.log(`[FileIngest] Hash: ${hash}`)

    return { path: targetPath, hash }
  }

  /**
   * Save file data (from drag-drop) to clips directory
   * @param fileData File data as Buffer
   * @param originalFileName Original filename with extension
   * @returns Object with new file path and calculated hash
   */
  ingestFileData(fileData: Buffer, originalFileName: string): { path: string; hash: string } {
    // Calculate hash from file data
    const hash = this.calculateHash(fileData)
    
    // Get original extension
    const extension = extname(originalFileName)
    
    // Generate UUID filename
    const uuid = randomUUID()
    const newFilename = `${uuid}${extension}`
    const targetPath = join(this.CLIPS_DIR, newFilename)

    // Write file to clips directory
    const { writeFileSync } = require('fs')
    writeFileSync(targetPath, fileData)
    
    console.log(`[FileIngest] Saved ${originalFileName} → ${newFilename}`)
    console.log(`[FileIngest] Target: ${targetPath}`)
    console.log(`[FileIngest] Hash: ${hash}`)

    return { path: targetPath, hash }
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

