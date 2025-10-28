# IPC Integration Test

## Manual Testing

To verify IPC communication works:

1. Open DevTools in the Electron app (Cmd+Option+I)
2. In the console, test each IPC method:

```javascript
// Test openFiles
const files = await window.clipforge.openFiles()
console.log('Files:', files)

// Test probe (will return placeholder data)
const metadata = await window.clipforge.probe('/path/to/video.mp4')
console.log('Metadata:', metadata)

// Test saveProject (will return placeholder path)
const savedPath = await window.clipforge.saveProject({ id: 'test', name: 'Test', version: '1', clips: {}, tracks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
console.log('Saved to:', savedPath)

// Test openProject
const project = await window.clipforge.openProject()
console.log('Project:', project)

// Test startRecording
const result = await window.clipforge.startRecording({ type: 'screen' })
console.log('Recording started:', result)

// Test stopRecording  
const stopped = await window.clipforge.stopRecording()
console.log('Recording stopped:', stopped)

// Test event listener
window.clipforge.onRecordingComplete((path, metadata) => {
  console.log('Recording complete:', path, metadata)
})
```

## Expected Behavior

All methods should execute without errors and return their expected placeholder values.

## Automated Testing

Full integration tests with mocked FFmpeg will be added in PR 4.

