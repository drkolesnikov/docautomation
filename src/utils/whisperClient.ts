import { proxyFetchFormData } from './proxyFetch';

export interface WhisperSettings {
  apiKey: string;
  baseUrl: string;
  language: string;
  proxyUrl?: string;
}

export async function transcribeAudio(
  audioBlob: Blob,
  settings: WhisperSettings,
  signal?: AbortSignal
): Promise<string> {
  const base = settings.baseUrl.replace(/\/+$/, '');
  const url = `${base}/v1/audio/transcriptions`;

  const formData = new FormData();
  // Determine a filename extension the Whisper API will accept
  const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  formData.append('file', audioBlob, `recording.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', settings.language);
  formData.append('response_format', 'json');

  const response = await proxyFetchFormData(
    url,
    { Authorization: `Bearer ${settings.apiKey}` },
    formData,
    signal,
    settings.proxyUrl,
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error('AUTH_ERROR');
  }
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  const data = await response.json() as { text?: string };
  if (typeof data.text !== 'string') {
    throw new Error('MALFORMED_RESPONSE');
  }
  return data.text;
}
