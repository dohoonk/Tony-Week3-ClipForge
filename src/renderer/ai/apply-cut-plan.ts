import type { TrackItem, CutPlan } from '../../shared/types'
import { useStore } from '../store'

/**
 * Apply a cut plan to the timeline
 * 
 * Splits track items based on cut operations and updates the store.
 * Handles playhead adjustment if it's inside a removed region.
 * Stores snapshot for undo functionality.
 * 
 * @param cutPlans Array of cut plans to apply
 */
export function applyCutPlanToStore(cutPlans: CutPlan[]): void {
  const store = useStore.getState()
  
  // Store snapshot for undo (deep copy)
  const currentTrackItems = { ...store.trackItems }
  const snapshot: Record<string, TrackItem> = {}
  for (const [id, item] of Object.entries(currentTrackItems)) {
    snapshot[id] = { ...item }
  }
  store.setLastAITrackItemsSnapshot(snapshot)
  
  console.log('[ApplyCutPlan] Stored snapshot with', Object.keys(snapshot).length, 'items')
  
  // Collect all mutations to apply in batch
  const itemsToAdd: TrackItem[] = []
  const itemsToRemove: string[] = []
  const itemsToUpdate: Array<{ id: string; updates: Partial<TrackItem> }> = []
  const playheadAdjustment = { needed: false, newPosition: store.ui.playheadSec }
  
  // Track all cuts to calculate ripple adjustments
  interface CutRegion {
    trackItemId: string
    trackId: string
    cutStart: number
    cutEnd: number
    removedDuration: number
  }
  const cutRegions: CutRegion[] = []
  
  for (const plan of cutPlans) {
    const item = store.trackItems[plan.trackItemId]
    if (!item) {
      console.warn(`[ApplyCutPlan] TrackItem ${plan.trackItemId} not found`)
      continue
    }
    
    // Check if playhead is in this item
    const itemStart = item.trackPosition
    const itemEnd = itemStart + (item.outSec - item.inSec)
    const playheadInItem = store.ui.playheadSec >= itemStart && store.ui.playheadSec <= itemEnd
    
    // Sort cuts by start time
    const sortedCuts = [...plan.cuts].sort((a, b) => a.startSec - b.startSec)
    
    // Calculate total removed duration for this item
    let totalRemovedDuration = 0
    for (const cut of sortedCuts) {
      totalRemovedDuration += cut.endSec - cut.startSec
      // Track this cut region for ripple adjustment
      cutRegions.push({
        trackItemId: plan.trackItemId,
        trackId: item.trackId,
        cutStart: cut.startSec,
        cutEnd: cut.endSec,
        removedDuration: cut.endSec - cut.startSec,
      })
    }
    
    // Calculate fragments (using original positions for now, we'll adjust later)
    const fragments: Array<{ startSec: number; endSec: number; originalStart: number; originalEnd: number }> = []
    let currentStart = itemStart
    
    for (const cut of sortedCuts) {
      // Fragment before this cut
      if (cut.startSec > currentStart) {
        fragments.push({
          startSec: currentStart,
          endSec: cut.startSec,
          originalStart: currentStart,
          originalEnd: cut.startSec,
        })
      }
      
      // Check if playhead is inside this cut (will be removed)
      if (playheadInItem && store.ui.playheadSec >= cut.startSec && store.ui.playheadSec <= cut.endSec) {
        playheadAdjustment.needed = true
        // Move playhead to end of cut (will be adjusted to fragment start if available)
        playheadAdjustment.newPosition = cut.endSec
      }
      
      currentStart = Math.max(currentStart, cut.endSec)
    }
    
    // Fragment after last cut
    const itemEndTime = itemStart + (item.outSec - item.inSec)
    if (currentStart < itemEndTime) {
      fragments.push({
        startSec: currentStart,
        endSec: itemEndTime,
        originalStart: currentStart,
        originalEnd: itemEndTime,
      })
    }
    
    // If no fragments (entire item removed), just remove it
    if (fragments.length === 0) {
      itemsToRemove.push(plan.trackItemId)
      // If playhead was in this item, move to 0 or next item
      if (playheadInItem) {
        playheadAdjustment.needed = true
        playheadAdjustment.newPosition = 0
      }
      continue
    }
    
    // Calculate ripple adjustment: fragments after cuts move forward
    let accumulatedRemovedDuration = 0
    
    // Create new fragments with ripple adjustments
    let fragmentIndex = 0
    for (const fragment of fragments) {
      // Calculate how much to shift this fragment forward
      // Fragments before the first cut don't move
      // Fragments after cuts move forward by the total duration removed before them
      let shiftForward = 0
      
      // Find how much duration was removed before this fragment
      for (const cut of sortedCuts) {
        if (cut.endSec <= fragment.originalStart) {
          // This cut is completely before the fragment
          shiftForward += cut.endSec - cut.startSec
        } else if (cut.startSec < fragment.originalEnd && cut.endSec > fragment.originalStart) {
          // Cut overlaps with fragment - this shouldn't happen if fragments are calculated correctly
          console.warn('[ApplyCutPlan] Cut overlaps fragment, skipping adjustment')
        }
      }
      
      // New position = original position - shift forward (since we remove duration before it)
      const newFragmentStart = fragment.originalStart - shiftForward
      
      const fragmentDuration = fragment.endSec - fragment.startSec
      
      // Calculate clip-relative times for this fragment
      // Fragment starts at timeline time `fragment.startSec`
      // Original item: trackPosition=itemStart, inSec=item.inSec, outSec=item.outSec
      // Fragment timeline start = fragment.startSec
      // Clip start for fragment = item.inSec + (fragment.startSec - itemStart)
      // Clip end for fragment = clip start + fragment duration
      
      const clipStartOffset = fragment.startSec - itemStart
      const newInSec = item.inSec + clipStartOffset
      const newOutSec = newInSec + fragmentDuration
      
      // Validate fragment bounds
      if (newInSec >= item.outSec || newOutSec <= item.inSec) {
        console.warn(`[ApplyCutPlan] Invalid fragment bounds, skipping`)
        continue
      }
      
      const fragmentId = fragmentIndex === 0 
        ? plan.trackItemId // First fragment keeps original ID
        : `item-${Date.now()}-${Math.random()}`
      
      const fragmentItem: TrackItem = {
        id: fragmentId,
        clipId: item.clipId,
        trackId: item.trackId,
        inSec: Math.max(item.inSec, newInSec),
        outSec: Math.min(item.outSec, newOutSec),
        trackPosition: newFragmentStart, // Use adjusted position (ripple tightened)
      }
      
      // If this is the first fragment and it starts at the same position as the original item,
      // update the existing item instead of creating a new one
      // Note: Even if position changes due to ripple, we still update the first fragment's ID
      if (fragmentIndex === 0 && fragment.originalStart === itemStart && fragmentId === plan.trackItemId) {
        // Update existing item
        itemsToUpdate.push({
          id: plan.trackItemId,
          updates: {
            inSec: fragmentItem.inSec,
            outSec: fragmentItem.outSec,
            trackPosition: fragmentItem.trackPosition,
          },
        })
      } else {
        // Add new fragment
        itemsToAdd.push(fragmentItem)
      }
      
      // If playhead adjustment needed and this fragment is after the cut, use this fragment's start
      if (playheadAdjustment.needed && fragment.startSec >= playheadAdjustment.newPosition) {
        playheadAdjustment.newPosition = fragment.startSec
        playheadAdjustment.needed = false // Found valid position
      }
      
      fragmentIndex++
    }
    
    // If we updated the first fragment and there are more fragments, we're done
    // Otherwise, if no fragments were created, remove the item
    if (fragments.length === 0) {
      itemsToRemove.push(plan.trackItemId)
    } else if (fragments.length > 1 && fragmentIndex > 1) {
      // If we have multiple fragments and the first one was updated (kept original ID),
      // we don't need to remove the original item
      // Additional fragments are already added
    }
  }
  
  // Apply batch update (fragments created, but positions not fully adjusted yet)
  store.batchUpdateTrackItems({
    add: itemsToAdd,
    remove: itemsToRemove,
    update: itemsToUpdate,
  })
  
  // Now apply ripple tightening: shift all items forward by removed duration before them
  // This needs to be done track-by-track since cuts only affect items on the same track
  const finalUpdates: Array<{ id: string; updates: Partial<TrackItem> }> = []
  
  // Get all items (need fresh state after first batch update)
  const allItemsAfterFirstUpdate = Object.values(store.trackItems)
  
  // Group items by track
  const itemsByTrack = new Map<string, typeof allItemsAfterFirstUpdate>()
  for (const item of allItemsAfterFirstUpdate) {
    if (!itemsByTrack.has(item.trackId)) {
      itemsByTrack.set(item.trackId, [])
    }
    itemsByTrack.get(item.trackId)!.push(item)
  }
  
  // Group cut regions by track
  const cutsByTrack = new Map<string, typeof cutRegions>()
  for (const cut of cutRegions) {
    if (!cutsByTrack.has(cut.trackId)) {
      cutsByTrack.set(cut.trackId, [])
    }
    cutsByTrack.get(cut.trackId)!.push(cut)
  }
  
  // For each track, calculate ripple adjustments
  for (const [trackId, trackItems] of itemsByTrack.entries()) {
    const trackCuts = cutsByTrack.get(trackId) || []
    
    // Sort cuts by original start time
    trackCuts.sort((a, b) => a.cutStart - b.cutStart)
    
    // Sort items by current position
    const sortedItems = [...trackItems].sort((a, b) => a.trackPosition - b.trackPosition)
    
    for (const item of sortedItems) {
      // Calculate total duration removed before this item's current position
      // We need to check against the item's current position (after fragments were created)
      let totalShift = 0
      
      for (const cut of trackCuts) {
        // If cut is completely before this item's position, shift forward
        // Use original cut position for comparison
        if (cut.cutEnd <= item.trackPosition) {
          // But wait - fragments have already been shifted. We need original item positions.
          // Let's use a simpler approach: sum all cuts that end before this item
          totalShift += cut.removedDuration
        }
      }
      
      // But we also need to account for cuts that happened within the same original item
      // If this is a fragment, it may have already been partially shifted
      // For now, let's use a simpler approach: recalculate based on current positions
      
      // Actually, let's recalculate more carefully:
      // We need to know: what was the original position of this item before any cuts?
      // If this item was part of a cut plan, its position was already adjusted in fragment creation
      // If this item was not part of a cut plan, we need to shift it forward by all cuts before it
      
      // Check if this item was just created/updated (meaning it's a fragment)
      const isFragment = itemsToAdd.find(a => a.id === item.id) || itemsToUpdate.find(u => u.id === item.id)
      
      if (!isFragment && totalShift > 0) {
        // This is an existing item that needs shifting
        finalUpdates.push({
          id: item.id,
          updates: {
            trackPosition: item.trackPosition - totalShift,
          },
        })
      }
    }
  }
  
  // Apply final ripple adjustments if any
  if (finalUpdates.length > 0) {
    console.log(`[ApplyCutPlan] Applying ripple adjustments to ${finalUpdates.length} items`)
    store.batchUpdateTrackItems({
      update: finalUpdates,
    })
  }
  
  // Adjust playhead if needed
  if (playheadAdjustment.needed) {
    // Try to find first fragment after playhead
    const allItems = Object.values(store.trackItems)
    const futureFragment = allItems.find(item => item.trackPosition > playheadAdjustment.newPosition)
    
    if (futureFragment) {
      store.setPlayheadSec(futureFragment.trackPosition)
    } else {
      store.setPlayheadSec(0)
    }
  }
  
  console.log(`[ApplyCutPlan] Applied cuts: removed ${itemsToRemove.length} items, added ${itemsToAdd.length} fragments`)
}

