/**
 * Cost Estimation Helper
 * 
 * Estimates OpenAI API costs for transcript reviews.
 * Based on GPT-4o-mini pricing (as of 2024):
 * - Input: $0.15 per 1M tokens
 * - Output: $0.60 per 1M tokens
 */

/**
 * Estimate token count from text
 * Rough approximation: ~4 characters per token for English text
 */
function estimateTokens(text: string): number {
  // Remove whitespace and count characters
  const chars = text.replace(/\s+/g, ' ').trim().length
  // Token approximation: roughly 4 characters per token
  return Math.ceil(chars / 4)
}

/**
 * Estimate review cost based on transcript length
 * 
 * @param transcriptLength Character length of transcript text
 * @returns Cost estimate with token counts
 */
export function estimateReviewCost(transcriptLength: number): {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCost: number
  estimatedCostFormatted: string
} {
  // Estimate input tokens (transcript + prompt)
  const transcriptTokens = estimateTokens(' '.repeat(transcriptLength)) // Approximate
  const promptOverhead = 200 // Base prompt tokens
  const estimatedInputTokens = transcriptTokens + promptOverhead

  // Estimate output tokens (JSON response)
  // Typical review response: ~400-800 tokens depending on transcript length
  const baseOutputTokens = 400
  const variableOutputTokens = Math.floor(transcriptTokens * 0.1) // 10% of input for suggestions
  const estimatedOutputTokens = baseOutputTokens + variableOutputTokens

  // Calculate cost (GPT-4o-mini pricing)
  const inputCostPerMillion = 0.15
  const outputCostPerMillion = 0.60

  const inputCost = (estimatedInputTokens / 1_000_000) * inputCostPerMillion
  const outputCost = (estimatedOutputTokens / 1_000_000) * outputCostPerMillion
  const estimatedCost = inputCost + outputCost

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost,
    estimatedCostFormatted: estimatedCost < 0.01 
      ? '< $0.01' 
      : `$${estimatedCost.toFixed(4)}`,
  }
}

