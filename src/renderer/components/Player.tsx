import React, { useRef, useEffect, useState } from 'react'
import { useStore } from '../store'

declare global {
  interface Window {
    // Preload-exposed API
    clipforge: any
  }
}

export function Player() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const store = useStore()
  const clips = store.clips
  const trackItems = store.trackItems
  const playheadSec = store.ui.playheadSec
  const isPlaying = store.ui.isPlaying
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingType, setRecordingType] = useState<'screen' | 'webcam' | 'pip'>('screen')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null)
  const [isStartingRecording, setIsStartingRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null)
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [webcamPreviewRef, setWebcamPreviewRef] = useState<HTMLVideoElement | null>(null)
  const [screenPreviewStream, setScreenPreviewStream] = useState<MediaStream | null>(null)
  const screenPreviewRef = useRef<HTMLVideoElement>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('')

  // Get the currently playing clip path and duration based on timeline only
  const getCurrentVideoInfo = () => {
    const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
    const t = playheadSec || 0
    for (const track of sortedTracks) {
      if (!track.visible) continue
      const items = Object.values(store.trackItems).filter(it => it.trackId === track.id)
      for (const item of items) {
        const clip = store.clips[item.clipId]
        if (!clip) continue
        const start = Number(item.trackPosition) || 0
        const clipDur = Math.max(0, Number(clip?.duration) || 0)
        const reqDur = Math.max(0, Number(item.outSec) - Number(item.inSec))
        const effDur = Math.min(reqDur || 0, clipDur || 0)
        const end = start + (isFinite(effDur) ? effDur : 0)
        if (t >= start && t <= end) {
          return { path: clip.path, duration: clip.duration }
        }
      }
    }
    return { path: undefined, duration: 0 }
  }

  // Get clip at current playhead position for timeline sequence playback
  const getClipAtPlayheadPosition = () => {
    const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
    const currentTime = playheadSec || 0
    
    // Find the first track with a clip at the current time
    for (const track of sortedTracks) {
      if (!track.visible) continue
      
      const trackItems = Object.values(store.trackItems).filter(item => item.trackId === track.id)
      
      for (const item of trackItems) {
        const clip = store.clips[item.clipId]
        if (!clip) continue

        const itemStart = Number(item.trackPosition) || 0
        const clipDuration = Math.max(0, Number(clip?.duration) || 0)
        const requestedDuration = Math.max(0, Number(item.outSec) - Number(item.inSec))
        const effectiveDuration = Math.min(requestedDuration || 0, clipDuration || 0)
        const itemEnd = itemStart + (isFinite(effectiveDuration) ? effectiveDuration : 0)
        
        // Check if playhead is within this clip
        if (currentTime >= itemStart && currentTime <= itemEnd) {
          return clip
        }
      }
    }
    
    return null
  }

  // Find the next clip in the timeline sequence
  const getNextClipInSequence = () => {
    const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
    const currentTime = playheadSec || 0
    
    // Collect all clips with their start times
    const allClips: Array<{ clip: any; trackItem: any; startTime: number }> = []
    
    for (const track of sortedTracks) {
      if (!track.visible) continue
      
      const trackItems = Object.values(store.trackItems).filter(item => item.trackId === track.id)
      
      for (const item of trackItems) {
        const clip = store.clips[item.clipId]
        if (!clip) continue
        
        allClips.push({
          clip,
          trackItem: item,
          startTime: item.trackPosition
        })
      }
    }
    
    // Sort by start time
    allClips.sort((a, b) => a.startTime - b.startTime)
    
    // Find the next clip after current time
    for (const clipData of allClips) {
      if (clipData.startTime > currentTime) {
        return clipData
      }
    }
    
    return null
  }

  // Handle automatic playhead advancement to next clip
  const handleVideoEnded = () => {
    if (!isPlaying) return
    
    console.log('[Player] Video ended, checking for next clip...')
    
    const nextClip = getNextClipInSequence()
    if (nextClip) {
      // Advance playhead to next clip
      store.setPlayheadSec(nextClip.startTime)
      console.log('[Player] Advanced to next clip:', nextClip.clip.name, 'at', nextClip.startTime)
    } else {
      // No more clips, stop playback
      store.setIsPlaying(false)
      console.log('[Player] Reached end of timeline')
    }
  }

  // Handle video time updates to check if we should advance to next clip
  const handleTimeUpdate = () => {
    if (!isPlaying || !videoRef.current) return
    
    const currentClip = getClipAtPlayheadPosition()
    if (!currentClip) return
    
    const currentTime = playheadSec || 0
    const videoTime = videoRef.current.currentTime
    
    // Find the track item for the current clip
    const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
    let currentTrackItem = null
    
    for (const track of sortedTracks) {
      if (!track.visible) continue
      
      const trackItems = Object.values(store.trackItems).filter(item => item.trackId === track.id)
      
      for (const item of trackItems) {
        const clip = store.clips[item.clipId]
        if (clip && clip.id === currentClip.id) {
          currentTrackItem = item
          break
        }
      }
      if (currentTrackItem) break
    }
    
    if (currentTrackItem) {
      const clip = store.clips[currentTrackItem.clipId]
      const clipDuration = Math.max(0, Number(clip?.duration) || 0)
      const requestedDuration = Math.max(0, Number(currentTrackItem.outSec) - Number(currentTrackItem.inSec))
      const effectiveDuration = Math.min(requestedDuration || 0, clipDuration || 0)

      // Compute end using the video's own timebase to avoid race with playhead updates
      const inSec = Number(currentTrackItem.inSec) || 0
      const videoEnd = inSec + (isFinite(effectiveDuration) ? effectiveDuration : 0)

      // Check if we've reached the end of this clip's segment based on the video clock
      if (videoTime >= videoEnd - 0.01) {
        console.log('[Player] Reached end of segment (video time), advancing to next clip')
        handleVideoEnded()
      }
    }
  }

  // Calculate total timeline duration (clamped to actual clip durations)
  const getTimelineDuration = () => {
    const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
    let maxEndTime = 0

    for (const track of sortedTracks) {
      if (!track.visible) continue

      const itemsForTrack = Object.values(store.trackItems).filter(item => item.trackId === track.id)

      for (const item of itemsForTrack) {
        const clip = store.clips[item.clipId]
        const clipDuration = Math.max(0, Number(clip?.duration) || 0)
        const requestedDuration = Math.max(0, Number(item.outSec) - Number(item.inSec))
        const effectiveDuration = Math.min(requestedDuration || 0, clipDuration || 0)

        const itemEnd = Number(item.trackPosition) + (isFinite(effectiveDuration) ? effectiveDuration : 0)
        if (itemEnd > maxEndTime) {
          maxEndTime = itemEnd
        }
      }
    }

    return maxEndTime
  }

  const { path: currentVideoPath, duration: currentVideoDuration } = getCurrentVideoInfo()
  
  // Convert absolute path to file:// URL for HTML5 video
  const videoSrc = currentVideoPath ? `file://${currentVideoPath}` : undefined

  // Update video source and seek when playhead changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
    const t = playheadSec || 0

    // Find item under playhead
    let chosen: { clip: any; item: any; start: number } | null = null
    for (const track of sortedTracks) {
      if (!track.visible) continue
      const items = Object.values(store.trackItems).filter(it => it.trackId === track.id)
      for (const item of items) {
        const clip = store.clips[item.clipId]
        if (!clip) continue
        const start = Number(item.trackPosition) || 0
        const clipDur = Math.max(0, Number(clip?.duration) || 0)
        const reqDur = Math.max(0, Number(item.outSec) - Number(item.inSec))
        const effDur = Math.min(reqDur || 0, clipDur || 0)
        const end = start + (isFinite(effDur) ? effDur : 0)
        if (t >= start && t <= end) { chosen = { clip, item, start }; break }
      }
      if (chosen) break
    }

    // If nothing under playhead and user is playing, jump to next clip
    if (!chosen && isPlaying) {
      let best: { clip: any; item: any; start: number } | null = null
      for (const track of sortedTracks) {
        if (!track.visible) continue
        const items = Object.values(store.trackItems).filter(it => it.trackId === track.id)
        for (const item of items) {
          const clip = store.clips[item.clipId]
          if (!clip) continue
          const start = Number(item.trackPosition) || 0
          if (start > t && (!best || start < best.start)) best = { clip, item, start }
        }
      }
      if (best) {
        chosen = best
        // Align playhead to the next clip start for clarity
        store.setPlayheadSec(best.start)
      }
    }

    if (!chosen) {
      // No clip to play
      video.pause()
      return
    }

    const neededSrc = `file://${chosen.clip.path}`
    const inSec = Number(chosen.item.inSec) || 0
    const seekTime = inSec + Math.max(0, (t - chosen.start))

    // If source changed (e.g., moved to a different clip), update src and align once
    if (video.src !== neededSrc) {
      video.src = neededSrc
      video.load()
      if (isFinite(seekTime)) {
        try { video.currentTime = seekTime } catch {}
      }
    } else if (!isPlaying) {
      // Only seek during paused state to avoid jitter during playback
      if (isFinite(seekTime)) {
        try { video.currentTime = seekTime } catch {}
      }
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => {})
    }
  }, [videoSrc, isPlaying, playheadSec])

  // Smooth playhead sync using requestVideoFrameCallback when available
  // (falls back to requestAnimationFrame). Commits to store at ~10Hz to avoid churn.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let rafId: number | null = null
    let lastMs = 0
    const frameInterval = 33 // ~30fps sampling
    let lastCommitMs = 0
    const commitInterval = 100 // commit to store at 10Hz

    const step = (now: number) => {
      if (!isPlaying) { return }
      if (now - lastMs >= frameInterval) {
        const hitClip = getClipAtPlayheadPosition()
        if (hitClip) {
          const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
          outer: for (const track of sortedTracks) {
            if (!track.visible) continue
            const items = Object.values(store.trackItems).filter(it => it.trackId === track.id)
            for (const item of items) {
              const clip = store.clips[item.clipId]
              if (!clip || clip.id !== hitClip.id) continue
              const inSec = Number(item.inSec) || 0
              const start = Number(item.trackPosition) || 0
              const rel = Math.max(0, video.currentTime - inSec)
              const mapped = start + rel
              const nowMs = performance.now()
              const current = useStore.getState().ui.playheadSec
              if ((nowMs - lastCommitMs) >= commitInterval || Math.abs((current || 0) - mapped) > 0.2) {
                useStore.getState().setPlayheadSec(mapped)
                lastCommitMs = nowMs
              }
              break outer
            }
          }
        }
        lastMs = now
      }
      rafId = requestAnimationFrame(step)
    }

    // Prefer requestVideoFrameCallback for decoder-synced updates
    let cancelVideoCallback: (() => void) | null = null
    const hasRVFC = typeof (video as any).requestVideoFrameCallback === 'function'

    if (isPlaying) {
      if (hasRVFC) {
        let handle: number | null = null
        const loop = (_now: number, _meta: any) => {
          step(performance.now())
          handle = (video as any).requestVideoFrameCallback(loop)
        }
        handle = (video as any).requestVideoFrameCallback(loop)
        cancelVideoCallback = () => {
          try { if (handle != null) (video as any).cancelVideoFrameCallback(handle) } catch {}
        }
      } else {
        rafId = requestAnimationFrame(step)
      }
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (cancelVideoCallback) cancelVideoCallback()
    }
  }, [isPlaying, videoSrc])

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
      
      // For PiP recordings, only process the final _pip.webm file
      const isPiPFinal = path.includes('_pip.webm')
      const isPiPInitial = path.includes('.webm') && !path.includes('_pip.webm') && !path.includes('_webcam.webm')
      
      // For PiP recordings, skip initial files and only process the final combined file
      if (isPiPInitial && metadata.type === 'pip') {
        console.log('[Player] Skipping PiP initial file, waiting for final processed file:', path)
        return
      }
      
      // Check if we've already processed this path
      if (processedPaths.has(path)) {
        console.log('[Player] This recording already processed, skipping:', path)
        return
      }
      
      processedPaths.add(path)
      
      // Set recording state to false since completion event means recording is done
      setIsRecording(false)
      setIsProcessing(false) // Clear processing state when recording is complete
      console.log('[Player] Recording completed, UI state updated')
      
      // Stop recording timer
      if (recordingTimer) {
        clearInterval(recordingTimer)
        setRecordingTimer(null)
      }
      setRecordingStartTime(null)
      setRecordingDuration(0)
      
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
    
    // Listen for processing events (PiP overlay)
    const handleProcessing = (data: { message: string; progress: number }) => {
      console.log('[Player] Processing:', data.message, data.progress + '%')
      setIsProcessing(true)
    }
    
    window.clipforge.onRecordingProcessing(handleProcessing)
    
    return () => {
      isMounted = false
      processedPaths.clear()
    }
  }, [])

  const handlePlay = () => {
    // Only auto-switch out of preview when in webcam-only mode
    if (recordingType === 'webcam' && webcamStream && !isRecording && countdown === null) {
      stopWebcamPreview()
      setRecordingType('screen')
    }
    const video = videoRef.current
    if (!video) return
    const t = playheadSec || 0
    // Start at clip under playhead or next clip after
    const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
    let chosen: { clip: any; item: any; start: number } | null = null
    for (const track of sortedTracks) {
      if (!track.visible) continue
      const items = Object.values(store.trackItems).filter(it => it.trackId === track.id)
      for (const item of items) {
        const clip = store.clips[item.clipId]
        if (!clip) continue
        const start = Number(item.trackPosition) || 0
        const inSec = Number(item.inSec) || 0
        const clipDur = Math.max(0, Number(clip?.duration) || 0)
        const reqDur = Math.max(0, Number(item.outSec) - Number(item.inSec))
        const effDur = Math.min(reqDur || 0, clipDur || 0)
        const end = start + (isFinite(effDur) ? effDur : 0)
        if (t >= start && t <= end) { chosen = { clip, item, start }; break }
      }
      if (chosen) break
    }
    if (!chosen) {
      // find next
      let best: { clip: any; item: any; start: number } | null = null
      for (const track of sortedTracks) {
        if (!track.visible) continue
        const items = Object.values(store.trackItems).filter(it => it.trackId === track.id)
        for (const item of items) {
          const clip = store.clips[item.clipId]
          if (!clip) continue
          const start = Number(item.trackPosition) || 0
          if (start > t && (!best || start < best.start)) {
            best = { clip, item, start }
          }
        }
      }
      chosen = best
    }
    if (!chosen) { store.setIsPlaying(false); return }
    const neededSrc = `file://${chosen.clip.path}`
    if (video.src !== neededSrc) {
      video.src = neededSrc
      video.load()
    }
    // If we came from a gap, jump playhead to the start of the next clip and seek to its inSec
    if (t < chosen.start) {
      store.setPlayheadSec(chosen.start)
    }
    const seek = (Number(chosen.item.inSec) || 0) + (t >= chosen.start ? (t - chosen.start) : 0)
    try { video.currentTime = seek } catch {}
    store.setIsPlaying(true)
    video.play().catch(() => {})
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
    // Prevent multiple countdowns
    if (countdown !== null || countdownInterval !== null) {
      console.log('[Player] Countdown already in progress, ignoring')
      return
    }

    // Check if recording is already in progress BEFORE starting countdown
    try {
      const isCurrentlyRecording = await window.clipforge.isRecording()
      if (isCurrentlyRecording) {
        console.log('[Player] Recording already in progress, stopping first')
        await window.clipforge.stopRecording()
        setIsRecording(false)
        // Clean up recording timer
        if (recordingTimer) {
          clearInterval(recordingTimer)
          setRecordingTimer(null)
        }
        setRecordingStartTime(null)
        setRecordingDuration(0)
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.warn('[Player] Could not check recording status:', error)
      // Continue anyway - the actual recording will handle the error
    }

    // Start 3-second countdown
    setCountdown(3)
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          setCountdownInterval(null)
          setCountdown(null)
          // Start actual recording after countdown
          startActualRecording()
          return null
        }
        return prev - 1
      })
    }, 1000)
    
    setCountdownInterval(interval)
  }

  const startActualRecording = async () => {
    // Prevent double execution (React Strict Mode)
    if (isStartingRecording) {
      console.log('[Player] Recording start already in progress, skipping')
      return
    }

    try {
      setIsStartingRecording(true)
      
      // Double-check recording status before starting
      const isCurrentlyRecording = await window.clipforge.isRecording()
      if (isCurrentlyRecording) {
        console.log('[Player] Recording still active, skipping start')
        return
      }

      // Stop previews to avoid device contention when recording starts
      if (recordingType === 'webcam' || recordingType === 'pip') {
        stopWebcamPreview()
      }
      if (recordingType === 'pip') {
        stopScreenPreview()
      }

      setIsRecording(true)
      await window.clipforge.startRecording(recordingType)
      console.log('[Player] Recording started:', recordingType)
      
      // Start recording duration timer
      const startTime = Date.now()
      setRecordingStartTime(startTime)
      setRecordingDuration(0)
      
      const timer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        setRecordingDuration(elapsed)
      }, 100) // Update every 100ms for smooth display
      
      setRecordingTimer(timer)
    } catch (error) {
      console.error('[Player] Failed to start recording:', error)
      
      // If recording is already in progress, don't reset the UI state
      if (error instanceof Error && error.message.includes('Recording already in progress')) {
        console.log('[Player] Recording already in progress, keeping UI state')
        // Don't set setIsRecording(false) - the recording is actually running
      } else {
        setIsRecording(false)
        // Clean up recording timer on error
        if (recordingTimer) {
          clearInterval(recordingTimer)
          setRecordingTimer(null)
        }
        setRecordingStartTime(null)
        setRecordingDuration(0)
      }
      
      // Reset countdown if recording fails
      setCountdown(null)
    } finally {
      setIsStartingRecording(false)
    }
  }

  const handleStopRecording = async () => {
    try {
      await window.clipforge.stopRecording()
      console.log('[Player] Recording stopped - waiting for completion event to update UI')
      // Don't set setIsRecording(false) here - let handleRecordingComplete handle it
    } catch (error) {
      console.error('[Player] Failed to stop recording:', error)
      setIsRecording(false) // Only set false on error
      // Clean up recording timer on error
      if (recordingTimer) {
        clearInterval(recordingTimer)
        setRecordingTimer(null)
      }
      setRecordingStartTime(null)
      setRecordingDuration(0)
    }
  }

  const handleCancelCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      setCountdownInterval(null)
    }
    setCountdown(null)
  }

  // Device enumeration
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAvailableDevices(devices)
      
      // Set default camera and microphone
      const cameras = devices.filter(device => device.kind === 'videoinput')
      const microphones = devices.filter(device => device.kind === 'audioinput')
      
      if (cameras.length > 0 && !selectedCameraId) {
        setSelectedCameraId(cameras[0].deviceId)
      }
      if (microphones.length > 0 && !selectedMicrophoneId) {
        setSelectedMicrophoneId(microphones[0].deviceId)
      }
    } catch (error) {
      console.error('[Player] Failed to enumerate devices:', error)
    }
  }

  // Webcam preview functions
  const startWebcamPreview = async () => {
    try {
      console.log('[Player] Starting webcam preview')
      setPermissionError(null)
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser')
      }
      
      // Enumerate devices first
      await enumerateDevices()
      
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false // No audio for preview
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      setWebcamStream(stream)
      
      console.log('[Player] Webcam preview started')
    } catch (error) {
      console.error('[Player] Failed to start webcam preview:', error)
      
      // Handle specific error cases with user-friendly messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setPermissionError('Camera permission denied. Please allow camera access and try again.')
        } else if (error.name === 'NotFoundError') {
          setPermissionError('No camera found. Please connect a camera and try again.')
        } else if (error.name === 'NotReadableError') {
          setPermissionError('Camera is already in use by another application.')
        } else if (error.name === 'OverconstrainedError') {
          setPermissionError('Camera settings are not supported. Try selecting a different camera.')
        } else {
          setPermissionError(`Camera error: ${error.message}`)
        }
      }
      
      // Reset to screen recording if webcam fails
      setRecordingType('screen')
    }
  }

  const stopWebcamPreview = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop())
      setWebcamStream(null)
      
      if (webcamPreviewRef) {
        webcamPreviewRef.srcObject = null
      }
      
      console.log('[Player] Webcam preview stopped')
    }
  }

  // Screen preview (for PiP pre-record)
  const startScreenPreview = async () => {
    try {
      console.log('[Player] Starting screen preview')
      const sources = await window.clipforge.getScreenSources()
      if (!sources || sources.length === 0) {
        throw new Error('No screen sources available')
      }
      const primary = sources[0]

      // Use chromeMediaSource constraints (Electron)
      const constraints: any = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primary.id,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        }
      }

      const stream = await (navigator.mediaDevices as any).getUserMedia(constraints)
      setScreenPreviewStream(stream)
      console.log('[Player] Screen preview started')
    } catch (error) {
      console.error('[Player] Failed to start screen preview:', error)
      setScreenPreviewStream(null)
    }
  }

  const stopScreenPreview = () => {
    if (screenPreviewStream) {
      screenPreviewStream.getTracks().forEach(track => track.stop())
      setScreenPreviewStream(null)
      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = null
      }
      console.log('[Player] Screen preview stopped')
    }
  }

  // Handle recording type change
  const handleRecordingTypeChange = async (newType: 'screen' | 'webcam' | 'pip') => {
    setRecordingType(newType)
    
    // Reset any stuck recording state
    try {
      await window.clipforge.resetRecordingState()
    } catch (error) {
      console.warn('[Player] Could not reset recording state:', error)
    }
    
    if (newType === 'webcam') {
      stopScreenPreview()
      startWebcamPreview()
    } else if (newType === 'pip') {
      // For MVP PiP preview: webcam only
      stopScreenPreview()
      startWebcamPreview()
    } else {
      stopWebcamPreview()
      stopScreenPreview()
    }
  }

  // Set webcam stream to preview video element when ref is available
  useEffect(() => {
    if (webcamPreviewRef && webcamStream) {
      webcamPreviewRef.srcObject = webcamStream
      console.log('[Player] Set webcam stream to preview element')
    }
  }, [webcamPreviewRef, webcamStream])

  // Set screen stream to preview element when available
  useEffect(() => {
    if (screenPreviewRef.current && screenPreviewStream) {
      screenPreviewRef.current.srcObject = screenPreviewStream
      console.log('[Player] Set screen stream to preview element')
    }
  }, [screenPreviewStream])

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval)
      }
      if (recordingTimer) {
        clearInterval(recordingTimer)
      }
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop())
      }
      if (screenPreviewStream) {
        screenPreviewStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [countdownInterval, recordingTimer, webcamStream, screenPreviewStream])

  // Removed previous generic timeupdate sync; playhead is updated in the 100ms interval above

  // Sync playhead dragging to video (when user clicks timeline)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    // Throttle video position updates to avoid feedback loops
    // Only update when paused/not playing; avoid seeking while playing to prevent jitter
    if (!isPlaying) {
      // Seek relative to track item under playhead
      const sortedTracks = Object.values(store.tracks).sort((a, b) => a.order - b.order)
      const t = playheadSec
      for (const track of sortedTracks) {
        if (!track.visible) continue
        const items = Object.values(store.trackItems).filter(it => it.trackId === track.id)
        for (const item of items) {
          const clip = store.clips[item.clipId]
          if (!clip) continue
          const start = Number(item.trackPosition) || 0
          const clipDur = Math.max(0, Number(clip?.duration) || 0)
          const reqDur = Math.max(0, Number(item.outSec) - Number(item.inSec))
          const effDur = Math.min(reqDur || 0, clipDur || 0)
          const end = start + (isFinite(effDur) ? effDur : 0)
          if (t >= start && t <= end) {
            const inSec = Number(item.inSec) || 0
            const seek = inSec + (t - start)
            try { video.currentTime = seek } catch {}
            return
          }
        }
      }
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
        {recordingType === 'webcam' && webcamStream ? (
          <video
            ref={setWebcamPreviewRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        ) : recordingType === 'pip' && webcamStream ? (
          // MVP: show webcam only for PiP preview
          <video
            ref={setWebcamPreviewRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              src={videoSrc}
              controls={false} // We'll add custom controls
              loop={loopEnabled}
              preload="metadata"
              playsInline
              onEnded={handleVideoEnded}
              onTimeUpdate={handleTimeUpdate}
            />
            
            {!videoSrc && (
              <p className="text-gray-500">Import a clip to preview</p>
            )}
          </>
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
            onChange={(e) => handleRecordingTypeChange(e.target.value as 'screen' | 'webcam' | 'pip')}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            disabled={isRecording || countdown !== null}
          >
            <option value="screen">Screen</option>
            <option value="webcam">Webcam</option>
            <option value="pip">PiP (Screen + Webcam)</option>
          </select>
          
          {countdown !== null ? (
            <div className="flex items-center gap-2">
              <div className="px-6 py-2 bg-orange-600 rounded text-white font-medium text-center min-w-[120px]">
                🔴 Recording in {countdown}s
              </div>
              <button
                onClick={handleCancelCountdown}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium"
              >
                Cancel
              </button>
            </div>
          ) : !isRecording ? (
            <button
              onClick={handleStartRecording}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium"
            >
              🔴 Start Recording
            </button>
          ) : isProcessing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span className="text-white font-medium">Processing...</span>
            </div>
          ) : (
            <button
              onClick={handleStopRecording}
              className="px-6 py-2 bg-red-800 hover:bg-red-900 rounded text-white font-medium animate-pulse"
            >
              ⏹ Stop Recording
            </button>
          )}
        </div>
        
        {/* Device Selection (Webcam mode only) */}
        {recordingType === 'webcam' && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Camera Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Camera:</label>
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  disabled={isRecording || countdown !== null}
                >
                  {availableDevices
                    .filter(device => device.kind === 'videoinput')
                    .map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                </select>
              </div>
              
              {/* Microphone Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Microphone:</label>
                <select
                  value={selectedMicrophoneId}
                  onChange={(e) => setSelectedMicrophoneId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  disabled={isRecording || countdown !== null}
                >
                  {availableDevices
                    .filter(device => device.kind === 'audioinput')
                    .map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            
            {/* Permission Error Display */}
            {permissionError && (
              <div className="mt-3 p-3 bg-red-900 border border-red-600 rounded text-red-200 text-sm">
                {permissionError}
              </div>
            )}
          </div>
        )}
        
        {/* Recording Indicator and Duration */}
        {isRecording && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-red-600 border-2 border-red-400 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-300 rounded-full animate-pulse"></div>
              <span className="text-white font-bold text-sm">REC</span>
            </div>
            <div className="text-white font-mono text-sm font-bold">
              {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toFixed(1).padStart(4, '0')}
            </div>
          </div>
        )}
        
        {/* Time Display */}
        <div className="mt-3 text-center text-sm text-gray-400">
          {isNaN(playheadSec || 0) ? '0.0' : (playheadSec || 0).toFixed(1)}s / {getTimelineDuration().toFixed(1)}s
        </div>
      </div>
    </div>
  )
}

