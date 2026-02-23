import { describe, it, expect, vi } from 'vitest';
import { extractSSEData, readSSEStream } from '../../utils/sseStream';

describe('extractSSEData', () => {
  it('extracts payload from "data: <value>" line', () => {
    expect(extractSSEData('data: hello')).toBe('hello');
  });

  it('extracts payload from "data:<value>" line (no space)', () => {
    expect(extractSSEData('data:hello')).toBe('hello');
  });

  it('returns null for the [DONE] sentinel', () => {
    expect(extractSSEData('data: [DONE]')).toBeNull();
    expect(extractSSEData('data:[DONE]')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractSSEData('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(extractSSEData('   ')).toBeNull();
  });

  it('returns null for non-data SSE lines', () => {
    expect(extractSSEData('event: ping')).toBeNull();
    expect(extractSSEData('id: 42')).toBeNull();
    expect(extractSSEData(': comment')).toBeNull();
  });

  it('preserves JSON payload intact', () => {
    const json = '{"type":"content_block_delta","delta":{"text":"hi"}}';
    expect(extractSSEData(`data: ${json}`)).toBe(json);
  });
});

describe('readSSEStream', () => {
  /** Helper: build a ReadableStreamDefaultReader from an array of Uint8Array chunks */
  function makeReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
    const encoder = new TextEncoder();
    let idx = 0;
    return {
      async read() {
        if (idx < chunks.length) {
          return { done: false, value: encoder.encode(chunks[idx++]) };
        }
        return { done: true, value: undefined };
      },
      releaseLock: () => {},
      cancel: async () => {},
      closed: Promise.resolve(undefined),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;
  }

  it('calls onChunk for each valid data line', async () => {
    const reader = makeReader([
      'data: chunk1\ndata: chunk2\n',
    ]);
    const onChunk = vi.fn();
    await readSSEStream(reader, onChunk);
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'chunk1');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'chunk2');
  });

  it('skips [DONE] sentinel', async () => {
    const reader = makeReader(['data: payload\ndata: [DONE]\n']);
    const onChunk = vi.fn();
    await readSSEStream(reader, onChunk);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('payload');
  });

  it('returns the last chunk seen', async () => {
    const reader = makeReader(['data: first\ndata: last\n']);
    const last = await readSSEStream(reader, () => {});
    expect(last).toBe('last');
  });

  it('returns empty string when stream has no valid data lines', async () => {
    const reader = makeReader(['event: ping\n\n']);
    const last = await readSSEStream(reader, () => {});
    expect(last).toBe('');
  });

  it('handles data split across multiple chunks', async () => {
    // The line "data: hello\n" is split: "data: he" in chunk1, "llo\n" in chunk2
    const reader = makeReader(['data: he', 'llo\n']);
    const onChunk = vi.fn();
    await readSSEStream(reader, onChunk);
    expect(onChunk).toHaveBeenCalledOnce();
    expect(onChunk).toHaveBeenCalledWith('hello');
  });

  it('flushes remaining buffer after stream ends', async () => {
    // No trailing newline — remaining buffer must be flushed
    const reader = makeReader(['data: trailing']);
    const onChunk = vi.fn();
    const last = await readSSEStream(reader, onChunk);
    expect(onChunk).toHaveBeenCalledWith('trailing');
    expect(last).toBe('trailing');
  });

  it('skips blank lines between data events', async () => {
    const reader = makeReader(['data: a\n\ndata: b\n']);
    const onChunk = vi.fn();
    await readSSEStream(reader, onChunk);
    expect(onChunk).toHaveBeenCalledTimes(2);
  });
});
