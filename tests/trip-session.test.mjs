import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreTrip } from '../src/lib/trip-session.ts';

const sample = {origin:{id:'pin',name:'Your map pin',coordinates:[44.3,33.3]},minutes:240,category:'nature',stopIds:['korek','dukan'],roundTrip:true};
test('a trip survives the trip-to-services round trip',()=>{
  assert.deepEqual(restoreTrip(JSON.stringify(sample)),sample);
});
test('corrupt or invalid coordinates never reach the restored map',()=>{
  for(const raw of [null,'bad JSON','null','{}',JSON.stringify({...sample,origin:{...sample.origin,coordinates:[999,33]}}),JSON.stringify({...sample,origin:{...sample.origin,coordinates:['44',33]}})]) assert.equal(restoreTrip(raw),null);
});
test('old destination IDs and duplicates are removed and settings are bounded',()=>{
  const restored=restoreTrip(JSON.stringify({...sample,stopIds:['korek','missing','korek','dukan'],minutes:-10,category:'invalid'}));
  assert.deepEqual(restored.stopIds,['korek','dukan']);
  assert.equal(restored.minutes,240);
  assert.equal(restored.category,'all');
});
