import React, { useState, useRef, useMemo, useEffect } from 'react'
import { useStore } from '../store'

const BASE_PIXELS_PER_SEC = 50 // 1x zoom
const TRACK_HEIGHT = 80
const PLAYHEAD_HEIGHT = TRACK_HEIGHT
const MIN_ZOOM = 0.5
const MAX_ZOOM = 10
const MIN_TRACK_HEIGHT = 60
const MAX_TRACK_HEIGHT = 120
const MIN_SEGMENT_SEC = 0.1

export function Timeline() {
  // Select only what we need; avoid subscribing to playheadSec to prevent rerenders each tick
  const trackItems = useStore(s => s.trackItems)
  const tracks = useStore(s => s.tracks)
  const addTrackItem = useStore(s => s.addTrackItem)
  const addTrack = useStore(s => s.addTrack)
  const removeTrack = useStore(s => s.removeTrack)
  const removeTrackItem = useStore(s => s.removeTrackItem)
  const updateTrackItem = useStore(s => s.updateTrackItem)
  const addClip = useStore(s => s.addClip)
  const removeClip = useStore(s => s.removeClip)
  const moveTrackUp = useStore(s => s.moveTrackUp)
  const moveTrackDown = useStore(s => s.moveTrackDown)
  const setPlayheadSec = useStore(s => s.setPlayheadSec)
  const setIsPlaying = useStore(s => s.setIsPlaying)
  const setTrackHeight = useStore(s => s.setTrackHeight)
  const toggleTrackVisibility = useStore(s => s.toggleTrackVisibility)
  const isPlaying = useStore(s => s.ui.isPlaying)
  const zoom = useStore(s => s.ui.zoom)
  const setZoom = useStore(s => s.setZoom)
  const snapEnabled = useStore(s => s.ui.snapEnabled)
  const snapInterval = useStore(s => s.ui.snapInterval)
  const snapToEdges = useStore(s => s.ui.snapToEdges)
  const setSnapEnabled = useStore(s => s.setSnapEnabled)
  
  const [dragOver, setDragOver] = useState(false)
  const [hoveredTrackIndex, setHoveredTrackIndex] = useState<number | null>(null)
  const [dropGuideTime, setDropGuideTime] = useState<number | null>(null)
  const [rawDropTime, setRawDropTime] = useState<number | null>(null) // For snap feedback
  const [scrollLeft, setScrollLeft] = useState(0)
  const [trimFeedback, setTrimFeedback] = useState<{
    itemId: string
    inSec: number
    outSec: number
    duration: number
    isConstrained?: boolean
  } | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const playheadLabelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastScrollTimeRef = useRef<number>(0)
  const resizingRef = useRef<{
    itemId: string
    edge: 'left' | 'right'
    startClientX: number
    startIn: number
    startOut: number
    startTrackPos: number
    clipDuration: number
  } | null>(null)

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  // Snap utility function - returns snapped time and edge info
  const snapTime = (time: number, excludeItemId?: string): { time: number; edgeType?: 'left' | 'right' | null } => {
    if (!snapEnabled) return { time }
    
    const SNAP_THRESHOLD = snapInterval * 0.3 // 30% of interval as threshold
    
    // Collect all clip edges for snap-to-edges with type information
    const edges: Array<{ position: number; type: 'left' | 'right' }> = []
    if (snapToEdges) {
      Object.values(trackItems).forEach(item => {
        if (excludeItemId && item.id === excludeItemId) return
        const itemStart = Number(item.trackPosition) || 0
        const itemDuration = (Number(item.outSec) - Number(item.inSec)) || 0
        const itemEnd = itemStart + itemDuration
        edges.push(
          { position: itemStart, type: 'left' },
          { position: itemEnd, type: 'right' }
        )
      })
    }
    
    // Check snap to edges first (priority)
    if (snapToEdges && edges.length > 0) {
      let nearestEdge: { position: number; type: 'left' | 'right' } | null = null
      let nearestDistance = Infinity
      
      for (const edge of edges) {
        const distance = Math.abs(time - edge.position)
        if (distance < SNAP_THRESHOLD && distance < nearestDistance) {
          nearestDistance = distance
          nearestEdge = edge
        }
      }
      
      if (nearestEdge !== null) {
        return { time: nearestEdge.position, edgeType: nearestEdge.type }
      }
    }
    
    // Snap to grid
    const snapped = Math.round(time / snapInterval) * snapInterval
    const distanceToSnap = Math.abs(time - snapped)
    
    if (distanceToSnap <= SNAP_THRESHOLD) {
      return { time: snapped, edgeType: null }
    }
    
    return { time, edgeType: null }
  }

  // Snap utility for drag-drop operations - adjusts position based on edge type and clip duration
  const snapTimeForDrag = (time: number, clipDuration: number, excludeItemId?: string): number => {
    const snapResult = snapTime(time, excludeItemId)
    
    // If snapping to a left edge, adjust position so clip's end aligns with that edge
    if (snapResult.edgeType === 'left') {
      return snapResult.time - clipDuration
    }
    
    // For right edges or grid snaps, use the snapped position directly (start aligns)
    return snapResult.time
  }

  const beginResize = (e: React.MouseEvent, itemId: string, edge: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    const item = useStore.getState().trackItems[itemId]
    if (!item) return
    const clip = useStore.getState().clips[item.clipId]
    const clipDuration = Number(clip?.duration) || 0
    resizingRef.current = {
      itemId,
      edge,
      startClientX: e.clientX,
      startIn: Number(item.inSec) || 0,
      startOut: Number(item.outSec) || 0,
      startTrackPos: Number(item.trackPosition) || 0,
      clipDuration,
    }

    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current
      if (!r) return
      const deltaPx = ev.clientX - r.startClientX
      const deltaSec = deltaPx / pixelsPerSecond
      let isConstrained = false
      
      if (r.edge === 'left') {
        const proposedIn = r.startIn + deltaSec
        const newIn = clamp(proposedIn, 0, r.startOut - MIN_SEGMENT_SEC)
        
        // Check if we hit a constraint
        if (newIn <= 0) {
          // Can't trim past the start of the clip
          isConstrained = true
        } else if (r.startOut - newIn < MIN_SEGMENT_SEC) {
          // Can't trim below minimum duration
          isConstrained = true
        }
        
        const trackDelta = newIn - r.startIn
        const rawTrackPos = clamp(r.startTrackPos + trackDelta, 0, Infinity)
        // Snap the left edge position
        const snapResult = snapTime(rawTrackPos, r.itemId)
        const newTrackPos = snapResult.time
        updateTrackItem(r.itemId, { inSec: newIn, trackPosition: newTrackPos })
        
        // Update feedback with new trim values
        setTrimFeedback({
          itemId: r.itemId,
          inSec: newIn,
          outSec: r.startOut,
          duration: r.startOut - newIn,
          isConstrained
        })
      } else {
        const proposedOut = r.startOut + deltaSec
        const maxOut = r.clipDuration || r.startOut
        const newOut = clamp(proposedOut, (r.startIn + MIN_SEGMENT_SEC), maxOut)
        
        // Check if we hit a constraint
        if (newOut >= maxOut) {
          // Can't trim past the end of the clip
          isConstrained = true
        } else if (newOut - r.startIn < MIN_SEGMENT_SEC) {
          // Can't trim below minimum duration
          isConstrained = true
        }
        
        updateTrackItem(r.itemId, { outSec: newOut })
        
        // Update feedback with new trim values
        setTrimFeedback({
          itemId: r.itemId,
          inSec: r.startIn,
          outSec: newOut,
          duration: newOut - r.startIn,
          isConstrained
        })
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      resizingRef.current = null
      setTrimFeedback(null) // Clear feedback when done trimming
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Calculate pixels per second based on zoom
  const pixelsPerSecond = BASE_PIXELS_PER_SEC * (zoom || 1)
  const AUTO_SCROLL_ENABLED = false

  const draggedClipRef = useRef<{ clipId?: string; trackItemId?: string; duration?: number } | null>(null)

  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    e.dataTransfer.setData('clipId', clipId)
    e.dataTransfer.effectAllowed = 'copy'
    // Store clip info for drag-over preview
    const clip = useStore.getState().clips[clipId]
    draggedClipRef.current = { clipId, duration: clip?.duration }
  }

  const handleTrackItemDragStart = (e: React.DragEvent, trackItemId: string) => {
    e.dataTransfer.setData('trackItemId', trackItemId)
    e.dataTransfer.effectAllowed = 'move'
    // Store track item info for drag-over preview
    const item = useStore.getState().trackItems[trackItemId]
    if (item) {
      const clip = useStore.getState().clips[item.clipId]
      if (clip) {
        const itemDuration = (Number(item.outSec) - Number(item.inSec)) || clip.duration
        draggedClipRef.current = { trackItemId, duration: itemDuration }
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
    
        // Calculate which track is being hovered
        const rect = timelineRef.current?.getBoundingClientRect()
        if (rect) {
          const mouseY = e.clientY - rect.top
          const mouseX = e.clientX - rect.left
          const scrollTop = scrollContainerRef.current?.scrollTop || 0
          const totalY = mouseY + scrollTop
          const rawTime = (mouseX / pixelsPerSecond) + (scrollLeft / pixelsPerSecond)
          
          // Use stored drag info for edge-aware snapping during preview
          let snappedTime = rawTime
          if (draggedClipRef.current?.duration) {
            const excludeId = draggedClipRef.current.trackItemId || undefined
            snappedTime = snapTimeForDrag(rawTime, draggedClipRef.current.duration, excludeId)
          } else {
            const snapResult = snapTime(rawTime)
            snappedTime = snapResult.time
          }
          
          setRawDropTime(rawTime)
          setDropGuideTime(snappedTime)
          
          // Calculate track index based on cumulative track heights
          const sortedTracks = Object.values(tracks).sort((a, b) => a.order - b.order)
          let cumulativeHeight = 0
          let trackIndex = 0
          
          for (let i = 0; i < sortedTracks.length; i++) {
            const trackHeight = sortedTracks[i].height || 80
            if (totalY >= cumulativeHeight && totalY < cumulativeHeight + trackHeight) {
              trackIndex = i
              break
            }
            cumulativeHeight += trackHeight
            trackIndex = i + 1
          }
          
          const clampedIndex = Math.max(0, Math.min(trackIndex, sortedTracks.length - 1))
          setHoveredTrackIndex(clampedIndex)
        }
  }

  const handleDragLeave = () => {
    setDragOver(false)
    setHoveredTrackIndex(null)
    setDropGuideTime(null)
    setRawDropTime(null)
    draggedClipRef.current = null // Clear drag info
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    setHoveredTrackIndex(null)
    setDropGuideTime(null)
    setRawDropTime(null)
    draggedClipRef.current = null // Clear drag info

    console.log('[Timeline] Drop event triggered')

    // Check if this is a track item being moved
    const trackItemId = e.dataTransfer.getData('trackItemId')
    if (trackItemId) {
      handleTrackItemMove(e, trackItemId)
      return
    }

    // Otherwise, handle clip drop from media library
    const clipId = e.dataTransfer.getData('clipId')
    console.log('[Timeline] ClipId from drop:', clipId)
    
    if (!clipId) {
      console.warn('[Timeline] No clipId in dataTransfer')
      return
    }

    // Get mouse position relative to timeline
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) {
      console.warn('[Timeline] No timeline ref')
      return
    }

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const rawDropTime = (mouseX / pixelsPerSecond) + (scrollLeft / pixelsPerSecond)
    
    // Get clip and apply edge-aware snapping
    const clip = useStore.getState().clips[clipId]
    const clipDuration = clip?.duration || 10 // fallback
    const dropTime = snapTimeForDrag(rawDropTime, clipDuration)
    
    setDropGuideTime(dropTime)

    console.log('[Timeline] Drop at:', dropTime, 'seconds, y:', mouseY)
    console.log('[Timeline] Scroll top:', scrollContainerRef.current?.scrollTop)

        // Calculate which track based on Y position
        // The Y position is relative to the timeline container
        const scrollTop = scrollContainerRef.current?.scrollTop || 0
        const totalY = mouseY + scrollTop
        
        console.log('[Timeline] Total Y (mouseY + scrollTop):', totalY)
        
        // Calculate track index based on cumulative track heights
        const sortedTracks = Object.values(tracks).sort((a, b) => a.order - b.order)
        let cumulativeHeight = 0
        let trackIndex = 0
        
        for (let i = 0; i < sortedTracks.length; i++) {
          const trackHeight = sortedTracks[i].height || 80
          if (totalY >= cumulativeHeight && totalY < cumulativeHeight + trackHeight) {
            trackIndex = i
            break
          }
          cumulativeHeight += trackHeight
          trackIndex = i + 1
        }
        
        // Clamp track index to valid range
        const clampedIndex = Math.max(0, Math.min(trackIndex, sortedTracks.length - 1))
    
    console.log('[Timeline] Calculated track index:', trackIndex, '→ clamped:', clampedIndex)
    console.log('[Timeline] Available tracks:', sortedTracks.length, sortedTracks.map(t => t.name))
    
    const targetTrack = sortedTracks[clampedIndex]
    
    console.log('[Timeline] Target track:', targetTrack, 'index:', clampedIndex)

    // Create new track item
    const trackItem = {
      id: `trackitem-${Date.now()}-${Math.random()}`,
      clipId,
      trackId: targetTrack.id,
      inSec: 0, // TODO: get from UI trim controls
      outSec: clipDuration,
      trackPosition: dropTime,
    }

    console.log('[Timeline] Creating track item:', trackItem)
    addTrackItem(trackItem)
  }

  const handleTrackItemMove = (e: React.DragEvent, trackItemId: string) => {
    console.log('[Timeline] Moving track item:', trackItemId)
    
    // Get mouse position relative to timeline
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) {
      console.warn('[Timeline] No timeline ref')
      return
    }

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const rawDropTime = (mouseX / pixelsPerSecond) + (scrollLeft / pixelsPerSecond)
    
    // Get clip duration from existing track item for edge-aware snapping
    const existingItem = useStore.getState().trackItems[trackItemId]
    let dropTime = rawDropTime
    if (existingItem) {
      const clip = useStore.getState().clips[existingItem.clipId]
      if (clip) {
        const itemDuration = (Number(existingItem.outSec) - Number(existingItem.inSec)) || clip.duration
        dropTime = snapTimeForDrag(rawDropTime, itemDuration, trackItemId)
      }
    }

    // Calculate which track based on Y position
    const scrollTop = scrollContainerRef.current?.scrollTop || 0
    const totalY = mouseY + scrollTop
    
    // Calculate track index based on cumulative track heights
    const sortedTracks = Object.values(tracks).sort((a, b) => a.order - b.order)
    let cumulativeHeight = 0
    let trackIndex = 0
    
    for (let i = 0; i < sortedTracks.length; i++) {
      const trackHeight = sortedTracks[i].height || 80
      if (totalY >= cumulativeHeight && totalY < cumulativeHeight + trackHeight) {
        trackIndex = i
        break
      }
      cumulativeHeight += trackHeight
      trackIndex = i + 1
    }
    
    const clampedIndex = Math.max(0, Math.min(trackIndex, sortedTracks.length - 1))
    const targetTrack = sortedTracks[clampedIndex]
    
    console.log('[Timeline] Moving to track:', targetTrack.name, 'at time:', dropTime)
    
    // Update the track item
    if (existingItem) {
      const updatedItem = {
        ...existingItem,
        trackId: targetTrack.id,
        trackPosition: dropTime
      }
      
      // Remove old item and add updated one
      removeTrackItem(trackItemId)
      addTrackItem(updatedItem)
      
      console.log('[Timeline] Track item moved successfully')
    }
  }

  const handleClick = (trackItemId: string) => {
    console.log('[Timeline] Clicked track item:', trackItemId)
    // TODO: Implement selection
  }

  const handleDoubleClick = (trackItemId: string) => {
    console.log('[Timeline] Double clicked track item:', trackItemId)
    // TODO: Implement split at cursor
  }

  // Track management functions
  const handleAddTrack = () => {
    const sortedTracks = Object.values(tracks).sort((a, b) => a.order - b.order)
    const nextOrder = sortedTracks.length > 0 ? Math.max(...sortedTracks.map(t => t.order)) + 1 : 0
        const newTrack = {
          id: `track-${Date.now()}`,
          kind: 'video' as const,
          order: nextOrder,
          visible: true,
          name: `Video Track ${nextOrder + 1}`,
          height: 80 // Default height
        }
    addTrack(newTrack)
    console.log('[Timeline] Added new track:', newTrack)
  }

  const handleRemoveTrack = (trackId: string) => {
    const trackItemsInTrack = Object.values(trackItems).filter(item => item.trackId === trackId)
    if (trackItemsInTrack.length > 0) {
      if (!confirm(`This track contains ${trackItemsInTrack.length} item(s). Are you sure you want to delete it?`)) {
        return
      }
    }
    removeTrack(trackId)
    console.log('[Timeline] Removed track:', trackId)
  }

  // Project management functions
  const handleSaveProject = async () => {
    try {
      const state = useStore.getState()
      const project = {
        ...state.project,
        clips: state.clips,
        tracks: state.tracks,
        trackItems: state.trackItems
      }
      const savedPath = await window.clipforge.saveProject(project)
      console.log('[Timeline] Project saved to:', savedPath)
      alert(`Project saved to: ${savedPath}`)
    } catch (error) {
      console.error('[Timeline] Save failed:', error)
      alert('Failed to save project: ' + error.message)
    }
  }

  const handleLoadProject = async () => {
    try {
      const project = await window.clipforge.openProject()
      if (project) {
        console.log('[Timeline] Project loaded:', project)
        
        // Clear existing data - remove tracks first (this removes their items too)
        Object.keys(useStore.getState().tracks).forEach(trackId => removeTrack(trackId))
        // Remove any remaining track items (shouldn't be any after removing tracks)
        Object.keys(useStore.getState().trackItems).forEach(itemId => removeTrackItem(itemId))
        // Remove clips
        Object.keys(useStore.getState().clips).forEach(clipId => removeClip(clipId))
        
        // Add loaded clips
        Object.values(project.clips || {}).forEach((clip: any) => {
          addClip(clip)
        })
        
        // Add loaded tracks
        console.log('[Timeline] Adding tracks:', project.tracks)
        const loadedTracks = Object.values(project.tracks || {})
        if (loadedTracks.length > 0) {
          loadedTracks.forEach((track: any) => {
            console.log('[Timeline] Adding track:', track)
            addTrack(track)
          })
        } else {
          // If no tracks in project, ensure we have at least one default track
          console.log('[Timeline] No tracks in project, creating default track')
          const defaultTrack = {
            id: 'track-1',
            kind: 'video',
            order: 0,
            visible: true,
            name: 'Video Track 1'
          }
          addTrack(defaultTrack)
        }
        
        // Add loaded track items
        console.log('[Timeline] Adding track items:', project.trackItems)
        Object.values(project.trackItems || {}).forEach((item: any) => {
          console.log('[Timeline] Adding track item:', item)
          addTrackItem(item)
        })
        
        console.log('[Timeline] Store updated with loaded project')
        alert('Project loaded successfully')
      }
    } catch (error) {
      console.error('[Timeline] Load failed:', error)
      alert('Failed to load project: ' + error.message)
    }
  }

  const handlePlayheadClick = (e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const mouseX = e.clientX - rect.left
    const clickTime = (mouseX / pixelsPerSecond) + (scrollLeft / pixelsPerSecond)
    
    console.log('[Timeline] Playhead click at:', clickTime, 'seconds')
    setPlayheadSec(clickTime)
    // Pause video when seeking to new position
    setIsPlaying(false)
  }

  const handlePlayPause = () => {
    if (!isPlaying) {
      // Starting playback - just set isPlaying to true
      setIsPlaying(true)
    } else {
      // Pausing - just toggle the state
      setIsPlaying(false)
    }
  }

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value)
    
    // Clear any pending zoom updates
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current)
    }
    
    // Immediate zoom update for responsive feel
    setZoom(newZoom)
    
    // Debounced expensive calculations
    zoomTimeoutRef.current = setTimeout(() => {
      // Center scroll position on zoom change
      const currentCenter = scrollLeft + (timelineRef.current?.clientWidth || 0) / 2
      const prevPixelsPerSec = pixelsPerSecond
      const newPixelsPerSec = BASE_PIXELS_PER_SEC * newZoom
      
      // Maintain center position
      if (timelineRef.current && scrollContainerRef.current) {
        const newScrollLeft = currentCenter - (timelineRef.current.clientWidth / 2)
        scrollContainerRef.current.scrollLeft = newScrollLeft
        setScrollLeft(newScrollLeft)
      }
    }, 100) // 100ms debounce for zoom calculations
  }

  // Convert track items to array and sort by position
  const sortedItems = Object.values(trackItems).sort((a, b) => 
    a.trackPosition - b.trackPosition
  )

  // Memoized visible track items calculation for performance
  const visibleItems = useMemo(() => {
    if (!scrollContainerRef.current) return sortedItems
    
    const containerWidth = scrollContainerRef.current.clientWidth
    const scrollLeft = scrollContainerRef.current.scrollLeft
    
    // Calculate visible time range with padding
    const visibleStartTime = (scrollLeft / pixelsPerSecond) - 2 // 2 second padding
    const visibleEndTime = ((scrollLeft + containerWidth) / pixelsPerSecond) + 2 // 2 second padding
    
    return sortedItems.filter(item => {
      const itemStartTime = item.trackPosition
      const itemEndTime = item.trackPosition + (item.outSec - item.inSec)
      
      // Item is visible if it overlaps with visible time range
      return itemEndTime >= visibleStartTime && itemStartTime <= visibleEndTime
    })
  }, [sortedItems, scrollLeft, pixelsPerSecond])

  // Calculate timeline width based on track items and clip durations
  const calculateTimelineWidth = () => {
    if (sortedItems.length === 0) {
      // Default to 60 seconds if no items
      return Math.max(60 * pixelsPerSecond, scrollContainerRef.current?.clientWidth || 800)
    }

    // Find the rightmost edge of all track items
    let maxTime = 0
    for (const item of sortedItems) {
      const clip = useStore.getState().clips[item.clipId]
      const itemDuration = (item.outSec - item.inSec) || (clip?.duration || 0)
      const endTime = item.trackPosition + itemDuration
      if (endTime > maxTime) {
        maxTime = endTime
      }
    }

    // Add padding (10 seconds) and ensure minimum width
    const timelineSeconds = Math.max(maxTime + 10, 60)
    return Math.max(timelineSeconds * pixelsPerSecond, scrollContainerRef.current?.clientWidth || 800)
  }

  const timelineWidth = calculateTimelineWidth()

  // Animate playhead via requestAnimationFrame, independent of React renders
  useEffect(() => {
    let rafId: number | null = null
    let lastLabelMs = 0
    const labelInterval = 100 // update text at 10Hz
    const step = () => {
      const s = useStore.getState()
      const currentPlayhead = s.ui.playheadSec || 0
      const x = currentPlayhead * pixelsPerSecond
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translate3d(${x}px,0,0)`
      }
      const now = performance.now()
      if (now - lastLabelMs >= labelInterval && playheadLabelRef.current) {
        playheadLabelRef.current.textContent = `${currentPlayhead.toFixed(1)}s`
        lastLabelMs = now
      }
      rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)
    return () => { if (rafId) cancelAnimationFrame(rafId) }
  }, [pixelsPerSecond])

  // Auto-scroll timeline when playhead approaches the right edge (disabled for perf testing)
  useEffect(() => {
    if (!AUTO_SCROLL_ENABLED) return
    if (!scrollContainerRef.current || !isPlaying) return
    const containerWidth = scrollContainerRef.current.clientWidth
    const currentPlayhead = useStore.getState().ui.playheadSec || 0
    const playheadPosition = currentPlayhead * pixelsPerSecond
    const scrollPosition = scrollContainerRef.current.scrollLeft
    const visibleRight = scrollPosition + containerWidth
    const scrollMargin = containerWidth * 0.2
    if (playheadPosition + scrollMargin > visibleRight) {
      const newScrollLeft = playheadPosition - containerWidth + scrollMargin + scrollMargin
      scrollContainerRef.current.scrollLeft = newScrollLeft
      setScrollLeft(newScrollLeft)
    }
  }, [isPlaying, pixelsPerSecond])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current)
      }
    }
  }, [])

  // Split clip at playhead position
  const handleSplit = () => {
    const playheadSec = useStore.getState().ui.playheadSec || 0
    
    // Find the track item that contains the playhead
    // Sort tracks by order (lower order = top track)
    const sortedTracks = Object.values(tracks).sort((a, b) => a.order - b.order)
    let itemToSplit: any = null
    const EPS = 0.005 // Small epsilon for boundary checks
    
    // Search from top track to bottom (prioritize topmost clip)
    for (const track of sortedTracks) {
      if (!track.visible) continue
      
      const items = Object.values(trackItems).filter(item => item.trackId === track.id)
      
      for (const item of items) {
        const clip = useStore.getState().clips[item.clipId]
        if (!clip) continue
        
        const itemStart = Number(item.trackPosition) || 0
        const itemDuration = Number(item.outSec) - Number(item.inSec)
        const itemEnd = itemStart + itemDuration
        
        // Check if playhead is within this item's timeline range
        if (playheadSec >= itemStart + EPS && playheadSec < itemEnd - EPS) {
          itemToSplit = item
          break
        }
      }
      
      if (itemToSplit) break
    }
    
    if (!itemToSplit) {
      alert('No clip found at playhead position. Position the playhead on a clip to split.')
      return
    }
    
    const clip = useStore.getState().clips[itemToSplit.clipId]
    if (!clip) {
      console.error('[Timeline] Clip not found for item:', itemToSplit.clipId)
      return
    }
    
    // Calculate split point relative to clip source
    const itemStart = Number(itemToSplit.trackPosition) || 0
    const inSec = Number(itemToSplit.inSec) || 0
    const outSec = Number(itemToSplit.outSec) || 0
    
    // Time offset within the clip segment at playhead position
    const offsetInSegment = playheadSec - itemStart
    
    // Split point in clip's source time (inSec to outSec range)
    const splitPointInClip = inSec + offsetInSegment
    
    // Validate split point is within clip bounds
    if (splitPointInClip <= inSec + EPS || splitPointInClip >= outSec - EPS) {
      alert('Cannot split at clip edge. Move playhead to the middle of the clip.')
      return
    }
    
    // Ensure minimum segment duration
    const leftDuration = splitPointInClip - inSec
    const rightDuration = outSec - splitPointInClip
    
    if (leftDuration < MIN_SEGMENT_SEC || rightDuration < MIN_SEGMENT_SEC) {
      alert(`Cannot split: resulting segments would be too short (minimum ${MIN_SEGMENT_SEC}s).`)
      return
    }
    
    // Create left half
    const leftItem = {
      id: `trackitem-${Date.now()}-${Math.random()}`,
      clipId: itemToSplit.clipId,
      trackId: itemToSplit.trackId,
      inSec: inSec,
      outSec: splitPointInClip,
      trackPosition: itemStart,
    }
    
    // Create right half
    const rightItem = {
      id: `trackitem-${Date.now()}-${Math.random()}`,
      clipId: itemToSplit.clipId,
      trackId: itemToSplit.trackId,
      inSec: splitPointInClip,
      outSec: outSec,
      trackPosition: playheadSec, // Start at split point
    }
    
    // Remove old item and add two new ones
    removeTrackItem(itemToSplit.id)
    addTrackItem(leftItem)
    addTrackItem(rightItem)
    
    console.log('[Timeline] Split clip:', {
      original: itemToSplit.id,
      left: leftItem.id,
      right: rightItem.id,
      splitAt: splitPointInClip,
    })
  }

  return (
    <section className="flex-1 flex flex-col border-r border-gray-700 bg-gray-900">
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveProject}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium"
            >
              💾 Save Project
            </button>
            <button
              onClick={handleLoadProject}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded font-medium"
            >
              📁 Load Project
            </button>
            <button
              onClick={handlePlayPause}
              className={`px-3 py-1 rounded text-sm font-medium ${
                isPlaying 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              onClick={handleSplit}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded font-medium"
              title="Split clip at playhead position"
            >
              ✂ Split
            </button>
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                snapEnabled
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
              }`}
              title={`Snap ${snapEnabled ? 'enabled' : 'disabled'} (${snapInterval}s grid${snapToEdges ? ', edges' : ''})`}
            >
              {snapEnabled ? '🔗 Snap' : 'Snap'}
            </button>
            <div className="text-sm text-gray-400">
              {(() => { const ph = Math.floor(useStore.getState().ui.playheadSec || 0); return `Playhead: ${ph}s | Items: ${visibleItems.length}/${sortedItems.length}` })()}
            </div>
          </div>
        </div>
        
        {/* Track Management */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={handleAddTrack}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium"
          >
            + Add Track
          </button>
          <div className="flex items-center gap-2 flex-wrap">
                {Object.values(tracks)
                  .sort((a, b) => a.order - b.order)
                  .map(track => (
                    <div
                      key={track.id}
                      className="flex items-center gap-2 px-2 py-1 bg-gray-700 rounded text-sm"
                    >
                      <span className="text-gray-300">{track.name}</span>
                      <button
                        onClick={() => moveTrackUp(track.id)}
                        className="text-gray-300 hover:text-white text-xs"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveTrackDown(track.id)}
                        className="text-gray-300 hover:text-white text-xs"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleRemoveTrack(track.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                        title="Delete track"
                      >
                        ×
                      </button>
                    </div>
                  ))
                }
          </div>
        </div>
        
        {/* Zoom Controls */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400">Zoom:</label>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={zoom || 1}
            onChange={handleZoomChange}
            className="flex-1 accent-blue-600"
          />
          <span className="text-xs text-white min-w-[60px]">
            {(zoom || 1).toFixed(1)}×
          </span>
        </div>
      </div>
      
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-gray-900"
        style={{ contain: 'layout paint' }}
        onDragOver={handleDragOver}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onScroll={(e) => {
          const now = Date.now()
          const timeSinceLastScroll = now - lastScrollTimeRef.current
          
          // Throttle scroll events to 60fps (16ms) for smooth performance
          if (timeSinceLastScroll < 16) {
            return
          }
          
          lastScrollTimeRef.current = now
          
          // Clear any pending scroll updates
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current)
          }
          
          // Immediate update for responsive feel
          const currentLeft = e.currentTarget.scrollLeft
          setScrollLeft(currentLeft)
          
          // Debounced update for expensive calculations
          scrollTimeoutRef.current = setTimeout(() => {
            // Force re-render of visible items if needed
            setScrollLeft(currentLeft)
          }, 50) // 50ms debounce for heavy calculations
        }}
      >
            <div 
              ref={timelineRef}
              className="relative bg-gray-900"
              style={{ 
                width: `${timelineWidth}px`, 
                minHeight: `${Math.max(Object.values(tracks).reduce((total, track) => total + (track.height || 80), 0), 400)}px`,
                contain: 'layout paint'
              }}
          onDragOver={handleDragOver}
          onDragEnter={(e) => {
            e.preventDefault()
            console.log('[Timeline] Drag enter')
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handlePlayheadClick}
        >
        {dragOver && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }} />
        )}

        {dropGuideTime !== null && (
          <>
            {/* Raw position indicator (faint) when snapping */}
            {rawDropTime !== null && Math.abs(rawDropTime - dropGuideTime) > 0.01 && (
              <div
                className="absolute pointer-events-none"
                style={{ zIndex: 9998, left: `${rawDropTime * pixelsPerSecond}px`, top: 0, height: `${Math.max(Object.values(tracks).reduce((t, tr) => t + (tr.height || 80), 0), 400)}px` }}
              >
                <div className="absolute h-full" style={{ width: '1px', background: '#666', opacity: 0.4 }} />
              </div>
            )}
            {/* Snapped position indicator */}
            <div
              className="absolute pointer-events-none"
              style={{ zIndex: 9999, left: `${dropGuideTime * pixelsPerSecond}px`, top: 0, height: `${Math.max(Object.values(tracks).reduce((t, tr) => t + (tr.height || 80), 0), 400)}px` }}
            >
              <div 
                className="absolute h-full" 
                style={{ 
                  width: '2px', 
                  background: (rawDropTime !== null && Math.abs(rawDropTime - dropGuideTime) > 0.01) ? '#ffd700' : '#00e5ff', 
                  boxShadow: (rawDropTime !== null && Math.abs(rawDropTime - dropGuideTime) > 0.01) ? '0 0 10px 2px rgba(255,215,0,0.8)' : '0 0 10px 2px rgba(0,229,255,0.8)' 
                }} 
              />
              <div 
                className="absolute -top-7 -left-8 text-xs font-mono px-2 py-0.5 rounded" 
                style={{ 
                  background: '#0b1020', 
                  color: (rawDropTime !== null && Math.abs(rawDropTime - dropGuideTime) > 0.01) ? '#ffd700' : '#7dd3fc', 
                  border: (rawDropTime !== null && Math.abs(rawDropTime - dropGuideTime) > 0.01) ? '1px solid #ffd700' : '1px solid #38bdf8' 
                }}
              >
                {dropGuideTime.toFixed(1)}s {rawDropTime !== null && Math.abs(rawDropTime - dropGuideTime) > 0.01 && '⚡'}
              </div>
            </div>
          </>
        )}

        {/* Global playhead indicator (transform-based, DOM-driven) */}
        <div
          ref={playheadRef}
          className="absolute bg-red-500 z-50 pointer-events-none"
          style={{
            left: '0px',
            transform: 'translateX(0px)',
            willChange: 'transform',
            width: '4px',
            height: `${Math.max(Object.values(tracks).reduce((total, track) => total + (track.height || 80), 0), 400)}px`,
            top: '0px',
            boxShadow: '0 0 8px 2px rgba(239, 68, 68, 0.8)',
            borderRadius: '2px'
          }}
        >
          <div ref={playheadLabelRef} className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-red-400 font-mono bg-gray-900 px-1 rounded whitespace-nowrap">
            0.0s
          </div>
        </div>

        {/* Multi-track area */}
        <div className="absolute left-0 top-0" style={{ width: `${timelineWidth}px` }}>
          {/* Render each track */}
          {Object.values(tracks)
            .sort((a, b) => a.order - b.order)
            .map((track, index) => {
              // Get track items for this specific track
              const itemsForThisTrack = Object.values(trackItems).filter(item => item.trackId === track.id)
              
              // Calculate track position based on previous track heights
              let trackTop = 0
              for (let i = 0; i < index; i++) {
                const prevTrack = Object.values(tracks).sort((a, b) => a.order - b.order)[i]
                trackTop += prevTrack.height || 80
              }
              
              const isHovered = hoveredTrackIndex === index
              const trackHeight = track.height || 80
              
              return (
                <div
                  key={track.id}
                  className={`relative border-b border-gray-700 ${isHovered ? 'bg-blue-900 bg-opacity-20' : ''} ${!track.visible ? 'opacity-50' : ''}`}
                  style={{
                    top: `${trackTop}px`,
                    width: `${timelineWidth}px`,
                    height: `${trackHeight}px`
                  }}
                >
                  {/* Track label */}
                  <div className={`absolute left-0 top-0 w-32 h-full border-r border-gray-700 flex items-center px-2 z-10 ${isHovered ? 'bg-blue-800' : 'bg-gray-800'}`}>
                    <div className="flex items-center gap-1 w-full">
                      <button
                        onClick={() => toggleTrackVisibility(track.id)}
                        className={`text-xs ${track.visible ? 'text-green-400' : 'text-gray-500'}`}
                        title={track.visible ? 'Hide track' : 'Show track'}
                      >
                        {track.visible ? '👁' : '👁‍🗨'}
                      </button>
                      <span className={`text-xs truncate flex-1 ${isHovered ? 'text-blue-200' : 'text-gray-300'}`}>
                        {isHovered ? `Drop on ${track.name}` : track.name}
                      </span>
                    </div>
                  </div>
                  
                  {/* Track items - only render visible ones */}
                  {itemsForThisTrack.filter(item => visibleItems.includes(item)).map((item) => {
                    const clip = useStore.getState().clips[item.clipId]
                    const itemDuration = (item.outSec - item.inSec) || 10
                    const itemWidth = itemDuration * pixelsPerSecond
                    
                    return (
                      <div
                        key={item.id}
                        className={`group absolute bg-purple-600 border-2 border-purple-400 cursor-pointer hover:bg-purple-500 hover:border-purple-300 transition-all shadow-lg z-20 ${trimFeedback?.itemId === item.id ? 'ring-2 ring-blue-400' : ''}`}
                        style={{
                          left: `${item.trackPosition * pixelsPerSecond}px`,
                          width: `${itemWidth}px`,
                          height: `${trackHeight - 10}px`,
                          top: '5px',
                        }}
                        onClick={() => handleClick(item.id)}
                        draggable
                        onDragStart={(e) => handleTrackItemDragStart(e, item.id)}
                        onDoubleClick={() => handleDoubleClick(item.id)}
                      >
                        <div className="p-2 text-white text-xs truncate">
                          {clip?.name || 'TrackItem'}
                        </div>
                        {/* Visual overlay when trimming */}
                        {trimFeedback?.itemId === item.id && (
                          <div className={`absolute inset-0 border-2 ${
                            trimFeedback.isConstrained 
                              ? 'bg-red-500/20 border-red-400' 
                              : 'bg-blue-500/20 border-blue-400'
                          }`} />
                        )}
                        {/* Trim handles */}
                        <div
                          className="absolute left-0 top-0 h-full cursor-ew-resize opacity-80 group-hover:opacity-100"
                          onMouseDown={(e) => beginResize(e, item.id, 'left')}
                          draggable={false}
                          title="Trim start"
                          style={{ width: '10px', background: 'rgba(14, 165, 233, 0.25)', borderRight: '2px solid rgba(255,255,255,0.9)', zIndex: 1000 }}
                        />
                        <div
                          className="absolute top-0 h-full cursor-ew-resize opacity-80 group-hover:opacity-100"
                          onMouseDown={(e) => beginResize(e, item.id, 'right')}
                          draggable={false}
                          title="Trim end"
                          style={{ left: 'calc(100% - 12px)', width: '12px', background: 'rgba(14, 165, 233, 0.28)', borderLeft: '2px solid rgba(255,255,255,0.95)', zIndex: 1000, pointerEvents: 'auto' }}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
        </div>

        {/* Empty state */}
        {visibleItems.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-lg">Drag clips from Media Library here</p>
          </div>
        )}
        
        {/* Trim feedback tooltip */}
        {trimFeedback && (
          <div className={`fixed pointer-events-none z-[9999] text-xs px-2 py-1 rounded shadow-lg ${
            trimFeedback.isConstrained 
              ? 'bg-red-900/90 text-red-200 border-red-400' 
              : 'bg-black/90 text-white border-blue-400'
          } border`}>
            <div className={`font-bold ${trimFeedback.isConstrained ? 'text-red-400' : 'text-blue-400'}`}>
              {trimFeedback.isConstrained ? '⚠ Constraint Hit' : 'Trim Info'}
            </div>
            <div>In: {trimFeedback.inSec.toFixed(2)}s</div>
            <div>Out: {trimFeedback.outSec.toFixed(2)}s</div>
            <div>Duration: {trimFeedback.duration.toFixed(2)}s</div>
            {trimFeedback.isConstrained && (
              <div className="text-xs mt-1 text-orange-300">Min: {MIN_SEGMENT_SEC}s</div>
            )}
          </div>
        )}
        </div>
      </div>
    </section>
  )
}

