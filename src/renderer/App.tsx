import React, { useState, useRef, useEffect } from 'react'
import { MediaLibrary } from './components/MediaLibrary'
import { Timeline } from './components/Timeline'
import { Player } from './components/Player'
import { UnifiedToolsPanel } from './components/UnifiedToolsPanel'
import { SettingsDialog } from './components/SettingsDialog'

function App() {
  const [timelineHeight, setTimelineHeight] = useState(33) // Percentage of available height
  const [panelWidth, setPanelWidth] = useState(300) // Fixed width in pixels for tools panel (default 300px)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)

  // Vertical resizing (between player and timeline)
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

  // Horizontal resizing (between main content and tools panel)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingPanel || !mainContainerRef.current) return
      
      const container = mainContainerRef.current
      const rect = container.getBoundingClientRect()
      const totalWidth = rect.width
      const mouseX = e.clientX - rect.left
      
      // Calculate panel width from right edge
      const newPanelWidth = totalWidth - mouseX
      
      // Constrain panel width between 200px and 600px
      const constrainedWidth = Math.max(200, Math.min(600, newPanelWidth))
      setPanelWidth(constrainedWidth)
    }

    const handleMouseUp = () => {
      setIsResizingPanel(false)
    }

    if (isResizingPanel) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizingPanel])

  const playerHeight = 100 - timelineHeight

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
               <h1 className="text-2xl font-bold text-white">InterviewMate</h1>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Settings"
          aria-label="Open Settings"
        >
          ⚙️
        </button>
      </header>
      <main 
        ref={mainContainerRef}
        className="flex flex-1 overflow-hidden px-4" 
        style={{ minHeight: 0 }}
      >
        <MediaLibrary />
        <div 
          ref={containerRef}
          className="flex-1 flex flex-col relative" 
          style={{ 
            minWidth: 0
          }}
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
          
          {/* Vertical Resizable divider (Player/Timeline) */}
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

        {/* Horizontal Resizable divider (Main Content/Tools Panel) */}
        <div
          className="relative cursor-ew-resize bg-gray-700 hover:bg-gray-600 transition-colors z-10 flex-shrink-0"
          style={{ width: '4px' }}
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizingPanel(true)
          }}
          title="Drag to resize tools panel"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-0.5 bg-gray-500 rounded" />
          </div>
        </div>

        <UnifiedToolsPanel style={{ width: `${panelWidth}px`, flexShrink: 0 }} />
      </main>
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
}

export default App

