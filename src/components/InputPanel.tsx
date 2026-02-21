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
    <div className="flex flex-col gap-4 md:h-full">
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
          Тип документа
        </label>
        <select
          value={docType}
          onChange={(e) =>
            dispatch({ type: 'SET_DOC_TYPE', payload: e.target.value as DocTypeKey })
          }
          disabled={isStreaming}
          className="w-full rounded-xl border border-white/[0.12] bg-[#0d0e1e] px-3.5 py-2.5 text-sm text-white/90 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-30 transition-all duration-150 cursor-pointer"
        >
          {DOC_TYPE_KEYS.map((key) => (
            <option key={key} value={key}>
              {DOC_TYPE_CONFIG[key].label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 flex-col gap-2 min-h-0">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
          Заметки врача
        </label>
        <textarea
          value={inputText}
          onChange={(e) => dispatch({ type: 'SET_INPUT_TEXT', payload: e.target.value })}
          placeholder="Введите заметки врача..."
          autoFocus
          className="min-h-[200px] w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 py-3 text-sm leading-relaxed text-white/90 placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150 md:flex-1"
        />
      </div>

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 hover:from-rose-400 hover:to-red-400 hover:shadow-rose-500/50 transition-all duration-200"
        >
          ■ Остановить генерацию
        </button>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={!inputText.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-400 hover:shadow-indigo-500/50 disabled:opacity-25 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
        >
          Сформировать документ →
        </button>
      )}
    </div>
  );
}
