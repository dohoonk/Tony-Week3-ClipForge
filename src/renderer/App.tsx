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
      <main className="flex flex-1 overflow-hidden">
        <MediaLibrary />
        <div className="flex-1 flex flex-col">
          <Player />
          <Timeline />
        </div>
        <ExportPanel />
      </main>
    </div>
  )
}

export default App

