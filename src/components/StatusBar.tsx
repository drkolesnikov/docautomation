import { useAppState } from '../context/AppContext';

export default function StatusBar() {
  const [state, dispatch] = useAppState();
  const { statusMessage, isStreaming } = state;

  if (!statusMessage && !isStreaming) return null;

  return (
    <div className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm px-6 py-2.5 flex items-center gap-2 min-h-[38px]">
      {isStreaming && !statusMessage && (
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
          </span>
          <span className="text-xs font-medium text-indigo-600">Генерация...</span>
        </div>
      )}
      {statusMessage && (
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium text-rose-600">{statusMessage}</span>
          {statusMessage.includes('API-ключ') && (
            <button
              type="button"
              className="text-xs font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800 transition-colors"
              onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            >
              Открыть настройки
            </button>
          )}
        </div>
      )}
    </div>
  );
}
