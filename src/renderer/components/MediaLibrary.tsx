import React from 'react'

export function MediaLibrary() {
  return (
    <aside className="w-64 h-full border-r border-gray-700 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Media Library</h2>
        <button className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white">
          Import
        </button>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-gray-800 rounded border border-gray-700">
          <div className="aspect-video bg-gray-700 rounded mb-2"></div>
          <p className="text-sm text-gray-400">Click "Import Files" to add clips</p>
        </div>
      </div>
    </aside>
  )
}

