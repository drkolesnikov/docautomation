export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export interface ProviderAdapter {
  buildRequestUrl(baseUrl: string, model: string, apiKey: string): string;
  formatHeaders(apiKey: string): Record<string, string>;
  formatRequest(systemPrompt: string, messages: ConversationMessage[], model: string, maxOutputTokens: number): object;
  parseStreamChunk(chunk: string): string | null;
  isMaxTokensTruncation(chunk: string): boolean;
  validateKey(apiKey: string, baseUrl: string, proxyUrl?: string): Promise<boolean>;
}

export type ProviderKey = 'openai' | 'deepseek' | 'anthropic' | 'gemini' | 'yandexgpt' | 'custom';

export type DocTypeKey = 'pervichniy' | 'povtorniy' | 'vk' | 'msek';

export interface ProviderSettings {
  provider: ProviderKey;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxContextTokens: number;
  folderId?: string;
  // Custom proxy URL — overrides VITE_WORKER_URL at runtime (useful in Russia
  // where the default .workers.dev domain may be blocked)
  proxyUrl?: string;
  // Whisper speech-to-text settings (optional, stored alongside provider settings)
  whisperApiKey?: string;
  whisperBaseUrl?: string;
  whisperLanguage?: string;
}

export interface ProviderRegistryEntry {
  adapter: ProviderAdapter;
  defaultBaseUrl: string;
  defaultModel: string;
  label: string;
  models: readonly string[];
  needsFolderId?: boolean;
}
