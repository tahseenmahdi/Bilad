import { validateGuideRequest, validateGuideResponse, type GuideRequest } from './ai-guide.ts';

export function assertGuideSnapshot(expected: string, current: string) {
  if (expected !== current) throw new Error('Your trip changed while Milai was replying. No action was applied. Ask again using the current trip.');
}

export async function fetchGuide(request: GuideRequest, baseUrl: string | undefined, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  validateGuideRequest(request);
  if (!baseUrl?.trim()) throw new Error('Milai is unavailable: NEXT_PUBLIC_BILAD_AI_API_URL is not configured. The website host must set it and rebuild.');
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Milai API URL is invalid. Ask the website host to configure it.');
  // Keep UTF-8 payloads within the server's byte limit, including Arabic history.
  const bounded = { ...request, history: [...request.history] };
  while (new TextEncoder().encode(JSON.stringify(bounded)).byteLength > 15000 && bounded.history.length) bounded.history.shift();
  const bodyText = JSON.stringify(bounded);
  if (new TextEncoder().encode(bodyText).byteLength > 16000) throw new Error('This request is too large. Shorten the question or trip context.');
  const response = await fetcher(`${url.href.replace(/\/$/, '')}/api/guide`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyText, signal, credentials: 'omit',
  });
  const raw = await response.text();
  if (raw.length > 24000) throw new Error('Milai returned an oversized response. Please retry.');
  let body;
  try { body = JSON.parse(raw); } catch { throw new Error('Milai returned an unreadable API response. Check the API URL or retry.'); }
  if (!response.ok || body?.success !== true) throw new Error(typeof body?.error?.message === 'string' ? body.error.message.slice(0, 700) : `Milai is unavailable (HTTP ${response.status}). Please retry.`);
  return validateGuideResponse(body.data, request);
}
