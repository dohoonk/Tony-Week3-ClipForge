import { useState, useEffect } from 'react'
import { useStore } from '../store'

export type ExportResolution = '720p' | '1080p' | 'source'

export function ExportPanel() {
  const store = useStore()
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolution, setResolution] = useState<ExportResolution>('1080p')

  const trackItemsCount = Object.keys(store.trackItems).length

  // Subscribe to export progress events
  useEffect(() => {
    const handleProgress = (data: { progress: number; timemark: string }) => {
      console.log('[Export] Progress:', data.progress + '%', data.timemark)
      setProgress(data.progress)
      setExportStatus(`Exporting... ${data.timemark}`)
    }

    const handleComplete = (data: { outputPath: string }) => {
      console.log('[Export] Completed:', data.outputPath)
      setProgress(100)
      setExportStatus(`Exported to: ${data.outputPath}`)
      setIsExporting(false)
      setError(null)
    }

    // Subscribe to IPC events
    window.clipforge.onExportProgress(handleProgress)
    window.clipforge.onExportEnd(handleComplete)

    return () => {
      // Cleanup if needed
      // Note: IPC listeners persist, but we'll handle cleanup in a future PR
    }
  }, [])

  const handleExport = async () => {
    if (trackItemsCount === 0) {
      setError('Add clips to timeline first')
      return
    }

    try {
      setIsExporting(true)
      setProgress(0)
      setExportStatus('Starting export...')
      setError(null)
      
      // Get current project state
      const project = {
        id: store.project.id,
        name: store.project.name,
        version: store.project.version,
        clips: store.clips,
        tracks: [], // Not used in flat structure
        trackItems: store.trackItems,
        createdAt: store.project.createdAt,
        updatedAt: store.project.updatedAt,
      }
      
      // Generate output path
      const timestamp = Date.now()
      // Use ~/Movies/ClipForge/ for macOS
      // This will be resolved by the main process
      const outputPath = `~/Movies/ClipForge/export_${timestamp}.mp4`
      
      console.log('[Export] Starting export to:', outputPath, 'Resolution:', resolution)
      
      // Call export function with resolution
      await window.clipforge.exportTimeline(project, outputPath, resolution)
      
      setExportStatus('Export completed successfully!')
      setProgress(100)
    } catch (error) {
      console.error('[Export] Export failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(`Export failed: ${errorMessage}`)
      setExportStatus(null)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <aside className="w-64 h-full border-l border-gray-700 p-4 overflow-auto" style={{ minWidth: '200px', flexShrink: 0 }}>
      <h2 className="text-lg font-semibold mb-4 text-white">Export Panel</h2>
      
      <div className="space-y-4">
        {/* Status Info */}
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-400">Clips on Timeline:</p>
            <p className="text-lg font-bold text-white">{trackItemsCount}</p>
          </div>
        </div>

        {/* Resolution Selector */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Export Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as ExportResolution)}
            disabled={isExporting}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="720p">720p (1280x720)</option>
            <option value="1080p">1080p (1920x1080)</option>
            <option value="source">Source Resolution</option>
          </select>
        </div>

        {/* Progress Display */}
        {isExporting && (
          <div className="space-y-2">
            <p className="text-xs text-gray-300">{exportStatus || 'Exporting...'}</p>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{progress.toFixed(0)}%</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-2 bg-red-900 bg-opacity-50 border border-red-600 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Success Message */}
        {!isExporting && exportStatus && !error && (
          <div className="p-2 bg-green-900 bg-opacity-50 border border-green-600 rounded text-xs text-green-300">
            {exportStatus}
          </div>
        )}

        {/* Export Button */}
        <button 
          onClick={handleExport}
          disabled={isExporting || trackItemsCount === 0}
          className={`w-full px-4 py-2 rounded text-white font-medium transition-all ${
            isExporting || trackItemsCount === 0
              ? 'bg-gray-600 cursor-not-allowed opacity-50'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isExporting ? '⏳ Exporting...' : '📤 Export Video'}
        </button>

        {trackItemsCount === 0 && !isExporting && (
          <p className="text-xs text-gray-500 text-center">
            Add clips to timeline to export
          </p>
        )}
      </div>
    </aside>
  )
}

