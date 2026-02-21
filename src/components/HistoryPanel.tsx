import { useAppState } from '../context/AppContext';
import type { DocTypeKey } from '../providers/types';

const DOC_TYPE_LABELS: Record<DocTypeKey, string> = {
  pervichniy: 'Первичный осмотр',
  povtorniy: 'Повторный осмотр',
  vk: 'ВК',
  msek: 'МСЭК',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPanel() {
  const [state, dispatch] = useAppState();
  const { sessionHistory, historyOpen, isStreaming } = state;

  if (!historyOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => dispatch({ type: 'TOGGLE_HISTORY' })}
      />

      {/* Drawer panel */}
      <div className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-[#0c1120] border-r border-white/[0.08] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-white">История сеанса</h2>
          </div>
          <div className="flex items-center gap-3">
            {sessionHistory.length > 0 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'CLEAR_SESSION_HISTORY' })}
                disabled={isStreaming}
                className="text-[11px] text-white/30 transition-colors duration-150 hover:text-red-400 disabled:opacity-30"
              >
                Очистить всё
              </button>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_HISTORY' })}
              aria-label="Закрыть"
              className="text-white/30 transition-colors duration-150 hover:text-white"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto">
          {sessionHistory.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs leading-relaxed text-white/25">
              Документы появятся здесь после генерации.
            </p>
          ) : (
            <ul>
              {sessionHistory.map((entry, index) => (
                <li
                  key={entry.id}
                  className={index > 0 ? 'border-t border-white/[0.05]' : ''}
                >
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'RESTORE_SESSION_ENTRY', payload: entry })
                    }
                    disabled={isStreaming}
                    className="w-full px-4 py-3.5 text-left transition-colors duration-150 hover:bg-white/[0.04] active:bg-white/[0.07] disabled:opacity-30"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
                        {DOC_TYPE_LABELS[entry.docType]}
                      </span>
                      <span className="shrink-0 text-[10px] text-white/25">
                        {formatTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-white/45">
                      {entry.inputText.trim().slice(0, 120) || '—'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          <p className="text-center text-[10px] text-white/20">
            История не сохраняется после закрытия вкладки
          </p>
        </div>
      </div>
    </>
  );
}
