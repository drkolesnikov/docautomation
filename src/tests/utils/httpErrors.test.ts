import { describe, it, expect } from 'vitest';
import { getHttpErrorMessage, NETWORK_ERROR_MSG } from '../../utils/httpErrors';

describe('getHttpErrorMessage', () => {
  it('returns auth error message for 401', () => {
    const msg = getHttpErrorMessage(401);
    expect(msg).toBe('Ошибка авторизации. Проверьте API-ключ.');
  });

  it('returns auth error message for 403', () => {
    const msg = getHttpErrorMessage(403);
    expect(msg).toBe('Ошибка авторизации. Проверьте API-ключ.');
  });

  it('returns rate-limit message for 429', () => {
    const msg = getHttpErrorMessage(429);
    expect(msg).toBe('Превышен лимит запросов. Подождите минуту.');
  });

  it('returns generic message with status code for other errors', () => {
    expect(getHttpErrorMessage(500)).toBe('Ошибка сервера (500). Попробуйте позже.');
    expect(getHttpErrorMessage(503)).toBe('Ошибка сервера (503). Попробуйте позже.');
    expect(getHttpErrorMessage(404)).toBe('Ошибка сервера (404). Попробуйте позже.');
  });
});

describe('NETWORK_ERROR_MSG', () => {
  it('is a non-empty string', () => {
    expect(typeof NETWORK_ERROR_MSG).toBe('string');
    expect(NETWORK_ERROR_MSG.length).toBeGreaterThan(0);
  });

  it('mentions network and proxy', () => {
    expect(NETWORK_ERROR_MSG).toContain('сети');
    expect(NETWORK_ERROR_MSG).toContain('прокси');
  });
});
