import React, { useState } from 'react'
import { useStore } from '../store'
import { Clip } from '@shared/types'

export function MediaLibrary() {
  const { clips, addClip, removeClip, trackItems } = useStore()
  const [isImporting, setIsImporting] = useState(false)
  const { setSelectedId, selectedId } = useStore()

  const handleImportFiles = async () => {
    try {
      setIsImporting(true)
      
      // Open file dialog
      const filePaths = await window.clipforge.openFiles()
      if (filePaths.length === 0) return

      console.log('[MediaLibrary] Importing files:', filePaths)

      // Process each file
      for (const filePath of filePaths) {
        try {
          // Get video metadata
          const metadata = await window.clipforge.probe(filePath)
          
          // Extract filename
          const fileName = filePath.split('/').pop() || 'Unknown'
          const fileExt = fileName.split('.').pop() || ''
          
          // Generate thumbnail (don't block on errors)
          let thumbnailPath: string | undefined = undefined
          try {
            thumbnailPath = await window.clipforge.generateThumbnail(filePath)
            console.log('[MediaLibrary] Generated thumbnail:', thumbnailPath)
          } catch (thumbError) {
            console.warn('[MediaLibrary] Failed to generate thumbnail:', thumbError)
            // Continue without thumbnail
          }
          
          // Create clip object
          const clip: Clip = {
            id: `clip-${Date.now()}-${Math.random()}`,
            name: fileName,
            path: filePath,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            fileSize: metadata.fileSize,
            thumbnailPath,
          }
          
          // Add to store
          addClip(clip)
          
          console.log('[MediaLibrary] Added clip:', clip)
        } catch (error) {
          console.error('[MediaLibrary] Failed to process file:', filePath, error)
        }
      }
    } catch (error) {
      console.error('[MediaLibrary] Import failed:', error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleDeleteClip = async (clipId: string) => {
    // Check if clip is used in any trackItems
    const isUsed = Object.values(trackItems).some(item => item.clipId === clipId)
    
    if (isUsed) {
      const confirmed = window.confirm(
        'This clip is being used in the timeline. Are you sure you want to delete it?'
      )
      if (!confirmed) return
    }
    
    removeClip(clipId)
  }

  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    console.log('[MediaLibrary] Starting drag for clip:', clipId)
    e.dataTransfer.setData('clipId', clipId)
    e.dataTransfer.effectAllowed = 'copy'
    console.log('[MediaLibrary] Set dataTransfer clipId:', clipId)
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const formatResolution = (width: number, height: number): string => {
    return `${width}×${height}`
  }

  const clipList = Object.values(clips)

  return (
    <aside className="w-64 h-full border-r border-gray-700 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Media Library</h2>
          <button
            onClick={handleImportFiles}
            disabled={isImporting}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {clipList.length === 0 ? (
          <div className="p-4 bg-gray-800 rounded border border-gray-700 text-center">
            <div className="aspect-video bg-gray-700 rounded mb-2"></div>
            <p className="text-sm text-gray-400">Click "Import" to add video clips</p>
          </div>
        ) : (
          clipList.map((clip) => (
            <div
              key={clip.id}
              className="p-3 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors group cursor-move relative"
              draggable
              onDragStart={(e) => handleDragStart(e, clip.id)}
              title={`${clip.name}\nDuration: ${formatDuration(clip.duration)}\nResolution: ${formatResolution(clip.width, clip.height)}\n${clip.fileSize ? `Size: ${formatFileSize(clip.fileSize)}` : 'Size: Unknown'}\nPath: ${clip.path}`}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-700 rounded mb-2 relative overflow-hidden">
                {clip.thumbnailPath ? (
                  <img
                    src={`file://${clip.thumbnailPath}`}
                    alt={clip.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder if thumbnail fails to load
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                    Loading...
                  </div>
                )}
                {/* Delete button */}
                <button
                  onClick={() => handleDeleteClip(clip.id)}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs z-10"
                >
                  ×
                </button>
              </div>
              
              {/* Clip info */}
              <div className="space-y-1">
                <p className="text-sm text-white font-medium truncate" title={clip.name}>
                  {clip.name}
                </p>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">{formatDuration(clip.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resolution:</span>
                    <span className="font-medium">{formatResolution(clip.width, clip.height)}</span>
                  </div>
                  {clip.fileSize && (
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-medium">{formatFileSize(clip.fileSize)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

