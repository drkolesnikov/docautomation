import { describe, it, expect } from 'vitest';
import { geminiAdapter } from '../../providers/gemini';
import type { ConversationMessage } from '../../providers/types';

const msgs: ConversationMessage[] = [
  { role: 'user', content: 'Привет' },
  { role: 'assistant', content: 'Здравствуйте' },
];

describe('geminiAdapter.buildRequestUrl', () => {
  it('includes the model in the path', () => {
    const url = geminiAdapter.buildRequestUrl('https://generativelanguage.googleapis.com', 'gemini-2.0-flash', 'my-key');
    expect(url).toContain('gemini-2.0-flash');
  });

  it('puts the API key in the URL query string', () => {
    const url = geminiAdapter.buildRequestUrl('https://base', 'gemini-pro', 'secret-key');
    expect(url).toContain('key=secret-key');
  });

  it('uses streamGenerateContent endpoint with alt=sse', () => {
    const url = geminiAdapter.buildRequestUrl('https://base', 'gemini-pro', 'key');
    expect(url).toContain(':streamGenerateContent');
    expect(url).toContain('alt=sse');
  });
});

describe('geminiAdapter.formatHeaders', () => {
  it('returns an empty object (key goes in URL)', () => {
    expect(geminiAdapter.formatHeaders('any-key')).toEqual({});
  });
});

describe('geminiAdapter.formatRequest', () => {
  it('wraps systemPrompt in system_instruction.parts[0].text', () => {
    const req = geminiAdapter.formatRequest('sys', msgs, 'gemini-pro', 1024) as Record<string, unknown>;
    const si = req.system_instruction as { parts: Array<{ text: string }> };
    expect(si.parts[0].text).toBe('sys');
  });

  it('maps assistant role to "model"', () => {
    const req = geminiAdapter.formatRequest('sys', msgs, 'gemini-pro', 1024) as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    };
    const assistantEntry = req.contents.find((c) => c.parts[0].text === 'Здравствуйте');
    expect(assistantEntry?.role).toBe('model');
  });

  it('keeps user role as "user"', () => {
    const req = geminiAdapter.formatRequest('sys', msgs, 'gemini-pro', 1024) as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    };
    const userEntry = req.contents.find((c) => c.parts[0].text === 'Привет');
    expect(userEntry?.role).toBe('user');
  });

  it('puts maxOutputTokens in generationConfig', () => {
    const req = geminiAdapter.formatRequest('sys', msgs, 'gemini-pro', 2048) as {
      generationConfig: { maxOutputTokens: number };
    };
    expect(req.generationConfig.maxOutputTokens).toBe(2048);
  });

  it('does not include a system message in contents', () => {
    const req = geminiAdapter.formatRequest('sys', msgs, 'gemini-pro', 1024) as {
      contents: Array<{ role: string }>;
    };
    expect(req.contents.every((c) => c.role !== 'system')).toBe(true);
  });
});

describe('geminiAdapter.parseStreamChunk', () => {
  it('extracts text from candidates[0].content.parts[0].text', () => {
    const chunk = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Generated text' }] } }],
    });
    expect(geminiAdapter.parseStreamChunk(chunk)).toBe('Generated text');
  });

  it('returns null when candidates is missing', () => {
    expect(geminiAdapter.parseStreamChunk(JSON.stringify({}))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(geminiAdapter.parseStreamChunk('broken')).toBeNull();
  });
});

describe('geminiAdapter.isMaxTokensTruncation', () => {
  it('returns true when finishReason is MAX_TOKENS', () => {
    const chunk = JSON.stringify({
      candidates: [{ finishReason: 'MAX_TOKENS' }],
    });
    expect(geminiAdapter.isMaxTokensTruncation(chunk)).toBe(true);
  });

  it('returns false when finishReason is STOP', () => {
    const chunk = JSON.stringify({
      candidates: [{ finishReason: 'STOP' }],
    });
    expect(geminiAdapter.isMaxTokensTruncation(chunk)).toBe(false);
  });

  it('returns false when finishReason is absent', () => {
    expect(geminiAdapter.isMaxTokensTruncation(JSON.stringify({ candidates: [{}] }))).toBe(false);
  });

  it('returns false for malformed JSON', () => {
    expect(geminiAdapter.isMaxTokensTruncation('bad')).toBe(false);
  });
});
