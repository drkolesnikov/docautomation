/**
 * Extracts the data payload from a single SSE line.
 *
 * Returns the raw data string if the line is a valid "data:" line and is not
 * the "[DONE]" sentinel. Returns null for non-data lines, empty lines, and
 * the stream-termination sentinel.
 */
export function extractSSEData(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let dataContent: string | undefined;
  if (trimmed.startsWith('data: ')) {
    dataContent = trimmed.slice(6);
  } else if (trimmed.startsWith('data:')) {
    dataContent = trimmed.slice(5);
  } else {
    return null;
  }

  if (dataContent.trim() === '[DONE]') return null;
  return dataContent;
}

/**
 * Reads an SSE stream from a ReadableStreamDefaultReader, calling `onChunk`
 * for every valid data payload as it arrives.
 *
 * Handles:
 * - UTF-8 decoding with streaming support
 * - Buffer management across partial reads
 * - "data:" prefix extraction (with and without trailing space)
 * - "[DONE]" sentinel skipping
 * - Remaining-buffer flush after the stream ends
 *
 * Returns the last data payload seen (needed for max-tokens truncation
 * detection in the caller).
 */
export async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (dataContent: string) => void,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let lastChunk = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep the last (possibly incomplete) line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const data = extractSSEData(line);
      if (data !== null) {
        lastChunk = data;
        onChunk(data);
      }
    }
  }

  // Flush any remaining data left in the buffer after the stream ends
  if (buffer.trim()) {
    const data = extractSSEData(buffer);
    if (data !== null) {
      lastChunk = data;
      onChunk(data);
    }
  }

  return lastChunk;
}
