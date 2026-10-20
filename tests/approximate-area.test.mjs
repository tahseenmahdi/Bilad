import assert from 'node:assert/strict';
import test from 'node:test';
import { createApproximateAreaLookup, parseApproximateArea } from '../src/lib/approximate-area.ts';

const sample = { success: true, latitude: 33.3, longitude: 44.4, city: 'Baghdad', region: 'Baghdad', country: 'Iraq' };

test('uses a broad city view and labels the IP estimate', () => {
  assert.deepEqual(parseApproximateArea(sample), { latitude: 33.3, longitude: 44.4, label: 'Baghdad, Iraq', zoom: 8 });
  assert.equal(parseApproximateArea({ ...sample, city: '', region: '' }).zoom, 4.5);
});

test('rejects failed lookups and invalid coordinates instead of showing a false position', () => {
  for (const input of [null, {}, { ...sample, success: false }, { ...sample, latitude: null },
    { ...sample, longitude: '44.4' }, { ...sample, latitude: NaN }, { ...sample, latitude: 91 }, { ...sample, longitude: 181 }]) {
    assert.throws(() => parseApproximateArea(input));
  }
  assert.equal(parseApproximateArea({ ...sample, latitude: 0, longitude: 0 }).latitude, 0);
});

test('looks up the visitor directly and caches only the requested area fields in memory', async () => {
  let calls = 0;
  const lookup = createApproximateAreaLookup(async (url, options) => {
    calls++;
    assert.equal(new URL(url).hostname, 'ipwho.is');
    assert.equal(new URL(url).pathname, '/'); // No server-IP or stored visitor-IP lookup.
    assert.equal(new URL(url).searchParams.get('fields'), 'success,latitude,longitude,city,region,country');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return { ok: true, json: async () => ({ ...sample, ip: 'discarded', connection: 'discarded' }) };
  });
  const first = await lookup(new AbortController().signal);
  const second = await lookup(new AbortController().signal);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ['label', 'latitude', 'longitude', 'zoom']);
});

test('does not cache rate-limit errors', async () => {
  let calls = 0;
  const lookup = createApproximateAreaLookup(async () => ++calls === 1
    ? { ok: false, status: 429 }
    : { ok: true, json: async () => sample });
  await assert.rejects(lookup(new AbortController().signal));
  assert.equal((await lookup(new AbortController().signal)).label, 'Baghdad, Iraq');
  assert.equal(calls, 2);
});

test('cancels the network lookup when the map closes', async () => {
  let cancelled = false;
  const lookup = createApproximateAreaLookup((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { cancelled = true; reject(new DOMException('Cancelled', 'AbortError')); });
  }));
  const controller = new AbortController();
  const result = lookup(controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(cancelled, true);
});

test('ends a slow IP lookup after eight seconds', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const lookup = createApproximateAreaLookup((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')));
  }));
  const rejected = assert.rejects(lookup(new AbortController().signal), { name: 'AbortError' });
  context.mock.timers.tick(8000);
  await rejected;
});
