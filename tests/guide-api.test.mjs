import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideHandler } from '../src/lib/server/guide-api.ts';
import { guideContent } from '../src/lib/server/guide-context.ts';
import { initialTrip } from '../src/lib/trip-planner.ts';
import { origins } from '../src/lib/destinations.ts';

const request = (message = 'Tell me about Babylon', context = {}) => ({ message, history: [], context });
const answer = actions => ({ reply: 'A Bilad answer.', placeIds: ['babylon'], serviceIds: [], actions });
const post = (body, handler) => handler(new Request('http://bilad.test/api/guide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

test('Bilad route gives Gemini curated content and validates the structured reply', async () => {
  let options;
  const handle = createGuideHandler({ apiKey: '', generate: async input => { options = input; return { text: JSON.stringify(answer([])) }; } });
  const response = await post(request(), handle);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, answer([]));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(options.config.responseMimeType, 'application/json');
  const prompt = JSON.parse(options.contents);
  assert.equal(prompt.content.places.find(place => place.id === 'babylon').source, 'https://whc.unesco.org/en/list/278/');
  assert.equal(prompt.context.trip, undefined);
  assert.equal(JSON.stringify(prompt).includes('private notes'), false);
  assert.ok(guideContent(request('Recommend a taxi')).services.some(service => service.id === 'baly'));
});

test('Bilad route rejects malformed requests and model proposals before applying actions', async () => {
  let calls = 0;
  const handle = createGuideHandler({ apiKey: '', generate: async () => { calls++; return { text: JSON.stringify(answer([])) }; } });
  for (const body of ['{bad', request(''), { ...request(), context: { privateNotes: 'secret' } }]) {
    const response = await post(body, handle);
    assert.equal(response.status, 400);
  }
  assert.equal((await post({ message: 'x'.repeat(17_000) }, handle)).status, 413);
  assert.equal(calls, 0);

  const trip = { ...initialTrip, origin: origins[0] };
  for (const actions of [[{ type: 'delete_journey', journeyId: 'x' }], [{ type: 'build_day', stopIds: ['unknown'] }], [{ type: 'build_day', stopIds: ['ur'] }]]) {
    const invalid = createGuideHandler({ apiKey: '', generate: async () => ({ text: JSON.stringify(answer(actions)) }) });
    const response = await post(request('Plan 4 hours in Baghdad', { trip }), invalid);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'MODEL_RESPONSE_INVALID');
  }
});

test('Bilad route reports configuration, quota and timeout errors without provider details', async () => {
  const unconfigured = createGuideHandler({ apiKey: '' });
  const missing = await post(request(), unconfigured);
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, 'AI_NOT_CONFIGURED');

  const limited = createGuideHandler({ apiKey: '', rateLimit: 1, generate: async () => ({ text: JSON.stringify(answer([])) }) });
  assert.equal((await post(request(), limited)).status, 200);
  const throttled = await post(request(), limited);
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers.get('retry-after'), '60');

  const timeout = createGuideHandler({ apiKey: '', timeoutMs: 5, generate: () => new Promise(() => {}) });
  const delayed = await post(request(), timeout);
  assert.equal(delayed.status, 504);
  assert.equal((await delayed.json()).error.code, 'AI_TIMEOUT');

  const failed = createGuideHandler({ apiKey: '', generate: async () => { throw new Error('SECRET provider message'); } });
  const unavailable = await post(request(), failed);
  assert.equal(unavailable.status, 502);
  assert.equal(JSON.stringify(await unavailable.json()).includes('SECRET'), false);
});
