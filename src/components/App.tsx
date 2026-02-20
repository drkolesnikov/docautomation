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
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">ПНД.doc</h1>
        <button
          type="button"
          onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
          disabled={isStreaming}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Настройки
        </button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col md:flex-row">
        <div className="flex-1 border-b border-gray-200 p-4 md:border-b-0 md:border-r">
          <InputPanel onGenerate={handleGenerate} onStop={stop} />
        </div>
        <div className="flex-1 p-4">
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
