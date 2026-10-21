import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEYS_KEY, draftFrom, duplicateJourney, emptyCollection, fingerprint, makeJourney, migrateItinerary, newDraft, putJourney, readCollection, readDraft, removeJourney, validateIntent, validTravelDate, writeCollection } from '../src/lib/journeys.ts';
import { addJourneyStops } from '../src/lib/explore.ts';
import { restoreTrip } from '../src/lib/trip-session.ts';
import { orderStops } from '../src/lib/trip-planner.ts';

const fields = () => ({ ...newDraft(), title: 'A day in Baghdad', trip: { origin: { id:'baghdad',name:'Baghdad',coordinates:[44.3661,33.3152] }, minutes:480,category:'history',roundTrip:false,stopIds:['mustansiriya','abbasid'] }, notes:'Stop for tea.', travelDate:'2026-11-10' });
function memory(raw = null) { let value = raw; return { getItem: key => { assert.equal(key,JOURNEYS_KEY); return value; }, setItem: (key, next) => { assert.equal(key,JOURNEYS_KEY); value=next; }, value:()=>value }; }

test('saved intent survives a device-storage round trip without cached road results or draft internals',()=>{
  const journey=makeJourney(fields());
  const storage=memory();
  writeCollection(storage,data=>putJourney(data,journey,null));
  assert.deepEqual(readCollection(storage.value()).journeys,[journey]);
  assert.equal(journey.scope,'day');
  assert.equal(journey.baseline,undefined);
  assert.equal(journey.journeyId,undefined);
  assert.equal(journey.route,undefined);
  assert.equal(journey.completedAt,null);
  assert.equal(journey.trip.roundTrip,false);
  assert.notEqual(journey.id,journey.revision);
});
test('all status transitions preserve ordered stops and settings; completion has a date and Undo restores the record',()=>{
  let journey=makeJourney(fields(),undefined,'2026-10-21T12:00:00.000Z');
  const original=structuredClone(journey);
  let data=putJourney(emptyCollection(),journey,null);
  for(const status of ['planned','idea','planned','done','planned','done']) {
    const next=makeJourney({...journey,status},journey,'2026-10-22T12:00:00.000Z');
    data=putJourney(data,next,journey.revision);
    assert.deepEqual(next.trip,original.trip);
    assert.equal(next.createdAt,original.createdAt);
    assert.equal(next.id,original.id);
    assert.equal(next.completedAt,status==='done'?'2026-10-22T12:00:00.000Z':null);
    journey=next;
  }
  const undone={...original,revision:crypto.randomUUID()};
  data=putJourney(data,undone,journey.revision);
  assert.equal(data.journeys[0].status,'idea');
  assert.equal(data.journeys[0].completedAt,null);
});
test('duplicating a completed journey creates a fresh idea and never mutates its original',()=>{
  const original=makeJourney({...fields(),status:'done'});
  const snapshot=structuredClone(original);
  const copy=duplicateJourney(original);
  assert.deepEqual(original,snapshot);
  assert.notEqual(copy.id,original.id);
  assert.equal(copy.status,'idea');
  assert.equal(copy.completedAt,null);
  assert.equal(copy.travelDate,'');
  assert.deepEqual(copy.trip,original.trip);
  copy.trip.stopIds.pop();
  assert.deepEqual(original,snapshot);
});
test('legacy migration preserves the current itinerary, existing collection, and retries idempotently',()=>{
  const legacy=fields().trip;
  const other=makeJourney({...fields(),title:'Already saved'});
  const initial=putJourney(emptyCollection(),other,null);
  const migrated=migrateItinerary(initial,legacy);
  assert.equal(migrated.collection.journeys.length,2);
  assert.deepEqual(migrated.journey.trip,legacy);
  assert.equal(migrated.journey.status,'idea');
  assert.deepEqual(migrateItinerary(migrated.collection,legacy),migrated);
  assert.deepEqual(initial.journeys,[other]);
  assert.equal(migrateItinerary(initial,{...legacy,origin:{...legacy.origin,id:'device'}}).journey.trip.origin,null);
});
test('draft hydration is independent of property order, retains blank titles and preserves unsaved notes',()=>{
  const clean=draftFrom(makeJourney(fields()));
  const restored=readDraft(JSON.stringify({version:1,draft:clean}));
  assert.equal(fingerprint(restored),clean.baseline);
  assert.equal(fingerprint({...clean,trip:restoreTrip(JSON.stringify(clean.trip))}),clean.baseline);
  const edits={...clean,title:'',notes:'Unsaved note'};
  assert.deepEqual(readDraft(JSON.stringify({version:1,draft:edits})),edits);
  assert.notEqual(fingerprint(edits),edits.baseline);
  assert.equal(readDraft('{bad'),null);
  assert.equal(readDraft(JSON.stringify({version:999,draft:clean})),null);
});
test('missing editorial destination IDs are kept and removable, and capacity is still enforced',()=>{
  const saved=makeJourney({...fields(),trip:{...fields().trip,stopIds:['removed-place','mustansiriya']}});
  assert.deepEqual(readCollection(JSON.stringify({version:1,journeys:[saved]})).journeys[0].trip.stopIds,['removed-place','mustansiriya']);
  const addition=addJourneyStops(saved.trip,['abbasid','mustansiriya','mutanabbi','babylon','ur','hatra','not-real']);
  assert.equal(addition.trip.stopIds.length,6);
  assert.equal(addition.added,4);
  assert.equal(addition.skipped,1);
  assert.equal(addition.trip.origin,saved.trip.origin);
  assert.equal(addition.trip.minutes,480);
  assert.equal(addition.trip.roundTrip,false);
  assert.equal(new Set(addition.trip.stopIds).size,6);
  assert.deepEqual(new Set(orderStops(saved.trip)),new Set(saved.trip.stopIds),'reordering must retain unavailable references until explicitly removed');
});
test('corrupt and future storage is never overwritten, including on migration',()=>{
  for(const raw of ['{bad','null','{}',JSON.stringify({version:9,journeys:[]}),JSON.stringify({version:1,journeys:[{id:'bad'}]})]) {
    const storage=memory(raw);
    assert.throws(()=>writeCollection(storage,data=>migrateItinerary(data,fields().trip).collection));
    assert.equal(storage.value(),raw);
  }
});
test('disabled storage and quota failures leave the draft and last saved collection intact',()=>{
  const original=makeJourney(fields());
  const raw=JSON.stringify({version:1,journeys:[original]});
  const draft={...draftFrom(original),notes:'These edits must stay'};
  const snapshot=structuredClone(draft);
  const storage={getItem:()=>raw,setItem:()=>{throw new DOMException('Full','QuotaExceededError');}};
  assert.throws(()=>writeCollection(storage,data=>putJourney(data,makeJourney(draft,original),original.revision)),{name:'QuotaExceededError'});
  assert.deepEqual(draft,snapshot);
  assert.throws(()=>writeCollection({getItem:()=>{throw new DOMException('Blocked','SecurityError');},setItem:()=>assert.fail()},x=>x),{name:'SecurityError'});
});
test('multiple-tab writes merge unrelated trips and reject conflicting edits, deletes and stale Undo',()=>{
  const a=makeJourney(fields()), b=makeJourney({...fields(),title:'Another day'});
  const storage=memory();
  writeCollection(storage,data=>putJourney(data,a,null));
  writeCollection(storage,data=>putJourney(data,b,null));
  assert.equal(readCollection(storage.value()).journeys.length,2);
  const changed=makeJourney({...a,title:'Changed elsewhere'},a);
  writeCollection(storage,data=>putJourney(data,changed,a.revision));
  const lastGood=storage.value();
  assert.throws(()=>writeCollection(storage,data=>putJourney(data,makeJourney({...a,title:'Stale edit'},a),a.revision)),/another tab/);
  assert.throws(()=>writeCollection(storage,data=>removeJourney(data,a)),/another tab/);
  assert.equal(storage.value(),lastGood);
  const removed=writeCollection(storage,data=>removeJourney(data,changed));
  assert.equal(removed.journeys.length,1);
  assert.throws(()=>writeCollection(storage,data=>putJourney(data,makeJourney(a,a),a.revision)),/another tab/);
  writeCollection(storage,data=>putJourney(data,changed,null)); // delete Undo
  assert.equal(readCollection(storage.value()).journeys.length,2);
});
test('invalid dates, coordinates and unsupported stop counts cannot enter saved records',()=>{
  for(const date of ['bad','2026-02-30','2026-99-99'])assert.equal(validTravelDate(date),false);
  assert.equal(validTravelDate('2026-10-21'),true);
  assert.equal(validateIntent({...fields().trip,origin:{...fields().trip.origin,coordinates:[999,33]}}),null);
  assert.equal(validateIntent({...fields().trip,stopIds:Array.from({length:7},(_,i)=>`stop-${i}`)}),null);
  assert.throws(()=>makeJourney({...fields(),title:''}));
});
