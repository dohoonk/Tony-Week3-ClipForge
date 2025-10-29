import React, { useState, useRef, useMemo, useEffect } from 'react'
import { useStore } from '../store'

const BASE_PIXELS_PER_SEC = 50 // 1x zoom
const TRACK_HEIGHT = 80
const PLAYHEAD_HEIGHT = TRACK_HEIGHT
const MIN_ZOOM = 0.5
const MAX_ZOOM = 10
const MIN_TRACK_HEIGHT = 60
const MAX_TRACK_HEIGHT = 120

export function Timeline() {
  const store = useStore()
  const { trackItems, tracks, addTrackItem, addTrack, removeTrack, setPlayheadSec, setIsPlaying, setTrackHeight, toggleTrackVisibility } = store
  const playheadSec = store.ui.playheadSec
  const isPlaying = store.ui.isPlaying
  const zoom = store.ui.zoom
  const setZoom = store.setZoom
  
  const [dragOver, setDragOver] = useState(false)
  const [hoveredTrackIndex, setHoveredTrackIndex] = useState<number | null>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate pixels per second based on zoom
  const pixelsPerSecond = BASE_PIXELS_PER_SEC * (zoom || 1)

  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    e.dataTransfer.setData('clipId', clipId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleTrackItemDragStart = (e: React.DragEvent, trackItemId: string) => {
    e.dataTransfer.setData('trackItemId', trackItemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
    
        // Calculate which track is being hovered
        const rect = timelineRef.current?.getBoundingClientRect()
        if (rect) {
          const mouseY = e.clientY - rect.top
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
          setHoveredTrackIndex(clampedIndex)
        }
  }

  const handleDragLeave = () => {
    setDragOver(false)
    setHoveredTrackIndex(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    setHoveredTrackIndex(null)

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
    const dropTime = (mouseX / pixelsPerSecond) + (scrollLeft / pixelsPerSecond)

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

    // Get clip from store to use actual duration
    const clip = store.clips[clipId]
    const clipDuration = clip?.duration || 10 // fallback to 10 if no duration
    
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
    const dropTime = (mouseX / pixelsPerSecond) + (scrollLeft / pixelsPerSecond)

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
    const existingItem = store.trackItems[trackItemId]
    if (existingItem) {
      const updatedItem = {
        ...existingItem,
        trackId: targetTrack.id,
        trackPosition: dropTime
      }
      
      // Remove old item and add updated one
      store.removeTrackItem(trackItemId)
      store.addTrackItem(updatedItem)
      
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
      const project = {
        ...store.project,
        clips: store.clips,
        tracks: store.tracks,
        trackItems: store.trackItems
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
        Object.keys(store.tracks).forEach(trackId => store.removeTrack(trackId))
        // Remove any remaining track items (shouldn't be any after removing tracks)
        Object.keys(store.trackItems).forEach(itemId => store.removeTrackItem(itemId))
        // Remove clips
        Object.keys(store.clips).forEach(clipId => store.removeClip(clipId))
        
        // Add loaded clips
        Object.values(project.clips || {}).forEach((clip: any) => {
          store.addClip(clip)
        })
        
        // Add loaded tracks
        console.log('[Timeline] Adding tracks:', project.tracks)
        const loadedTracks = Object.values(project.tracks || {})
        if (loadedTracks.length > 0) {
          loadedTracks.forEach((track: any) => {
            console.log('[Timeline] Adding track:', track)
            store.addTrack(track)
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
          store.addTrack(defaultTrack)
        }
        
        // Add loaded track items
        console.log('[Timeline] Adding track items:', project.trackItems)
        Object.values(project.trackItems || {}).forEach((item: any) => {
          console.log('[Timeline] Adding track item:', item)
          store.addTrackItem(item)
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
    setIsPlaying(!isPlaying)
  }

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value)
    // Center scroll position on zoom change
    const currentCenter = scrollLeft + (timelineRef.current?.clientWidth || 0) / 2
    const prevPixelsPerSec = pixelsPerSecond
    const newPixelsPerSec = BASE_PIXELS_PER_SEC * newZoom
    
    setZoom(newZoom)
    
    // Maintain center position
    setTimeout(() => {
      if (timelineRef.current && scrollContainerRef.current) {
        const newScrollLeft = currentCenter - (timelineRef.current.clientWidth / 2)
        scrollContainerRef.current.scrollLeft = newScrollLeft
        setScrollLeft(newScrollLeft)
      }
    }, 0)
  }

  // Convert track items to array and sort by position
  const sortedItems = Object.values(trackItems).sort((a, b) => 
    a.trackPosition - b.trackPosition
  )

  // Calculate timeline width based on track items and clip durations
  const calculateTimelineWidth = () => {
    if (sortedItems.length === 0) {
      // Default to 60 seconds if no items
      return Math.max(60 * pixelsPerSecond, scrollContainerRef.current?.clientWidth || 800)
    }

    // Find the rightmost edge of all track items
    let maxTime = 0
    for (const item of sortedItems) {
      const clip = store.clips[item.clipId]
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

  // Auto-scroll timeline when playhead approaches the right edge
  useEffect(() => {
    if (!scrollContainerRef.current || !isPlaying) return
    
    const containerWidth = scrollContainerRef.current.clientWidth
    const playheadPosition = (playheadSec || 0) * pixelsPerSecond
    const scrollPosition = scrollContainerRef.current.scrollLeft
    const visibleRight = scrollPosition + containerWidth
    
    // Scroll when playhead is within 20% of the right edge
    const scrollMargin = containerWidth * 0.2
    
    if (playheadPosition + scrollMargin > visibleRight) {
      const newScrollLeft = playheadPosition - containerWidth + scrollMargin + scrollMargin
      scrollContainerRef.current.scrollLeft = newScrollLeft
      setScrollLeft(newScrollLeft)
    }
  }, [playheadSec, isPlaying, pixelsPerSecond])

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
            <div className="text-sm text-gray-400">
              Playhead: {Math.floor(playheadSec)}s | Items: {sortedItems.length}
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
                        onClick={() => store.moveTrackUp(track.id)}
                        className="text-gray-300 hover:text-white text-xs"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => store.moveTrackDown(track.id)}
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
        onScroll={(e) => {
          // Throttle scroll events to reduce state updates
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current)
          }
          scrollTimeoutRef.current = setTimeout(() => {
            setScrollLeft(e.currentTarget.scrollLeft)
          }, 16) // ~60fps update rate
        }}
      >
            <div 
              ref={timelineRef}
              className="relative bg-gray-900"
              style={{ 
                width: `${timelineWidth}px`, 
                minHeight: `${Math.max(Object.values(tracks).reduce((total, track) => total + (track.height || 80), 0), 400)}px`
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
          <div className="absolute inset-0 bg-blue-900 bg-opacity-20 border-2 border-blue-500 border-dashed pointer-events-none">
            <p className="absolute inset-0 flex items-center justify-center text-blue-400 text-xl font-semibold">
              Drop clip here
            </p>
          </div>
        )}

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
                  
                  {/* Playhead indicator for this track */}
                  <div 
                    className="absolute bg-red-500 z-50 pointer-events-none"
                    style={{ 
                      left: `${((playheadSec || 0) * pixelsPerSecond) - 2}px`,
                      width: '4px',
                      height: `${trackHeight}px`,
                      top: '0px',
                      transition: 'none',
                      boxShadow: '0 0 4px 2px rgba(239, 68, 68, 0.5)',
                    }}
                  >
                    {/* Triangle at top */}
                    <div 
                      className="absolute -top-2 left-1/2 transform -translate-x-1/2"
                      style={{ 
                        width: '0', 
                        height: '0', 
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '10px solid #ef4444'
                      }}
                    ></div>
                    
                    {/* Debug label */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-red-500 font-bold whitespace-nowrap bg-gray-900 px-1">
                      {Math.floor(playheadSec)}s
                    </div>
                  </div>
                  
                  {/* Track items */}
                  {itemsForThisTrack.map((item) => {
                    const clip = store.clips[item.clipId]
                    const itemDuration = (item.outSec - item.inSec) || 10
                    const itemWidth = itemDuration * pixelsPerSecond
                    
                    return (
                          <div
                            key={item.id}
                            className="absolute bg-purple-600 border-2 border-purple-400 cursor-pointer hover:bg-purple-500 hover:border-purple-300 transition-all shadow-lg z-20"
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
                      </div>
                    )
                  })}
                </div>
              )
            })}
        </div>

        {/* Empty state */}
        {sortedItems.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-lg">Drag clips from Media Library here</p>
          </div>
        )}
        </div>
      </div>
    </section>
  )
}

