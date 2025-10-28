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

  // Get the currently playing clip path and duration
  const getCurrentVideoInfo = () => {
    // TODO: Get from selected track item
    const availableClips = Object.values(clips).filter(clip => {
      // Skip mock recordings that don't exist yet
      if (clip.duration === 0 && clip.path.includes('/recordings/')) {
        return false
      }
      return true
    })
    
    const firstClip = availableClips[0]
    if (firstClip) {
      return {
        path: firstClip.path,
        duration: firstClip.duration
      }
    }
    return { path: undefined, duration: 0 }
  }

  const { path: currentVideoPath, duration: currentVideoDuration } = getCurrentVideoInfo()
  
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
      
      // Handle Chrome's MediaRecorder duration bug for WebM files
      if (video.duration === Infinity) {
        console.log('[Player] Duration is Infinity, applying Chrome MediaRecorder workaround')
        try {
          // Set currentTime to a large but finite value to force duration calculation
          video.currentTime = 1e6  // 1 million seconds (about 11.5 days)
          video.addEventListener('timeupdate', () => {
            console.log('[Player] After workaround, duration:', video.duration)
            video.currentTime = 0
            
            // Update clip duration if this is a recording
            if (videoSrc && videoSrc.includes('/recordings/')) {
              const clips = useStore.getState().clips
              const currentClip = Object.values(clips).find(clip => clip.path === videoSrc.replace('file://', ''))
              if (currentClip && video.duration && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
                console.log('[Player] Updating clip duration with actual video duration:', video.duration)
                useStore.getState().updateClipDuration(currentClip.id, video.duration)
              }
            }
          }, { once: true })
        } catch (error) {
          console.error('[Player] Failed to apply duration workaround:', error)
          // Fallback: try with a smaller value
          try {
            video.currentTime = 100000  // 100,000 seconds (about 27 hours)
            video.addEventListener('timeupdate', () => {
              console.log('[Player] After fallback workaround, duration:', video.duration)
              video.currentTime = 0
              
              // Update clip duration if this is a recording
              if (videoSrc && videoSrc.includes('/recordings/')) {
                const clips = useStore.getState().clips
                const currentClip = Object.values(clips).find(clip => clip.path === videoSrc.replace('file://', ''))
                if (currentClip && video.duration && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
                  console.log('[Player] Updating clip duration with actual video duration:', video.duration)
                  useStore.getState().updateClipDuration(currentClip.id, video.duration)
                }
              }
            }, { once: true })
          } catch (fallbackError) {
            console.error('[Player] Fallback workaround also failed:', fallbackError)
          }
        }
      } else {
        // Normal case - duration is available
        if (videoSrc && videoSrc.includes('/recordings/')) {
          const clips = useStore.getState().clips
          const currentClip = Object.values(clips).find(clip => clip.path === videoSrc.replace('file://', ''))
          if (currentClip && video.duration && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
            console.log('[Player] Updating clip duration with actual video duration:', video.duration)
            useStore.getState().updateClipDuration(currentClip.id, video.duration)
          }
        }
      }
    }

    video.addEventListener('error', handleError)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    
    return () => {
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [videoSrc])

  // Listen for recording completion with deduplication
  useEffect(() => {
    let isMounted = true
    const processedPaths = new Set<string>()
    
    const handleRecordingComplete = async (path: string, metadata: any) => {
      if (!isMounted) return
      
      console.log('[Player] Recording completed:', path, metadata)
      
      // Check if we've already processed this path
      if (processedPaths.has(path)) {
        console.log('[Player] This recording already processed, skipping:', path)
        return
      }
      
      processedPaths.add(path)
      setIsRecording(false)
      
      try {
        // Double-check in store to prevent duplicates
        const existingClips = useStore.getState().clips
        const isDuplicate = Object.values(existingClips).some(clip => clip.path === path)
        
        if (isDuplicate) {
          console.log('[Player] Clip already in library, skipping')
          return
        }
        
        // Try to probe the recorded file for full metadata
        let fullMetadata = metadata
        
        try {
          // Attempt to probe the actual file
          const probedData = await window.clipforge.probe(path)
          fullMetadata = probedData
          console.log('[Player] Successfully probed recorded file')
        } catch (probeError) {
          // If probe fails (mock recording or file doesn't exist yet),
          // use the metadata from the completion event
          console.warn('[Player] Probe failed, using event metadata:', probeError)
        }
        
        const fileName = path.split('/').pop() || `recording_${Date.now()}.webm`
        
        // Create clip object with fallback values
        // For WebM recordings, we'll update the duration after the video loads
        const clip = {
          id: `clip-${Date.now()}-${Math.random()}`,
          name: fileName,
          path: path,
          duration: metadata.duration || fullMetadata.duration || 0, // Temporary duration
          width: fullMetadata.width || metadata.width || 1920,
          height: fullMetadata.height || metadata.height || 1080,
        }
        
        // Add to media library
        useStore.getState().addClip(clip)
        console.log('[Player] Auto-added recorded clip to library:', clip.name)
      } catch (error) {
        console.error('[Player] Failed to add recorded clip:', error)
      }
    }

    window.clipforge.onRecordingComplete(handleRecordingComplete)
    
    return () => {
      isMounted = false
      processedPaths.clear()
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
    let frameCount = 0
    let debugStartTime = Date.now()
    const throttleMs = 33 // ~30fps

    const handleTimeUpdate = () => {
      const now = Date.now()
      if (now - lastUpdate >= throttleMs) {
        useStore.getState().setPlayheadSec(video.currentTime)
        lastUpdate = now
        frameCount++
        
        // Debug: log FPS every second
        if (frameCount % 30 === 0) {
          const elapsed = (Date.now() - debugStartTime) / 1000
          const fps = frameCount / elapsed
          console.log(`[Player] Playhead updates: ~${fps.toFixed(1)} fps (target: 30fps)`)
        }
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
          {isNaN(playheadSec || 0) ? '0.0' : (playheadSec || 0).toFixed(1)}s / {currentVideoDuration > 0 && !isNaN(currentVideoDuration) && isFinite(currentVideoDuration) ? currentVideoDuration.toFixed(1) + 's' : '0.0s'}
        </div>
      </div>
    </div>
  )
}

