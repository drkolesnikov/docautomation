import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../context/AppContext';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { useTokenBudget } from '../hooks/useTokenBudget';
import { loadExamples } from '../examples/loader';
import type { Example } from '../examples/types';
import InputPanel from './InputPanel';
import OutputPanel from './OutputPanel';
import SettingsModal from './SettingsModal';
import StatusBar from './StatusBar';

export default function App() {
  const [state, dispatch] = useAppState();
  const { docType, isStreaming, settings } = state;

  const [examples, setExamples] = useState<Example[]>([]);

  // Load examples when doc type changes
  useEffect(() => {
    let cancelled = false;
    loadExamples(docType).then((loaded) => {
      if (!cancelled) {
        setExamples(loaded);
        if (loaded.length === 0) {
          dispatch({ type: 'SET_STATUS', payload: 'Примеры не найдены. Качество может быть ниже.' });
        }
      }
    });
    return () => { cancelled = true; };
  }, [docType, dispatch]);

  const { totalTokens, maxTokens, isOverBudget, effectiveExamples } = useTokenBudget(examples);
  const { generate, stop } = useStreamingResponse();

  const handleGenerate = useCallback(() => {
    if (isOverBudget) {
      dispatch({ type: 'SET_STATUS', payload: 'Текст слишком длинный. Уменьшите заметки или примеры.' });
      return;
    }
    if (!settings) {
      dispatch({ type: 'SET_STATUS', payload: 'Настройте провайдер в параметрах.' });
      dispatch({ type: 'OPEN_SETTINGS' });
      return;
    }
    generate(effectiveExamples);
  }, [isOverBudget, settings, effectiveExamples, generate, dispatch]);

  const handleRegenerate = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/70 bg-white/80 backdrop-blur-xl px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-200/60 text-[10px] font-bold text-white">
            П
          </div>
          <h1 className="text-[15px] font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            ПНД.doc
          </h1>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
          disabled={isStreaming}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all duration-150"
        >
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Настройки
        </button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col gap-4 p-4 md:flex-row md:p-6">
        <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <InputPanel onGenerate={handleGenerate} onStop={stop} />
        </div>
        <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <OutputPanel
            onRegenerate={handleRegenerate}
            totalTokens={totalTokens}
            maxTokens={maxTokens}
            isOverBudget={isOverBudget}
          />
        </div>
      </main>

      {/* Status bar */}
      <StatusBar />

      {/* Settings modal */}
      <SettingsModal />
    </div>
  );
}
