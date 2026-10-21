import test from 'node:test';
import assert from 'node:assert/strict';
import { places } from '../src/lib/destinations.ts';
import { destinationVisits, getDestinationVisit, visitReviewDue } from '../src/lib/destination-visits.ts';

test('every destination has one maintained visit-information record', () => {
  assert.deepEqual(Object.keys(destinationVisits).sort(), places.map(place => place.id).sort());
  assert.equal(getDestinationVisit('not-a-destination'), undefined);
});

test('reported hours require a source; every record has dated checks and access notes', () => {
  for (const [id, info] of Object.entries(destinationVisits)) {
    assert.ok(info.hours.text, id);
    assert.ok(info.notes.length > 0, id);
    assert.match(info.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(info.checkedAt)), id);
    assert.ok(info.reviewAfterDays > 0, id);
    if (info.hours.status === 'reported') assert.ok(info.hours.source, id);
    for (const source of [info.hours.source, ...info.notes.map(note => note.source)].filter(Boolean)) {
      assert.equal(new URL(source.url).protocol, 'https:', id);
      assert.ok(['official','editorial','reporting'].includes(source.type), id);
      if (source.publishedAt) assert.ok(Date.parse(source.publishedAt) <= Date.parse(info.checkedAt), id);
    }
  }
});

test('review deadline uses Baghdad midnight, including exact expiry boundary', () => {
  const info = destinationVisits.abbasid;
  assert.equal(visitReviewDue(info, new Date('2026-11-18T20:59:59Z')), false);
  assert.equal(visitReviewDue(info, new Date('2026-11-18T21:00:00Z')), true);
});

test('uncertain schedules are not silently converted into opening times', () => {
  assert.equal(destinationVisits['erbil-citadel'].hours.status, 'unconfirmed');
  assert.equal(destinationVisits.korek.hours.status, 'variable');
  assert.equal(destinationVisits['al-nuri'].hours.source?.type, 'reporting');
  assert.match(destinationVisits['al-nuri'].hours.text, /2025/);
});
