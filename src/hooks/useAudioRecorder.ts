import { useState, useRef, useCallback } from 'react';
import { transcribeAudio } from '../utils/whisperClient';
import type { WhisperSettings } from '../utils/whisperClient';

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error';

interface UseAudioRecorderOptions {
  whisperSettings: WhisperSettings;
  onTranscribed: (text: string) => void;
  onError: (message: string) => void;
}

export function useAudioRecorder({
  whisperSettings,
  onTranscribed,
  onError,
}: UseAudioRecorderOptions) {
  const [status, setStatus] = useState<RecorderStatus>('idle');

  // Keep a ref to the latest settings so onstop closure always sees current values
  const whisperSettingsRef = useRef<WhisperSettings>(whisperSettings);
  whisperSettingsRef.current = whisperSettings;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    if (status !== 'idle') return;
    setStatus('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError('Нет доступа к микрофону. Разрешите использование в браузере.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      });

      setStatus('transcribing');
      abortRef.current = new AbortController();

      try {
        const text = await transcribeAudio(
          blob,
          whisperSettingsRef.current,
          abortRef.current.signal
        );
        onTranscribed(text);
        setStatus('idle');
      } catch (err) {
        if (abortRef.current?.signal.aborted) {
          setStatus('idle');
          return;
        }
        if (err instanceof Error && err.message === 'AUTH_ERROR') {
          onError('Ошибка авторизации Whisper. Проверьте API-ключ в настройках.');
        } else {
          onError('Ошибка распознавания речи. Попробуйте ещё раз.');
        }
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    };

    recorder.start();
    setStatus('recording');
  }, [status, onTranscribed, onError]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    setStatus('idle');
  }, []);

  return { status, start, stop, cancel };
}
