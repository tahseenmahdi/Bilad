import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {places,origins} from '../src/lib/destinations.ts';
import {initialTrip,buildDay,estimateTrip,distanceKm,nearestPlaces,nearbyReference,orderStops,applyMilaiCommand,tripCoordinates} from '../src/lib/trip-planner.ts';
const baghdad=origins.find(o=>o.id==='baghdad');
const trip={...initialTrip,origin:baghdad};
test('catalogue has unique sourced places, valid Iraq coordinates and visit allowances',()=>{
  assert.equal(places.length,24);
  assert.equal(new Set(places.map(p=>p.id)).size,places.length);
  for(const p of places){assert.ok(p.source.startsWith('https://'));assert.ok(p.coordinateSource.startsWith('https://'));assert.ok(p.image?.startsWith('/assets/'));assert.ok(existsSync(new URL(`../public${p.image}`,import.meta.url)));assert.ok(p.visitMinutes>0);assert.ok(p.coordinates[0]>38&&p.coordinates[0]<49);assert.ok(p.coordinates[1]>29&&p.coordinates[1]<38);}
});
test('build waits for chosen start and fits visits, driving, buffer and return within budget',()=>{
  assert.deepEqual(buildDay(initialTrip),[]);
  for(const origin of origins) for(const minutes of [60,120,240,480,720]) for(const category of ['all','history','nature','culture']) {
    const candidate={...trip,origin,minutes,category};
    const ids=buildDay(candidate);
    assert.ok(ids.length<=6);assert.equal(new Set(ids).size,ids.length);
    assert.ok(estimateTrip({...candidate,stopIds:ids}).total<=minutes);
    if(category!=='all') assert.ok(ids.every(id=>places.find(p=>p.id===id).category===category));
  }
});
test('nearby follows selected attraction, excludes itself and sorts geodesic distance',()=>{
  const p=places.find(p=>p.id==='gali-ali-beg');
  const nearby=nearestPlaces(p.coordinates,'nature',[p.id]);
  assert.equal(nearby[0].place.id,'bekhal');
  assert.ok(nearby.every((p,i)=>i===0||p.distance>=nearby[i-1].distance));
  assert.equal(distanceKm(p.coordinates,p.coordinates),0);
});
test('round trip contains a return leg and one-way omits it',()=>{
  const sample={...trip,stopIds:['babylon']};
  assert.equal(tripCoordinates(sample).length,3);
  assert.equal(tripCoordinates({...sample,roundTrip:false}).length,2);
  assert.ok(estimateTrip(sample).total>estimateTrip({...sample,roundTrip:false}).total);
});
test('mock guide changes origin/time and builds a matching itinerary',()=>{
  const reply=applyMilaiCommand('Plan 4 hours in Baghdad',initialTrip);
  assert.equal(reply.trip.origin.id,'baghdad');assert.equal(reply.trip.minutes,240);
  assert.ok(reply.trip.stopIds.length>0);assert.equal(reply.changed,true);
  assert.ok(estimateTrip(reply.trip).total<=240);
});
test('named add, duplicate prevention, remove and clear operate on the same plan',()=>{
  const added=applyMilaiCommand('Add Babylon',trip);
  assert.deepEqual(added.trip.stopIds,['babylon']);
  assert.deepEqual(applyMilaiCommand('Add Babylon',added.trip).trip.stopIds,['babylon']);
  assert.deepEqual(applyMilaiCommand('Remove Babylon',added.trip).trip.stopIds,[]);
  assert.deepEqual(applyMilaiCommand('Clear my plan',added.trip).trip.stopIds,[]);
});
test('word matching does not confuse Ur with your, nature or culture',()=>{
  assert.ok(!applyMilaiCommand('tell me about your culture',trip).recommendations.includes('ur'));
  assert.deepEqual(applyMilaiCommand('Add Ur',trip).trip.stopIds,['ur']);
});
test('nearby is informational, unsupported requests do not mutate, invalid duration rejected',()=>{
  const current={...trip,stopIds:['abbasid']};
  const reply=applyMilaiCommand('Show nearby places',current);
  assert.deepEqual(reply.trip,current);assert.ok(reply.recommendations.length>0);
  assert.deepEqual(applyMilaiCommand('book a hotel for me',current).trip,current);
  assert.deepEqual(applyMilaiCommand('plan 900 hours in Erbil',current).trip,current);
});
test('nature plans stay in category and no fitting place produces honest empty plan',()=>{
  const result=applyMilaiCommand('Plan 8 hours of nature in Erbil',initialTrip);
  assert.equal(result.trip.category,'nature');assert.ok(result.trip.stopIds.length>0);
  assert.ok(result.trip.stopIds.every(id=>places.find(p=>p.id===id).category==='nature'));
  const nofit=applyMilaiCommand('Plan 1 hour of nature in Baghdad',initialTrip);
  assert.deepEqual(nofit.trip.stopIds,[]);assert.match(nofit.message,/No nature places/);
});
test('reorder keeps all stops without mutating original and start changes recalculate distance',()=>{
  const input={...trip,stopIds:['babylon','mustansiriya','abbasid']};
  const ids=orderStops(input);
  assert.equal(ids[0],'mustansiriya');assert.deepEqual(new Set(ids),new Set(input.stopIds));
  assert.equal(input.stopIds[0],'babylon');
  assert.notEqual(estimateTrip(input).total,estimateTrip({...input,origin:origins[1]}).total);
});
test('shorter and longer requests change the budget within supported bounds',()=>{
  assert.equal(applyMilaiCommand('Make it shorter',trip).trip.minutes,180);
  assert.equal(applyMilaiCommand('Give me more time',trip).trip.minutes,300);
  assert.equal(applyMilaiCommand('Make it shorter',{...trip,minutes:60}).trip.minutes,60);
});
test('nearby defaults to the starting point even with a selected destination and planned stops',()=>{
  const current={...trip,stopIds:['ur','babylon']};
  const reference=nearbyReference(current,'gali-ali-beg');
  assert.equal(reference.kind,'start');assert.equal(reference.name,'Baghdad');
  assert.deepEqual(reference.coordinates,baghdad.coordinates);
  assert.equal(nearestPlaces(reference.coordinates)[0].place.id,'mustansiriya');
});
test('destination nearby mode uses selected place or last trip stop without changing the origin',()=>{
  const current={...trip,stopIds:['babylon']};
  const reference=nearbyReference(current,'gali-ali-beg','destination');
  assert.equal(reference.kind,'destination');assert.equal(reference.id,'gali-ali-beg');
  assert.equal(nearestPlaces(reference.coordinates,'nature',[reference.id])[0].place.id,'bekhal');
  assert.equal(nearbyReference(current,null,'destination').id,'babylon');
  assert.equal(current.origin.id,'baghdad');
});
test('nearby has no invented current position and respects a custom starting pin',()=>{
  assert.equal(nearbyReference(initialTrip,'babylon'),null);
  assert.equal(nearbyReference(initialTrip,null,'destination'),null);
  const origin={id:'pin',name:'Your map pin',coordinates:[44.00917,36.19111]};
  const reference=nearbyReference({...trip,origin},'babylon');
  assert.deepEqual(reference.coordinates,origin.coordinates);
  assert.equal(nearestPlaces(reference.coordinates)[0].place.id,'erbil-citadel');
});
test('mock nearby requests default to the start and support an explicit destination',()=>{
  const current={...trip,stopIds:['babylon']};
  const nearStart=applyMilaiCommand('Show nearby places',current);
  assert.match(nearStart.message,/to Baghdad/);
  assert.equal(nearStart.recommendations[0],'mustansiriya');
  const nearDestination=applyMilaiCommand('Show nearby places near my destination',current);
  assert.match(nearDestination.message,/to Babylon/);
  assert.ok(!nearDestination.recommendations.includes('babylon'));
  assert.deepEqual(nearStart.trip,current);assert.deepEqual(nearDestination.trip,current);
});
