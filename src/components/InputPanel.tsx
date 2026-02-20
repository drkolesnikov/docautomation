import { useAppState } from '../context/AppContext';
import { DOC_TYPE_CONFIG } from '../prompts/index';
import type { DocTypeKey } from '../providers/types';

interface InputPanelProps {
  onGenerate: () => void;
  onStop: () => void;
}

const DOC_TYPE_KEYS: DocTypeKey[] = ['pervichniy', 'povtorniy', 'vk', 'msek'];

export default function InputPanel({ onGenerate, onStop }: InputPanelProps) {
  const [state, dispatch] = useAppState();
  const { docType, inputText, isStreaming } = state;

  return (
    <div className="flex flex-col gap-3 h-full">
      <select
        value={docType}
        onChange={(e) =>
          dispatch({ type: 'SET_DOC_TYPE', payload: e.target.value as DocTypeKey })
        }
        disabled={isStreaming}
        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
      >
        {DOC_TYPE_KEYS.map((key) => (
          <option key={key} value={key}>
            {DOC_TYPE_CONFIG[key].label}
          </option>
        ))}
      </select>

      <textarea
        value={inputText}
        onChange={(e) => dispatch({ type: 'SET_INPUT_TEXT', payload: e.target.value })}
        placeholder="Введите заметки врача..."
        autoFocus
        className="flex-1 min-h-[200px] w-full resize-none rounded border border-gray-300 p-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
      />

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="w-full rounded bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          Остановить
        </button>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={!inputText.trim()}
          className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Сформировать
        </button>
      )}
    </div>
  );
}
