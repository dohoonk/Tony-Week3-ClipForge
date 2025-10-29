import type { TrackItem, FillerSpan, CutPlan } from '../types'

/**
 * Options for cut plan generation
 */
export interface CutPlanOptions {
  /**
   * Maximum gap between fragments to merge (ripple tighten) in milliseconds
   * Default: 500ms (0.5 seconds)
   */
  rippleGapMs?: number
}

/**
 * Convert clip-relative time to timeline-relative time for a track item
 * 
 * @param clipTime Time in seconds relative to clip start
 * @param item Track item with clip bounds
 * @returns Time in seconds relative to timeline start
 * 
 * @example
 * Item: trackPosition=10s, inSec=2s, outSec=5s
 * Clip time 3s → Timeline = 10s + (3s - 2s) = 11s
 */
function clipTimeToTimelineTime(clipTime: number, item: TrackItem): number {
  return item.trackPosition + (clipTime - item.inSec)
}

/**
 * Convert timeline-relative time to clip-relative time for a track item
 * 
 * @param timelineTime Time in seconds relative to timeline start
 * @param item Track item with clip bounds
 * @returns Time in seconds relative to clip start
 */
function timelineTimeToClipTime(timelineTime: number, item: TrackItem): number {
  return timelineTime - item.trackPosition + item.inSec
}

/**
 * Check if a filler span overlaps with a track item (in clip-relative time)
 * 
 * @param filler Filler span (clip-relative times)
 * @param item Track item
 * @returns True if filler overlaps with item's inSec→outSec range
 */
function fillerOverlapsItem(filler: FillerSpan, item: TrackItem): boolean {
  // Check if filler overlaps with item's trimmed bounds
  // Filler times are clip-relative, compare with item's inSec→outSec
  return filler.paddedStart < item.outSec && filler.paddedEnd > item.inSec
}

/**
 * Generate cut plan from filler spans
 * 
 * Converts filler detection results into timeline trim operations.
 * Only processes fillers within TrackItem trim bounds.
 * 
 * @param trackItems All track items in the timeline
 * @param fillerSpans Detected filler spans (clip-relative times)
 * @param options Generation options (ripple gap)
 * @returns Array of cut plans, one per TrackItem that has fillers to remove
 * 
 * @example
 * TrackItem: id="item1", clipId="clip1", trackPosition=10s, inSec=2s, outSec=5s
 * FillerSpan: clipId="clip1", startSec=3s, endSec=3.5s (clip-relative)
 * → Cut at timeline 11s-11.5s
 * → Creates fragments: [0→11s, 11.5s→13s] (timeline-relative)
 */
export function generateCutPlan(
  trackItems: TrackItem[],
  fillerSpans: FillerSpan[],
  options?: CutPlanOptions
): CutPlan[] {
  const rippleGapMs = options?.rippleGapMs ?? 500
  const rippleGapSec = rippleGapMs / 1000

  // Group fillers by clip ID for faster lookup
  const fillersByClipId = new Map<string, FillerSpan[]>()
  for (const filler of fillerSpans) {
    if (!fillersByClipId.has(filler.clipId)) {
      fillersByClipId.set(filler.clipId, [])
    }
    fillersByClipId.get(filler.clipId)!.push(filler)
  }

  const cutPlans: CutPlan[] = []

  // Process each track item
  for (const item of trackItems) {
    const clipFillers = fillersByClipId.get(item.clipId) || []

    // Find fillers that overlap with this item's trimmed range
    const overlappingFillers = clipFillers.filter(filler => 
      fillerOverlapsItem(filler, item)
    )

    if (overlappingFillers.length === 0) {
      continue // No fillers in this item
    }

    // Convert filler times from clip-relative to timeline-relative
    // Only consider the portion of fillers within item bounds
    const timelineCuts: Array<{ startSec: number; endSec: number }> = []

    for (const filler of overlappingFillers) {
      // Clamp filler bounds to item's inSec→outSec range
      const fillerStart = Math.max(filler.paddedStart, item.inSec)
      const fillerEnd = Math.min(filler.paddedEnd, item.outSec)

      // If filler is completely outside item bounds, skip
      if (fillerStart >= item.outSec || fillerEnd <= item.inSec) {
        continue
      }

      // Convert to timeline-relative time
      const timelineStart = clipTimeToTimelineTime(fillerStart, item)
      const timelineEnd = clipTimeToTimelineTime(fillerEnd, item)

      timelineCuts.push({
        startSec: timelineStart,
        endSec: timelineEnd,
      })
    }

    if (timelineCuts.length === 0) {
      continue // No valid cuts after clamping
    }

    // Sort cuts by start time
    timelineCuts.sort((a, b) => a.startSec - b.startSec)

    // Merge overlapping/adjacent cuts
    const mergedCuts: Array<{ startSec: number; endSec: number }> = []
    let current = timelineCuts[0]

    for (let i = 1; i < timelineCuts.length; i++) {
      const next = timelineCuts[i]
      
      // If cuts overlap or are very close, merge them
      if (next.startSec <= current.endSec + rippleGapSec) {
        current = {
          startSec: current.startSec,
          endSec: Math.max(current.endSec, next.endSec),
        }
      } else {
        mergedCuts.push(current)
        current = next
      }
    }
    mergedCuts.push(current)

    // Create cut plan for this item
    if (mergedCuts.length > 0) {
      cutPlans.push({
        trackItemId: item.id,
        cuts: mergedCuts,
      })
    }
  }

  return cutPlans
}

