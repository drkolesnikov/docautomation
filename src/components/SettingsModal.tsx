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

  const inputCls = 'w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150';
  const selectCls = 'w-full rounded-xl border border-white/[0.12] bg-[#0d0e1e] px-3.5 py-2.5 text-sm text-white/90 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150 cursor-pointer';
  const labelCls = 'text-[11px] font-semibold uppercase tracking-widest text-white/35';
  const ghostBtnCls = 'rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/[0.12] hover:text-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 whitespace-nowrap';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#0b0c1a] shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto ring-1 ring-inset ring-white/[0.04]">
        {/* Modal header */}
        <div className="px-6 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 shadow-lg shadow-indigo-500/40 text-[11px] font-bold text-white">
              П
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">Настройки</h2>
              <p className="text-[11px] text-white/35 mt-0.5">Параметры подключения к LLM</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Provider */}
          <div className="flex flex-col gap-2">
            <span className={labelCls}>Провайдер</span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderKey)}
              className={selectCls}
            >
              {PROVIDER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PROVIDER_REGISTRY[key].label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-2">
            <span className={labelCls}>API-ключ</span>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyValid(null); }}
                placeholder="Введите API-ключ"
                className={inputCls + ' flex-1'}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className={ghostBtnCls}
              >
                {showKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>

          {/* Validate Key */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleValidateKey}
              disabled={!apiKey || validating}
              className={ghostBtnCls}
            >
              {validating ? 'Проверка...' : 'Проверить ключ'}
            </button>
            {keyValid === true && (
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-400">
                <span>✓</span> Ключ действителен
              </span>
            )}
            {keyValid === false && (
              <span className="flex items-center gap-1 text-sm font-medium text-rose-400">
                <span>✗</span> Ключ недействителен
              </span>
            )}
          </div>

          {/* Model */}
          <div className="flex flex-col gap-2">
            <span className={labelCls}>Модель</span>
            {registryEntry.models.length > 0 ? (
              <div className="flex flex-col gap-2">
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
                  className={selectCls}
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
                    className={inputCls}
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Название модели"
                className={inputCls}
              />
            )}
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-2">
            <span className={labelCls}>Base URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>

          {/* Folder ID (YandexGPT only) */}
          {showFolderId && (
            <div className="flex flex-col gap-2">
              <span className={labelCls}>Folder ID</span>
              <input
                type="text"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="ID каталога Yandex Cloud"
                className={inputCls}
              />
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/[0.07]" />

          {/* Max Context Tokens */}
          <div className="flex flex-col gap-2">
            <span className={labelCls}>Макс. контекст (токены)</span>
            <input
              type="number"
              value={maxContextTokens}
              onChange={(e) => setMaxContextTokens(Number(e.target.value) || 128000)}
              min={1000}
              className={inputCls}
            />
          </div>

          {/* Example Count */}
          <div className="flex flex-col gap-2">
            <span className={labelCls}>Количество примеров</span>
            <input
              type="number"
              value={localExampleCount}
              onChange={(e) => setLocalExampleCount(Math.max(0, Number(e.target.value) || 0))}
              min={0}
              max={10}
              className={inputCls}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/[0.07] flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.1] hover:text-white transition-all duration-150"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-400 hover:shadow-indigo-500/50 transition-all duration-200"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
