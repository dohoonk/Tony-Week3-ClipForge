import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

/**
 * Configuration type
 */
export type Config = {
  openaiApiKey?: string
  // Future: other settings can go here
}

/**
 * Config Service
 * 
 * Manages application configuration with encrypted API key storage.
 * Uses Electron safeStorage for secure key encryption.
 */
class ConfigService {
  private readonly CONFIG_DIR = join(homedir(), '.clipforge')
  private readonly CONFIG_FILE = join(this.CONFIG_DIR, 'config.json')

  constructor() {
    this.ensureConfigDir()
  }

  /**
   * Ensure config directory exists
   */
  private ensureConfigDir(): void {
    if (!existsSync(this.CONFIG_DIR)) {
      try {
        mkdirSync(this.CONFIG_DIR, { recursive: true })
        console.log(`[ConfigService] Created config directory: ${this.CONFIG_DIR}`)
      } catch (error) {
        console.error(`[ConfigService] Failed to create config directory:`, error)
      }
    }
  }

  /**
   * Get OpenAI API key
   * Checks environment variable first, then encrypted config file
   * @returns API key or null if not found
   */
  async getOpenAIKey(): Promise<string | null> {
    // Check environment variable first (for development/CI)
    const envKey = process.env.OPENAI_API_KEY
    if (envKey) {
      console.log('[ConfigService] Using OpenAI key from environment variable')
      return envKey
    }

    // Load from config file
    const config = await this.loadConfig()
    if (!config?.openaiApiKey) {
      return null
    }

    // Decrypt if encrypted
    try {
      if (this.isEncryptionAvailable()) {
        // Assume stored value is encrypted (in format: "encrypted:base64string")
        if (config.openaiApiKey.startsWith('encrypted:')) {
          const encrypted = config.openaiApiKey.substring('encrypted:'.length)
          const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
          return decrypted
        }
      }
      
      // If not encrypted or encryption unavailable, return as-is
      return config.openaiApiKey
    } catch (error) {
      console.error('[ConfigService] Failed to decrypt API key:', error)
      return null
    }
  }

  /**
   * Check if encryption is available
   */
  isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch (error) {
      console.warn('[ConfigService] Encryption check failed:', error)
      return false
    }
  }

  /**
   * Load config from file
   */
  async loadConfig(): Promise<Config | null> {
    if (!existsSync(this.CONFIG_FILE)) {
      console.log('[ConfigService] Config file not found, returning null')
      return null
    }

    try {
      const content = readFileSync(this.CONFIG_FILE, 'utf-8')
      const config: Config = JSON.parse(content)
      console.log('[ConfigService] Config loaded successfully')
      return config
    } catch (error) {
      console.error('[ConfigService] Failed to load config:', error)
      // If JSON is corrupted, reset config
      if (error instanceof SyntaxError) {
        console.warn('[ConfigService] Config file corrupted, resetting...')
        return null
      }
      throw error
    }
  }

  /**
   * Save config to file
   * Encrypts API key if encryption is available
   */
  async saveConfig(config: Config): Promise<void> {
    this.ensureConfigDir()

    try {
      const configToSave: Config = { ...config }

      // Encrypt API key if provided and encryption is available
      if (configToSave.openaiApiKey && this.isEncryptionAvailable()) {
        try {
          const encrypted = safeStorage.encryptString(configToSave.openaiApiKey)
          // Store as base64 for JSON compatibility
          configToSave.openaiApiKey = `encrypted:${encrypted.toString('base64')}`
          console.log('[ConfigService] API key encrypted and saved')
        } catch (encryptError) {
          console.error('[ConfigService] Encryption failed, saving as plaintext:', encryptError)
          // Save as plaintext if encryption fails (fallback)
        }
      } else if (configToSave.openaiApiKey && !this.isEncryptionAvailable()) {
        console.warn('[ConfigService] Encryption not available, saving API key as plaintext')
        // Still save, but warn user
      }

      writeFileSync(this.CONFIG_FILE, JSON.stringify(configToSave, null, 2), 'utf-8')
      console.log('[ConfigService] Config saved successfully')
    } catch (error) {
      console.error('[ConfigService] Failed to save config:', error)
      throw new Error(`Failed to save config: ${error}`)
    }
  }

  /**
   * Test OpenAI API key by making a minimal request
   */
  async testOpenAIKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        return {
          success: true,
          message: 'API key is valid ✅',
        }
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid API key ❌',
        }
      } else {
        return {
          success: false,
          message: `API error: ${response.status} ${response.statusText}`,
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      }
    }
  }
}

export const configService = new ConfigService()

