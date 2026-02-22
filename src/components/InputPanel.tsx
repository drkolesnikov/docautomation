import { useState } from 'react';
import { useAppState } from '../context/AppContext';
import { DOC_TYPE_CONFIG } from '../prompts/index';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import type { DocTypeKey } from '../providers/types';
import type { WhisperSettings } from '../utils/whisperClient';

interface InputPanelProps {
  onGenerate: () => void;
  onStop: () => void;
}

const DOC_TYPE_KEYS: DocTypeKey[] = ['pervichniy', 'msek'];

function formatTurns(n: number): string {
  if (n === 1) return '1 обмен';
  if (n >= 2 && n <= 4) return `${n} обмена`;
  return `${n} обменов`;
}

// Mic icon SVG
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

// Stop recording icon
function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export default function InputPanel({ onGenerate, onStop }: InputPanelProps) {
  const [state, dispatch] = useAppState();
  const { docType, inputText, isStreaming, conversationHistory, settings } = state;
  const turnCount = conversationHistory.length / 2;
  const [confirming, setConfirming] = useState(false);

  // Derive whisper settings from provider settings (null if not configured)
  const whisperSettings: WhisperSettings = {
    apiKey: settings?.whisperApiKey ?? '',
    baseUrl: settings?.whisperBaseUrl ?? 'https://api.openai.com',
    language: settings?.whisperLanguage ?? 'ru',
    proxyUrl: settings?.proxyUrl,
  };
  const whisperConfigured = Boolean(settings?.whisperApiKey);

  const { status: recorderStatus, start: startRecording, stop: stopRecording } =
    useAudioRecorder({
      whisperSettings,
      onTranscribed: (text) => {
        // Append transcribed text to existing notes (with separator if needed)
        const current = state.inputText.trim();
        const next = current ? `${current}\n${text}` : text;
        dispatch({ type: 'SET_INPUT_TEXT', payload: next });
      },
      onError: (message) => {
        dispatch({ type: 'SET_STATUS', payload: message });
      },
    });

  const isRecording = recorderStatus === 'recording';
  const isTranscribing = recorderStatus === 'transcribing';
  const isRequesting = recorderStatus === 'requesting';
  const isRecorderBusy = isRecording || isTranscribing || isRequesting;

  const handleMicClick = () => {
    if (!whisperConfigured) {
      dispatch({ type: 'SET_STATUS', payload: 'Настройте Whisper API-ключ в настройках для голосового ввода.' });
      dispatch({ type: 'OPEN_SETTINGS' });
      return;
    }
    if (isRecording) {
      stopRecording();
    } else if (!isRecorderBusy) {
      startRecording();
    }
  };

  const handleGenerateClick = () => {
    if (turnCount > 0) {
      setConfirming(true);
    } else {
      onGenerate();
    }
  };

  const handleConfirmClearAndGenerate = () => {
    dispatch({ type: 'CLEAR_CONVERSATION' });
    setConfirming(false);
    onGenerate();
  };

  const handleConfirmKeepAndGenerate = () => {
    setConfirming(false);
    onGenerate();
  };

  // Mic button visual state
  const micButtonContent = () => {
    if (isRequesting) {
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/50">
          <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white/70 animate-spin inline-block" />
          Доступ...
        </span>
      );
    }
    if (isRecording) {
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <StopIcon className="h-3 w-3" />
          Остановить
        </span>
      );
    }
    if (isTranscribing) {
      return (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400/80">
          <span className="h-3 w-3 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin inline-block" />
          Распознавание...
        </span>
      );
    }
    return <MicIcon className="h-3.5 w-3.5" />;
  };

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
        {/* Label row with mic button */}
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
            Заметки врача
          </label>
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isStreaming || isTranscribing}
            title={
              isRecording
                ? 'Остановить запись'
                : isTranscribing
                ? 'Идёт распознавание...'
                : whisperConfigured
                ? 'Записать голосовые заметки'
                : 'Настроить Whisper для голосового ввода'
            }
            className={[
              'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-all duration-150',
              isRecording
                ? 'border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                : isTranscribing || isRequesting
                ? 'border border-white/10 bg-white/[0.05] text-white/40 cursor-default'
                : whisperConfigured
                ? 'border border-white/10 bg-white/[0.05] text-white/40 hover:bg-white/[0.1] hover:text-white/70'
                : 'border border-white/[0.07] bg-transparent text-white/20 hover:text-white/40',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {micButtonContent()}
          </button>
        </div>

        <textarea
          value={inputText}
          onChange={(e) => dispatch({ type: 'SET_INPUT_TEXT', payload: e.target.value })}
          placeholder="Введите заметки врача..."
          autoFocus
          className="min-h-[200px] w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 py-3 text-sm leading-relaxed text-white/90 placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150 md:flex-1"
        />
      </div>

      {turnCount > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400/90">
              <span>⚠</span>
              Заметки предыдущего пациента в контексте ({formatTurns(turnCount)})
            </span>
            <button
              type="button"
              onClick={() => { dispatch({ type: 'CLEAR_CONVERSATION' }); setConfirming(false); }}
              disabled={isStreaming}
              className="text-[11px] text-amber-400/60 underline underline-offset-2 transition-colors duration-150 hover:text-amber-300 disabled:opacity-30"
            >
              Очистить
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-300/60">
            Данные прошлого сеанса будут отправлены вместе с новым запросом.
            Очистите контекст перед работой с другим пациентом.
          </p>
        </div>
      )}

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-[12px] font-semibold leading-snug text-amber-300">
            Заметки предыдущего пациента будут отправлены в LLM вместе с текущим запросом.
          </p>
          <p className="text-[11px] text-amber-300/60">
            Выберите действие:
          </p>
          <button
            type="button"
            onClick={handleConfirmClearAndGenerate}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm shadow-indigo-500/20 hover:from-indigo-400 hover:to-violet-400 transition-all duration-150"
          >
            Очистить контекст и сформировать
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmKeepAndGenerate}
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white/50 hover:bg-white/[0.1] hover:text-white/70 transition-all duration-150"
            >
              Сформировать с контекстом
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white/40 hover:bg-white/[0.1] hover:text-white/60 transition-all duration-150"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : isStreaming ? (
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
          onClick={handleGenerateClick}
          disabled={!inputText.trim() || isRecorderBusy}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-400 hover:shadow-indigo-500/50 disabled:opacity-25 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
        >
          Сформировать документ →
        </button>
      )}
    </div>
  );
}
