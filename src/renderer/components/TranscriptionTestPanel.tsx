import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import type { Transcript, FillerSpan } from '@shared/types'

export function TranscriptionTestPanel() {
  const { clips } = useStore()
  const [selectedClipId, setSelectedClipId] = useState<string>('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [fillers, setFillers] = useState<FillerSpan[]>([])
  const [isDetectingFillers, setIsDetectingFillers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Listen to transcription progress events
  useEffect(() => {
    const handleProgress = (data: { percent: number; message: string }) => {
      setProgress(data.percent)
      setProgressMessage(data.message)
    }

    const handleError = (data: { message: string }) => {
      setError(data.message)
      setIsTranscribing(false)
    }

    window.clipforge.onTranscriptionProgress(handleProgress)
    window.clipforge.onTranscriptionError(handleError)

    return () => {
      // Cleanup listeners if needed
    }
  }, [])

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

    try {
      const result = await window.clipforge.transcribeClipByPath(clip.path, clip.hash)
      setTranscript(result)
      setProgress(100)
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleDetectFillers = async () => {
    if (!selectedClipId) {
      setError('Please select a clip first')
      return
    }

    const clip = clips[selectedClipId]
    if (!clip) {
      setError('Clip not found')
      return
    }

    setIsDetectingFillers(true)
    setError(null)
    setFillers([])

    try {
      const detectedFillers = await window.clipforge.detectFillers(
        clip.path,
        clip.id,
        clip.hash,
        { confMin: undefined }
      )
      setFillers(detectedFillers)
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    } finally {
      setIsDetectingFillers(false)
    }
  }

  const clipList = Object.values(clips)
  const selectedClip = selectedClipId ? clips[selectedClipId] : null

  const content = (
    <>
      <h2 className="text-lg font-semibold mb-4 text-white">🎤 Transcription Test</h2>
      
      <div className="space-y-4">
        {/* Clip Selector */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Select Clip</label>
          <select
            value={selectedClipId}
            onChange={(e) => {
              setSelectedClipId(e.target.value)
              setTranscript(null)
              setFillers([])
              setError(null)
            }}
            disabled={isTranscribing || isDetectingFillers}
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
          disabled={!selectedClipId || isTranscribing || isDetectingFillers}
          className="btn btn-primary w-full"
        >
          {isTranscribing ? '🔄 Transcribing...' : '🎤 Transcribe Clip'}
        </button>

        {/* Detect Fillers Button */}
        <button
          onClick={handleDetectFillers}
          disabled={!selectedClipId || isDetectingFillers || isTranscribing}
          className="btn btn-warning w-full"
        >
          {isDetectingFillers ? '🔍 Detecting Fillers...' : '🔍 Detect Fillers'}
        </button>

        {/* Progress Display */}
        {(isTranscribing || isDetectingFillers) && (
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
          <div className="p-3 bg-green-900 bg-opacity-50 border border-green-600 rounded text-xs">
            <div className="text-green-300 font-semibold mb-2">✅ Transcription Complete</div>
            <div className="text-green-200 space-y-1">
              <div><strong>Words:</strong> {transcript.words.length}</div>
              <div><strong>Duration:</strong> {transcript.durationSec.toFixed(2)}s</div>
              <div><strong>Model:</strong> {transcript.modelVersion}</div>
            </div>
          </div>
        )}

        {/* Fillers Summary */}
        {fillers.length > 0 && (
          <div className="p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded text-xs">
            <div className="text-yellow-300 font-semibold mb-2">🔍 Fillers Detected</div>
            <div className="text-yellow-200 space-y-1">
              <div><strong>Count:</strong> {fillers.length}</div>
              <div className="mt-2 max-h-32 overflow-auto">
                {fillers.slice(0, 5).map((f, i) => (
                  <div key={i} className="mt-1 text-xs">
                    "{f.word}" @ {f.startSec.toFixed(1)}s
                  </div>
                ))}
                {fillers.length > 5 && (
                  <div className="text-yellow-400 italic mt-1">... and {fillers.length - 5} more</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full Transcript Display */}
        {transcript && (
          <div className="p-3 bg-gray-800 border border-gray-700 rounded text-xs">
            <div className="text-blue-300 font-semibold mb-2">📄 Full Transcript</div>
            <div className="text-gray-200 max-h-[600px] overflow-y-auto">
              <div className="space-y-1">
                {transcript.words.map((word, i) => (
                  <span key={i} className="mr-1">
                    {word.text}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {transcript.words.length} words • {transcript.durationSec.toFixed(1)}s duration
            </div>
          </div>
        )}

        {/* Empty State */}
        {!transcript && !fillers.length && !isTranscribing && !isDetectingFillers && !error && (
          <div className="text-xs text-gray-500 text-center p-4 border-t border-gray-700 pt-4">
            Select a clip and click "Transcribe Clip" or "Detect Fillers" to begin.
          </div>
        )}
      </div>
    </>
  )

  return (
    <aside className="panel w-64 h-full" style={{ minWidth: '200px', flexShrink: 0 }}>
      {content}
    </aside>
  )
}

// Export content-only version for unified panel
export function TranscriptionTestPanelContent() {
  const { clips } = useStore()
  const [selectedClipId, setSelectedClipId] = useState<string>('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [fillers, setFillers] = useState<FillerSpan[]>([])
  const [isDetectingFillers, setIsDetectingFillers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleProgress = (data: { percent: number; message: string }) => {
      setProgress(data.percent)
      setProgressMessage(data.message)
    }

    const handleError = (data: { message: string }) => {
      setError(data.message)
      setIsTranscribing(false)
    }

    window.clipforge.onTranscriptionProgress(handleProgress)
    window.clipforge.onTranscriptionError(handleError)

    return () => {
      // Cleanup listeners if needed
    }
  }, [])

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

    try {
      const result = await window.clipforge.transcribeClipByPath(clip.path, clip.hash)
      setTranscript(result)
      setProgress(100)
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleDetectFillers = async () => {
    if (!selectedClipId) {
      setError('Please select a clip first')
      return
    }

    const clip = clips[selectedClipId]
    if (!clip) {
      setError('Clip not found')
      return
    }

    setIsDetectingFillers(true)
    setError(null)
    setFillers([])

    try {
      const detectedFillers = await window.clipforge.detectFillers(
        clip.path,
        clip.id,
        clip.hash,
        { confMin: undefined }
      )
      setFillers(detectedFillers)
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    } finally {
      setIsDetectingFillers(false)
    }
  }

  const clipList = Object.values(clips)
  const selectedClip = selectedClipId ? clips[selectedClipId] : null

         return (
           <>
             <h2 className="text-lg font-semibold mb-4 text-white">🎤 Transcription</h2>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Select Clip</label>
          <select
            value={selectedClipId}
            onChange={(e) => {
              setSelectedClipId(e.target.value)
              setTranscript(null)
              setFillers([])
              setError(null)
            }}
            disabled={isTranscribing || isDetectingFillers}
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

        <button
          onClick={handleTranscribe}
          disabled={!selectedClipId || isTranscribing || isDetectingFillers}
          className="btn btn-primary w-full"
        >
          {isTranscribing ? '🔄 Transcribing...' : '🎤 Transcribe Clip'}
        </button>

        <button
          onClick={handleDetectFillers}
          disabled={!selectedClipId || isDetectingFillers || isTranscribing}
          className="btn btn-warning w-full"
        >
          {isDetectingFillers ? '🔍 Detecting Fillers...' : '🔍 Detect Fillers'}
        </button>

        {(isTranscribing || isDetectingFillers) && (
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

        {error && (
          <div className="p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        {transcript && (
          <div className="p-3 bg-green-900 bg-opacity-50 border border-green-600 rounded text-xs">
            <div className="text-green-300 font-semibold mb-2">✅ Transcription Complete</div>
            <div className="text-green-200 space-y-1">
              <div><strong>Words:</strong> {transcript.words.length}</div>
              <div><strong>Duration:</strong> {transcript.durationSec.toFixed(2)}s</div>
              <div><strong>Model:</strong> {transcript.modelVersion}</div>
            </div>
          </div>
        )}

        {fillers.length > 0 && (
          <div className="p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded text-xs">
            <div className="text-yellow-300 font-semibold mb-2">🔍 Fillers Detected</div>
            <div className="text-yellow-200 space-y-1">
              <div><strong>Count:</strong> {fillers.length}</div>
              <div className="mt-2 max-h-32 overflow-auto">
                {fillers.slice(0, 5).map((f, i) => (
                  <div key={i} className="mt-1 text-xs">
                    "{f.word}" @ {f.startSec.toFixed(1)}s
                  </div>
                ))}
                {fillers.length > 5 && (
                  <div className="text-yellow-400 italic mt-1">... and {fillers.length - 5} more</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full Transcript Display */}
        {transcript && (
          <div className="p-3 bg-gray-800 border border-gray-700 rounded text-xs">
            <div className="text-blue-300 font-semibold mb-2">📄 Full Transcript</div>
            <div className="text-gray-200 max-h-[600px] overflow-y-auto">
              <div className="space-y-1">
                {transcript.words.map((word, i) => (
                  <span key={i} className="mr-1">
                    {word.text}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {transcript.words.length} words • {transcript.durationSec.toFixed(1)}s duration
            </div>
          </div>
        )}

        {!transcript && !fillers.length && !isTranscribing && !isDetectingFillers && !error && (
          <div className="text-xs text-gray-500 text-center p-4 border-t border-gray-700 pt-4">
            Select a clip and click "Transcribe Clip" or "Detect Fillers" to begin.
          </div>
        )}
      </div>
    </>
  )
}
