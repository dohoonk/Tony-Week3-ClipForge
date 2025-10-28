import React from 'react'

export function Timeline() {
  return (
    <section className="flex-1 flex flex-col border-r border-gray-700 bg-gray-900">
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <h2 className="text-lg font-semibold text-white">Timeline</h2>
      </div>
      <div className="flex-1 relative bg-gray-900">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500">Drag clips from Media Library here</p>
        </div>
      </div>
    </section>
  )
}

