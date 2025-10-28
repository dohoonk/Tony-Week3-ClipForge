# ClipForge - Smoke Test Checklist (PR 17)

**Goal**: Verify core functionality works end-to-end

---

## Test 1: Import & Timeline ✅

### Steps:
1. [ ] Start the app (`npm run dev` or open packaged DMG)
2. [ ] Import 3 video clips via "Import Files" in Media Library
3. [ ] Verify all 3 clips appear in Media Library with metadata (duration, resolution)
4. [ ] Drag clip 1 onto timeline (any position)
5. [ ] Drag clip 2 onto timeline (after clip 1)
6. [ ] Drag clip 3 onto timeline (after clip 2)
7. [ ] Verify all 3 clips appear on timeline
8. [ ] Check that timeline auto-scrolls when playhead reaches end

### Expected Results:
- ✓ All clips visible in Media Library
- ✓ All clips appear on timeline in correct order
- ✓ Timeline width adjusts to total duration
- ✓ Auto-scroll works during playback

---

## Test 2: Playback & Preview ✅

### Steps:
1. [ ] Click ▶ Play button in Timeline header
2. [ ] Watch video preview player
3. [ ] Verify video plays smoothly
4. [ ] Check audio plays (if source has audio)
5. [ ] Click ⏸ Pause
6. [ ] Click playhead at different positions on timeline
7. [ ] Verify playhead moves red line smoothly
8. [ ] Click timeline to seek - verify video jumps to that time

### Expected Results:
- ✓ Play button starts playback
- ✓ Video preview renders correctly
- ✓ Audio syncs with video
- ✓ Seeking works smoothly
- ✓ Playhead indicator is visible and responsive

---

## Test 3: Export ✅

### Steps:
1. [ ] Click "📤 Export Video" in Export Panel
2. [ ] Watch progress bar animate from 0% to 100%
3. [ ] Wait for "Export completed" message
4. [ ] Check output file exists: `~/Movies/ClipForge/export_*.mp4`
5. [ ] Play exported file in QuickTime/VLC
6. [ ] Verify video quality is acceptable
7. [ ] Verify audio is present and in sync

### Expected Results:
- ✓ Export starts without errors
- ✓ Progress bar updates in real-time
- ✓ Success message appears
- ✓ Exported file is playable
- ✓ Audio/video sync is maintained
- ✓ Export completes in reasonable time (≤1.3× realtime for 1080p30)

---

## Test 4: Project Save/Load ✅

### Steps:
1. [ ] Add 2 clips to timeline
2. [ ] Click "Save Project" (or trigger via menu)
3. [ ] Choose save location and name
4. [ ] Verify file is saved
5. [ ] Close app completely
6. [ ] Restart app
7. [ ] Open the saved project
8. [ ] Verify clips reload in Media Library
9. [ ] Verify timeline items reload

### Expected Results:
- ✓ Project saves successfully
- ✓ Project file is readable JSON
- ✓ Clips reload on open
- ✓ Timeline items reload with correct positions
- ✓ Project state is restored accurately

---

## Test 5: Error Handling ✅

### Steps:
1. [ ] Test error boundary by causing a render error (if possible)
2. [ ] Try exporting with empty timeline
3. [ ] Verify error messages display properly
4. [ ] Try importing non-video file
5. [ ] Verify graceful error handling

### Expected Results:
- ✓ Error boundary catches crashes
- ✓ Error messages are user-friendly
- ✓ App doesn't freeze or crash completely

---

## Test 6: Performance ✅

### Steps:
1. [ ] Add multiple clips to timeline (5+)
2. [ ] Zoom in/out on timeline
3. [ ] Drag timeline items around
4. [ ] Play through entire timeline
5. [ ] Monitor console for warnings/errors
6. [ ] Check memory usage (Activity Monitor)

### Expected Results:
- ✓ Smooth scrolling at all zoom levels
- ✓ No visible lag or stuttering
- ✓ Console shows no major errors
- ✓ Memory usage is reasonable (<500 MB expected)
- ✓ Frame rate stays ≥30 fps

---

## Performance Benchmarks

### Export Speed (Target: ≤1.3× realtime for 1080p30)
- **Test**: Export 60-second project at 1080p
- **Expected**: Completes in ≤1.3 minutes (78 seconds max)
- **Actual**: _______

### Video Quality
- **Resolution**: Matches source (or exported settings)
- **Frame Rate**: Smooth playback
- **Audio Bitrate**: 192 kbps (AAC)
- **Video Codec**: H.264 (libx264)

---

## Known Limitations (MVP)

These are expected for MVP and should NOT be fixed now:
- ✗ Split functionality (double-click)
- ✗ Trim/In-Out points
- ✗ Multiple tracks
- ✗ Timeline virtualization (deferred)
- ✗ Recording (mock implementation)
- ✗ Custom export settings

---

## Test Summary

- **Date**: ___________
- **Tester**: ___________
- **Total Tests Passed**: ______ / 6
- **Critical Issues Found**: ______
- **Minor Issues Found**: ______

### Notes:
___________________________________________
___________________________________________
___________________________________________

