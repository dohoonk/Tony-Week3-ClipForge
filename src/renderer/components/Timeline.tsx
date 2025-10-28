import React, { useState, useRef } from 'react'
import { useStore } from '../store'

const PIXELS_PER_SECOND = 50 // 1x zoom
const TRACK_HEIGHT = 80
const PLAYHEAD_HEIGHT = TRACK_HEIGHT

export function Timeline() {
  const { trackItems, addTrackItem, setPlayheadSec, playheadSec } = useStore()
  const [dragOver, setDragOver] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    e.dataTransfer.setData('clipId', clipId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const clipId = e.dataTransfer.getData('clipId')
    if (!clipId) return

    // Get mouse position relative to timeline
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const dropTime = mouseX / PIXELS_PER_SECOND

    console.log('[Timeline] Drop at:', dropTime, 'seconds')

    // Create new track item
    const trackItem = {
      id: `trackitem-${Date.now()}`,
      clipId,
      inSec: 0, // TODO: get from UI trim controls
      outSec: 0, // TODO: get from clip.duration
      trackPosition: dropTime,
    }

    addTrackItem(trackItem)
  }

  const handleClick = (trackItemId: string) => {
    console.log('[Timeline] Clicked track item:', trackItemId)
    // TODO: Implement selection
  }

  const handleDoubleClick = (trackItemId: string) => {
    console.log('[Timeline] Double clicked track item:', trackItemId)
    // TODO: Implement split at cursor
  }

  const handlePlayheadClick = (e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const mouseX = e.clientX - rect.left
    const clickTime = mouseX / PIXELS_PER_SECOND
    
    console.log('[Timeline] Playhead click at:', clickTime, 'seconds')
    setPlayheadSec(clickTime)
  }

  // Convert track items to array and sort by position
  const sortedItems = Object.values(trackItems).sort((a, b) => 
    a.trackPosition - b.trackPosition
  )

  return (
    <section className="flex-1 flex flex-col border-r border-gray-700 bg-gray-900">
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
          <div className="text-sm text-gray-400">
            Playhead: {Math.floor(playheadSec)}s | Items: {sortedItems.length}
          </div>
        </div>
      </div>
      
      <div 
        ref={timelineRef}
        className="flex-1 relative bg-gray-900 overflow-hidden"
        onDragOver={handleDragOver}
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

        {/* Track area */}
        <div className="absolute left-0 top-0 w-full" style={{ height: TRACK_HEIGHT }}>
          {/* Playhead indicator */}
          <div 
            className="absolute w-0.5 bg-blue-500 z-10 transition-all"
            style={{ 
              left: `${playheadSec * PIXELS_PER_SECOND}px`,
              height: `${PLAYHEAD_HEIGHT}px`,
            }}
          >
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-blue-500"></div>
          </div>

          {/* Track items */}
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="absolute bg-purple-600 border border-purple-400 cursor-pointer hover:bg-purple-500 transition-colors"
              style={{
                left: `${item.trackPosition * PIXELS_PER_SECOND}px`,
                width: `${10 * PIXELS_PER_SECOND}px`, // Default 10 seconds width
                height: `${TRACK_HEIGHT - 10}px`,
                top: '5px',
              }}
              onClick={() => handleClick(item.id)}
              onDoubleClick={() => handleDoubleClick(item.id)}
            >
              <div className="p-2 text-white text-xs truncate">
                TrackItem
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {sortedItems.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-lg">Drag clips from Media Library here</p>
          </div>
        )}
      </div>
    </section>
  )
}

