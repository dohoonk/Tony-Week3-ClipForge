import React, { useRef, useEffect, useState } from 'react'
import { useStore } from '../store'

export function Player() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const store = useStore()
  const clips = store.clips
  const trackItems = store.trackItems
  const playheadSec = store.ui.playheadSec
  const isPlaying = store.ui.isPlaying
  const [loopEnabled, setLoopEnabled] = useState(false)

  // Get the currently playing clip path
  const getCurrentVideoPath = () => {
    // TODO: Get from selected track item
    const firstClip = Object.values(clips)[0]
    if (firstClip) {
      // Electron can handle local file paths directly
      // No need for file:// protocol prefix
      return firstClip.path
    }
    return undefined
  }

  const currentVideoPath = getCurrentVideoPath()
  
  // Convert absolute path to file:// URL for HTML5 video
  const videoSrc = currentVideoPath ? `file://${currentVideoPath}` : undefined

  useEffect(() => {
    // Log video source for debugging
    console.log('[Player] Video source:', videoSrc)
  }, [videoSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleError = (e: any) => {
      console.error('[Player] Video error:', e)
      console.error('[Player] Video src:', video.src)
    }

    const handleLoadedMetadata = () => {
      console.log('[Player] Video metadata loaded, duration:', video.duration)
    }

    video.addEventListener('error', handleError)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    
    return () => {
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [videoSrc])

  const handlePlay = () => {
    videoRef.current?.play()
  }

  const handlePause = () => {
    videoRef.current?.pause()
  }

  const handleToggleLoop = () => {
    setLoopEnabled(!loopEnabled)
    if (videoRef.current) {
      videoRef.current.loop = !loopEnabled
    }
  }

  // Sync playhead with video timeupdate
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      useStore.getState().setPlayheadSec(video.currentTime)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [])

  // Sync playhead dragging to video (when user clicks timeline)
  useEffect(() => {
    const video = videoRef.current
    if (!video || Math.abs(video.currentTime - playheadSec) < 0.5) {
      return // Avoid feedback loop
    }
    video.currentTime = playheadSec
  }, [playheadSec])

  // Handle play/pause from store
  useEffect(() => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }, [isPlaying])

  return (
    <div className="flex-1 flex flex-col bg-gray-900 border-b border-gray-700">
      {/* Video Player */}
      <div className="flex-1 relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden" style={{ height: '100%', width: '100%' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          src={videoSrc}
          controls={false} // We'll add custom controls
          loop={loopEnabled}
          preload="metadata"
        />
        
        {!videoSrc && (
          <p className="text-gray-500">Import a clip to preview</p>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePlay}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
          >
            ▶ Play
          </button>
          <button
            onClick={handlePause}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium"
          >
            ⏸ Pause
          </button>
          <button
            onClick={handleToggleLoop}
            className={`px-6 py-2 rounded font-medium ${
              loopEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            🔁 Loop
          </button>
        </div>
        
        {/* Time Display */}
        <div className="mt-3 text-center text-sm text-gray-400">
          {(playheadSec || 0).toFixed(1)}s / {currentVideoPath ? '78.5s' : '0.0s'}
        </div>
      </div>
    </div>
  )
}

