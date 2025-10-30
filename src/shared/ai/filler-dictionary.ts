/**
 * Filler Word Dictionary
 * 
 * Common filler words and phrases to detect in speech transcripts.
 * Used for automatic detection and removal in the AI assistant.
 */
export const FILLERS: string[] = [
  'um',
  'uh',
  'like',
  'you know',
  'so',
  'actually',
  'well',
]

/**
 * Normalize a word for filler matching
 * - Converts to lowercase
 * - Strips punctuation (.,!?;:)
 * - Trims whitespace
 * 
 * @param word Word to normalize
 * @returns Normalized word for matching
 * 
 * @example
 * normalizeWord("Um,") → "um"
 * normalizeWord("Uh?") → "uh"
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .trim()
}

/**
 * Check if a word matches any filler (after normalization)
 * 
 * @param word Word to check
 * @returns True if word matches a filler
 */
export function isFiller(word: string): boolean {
  const normalized = normalizeWord(word)
  return FILLERS.includes(normalized)
}

