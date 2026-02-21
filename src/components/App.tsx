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
    <div className="relative flex min-h-screen flex-col bg-[#070811] font-sans">
      {/* Gradient orb mesh — fixed so it shows through glass panels */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-64 -top-64 h-[700px] w-[700px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-48 top-1/4 h-[600px] w-[600px] rounded-full bg-violet-700/20 blur-[140px]" />
        <div className="absolute -bottom-48 left-1/3 h-[500px] w-[700px] rounded-full bg-blue-900/20 blur-[120px]" />
      </div>

      {/* All content above orbs */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.07] bg-[#070811]/70 backdrop-blur-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 shadow-lg shadow-indigo-500/40 text-[11px] font-bold text-white">
              П
            </div>
            <h1 className="text-[15px] font-bold tracking-tight text-white">
              ПНД<span className="text-indigo-400">.doc</span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            disabled={isStreaming}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.1] hover:border-white/20 hover:text-white disabled:opacity-30 transition-all duration-150"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настройки
          </button>
        </header>

        {/* Main content */}
        <main className="flex flex-1 flex-col gap-4 p-4 md:flex-row md:p-6">
          <div className="flex-1 rounded-3xl border border-white/[0.08] bg-slate-900/50 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl ring-1 ring-inset ring-white/[0.04]">
            <InputPanel onGenerate={handleGenerate} onStop={stop} />
          </div>
          <div className="flex-1 rounded-3xl border border-white/[0.08] bg-slate-900/50 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl ring-1 ring-inset ring-white/[0.04]">
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
    </div>
  );
}
