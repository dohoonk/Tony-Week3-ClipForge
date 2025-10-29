import type { Transcript, FillerSpan } from '../types'
import { FILLERS, normalizeWord } from './filler-dictionary'

/**
 * Options for filler detection
 */
export interface FillerDetectionOptions {
  /**
   * Minimum confidence threshold (0.0 - 1.0)
   * Words with lower confidence will be filtered out.
   * If not provided, confidence is not used for filtering.
   */
  confMin?: number
  /**
   * Padding to apply to each side of detected fillers (in milliseconds)
   * Default: 40ms
   */
  padMs?: number
  /**
   * Maximum gap between adjacent fillers to merge (in milliseconds)
   * Default: 120ms
   */
  mergeGapMs?: number
}

/**
 * Detect filler words in a transcript and return cut ranges
 * 
 * @param transcript Transcript with word-level timestamps
 * @param clipId Clip ID (for FillerSpan clipId field)
 * @param options Detection options (confidence threshold, padding, merge gap)
 * @returns Array of FillerSpan objects sorted by start time
 */
export function detectFillerSpans(
  transcript: Transcript,
  clipId: string,
  options?: FillerDetectionOptions
): FillerSpan[] {
  const {
    confMin,
    padMs = 40,
    mergeGapMs = 120,
  } = options || {}

  const padSec = padMs / 1000
  const mergeGapSec = mergeGapMs / 1000

  // Step 1: Find all filler words
  const candidates: FillerSpan[] = []

  for (const word of transcript.words) {
    const normalized = normalizeWord(word.text)
    
    // Check if normalized word matches any filler
    if (FILLERS.includes(normalized)) {
      // Apply confidence filter if provided
      if (confMin !== undefined && word.confidence < confMin) {
        continue
      }

      // Create filler span with padding
      const paddedStart = Math.max(0, word.startSec - padSec)
      const paddedEnd = word.endSec + padSec

      candidates.push({
        clipId,
        word: normalized,
        startSec: word.startSec,
        endSec: word.endSec,
        confidence: word.confidence,
        paddedStart,
        paddedEnd,
      })
    }
  }

  // Step 2: Merge adjacent fillers
  if (candidates.length === 0) {
    return []
  }

  // Sort by start time
  candidates.sort((a, b) => a.startSec - b.startSec)

  const merged: FillerSpan[] = []
  let current = candidates[0]

  for (let i = 1; i < candidates.length; i++) {
    const next = candidates[i]
    
    // Check if next filler is close enough to merge (gap <= mergeGapMs)
    // Gap is the time between end of current and start of next
    const gap = next.startSec - current.endSec

    if (gap <= mergeGapSec) {
      // Merge: extend current span to include next
      current = {
        ...current,
        endSec: Math.max(current.endSec, next.endSec),
        // Update padded end to include next filler's padding
        paddedEnd: next.paddedEnd,
        // Combine word text if needed (or keep first)
        word: current.word !== next.word ? `${current.word}/${next.word}` : current.word,
      }
    } else {
      // Gap too large, save current and start new
      merged.push(current)
      current = next
    }
  }

  // Don't forget the last one
  merged.push(current)

  return merged
}

