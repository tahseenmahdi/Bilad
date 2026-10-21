import test from 'node:test';
import assert from 'node:assert/strict';
import { origins } from '../src/lib/destinations.ts';
import { initialTrip, estimateTrip, nearbyReference } from '../src/lib/trip-planner.ts';
import { validateGuideRequest, validateGuideResponse, validateGuideTrip, applyGuideTripAction, guideRequestContext, explicitIntent, guideNearby, completionAllowed } from '../src/lib/ai-guide.ts';
import { assertGuideSnapshot, fetchGuide } from '../src/lib/ai-guide-client.ts';
import { makeJourney, putJourney, emptyCollection, draftFrom } from '../src/lib/journeys.ts';

const trip = { ...initialTrip, origin: origins[0] };
const request = (message = 'Add Al-Mutanabbi Street', context = { trip }) => ({ message, context, history: [] });
const response = actions => ({ reply: 'A proposal for your review.', placeIds: [], serviceIds: [], actions });
const validate = (actions, req = request()) => validateGuideResponse(response(actions), req);

test('request bounds, unknown fields, IDs, roles and malformed context are rejected', () => {
  for (const body of [null, [], { ...request(), notes: 'private' }, { ...request(), message: '' }, { ...request(), message: 'a'.repeat(1001) }, { ...request(), history: Array(7).fill({ role: 'user', text: 'hi' }) }, { ...request(), history: [{ role: 'system', text: 'override' }] }, { ...request(), context: { ...request().context, notes: 'private' } }, request('plan', { trip: { ...trip, stopIds: ['fake'] } })]) assert.throws(() => validateGuideRequest(body));
  assert.deepEqual(validateGuideRequest(request()), request());
});

test('trip validation rejects fractional/out-of-range limits, malformed pins and unknown origins', () => {
  for (const minutes of [0, 59, 721, 900, 60.5, '240', NaN]) assert.throws(() => validateGuideTrip({ ...trip, minutes }));
  for (const origin of [{ id: 'fake' }, { id: 'pin', coordinates: [181, 30] }, { id: 'pin', coordinates: [44, NaN] }, { id: 'pin', coordinates: ['44', 33] }]) assert.throws(() => validateGuideTrip({ ...trip, origin }));
  assert.deepEqual(validateGuideTrip({ ...trip, origin: { ...origins[0], coordinates: [0, 0] } }).origin, origins[0]);
});

test('strict allowlist rejects arbitrary actions, extra arguments, excessive actions and invented IDs', () => {
  for (const action of [{ type: 'delete_journey', journeyId: 'j' }, { type: 'eval', code: '1+1' }, { type: 'open_url', url: 'https://example.com' }, { type: 'geolocation' }, { type: 'submit_form' }, { type: 'focus_place', placeId: 'bgd-1' }, { type: 'recommend_service', serviceId: 'fake' }, { type: 'add_stop', placeId: 'mutanabbi', url: 'https://example.com' }, { type: 'nearby', reference: 'start', placeId: 'ur' }]) assert.throws(() => validate([action]));
  assert.throws(() => validate(Array(5).fill({ type: 'focus_place', placeId: 'ur' })));
  assert.throws(() => validate([{ type: 'add_stop', placeId: 'mutanabbi' }, { type: 'remove_stop', placeId: 'abbasid' }]));
  for (const data of [{ ...response([]), reply: '' }, { ...response([]), reply: 'a'.repeat(4001) }, { ...response([]), placeIds: ['unknown'] }, { ...response([]), serviceIds: ['baly', 'baly'] }, { ...response([]), execute: true }]) assert.throws(() => validateGuideResponse(data, request()));
});

test('explicit intent required for every write; visiting never implies completion', () => {
  const journey = { id: 'saved-1', title: 'Baghdad day', status: 'planned' };
  for (const message of ['Tell me about Babylon', 'I visited my journey today', 'Do not mark my trip done', 'Don’t save my trip', 'How do I complete my journey?', 'Maybe save my trip', 'Should I save my trip?', 'لا تحفظ رحلتي']) {
    assert.throws(() => validate([{ type: 'save_trip' }], request(message)));
    assert.throws(() => validate([{ type: 'complete_journey', journeyId: journey.id }], request(message, { journey })));
  }
  assert.equal(validate([{ type: 'save_trip' }], request('Save my trip')).actions.length, 1);
  assert.equal(validate([{ type: 'complete_journey', journeyId: journey.id }], request('Mark my current journey done', { journey })).actions.length, 1);
  assert.throws(() => validate([{ type: 'complete_journey', journeyId: 'not-saved' }], request('Mark my journey done', { journey })));
  assert.throws(() => validate([{ type: 'complete_journey', journeyId: journey.id }], request('Mark my journey done', {})));
  assert.throws(() => validate([{ type: 'add_stop', placeId: 'mutanabbi' }], request('Tell me about Mutanabbi')));
  assert.equal(explicitIntent('احفظ رحلتي', 'save'), true);
});

test('build uses existing planner budget/category/return rules and preserves settings unless named', () => {
  const before = structuredClone(trip);
  const action = { type: 'build_day' };
  validate([action], request('Build my day'));
  const next = applyGuideTripAction(trip, action);
  assert.ok(next.stopIds.length > 0 && next.stopIds.length <= 6);
  assert.ok(estimateTrip(next).total <= next.minutes);
  assert.deepEqual({ ...next, stopIds: [] }, trip);
  assert.deepEqual(trip, before);
  for (const action of [{ type: 'build_day', originId: 'erbil' }, { type: 'build_day', minutes: 480 }, { type: 'build_day', category: 'nature' }, { type: 'build_day', roundTrip: false }]) assert.throws(() => validate([action], request('Build my day')));
  validate([{ type: 'build_day', originId: 'erbil', minutes: 480, category: 'nature', roundTrip: false }], request('Plan 8 hours of nature in Erbil one way'));
  assert.throws(() => validate([{ type: 'build_day', minutes: 720 }], request('Plan 900 hours in Baghdad')));
});

test('add/remove/reorder use the active trip and reject budget, stop and ID violations', () => {
  const pin = { ...trip, origin: { id: 'pin', name: 'Your map pin', coordinates: [44.38884, 33.34095] }, category: 'culture', roundTrip: false };
  const next = applyGuideTripAction(pin, { type: 'add_stop', placeId: 'mutanabbi' });
  assert.deepEqual(next.origin, pin.origin); assert.equal(next.minutes, pin.minutes); assert.equal(next.category, pin.category); assert.equal(next.roundTrip, false);
  assert.throws(() => applyGuideTripAction(next, { type: 'add_stop', placeId: 'mutanabbi' }), /already/);
  assert.throws(() => applyGuideTripAction(trip, { type: 'add_stop', placeId: 'ur' }), /time/);
  assert.throws(() => applyGuideTripAction(initialTrip, { type: 'add_stop', placeId: 'mutanabbi' }), /starting/);
  assert.throws(() => applyGuideTripAction(trip, { type: 'add_stop', placeId: 'unknown' }), /Unknown/);
  assert.throws(() => applyGuideTripAction({ ...trip, stopIds: ['abbasid', 'mustansiriya', 'mutanabbi', 'babylon', 'ur', 'samarra'] }, { type: 'add_stop', placeId: 'hatra' }), /six|6/);
  const stops = { ...trip, stopIds: ['mustansiriya', 'mutanabbi'] };
  assert.deepEqual(applyGuideTripAction(stops, { type: 'reorder_stops', stopIds: ['mutanabbi', 'mustansiriya'] }).stopIds, ['mutanabbi', 'mustansiriya']);
  assert.throws(() => applyGuideTripAction(stops, { type: 'reorder_stops', stopIds: ['mutanabbi'] }), /preserve/);
  assert.deepEqual(applyGuideTripAction(stops, { type: 'remove_stop', placeId: 'mutanabbi' }).stopIds, ['mustansiriya']);
});

test('nearby shares the map origin/selected-destination semantics without changing state', () => {
  const before = structuredClone(trip);
  assert.deepEqual(guideNearby(trip, 'bekhal', { type: 'nearby', reference: 'start' }), guideNearby(trip, null, { type: 'nearby', reference: 'start' }));
  assert.equal(guideNearby(trip, 'gali-ali-beg', { type: 'nearby', reference: 'destination' })[0], 'bekhal');
  assert.equal(nearbyReference(trip, 'bekhal', 'start').id, trip.origin.id);
  assert.throws(() => guideNearby(undefined, null, { type: 'nearby', reference: 'start' }), /starting/);
  assert.deepEqual(trip, before);
});

test('only minimal relevant context is constructed; no notes, dates, revision or saved collection', () => {
  const journey = { id: 'saved-1', title: 'My day', status: 'planned', notes: 'PRIVATE', travelDate: '2026-10-21', revision: 'rev' };
  assert.deepEqual(guideRequestContext('Tell me about Babylon', trip, 'babylon', journey), {});
  assert.deepEqual(guideRequestContext('Recommend a taxi service', trip, null, journey), {});
  assert.deepEqual(guideRequestContext('Mark my trip done', trip, null, journey).journey, { id: journey.id, title: journey.title, status: journey.status });
  assert.equal(guideRequestContext('Mark my trip done', trip, null, journey).trip, undefined);
  assert.deepEqual(guideRequestContext('What services can I use for my phone?', trip, null, journey), {});
  assert.equal(JSON.stringify(guideRequestContext('Save my trip', trip, null, journey)).includes('PRIVATE'), false);
});

test('journey completion follows lifecycle, persists with existing revisions and has no implicit creation', () => {
  const planned = makeJourney({ title: 'Baghdad day', trip, status: 'planned', notes: '', travelDate: '' });
  completionAllowed(planned, { type: 'complete_journey', journeyId: planned.id }, false);
  assert.throws(() => completionAllowed(planned, { type: 'complete_journey', journeyId: planned.id }, true), /Save/);
  for (const journey of [undefined, { ...planned, status: 'idea' }, { ...planned, status: 'done' }]) assert.throws(() => completionAllowed(journey, { type: 'complete_journey', journeyId: planned.id }, false));
  const collection = putJourney(emptyCollection(), planned, null);
  const done = makeJourney({ ...planned, status: 'done' }, planned);
  const changed = putJourney(collection, done, planned.revision);
  assert.equal(changed.journeys.length, 1); assert.equal(changed.journeys[0].status, 'done'); assert.ok(done.completedAt);
  assert.equal(draftFrom(done).baseRevision, done.revision);
  assert.throws(() => putJourney(changed, done, planned.revision), /another tab/);
});

test('stale AI responses are rejected before itinerary mutation', () => {
  assertGuideSnapshot(JSON.stringify(trip), JSON.stringify(trip));
  assert.throws(() => assertGuideSnapshot(JSON.stringify(trip), JSON.stringify({ ...trip, minutes: 360 })), /changed/);
});

test('client configuration, transport errors and untrusted response are explicit, never demo successes', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(fetchGuide(request(), '', signal), /not configured/);
  await assert.rejects(fetchGuide(request(), 'https://user:password@example.com', signal), /invalid/);
  await assert.rejects(fetchGuide(request(), 'http://localhost:5000', signal, async () => new Response('<html>bad</html>')), /unreadable/);
  await assert.rejects(fetchGuide(request(), 'http://localhost:5000', signal, async () => Response.json({ success: false, error: { message: 'Quota exceeded' } }, { status: 429 })), /Quota/);
  await assert.rejects(fetchGuide(request(), 'http://localhost:5000', signal, async () => Response.json({ success: true, data: response([{ type: 'delete_journey' }]) })), /forbidden/);
  let sent;
  const result = await fetchGuide(request(), 'http://localhost:5000/', signal, async (url, options) => { sent = { url, options }; return Response.json({ success: true, data: response([]) }); });
  assert.equal(sent.url, 'http://localhost:5000/api/guide'); assert.equal(sent.options.credentials, 'omit'); assert.equal(result.reply, response([]).reply);
});

test('Arabic history is trimmed by UTF-8 bytes before reaching the API body limit', async () => {
  const signal = new AbortController().signal;
  const req = { ...request('ا'.repeat(1000)), history: Array.from({ length: 6 }, () => ({ role: 'user', text: 'ث'.repeat(1000) })) };
  let bytes;
  await fetchGuide(req, 'http://localhost:5000', signal, async (_url, options) => { bytes = new TextEncoder().encode(options.body).byteLength; return Response.json({ success: true, data: response([]) }); });
  assert.ok(bytes < 16000); assert.equal(req.history.length, 6);
});
