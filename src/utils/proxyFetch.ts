const VITE_WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined;

export async function proxyFetch(
  targetUrl: string,
  headers: Record<string, string>,
  body: object,
  signal?: AbortSignal,
  workerUrl?: string
): Promise<Response> {
  const url = workerUrl || VITE_WORKER_URL;
  if (!url) {
    throw new Error('Worker URL is not configured');
  }
  return fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'x-target-url': targetUrl,
    },
    body: JSON.stringify(body),
    signal,
  });
}

// For multipart/form-data requests (e.g. Whisper audio transcription).
// Does NOT set Content-Type — the browser sets it automatically with the boundary.
export async function proxyFetchFormData(
  targetUrl: string,
  headers: Record<string, string>,
  formData: FormData,
  signal?: AbortSignal,
  workerUrl?: string
): Promise<Response> {
  const url = workerUrl || VITE_WORKER_URL;
  if (!url) {
    throw new Error('Worker URL is not configured');
  }
  return fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'x-target-url': targetUrl,
    },
    body: formData,
    signal,
  });
}
