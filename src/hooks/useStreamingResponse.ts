import { useCallback, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { PROVIDER_REGISTRY } from '../providers/registry';
import { proxyFetch } from '../utils/proxyFetch';
import { buildPrompt, DOC_TYPE_CONFIG } from '../prompts/index';
import { readSSEStream } from '../utils/sseStream';
import { getHttpErrorMessage, NETWORK_ERROR_MSG } from '../utils/httpErrors';
import type { Example } from '../examples/types';
import type { ConversationMessage } from '../providers/types';

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
      const { settings, docType, inputText, conversationHistory } = state;

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
      // Build full messages array: previous turns + current user message
      const messages: ConversationMessage[] = [
        ...conversationHistory,
        { role: 'user', content: inputText },
      ];
      const body = adapter.formatRequest(
        systemPrompt,
        messages,
        settings.model,
        docConfig.maxOutputTokens
      );

      let accumulated = '';
      let completedCleanly = false;

      try {
        const response = await proxyFetch(
          requestUrl,
          headers,
          body,
          abortController.signal,
          settings.proxyUrl,
        );

        if (!response.ok) {
          dispatch({ type: 'SET_STATUS', payload: getHttpErrorMessage(response.status) });
          return;
        }

        if (!response.body) {
          dispatch({ type: 'SET_STATUS', payload: 'Ошибка сети. Проверьте интернет.' });
          return;
        }

        const reader = response.body.getReader();
        const isYandex = settings.provider === 'yandexgpt';

        const lastChunk = await readSSEStream(reader, (dataContent) => {
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
        });

        // Check if the output was truncated due to max_tokens
        if (lastChunk && adapter.isMaxTokensTruncation(lastChunk)) {
          dispatch({
            type: 'SET_STATUS',
            payload: 'Документ может быть неполным. Попробуйте уменьшить ввод.',
          });
        }

        completedCleanly = true;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Only show "interrupted" message if not user-initiated
          if (!userStoppedRef.current) {
            dispatch({ type: 'SET_STATUS', payload: 'Генерация прервана.' });
          }
        } else {
          dispatch({ type: 'SET_STATUS', payload: NETWORK_ERROR_MSG });
        }
      } finally {
        if (completedCleanly && accumulated.trim()) {
          dispatch({
            type: 'PUSH_CONVERSATION_TURN',
            payload: { user: inputText, assistant: accumulated },
          });
          dispatch({
            type: 'PUSH_SESSION_ENTRY',
            payload: { docType, inputText, outputText: accumulated },
          });
        }
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
