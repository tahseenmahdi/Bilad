import test from 'node:test';
import assert from 'node:assert/strict';
import { answerTouristQuestion } from '../src/lib/tourist-guide.ts';

test('general guide answers place questions without creating trip state', () => {
  const reply = answerTouristQuestion('Tell me about Babylon');
  assert.match(reply.message, /Babylon/);
  assert.deepEqual(reply.recommendations, ['babylon']);
  assert.equal('trip' in reply, false);
});

test('general guide covers tourism topics and routes planning to the map', () => {
  assert.match(answerTouristQuestion('Tell me about Iraqi culture').message, /living culture/i);
  assert.match(answerTouristQuestion('Help me plan a day trip').message, /map planner/i);
  assert.match(answerTouristQuestion('What Arabic phrases should I know?').message, /Iraqi Arabic/i);
});
