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
  const [isRecording, setIsRecording] = useState(false)
  const [recordingType, setRecordingType] = useState<'screen' | 'webcam'>('screen')

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

  // Listen for recording completion
  useEffect(() => {
    const handleRecordingComplete = (path: string, metadata: any) => {
      console.log('[Player] Recording completed:', path, metadata)
      // The clip will be auto-added to library by main process
      setIsRecording(false)
    }

    window.clipforge.onRecordingComplete(handleRecordingComplete)
    
    return () => {
      // Cleanup if needed
    }
  }, [])

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

  const handleStartRecording = async () => {
    try {
      setIsRecording(true)
      await window.clipforge.startRecording(recordingType)
      console.log('[Player] Recording started:', recordingType)
    } catch (error) {
      console.error('[Player] Failed to start recording:', error)
      setIsRecording(false)
    }
  }

  const handleStopRecording = async () => {
    try {
      await window.clipforge.stopRecording()
      console.log('[Player] Recording stopped')
      setIsRecording(false)
    } catch (error) {
      console.error('[Player] Failed to stop recording:', error)
      setIsRecording(false)
    }
  }

  // Sync playhead with video timeupdate (throttled to ~30fps)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let lastUpdate = 0
    const throttleMs = 33 // ~30fps

    const handleTimeUpdate = () => {
      const now = Date.now()
      if (now - lastUpdate >= throttleMs) {
        useStore.getState().setPlayheadSec(video.currentTime)
        lastUpdate = now
      }
    }

    // Use requestAnimationFrame for smooth animation
    let rafId: number
    const handleFrame = () => {
      handleTimeUpdate()
      rafId = requestAnimationFrame(handleFrame)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    rafId = requestAnimationFrame(handleFrame)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      cancelAnimationFrame(rafId)
    }
  }, [])

  // Sync playhead dragging to video (when user clicks timeline)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    // Throttle video position updates to avoid feedback loops
    const timeDifference = Math.abs(video.currentTime - playheadSec)
    
    // Only update if difference is significant (>0.1s) or if video is paused
    if (timeDifference > 0.1 || !isPlaying) {
      video.currentTime = playheadSec
    }
  }, [playheadSec, isPlaying, videoSrc])

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
    <div className="flex flex-col bg-gray-900 border-b border-gray-700" style={{ maxHeight: '300px' }}>
      {/* Video Player */}
      <div className="flex-1 relative bg-black flex items-center justify-center min-h-[200px] overflow-hidden" style={{ height: '280px', width: '100%' }}>
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
        
        {/* Recording Controls */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-700">
          <select
            value={recordingType}
            onChange={(e) => setRecordingType(e.target.value as 'screen' | 'webcam')}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            disabled={isRecording}
          >
            <option value="screen">Screen</option>
            <option value="webcam">Webcam</option>
          </select>
          
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium"
            >
              🔴 Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="px-6 py-2 bg-red-800 hover:bg-red-900 rounded text-white font-medium animate-pulse"
            >
              ⏹ Stop Recording
            </button>
          )}
        </div>
        
        {/* Time Display */}
        <div className="mt-3 text-center text-sm text-gray-400">
          {(playheadSec || 0).toFixed(1)}s / {currentVideoPath ? '78.5s' : '0.0s'}
        </div>
      </div>
    </div>
  )
}

