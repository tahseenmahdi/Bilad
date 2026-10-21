import assert from 'node:assert/strict';
import test from 'node:test';
import { createFloorGesture } from '../src/lib/floor-gesture.ts';

test('a forceful wheel event advances exactly one floor', () => {
  const gesture = createFloorGesture();
  assert.equal(gesture.push(12000, 0, 1, 6), 2);
});

test('a long momentum tail cannot skip another floor after the transition finishes', () => {
  const gesture = createFloorGesture();
  assert.equal(gesture.push(400, 0, 1, 6), 2);
  for (let time = 16; time < 1600; time += 16) {
    assert.equal(gesture.push(500 / (time + 1), time, 2, 6), null);
  }
  assert.equal(gesture.push(400, 1900, 2, 6), 3);
});

test('a new gesture can move back one floor after a quiet gap', () => {
  const gesture = createFloorGesture();
  assert.equal(gesture.push(100, 0, 2, 6), 3);
  assert.equal(gesture.push(-100, 600, 3, 6), 2);
});

test('new gestures and reversals do not wait for the previous animation', () => {
  const gesture = createFloorGesture();
  assert.equal(gesture.push(2, 0, 2, 6), 3);
  assert.equal(gesture.push(-2, 16, 3, 6), 2);
  assert.equal(gesture.push(2, 32, 2, 6), 3);
  assert.equal(gesture.push(2, 160, 3, 6), 4);
});

test('tiny trackpad deltas accumulate without moving on jitter and stop at tower boundaries', () => {
  const gesture = createFloorGesture();
  assert.equal(gesture.push(.5, 0, 0, 6), null);
  assert.equal(gesture.push(.5, 16, 0, 6), null);
  assert.equal(gesture.push(1, 32, 0, 6), 1);
  gesture.reset();
  assert.equal(gesture.push(-10000, 1000, 0, 6), null);
  assert.equal(gesture.push(10000, 2000, 6, 6), null);
});

test('a small gesture in either direction is enough after a short pause', () => {
  const gesture = createFloorGesture();
  assert.equal(gesture.push(6, 0, 2, 6), 3);
  assert.equal(gesture.push(-6, 140, 3, 6), 2);
});
