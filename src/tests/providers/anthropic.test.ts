import { describe, it, expect } from 'vitest';
import { anthropicAdapter } from '../../providers/anthropic';
import type { ConversationMessage } from '../../providers/types';

const msgs: ConversationMessage[] = [
  { role: 'user', content: 'Привет' },
  { role: 'assistant', content: 'Здравствуйте' },
];

describe('anthropicAdapter.buildRequestUrl', () => {
  it('appends /v1/messages to the base URL', () => {
    expect(anthropicAdapter.buildRequestUrl('https://api.anthropic.com', 'claude-3', 'key')).toBe(
      'https://api.anthropic.com/v1/messages'
    );
  });

  it('does not include model or key in the URL', () => {
    const url = anthropicAdapter.buildRequestUrl('https://base', 'model-name', 'sk-xxx');
    expect(url).not.toContain('model-name');
    expect(url).not.toContain('sk-xxx');
  });
});

describe('anthropicAdapter.formatHeaders', () => {
  it('includes x-api-key header', () => {
    const headers = anthropicAdapter.formatHeaders('my-key');
    expect(headers['x-api-key']).toBe('my-key');
  });

  it('includes anthropic-version header', () => {
    const headers = anthropicAdapter.formatHeaders('my-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('includes content-type application/json', () => {
    const headers = anthropicAdapter.formatHeaders('my-key');
    expect(headers['content-type']).toBe('application/json');
  });

  it('does NOT use Authorization: Bearer', () => {
    const headers = anthropicAdapter.formatHeaders('my-key');
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('anthropicAdapter.formatRequest', () => {
  it('puts systemPrompt in top-level system field', () => {
    const req = anthropicAdapter.formatRequest('sys', msgs, 'claude-3', 1024) as Record<string, unknown>;
    expect(req.system).toBe('sys');
  });

  it('does NOT include systemPrompt in the messages array', () => {
    const req = anthropicAdapter.formatRequest('sys', msgs, 'claude-3', 1024) as { messages: ConversationMessage[] };
    for (const m of req.messages) {
      expect(m.content).not.toBe('sys');
    }
    expect(req.messages.every((m) => (m.role as string) !== 'system')).toBe(true);
  });

  it('passes messages array through correctly', () => {
    const req = anthropicAdapter.formatRequest('sys', msgs, 'claude-3', 1024) as { messages: ConversationMessage[] };
    expect(req.messages).toHaveLength(2);
    expect(req.messages[0].role).toBe('user');
    expect(req.messages[1].role).toBe('assistant');
  });

  it('sets max_tokens from the argument', () => {
    const req = anthropicAdapter.formatRequest('sys', msgs, 'claude-3', 4000) as Record<string, unknown>;
    expect(req.max_tokens).toBe(4000);
  });

  it('sets stream: true', () => {
    const req = anthropicAdapter.formatRequest('sys', msgs, 'claude-3', 1024) as Record<string, unknown>;
    expect(req.stream).toBe(true);
  });
});

describe('anthropicAdapter.parseStreamChunk', () => {
  it('returns text for content_block_delta / text_delta events', () => {
    const chunk = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hello' },
    });
    expect(anthropicAdapter.parseStreamChunk(chunk)).toBe('Hello');
  });

  it('returns null for other event types', () => {
    expect(anthropicAdapter.parseStreamChunk(JSON.stringify({ type: 'message_start' }))).toBeNull();
    expect(anthropicAdapter.parseStreamChunk(JSON.stringify({ type: 'content_block_start' }))).toBeNull();
    expect(anthropicAdapter.parseStreamChunk(JSON.stringify({ type: 'message_delta' }))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(anthropicAdapter.parseStreamChunk('not-json')).toBeNull();
  });

  it('returns null when delta type is not text_delta', () => {
    const chunk = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'input_json_delta', partial_json: '{}' },
    });
    expect(anthropicAdapter.parseStreamChunk(chunk)).toBeNull();
  });
});

describe('anthropicAdapter.isMaxTokensTruncation', () => {
  it('returns true when stop_reason is max_tokens', () => {
    const chunk = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'max_tokens' },
    });
    expect(anthropicAdapter.isMaxTokensTruncation(chunk)).toBe(true);
  });

  it('returns false when stop_reason is end_turn', () => {
    const chunk = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
    });
    expect(anthropicAdapter.isMaxTokensTruncation(chunk)).toBe(false);
  });

  it('returns false for non-message_delta events', () => {
    expect(anthropicAdapter.isMaxTokensTruncation(JSON.stringify({ type: 'content_block_delta' }))).toBe(false);
  });

  it('returns false for malformed JSON', () => {
    expect(anthropicAdapter.isMaxTokensTruncation('bad')).toBe(false);
  });
});
