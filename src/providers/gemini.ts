import type { ProviderAdapter, ConversationMessage } from './types';
import { proxyFetch } from '../utils/proxyFetch';

export const geminiAdapter: ProviderAdapter = {
  buildRequestUrl(baseUrl: string, model: string, apiKey: string): string {
    return `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  },

  formatHeaders(_apiKey: string): Record<string, string> {
    // Gemini uses API key in URL query string, not in headers
    return {};
  },

  formatRequest(
    systemPrompt: string,
    messages: ConversationMessage[],
    _model: string,
    maxOutputTokens: number
  ): object {
    return {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      // Gemini uses 'model' role for assistant, not 'assistant'
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens,
      },
    };
  },

  parseStreamChunk(chunk: string): string | null {
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    try {
      const parsed = JSON.parse(chunk) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };
      return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch {
      return null;
    }
  },

  isMaxTokensTruncation(chunk: string): boolean {
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    try {
      const parsed = JSON.parse(chunk) as {
        candidates?: Array<{ finishReason?: string }>;
      };
      return parsed.candidates?.[0]?.finishReason === 'MAX_TOKENS';
    } catch {
      return false;
    }
  },

  async validateKey(apiKey: string, baseUrl: string, proxyUrl?: string): Promise<boolean> {
    try {
      // For Gemini, API key goes in the URL, not headers
      const url = `${baseUrl}/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await proxyFetch(
        url,
        {},
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Hi' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1,
          },
        },
        undefined,
        proxyUrl,
      );
      return response.status !== 400 && response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  },
};
