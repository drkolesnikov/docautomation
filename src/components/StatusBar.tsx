import { useAppState } from '../context/AppContext';

export default function StatusBar() {
  const [state, dispatch] = useAppState();
  const { statusMessage, isStreaming } = state;

  if (!statusMessage && !isStreaming) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-sm">
      {isStreaming && !statusMessage && (
        <span className="text-blue-600">Генерация...</span>
      )}
      {statusMessage && (
        <div className="flex items-center gap-2">
          <span className="text-red-600">{statusMessage}</span>
          {statusMessage.includes('API-ключ') && (
            <button
              type="button"
              className="text-blue-600 underline hover:text-blue-800"
              onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            >
              Настройки
            </button>
          )}
        </div>
      )}
    </div>
  );
}
