import type { ProviderAdapter, ConversationMessage } from './types';
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
    messages: ConversationMessage[],
    model: string,
    maxOutputTokens: number
  ): object {
    return {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: maxOutputTokens,
      stream: true,
    };
  },

  parseStreamChunk(chunk: string): string | null {
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    try {
      const parsed = JSON.parse(chunk) as {
        choices?: Array<{
          delta?: { content?: string };
          finish_reason?: string;
        }>;
      };
      return parsed.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  },

  isMaxTokensTruncation(chunk: string): boolean {
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    try {
      const parsed = JSON.parse(chunk) as {
        choices?: Array<{ finish_reason?: string }>;
      };
      return parsed.choices?.[0]?.finish_reason === 'length';
    } catch {
      return false;
    }
  },

  async validateKey(apiKey: string, baseUrl: string, proxyUrl?: string): Promise<boolean> {
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
        undefined,
        proxyUrl,
      );
      // 401/403 = bad key; anything else (200, 400, 429…) = key was accepted
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  },
};
