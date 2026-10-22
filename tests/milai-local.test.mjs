import test from 'node:test';
import assert from 'node:assert/strict';
import { origins } from '../src/lib/destinations.ts';
import { initialTrip } from '../src/lib/trip-planner.ts';
import { answerMilaiLocally } from '../src/lib/milai-local.ts';

const baghdadTrip = { ...initialTrip, origin: origins.find(origin => origin.id === 'baghdad') };

test('local guide answers curated place questions without changing the trip', () => {
  const result = answerMilaiLocally('Tell me about Babylon', baghdadTrip);
  assert.match(result.response.reply, /Babylon/);
  assert.deepEqual(result.response.placeIds, ['babylon']);
  assert.equal(result.changed, false);
  assert.deepEqual(result.trip, baghdadTrip);
  assert.equal(result.openMap, null);
});

test('local planning commands update the trip and request the map view', () => {
  const result = answerMilaiLocally('Plan 4 hours in Baghdad', initialTrip);
  assert.equal(result.trip.origin.id, 'baghdad');
  assert.equal(result.trip.minutes, 240);
  assert.ok(result.trip.stopIds.length > 0);
  assert.equal(result.changed, true);
  assert.equal(result.openMap, 'trip');
});

test('local nearby commands return curated places and choose a nearby map view', () => {
  const result = answerMilaiLocally('Show nearby places', baghdadTrip);
  assert.ok(result.response.placeIds.length > 0);
  assert.equal(result.changed, false);
  assert.equal(result.openMap, 'nearby');
});

test('ordinary cultural recommendations stay informational rather than changing an itinerary', () => {
  const result = answerMilaiLocally('Recommend historic places', baghdadTrip);
  assert.match(result.response.reply, /long history and heritage/i);
  assert.ok(result.response.placeIds.length > 0);
  assert.equal(result.changed, false);
  assert.deepEqual(result.trip, baghdadTrip);
});
