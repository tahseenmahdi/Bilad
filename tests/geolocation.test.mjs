import assert from 'node:assert/strict';
import test from 'node:test';
import { requestBrowserPosition, createResilientGeolocation } from '../src/lib/geolocation.ts';

const position = { coords: { latitude: 0, longitude: 0, accuracy: 500 }, timestamp: 1 };
const failure = code => ({ code, message: `Provider error ${code}` });

test('uses an ordinary location fix first and returns its real accuracy', async () => {
  const provider = { getCurrentPosition(success, _error, options) {
    assert.equal(options.enableHighAccuracy, false);
    assert.equal(options.maximumAge, 300000);
    success(position);
  } };
  assert.equal(await requestBrowserPosition(provider, new AbortController().signal), position);
});

test('retries an unavailable fix with high accuracy', async () => {
  const calls = [];
  const provider = { getCurrentPosition(success, error, options) {
    calls.push(options.enableHighAccuracy);
    if (calls.length === 1) error(failure(2)); else success(position);
  } };
  assert.equal(await requestBrowserPosition(provider, new AbortController().signal), position);
  assert.deepEqual(calls, [false, true]);
});

test('does not retry denied permission', async () => {
  let calls = 0;
  const provider = { getCurrentPosition(_success, error) { calls++; error(failure(1)); } };
  await assert.rejects(requestBrowserPosition(provider, new AbortController().signal), { code: 1 });
  assert.equal(calls, 1);
});

test('caps a silent provider, retries, and ignores its late result', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const callbacks = [];
  const provider = { getCurrentPosition(success) { callbacks.push(success); } };
  const result = requestBrowserPosition(provider, new AbortController().signal);
  context.mock.timers.tick(12000);
  await Promise.resolve();
  assert.equal(callbacks.length, 2);
  callbacks[0](position); // Expired first attempt must not satisfy the request.
  const rejected = assert.rejects(result, { code: 3 });
  context.mock.timers.tick(20000);
  await rejected;
});

test('cancels pending requests without a retry when the map closes', async () => {
  const controller = new AbortController();
  let calls = 0;
  const result = requestBrowserPosition({ getCurrentPosition() { calls++; } }, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('the Mapbox adapter cancels callbacks on disposal', async () => {
  let finish;
  let delivered = false;
  const adapter = createResilientGeolocation({
    getCurrentPosition(success) { finish = success; },
    watchPosition() { return 1; },
    clearWatch() {},
  });
  adapter.provider.getCurrentPosition(() => { delivered = true; }, () => { delivered = true; });
  adapter.dispose();
  finish(position);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(delivered, false);
});
