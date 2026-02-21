import { useState, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { PROVIDER_REGISTRY } from '../providers/registry';
import type { ProviderKey, ProviderSettings } from '../providers/types';

const PROVIDER_KEYS: ProviderKey[] = ['openai', 'deepseek', 'anthropic', 'gemini', 'yandexgpt', 'custom'];

export default function SettingsModal() {
  const [state, dispatch] = useAppState();
  const { settings, settingsOpen, exampleCount } = state;

  const [provider, setProvider] = useState<ProviderKey>(settings?.provider ?? 'openai');
  const [apiKey, setApiKey] = useState(settings?.apiKey ?? '');
  const [model, setModel] = useState(settings?.model ?? PROVIDER_REGISTRY.openai.defaultModel);
  const [customModel, setCustomModel] = useState('');
  const [baseUrl, setBaseUrl] = useState(settings?.baseUrl ?? PROVIDER_REGISTRY.openai.defaultBaseUrl);
  const [folderId, setFolderId] = useState(settings?.folderId ?? '');
  const [maxContextTokens, setMaxContextTokens] = useState(settings?.maxContextTokens ?? 128000);
  const [localExampleCount, setLocalExampleCount] = useState(exampleCount);
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);

  const CUSTOM_SENTINEL = '__custom__';

  const resolveSelectValue = (m: string, knownModels: readonly string[]): string =>
    knownModels.includes(m) ? m : CUSTOM_SENTINEL;

  // Reset form when modal opens
  useEffect(() => {
    if (settingsOpen) {
      const p = settings?.provider ?? 'openai';
      const m = settings?.model ?? PROVIDER_REGISTRY.openai.defaultModel;
      const knownModels = PROVIDER_REGISTRY[p].models;
      setProvider(p);
      setApiKey(settings?.apiKey ?? '');
      setModel(m);
      setCustomModel(knownModels.includes(m) ? '' : m);
      setBaseUrl(settings?.baseUrl ?? PROVIDER_REGISTRY.openai.defaultBaseUrl);
      setFolderId(settings?.folderId ?? '');
      setMaxContextTokens(settings?.maxContextTokens ?? 128000);
      setLocalExampleCount(exampleCount);
      setShowKey(false);
      setKeyValid(null);
    }
  }, [settingsOpen, settings, exampleCount]);

  if (!settingsOpen) return null;

  const registryEntry = PROVIDER_REGISTRY[provider];
  const showFolderId = registryEntry.needsFolderId === true;

  const handleProviderChange = (newProvider: ProviderKey) => {
    const entry = PROVIDER_REGISTRY[newProvider];
    setProvider(newProvider);
    setModel(entry.defaultModel);
    setCustomModel('');
    setBaseUrl(entry.defaultBaseUrl);
    setFolderId('');
    setKeyValid(null);
  };

  const handleSave = () => {
    const effectiveModel = resolveSelectValue(model, registryEntry.models) === CUSTOM_SENTINEL
      ? customModel
      : model;
    const newSettings: ProviderSettings = {
      provider,
      apiKey,
      model: effectiveModel,
      baseUrl,
      maxContextTokens,
      ...(showFolderId ? { folderId } : {}),
    };
    dispatch({ type: 'SAVE_SETTINGS', payload: newSettings });
    dispatch({ type: 'SET_EXAMPLE_COUNT', payload: localExampleCount });
  };

  const handleCancel = () => {
    dispatch({ type: 'CLOSE_SETTINGS' });
  };

  const handleValidateKey = async () => {
    if (!apiKey) return;
    setValidating(true);
    setKeyValid(null);
    try {
      const adapter = registryEntry.adapter;
      const result = await adapter.validateKey(apiKey, baseUrl);
      setKeyValid(result);
    } catch {
      setKeyValid(false);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold">Настройки</h2>

        <div className="flex flex-col gap-4">
          {/* Provider */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Провайдер</span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderKey)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {PROVIDER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PROVIDER_REGISTRY[key].label}
                </option>
              ))}
            </select>
          </label>

          {/* API Key */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">API-ключ</span>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyValid(null); }}
                placeholder="Введите API-ключ"
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                {showKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </label>

          {/* Validate Key */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidateKey}
              disabled={!apiKey || validating}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? 'Проверка...' : 'Проверить ключ'}
            </button>
            {keyValid === true && <span className="text-green-600 text-sm">&#10003; Ключ действителен</span>}
            {keyValid === false && <span className="text-red-600 text-sm">&#10007; Ключ недействителен</span>}
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Модель</span>
            {registryEntry.models.length > 0 ? (
              <>
                <select
                  value={resolveSelectValue(model, registryEntry.models)}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_SENTINEL) {
                      setModel(CUSTOM_SENTINEL);
                      setCustomModel('');
                    } else {
                      setModel(e.target.value);
                      setCustomModel('');
                    }
                  }}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {registryEntry.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value={CUSTOM_SENTINEL}>Другая (ввести вручную)...</option>
                </select>
                {resolveSelectValue(model, registryEntry.models) === CUSTOM_SENTINEL && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="Название модели"
                    autoFocus
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                )}
              </>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Название модели"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            )}
          </div>

          {/* Base URL */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Base URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://..."
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          {/* Folder ID (YandexGPT only) */}
          {showFolderId && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Folder ID</span>
              <input
                type="text"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="ID каталога Yandex Cloud"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          )}

          {/* Max Context Tokens */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Макс. контекст (токены)</span>
            <input
              type="number"
              value={maxContextTokens}
              onChange={(e) => setMaxContextTokens(Number(e.target.value) || 128000)}
              min={1000}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          {/* Example Count */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Количество примеров</span>
            <input
              type="number"
              value={localExampleCount}
              onChange={(e) => setLocalExampleCount(Math.max(0, Number(e.target.value) || 0))}
              min={0}
              max={10}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
