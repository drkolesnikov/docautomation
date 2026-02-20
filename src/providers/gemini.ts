import type { ProviderAdapter } from './types';
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
    userMessage: string,
    _model: string,
    maxOutputTokens: number
  ): object {
    return {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
      },
    };
  },

  parseStreamChunk(chunk: string): string | null {
    const lines = chunk.split('\n');
    let result = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      const data = trimmed.slice(6);

      try {
        const parsed = JSON.parse(data) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          result += text;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }

    return result.length > 0 ? result : null;
  },

  isMaxTokensTruncation(chunk: string): boolean {
    const lines = chunk.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      const data = trimmed.slice(6);

      try {
        const parsed = JSON.parse(data) as {
          candidates?: Array<{
            finishReason?: string;
          }>;
        };
        if (parsed.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
          return true;
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return false;
  },

  async validateKey(apiKey: string, baseUrl: string): Promise<boolean> {
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
      );
      return response.status !== 400 && response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  },
};
