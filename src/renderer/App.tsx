import React, { useState, useRef, useEffect } from 'react'
import { MediaLibrary } from './components/MediaLibrary'
import { Timeline } from './components/Timeline'
import { Player } from './components/Player'
import { ExportPanel } from './components/ExportPanel'
import { TranscriptionTestPanel } from './components/TranscriptionTestPanel'

function App() {
  const [timelineHeight, setTimelineHeight] = useState(33) // Percentage of available height
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return
      
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const totalHeight = rect.height
      const mouseY = e.clientY - rect.top
      const newTimelineHeight = (1 - mouseY / totalHeight) * 100
      
      // Constrain timeline height between 20% and 80%
      const constrainedHeight = Math.max(20, Math.min(80, newTimelineHeight))
      setTimelineHeight(constrainedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing])

  const playerHeight = 100 - timelineHeight

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-700 bg-gray-800">
        <h1 className="text-2xl font-bold text-white">ClipForge</h1>
      </header>
      <main className="flex flex-1 overflow-hidden px-4" style={{ minHeight: 0 }}>
        <MediaLibrary />
        <div 
          ref={containerRef}
          className="flex-1 flex flex-col relative" 
          style={{ minWidth: 0 }}
        >
          <div 
            style={{ 
              height: `${playerHeight}%`,
              minHeight: 0,
              maxHeight: `${playerHeight}%`
            }}
          >
            <Player />
          </div>
          
          {/* Resizable divider */}
          <div
            className="relative cursor-ns-resize bg-gray-700 hover:bg-gray-600 transition-colors z-10 flex-shrink-0"
            style={{ height: '4px' }}
            onMouseDown={(e) => {
              e.preventDefault()
              setIsResizing(true)
            }}
            title="Drag to resize timeline"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-0.5 bg-gray-500 rounded" />
            </div>
          </div>
          
          <div 
            style={{ 
              height: `${timelineHeight}%`,
              minHeight: 0,
              maxHeight: `${timelineHeight}%`,
              overflow: 'auto'
            }}
          >
            <Timeline />
          </div>
        </div>
        <ExportPanel />
        <TranscriptionTestPanel />
      </main>
    </div>
  )
}

export default App

