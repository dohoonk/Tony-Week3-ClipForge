import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import type { ScriptReview } from '../../shared/types'
import { estimateReviewCost } from '../../shared/ai/cost-estimator'

export function ScriptReviewTab({ showPanelWrapper = true }: { showPanelWrapper?: boolean }) {
  const { clips, trackItems } = useStore()
  const [selectedClipId, setSelectedClipId] = useState<string>('')
  const [selectedContext, setSelectedContext] = useState<'casual' | 'interview' | 'social' | 'business'>('casual')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [review, setReview] = useState<ScriptReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null)
  const [estimatedCost, setEstimatedCost] = useState<{ estimatedInputTokens: number; estimatedOutputTokens: number; estimatedCost: number; estimatedCostFormatted: string } | null>(null)
  const [hasApiKey, setHasApiKey] = useState<boolean>(true) // Assume true, check on mount

  // Check for API key on mount
  useEffect(() => {
    checkApiKey()
  }, [])

  // Listen to transcription progress events
  useEffect(() => {
    const handleProgress = (data: { percent: number; message: string }) => {
      setProgress(data)
    }
    const handleError = (data: { message: string }) => {
      setError(data.message)
      setIsTranscribing(false)
      setIsReviewing(false)
    }

    window.clipforge.onTranscriptionProgress(handleProgress)
    window.clipforge.onTranscriptionError(handleError)

    return () => {
      // Cleanup handled by Electron IPC (global listeners)
    }
  }, [])

  const checkApiKey = async () => {
    try {
      const config = await window.clipforge.loadConfig()
      setHasApiKey(!!config?.openaiApiKey)
    } catch (error) {
      setHasApiKey(false)
    }
  }

  const handleGenerateReview = async () => {
    if (!selectedClipId) {
      setError('Please select a clip first')
      return
    }

    const clip = clips[selectedClipId]
    if (!clip) {
      setError('Clip not found')
      return
    }

    // Check API key
    if (!hasApiKey) {
      setError('OpenAI API key required. Please set it in Settings (⚙️).')
      return
    }

    setIsTranscribing(true)
    setIsReviewing(false)
    setError(null)
    setReview(null)
    setProgress({ percent: 0, message: 'Transcribing audio...' })
    setEstimatedCost(null)

    try {
      // Step 1: Transcribe (fresh)
      const transcript = await window.clipforge.transcribeClipFresh(clip.path)
      
      // Step 2: Estimate cost
      const transcriptText = transcript.words.map(w => w.text).join(' ')
      const costEstimate = estimateReviewCost(transcriptText.length)
      setEstimatedCost(costEstimate)

      // Step 3: Review (with cost confirmation - for now, just proceed)
      setIsTranscribing(false)
      setIsReviewing(true)
      setProgress({ percent: 50, message: 'Analyzing script...' })

      const reviewResult = await window.clipforge.reviewTranscript(clip.path, selectedContext)
      setReview(reviewResult)
      setProgress({ percent: 100, message: 'Review complete!' })
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
      
      // Check if it's an API key error
      if (errorMsg.includes('API key') || errorMsg.includes('not found')) {
        setHasApiKey(false)
      }
    } finally {
      setIsTranscribing(false)
      setIsReviewing(false)
    }
  }

  const handleOpenSettings = () => {
    // Trigger settings dialog (we'll need to expose this from App.tsx)
    // For now, just show message
    setError('Click the ⚙️ Settings button in the header to add your OpenAI API key')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast here
      console.log('Copied to clipboard:', text)
    })
  }

  const clipOptions = Object.values(clips).filter(clip => {
    // Only show clips that are on the timeline or have audio
    return true // Show all clips for now
  })

  // Get clips on timeline for better UX
  const timelineClipIds = new Set(Object.values(trackItems).map(item => item.clipId))
  const clipsOnTimeline = clipOptions.filter(clip => timelineClipIds.has(clip.id))
  const clipsNotOnTimeline = clipOptions.filter(clip => !timelineClipIds.has(clip.id))

  return (
    <div className="space-y-4">
      {/* Clip Selector */}
      <div>
        <label className="text-xs text-gray-400 block mb-2">Select Clip</label>
        <select
          value={selectedClipId}
          onChange={(e) => {
            setSelectedClipId(e.target.value)
            setReview(null)
            setError(null)
          }}
          disabled={isTranscribing || isReviewing}
          className="w-full select"
        >
          <option value="">-- Choose a clip --</option>
          {clipsOnTimeline.length > 0 && (
            <optgroup label="On Timeline">
              {clipsOnTimeline.map((clip) => (
                <option key={clip.id} value={clip.id}>
                  {clip.name} ({clip.duration.toFixed(1)}s)
                </option>
              ))}
            </optgroup>
          )}
          {clipsNotOnTimeline.length > 0 && (
            <optgroup label="Media Library">
              {clipsNotOnTimeline.map((clip) => (
                <option key={clip.id} value={clip.id}>
                  {clip.name} ({clip.duration.toFixed(1)}s)
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Context Selector */}
      <div>
        <label className="text-xs text-gray-400 block mb-2">Context</label>
        <select
          value={selectedContext}
          onChange={(e) => setSelectedContext(e.target.value as typeof selectedContext)}
          disabled={isTranscribing || isReviewing}
          className="w-full select"
        >
          <option value="casual">Casual</option>
          <option value="interview">Interview</option>
          <option value="social">Social Media</option>
          <option value="business">Business</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {selectedContext === 'casual' && 'Conversational, friendly'}
          {selectedContext === 'interview' && 'Concise and structured'}
          {selectedContext === 'social' && 'High energy, catchy'}
          {selectedContext === 'business' && 'Professional, formal'}
        </p>
      </div>

      {/* Cost Estimate (shown after transcription) */}
      {estimatedCost && !review && (
        <div className="p-2 bg-blue-900 bg-opacity-50 border border-blue-600 rounded text-xs">
          <div className="text-blue-300 font-semibold mb-1">💰 Estimated Cost</div>
          <div className="text-blue-200">
            <div>Cost: {estimatedCost.estimatedCostFormatted}</div>
            <div className="text-gray-400">
              ~{estimatedCost.estimatedInputTokens + estimatedCost.estimatedOutputTokens} tokens total
            </div>
          </div>
        </div>
      )}

      {/* Generate Review Button */}
      <button
        onClick={handleGenerateReview}
        disabled={!selectedClipId || isTranscribing || isReviewing || !hasApiKey}
        className="btn btn-primary w-full"
      >
        {isTranscribing ? '🔄 Transcribing...' : isReviewing ? '📝 Analyzing...' : '🎤 Generate Review'}
      </button>

      {/* Missing API Key State */}
      {!hasApiKey && (
        <div className="p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded text-xs">
          <div className="text-yellow-300 font-semibold mb-2">⚠️ OpenAI API Key Required</div>
          <p className="text-yellow-200 mb-2">
            Please add your OpenAI API key in Settings to use script review.
          </p>
          <button
            onClick={handleOpenSettings}
            className="btn btn-secondary w-full text-xs"
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Progress Display */}
      {(isTranscribing || isReviewing) && progress && (
        <div className="space-y-2">
          <p className="text-xs text-gray-300">{progress.message}</p>
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{progress.percent.toFixed(0)}%</p>
          {isReviewing && (
            <p className="text-xs text-gray-500">This may take 10-30 seconds</p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Review Display */}
      {review && (
        <div className="space-y-4 max-h-96 overflow-auto">
          {/* Summary */}
          <div className="p-3 bg-blue-900 bg-opacity-30 border border-blue-700 rounded">
            <div className="text-blue-300 font-semibold mb-2 text-xs">📄 Summary</div>
            <p className="text-sm text-gray-200">{review.summary}</p>
          </div>

          {/* Clarity Notes */}
          {review.clarityNotes.length > 0 && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded">
              <div className="text-green-400 font-semibold mb-2 text-xs">✨ Clarity</div>
              <ul className="space-y-1 text-xs text-gray-300">
                {review.clarityNotes.map((note, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-gray-500 mr-2">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pacing Notes */}
          {review.pacingNotes.length > 0 && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded">
              <div className="text-purple-400 font-semibold mb-2 text-xs">⏱️ Pacing & Delivery</div>
              <ul className="space-y-1 text-xs text-gray-300">
                {review.pacingNotes.map((note, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-gray-500 mr-2">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filler Notes */}
          {review.fillerNotes.length > 0 && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded">
              <div className="text-yellow-400 font-semibold mb-2 text-xs">🗣️ Filler Usage</div>
              <ul className="space-y-1 text-xs text-gray-300">
                {review.fillerNotes.map((note, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-gray-500 mr-2">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {review.suggestions.length > 0 && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded">
              <div className="text-orange-400 font-semibold mb-2 text-xs">💡 Improvement Suggestions</div>
              <div className="space-y-3">
                {review.suggestions.map((suggestion, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-xs text-gray-400 italic">
                      Original:
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-900 p-2 rounded">
                      "{suggestion.original}"
                    </div>
                    <div className="text-xs text-green-400 mt-1">
                      Improved:
                    </div>
                    <div className="text-xs text-green-300 bg-gray-900 p-2 rounded flex items-center justify-between">
                      <span>"{suggestion.improved}"</span>
                      <button
                        onClick={() => copyToClipboard(suggestion.improved)}
                        className="btn btn-sm text-xs ml-2"
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!review && !isTranscribing && !isReviewing && !error && (
        <div className="text-xs text-gray-500 text-center p-4">
          {hasApiKey 
            ? 'Select a clip and generate a review'
            : 'Add your OpenAI API key in Settings to start'}
        </div>
      )}
    </div>
  )
}

