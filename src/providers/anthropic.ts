import type { ProviderAdapter } from './types';
import { proxyFetch } from '../utils/proxyFetch';

export const anthropicAdapter: ProviderAdapter = {
  buildRequestUrl(baseUrl: string, _model: string, _apiKey: string): string {
    return `${baseUrl}/v1/messages`;
  },

  formatHeaders(apiKey: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
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
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxOutputTokens,
      stream: true,
    };
  },

  parseStreamChunk(chunk: string): string | null {
    const lines = chunk.split('\n');
    let result = '';
    let currentEvent = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('event: ')) {
        currentEvent = trimmed.slice(7);
        continue;
      }

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      const data = trimmed.slice(6);

      if (currentEvent === 'content_block_delta') {
        try {
          const parsed = JSON.parse(data) as {
            delta?: { text?: string };
          };
          const text = parsed.delta?.text;
          if (text) {
            result += text;
          }
        } catch {
          // Skip malformed JSON
        }
      }

      // Reset event after processing its data
      currentEvent = '';
    }

    return result.length > 0 ? result : null;
  },

  isMaxTokensTruncation(chunk: string): boolean {
    const lines = chunk.split('\n');
    let currentEvent = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('event: ')) {
        currentEvent = trimmed.slice(7);
        continue;
      }

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      const data = trimmed.slice(6);

      if (currentEvent === 'message_delta') {
        try {
          const parsed = JSON.parse(data) as {
            delta?: { stop_reason?: string };
          };
          if (parsed.delta?.stop_reason === 'max_tokens') {
            return true;
          }
        } catch {
          // Skip malformed JSON
        }
      }

      currentEvent = '';
    }

    return false;
  },

  async validateKey(apiKey: string, baseUrl: string): Promise<boolean> {
    try {
      const response = await proxyFetch(
        `${baseUrl}/v1/messages`,
        {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        {
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        },
      );
      // Any response that isn't a 401/403 means the key is valid
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  },
};
