import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoadRoute,fetchRoadRoute} from '../src/lib/road-route.ts';
const fixture=()=>({code:'Ok',waypoints:[{distance:0},{distance:20}],routes:[{duration:600,distance:5000,geometry:{type:'LineString',coordinates:[[44.3,33.3],[44.4,33.4]]},legs:[{duration:600,distance:5000,steps:[{maneuver:{instruction:'Turn right'}}]}]}]});
test('road response preserves real geometry, durations and instructions',()=>{
  const route=parseRoadRoute(fixture(),2);
  assert.equal(route.minutes,10);assert.equal(route.km,5);assert.deepEqual(route.legs[0].instructions,['Turn right']);
});
test('no route, invalid geometry, incomplete legs and distant snaps cannot appear as road directions',()=>{
  assert.throws(()=>parseRoadRoute({code:'NoRoute'},2));
  const far=fixture();far.waypoints[1].distance=2000;assert.throws(()=>parseRoadRoute(far,2));
  const broken=fixture();broken.routes[0].geometry.coordinates[0]=[NaN,33];assert.throws(()=>parseRoadRoute(broken,2));
  assert.throws(()=>parseRoadRoute(fixture(),3));
});
test('directions request uses longitude first, requests steps, and respects caller cancellation',async()=>{
  const controller=new AbortController();
  const route=await fetchRoadRoute([[44.3,33.3],[44.4,33.4]],'test-public-token',controller.signal,async(url,options)=>{
    assert.ok(url.includes('/driving/44.3,33.3;44.4,33.4?'));
    assert.equal(new URL(url).searchParams.get('steps'),'true');assert.equal(options.credentials,'omit');
    return {ok:true,json:async()=>fixture()};
  });
  assert.equal(route.minutes,10);
  controller.abort();
  await assert.rejects(fetchRoadRoute([[44,33],[45,34]],'test',controller.signal,async()=>{throw Error('Should not fetch');}),{name:'AbortError'});
});
test('HTTP failures remain failures instead of invented successful routes',async()=>{
  await assert.rejects(fetchRoadRoute([[44,33],[45,34]],'test',new AbortController().signal,async()=>({ok:false,status:429})),/unavailable/);
});
