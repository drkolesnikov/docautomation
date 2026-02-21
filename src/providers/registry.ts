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
    defaultModel: 'gpt-4.1',
    models: [
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'o4-mini',
      'o3',
      'o3-mini',
      'gpt-4o',
      'gpt-4o-mini',
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
    defaultModel: 'claude-sonnet-4-6',
    models: [
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-5-20251101',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
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
      'yandexgpt',
      'yandexgpt-lite',
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
