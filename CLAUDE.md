# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ПНД.doc — Clinical Documentation Automation

React SPA that transforms free-form Russian psychiatric notes into structured clinical documents using LLM APIs. The project is fully implemented (~36 TypeScript/TSX files, ~3 000 lines of code).

## Commands

```bash
# Initial setup (installs deps, creates .env.local)
./setup.sh

# Run both worker proxy and Vite dev server (single terminal)
./dev.sh

# Or separately:
cd worker && npx wrangler dev        # proxy on :8787
npm run dev                          # app on :5173

# Type check
npm run type-check                   # tsc --noEmit

# Production build
npm run build                        # outputs to dist/

# Deploy Cloudflare Worker proxy
cd worker && npx wrangler deploy
```

No test framework is configured.

## Do NOT

- Add a backend, database, or server beyond the Cloudflare Worker proxy
- Add React Router or any routing — single-page, single-view app
- Add user accounts, authentication, or login
- Add analytics, telemetry, or error reporting services
- Store patient text in `localStorage`, `IndexedDB`, or anywhere persistent
- Create separate CSS files — all styling is Tailwind utility classes
- Add any npm dependency not listed in `package.json` without asking first
- Use class components or `any` types

## Architecture

```
Browser → Cloudflare Worker (CORS proxy) → LLM Provider API
        ← Streamed SSE response           ←
```

The browser cannot call LLM APIs directly due to CORS. All requests go through `proxyFetch` → Cloudflare Worker (`/worker/index.ts`) → provider.

**Storage split:**
- `localStorage` (`pnd-doc-settings`): provider settings + example count only
- `sessionStorage` (`pnd-session`): conversation history + session history (cleared on tab close)
- Clinical input/output text: in-memory only, never persisted

## Key Source Locations

| Path | Purpose |
|------|---------|
| `src/context/AppContext.tsx` | Full state shape, reducer, 24 actions, localStorage/sessionStorage sync |
| `src/providers/types.ts` | `ProviderAdapter`, `ProviderSettings`, `ConversationMessage`, `ProviderRegistryEntry` |
| `src/providers/registry.ts` | `PROVIDER_REGISTRY` — single source of truth for defaults |
| `src/prompts/index.ts` | `DOC_TYPE_CONFIG`, `buildPrompt()` |
| `src/utils/proxyFetch.ts` | `proxyFetch` (JSON) and `proxyFetchFormData` (multipart, for Whisper) |
| `src/hooks/useStreamingResponse.ts` | Primary generation streaming + abort |
| `src/hooks/useEditStreaming.ts` | LLM-assisted inline edit streaming + abort |
| `src/hooks/useAudioRecorder.ts` | Voice recording → Whisper transcription |
| `src/utils/whisperClient.ts` | Whisper API client (via `proxyFetchFormData`) |
| `src/utils/editPrompt.ts` | Builds prompts for fragment/document edit requests |
| `src/utils/contentEditableUtils.ts` | DOM helpers for selection offsets in the output panel |
| `worker/index.ts` | Cloudflare Worker CORS proxy (~52 lines) |

## Provider Adapter Interface (actual)

```typescript
interface ProviderAdapter {
  buildRequestUrl(baseUrl: string, model: string, apiKey: string): string;
  formatHeaders(apiKey: string): Record<string, string>;
  // NOTE: messages is ConversationMessage[], NOT a plain string
  formatRequest(systemPrompt: string, messages: ConversationMessage[], model: string, maxOutputTokens: number): object;
  parseStreamChunk(chunk: string): string | null;
  isMaxTokensTruncation(chunk: string): boolean;
  validateKey(apiKey: string, baseUrl: string, proxyUrl?: string): Promise<boolean>;
}
```

**Critical provider rules:**
- **Anthropic:** `formatHeaders` must include `x-api-key` AND `anthropic-version: 2023-06-01`. System prompt goes in top-level `system` field, not in `messages`.
- **Gemini:** API key in URL query string (`?key=...`). System prompt in `system_instruction` field. `formatHeaders` returns `{}`.
- **YandexGPT:** Model must be full URI `gpt://<folderId>/<modelName>/latest`. Auth: `Authorization: Api-Key <key>`. YandexGPT SSE sends cumulative text, not deltas — `parseStreamChunk` returns the full accumulated text, callers must handle accordingly (see `isYandex` guard in hooks).
- **OpenAI-compat:** System prompt is a `{role: "system"}` message prepended to `messages`.

## ProviderSettings (actual)

```typescript
interface ProviderSettings {
  provider: ProviderKey;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxContextTokens: number;    // default 128000
  folderId?: string;           // YandexGPT only
  proxyUrl?: string;           // overrides VITE_WORKER_URL at runtime (Russia deployments)
  whisperApiKey?: string;      // Whisper speech-to-text
  whisperBaseUrl?: string;
  whisperLanguage?: string;
}
```

`ProviderRegistryEntry` also has a `models: readonly string[]` field for the model dropdown.

## Document Types and Token Budgets

| Key | Label | maxOutputTokens |
|-----|-------|----------------|
| `pervichniy` | Первичный осмотр | 6000 |
| `povtorniy` | Повторный осмотр | 3000 |
| `vk` | Врачебная комиссия (ВК) | 4000 |
| `msek` | МСЭК | 8000 |

These values live in `DOC_TYPE_CONFIG` in `src/prompts/index.ts` and are used both as `maxOutputTokens` in API calls and as the output reserve in token budget calculations.

## State Shape (actual)

```typescript
type AppState = {
  settings: ProviderSettings | null;
  docType: DocTypeKey;
  inputText: string;
  outputText: string;
  isStreaming: boolean;
  statusMessage: string | null;
  settingsOpen: boolean;
  exampleCount: number;
  // Inline LLM editing (canvas mode)
  selection: SelectionState | null;     // char offsets in outputText
  editInstruction: string;
  isEditStreaming: boolean;
  pendingEditText: string | null;       // accumulates streamed edit proposal
  editMode: 'selection' | 'document' | null;
  editHistory: EditDelta[];             // undo stack (max 20)
  editFuture: EditDelta[];              // redo stack
  editTruncated: boolean;
  // Multi-turn context
  conversationHistory: ConversationMessage[];
  // Session history (last 15 completed generations)
  sessionHistory: SessionEntry[];
  historyOpen: boolean;
};
```

Switching doc type clears `conversationHistory`. Restoring a session entry resets all canvas state and clears conversation context.

## Extended Features (beyond original spec)

### Inline LLM Editing
After generation, the user can select text in the output and type an instruction. `useEditStreaming` sends the selection + instruction to the LLM, streams back a replacement proposal, and the user accepts/rejects. Accepting dispatches `APPLY_EDIT` which mutates `outputText` and pushes to `editHistory`. Undo/redo operate on `EditDelta` (character offsets).

Components: `EditBar`, `OutputPanel` (uses `contentEditableUtils` for DOM selection tracking).
Prompts: `EDIT_SYSTEM_PROMPT`, `buildFragmentEditMessage`, `buildDocumentEditMessage` in `src/utils/editPrompt.ts`.

### Multi-turn Conversation
Each completed generation pushes `{user, assistant}` to `conversationHistory` (stored in `sessionStorage`). Subsequent generations include this history so the LLM has context of prior turns. Cleared on doc type switch or manual reset.

### Session History
Last 15 completed documents saved as `SessionEntry` objects in `sessionStorage`. Shown in `HistoryPanel`. Restoring an entry loads its `docType`, `inputText`, and `outputText` and clears conversation context.

### Voice Input (Whisper)
`useAudioRecorder` captures audio via `MediaRecorder`, sends the blob to the Whisper API through `proxyFetchFormData`. Whisper settings (`whisperApiKey`, `whisperBaseUrl`, `whisperLanguage`) are part of `ProviderSettings` and stored in `localStorage`.

## proxyFetch API

```typescript
// For JSON requests (all LLM API calls)
proxyFetch(targetUrl, headers, body, signal?, workerUrl?): Promise<Response>

// For multipart/form-data (Whisper transcription)
proxyFetchFormData(targetUrl, headers, formData, signal?, workerUrl?): Promise<Response>
```

`workerUrl` overrides `VITE_WORKER_URL`. Pass `settings.proxyUrl` here when available.

## Russia Deployment

For users in Russia where `*.workers.dev` is blocked, two alternative proxy options are provided:

- `/yandex-proxy/` — Node.js proxy deployable to Yandex Serverless Containers
- `/yandex-cloud-function/` — Yandex Cloud Function version

Use `.env.russia.example` as a template (copy to `.env.russia`). Build with `VITE_WORKER_URL=<yandex-container-url> npm run build`, deploy `dist/` to Yandex Object Storage. Users can also override the proxy URL at runtime via `settings.proxyUrl`.

## Key Conventions

- **All user-visible strings in Russian.** No English in the UI.
- **No direct `fetch()` to LLM APIs.** Always go through `proxyFetch` or `proxyFetchFormData`.
- **No non-streaming code paths.** Every generation uses SSE.
- **Tailwind only for styling.** No inline style objects, no CSS files.
- **Error messages are states, not thrown exceptions.** Catch in hooks/utils, set `statusMessage` via dispatch.
- **`AbortController` must be cleaned up.** Abort on unmount and on new request start.
- **Do NOT use `useEffect` to sync localStorage/sessionStorage.** Do it inside reducer action handlers (`SAVE_SETTINGS`, `PUSH_CONVERSATION_TURN`, etc.).

## Common Pitfalls

- Do NOT pass the API key as a query param for non-Gemini providers.
- Do NOT put Anthropic's system prompt inside the `messages` array.
- Do NOT buffer the entire stream before rendering — render each chunk as it arrives.
- Do NOT call `validateKey` on every keystroke — only on explicit button click.
- Do NOT forget `signal` propagation through to `proxyFetch`.
- `isMaxTokensTruncation` applies to the **final** chunk only; intermediate chunks return `null`.
- YandexGPT sends cumulative (not delta) text — use the `isYandex` guard in streaming hooks and replace `accumulated` instead of appending.
- `formatRequest` takes `ConversationMessage[]` (not a plain `userMessage: string`) — build the array before calling.
