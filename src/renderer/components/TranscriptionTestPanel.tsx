import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import type { Transcript } from '@shared/types'

export function TranscriptionTestPanel() {
  const { clips } = useStore()
  const [selectedClipId, setSelectedClipId] = useState<string>('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')

  // Listen to transcription progress events
  useEffect(() => {
    const handleProgress = (data: { percent: number; message: string }) => {
      setProgress(data.percent)
      setProgressMessage(data.message)
      appendOutput(`[Progress] ${data.percent.toFixed(1)}% - ${data.message}`)
    }

    const handleError = (data: { message: string }) => {
      setError(data.message)
      appendOutput(`[Error] ${data.message}`)
      setIsTranscribing(false)
    }

    window.clipforge.onTranscriptionProgress(handleProgress)
    window.clipforge.onTranscriptionError(handleError)

    return () => {
      // Cleanup listeners if needed
    }
  }, [])

  const appendOutput = (message: string) => {
    setOutput(prev => {
      const timestamp = new Date().toLocaleTimeString()
      return `${prev}[${timestamp}] ${message}\n`
    })
  }

  const handleTranscribe = async () => {
    if (!selectedClipId) {
      setError('Please select a clip first')
      return
    }

    const clip = clips[selectedClipId]
    if (!clip) {
      setError('Clip not found')
      return
    }

    setIsTranscribing(true)
    setError(null)
    setProgress(0)
    setProgressMessage('')
    setTranscript(null)
    setOutput('')
    
    appendOutput(`Starting transcription for: ${clip.name}`)
    appendOutput(`Path: ${clip.path}`)
    appendOutput(`Hash: ${clip.hash || 'No hash available'}`)

    try {
      const result = await window.clipforge.transcribeClipByPath(clip.path, clip.hash)
      setTranscript(result)
      appendOutput(`\n✅ Transcription complete!`)
      appendOutput(`Words: ${result.words.length}`)
      appendOutput(`Duration: ${result.durationSec.toFixed(2)}s`)
      appendOutput(`Audio Duration: ${result.audioDurationSec.toFixed(2)}s`)
      appendOutput(`Model: ${result.modelVersion}`)
      appendOutput(`\n--- First 10 Words ---`)
      result.words.slice(0, 10).forEach((word, i) => {
        appendOutput(`${i + 1}. "${word.text}" (${word.startSec.toFixed(2)}s - ${word.endSec.toFixed(2)}s, conf: ${word.confidence.toFixed(2)})`)
      })
      if (result.words.length > 10) {
        appendOutput(`... and ${result.words.length - 10} more words`)
      }
      setProgress(100)
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
      appendOutput(`\n❌ Transcription failed: ${errorMsg}`)
    } finally {
      setIsTranscribing(false)
    }
  }

  const clipList = Object.values(clips)
  const selectedClip = selectedClipId ? clips[selectedClipId] : null

  return (
    <aside className="panel w-64 h-full" style={{ minWidth: '200px', flexShrink: 0 }}>
      <h2 className="text-lg font-semibold mb-4 text-white">🎤 Transcription Test</h2>
      
      <div className="space-y-4">
        {/* Clip Selector */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Select Clip</label>
          <select
            value={selectedClipId}
            onChange={(e) => setSelectedClipId(e.target.value)}
            disabled={isTranscribing}
            className="w-full select"
          >
            <option value="">-- Choose a clip --</option>
            {clipList.map((clip) => (
              <option key={clip.id} value={clip.id}>
                {clip.name} ({Math.floor(clip.duration)}s)
              </option>
            ))}
          </select>
          {selectedClip && (
            <div className="text-xs text-gray-500 mt-1">
              <div>Hash: {selectedClip.hash || 'Not calculated'}</div>
            </div>
          )}
        </div>

        {/* Transcribe Button */}
        <button
          onClick={handleTranscribe}
          disabled={!selectedClipId || isTranscribing}
          className="btn btn-primary w-full"
        >
          {isTranscribing ? '🔄 Transcribing...' : '🎤 Transcribe Clip'}
        </button>

        {/* Progress Display */}
        {isTranscribing && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300">{progressMessage || 'Processing...'}</p>
            <div className="progress-container">
              <div 
                className="progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{progress.toFixed(0)}%</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Transcript Summary */}
        {transcript && (
          <div className="p-2 bg-green-900 bg-opacity-50 border border-green-600 rounded text-xs">
            <div className="text-green-300 font-semibold mb-1">✅ Success!</div>
            <div className="text-green-200">
              <div>Words: {transcript.words.length}</div>
              <div>Duration: {transcript.durationSec.toFixed(2)}s</div>
              <div>Model: {transcript.modelVersion}</div>
            </div>
          </div>
        )}

        {/* Output Console */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Output Log</label>
          <div className="bg-gray-950 border border-gray-700 rounded p-2 text-xs font-mono text-gray-300 overflow-auto" style={{ maxHeight: '300px', minHeight: '200px' }}>
            <pre className="whitespace-pre-wrap break-words" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
              {output || 'Ready. Select a clip and click "Transcribe Clip" to begin.'}
            </pre>
          </div>
          {output && (
            <button
              onClick={() => setOutput('')}
              className="btn btn-secondary btn-sm w-full"
            >
              Clear Log
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

