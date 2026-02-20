import { useState } from 'react';
import { useAppState } from '../context/AppContext';
import { copyToClipboard } from '../utils/clipboard';
import TokenBudget from './TokenBudget';

interface OutputPanelProps {
  onRegenerate: () => void;
  totalTokens: number;
  maxTokens: number;
  isOverBudget: boolean;
}

export default function OutputPanel({
  onRegenerate,
  totalTokens,
  maxTokens,
  isOverBudget,
}: OutputPanelProps) {
  const [state, dispatch] = useAppState();
  const { outputText, isStreaming } = state;
  const [copyFlash, setCopyFlash] = useState(false);

  const hasOutput = outputText.length > 0;

  const handleCopy = async () => {
    const success = await copyToClipboard(outputText);
    if (success) {
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <textarea
        value={outputText}
        onChange={(e) => dispatch({ type: 'SET_OUTPUT_TEXT', payload: e.target.value })}
        readOnly={isStreaming}
        placeholder="Здесь появится готовый документ."
        className="flex-1 min-h-[200px] w-full resize-none rounded border border-gray-300 p-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none read-only:bg-gray-50"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasOutput || isStreaming}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {copyFlash ? 'Скопировано!' : 'Копировать'}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isStreaming}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Заново
          </button>
        </div>

        <TokenBudget
          totalTokens={totalTokens}
          maxTokens={maxTokens}
          isOverBudget={isOverBudget}
        />
      </div>
    </div>
  );
}
