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
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Тип документа
        </label>
        <select
          value={docType}
          onChange={(e) =>
            dispatch({ type: 'SET_DOC_TYPE', payload: e.target.value as DocTypeKey })
          }
          disabled={isStreaming}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 transition-all duration-150 cursor-pointer"
        >
          {DOC_TYPE_KEYS.map((key) => (
            <option key={key} value={key}>
              {DOC_TYPE_CONFIG[key].label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 min-h-0">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Заметки врача
        </label>
        <textarea
          value={inputText}
          onChange={(e) => dispatch({ type: 'SET_INPUT_TEXT', payload: e.target.value })}
          placeholder="Введите заметки врача..."
          autoFocus
          className="flex-1 min-h-[200px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all duration-150"
        />
      </div>

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-200/60 hover:from-rose-600 hover:to-red-600 transition-all duration-200"
        >
          ■ Остановить генерацию
        </button>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={!inputText.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/60 hover:from-indigo-600 hover:to-violet-600 hover:shadow-indigo-300/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
        >
          Сформировать документ →
        </button>
      )}
    </div>
  );
}
