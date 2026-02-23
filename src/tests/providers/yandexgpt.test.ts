import { describe, it, expect } from 'vitest';
import { yandexgptAdapter } from '../../providers/yandexgpt';
import type { ConversationMessage } from '../../providers/types';

const msgs: ConversationMessage[] = [
  { role: 'user', content: 'Привет' },
  { role: 'assistant', content: 'Здравствуйте' },
];

describe('yandexgptAdapter.buildRequestUrl', () => {
  it('appends /foundationModels/v1/completion to the base URL', () => {
    expect(
      yandexgptAdapter.buildRequestUrl('https://llm.api.cloud.yandex.net', '', '')
    ).toBe('https://llm.api.cloud.yandex.net/foundationModels/v1/completion');
  });
});

describe('yandexgptAdapter.formatHeaders', () => {
  it('uses "Api-Key" prefix, not "Bearer"', () => {
    const headers = yandexgptAdapter.formatHeaders('my-yandex-key');
    expect(headers['Authorization']).toBe('Api-Key my-yandex-key');
  });

  it('sets Content-Type to application/json', () => {
    const headers = yandexgptAdapter.formatHeaders('key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('disables data logging', () => {
    const headers = yandexgptAdapter.formatHeaders('key');
    expect(headers['x-data-logging-enabled']).toBe('false');
  });
});

describe('yandexgptAdapter.formatRequest', () => {
  it('parses folderId/modelName into gpt:// URI', () => {
    const req = yandexgptAdapter.formatRequest(
      'sys', msgs, 'folder123/yandexgpt-lite', 2000
    ) as { modelUri: string };
    expect(req.modelUri).toBe('gpt://folder123/yandexgpt-lite/latest');
  });

  it('falls back to model string as-is when no "/" present', () => {
    const req = yandexgptAdapter.formatRequest(
      'sys', msgs, 'plainmodel', 2000
    ) as { modelUri: string };
    expect(req.modelUri).toBe('plainmodel');
  });

  it('uses "text" field (not "content") for message body', () => {
    const req = yandexgptAdapter.formatRequest('sys', msgs, 'f/m', 1000) as {
      messages: Array<{ role: string; text: string }>;
    };
    for (const m of req.messages) {
      expect('text' in m).toBe(true);
      expect('content' in m).toBe(false);
    }
  });

  it('prepends system message with the system prompt', () => {
    const req = yandexgptAdapter.formatRequest('my system', msgs, 'f/m', 1000) as {
      messages: Array<{ role: string; text: string }>;
    };
    expect(req.messages[0].role).toBe('system');
    expect(req.messages[0].text).toBe('my system');
  });

  it('includes all conversation messages after system message', () => {
    const req = yandexgptAdapter.formatRequest('sys', msgs, 'f/m', 1000) as {
      messages: Array<{ role: string; text: string }>;
    };
    // messages[0] is system; the rest are user/assistant
    expect(req.messages).toHaveLength(3);
    expect(req.messages[1].role).toBe('user');
    expect(req.messages[1].text).toBe('Привет');
    expect(req.messages[2].role).toBe('assistant');
    expect(req.messages[2].text).toBe('Здравствуйте');
  });

  it('sets maxTokens in completionOptions', () => {
    const req = yandexgptAdapter.formatRequest('sys', msgs, 'f/m', 3000) as {
      completionOptions: { maxTokens: number; stream: boolean };
    };
    expect(req.completionOptions.maxTokens).toBe(3000);
    expect(req.completionOptions.stream).toBe(true);
  });
});

describe('yandexgptAdapter.parseStreamChunk', () => {
  it('returns the full accumulated text (cumulative, not delta)', () => {
    const chunk = JSON.stringify({
      result: {
        alternatives: [{ message: { text: 'Full accumulated text so far' } }],
      },
    });
    expect(yandexgptAdapter.parseStreamChunk(chunk)).toBe('Full accumulated text so far');
  });

  it('returns null when result is missing', () => {
    expect(yandexgptAdapter.parseStreamChunk(JSON.stringify({}))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(yandexgptAdapter.parseStreamChunk('not json')).toBeNull();
  });

  it('returns null when alternatives array is empty', () => {
    const chunk = JSON.stringify({ result: { alternatives: [] } });
    expect(yandexgptAdapter.parseStreamChunk(chunk)).toBeNull();
  });
});

describe('yandexgptAdapter.isMaxTokensTruncation', () => {
  it('returns true when status is ALTERNATIVE_STATUS_TRUNCATED_FINAL', () => {
    const chunk = JSON.stringify({
      result: {
        alternatives: [{ status: 'ALTERNATIVE_STATUS_TRUNCATED_FINAL' }],
      },
    });
    expect(yandexgptAdapter.isMaxTokensTruncation(chunk)).toBe(true);
  });

  it('returns false for ALTERNATIVE_STATUS_FINAL (normal completion)', () => {
    const chunk = JSON.stringify({
      result: {
        alternatives: [{ status: 'ALTERNATIVE_STATUS_FINAL' }],
      },
    });
    expect(yandexgptAdapter.isMaxTokensTruncation(chunk)).toBe(false);
  });

  it('returns false when alternatives is empty', () => {
    expect(
      yandexgptAdapter.isMaxTokensTruncation(JSON.stringify({ result: { alternatives: [] } }))
    ).toBe(false);
  });

  it('returns false for malformed JSON', () => {
    expect(yandexgptAdapter.isMaxTokensTruncation('bad')).toBe(false);
  });
});
