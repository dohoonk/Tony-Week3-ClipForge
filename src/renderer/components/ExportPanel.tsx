import React from 'react'

export function ExportPanel() {
  return (
    <aside className="w-64 h-full border-r border-gray-700 p-4">
      <h2 className="text-lg font-semibold mb-4 text-white">Export Panel</h2>
      <div className="space-y-2">
        <p className="text-sm text-gray-400">
          Configure your export settings here
        </p>
        <button className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium">
          Export Video
        </button>
      </div>
    </aside>
  )
}

