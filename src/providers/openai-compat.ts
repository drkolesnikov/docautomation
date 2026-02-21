import type { ProviderAdapter } from './types';
import { proxyFetch } from '../utils/proxyFetch';

export const openaiCompatAdapter: ProviderAdapter = {
  buildRequestUrl(baseUrl: string, _model: string, _apiKey: string): string {
    return `${baseUrl}/v1/chat/completions`;
  },

  formatHeaders(apiKey: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  },

  formatRequest(
    systemPrompt: string,
    userMessage: string,
    model: string,
    maxOutputTokens: number
  ): object {
    return {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxOutputTokens,
      stream: true,
    };
  },

  parseStreamChunk(chunk: string): string | null {
    const lines = chunk.split('\n');
    let result = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || !trimmed.startsWith('data: ')) {
        continue;
      }

      const data = trimmed.slice(6);

      if (data === '[DONE]') {
        return result.length > 0 ? result : null;
      }

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string };
          }>;
        };
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          result += content;
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

      if (data === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            finish_reason?: string;
          }>;
        };
        if (parsed.choices?.[0]?.finish_reason === 'length') {
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
      const response = await proxyFetch(
        `${baseUrl}/v1/chat/completions`,
        {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        },
      );
      // 401/403 = bad key; anything else (200, 400, 429…) = key was accepted
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  },
};
