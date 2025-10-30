import React, { useState, useEffect } from 'react'
import type { Config } from '@shared/types'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [encryptionWarning, setEncryptionWarning] = useState(false)

  // Load config when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadConfig()
      checkEncryptionAvailable()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      const config = await window.clipforge.loadConfig()
      if (config?.openaiApiKey) {
        // Don't show decrypted key - just show placeholder or mask
        setApiKey('')
      } else {
        setApiKey('')
      }
      setTestStatus('idle')
      setTestMessage('')
    } catch (error: any) {
      console.error('[SettingsDialog] Failed to load config:', error)
    }
  }

  const checkEncryptionAvailable = async () => {
    // Check if encryption is available (this would need to be exposed via IPC)
    // For now, we'll assume it's available and show warning if not
    // TODO: Add IPC method to check encryption availability
  }

  const handleTestConnection = async () => {
    if (!apiKey || !apiKey.trim()) {
      setTestStatus('error')
      setTestMessage('Please enter an API key first')
      return
    }

    // Basic validation
    if (!apiKey.startsWith('sk-')) {
      setTestStatus('error')
      setTestMessage('API key should start with "sk-"')
      return
    }

    setTestStatus('testing')
    setTestMessage('Testing connection...')

    try {
      const result = await window.clipforge.testOpenAIConnection(apiKey.trim())
      if (result.success) {
        setTestStatus('success')
        setTestMessage(result.message)
      } else {
        setTestStatus('error')
        setTestMessage(result.message)
      }
    } catch (error: any) {
      setTestStatus('error')
      setTestMessage(`Test failed: ${error.message}`)
    }
  }

  const handleSave = async () => {
    if (!apiKey || !apiKey.trim()) {
      setTestMessage('Please enter an API key')
      return
    }

    setIsSaving(true)
    try {
      await window.clipforge.saveConfig({
        openaiApiKey: apiKey.trim(),
      })
      
      // Show success and close after brief delay
      setTestStatus('success')
      setTestMessage('Settings saved successfully!')
      
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error: any) {
      setTestStatus('error')
      setTestMessage(`Failed to save: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setApiKey('')
    setTestStatus('idle')
    setTestMessage('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md text-white" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-700">
          <div className="flex space-x-4">
            <button className="pb-2 px-2 border-b-2 border-blue-500 text-blue-400 font-medium text-sm">
              AI Services
            </button>
            {/* Future tabs can go here */}
          </div>
        </div>

        {/* AI Services Tab Content */}
        <div className="space-y-4">
          <div>
            <label htmlFor="openai-key" className="block text-sm font-medium text-gray-300 mb-2">
              OpenAI API Key
            </label>
            <input
              id="openai-key"
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                setTestStatus('idle')
                setTestMessage('')
              }}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              disabled={isSaving}
            />
            <p className="text-xs text-gray-400 mt-1">
              Your API key is encrypted and stored locally
            </p>
          </div>

          {/* Encryption Warning */}
          {encryptionWarning && (
            <div className="p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded text-xs text-yellow-200">
              ⚠️ Secure storage not available. Key will be stored in plaintext.
            </div>
          )}

          {/* Test Connection Button */}
          <button
            onClick={handleTestConnection}
            disabled={!apiKey.trim() || isSaving || testStatus === 'testing'}
            className="btn btn-secondary w-full"
          >
            {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>

          {/* Test Status */}
          {testMessage && (
            <div
              className={`p-2 rounded text-xs ${
                testStatus === 'success'
                  ? 'bg-green-900 bg-opacity-50 border border-green-600 text-green-200'
                  : testStatus === 'error'
                  ? 'bg-red-900 bg-opacity-50 border border-red-600 text-red-200'
                  : 'bg-gray-900 bg-opacity-50 border border-gray-700 text-gray-300'
              }`}
            >
              {testMessage}
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-gray-700">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() || isSaving || testStatus === 'testing'}
              className="btn btn-primary flex-1"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

