import { openaiCompatAdapter } from './openai-compat';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { yandexgptAdapter } from './yandexgpt';
import type { ProviderKey, ProviderRegistryEntry } from './types';

export const PROVIDER_REGISTRY: Record<ProviderKey, ProviderRegistryEntry> = {
  openai: {
    adapter: openaiCompatAdapter,
    defaultBaseUrl: 'https://api.openai.com',
    label: 'OpenAI',
    defaultModel: 'gpt-4o',
  },
  deepseek: {
    adapter: openaiCompatAdapter,
    defaultBaseUrl: 'https://api.deepseek.com',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
  },
  anthropic: {
    adapter: anthropicAdapter,
    defaultBaseUrl: 'https://api.anthropic.com',
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  gemini: {
    adapter: geminiAdapter,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
  },
  yandexgpt: {
    adapter: yandexgptAdapter,
    defaultBaseUrl: 'https://llm.api.cloud.yandex.net',
    label: 'YandexGPT',
    defaultModel: 'yandexgpt-lite',
    needsFolderId: true,
  },
  custom: {
    adapter: openaiCompatAdapter,
    defaultBaseUrl: '',
    label: 'Custom (OpenAI-совместимый)',
    defaultModel: '',
  },
};
