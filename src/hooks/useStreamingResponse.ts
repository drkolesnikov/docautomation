import { useCallback, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { PROVIDER_REGISTRY } from '../providers/registry';
import { proxyFetch } from '../utils/proxyFetch';
import { buildPrompt, DOC_TYPE_CONFIG } from '../prompts/index';
import type { Example } from '../examples/types';

export function useStreamingResponse() {
  const [state, dispatch] = useAppState();
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track whether the abort was user-initiated (stop button) vs. other causes
  const userStoppedRef = useRef(false);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    userStoppedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const generate = useCallback(
    async (examples: Example[]) => {
      const { settings, docType, inputText } = state;

      // Validate settings
      if (!settings) {
        dispatch({ type: 'SET_STATUS', payload: 'Настройте провайдер в параметрах.' });
        dispatch({ type: 'OPEN_SETTINGS' });
        return;
      }

      if (!inputText.trim()) {
        dispatch({ type: 'SET_STATUS', payload: 'Введите заметки врача.' });
        return;
      }

      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      userStoppedRef.current = false;

      // Prepare state for streaming — clear output and any stale canvas state
      dispatch({ type: 'SET_OUTPUT_TEXT', payload: '' });
      dispatch({ type: 'SET_STREAMING', payload: true });
      dispatch({ type: 'SET_STATUS', payload: null });
      dispatch({ type: 'CLEAR_CANVAS_STATE' });

      const registryEntry = PROVIDER_REGISTRY[settings.provider];
      const adapter = registryEntry.adapter;
      const docConfig = DOC_TYPE_CONFIG[docType];
      const systemPrompt = buildPrompt(docType, examples);

      const requestUrl = adapter.buildRequestUrl(
        settings.baseUrl,
        settings.model,
        settings.apiKey
      );
      const headers = adapter.formatHeaders(settings.apiKey);
      const body = adapter.formatRequest(
        systemPrompt,
        inputText,
        settings.model,
        docConfig.maxOutputTokens
      );

      let lastChunk = '';

      try {
        const response = await proxyFetch(
          requestUrl,
          headers,
          body,
          abortController.signal
        );

        if (!response.ok) {
          const status = response.status;
          if (status === 401 || status === 403) {
            dispatch({
              type: 'SET_STATUS',
              payload: 'Ошибка авторизации. Проверьте API-ключ.',
            });
          } else if (status === 429) {
            dispatch({
              type: 'SET_STATUS',
              payload: 'Превышен лимит запросов. Подождите минуту.',
            });
          } else {
            dispatch({
              type: 'SET_STATUS',
              payload: `Ошибка сервера (${status}). Попробуйте позже.`,
            });
          }
          return;
        }

        if (!response.body) {
          dispatch({
            type: 'SET_STATUS',
            payload: 'Ошибка сети. Проверьте интернет.',
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';
        const isYandex = settings.provider === 'yandexgpt';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE lines: split by newlines
          const lines = buffer.split('\n');
          // Keep the last (possibly incomplete) line in the buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // SSE data lines start with "data: "
            // Some providers send "data:" without space
            let dataContent: string | undefined;
            if (trimmed.startsWith('data: ')) {
              dataContent = trimmed.slice(6);
            } else if (trimmed.startsWith('data:')) {
              dataContent = trimmed.slice(5);
            }

            if (dataContent === undefined) continue;

            // "[DONE]" is a common stream terminator
            if (dataContent.trim() === '[DONE]') continue;

            lastChunk = dataContent;
            const parsed = adapter.parseStreamChunk(dataContent);

            if (parsed !== null) {
              if (isYandex) {
                // YandexGPT returns the full text in each chunk — replace
                accumulated = parsed;
              } else {
                // All other providers return incremental deltas — append
                accumulated += parsed;
              }
              dispatch({ type: 'SET_OUTPUT_TEXT', payload: accumulated });
            }
          }
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
          let dataContent: string | undefined;
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ')) {
            dataContent = trimmed.slice(6);
          } else if (trimmed.startsWith('data:')) {
            dataContent = trimmed.slice(5);
          }

          if (dataContent !== undefined && dataContent.trim() !== '[DONE]') {
            lastChunk = dataContent;
            const parsed = adapter.parseStreamChunk(dataContent);
            if (parsed !== null) {
              if (isYandex) {
                accumulated = parsed;
              } else {
                accumulated += parsed;
              }
              dispatch({ type: 'SET_OUTPUT_TEXT', payload: accumulated });
            }
          }
        }

        // Check if the output was truncated due to max_tokens
        if (lastChunk && adapter.isMaxTokensTruncation(lastChunk)) {
          dispatch({
            type: 'SET_STATUS',
            payload: 'Документ может быть неполным. Попробуйте уменьшить ввод.',
          });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Only show "interrupted" message if not user-initiated
          if (!userStoppedRef.current) {
            dispatch({
              type: 'SET_STATUS',
              payload: 'Генерация прервана.',
            });
          }
        } else if (error instanceof TypeError) {
          // fetch throws TypeError for network failures
          dispatch({
            type: 'SET_STATUS',
            payload: 'Ошибка сети. Проверьте интернет.',
          });
        } else {
          dispatch({
            type: 'SET_STATUS',
            payload: 'Ошибка сети. Проверьте интернет.',
          });
        }
      } finally {
        dispatch({ type: 'SET_STREAMING', payload: false });
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [state, dispatch]
  );

  return { generate, stop };
}
