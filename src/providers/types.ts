export interface ProviderAdapter {
  buildRequestUrl(baseUrl: string, model: string, apiKey: string): string;
  formatHeaders(apiKey: string): Record<string, string>;
  formatRequest(systemPrompt: string, userMessage: string, model: string, maxOutputTokens: number): object;
  parseStreamChunk(chunk: string): string | null;
  isMaxTokensTruncation(chunk: string): boolean;
  validateKey(apiKey: string, baseUrl: string): Promise<boolean>;
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
}

export interface ProviderRegistryEntry {
  adapter: ProviderAdapter;
  defaultBaseUrl: string;
  defaultModel: string;
  label: string;
  needsFolderId?: boolean;
}
