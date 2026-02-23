/**
 * Maps an HTTP response status code to a user-facing Russian error message.
 *
 * Used by streaming hooks to surface API errors without repeating the same
 * status-to-string mapping in every call site.
 */
export function getHttpErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'Ошибка авторизации. Проверьте API-ключ.';
  }
  if (status === 429) {
    return 'Превышен лимит запросов. Подождите минуту.';
  }
  return `Ошибка сервера (${status}). Попробуйте позже.`;
}

/**
 * Standard message shown when a network-level failure occurs (fetch TypeError,
 * blocked proxy, etc.).
 */
export const NETWORK_ERROR_MSG =
  'Ошибка сети. Проверьте интернет или URL прокси в настройках.';
