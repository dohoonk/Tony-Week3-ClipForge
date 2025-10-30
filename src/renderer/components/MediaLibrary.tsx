import React, { useState } from 'react'
import { useStore } from '../store'
import { Clip } from '@shared/types'

export function MediaLibrary() {
  const { clips, addClip, removeClip, trackItems } = useStore()
  const [isImporting, setIsImporting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const { setSelectedId, selectedId } = useStore()


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

  // Validate file type
  const isValidVideoFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return ext === 'mp4' || ext === 'mov' || ext === 'webm'
  }

  // Process files (shared logic for both import button and drag-drop)
  // Accepts either string[] (legacy) or Array<{path, hash}> (new format)
  const processFiles = async (fileData: string[] | Array<{ path: string; hash?: string }>) => {
    try {
      setIsImporting(true)
      console.log('[MediaLibrary] Processing files:', fileData)

      // Normalize input: convert string[] to {path, hash}[] format
      const files = fileData.map(item => 
        typeof item === 'string' 
          ? { path: item, hash: undefined }
          : item
      )

      // Filter to only valid video files
      const validFiles = files.filter(file => {
        const fileName = file.path.split('/').pop() || ''
        if (!isValidVideoFile(fileName)) {
          console.warn('[MediaLibrary] Skipping invalid file:', fileName)
          return false
        }
        return true
      })

      if (validFiles.length === 0) {
        console.warn('[MediaLibrary] No valid video files to import')
        return
      }

      // Process each file
      for (const file of validFiles) {
        try {
          const filePath = file.path
          const fileHash = file.hash
          
          // Get video metadata
          const metadata = await window.clipforge.probe(filePath)
          
          // Extract filename
          const fileName = filePath.split('/').pop() || 'Unknown'
          
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
            hash: fileHash, // Include hash if available (from ingest)
          }
          
          // Add to store
          addClip(clip)
          
          console.log('[MediaLibrary] Added clip:', clip)
        } catch (error) {
          console.error('[MediaLibrary] Failed to process file:', file.path, error)
        }
      }
    } catch (error) {
      console.error('[MediaLibrary] Import failed:', error)
    } finally {
      setIsImporting(false)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    // Get dropped files
    const files = Array.from(e.dataTransfer.files)
    
    if (files.length === 0) {
      console.warn('[MediaLibrary] No files found in drop event')
      return
    }

    // Process files: read as ArrayBuffer, send via IPC, then process
    const savedFiles: Array<{ path: string; hash: string }> = []
    
    for (const file of files) {
      // Validate file type first
      if (!isValidVideoFile(file.name)) {
        console.warn('[MediaLibrary] Skipping invalid file type:', file.name)
        continue
      }

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        // Send to main process to save
        const savedFile = await window.clipforge.saveDroppedFile(uint8Array, file.name)
        savedFiles.push({ path: savedFile.path, hash: savedFile.hash })
        console.log('[MediaLibrary] Saved dropped file:', savedFile.path, 'hash:', savedFile.hash)
      } catch (error) {
        console.error('[MediaLibrary] Failed to save dropped file:', file.name, error)
      }
    }

    if (savedFiles.length > 0) {
      await processFiles(savedFiles)
    } else {
      console.warn('[MediaLibrary] No valid files processed from drop')
    }
  }

  // Update handleImportFiles to use shared processFiles function
  const handleImportFiles = async () => {
    try {
      // Open file dialog
      const filePaths = await window.clipforge.openFiles()
      if (filePaths.length === 0) return
      
      await processFiles(filePaths)
    } catch (error) {
      console.error('[MediaLibrary] Import failed:', error)
    }
  }

  const clipList = Object.values(clips)

  return (
    <aside 
      className={`w-64 h-full border-r border-gray-700 bg-gray-900 flex flex-col transition-all duration-200 ${
        isDragOver ? 'bg-blue-900/20 border-blue-500' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Media Library</h2>
          <button
            onClick={handleImportFiles}
            disabled={isImporting}
            className="btn btn-primary btn-sm"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Import Progress Indicator */}
      {isImporting && (
        <div className="px-4 py-2 bg-blue-900/50 border-b border-blue-700 text-sm text-blue-200">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            <span>Importing video files...</span>
          </div>
        </div>
      )}

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {clipList.length === 0 ? (
          <div className={`p-4 bg-gray-800 rounded border-2 border-dashed text-center transition-colors ${
            isDragOver ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700'
          }`}>
            <div className="aspect-video bg-gray-700 rounded mb-2"></div>
            <p className="text-sm text-gray-400">
              {isDragOver ? 'Drop video files here' : 'Drag & drop or click "Import" to add video clips'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Supports MP4, MOV, WebM</p>
          </div>
        ) : (
          clipList.map((clip) => (
            <div
              key={clip.id}
              className="card card-interactive p-3 group relative"
              draggable
              onDragStart={(e) => {
                handleDragStart(e, clip.id)
                e.stopPropagation() // Prevent triggering media library drop
              }}
              onDragOver={(e) => e.stopPropagation()} // Prevent triggering media library drop
              onDrop={(e) => e.stopPropagation()} // Prevent triggering media library drop
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
                {/* Delete button on thumbnail */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteClip(clip.id)
                  }}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full w-7 h-7 flex items-center justify-center transition-all duration-200 text-sm z-10 shadow-lg hover:scale-110"
                  title="Delete clip"
                >
                  ×
                </button>
              </div>
              
              {/* Clip info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white font-medium truncate flex-1" title={clip.name}>
                    {clip.name}
                  </p>
                </div>
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

