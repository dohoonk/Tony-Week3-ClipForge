# AI Filler Removal Feature — Implementation Plan v1

## Overview

Goal: Automatically detect and remove filler words ("um", "uh", "like", etc.) from video clips using local Whisper.cpp transcription and timeline editing.

**Core Value:** Non-destructive, previewable, offline-capable filler removal without cloud services.

---

## Feature Workflow

1. **Transcript** → Extract word-level timestamps via Whisper.cpp
2. **Detect** → Match filler words in transcript with confidence thresholds
3. **Plan** → Generate cut operations (pure function, testable)
4. **Apply** → Mutate timeline via Zustand store (batched, undoable)
5. **Review** → User UI to preview and selectively apply cuts

---

## Technical Decisions

### PR AI-1 — Whisper Pipeline

| Topic | Decision | Reason |
|-------|----------|--------|
| **Model** | `ggml-base.en.bin` (~500MB) | Fast, good enough for English fillers. Can upgrade to `medium` later. |
| **Output format** | `-ofjson` | Contains word-level timestamps + confidence; no need to parse txt + SRT. |
| **Command** | `whisper -m ggml-base.en.bin -f temp.wav -ofjson -pp -l en` | Stable, consistent, progress output available. |
| **Progress events** | Yes, emit via IPC | Matches export job UX, prevents "app is frozen" perception. |
| **Audio extraction** | Extract to 16kHz mono WAV via FFmpeg | Whisper needs audio; standard format ensures consistency. |
| **Temp WAV cleanup** | Delete after transcription completes | Avoids disk bloat from large audio files. |
| **Duration source** | Use FFprobe for true audio duration | Whisper duration can be slightly off; ffprobe is reliable. |
| **Hashing** | Compute on ingest, store in Clip object | Ensures cache lookup works immediately + no extra IO later. |
| **Cache location** | `~/.clipforge/cache/transcripts/<clip.hash>.json` | Consistent with existing cache structure. |

**Transcript Format (immutable):**

```typescript
type Transcript = {
  words: Array<{
    text: string;
    startSec: number;
    endSec: number;
    confidence: number;
  }>;
  durationSec: number;
  audioDurationSec: number;
  modelVersion: string;
}
```

---

### PR AI-2 — Filler Detection

| Topic | Decision | Reason |
|-------|----------|--------|
| **Match strategy** | Match by lowercased word, no stemming | Simple + works well for filler speech. |
| **Confidence** | Use for display + optional filtering, but not required to detect | Fillers often have low confidence; don't miss them. |
| **Padding** | Apply ±40ms (~0.04s) in AI-2 | Keeps cut logic simpler in AI-3. |
| **Language scope** | English only for first release | No multilingual complexities yet. |
| **Filler dictionary** | `["um", "uh", "like", "you know", "so", "actually", "well"]` | Start small, expand later. |

**FillerSpan Format:**

```typescript
type FillerSpan = {
  clipId: string;
  word: string;
  startSec: number;
  endSec: number;
  confidence: number;
  paddedStart: number;
  paddedEnd: number;
}
```

---

### PR AI-3 — Generate Cut Plan

| Topic | Decision | Reason |
|-------|----------|--------|
| **Trim conflict** | Only cut inside current TrackItem `inSec→outSec` bounds | Prevents undo confusion and unexpected clip growth. |
| **Timeline mapping** | `timelineTime = trackPosition + (filler.startSec - inSec)` | Correct mapping from clip-relative to timeline-relative. |
| **Ripple tighten** | Merge within same TrackItem only, threshold = `snapInterval` | Predictable + aligns with existing timeline UX. |
| **Cross-item spans** | Handle per-TrackItem, compute cuts for each overlapping item | Supports multiple items from same clip. |

**Mapping Example:**

```
TrackItem:
  trackPosition: 10s
  inSec: 2s
  outSec: 5s

Filler at clip time 3.5s:
  → Timeline = 10s + (3.5s - 2s) = 11.5s ✅
```

**CutPlan Format:**

```typescript
type CutPlan = {
  trackItemId: string;
  cuts: Array<{
    startSec: number;
    endSec: number;
  }>;
}
```

---

### PR AI-4 — Apply Cut Plan

| Topic | Decision | Reason |
|-------|----------|--------|
| **Undo** | Single undo entry for entire operation | Clean UX. |
| **TrackItem ID generation** | Use `Date.now() + Math.random()` pattern | Consistent with existing ID generation. |
| **Playhead behavior** | If inside removed region → move to start of next fragment | Predictable + does not surprise user. |
| **Batch mutations** | Add `batchUpdateTrackItems()` to store | Prevents multiple re-renders. |

---

### PR AI-5 — UI Panel

| Topic | Decision | Reason |
|-------|----------|--------|
| **Placement** | Left sidebar tab: "AI Assistant" | Accessible, doesn't clutter main timeline. |
| **Transcript viewer** | MVP = list view only, optional full transcript later | Faster to ship. |
| **Batch processing** | Single clip only, batch later | UI simpler + avoids cross-track complexity. |
| **Error states** | Required: Missing whisper binary, no fillers found, transcription failed | Saves support/debug time. |

**UI Flow:**

```
User selects clip → "Analyze Speech" → Show detected fillers → 
User selects → Apply cuts → Timeline updates
```

---

## File Structure

```
src/
├── main/
│   ├── ai/
│   │   ├── whisper-runner.ts          # Whisper.cpp execution + progress
│   │   └── transcript-cache.ts        # Cache read/write helpers
│   ├── file-ingest-service.ts         # Add hash calculation on ingest
│   └── ipc-handlers.ts                # Add AI IPC handlers
├── shared/
│   ├── types.ts                       # Add Transcript, FillerSpan, CutPlan types
│   └── ai/
│       ├── filler-detection.ts        # Pure filler detection function
│       └── generate-cut-plan.ts        # Pure cut plan generation
├── renderer/
│   ├── components/
│   │   └── AIAssistantPanel.tsx       # UI panel component
│   └── store.ts                       # Add batchUpdateTrackItems + undo snapshot
└── preload/
    └── preload.ts                     # Add AI IPC methods + progress listeners
```

---

## Implementation Notes

### Undo System
- **Current state:** No undo system exists in codebase
- **Solution:** Simple snapshot-based undo for AI edits only
  - Store `trackItems` snapshot before applying cuts
  - Add `undoLastAICuts()` action to restore snapshot
  - Keep it simple for MVP

### Batch Mutations
- **Need:** `batchUpdateTrackItems()` in store
- **Reason:** Prevent multiple re-renders when applying many cuts
- **Format:** `batchUpdateTrackItems({ add?: TrackItem[], remove?: string[] })`

### Progress Events
- **Pattern:** Follow existing `export:progress` pattern
- **Implementation:** `ipcRenderer.on('transcribe:progress', ...)`
- **Emitter:** Whisper runner via `this.emit('transcribe:progress', ...)`

### Binary Path Resolution
- **Pattern:** Follow FFmpeg binary resolution pattern
- **Dev:** `bin/whisper/{darwin,win,linux}/whisper`
- **Prod:** `resources/bin/whisper/{darwin,win,linux}/whisper`
- **Model:** `resources/models/whisper/ggml-base.en.bin`

### Hash Calculation
- **Algorithm:** SHA-1 or xxHash
- **Timing:** Calculate on file ingest
- **Storage:** Store in `Clip.hash` field
- **Purpose:** Cache invalidation + transcript lookup

---

## Testing Strategy

### Unit Tests
- **Filler detection:** Word matching, padding, confidence filtering
- **Cut plan generation:** Edge cases (boundaries, overlaps, multi-item)
- **Pure functions:** All logic in `src/shared/ai/` is fully testable

### Integration Tests
- **IPC flow:** Mock whisper binary, verify transcript cache
- **Timeline mutations:** Verify cuts applied correctly

### E2E Tests (Playwright - optional)
- Import clip → Analyze → Preview → Apply → Export sample

---

## Dependencies & Prerequisites

### Required Binaries

**⚠️ TODO: Before starting PR AI-1, download and bundle Whisper.cpp binaries and model files**

#### Whisper.cpp Executables
- **Source:** https://github.com/ggerganov/whisper.cpp
- **Download Options:**
  1. **Pre-built releases:** Check GitHub releases for platform-specific binaries
     - macOS: `whisper-macos` or build from source
     - Windows: `whisper-win-x64.exe` or build from source
     - Linux: `whisper-linux-x64` or build from source
  2. **Build from source:** Follow Whisper.cpp build instructions
     - Requires C++ compiler (clang/gcc)
     - May require CMake and dependencies

- **File Structure (after download):**
  ```
  bin/
  └── whisper/
      ├── darwin/
      │   └── whisper          # macOS executable
      ├── win/
      │   └── whisper.exe      # Windows executable
      └── linux/
          └── whisper           # Linux executable
  ```

#### Model File
- **Model:** `ggml-base.en.bin` (~500MB)
- **Download Sources:**
  1. **Hugging Face:** https://huggingface.co/ggerganov/whisper.cpp
     - Navigate to model files
     - Download `ggml-base.en.bin`
  2. **Whisper.cpp Models:** https://github.com/ggerganov/whisper.cpp/tree/master/models
     - Use `models/download-ggml-model.sh base.en` (bash script)
  3. **Direct download:** https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin

- **File Structure (after download):**
  ```
  resources/
  └── models/
      └── whisper/
          └── ggml-base.en.bin
  ```

### Electron Builder Config

**⚠️ TODO: Add to `package.json` or `electron-builder.yml` before packaging**

```json
{
  "extraResources": [
    {
      "from": "bin/whisper",
      "to": "bin/whisper",
      "filter": ["**/*"]
    },
    {
      "from": "resources/models/whisper",
      "to": "models/whisper",
      "filter": ["*.bin"]
    }
  ]
}
```

Or in `electron-builder.yml`:
```yaml
extraResources:
  - from: bin/whisper
    to: bin/whisper
    filter: ["**/*"]
  - from: resources/models/whisper
    to: models/whisper
    filter: ["*.bin"]
```

### Setup Checklist (Before PR AI-1 Implementation)

- [ ] **Download Whisper.cpp binaries** for target platforms
  - [ ] macOS (`darwin`)
  - [ ] Windows (`win`) — optional for MVP
  - [ ] Linux (`linux`) — optional for MVP
- [ ] **Download model file:** `ggml-base.en.bin`
- [ ] **Place binaries** in `bin/whisper/{platform}/` directory
- [ ] **Place model** in `resources/models/whisper/` directory
- [ ] **Test binary:** Run `bin/whisper/darwin/whisper --help` to verify it works
- [ ] **Update `.gitignore`** to exclude large binaries/models (optional, or use Git LFS)
- [ ] **Add electron-builder config** for packaging

**Note:** For development, you can start with macOS only. Add Windows/Linux support later.

**Size considerations:**
- Whisper binary: ~5-20MB per platform
- Model file: ~500MB
- Total: ~550MB+ (similar to FFmpeg binaries)

---

## PR Sequence (MVP First)

| PR | Name | Deliverable | Status |
|----|------|-------------|--------|
| **AI-1** | whisper-pipeline | `transcribeClip()` IPC + cache + progress | 🔲 |
| **AI-2** | filler-detection | `detectFillers()` IPC returns spans | 🔲 |
| **AI-3** | generate-cut-plan | Pure function + unit tests | 🔲 |
| **AI-4** | apply-cut-plan | Store mutation + undo snapshot | 🔲 |
| **AI-5** | ai-assistant-ui | Sidebar UI to analyze → preview → apply | 🔲 |
| **AI-6** | mcp-server | ⏸️ Ship later (optional) | ⏸️ |

---

## Detailed Task List by PR

### PR AI-1 — whisper-pipeline

**Goal:** Extract transcript + word-level timestamps for each clip (once per unique file).

**⚠️ PREREQUISITE: Before starting implementation, download and set up Whisper binaries and model files (see "Dependencies & Prerequisites" section above)**

#### Tasks

##### 1. Hash Calculation & Storage
- [ ] Add `hash?: string` field to `Clip` type in `src/shared/types.ts`
- [ ] Install crypto hash library (or use Node's built-in `crypto.createHash`)
- [ ] Add hash calculation in `file-ingest-service.ts`:
  - Calculate SHA-1 hash of file buffer (first N MB or full file)
  - Store hash in clip metadata before saving
- [ ] Update `ingestFile` and `ingestFileData` methods to compute and return hash
- [ ] Test: Verify hash is consistent for same file content, different names

##### 2. Transcript Cache Infrastructure
- [ ] Create `~/.clipforge/cache/transcripts/` directory on init (if not exists)
- [ ] Create `src/main/ai/transcript-cache.ts`:
  - `getCachedTranscript(hash: string): Promise<Transcript | null>`
  - `setCachedTranscript(hash: string, transcript: Transcript): Promise<void>`
  - `invalidateTranscript(hash: string): Promise<void>`
- [ ] Handle cache directory creation errors gracefully
- [ ] Test: Verify cache read/write works, handles missing directory

##### 3. Whisper Binary Path Resolution
**⚠️ REMINDER: Ensure Whisper binaries are downloaded and placed in `bin/whisper/{platform}/` before testing this**

- [ ] Create `src/main/ai/resolve-whisper-path.ts`:
  - `resolveWhisperBinary(): string | null` (follow FFmpeg pattern)
  - `resolveWhisperModel(modelName: string): string | null`
  - Check: `bin/whisper/{platform}/whisper` (dev)
  - Check: `resources/bin/whisper/{platform}/whisper` (prod)
  - Check: `resources/models/whisper/{modelName}` (prod)
- [ ] Platform detection: `darwin`, `win32`, `linux`
- [ ] Error handling: Return null if not found, log warning
- [ ] Test: Verify path resolution in dev and packaged builds
- [ ] **Verify binary works:** Test manual run of whisper binary before coding

##### 4. Whisper Runner Implementation
- [ ] Create `src/main/ai/whisper-runner.ts`:
  - Class `WhisperRunner extends EventEmitter`
  - Method: `transcribe(audioPath: string, modelPath: string): Promise<Transcript>`
  - Spawn whisper process with: `-m <model> -f <input> -ofjson -pp -l en`
  - Parse JSON output → `Transcript` type
  - Emit `progress` events by parsing `-pp` output
  - Handle errors: missing binary, model, corrupted output
- [ ] Audio extraction helper:
  - `extractAudioForWhisper(videoPath: string): Promise<string>` (temp WAV path)
  - FFmpeg command: `-ac 1 -ar 16000 -f wav temp.wav`
  - Clean up temp file after transcription
- [ ] Progress parsing: Convert whisper `-pp` output to 0-100% progress
- [ ] Duration extraction: Use FFprobe for `audioDurationSec`
- [ ] Test: Mock whisper binary, verify JSON parsing, error handling

##### 5. Types & Interfaces
- [ ] Add `Transcript` type to `src/shared/types.ts`:
  ```typescript
  type Transcript = {
    words: Array<{ text: string; startSec: number; endSec: number; confidence: number }>;
    durationSec: number;
    audioDurationSec: number;
    modelVersion: string;
  }
  ```
- [ ] Export types from shared module

##### 6. IPC Handler
- [ ] Add to `src/main/ipc-handlers.ts`:
  - `ipcMain.handle('transcribeClip', async (event, clipId: string) => { ... })`
  - Get clip from store/flattened project
  - Check cache first by `clip.hash`
  - If cached, return immediately
  - If not cached: extract audio → run whisper → cache result → return
  - Handle errors: missing clip, missing binary, transcription failure
- [ ] Progress event emission: `event.sender.send('transcribe:progress', { clipId, progress })`
- [ ] Test: Verify IPC handler, cache hit/miss paths

##### 7. Preload API
- [ ] Add to `src/preload/preload.ts`:
  - `transcribeClip: (clipId: string) => Promise<Transcript>`
  - `onTranscribeProgress: (callback: (data: { clipId: string; progress: number }) => void) => void`
- [ ] Update `src/renderer/types.d.ts`:
  - Add `transcribeClip` and `onTranscribeProgress` signatures

##### 8. Integration & Testing
- [ ] Test end-to-end: Import clip → transcribe → verify cache → transcribe again (cache hit)
- [ ] Test error cases: Missing binary, missing model, corrupted file
- [ ] Test progress events: Verify events emitted during transcription
- [ ] Performance: 5-minute clip transcribes without blocking UI

**Acceptance Criteria:**
- ✅ `window.clipforge.transcribeClip(clipId)` returns word-level transcript
- ✅ Transcript cached to disk by hash
- ✅ Repeat calls hit cache (unless file changed)
- ✅ Progress events emitted during transcription
- ✅ Temp WAV files cleaned up after use

---

### PR AI-2 — filler-detection

**Goal:** Detect filler words & generate candidate cut ranges.

#### Tasks

##### 1. Filler Dictionary & Config
- [ ] Create `src/shared/ai/filler-dictionary.ts`:
  - `FILLERS: string[] = ["um", "uh", "like", "you know", "so", "actually", "well"]`
  - `normalizeWord(word: string): string` (lowercase, strip punctuation)
- [ ] Export filler list for UI use

##### 2. Filler Detection Logic
- [ ] Create `src/shared/ai/filler-detection.ts`:
  - `detectFillerSpans(transcript: Transcript, options?: { confMin?: number, padMs?: number }): FillerSpan[]`
  - Match transcript words against filler dictionary (normalized)
  - Apply confidence threshold (if provided, but not required)
  - Apply padding: ±40ms default
  - Merge adjacent spans if gap ≤120ms
  - Return sorted spans by start time
- [ ] Add `FillerSpan` type to `src/shared/types.ts`:
  ```typescript
  type FillerSpan = {
    clipId: string;
    word: string;
    startSec: number;
    endSec: number;
    confidence: number;
    paddedStart: number;
    paddedEnd: number;
  }
  ```

##### 3. Unit Tests
- [ ] Test word matching: "Um" → normalized → matches "um"
- [ ] Test confidence filtering: High confidence word passes, low fails (if enabled)
- [ ] Test padding: 3.0s → 2.96s and 3.04s
- [ ] Test span merging: Adjacent fillers merge, distant ones don't
- [ ] Test punctuation: "um," → "um" → matches

##### 4. IPC Handler
- [ ] Add to `src/main/ipc-handlers.ts`:
  - `ipcMain.handle('detectFillers', async (event, clipId: string, options?: { confMin?: number }) => { ... })`
  - Load transcript (from cache or transcribe first)
  - Call `detectFillerSpans`
  - Return `FillerSpan[]`
- [ ] Handle errors: Missing transcript, invalid clip

##### 5. Preload API
- [ ] Add to `src/preload/preload.ts`:
  - `detectFillers: (clipId: string, options?: { confMin?: number }) => Promise<FillerSpan[]>`
- [ ] Update `src/renderer/types.d.ts`

##### 6. Integration Test
- [ ] Test with fixture transcript JSON
- [ ] Verify spans returned match expected fillers
- [ ] Verify padding applied correctly

**Acceptance Criteria:**
- ✅ `detectFillers(clipId)` returns non-empty spans for known filler samples
- ✅ Spans include padding (±40ms)
- ✅ Adjacent fillers merged appropriately
- ✅ Confidence threshold respected (when provided)

---

### PR AI-3 — generate-cut-plan

**Goal:** Convert filler spans into actual timeline trim operations (pure function).

#### Tasks

##### 1. Types & Interfaces
- [ ] Add `CutPlan` type to `src/shared/types.ts`:
  ```typescript
  type CutPlan = {
    trackItemId: string;
    cuts: Array<{
      startSec: number;
      endSec: number;
    }>;
  }
  ```

##### 2. Cut Plan Generation (Pure Function)
- [ ] Create `src/shared/ai/generate-cut-plan.ts`:
  - `generateCutPlan(trackItems: TrackItem[], fillerSpans: FillerSpan[], options?: { rippleGapMs?: number }): CutPlan[]`
  - For each TrackItem:
    - Find overlapping filler spans (clip-relative → timeline-relative mapping)
    - Only process spans within `inSec→outSec` bounds (respect user trims)
    - Convert clip-relative filler times to timeline-relative:
      - `timelineStart = trackPosition + (filler.startSec - inSec)`
      - `timelineEnd = trackPosition + (filler.endSec - inSec)`
    - Generate fragments: `[inSec → cutStart]`, `[cutEnd → outSec]`
  - Apply ripple tighten:
    - Find adjacent fragments in same item
    - Merge if gap < `snapInterval` (from options or default)
  - Return `CutPlan[]` (one per TrackItem with cuts)
- [ ] Handle edge cases:
  - Filler at item start/end
  - Filler spans entire item (remove item)
  - Multiple fillers in one item
  - Overlapping filler spans

##### 3. Unit Tests
- [ ] **Single filler:** Middle of item → creates two fragments
- [ ] **Multiple fillers:** Multiple fragments created correctly
- [ ] **Filler at boundary:** Item start/end handled correctly
- [ ] **Filler spans entire item:** Item marked for removal
- [ ] **Multi-fragment item:** All fragments generated correctly
- [ ] **Timeline mapping:** Clip time → timeline time conversion correct
- [ ] **Ripple tighten:** Small gaps merged, large gaps preserved
- [ ] **Respect trims:** Filler outside `inSec→outSec` ignored
- [ ] **Cross-item spans:** Each item processed independently

##### 4. Helper Functions
- [ ] `clipTimeToTimelineTime(clipTime: number, item: TrackItem): number`
- [ ] `timelineTimeToClipTime(timelineTime: number, item: TrackItem): number`
- [ ] `splitItemAtCuts(item: TrackItem, cuts: Cut[]): TrackItem[]`
- [ ] `shouldMergeFragments(fragment1: TrackItem, fragment2: TrackItem, gapMs: number): boolean`

##### 5. Integration
- [ ] Export function from shared module
- [ ] Verify function is pure (no side effects, deterministic)

**Acceptance Criteria:**
- ✅ Function takes TrackItems + FillerSpans → returns CutPlan[]
- ✅ All cuts respect TrackItem trim bounds
- ✅ Timeline mapping correct for all test cases
- ✅ Ripple tighten works as expected
- ✅ Unit tests cover all edge cases
- ✅ Function is fully deterministic and testable

---

### PR AI-4 — apply-cut-plan

**Goal:** Actually update the timeline by applying cut plan.

#### Tasks

##### 1. Store Enhancements
- [ ] Add `batchUpdateTrackItems` to `src/renderer/store.ts`:
  ```typescript
  batchUpdateTrackItems: (updates: {
    add?: TrackItem[];
    remove?: string[];
    update?: Array<{ id: string; updates: Partial<TrackItem> }>;
  }) => void
  ```
  - Apply all mutations in single `set()` call
  - Prevents multiple re-renders
- [ ] Add undo snapshot state:
  - `lastAITrackItemsSnapshot: Record<string, TrackItem> | null`
  - `undoLastAICuts: () => void` (restore snapshot)
- [ ] Test: Verify batch mutations reduce re-renders

##### 2. Apply Cut Plan Function
- [ ] Create `src/renderer/ai/apply-cut-plan.ts`:
  - `applyCutPlanToStore(cutPlan: CutPlan[]): void`
  - For each plan:
    - Split TrackItems according to cuts
    - Generate new IDs using `Date.now() + Math.random()` pattern
    - Batch add new fragments, remove original items
  - Store snapshot before applying (for undo)
  - Update playhead if inside removed region (move to next fragment)
- [ ] Handle edge cases:
  - Item completely removed → just remove, no new fragments
  - Single cut → split into two fragments
  - Multiple cuts → multiple fragments

##### 3. Playhead Adjustment
- [ ] Check if playhead is inside any removed region
- [ ] If yes, find first fragment after playhead position
- [ ] Update playhead to fragment start (or keep at 0 if no fragments)
- [ ] Test: Verify playhead moves correctly

##### 4. Undo Support
- [ ] Store `trackItems` snapshot before applying cuts
- [ ] Restore snapshot on `undoLastAICuts()`
- [ ] Clear snapshot after successful apply
- [ ] Test: Verify undo restores previous state

##### 5. IPC Handler (Optional)
- [ ] Add to `src/main/ipc-handlers.ts`:
  - `ipcMain.handle('applyCutPlan', async (event, cutPlan: CutPlan[]) => { ... })`
  - Call renderer-side apply function
  - Return success/failure
- [ ] Or: Keep renderer-only (simpler, no IPC needed)

##### 6. Integration Test
- [ ] Test: Apply cut plan → verify timeline updated correctly
- [ ] Test: Undo → verify state restored
- [ ] Test: Multiple items → all updated correctly
- [ ] Test: Playhead adjustment works

**Acceptance Criteria:**
- ✅ `applyCutPlanToStore()` updates timeline correctly
- ✅ All mutations batched into single undo entry
- ✅ Playhead adjusted if inside removed region
- ✅ Undo restores previous state
- ✅ No timeline data corruption

---

### PR AI-5 — ai-assistant-ui

**Goal:** User interface to review & apply AI-based filler cleanup.

#### Tasks

##### 1. Panel Component Structure
- [ ] Create `src/renderer/components/AIAssistantPanel.tsx`
- [ ] Add panel to sidebar (or main UI area)
- [ ] Panel layout: Header, controls, filler list, action buttons
- [ ] Basic styling using existing design system (`.btn`, `.card`, etc.)

##### 2. State Management
- [ ] Component state:
  - `selectedClipId: string | null`
  - `transcript: Transcript | null`
  - `fillers: FillerSpan[]`
  - `loading: boolean`
  - `confidence: number` (0.25-0.60, default 0.35)
  - `selectedFillers: Set<string>` (for checkbox selection)
- [ ] Use Zustand if needed, or local component state

##### 3. Analyze Speech Button
- [ ] Button: "Analyze Speech" or "Transcribe Clip"
- [ ] On click:
  - Check if clip selected
  - Show loading state
  - Call `window.clipforge.transcribeClip(clipId)`
  - Listen to progress events
  - Update UI with progress
  - On complete, call `detectFillers()`
  - Update state with fillers
- [ ] Error handling: Missing binary, transcription failure
- [ ] Disable button while transcribing

##### 4. Filler List Display
- [ ] Table/list of detected fillers:
  - Columns: Time range, Word, Confidence, Preview button
  - Format time: `HH:MM:SS.mmm`
  - Checkbox per filler (for selection)
- [ ] "Select All" / "Select None" buttons
- [ ] Sort by time (ascending)
- [ ] Highlight selected fillers

##### 5. Preview Functionality
- [ ] Preview button for each filler:
  - Play 1 second before → 1 second after filler
  - Use existing Player component or video element
- [ ] Or: Jump playhead to filler time on click

##### 6. Confidence Slider
- [ ] Slider: 0.25 to 0.60, default 0.35
- [ ] Real-time update: Re-detect fillers when slider changes
- [ ] Show count: "X fillers detected"
- [ ] Debounce/throttle to avoid excessive re-detection

##### 7. Apply Actions
- [ ] Button: "Remove Selected Fillers"
  - Get selected filler IDs
  - Generate cut plan for selected fillers
  - Apply cut plan
  - Show toast: "Removed X fillers · Undo available"
  - Update UI (clear fillers, reset state)
- [ ] Button: "Remove All Fillers"
  - Apply all detected fillers
  - Show toast
- [ ] Disable buttons if no fillers selected

##### 8. Empty States
- [ ] **No clip selected:** "Select a clip to analyze"
- [ ] **No transcript:** "Click 'Analyze Speech' to transcribe"
- [ ] **No fillers found:** "No fillers detected. Try adjusting confidence."
- [ ] **Transcription failed:** "Transcription failed. Check logs. [Retry]"

##### 9. Error States
- [ ] **Missing whisper binary:** Disable analyze button, show message with install instructions
- [ ] **Missing model:** Show error with download link/instructions
- [ ] **Transcription timeout:** Show retry option
- [ ] **Generic errors:** Show user-friendly message + retry button

##### 10. Loading States
- [ ] Show progress bar during transcription
- [ ] Display progress percentage
- [ ] "Transcribing... 45%"
- [ ] Disable UI interactions during transcription

##### 11. Undo Integration
- [ ] Show "Undo Last AI Edit" button after applying cuts
- [ ] Connect to `undoLastAICuts()` from store
- [ ] Hide button if no undo available

##### 12. Styling & Polish
- [ ] Use existing design system classes
- [ ] Consistent with timeline/export panel styling
- [ ] Responsive layout
- [ ] Accessibility: Keyboard navigation, ARIA labels

##### 13. Integration Tests
- [ ] Test: Select clip → Analyze → Fillers shown
- [ ] Test: Adjust confidence → Fillers update
- [ ] Test: Select fillers → Apply → Timeline updates
- [ ] Test: Undo → State restored
- [ ] Test: Error states display correctly

**Acceptance Criteria:**
- ✅ User can analyze clip via UI button
- ✅ Detected fillers displayed in list
- ✅ User can preview fillers
- ✅ Confidence slider adjusts detection
- ✅ User can apply selected/all fillers
- ✅ Timeline updates after applying
- ✅ Undo works correctly
- ✅ Error states handled gracefully
- ✅ UI stays responsive during transcription

---

### PR AI-6 — settings-panel

**Goal:** Create Settings UI for OpenAI API key management with encrypted storage.

#### Tasks

##### 1. Config Service
- [ ] Create `src/main/config-service.ts`:
  - `getConfigPath(): string` → `~/.clipforge/config.json`
  - `loadConfig(): Promise<Config | null>` (read JSON, decrypt API key)
  - `saveConfig(config: Config): Promise<void>` (encrypt API key, write JSON)
  - `getOpenAIKey(): Promise<string | null>` (try ENV first, then config)
  - Type: `Config = { openaiApiKey?: string }` (encrypted value stored)
- [ ] Use Electron `safeStorage`:
  - `safeStorage.isEncryptionAvailable()` check
  - `safeStorage.encryptString(key)` for storage
  - `safeStorage.decryptString(encrypted)` for retrieval
- [ ] Handle cases:
  - Config file doesn't exist → return null
  - Encryption unavailable → warn user, store plaintext (fallback)
  - Invalid JSON → reset config file

##### 2. Settings UI Component
- [ ] Create `src/renderer/components/SettingsDialog.tsx`:
  - Modal overlay (fixed position, z-index high)
  - Header: "Settings" + close button
  - Tabs structure:
    - "AI Services" (default)
    - Future: "General", "Export", etc.
  - AI Services tab:
    - Section: "OpenAI API"
    - Input field: `openaiApiKey` (password type, masked)
    - Placeholder: "sk-..."
    - "Test Connection" button
    - Status indicator: "✅ Connected" / "❌ Invalid" / "Not set"
    - Save/Cancel buttons at bottom
- [ ] State management:
  - `apiKey` (local state, not persisted until Save)
  - `testStatus: 'idle' | 'testing' | 'success' | 'error'` (with message)
  - `isOpen: boolean` (controlled by App.tsx)

##### 3. Settings IPC Handlers
- [ ] Add to `src/main/ipc-handlers.ts`:
  - `ipcMain.handle('loadConfig', async () => { ... })`
  - `ipcMain.handle('saveConfig', async (event, config: Config) => { ... })`
  - `ipcMain.handle('testOpenAIConnection', async (event, apiKey: string) => { ... })`
- [ ] Test connection logic:
  - Send minimal request to `/v1/models` endpoint
  - Check status code 200
  - Return `{ success: boolean, message: string }`

##### 4. Preload API
- [ ] Add to `src/preload/preload.ts`:
  - `loadConfig: () => Promise<Config | null>`
  - `saveConfig: (config: Config) => Promise<void>`
  - `testOpenAIConnection: (apiKey: string) => Promise<{ success: boolean, message: string }>`
- [ ] Update `src/renderer/types.d.ts` with types

##### 5. Integration
- [ ] Add Settings button to `src/renderer/App.tsx` header:
  - Icon: ⚙️ or gear icon
  - Position: top-right
  - Opens `SettingsDialog` modal
- [ ] Load config on app startup:
  - Call `loadConfig()` in `useEffect` or main process
  - Store in global state if needed

##### 6. Error Handling
- [ ] Handle encryption unavailable:
  - Show warning: "Secure storage not available. Key will be stored in plaintext."
  - Option to proceed or cancel
- [ ] Handle invalid key format:
  - Validate: starts with "sk-"
  - Show error inline
- [ ] Handle write permissions:
  - Try/catch on config save
  - Show user-friendly error

**Acceptance Criteria:**
- ✅ Settings button opens modal
- ✅ API key can be entered and saved
- ✅ Key is encrypted using safeStorage
- ✅ Config file saved to `~/.clipforge/config.json`
- ✅ Test connection validates key
- ✅ Key loaded on app startup
- ✅ Environment variable `OPENAI_API_KEY` takes precedence

**File Structure:**
```
src/main/
  ├── config-service.ts (NEW)
  └── ipc-handlers.ts (MODIFY)

src/renderer/
  ├── components/
  │   └── SettingsDialog.tsx (NEW)
  └── App.tsx (MODIFY - add settings button)

src/preload/
  └── preload.ts (MODIFY)

src/shared/
  └── types.ts (ADD Config type)
```

---

### PR AI-7 — transcript-and-review-ipc

**Goal:** Add IPC handlers for fresh transcription and OpenAI script review.

#### Tasks

##### 1. Fresh Transcription Handler
- [ ] Update `src/main/ipc-handlers.ts`:
  - Modify `transcribeClipByPath` to add `forceFresh?: boolean` parameter
  - OR create new handler: `transcribeClipFresh(clipPath: string, clipHash?: string)`
  - Bypass cache check when `forceFresh === true`
  - Always run Whisper (fresh transcription)
- [ ] Update `src/main/ai/whisper-runner.ts` if needed:
  - Ensure it works without cache dependency
- [ ] Update preload API:
  - `transcribeClipFresh: (clipPath: string) => Promise<Transcript>`

##### 2. OpenAI Service
- [ ] Create `src/main/ai/openai-service.ts`:
  - `getApiKey(): Promise<string | null>` (env var or config)
  - `reviewTranscript(transcript: string, context: 'casual' | 'interview' | 'social' | 'business'): Promise<ScriptReview>`
  - Build prompt using template from spec
  - Call `/v1/chat/completions` endpoint:
    - Model: `gpt-4o-mini`
    - Temperature: 0.7
    - Response format: JSON (if supported) or parse JSON from content
  - Handle errors:
    - Invalid API key (401)
    - Rate limit (429)
    - Network errors
    - JSON parsing errors
- [ ] Type definitions:
  ```typescript
  type ScriptReview = {
    summary: string
    clarityNotes: string[]
    pacingNotes: string[]
    fillerNotes: string[]
    suggestions: Array<{
      original: string
      improved: string
    }>
  }
  ```
- [ ] Add to `src/shared/types.ts`

##### 3. Review IPC Handler
- [ ] Add to `src/main/ipc-handlers.ts`:
  - `ipcMain.handle('reviewTranscript', async (event, clipPath: string, context: string) => { ... })`
  - Flow:
    1. Load transcript (fresh via `transcribeClipFresh`)
    2. Get OpenAI API key (env or config)
    3. If no key → throw error with user-friendly message
    4. Call `openaiService.reviewTranscript(transcriptText, context)`
    5. Return `ScriptReview` JSON
  - Handle errors gracefully:
    - Missing API key → emit IPC error event
    - OpenAI API failure → return error message
    - Transcription failure → propagate error

##### 4. Cost Estimation Helper
- [ ] Create `src/shared/ai/cost-estimator.ts`:
  - `estimateReviewCost(transcriptLength: number): { tokens: number, cost: number }`
  - Rough calculation:
    - Input tokens: ~transcriptLength / 4 (characters to tokens)
    - Output tokens: ~500 (estimated JSON response)
    - Cost: (input * $0.15 + output * $0.60) / 1M tokens (gpt-4o-mini pricing)
  - Return: `{ estimatedTokens: number, estimatedCost: number, costInCents: number }`

##### 5. Preload API
- [ ] Add to `src/preload/preload.ts`:
  - `transcribeClipFresh: (clipPath: string) => Promise<Transcript>`
  - `reviewTranscript: (clipPath: string, context: string) => Promise<ScriptReview>`
  - `estimateReviewCost: (transcriptLength: number) => Promise<{ estimatedTokens: number, estimatedCost: number }>`
- [ ] Update `src/renderer/types.d.ts`

##### 6. Error Events
- [ ] Add IPC events:
  - `transcription:progress` (reuse from AI-1)
  - `transcription:error` (reuse from AI-1)
  - `review:progress` (optional, for future)
  - `review:error` (new)

**Acceptance Criteria:**
- ✅ `transcribeClipFresh` always runs Whisper (no cache)
- ✅ `reviewTranscript` returns structured JSON
- ✅ Missing API key shows user-friendly error
- ✅ Cost estimation accurate within reasonable bounds
- ✅ All OpenAI errors handled gracefully
- ✅ Transcript text properly formatted in prompt

**File Structure:**
```
src/main/
  ├── ai/
  │   ├── openai-service.ts (NEW)
  │   └── whisper-runner.ts (MODIFY - ensure fresh mode)
  └── ipc-handlers.ts (MODIFY)

src/shared/
  ├── ai/
  │   └── cost-estimator.ts (NEW)
  └── types.ts (ADD ScriptReview type)

src/preload/
  └── preload.ts (MODIFY)
```

---

### PR AI-8 — script-review-ui

**Goal:** Build Script Review tab UI in AI Assistant panel with context selection and feedback display.

#### Tasks

##### 1. AI Assistant Panel Tabs
- [ ] Update `src/renderer/components/AIAssistantPanel.tsx`:
  - Add tab state: `[activeTab, setActiveTab] = useState<'fillers' | 'review'>`
  - Tab buttons:
    - "🔍 Fillers" (existing)
    - "📝 Script Review" (new)
  - Render content based on active tab
  - Keep existing filler detection UI in "Fillers" tab

##### 2. Script Review Tab Content
- [ ] Create `src/renderer/components/ScriptReviewTab.tsx`:
  - Props: `selectedClipId: string | null`, `clips: Record<string, Clip>`
  - State:
    - `selectedContext: 'casual' | 'interview' | 'social' | 'business' | null`
    - `isTranscribing: boolean`
    - `isReviewing: boolean`
    - `review: ScriptReview | null`
    - `error: string | null`
    - `estimatedCost: { tokens: number, cost: number } | null`
  - Layout:
    - Context dropdown (top)
    - Cost estimate display (conditional)
    - "Generate Review" button
    - Loading states
    - Error display
    - Review sections (conditional)

##### 3. Context Dropdown
- [ ] Add `<select>` with options:
  - `<option value="casual">Casual</option>`
  - `<option value="interview">Interview</option>`
  - `<option value="social">Social Media</option>`
  - `<option value="business">Business</option>`
  - Disable when no clip selected or processing

##### 4. Review Generation Flow
- [ ] Handle button click:
  1. Validate: clip selected + context selected
  2. Check API key (call `loadConfig()` or check error state)
  3. If no key → show error: "Please set OpenAI API key in Settings"
  4. Estimate cost (use transcript length estimate or wait for transcript)
  5. Show "Transcribing..." state
  6. Call `transcribeClipFresh(clipPath)`
  7. On complete, estimate cost based on actual transcript length
  8. Show cost estimate: "Estimated cost: $X.XX. Continue?"
  9. Show "Analyzing..." state
  10. Call `reviewTranscript(clipPath, context)`
  11. Display review results

##### 5. Review Display Sections
- [ ] Summary section:
  - Card/panel with review summary text
  - Styled with background + border
- [ ] Clarity section:
  - Heading: "Clarity"
  - List items from `clarityNotes`
  - Bullet list styling
- [ ] Pacing section:
  - Heading: "Pacing & Delivery"
  - List items from `pacingNotes`
- [ ] Filler section:
  - Heading: "Filler Usage"
  - Display `fillerNotes` array
  - Optional: Link to Fillers tab if fillers detected
- [ ] Suggestions section:
  - Heading: "Improvement Suggestions"
  - For each suggestion:
    - Display `original` text
    - Display `improved` text
    - Copy button (copy improved text to clipboard)
    - Visual diff styling (gray for original, green for improved)

##### 6. Loading States
- [ ] Transcription loading:
  - Progress bar + message: "Transcribing audio..."
  - Listen to `transcription:progress` events
- [ ] Review loading:
  - Spinner + message: "Analyzing script..."
  - No progress (OpenAI doesn't emit progress)
  - Estimated wait time: "This may take 10-30 seconds"

##### 7. Error States
- [ ] Missing API key:
  - Card with warning icon
  - Message: "OpenAI API key required"
  - Button: "Open Settings" → opens SettingsDialog
- [ ] Transcription error:
  - Display error message
  - Retry button
- [ ] Review error:
  - Display error (rate limit, invalid key, etc.)
  - Retry button
- [ ] Network error:
  - User-friendly message
  - Retry button

##### 8. Cost Display
- [ ] Show before review:
  - Text: "Estimated cost: $X.XX (approximately Y tokens)"
  - Small text: "Based on transcript length"
- [ ] Styling:
  - Info badge/chip
  - Position: below context dropdown or above button

##### 9. Empty States
- [ ] No clip selected:
  - Message: "Select a clip to review"
  - Icon or placeholder
- [ ] No review yet:
  - Message: "Generate a review to see feedback"
  - Placeholder UI

##### 10. Integration
- [ ] Update `AIAssistantPanel.tsx`:
  - Import `ScriptReviewTab`
  - Add tab buttons
  - Conditional render: Fillers tab vs Review tab
  - Share `selectedClipId` logic (if needed)

##### 11. Styling & Polish
- [ ] Use existing design system:
  - `.btn`, `.panel`, `.card` classes
  - Consistent spacing and colors
  - Responsive layout
- [ ] Accessibility:
  - ARIA labels for buttons
  - Keyboard navigation for tabs
  - Focus management

**Acceptance Criteria:**
- ✅ Script Review tab visible in AI Assistant
- ✅ Context dropdown works
- ✅ Cost estimate displayed before review
- ✅ Review generates and displays correctly
- ✅ All error states handled
- ✅ Copy buttons work for suggestions
- ✅ Loading states clear and informative
- ✅ UI matches design system

**File Structure:**
```
src/renderer/
  └── components/
      ├── AIAssistantPanel.tsx (MODIFY - add tabs)
      └── ScriptReviewTab.tsx (NEW)
```

---

## Implementation Order

1. **PR AI-6** (Foundation): Settings panel + API key storage
2. **PR AI-7** (Backend): IPC handlers + OpenAI service
3. **PR AI-8** (Frontend): UI tab + review display

## Dependencies

- PR AI-1: Whisper transcription (already done, needs fresh mode)
- OpenAI API account: User provides key
- Node modules: `node-fetch` or `axios` for HTTP requests

## Testing Checklist

**PR AI-6:**
- [ ] Settings modal opens/closes
- [ ] API key saves and encrypts
- [ ] Config file created at `~/.clipforge/config.json`
- [ ] Test connection validates key
- [ ] Environment variable `OPENAI_API_KEY` works

**PR AI-7:**
- [ ] `transcribeClipFresh` bypasses cache
- [ ] `reviewTranscript` calls OpenAI correctly
- [ ] Returns structured JSON
- [ ] Handles missing key error
- [ ] Handles rate limit error
- [ ] Cost estimation accurate

**PR AI-8:**
- [ ] Tab switching works
- [ ] Context dropdown functional
- [ ] Review generation completes
- [ ] All sections display correctly
- [ ] Copy buttons work
- [ ] Error states show properly
- [ ] Cost estimate displays

---

## Implementation Order Recommendation

**⚠️ IMPORTANT: Before starting PR AI-1, complete the "Setup Checklist" in "Dependencies & Prerequisites" section above**

1. **Download & Set Up Whisper Resources** (Prerequisite)
   - Download Whisper.cpp binaries for target platforms
   - Download `ggml-base.en.bin` model file
   - Place files in correct directory structure
   - Verify binaries work: `./bin/whisper/darwin/whisper --help`
   - Add electron-builder config for packaging

2. **Start with PR AI-1** — Foundation for everything else
3. **Then AI-2** — Simple pure function, testable independently
4. **Then AI-3** — Core logic, fully testable
5. **Then AI-4** — Store integration, ties everything together
6. **Finally AI-5** — UI polish, user-facing features

**AI-6** can be implemented anytime after core features work, or deferred indefinitely.

---

## Quick Setup Reminder

**Before implementing PR AI-1, you must:**

1. ✅ Download Whisper.cpp binary for macOS to `bin/whisper/darwin/whisper`
2. ✅ Download `ggml-base.en.bin` model to `resources/models/whisper/ggml-base.en.bin`
3. ✅ Verify binary works: Test `./bin/whisper/darwin/whisper --help` in terminal
4. ✅ Update electron-builder config for packaging (optional until first build)

**Without these files, PR AI-1 implementation will fail at binary path resolution step.**

---

## Edge Cases Handled

1. **Missing whisper binary:** Show error in UI, disable analyze button
2. **Transcription failure:** Silent audio, corrupted file → Retry + log
3. **Model file missing:** Error message with instructions
4. **Multiple fillers adjacent:** Merge spans if gap ≤120ms
5. **Filler at item boundary:** Split item correctly
6. **Filler spans entire item:** Remove item entirely
7. **Cross-item filler spans:** Apply cuts to each overlapping item
8. **Cache invalidation:** Hash-based lookup ensures freshness

---

## Future Enhancements (Post-MVP)

- **Batch processing:** Analyze multiple clips at once
- **Manual filler dictionary:** User-configurable filler words
- **Language detection:** Auto-detect language, select appropriate model
- **Stemming:** Better filler word matching
- **Advanced prompting:** Chat interface for AI agent control (MCP)
- **Transcript viewer:** Full transcript with highlight/editing
- **Model selection:** UI to swap between base/medium models
- **Confidence visualization:** Show confidence scores in UI

---

## Success Criteria

✅ **MVP Complete When:**
- User can transcribe a clip via UI button
- Filler words are detected and displayed
- User can preview detected fillers
- User can apply cuts with single undo action
- All cuts respect existing trim bounds
- Timeline updates correctly after applying cuts
- Error states are handled gracefully

---

## Notes

- **Transcripts are immutable** — no editing, only deletion via cuts
- **Cuts are non-destructive** — represented as timeline edits, not transcript changes
- **Offline-first** — no cloud dependencies, all processing local
- **Testable** — core logic in pure functions with unit tests

