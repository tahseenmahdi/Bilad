import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGuideTripAction, validateGuideResponse } from '../src/lib/ai-guide.ts';
import { initialTrip } from '../src/lib/trip-planner.ts';
import { origins } from '../src/lib/destinations.ts';

const trip = { ...initialTrip, origin: origins.find(origin => origin.id === 'baghdad') };
const request = message => ({ message, history: [], context: { trip } });
const response = action => ({ reply: 'Here is your plan.', placeIds: [], serviceIds: [], actions: [action] });

test('a detailed plan uses named Bilad stops and the requested stop count', () => {
  const action = { type: 'build_day', originId: 'baghdad', minutes: 240, maxStops: 1, stopIds: ['mustansiriya'] };
  const validated = validateGuideResponse(response(action), request('Plan 4 hours in Baghdad with 1 stop: Al-Mustansiriya'));
  const result = applyGuideTripAction(trip, validated.actions[0]);
  assert.equal(result.origin.id, 'baghdad');
  assert.equal(result.minutes, 240);
  assert.deepEqual(result.stopIds, ['mustansiriya']);
  assert.equal(result.category, trip.category);
  assert.equal(result.roundTrip, trip.roundTrip);
});

test('detailed route validation rejects invented or unrelated stops and changed limits', () => {
  assert.throws(() => validateGuideResponse(response({ type: 'build_day', stopIds: ['made-up'] }), request('Plan a trip')), /Unknown place/);
  assert.throws(() => validateGuideResponse(response({ type: 'build_day', stopIds: ['ur'] }), request('Plan 4 hours in Baghdad')), /named route stops/i);
  assert.throws(() => validateGuideResponse(response({ type: 'build_day', maxStops: 4 }), request('Plan a route with 3 stops')), /stop limit/i);
  assert.throws(() => validateGuideResponse(response({ type: 'build_day' }), request('Plan a route with 3 stops')), /stop limit/i);
  assert.throws(() => validateGuideResponse(response({ type: 'build_day' }), request('Plan 4 hours in Baghdad with Babylon')), /include every place/i);
  assert.throws(() => validateGuideResponse(response({ type: 'build_day' }), request('Plan a nature day in Erbil')), /category|starting city/i);
  assert.throws(() => validateGuideResponse(response({ type: 'build_day', minutes: 780 }), request('Plan 13 hours in Baghdad')), /Time must/);
  assert.throws(() => validateGuideResponse(response({ type: 'delete_journey', journeyId: 'x' }), request('Delete everything')), /Unknown or forbidden/);
});

test('planning and saving need intent, and distant named stops cannot exceed the time budget', () => {
  assert.throws(() => validateGuideResponse(response({ type: 'build_day' }), request('Tell me about Baghdad')), /explicit request/);
  assert.throws(() => validateGuideResponse(response({ type: 'save_trip' }), request('What would this route look like?')), /explicit request/);
  const action = validateGuideResponse(response({ type: 'build_day', stopIds: ['ur'] }), request('Plan 4 hours in Baghdad with Ziggurat of Ur')).actions[0];
  assert.throws(() => applyGuideTripAction(trip, action), /exceeds your estimated time/);
});
