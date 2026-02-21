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
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    try {
      const parsed = JSON.parse(chunk) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (
        parsed.type === 'content_block_delta' &&
        parsed.delta?.type === 'text_delta'
      ) {
        return parsed.delta.text ?? null;
      }
    } catch {
      // Skip malformed JSON
    }
    return null;
  },

  isMaxTokensTruncation(chunk: string): boolean {
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    try {
      const parsed = JSON.parse(chunk) as {
        type?: string;
        delta?: { stop_reason?: string };
      };
      return (
        parsed.type === 'message_delta' &&
        parsed.delta?.stop_reason === 'max_tokens'
      );
    } catch {
      return false;
    }
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
