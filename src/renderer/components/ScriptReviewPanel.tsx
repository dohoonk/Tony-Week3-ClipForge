import React from 'react'
import { ScriptReviewTab } from './ScriptReviewTab'

// Content-only version for unified panel (just wraps ScriptReviewTab without the aside)
export function ScriptReviewPanelContent() {
  return <ScriptReviewTab />
}

