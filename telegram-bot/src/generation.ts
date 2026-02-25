import { buildPrompt, DOC_TYPE_CONFIG } from '../../src/prompts/index.js';
import type { DocTypeKey } from '../../src/prompts/index.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-reasoner';

export type GenerationResult = {
  text: string;
  truncated: boolean;
};

export async function generateDocument(
  docType: DocTypeKey,
  inputText: string,
  onChunk: (accumulated: string) => void,
  signal: AbortSignal
): Promise<GenerationResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

  const systemPrompt = buildPrompt(docType, []);
  const maxOutputTokens = DOC_TYPE_CONFIG[docType].maxOutputTokens;

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inputText },
      ],
      max_tokens: maxOutputTokens,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`DeepSeek API error ${response.status}: ${body}`);
  }

  if (!response.body) {
    throw new Error('Empty response body from DeepSeek API');
  }

  let accumulated = '';
  let truncated = false;
  let lastChunk = '';
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const rawChunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(rawChunk, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string | null; reasoning_content?: string | null };
            finish_reason?: string | null;
          }>;
        };

        const delta = parsed.choices?.[0]?.delta;
        // deepseek-reasoner sends reasoning_content deltas first, then content deltas.
        // We only want the final answer (content), not the chain-of-thought.
        const text = delta?.content ?? null;

        if (text) {
          accumulated += text;
          onChunk(accumulated);
        }

        const finishReason = parsed.choices?.[0]?.finish_reason;
        if (finishReason) {
          lastChunk = data;
          if (finishReason === 'length') {
            truncated = true;
          }
        }
      } catch {
        // Malformed chunk — skip
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim().startsWith('data:')) {
    const data = buffer.trim().slice(5).trim();
    if (data && data !== '[DONE]') {
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ finish_reason?: string | null }>;
        };
        if (parsed.choices?.[0]?.finish_reason === 'length') {
          truncated = true;
        }
        lastChunk = data;
      } catch {
        // ignore
      }
    }
  }

  void lastChunk; // suppress unused-var warning

  return { text: accumulated, truncated };
}
