import React, { useState } from 'react'
import { ExportPanelContent } from './ExportPanel'
import { AIAssistantPanelContent } from './AIAssistantPanel'
import { ScriptReviewPanelContent } from './ScriptReviewPanel'
import { TranscriptionTestPanelContent } from './TranscriptionTestPanel'

type TabType = 'export' | 'ai' | 'review' | 'testing'

export function UnifiedToolsPanel({ style }: { style?: React.CSSProperties }) {
  const [activeTab, setActiveTab] = useState<TabType>('export')

  return (
    <aside className="panel h-full" style={{ minWidth: '200px', flexShrink: 0, ...style }}>
      {/* Top-level Tabs */}
      <div className="flex border-b border-gray-700 mb-4 flex-wrap">
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 flex flex-col items-center py-2 px-2 text-xs font-medium transition-colors ${
            activeTab === 'export'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          title="Export"
        >
          <span className="mb-1">📤</span>
          <span>Export</span>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 flex flex-col items-center py-2 px-2 text-xs font-medium transition-colors ${
            activeTab === 'ai'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          title="AI Fillers"
        >
          <span className="mb-1">🤖</span>
          <span>Fillers</span>
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 flex flex-col items-center py-2 px-2 text-xs font-medium transition-colors ${
            activeTab === 'review'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          title="Script Review"
        >
          <span className="mb-1">📝</span>
          <span>Review</span>
        </button>
        <button
          onClick={() => setActiveTab('testing')}
          className={`flex-1 flex flex-col items-center py-2 px-2 text-xs font-medium transition-colors ${
            activeTab === 'testing'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          title="Testing"
        >
          <span className="mb-1">🧪</span>
          <span>Test</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="h-full overflow-auto" style={{ maxHeight: 'calc(100% - 60px)' }}>
        {activeTab === 'export' && <ExportPanelContent />}
        {activeTab === 'ai' && <AIAssistantPanelContent />}
        {activeTab === 'review' && <ScriptReviewPanelContent />}
        {activeTab === 'testing' && <TranscriptionTestPanelContent />}
      </div>
    </aside>
  )
}

