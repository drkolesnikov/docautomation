# ПНД.doc — Clinical Documentation Automation

React SPA that transforms free-form Russian psychiatric notes into structured clinical
documents using LLM APIs. Clinician pastes notes → selects document type → gets formatted
output ready for medical records.

## Tech Stack (pinned)

- React 18 + TypeScript (strict mode)
- Vite 5
- Tailwind CSS 3
- Cloudflare Worker (CORS proxy)
- State: React Context + `useReducer`

## Do NOT

- Add a backend, database, or server beyond the Cloudflare Worker proxy
- Add React Router or any routing — single-page, single-view app
- Add user accounts, authentication, or login
- Add analytics, telemetry, logging, or error reporting services
- Store patient text in localStorage, IndexedDB, or anywhere persistent
- Create separate CSS files — all styling is Tailwind utility classes
- Add any npm dependency not listed here without asking first
- Use class components

## Document Types

| Key | Russian name | English gloss | Typical output tokens |
|-----|-------------|---------------|----------------------|
| `pervichniy` | Первичный осмотр | Initial psychiatric examination | 1500–3000 |
| `povtorniy` | Повторный осмотр | Follow-up examination | 500–1500 |
| `vk` | Врачебная комиссия (ВК) | Medical board assessment | 1000–2500 |
| `msek` | МСЭК | Medical-social expert commission | 2000–5000 |

Each type has its own prompt template, example bank, and output token reserve.
The upper bound of "Typical output tokens" is used as `maxOutputTokens` for API calls
and as the output reserve in token budget calculations.

## Architecture

```
Browser → Cloudflare Worker (CORS proxy) → LLM Provider API
                                         ← Streamed SSE response
       ← Streamed SSE response
```

### Cloudflare Worker Proxy (`/worker/`)

Pass-through proxy (~30 lines). It:
- Accepts POST requests from the browser
- Reads the target URL from the `x-target-url` request header
- Validates that the URL's hostname is in the allowlist (env var `ALLOWED_HOSTS` in `wrangler.toml`)
- Forwards the request body and **all** request headers to that URL
- Streams the response back with permissive CORS headers (`Access-Control-Allow-Origin: *`)
- Does NOT log, store, or inspect content

Default `ALLOWED_HOSTS`:
```
api.anthropic.com,api.openai.com,api.deepseek.com,generativelanguage.googleapis.com,llm.api.cloud.yandex.net
```

User adds custom hostnames (ollama, vLLM, etc.) to this comma-separated list.

`wrangler.toml`:
```toml
name = "pnd-doc-proxy"
main = "index.ts"
compatibility_date = "2024-01-01"

[vars]
ALLOWED_HOSTS = "api.anthropic.com,api.openai.com,api.deepseek.com,generativelanguage.googleapis.com,llm.api.cloud.yandex.net"
```

### Worker URL Configuration

The React app needs to know the Worker's URL. Configured via Vite env var:

```
# .env.local (not committed)
VITE_WORKER_URL=https://pnd-doc-proxy.<your-subdomain>.workers.dev
```

For local dev with `wrangler dev`: `VITE_WORKER_URL=http://localhost:8787`

### Shared Proxy Utility (`/src/utils/proxyFetch.ts`)

**All** HTTP requests to LLM APIs go through this utility. Nothing calls provider
APIs directly — the browser cannot due to CORS.

```typescript
const WORKER_URL = import.meta.env.VITE_WORKER_URL;

async function proxyFetch(
  targetUrl: string,
  headers: Record<string, string>,
  body: object,
  signal?: AbortSignal
): Promise<Response>
```

Sends POST to `WORKER_URL` with `x-target-url` header set to `targetUrl`,
forwards all provided `headers`, stringifies `body` as JSON. Both streaming
requests and `validateKey` calls use this function.

## LLM Provider Adapters (`/src/providers/`)

Organized by **API format**, not brand.

| Adapter file | Covers |
|-------------|--------|
| `openai-compat.ts` | OpenAI, DeepSeek, Groq, Together, ollama, vLLM, LM Studio — any `/v1/chat/completions` endpoint |
| `anthropic.ts` | Anthropic Claude |
| `gemini.ts` | Google Gemini |
| `yandexgpt.ts` | YandexGPT |

To add a new provider: if it speaks OpenAI Chat Completions (most do), just add a
registry entry with a custom base URL. No new adapter code. Only write a new adapter
for genuinely different API formats.

```
/src/providers/
  types.ts
  openai-compat.ts
  anthropic.ts
  gemini.ts
  yandexgpt.ts
  registry.ts
```

### Provider Adapter Interface

```typescript
interface ProviderAdapter {
  // Build full request URL (some providers need query params, e.g. Gemini ?alt=sse&key=...)
  buildRequestUrl(baseUrl: string, model: string, apiKey: string): string;

  // All required headers — auth AND non-auth (e.g. anthropic-version)
  formatHeaders(apiKey: string): Record<string, string>;

  // Provider-specific request body
  formatRequest(systemPrompt: string, userMessage: string, model: string, maxOutputTokens: number): object;

  // Parse one SSE chunk → text content (or null if chunk is metadata/keep-alive)
  parseStreamChunk(chunk: string): string | null;

  // Detect if response was truncated due to max_tokens
  isMaxTokensTruncation(chunk: string): boolean;

  // Light endpoint call to verify API key works. MUST use proxyFetch, not direct fetch.
  validateKey(apiKey: string, baseUrl: string): Promise<boolean>;
}
```

**Provider-specific notes Claude must follow:**

- **Anthropic:** `formatHeaders` must include both `x-api-key` and `anthropic-version: 2023-06-01`. System prompt goes in the top-level `system` field, NOT as a message with role `system`.
- **Gemini:** API key goes in the URL query string (`?key=...`), not in headers. System prompt goes in the `system_instruction` field, NOT as a message. `formatHeaders` returns an empty object.
- **YandexGPT:** Model field must be a full model URI: `gpt://<folderId>/<modelName>/latest`. Auth header is `Authorization: Api-Key <key>`. The adapter must construct the model URI from settings.
- **OpenAI-compatible:** Standard `Authorization: Bearer <key>`. System prompt is a message with `role: "system"`.

### Provider Settings

```typescript
type ProviderKey = 'openai' | 'deepseek' | 'anthropic' | 'gemini' | 'yandexgpt' | 'custom';

interface ProviderSettings {
  provider: ProviderKey;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxContextTokens: number;   // default: 128000
  folderId?: string;          // YandexGPT only — used to construct model URI
}
```

### Provider Registry (`registry.ts`)

Single source of truth for defaults. Adapters do NOT store default URLs or models.

```typescript
const PROVIDER_REGISTRY: Record<ProviderKey, {
  adapter: ProviderAdapter;
  defaultBaseUrl: string;
  defaultModel: string;
  label: string;
  needsFolderId?: boolean;
}> = {
  openai:    { adapter: openaiCompat, defaultBaseUrl: 'https://api.openai.com',       label: 'OpenAI',    defaultModel: 'gpt-4o' },
  deepseek:  { adapter: openaiCompat, defaultBaseUrl: 'https://api.deepseek.com',     label: 'DeepSeek',  defaultModel: 'deepseek-chat' },
  anthropic: { adapter: anthropic,    defaultBaseUrl: 'https://api.anthropic.com',     label: 'Anthropic', defaultModel: 'claude-sonnet-4-20250514' },
  gemini:    { adapter: gemini,       defaultBaseUrl: 'https://generativelanguage.googleapis.com', label: 'Google Gemini', defaultModel: 'gemini-2.0-flash' },
  yandexgpt: { adapter: yandexgpt,   defaultBaseUrl: 'https://llm.api.cloud.yandex.net', label: 'YandexGPT', defaultModel: 'yandexgpt-lite', needsFolderId: true },
  custom:    { adapter: openaiCompat, defaultBaseUrl: '',                              label: 'Custom (OpenAI-совместимый)', defaultModel: '' },
};
```

## Streaming

All generation uses streaming. No non-streaming code path.

- OpenAI-compatible, Anthropic, YandexGPT: `stream: true` in request body
- Gemini: `alt=sse` in URL query string
- Worker passes stream through without buffering
- Browser reads via `fetch()` + `ReadableStream` + `AbortController`
- Output renders incrementally as tokens arrive
- "Stop" button aborts via `AbortController.abort()`
- Once stream completes, output becomes editable
- If `isMaxTokensTruncation` returns true on final chunk, show truncation warning

## Example Bank (`/src/examples/`)

Few-shot examples teach the LLM formatting, language register, and structure.

```
/src/examples/
  pervichniy-osmotr/examples.json
  povtorniy-osmotr/examples.json
  vrachebnaya-komissiya/examples.json
  msek/examples.json
```

```typescript
interface Example {
  id: string;
  input: string;
  output: string;
  tokenEstimate: number;
  metadata: {
    diagnosis_category?: string;  // ICD-10 block, e.g. "F20"
    complexity?: 'simple' | 'typical' | 'complex';
  };
}
```

Dynamically imported per document type (Vite code-split). If an `examples.json` is
empty or missing, show warning in status bar: "Примеры не найдены для этого типа документа."
and proceed with zero-shot (no examples in prompt).

## Token Estimation (`/src/utils/tokenEstimator.ts`)

```typescript
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);  // conservative for Cyrillic
}
```

Prompt assembly budget check:
1. Sum: base prompt + doc rules + N examples + user input + **doc-type output reserve**
2. Output reserve comes from the Document Types table (use upper bound of range)
3. If over `maxContextTokens`, reduce examples. If still over with 0 examples, block send.

## Prompt Templates (`/src/prompts/`)

```
/src/prompts/
  base-instruction.ts
  pervichniy-osmotr.ts
  povtorniy-osmotr.ts
  vrachebnaya-komissiya.ts
  msek.ts
```

### Base Instruction

Shared across all document types. Must contain:

```
Ты — опытный врач-психиатр, работающий в психоневрологическом диспансере в России.
Твоя задача — преобразовать свободные клинические заметки врача в структурированный
медицинский документ строго в формате [тип документа].

Правила:
- Писать ТОЛЬКО на русском языке
- Использовать стандартную психиатрическую терминологию принятую в РФ
- Сохранять клинические факты из заметок без искажений
- Не добавлять клинические данные, которых нет в заметках
- Не добавлять диагноз, если он не указан в заметках
- Следовать структуре и порядку разделов, показанным в примерах ниже
```

### Document-Specific Templates

Each defines the exact section order and field names for that document type,
derived from the few-shot examples.

### Prompt Assembly

```typescript
export function buildPrompt(examples: Example[]): string {
  return [
    BASE_INSTRUCTION,
    DOCUMENT_SPECIFIC_SECTIONS,
    ...examples.map((ex, i) =>
      `### Пример ${i + 1}\nЗаметки врача:\n${ex.input}\n\nГотовый документ:\n${ex.output}`
    ),
  ].join('\n\n');
}
```

Assembled string → **system prompt**. User's clinical notes → **user message**.

## UI

Single view. No routing. Page title: "ПНД.doc". Below 768px, panels stack vertically.

```
┌──────────────────────────────────────────────────┐
│  "ПНД.doc"                          [⚙ Настройки]│
├────────────────────┬─────────────────────────────┤
│  Doc type dropdown │  Output textarea             │
│                    │  (read-only during stream,    │
│  Notes textarea    │   editable after completion)  │
│  (autofocus)       │                              │
│                    │  [Копировать]  [Заново]       │
│  [Сформировать]    │                              │
│                    │  Token budget: "~3200 / 128k" │
├────────────────────┴─────────────────────────────┤
│  Status bar: errors, streaming state              │
└──────────────────────────────────────────────────┘
```

### Behavior

- **First launch:** No provider configured → open Settings modal automatically.
- **Default output:** Placeholder: "Здесь появится готовый документ."
- **During streaming:** Output read-only. Generate disabled. Stop button shown.
- **After streaming:** Output editable. Copy and Regenerate enabled.
- **Doc type switch:** Allowed except during active streaming.
- **Regenerate ("Заново"):** Re-sends with current input notes.
- **Copy ("Копировать"):** Plain text to clipboard. Flash "Скопировано!" for 2 seconds.
- **All UI text in Russian.**

### Settings Modal

- Provider: dropdown from `PROVIDER_REGISTRY`
- API key: password input, show/hide toggle
- Model: text input, pre-filled from registry defaults
- Base URL: text input, pre-filled from registry defaults, always visible
- Folder ID: text input, **visible only when `needsFolderId` is true** (YandexGPT)
- Max context tokens: number input, default 128000
- Few-shot examples count: number input, default 3
- "Проверить ключ" button → calls `validateKey()` via `proxyFetch`, shows ✓ or ✗

**Modal behavior:**
- Explicit "Сохранить" button (not save-on-change). "Отмена" discards changes.
- Switching provider resets model, baseUrl, and folderId to that provider's registry defaults.
- Empty API key is allowed (user can configure other fields first).

## Error Handling

All Russian. Displayed in status bar.

| Trigger | Message | Action |
|---------|---------|--------|
| No provider configured | "Настройте провайдер в параметрах." | Auto-open settings |
| Invalid API key (401/403) | "Ошибка авторизации. Проверьте API-ключ." | Link to settings |
| Rate limit (429) | "Превышен лимит запросов. Подождите минуту." | Auto-retry after 60s |
| Over token budget | "Текст слишком длинный. Уменьшите заметки или примеры." | Block send |
| Network error | "Ошибка сети. Проверьте интернет." | Retry button |
| Stream interrupted | "Генерация прервана." | Show partial output + Retry |
| Output truncated (max_tokens) | "Документ может быть неполным. Попробуйте уменьшить ввод." | Show truncated output, let user edit |
| Worker unreachable | "Прокси недоступен." | — |
| Malformed LLM output | "Возможны ошибки форматирования." | Show raw output, let user edit |
| No examples for doc type | "Примеры не найдены. Качество может быть ниже." | Proceed zero-shot |

## Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── App.tsx
│   │   ├── InputPanel.tsx
│   │   ├── OutputPanel.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── StatusBar.tsx
│   │   └── TokenBudget.tsx
│   ├── providers/
│   │   ├── types.ts
│   │   ├── openai-compat.ts
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   ├── yandexgpt.ts
│   │   └── registry.ts
│   ├── prompts/
│   │   ├── base-instruction.ts
│   │   ├── pervichniy-osmotr.ts
│   │   ├── povtorniy-osmotr.ts
│   │   ├── vrachebnaya-komissiya.ts
│   │   └── msek.ts
│   ├── examples/
│   │   ├── pervichniy-osmotr/examples.json
│   │   ├── povtorniy-osmotr/examples.json
│   │   ├── vrachebnaya-komissiya/examples.json
│   │   └── msek/examples.json
│   ├── hooks/
│   │   ├── useStreamingResponse.ts
│   │   └── useTokenBudget.ts
│   ├── context/
│   │   └── AppContext.tsx
│   └── utils/
│       ├── proxyFetch.ts
│       ├── tokenEstimator.ts
│       └── clipboard.ts
├── worker/
│   ├── index.ts
│   └── wrangler.toml
├── .env.example              # VITE_WORKER_URL=http://localhost:8787
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── ARCHITECTURE.md
└── Claude.md
```

## Privacy

- API keys: `localStorage` only
- Clinical text: in-memory only, sent only to chosen LLM provider via Worker proxy
- Worker: stateless pass-through, no logging
- Example bank: synthetic data only
- No analytics, no telemetry, no tracking
- Settings persist in `localStorage`; clinical content does not
