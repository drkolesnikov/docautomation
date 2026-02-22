import type { ProviderAdapter, ConversationMessage } from './types';
import { proxyFetch } from '../utils/proxyFetch';

/**
 * YandexGPT adapter.
 *
 * Model parameter convention: the `model` string passed into formatRequest
 * must be in the format "folderId/modelName" (e.g., "b1g12345abc/yandexgpt-lite").
 * The adapter splits on "/" to construct the full model URI:
 *   gpt://<folderId>/<modelName>/latest
 *
 * NOTE: YandexGPT streaming returns the FULL accumulated text in each chunk,
 * not incremental deltas. The streaming hook that consumes this adapter must
 * SET (replace) the output text on each chunk rather than appending.
 */
export const yandexgptAdapter: ProviderAdapter = {
  buildRequestUrl(baseUrl: string, _model: string, _apiKey: string): string {
    return `${baseUrl}/foundationModels/v1/completion`;
  },

  formatHeaders(apiKey: string): Record<string, string> {
    return {
      'Authorization': `Api-Key ${apiKey}`,
      'Content-Type': 'application/json',
      'x-data-logging-enabled': 'false',
    };
  },

  formatRequest(
    systemPrompt: string,
    messages: ConversationMessage[],
    model: string,
    maxOutputTokens: number
  ): object {
    // model is expected in "folderId/modelName" format
    const slashIndex = model.indexOf('/');
    let modelUri: string;

    if (slashIndex !== -1) {
      const folderId = model.substring(0, slashIndex);
      const modelName = model.substring(slashIndex + 1);
      modelUri = `gpt://${folderId}/${modelName}/latest`;
    } else {
      // Fallback: if no folderId in model string, use model as-is
      // This will likely fail, but avoids crashing
      modelUri = model;
    }

    return {
      modelUri,
      completionOptions: {
        stream: true,
        maxTokens: maxOutputTokens,
      },
      // YandexGPT uses 'text' instead of 'content', but supports 'user'/'assistant' roles
      messages: [
        { role: 'system', text: systemPrompt },
        ...messages.map((m) => ({ role: m.role, text: m.content })),
      ],
    };
  },

  parseStreamChunk(chunk: string): string | null {
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    // YandexGPT returns the full accumulated text in each chunk, not deltas.
    // The streaming hook replaces (not appends) output when using this adapter.
    try {
      const parsed = JSON.parse(chunk) as {
        result?: {
          alternatives?: Array<{
            message?: { text?: string };
          }>;
        };
      };
      return parsed.result?.alternatives?.[0]?.message?.text ?? null;
    } catch {
      return null;
    }
  },

  isMaxTokensTruncation(chunk: string): boolean {
    // The streaming hook already strips the "data: " prefix; chunk is raw JSON.
    try {
      const parsed = JSON.parse(chunk) as {
        result?: {
          alternatives?: Array<{ status?: string }>;
        };
      };
      return (
        parsed.result?.alternatives?.[0]?.status ===
        'ALTERNATIVE_STATUS_TRUNCATED_FINAL'
      );
    } catch {
      return false;
    }
  },

  async validateKey(apiKey: string, baseUrl: string, proxyUrl?: string): Promise<boolean> {
    try {
      const response = await proxyFetch(
        `${baseUrl}/foundationModels/v1/completion`,
        {
          'Authorization': `Api-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'x-data-logging-enabled': 'false',
        },
        {
          modelUri: 'gpt://test/yandexgpt-lite/latest',
          completionOptions: {
            stream: false,
            maxTokens: 1,
          },
          messages: [
            { role: 'user', text: 'Hi' },
          ],
        },
        undefined,
        proxyUrl,
      );
      // Any response that isn't an auth error means the key is valid
      // (the request may fail due to invalid folderId, but auth is OK)
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  },
};
