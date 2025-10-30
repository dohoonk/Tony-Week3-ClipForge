import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { applyCutPlanToStore } from '../ai/apply-cut-plan'
import { generateCutPlan } from '../../shared/ai/generate-cut-plan'
import type { FillerSpan, CutPlan } from '../../shared/types'

export function AIAssistantPanel() {
  const { trackItems, clips, undoLastAICuts, lastAITrackItemsSnapshot } = useStore()
  const [activeTab, setActiveTab] = useState<'fillers' | 'review'>('fillers')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [fillers, setFillers] = useState<FillerSpan[]>([])
  const [cutPlan, setCutPlan] = useState<CutPlan[]>([])
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null)

  // Listen to transcription progress events
  useEffect(() => {
    const handleProgress = (data: { percent: number; message: string }) => {
      setProgress(data)
    }
    const handleError = (data: { message: string }) => {
      setError(data.message)
      setIsAnalyzing(false)
    }

    window.clipforge.onTranscriptionProgress(handleProgress)
    window.clipforge.onTranscriptionError(handleError)

    return () => {
      // Cleanup handled by Electron IPC (global listeners)
    }
  }, [])

  const handleAnalyze = async () => {
    // Get all track items that are on the timeline
    const items = Object.values(trackItems)
    if (items.length === 0) {
      setError('No clips on timeline to analyze')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setFillers([])
    setCutPlan([])
    setProgress({ percent: 0, message: 'Starting analysis...' })

    try {
      // Group items by clip ID (multiple items can reference same clip)
      const clipIdToItems = new Map<string, typeof items>()
      for (const item of items) {
        if (!clipIdToItems.has(item.clipId)) {
          clipIdToItems.set(item.clipId, [])
        }
        clipIdToItems.get(item.clipId)!.push(item)
      }

      const allFillers: FillerSpan[] = []

      // Analyze each unique clip
      let processedClips = 0
      const totalClips = clipIdToItems.size

      for (const [clipId, clipItems] of clipIdToItems.entries()) {
        const clip = clips[clipId]
        if (!clip) {
          console.warn(`[AIAssistant] Clip ${clipId} not found`)
          continue
        }

        setProgress({
          percent: (processedClips / totalClips) * 100,
          message: `Analyzing: ${clip.name}...`,
        })

        try {
          // Detect fillers in this clip
          const detectedFillers = await window.clipforge.detectFillers(
            clip.path,
            clip.id,
            clip.hash,
            { confMin: confidenceThreshold }
          )

          allFillers.push(...detectedFillers)
        } catch (err: any) {
          console.error(`[AIAssistant] Failed to detect fillers in ${clip.name}:`, err)
          setError(`Failed to analyze ${clip.name}: ${err.message}`)
        }

        processedClips++
      }

      setFillers(allFillers)

      // Generate cut plan
      const plan = generateCutPlan(items, allFillers, {
        rippleGapMs: useStore.getState().ui.snapInterval * 1000, // Use snap interval for ripple
      })

      setCutPlan(plan)
      setProgress({ percent: 100, message: `Found ${allFillers.length} fillers, ${plan.length} items to cut` })
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
      setProgress(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApply = () => {
    if (cutPlan.length === 0) {
      setError('No cut plan to apply')
      return
    }

    try {
      applyCutPlanToStore(cutPlan)
      setError(null)
      // Clear state after successful apply
      setFillers([])
      setCutPlan([])
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    }
  }

  const handleUndo = () => {
    try {
      undoLastAICuts()
      setError(null)
      setFillers([])
      setCutPlan([])
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    }
  }

  const hasUndo = lastAITrackItemsSnapshot !== null
  const hasFillers = fillers.length > 0
  const hasCutPlan = cutPlan.length > 0
  const itemsCount = Object.values(trackItems).length

  const content = (
    <>
      <h2 className="text-lg font-semibold mb-4 text-white">🤖 AI Assistant</h2>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        <button
          onClick={() => setActiveTab('fillers')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            activeTab === 'fillers'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🔍 Fillers
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            activeTab === 'review'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          📝 Script Review
        </button>
      </div>

      <div className="space-y-4">
        {/* Fillers Tab Content */}
        {activeTab === 'fillers' && (
          <>
            {/* Confidence Threshold */}
            <div>
          <label className="text-xs text-gray-400 block mb-2">
            Confidence Threshold: {confidenceThreshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            disabled={isAnalyzing || hasFillers}
            className="w-full"
          />
          <div className="text-xs text-gray-500 mt-1">
            {confidenceThreshold < 0.5 ? 'Lower (more aggressive)' : 'Higher (more conservative)'}
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || itemsCount === 0}
          className="btn btn-primary w-full"
        >
          {isAnalyzing ? '🔄 Analyzing...' : '🎤 Analyze Speech'}
        </button>

        {/* Progress Display */}
        {isAnalyzing && progress && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300">{progress.message}</p>
            <div className="progress-container">
              <div
                className="progress-bar"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{progress.percent.toFixed(0)}%</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Results Summary */}
        {hasFillers && !isAnalyzing && (
          <div className="p-2 bg-blue-900 bg-opacity-50 border border-blue-600 rounded text-xs">
            <div className="text-blue-300 font-semibold mb-1">📊 Analysis Complete</div>
            <div className="text-blue-200 space-y-1">
              <div>Fillers Found: <span className="text-white font-semibold">{fillers.length}</span></div>
              <div>Items to Cut: <span className="text-white font-semibold">{cutPlan.length}</span></div>
            </div>
          </div>
        )}

        {/* Filler List Preview */}
        {hasFillers && fillers.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded p-2 text-xs max-h-48 overflow-auto">
            <div className="text-gray-400 font-semibold mb-2">Detected Fillers:</div>
            <div className="space-y-1">
              {fillers.slice(0, 10).map((filler, i) => (
                <div key={i} className="text-gray-300">
                  "{filler.word}" @ {filler.startSec.toFixed(1)}s
                  <span className="text-gray-500 ml-1">({(filler.confidence * 100).toFixed(0)}%)</span>
                </div>
              ))}
              {fillers.length > 10 && (
                <div className="text-gray-500 italic">... and {fillers.length - 10} more</div>
              )}
            </div>
          </div>
        )}

        {/* Apply Button */}
        {hasCutPlan && (
          <button
            onClick={handleApply}
            disabled={cutPlan.length === 0}
            className="btn btn-success w-full"
          >
            ✂️ Apply Cuts ({cutPlan.length} items)
          </button>
        )}

        {/* Undo Button */}
        {hasUndo && (
          <button
            onClick={handleUndo}
            className="btn btn-secondary w-full"
          >
            ↩️ Undo Last Cuts
          </button>
        )}

        {/* Empty State */}
        {!hasFillers && !isAnalyzing && itemsCount === 0 && (
          <div className="text-xs text-gray-500 text-center p-4">
            Add clips to the timeline to analyze speech
          </div>
        )}
          </>
        )}

        {/* Script Review Tab Content */}
        {activeTab === 'review' && <ScriptReviewTab />}
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
export function AIAssistantPanelContent() {
  // Reuse all the logic from AIAssistantPanel
  const { trackItems, clips, undoLastAICuts, lastAITrackItemsSnapshot } = useStore()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [fillers, setFillers] = useState<FillerSpan[]>([])
  const [cutPlan, setCutPlan] = useState<CutPlan[]>([])
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null)

  // Listen to transcription progress events
  useEffect(() => {
    const handleProgress = (data: { percent: number; message: string }) => {
      setProgress(data)
    }
    const handleError = (data: { message: string }) => {
      setError(data.message)
      setIsAnalyzing(false)
    }

    window.clipforge.onTranscriptionProgress(handleProgress)
    window.clipforge.onTranscriptionError(handleError)

    return () => {
      // Cleanup handled by Electron IPC (global listeners)
    }
  }, [])

  const handleAnalyze = async () => {
    const items = Object.values(trackItems)
    if (items.length === 0) {
      setError('No clips on timeline to analyze')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setFillers([])
    setCutPlan([])
    setProgress({ percent: 0, message: 'Starting analysis...' })

    try {
      const clipIdToItems = new Map<string, typeof items>()
      for (const item of items) {
        if (!clipIdToItems.has(item.clipId)) {
          clipIdToItems.set(item.clipId, [])
        }
        clipIdToItems.get(item.clipId)!.push(item)
      }

      const allFillers: FillerSpan[] = []
      let processedClips = 0
      const totalClips = clipIdToItems.size

      for (const [clipId, clipItems] of clipIdToItems.entries()) {
        const clip = clips[clipId]
        if (!clip) {
          console.warn(`[AIAssistant] Clip ${clipId} not found`)
          continue
        }

        setProgress({
          percent: (processedClips / totalClips) * 100,
          message: `Analyzing: ${clip.name}...`,
        })

        try {
          const detectedFillers = await window.clipforge.detectFillers(
            clip.path,
            clip.id,
            clip.hash,
            { confMin: confidenceThreshold }
          )

          allFillers.push(...detectedFillers)
        } catch (err: any) {
          console.error(`[AIAssistant] Failed to detect fillers in ${clip.name}:`, err)
          setError(`Failed to analyze ${clip.name}: ${err.message}`)
        }

        processedClips++
      }

      setFillers(allFillers)

      const plan = generateCutPlan(items, allFillers, {
        rippleGapMs: useStore.getState().ui.snapInterval * 1000,
      })

      setCutPlan(plan)
      setProgress({ percent: 100, message: `Found ${allFillers.length} fillers, ${plan.length} items to cut` })
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
      setProgress(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApply = () => {
    if (cutPlan.length === 0) {
      setError('No cut plan to apply')
      return
    }

    try {
      applyCutPlanToStore(cutPlan)
      setError(null)
      setFillers([])
      setCutPlan([])
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    }
  }

  const handleUndo = () => {
    try {
      undoLastAICuts()
      setError(null)
      setFillers([])
      setCutPlan([])
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      setError(errorMsg)
    }
  }

  const hasUndo = lastAITrackItemsSnapshot !== null
  const hasFillers = fillers.length > 0
  const hasCutPlan = cutPlan.length > 0
  const itemsCount = Object.values(trackItems).length

  return (
    <>
      <h2 className="text-lg font-semibold mb-4 text-white">🤖 AI Assistant</h2>

      <div className="space-y-4">
        <>
            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Confidence Threshold: {confidenceThreshold.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                disabled={isAnalyzing || hasFillers}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                {confidenceThreshold < 0.5 ? 'Lower (more aggressive)' : 'Higher (more conservative)'}
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || itemsCount === 0}
              className="btn btn-primary w-full"
            >
              {isAnalyzing ? '🔄 Analyzing...' : '🎤 Analyze Speech'}
            </button>

            {isAnalyzing && progress && (
              <div className="space-y-2">
                <p className="text-xs text-gray-300">{progress.message}</p>
                <div className="progress-container">
                  <div
                    className="progress-bar"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">{progress.percent.toFixed(0)}%</p>
              </div>
            )}

            {error && (
              <div className="p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-300">
                {error}
              </div>
            )}

            {hasFillers && !isAnalyzing && (
              <div className="p-2 bg-blue-900 bg-opacity-50 border border-blue-600 rounded text-xs">
                <div className="text-blue-300 font-semibold mb-1">📊 Analysis Complete</div>
                <div className="text-blue-200 space-y-1">
                  <div>Fillers Found: <span className="text-white font-semibold">{fillers.length}</span></div>
                  <div>Items to Cut: <span className="text-white font-semibold">{cutPlan.length}</span></div>
                </div>
              </div>
            )}

            {hasFillers && fillers.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded p-2 text-xs max-h-48 overflow-auto">
                <div className="text-gray-400 font-semibold mb-2">Detected Fillers:</div>
                <div className="space-y-1">
                  {fillers.slice(0, 10).map((filler, i) => (
                    <div key={i} className="text-gray-300">
                      "{filler.word}" @ {filler.startSec.toFixed(1)}s
                      <span className="text-gray-500 ml-1">({(filler.confidence * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                  {fillers.length > 10 && (
                    <div className="text-gray-500 italic">... and {fillers.length - 10} more</div>
                  )}
                </div>
              </div>
            )}

            {hasCutPlan && (
              <button
                onClick={handleApply}
                disabled={cutPlan.length === 0}
                className="btn btn-success w-full"
              >
                ✂️ Apply Cuts ({cutPlan.length} items)
              </button>
            )}

            {hasUndo && (
              <button
                onClick={handleUndo}
                className="btn btn-secondary w-full"
              >
                ↩️ Undo Last Cuts
              </button>
            )}

            {!hasFillers && !isAnalyzing && itemsCount === 0 && (
              <div className="text-xs text-gray-500 text-center p-4">
                Add clips to the timeline to analyze speech
              </div>
            )}
        </>
      </div>
    </>
  )
}

