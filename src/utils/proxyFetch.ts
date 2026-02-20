const WORKER_URL = import.meta.env.VITE_WORKER_URL;

export async function proxyFetch(
  targetUrl: string,
  headers: Record<string, string>,
  body: object,
  signal?: AbortSignal
): Promise<Response> {
  if (!WORKER_URL) {
    throw new Error('VITE_WORKER_URL is not configured');
  }
  return fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      ...headers,
      'x-target-url': targetUrl,
    },
    body: JSON.stringify(body),
    signal,
  });
}
