import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';
import { applyGuideTripAction, isTripAction, validateGuideRequest, validateGuideResponse } from '../ai-guide.ts';
import { guideContent, minimalRequest, MILAI_INSTRUCTION } from './guide-context.ts';

type Generate = (options: GenerateContentParameters) => Promise<{ text?: string }>;
type Options = { apiKey?: string; model?: string; generate?: Generate; now?: () => number; rateLimit?: number; timeoutMs?: number };

const text = { type: 'string' } as const;
const action = (type: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'object', required: ['type', ...required], additionalProperties: false,
  properties: { type: { type: 'string', enum: [type] }, ...properties },
});
const responseSchema = {
  type: 'object', required: ['reply', 'placeIds', 'serviceIds', 'actions'], additionalProperties: false,
  properties: {
    reply: text,
    placeIds: { type: 'array', items: text },
    serviceIds: { type: 'array', items: text },
    actions: { type: 'array', items: { anyOf: [
      action('open_map'),
      ...['focus_place', 'add_stop', 'remove_stop'].map(type => action(type, { placeId: text }, ['placeId'])),
      action('nearby', { reference: { type: 'string', enum: ['start', 'destination'] }, placeId: text }, ['reference']),
      action('build_day', { originId: text, minutes: { type: 'integer' }, category: { type: 'string', enum: ['all', 'history', 'nature', 'culture'] }, roundTrip: { type: 'boolean' }, maxStops: { type: 'integer' }, stopIds: { type: 'array', items: text } }),
      action('reorder_stops', { stopIds: { type: 'array', items: text } }, ['stopIds']),
      action('save_trip'),
      action('complete_journey', { journeyId: text }, ['journeyId']),
      action('recommend_service', { serviceId: text }, ['serviceId']),
    ] } },
  },
};

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
const error = (status: number, code: string, message: string, headers?: HeadersInit) => json({ success: false, error: { code, message } }, status, headers);

async function limitedBody(request: Request) {
  if (!request.body) throw new SyntaxError('Missing JSON body.');
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let size = 0, body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) { await reader.cancel(); throw new RangeError('Request body exceeds 16 KB.'); }
    body += decoder.decode(value, { stream: true });
  }
  return JSON.parse(body + decoder.decode());
}

// One handler instance per server process keeps a small quota guard without a second service.
export function createGuideHandler({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash', generate, now = Date.now, rateLimit = 12, timeoutMs = 25_000 }: Options = {}) {
  const ai = apiKey && !generate ? new GoogleGenAI({ apiKey }) : null;
  const call: Generate | null = generate ?? (ai ? options => ai.models.generateContent(options) : null);
  let windowStart = now(), calls = 0, inFlight = 0;

  return async function handleGuidePost(request: Request): Promise<Response> {
    let input: unknown;
    try { input = await limitedBody(request); }
    catch (cause) {
      if (cause instanceof RangeError) return error(413, 'REQUEST_TOO_LARGE', 'Request body exceeds 16 KB. Shorten the message or history.');
      return error(400, 'INVALID_JSON', 'Send a valid JSON object.');
    }
    let guideRequest;
    try { guideRequest = minimalRequest(validateGuideRequest(input)); }
    catch (cause) { return error(400, 'INVALID_REQUEST', cause instanceof Error ? cause.message : 'Invalid guide request.'); }
    if (!call) return error(503, 'AI_NOT_CONFIGURED', 'Milai needs GEMINI_API_KEY in the Bilad server environment. Set it and restart the site.');

    const currentTime = now();
    if (currentTime - windowStart >= 60_000) { windowStart = currentTime; calls = 0; }
    if (calls >= rateLimit || inFlight >= 4) return error(429, 'RATE_LIMITED', 'Milai has reached its one-minute request limit. Wait a minute and retry.', { 'Retry-After': '60' });
    calls++; inFlight++;

    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const options: GenerateContentParameters = {
        model,
        config: {
          systemInstruction: MILAI_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          maxOutputTokens: 2500,
          ...(model.startsWith('gemini-2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          abortSignal: controller.signal,
          httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
        },
        contents: JSON.stringify({ ...guideRequest, content: guideContent(guideRequest) }),
      };
      const response = await Promise.race([
        call(options),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })); }, timeoutMs); }),
      ]);
      try {
        if (!response.text || response.text.length > 12_000) throw new Error('Empty or oversized model response.');
        const data = validateGuideResponse(JSON.parse(response.text), guideRequest);
        for (const proposed of data.actions) if (isTripAction(proposed)) applyGuideTripAction(guideRequest.context.trip!, proposed);
        return json({ success: true, data });
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : 'Invalid model response.';
        return error(502, 'MODEL_RESPONSE_INVALID', `Milai returned an invalid proposal: ${reason} No changes were made. Rephrase your request or adjust the trip settings.`);
      }
    } catch (cause) {
      if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) return error(504, 'AI_TIMEOUT', 'Milai took too long to reply. Your trip is unchanged. Please retry.');
      if (typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 429) return error(429, 'AI_QUOTA_EXCEEDED', 'Gemini quota is temporarily exhausted. Try again later.');
      return error(502, 'AI_UNAVAILABLE', 'Milai could not reach Gemini. Check the server key, model and quota, then retry.');
    } finally {
      if (timer) clearTimeout(timer);
      request.signal.removeEventListener('abort', abort);
      inFlight--;
    }
  };
}
