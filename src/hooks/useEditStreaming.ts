import { useCallback, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import type { EditMode } from '../context/AppContext';
import { PROVIDER_REGISTRY } from '../providers/registry';
import { proxyFetch } from '../utils/proxyFetch';
import { estimateTokens } from '../utils/tokenEstimator';
import { EDIT_SYSTEM_PROMPT, buildFragmentEditMessage, buildDocumentEditMessage } from '../utils/editPrompt';

export function useEditStreaming() {
  const [state, dispatch] = useAppState();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const stopEdit = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const runEdit = useCallback(
    async (userMessage: string, mode: EditMode, maxOutputTokens: number) => {
      const { settings } = state;

      if (!settings) {
        dispatch({ type: 'SET_STATUS', payload: 'Настройте провайдер в параметрах.' });
        dispatch({ type: 'OPEN_SETTINGS' });
        return;
      }

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      dispatch({ type: 'SET_EDIT_MODE', payload: mode });
      dispatch({ type: 'SET_EDIT_STREAMING', payload: true });
      dispatch({ type: 'SET_PENDING_EDIT', payload: null });
      dispatch({ type: 'SET_STATUS', payload: null });

      const registryEntry = PROVIDER_REGISTRY[settings.provider];
      const adapter = registryEntry.adapter;

      const requestUrl = adapter.buildRequestUrl(settings.baseUrl, settings.model, settings.apiKey);
      const headers = adapter.formatHeaders(settings.apiKey);
      const body = adapter.formatRequest(
        EDIT_SYSTEM_PROMPT,
        userMessage,
        settings.model,
        maxOutputTokens
      );

      try {
        const response = await proxyFetch(requestUrl, headers, body, abortController.signal);

        if (!response.ok) {
          const status = response.status;
          if (status === 401 || status === 403) {
            dispatch({ type: 'SET_STATUS', payload: 'Ошибка авторизации. Проверьте API-ключ.' });
          } else if (status === 429) {
            dispatch({ type: 'SET_STATUS', payload: 'Превышен лимит запросов. Подождите минуту.' });
          } else {
            dispatch({ type: 'SET_STATUS', payload: `Ошибка сервера (${status}). Попробуйте позже.` });
          }
          return;
        }

        if (!response.body) {
          dispatch({ type: 'SET_STATUS', payload: 'Ошибка сети. Проверьте интернет.' });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let lastChunk = '';
        const isYandex = settings.provider === 'yandexgpt';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let dataContent: string | undefined;
            if (trimmed.startsWith('data: ')) {
              dataContent = trimmed.slice(6);
            } else if (trimmed.startsWith('data:')) {
              dataContent = trimmed.slice(5);
            }

            if (dataContent === undefined || dataContent.trim() === '[DONE]') continue;

            lastChunk = dataContent;
            const parsed = adapter.parseStreamChunk(dataContent);
            if (parsed !== null) {
              if (isYandex) {
                accumulated = parsed;
              } else {
                accumulated += parsed;
              }
              dispatch({ type: 'SET_PENDING_EDIT', payload: accumulated });
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          let dataContent: string | undefined;
          if (trimmed.startsWith('data: ')) dataContent = trimmed.slice(6);
          else if (trimmed.startsWith('data:')) dataContent = trimmed.slice(5);

          if (dataContent !== undefined && dataContent.trim() !== '[DONE]') {
            lastChunk = dataContent;
            const parsed = adapter.parseStreamChunk(dataContent);
            if (parsed !== null) {
              if (isYandex) {
                accumulated = parsed;
              } else {
                accumulated += parsed;
              }
              dispatch({ type: 'SET_PENDING_EDIT', payload: accumulated });
            }
          }
        }

        // Warn if the edit was cut short by max_tokens
        if (lastChunk && adapter.isMaxTokensTruncation(lastChunk)) {
          dispatch({
            type: 'SET_STATUS',
            payload: 'Правка может быть неполной — текст слишком длинный. Попробуйте выделить меньший фрагмент.',
          });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Aborted — either user stopped or new request started; no message needed
        } else if (error instanceof TypeError) {
          dispatch({ type: 'SET_STATUS', payload: 'Ошибка сети. Проверьте интернет.' });
        } else {
          dispatch({ type: 'SET_STATUS', payload: 'Ошибка сети. Проверьте интернет.' });
        }
      } finally {
        dispatch({ type: 'SET_EDIT_STREAMING', payload: false });
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [state, dispatch]
  );

  const editFragment = useCallback(
    (fullDocument: string, fragment: string, instruction: string) => {
      const userMessage = buildFragmentEditMessage(fullDocument, fragment, instruction);
      // LLMs often expand clinical text significantly — allow up to 5× the fragment
      // length, with a generous floor to handle even very short selections.
      const maxOutputTokens = Math.max(1500, estimateTokens(fragment) * 5);
      return runEdit(userMessage, 'selection', maxOutputTokens);
    },
    [runEdit]
  );

  const editDocument = useCallback(
    (fullDocument: string, instruction: string) => {
      const userMessage = buildDocumentEditMessage(fullDocument, instruction);
      // Allow 50% expansion over the original document, with a high floor.
      const maxOutputTokens = Math.max(3000, Math.ceil(estimateTokens(fullDocument) * 1.5));
      return runEdit(userMessage, 'document', maxOutputTokens);
    },
    [runEdit]
  );

  return { editFragment, editDocument, stopEdit };
}
