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
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'o1',
      'o1-mini',
      'o3-mini',
    ],
  },
  deepseek: {
    adapter: openaiCompatAdapter,
    defaultBaseUrl: 'https://api.deepseek.com',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
  },
  anthropic: {
    adapter: anthropicAdapter,
    defaultBaseUrl: 'https://api.anthropic.com',
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-3-5-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ],
  },
  gemini: {
    adapter: geminiAdapter,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: [
      'gemini-3.1-pro-preview',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
  },
  yandexgpt: {
    adapter: yandexgptAdapter,
    defaultBaseUrl: 'https://llm.api.cloud.yandex.net',
    label: 'YandexGPT',
    defaultModel: 'yandexgpt-lite',
    models: [
      'yandexgpt-lite',
      'yandexgpt',
      'yandexgpt-32k',
    ],
    needsFolderId: true,
  },
  custom: {
    adapter: openaiCompatAdapter,
    defaultBaseUrl: '',
    label: 'Custom (OpenAI-совместимый)',
    defaultModel: '',
    models: [],
  },
};
