import test from 'node:test';
import assert from 'node:assert/strict';
import {places} from '../src/lib/destinations.ts';
import {initialTrip} from '../src/lib/trip-planner.ts';
import {restoreTrip} from '../src/lib/trip-session.ts';
import {addJourneyStops,matchesSearch,matchesFilter,governorate,placePeriods,trails} from '../src/lib/explore.ts';
test('atlas search finds Arabic variants, aliases and governorates',()=>{
  assert.ok(matchesSearch(places.find(p=>p.id==='erbil-citadel'),'اربيل'));
  assert.ok(matchesSearch(places.find(p=>p.id==='samarra'),'صلاح الدين'));
  assert.ok(matchesSearch(places.find(p=>p.id==='ctesiphon'),'Ctesiphon'));
  assert.equal(governorate(places.find(p=>p.id==='gali-ali-beg')),'Erbil');
});
test('journey additions preserve settings and survive Milai restoration',()=>{
  const trip={...initialTrip,minutes:360,roundTrip:false,stopIds:['babylon']};
  const result=addJourneyStops(trip,['babylon','ur','ur','not-a-place']);
  assert.deepEqual(result.trip.stopIds,['babylon','ur']);assert.equal(result.added,1);
  assert.equal(result.trip.minutes,360);assert.equal(result.trip.roundTrip,false);
  assert.deepEqual(restoreTrip(JSON.stringify(result.trip)),result.trip);
  assert.deepEqual(trip.stopIds,['babylon']);
});
test('trail additions report capacity and never exceed the shared planner limit',()=>{
  const result=addJourneyStops({...initialTrip,stopIds:places.slice(0,5).map(p=>p.id)},trails[0].stops);
  assert.equal(result.trip.stopIds.length,6);assert.equal(result.added,1);assert.equal(result.skipped,3);
  for(const trail of trails)for(const id of trail.stops)assert.ok(places.find(p=>p.id===id));
});
test('periods allow multiple associations without dating natural destinations',()=>{
  assert.deepEqual(placePeriods['erbil-citadel'],['Ancient','Ottoman']);
  for(const p of places.filter(p=>p.category==='nature'))assert.equal(placePeriods[p.id],undefined);
  assert.ok(matchesFilter(places.find(p=>p.id==='lalish'),'Religious heritage'));
  assert.ok(matchesFilter(places.find(p=>p.id==='mutanabbi'),'Food'));
});
