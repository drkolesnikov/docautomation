import type { ProviderAdapter } from './types';
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
    userMessage: string,
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
      messages: [
        { role: 'system', text: systemPrompt },
        { role: 'user', text: userMessage },
      ],
    };
  },

  parseStreamChunk(chunk: string): string | null {
    const lines = chunk.split('\n');
    let lastText: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      const data = trimmed.slice(6);

      try {
        const parsed = JSON.parse(data) as {
          result?: {
            alternatives?: Array<{
              message?: { text?: string };
            }>;
          };
        };
        const text = parsed.result?.alternatives?.[0]?.message?.text;
        if (text !== undefined) {
          // YandexGPT returns full accumulated text, not deltas.
          // We return the latest full text; the streaming hook should
          // replace (not append) when using this adapter.
          lastText = text;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }

    return lastText;
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
          result?: {
            alternatives?: Array<{
              status?: string;
            }>;
          };
        };
        if (parsed.result?.alternatives?.[0]?.status === 'ALTERNATIVE_STATUS_TRUNCATED_FINAL') {
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
      );
      // Any response that isn't an auth error means the key is valid
      // (the request may fail due to invalid folderId, but auth is OK)
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  },
};
