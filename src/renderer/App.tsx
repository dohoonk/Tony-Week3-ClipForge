import React from 'react'
import { MediaLibrary } from './components/MediaLibrary'
import { Timeline } from './components/Timeline'
import { Player } from './components/Player'
import { ExportPanel } from './components/ExportPanel'

function App() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-700 bg-gray-800">
        <h1 className="text-2xl font-bold text-white">ClipForge</h1>
      </header>
      <main className="flex flex-1 overflow-hidden px-4" style={{ minHeight: 0 }}>
        <MediaLibrary />
        <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          <div className="flex-[2]" style={{ minHeight: 0 }}>
            <Player />
          </div>
          <div className="flex-1" style={{ minHeight: 0, overflow: 'auto' }}>
            <Timeline />
          </div>
        </div>
        <ExportPanel />
      </main>
    </div>
  )
}

export default App

