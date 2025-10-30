import { configService } from '../config-service'
import type { ScriptReview } from '../../shared/types'

/**
 * OpenAI Service
 * 
 * Handles OpenAI API calls for script review.
 */
class OpenAIService {
  private readonly API_BASE = 'https://api.openai.com/v1'
  private readonly MODEL = 'gpt-4o-mini'

  /**
   * Get OpenAI API key
   */
  private async getApiKey(): Promise<string> {
    const key = await configService.getOpenAIKey()
    if (!key) {
      throw new Error('OpenAI API key not found. Please set it in Settings.')
    }
    return key
  }

  /**
   * Review transcript and return structured feedback
   * 
   * @param transcriptText Full transcript text (from words array)
   * @param context Review context (casual, interview, social, business)
   * @returns ScriptReview with feedback and suggestions
   */
  async reviewTranscript(
    transcriptText: string,
    context: 'casual' | 'interview' | 'social' | 'business'
  ): Promise<ScriptReview> {
    const apiKey = await this.getApiKey()

    const prompt = this.buildPrompt(transcriptText, context)

    try {
      const response = await fetch(`${this.API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a speaking style coach. Return your response as valid JSON only, no additional text.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }, // Request JSON mode
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`
        
        if (response.status === 401) {
          errorMessage = 'Invalid OpenAI API key. Please check your Settings.'
        } else if (response.status === 429) {
          errorMessage = 'OpenAI API rate limit exceeded. Please try again later.'
        } else if (response.status >= 500) {
          errorMessage = 'OpenAI API server error. Please try again later.'
        }

        throw new Error(errorMessage)
      }

      const data = await response.json() as any
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('No response content from OpenAI')
      }

      // Parse JSON response
      let review: ScriptReview
      try {
        review = JSON.parse(content)
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\{.*\})\s*```/s)
        if (jsonMatch) {
          review = JSON.parse(jsonMatch[1])
        } else {
          throw new Error('Failed to parse OpenAI response as JSON')
        }
      }

      // Validate structure
      if (!review.summary || !Array.isArray(review.clarityNotes)) {
        throw new Error('Invalid review structure returned from OpenAI')
      }

      // Ensure all required fields exist
      return {
        summary: review.summary || '',
        clarityNotes: Array.isArray(review.clarityNotes) ? review.clarityNotes : [],
        pacingNotes: Array.isArray(review.pacingNotes) ? review.pacingNotes : [],
        fillerNotes: Array.isArray(review.fillerNotes) ? review.fillerNotes : [],
        suggestions: Array.isArray(review.suggestions) ? review.suggestions : [],
      }
    } catch (error: any) {
      if (error.message.includes('API key')) {
        throw error
      }
      if (error.message.includes('rate limit')) {
        throw error
      }
      throw new Error(`OpenAI API request failed: ${error.message}`)
    }
  }

  /**
   * Build prompt for script review
   */
  private buildPrompt(transcriptText: string, context: string): string {
    const contextDescriptions: Record<string, string> = {
      casual: 'Casual: Conversational, friendly tone',
      interview: 'Interview: Concise and structured',
      social: 'Social Media: High energy, catchy',
      business: 'Business: Professional, formal',
    }

    return `You are a speaking style coach. The following text is a direct transcript of spoken speech, not written prose. The goal is to improve clarity, pacing, and delivery — without changing the speaker's meaning or personality.

Context: ${context} (${contextDescriptions[context] || context})

Instructions:
1. Identify filler words, rambling, or repetition.
2. Suggest improvements in clarity and pacing.
3. Rewrite selected sentences to sound more confident and natural.
4. Keep tone and personality consistent with the selected context.
5. Do NOT add new information.

Return response in the following JSON structure:

{
  "summary": "Overall assessment of the script",
  "clarityNotes": ["Note 1 about clarity", "Note 2"],
  "pacingNotes": ["Note 1 about pacing", "Note 2"],
  "fillerNotes": ["Note 1 about fillers", "Note 2"],
  "suggestions": [
    { "original": "Original sentence", "improved": "Improved version" }
  ]
}

Transcript:
${transcriptText}`
  }
}

export const openaiService = new OpenAIService()

