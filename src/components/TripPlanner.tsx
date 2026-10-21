'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { origins, type Category, type Coordinates, type Place } from '@/lib/destinations';
import { buildDay, estimateTrip, formatDistance, formatTime, getPlace, MAX_STOPS, nearbyReference, nearestPlaces, orderStops, tripCoordinates, tripPlaces, type NearbyMode, type Trip } from '@/lib/trip-planner';
import type { GuideView } from './useMilaiGuide';
import { fetchRoadRoute, type RoadRoute } from '@/lib/road-route';
import JourneyBar from './JourneyBar';
import PlannerReveal, { type PlannerTool } from './PlannerReveal';
import TravelShortcuts from './TravelShortcuts';
import PlaceArt from './PlaceArt';
import ItineraryTimeline from './ItineraryTimeline';
import DestinationVisitInfo from './DestinationVisitInfo';

const PlannerMap=dynamic(()=>import('./PlannerMap'),{ssr:false,loading:()=> <div className="planner-map planner-map-loading">Unfolding Iraq…</div>});
const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
type Props={trip:Trip;onChange:(trip:Trip)=>void;milai:ReactNode;guideView?:GuideView;onGuideViewHandled?:()=>void;focused:string|null;onFocus:(id:string|null)=>void;atlas?:boolean;mapPicking?:boolean;onMapPicking?:(picking:boolean)=>void;onRouteChange?:(route:RoadRoute|null)=>void};
const categories: {id:Category|'all';name:string}[]=[{id:'all',name:'All places'},{id:'history',name:'History'},{id:'nature',name:'Nature'},{id:'culture',name:'Culture'}];


export default function TripPlanner({trip,onChange,milai,guideView,onGuideViewHandled,focused,onFocus,atlas=false,mapPicking=false,onMapPicking,onRouteChange}:Props) {
  const [localPicking,setLocalPicking]=useState(false);
  const picking=atlas?mapPicking:localPicking;
  const setPicking=(next:boolean)=>{if(atlas)onMapPicking?.(next);else setLocalPicking(next);};
  const [locationState,setLocationState]=useState<'idle'|'locating'|'located'|'denied'|'unavailable'>('idle');
  const [search,setSearch]=useState('');
  const [message,setMessage]=useState('');
  const [nearbyMode,setNearbyMode]=useState<NearbyMode>('start');
  const [activeTool,setActiveTool]=useState<PlannerTool|null>(()=>trip.stopIds.length?'trip':atlas?'setup':trip.origin?null:'setup');
  const [routeState,setRouteState]=useState<{key:string;status:'loading'|'road'|'preview';route:RoadRoute|null}>({key:'',status:'preview',route:null});
  const [routeRetry,setRouteRetry]=useState(0);
  const autoFit=useRef(false);
  const latest=useRef({trip,onChange});latest.current={trip,onChange};
  const pointKey=JSON.stringify(tripCoordinates(trip));
  const stops=tripPlaces(trip);
  const estimate=estimateTrip(trip);
  const road=routeState.key===pointKey?routeState.route:null;
  const routeStatus=routeState.key!==pointKey?'loading':routeState.status;
  const total=(road?.minutes??estimate.travel)+estimate.visit+estimate.buffer;
  const over=total>trip.minutes;
  const selected=getPlace(focused??'');
  const destination=selected??stops.at(-1);
  const anchor=nearbyReference(trip,focused,nearbyMode);
  const listAnchor=activeTool==='browse'?nearbyReference(trip,focused,'start'):anchor;
  const nearby=useMemo(()=>{
    if(activeTool==='nearby'&&!listAnchor)return [];
    const list=nearestPlaces(listAnchor?.coordinates??[44.3661,33.3152],trip.category,activeTool!=='browse'&&listAnchor?.kind==='destination'?[listAnchor.id]:[]);
    const term=search.toLowerCase().trim();
    return list.filter(({place})=>!term || [place.name,place.region,place.arabic,...place.aliases].join(' ').toLowerCase().includes(term));
  },[listAnchor?.id,listAnchor?.coordinates,trip.category,search,activeTool]);

  useEffect(()=>{
    if(!guideView)return;
    setActiveTool(guideView.tool);
    if(guideView.reference)setNearbyMode(guideView.reference);
    if(guideView.fit){autoFit.current=true;setRouteRetry(r=>r+1);}
    onGuideViewHandled?.();
  },[guideView]);
  useEffect(()=>{onRouteChange?.(road);},[road,onRouteChange]);

  useEffect(()=>{
    const points=JSON.parse(pointKey) as Coordinates[];
    if(points.length<2) {setRouteState({key:pointKey,status:'preview',route:null});if(autoFit.current){autoFit.current=false;setMessage('No stops fit the road travel time. Try a longer day or another starting point.');}return;}
    const controller=new AbortController();
    setRouteState({key:pointKey,status:'loading',route:null});
    const timer=setTimeout(()=>{
      if(!token) {setRouteState({key:pointKey,status:'preview',route:null});return;}
      void fetchRoadRoute(points,token,controller.signal).then(route=>{
        if(controller.signal.aborted)return;
        const current=latest.current.trip;
        if(autoFit.current && route.minutes+estimateTrip(current).visit+20>current.minutes && current.stopIds.length) {
          latest.current.onChange({...current,stopIds:current.stopIds.slice(0,-1)});
          setMessage('Adjusting the stops to fit the road travel time.');
          return;
        }
        if(autoFit.current)setMessage('Your day is ready. The road estimate fits your time.');
        autoFit.current=false;
        setRouteState({key:pointKey,status:'road',route});
      }).catch(()=>{if(!controller.signal.aborted){if(autoFit.current)setMessage('Your draft is ready with estimated travel times. Road directions are unavailable.');autoFit.current=false;setRouteState({key:pointKey,status:'preview',route:null});}});
    },400);
    return()=>{controller.abort();clearTimeout(timer);};
  },[pointKey,routeRetry]);

  function change(next:Trip) {
    autoFit.current=false;
    setMessage('');
    if(next.origin && next.origin !== trip.origin) setLocationState('idle');
    onChange(next);
  }
  function build() {
    if(!trip.origin){setActiveTool('setup');setMessage('Choose your starting city or drop a pin first.');return;}
    const ids=buildDay(trip);
    setActiveTool('trip');
    autoFit.current=true;
    onChange({...trip,stopIds:ids});
    setRouteRetry(r=>r+1);
    setMessage(ids.length?'Your day is taking shape. Checking the road route…':'No places fit this time from your start. Try more time or a different category.');
  }
  function toggle(place:Place) {
    if(trip.stopIds.includes(place.id)){change({...trip,stopIds:trip.stopIds.filter(id=>id!==place.id)});setMessage(`${place.name} removed.`);}
    else if(trip.stopIds.length<MAX_STOPS){change({...trip,stopIds:[...trip.stopIds,place.id]});setMessage(`${place.name} added.`);}
    else {setActiveTool('trip');setMessage(`Your day can have up to ${MAX_STOPS} stops. Remove one to make room.`);}
  }
  function move(index:number,offset:number) {
    const ids=[...trip.stopIds];
    const from=ids.indexOf(stops[index].id),to=ids.indexOf(stops[index+offset].id);
    [ids[from],ids[to]]=[ids[to],ids[from]];
    change({...trip,stopIds:ids});
  }
  async function copyItinerary() {
    const text = [
      'My day with Bilad',
      `Start: ${trip.origin?.name ?? 'Not chosen'}`,
      ...stops.map((place, index) => `${index + 1}. ${place.name} — ${place.arabic} (${place.region})`),
      ...(trip.roundTrip ? [`Return to ${trip.origin?.name}`] : []),
    ].join('\n');
    try { await navigator.clipboard.writeText(text); setMessage('Itinerary copied. Share it with your driver or travel companion.'); }
    catch { setMessage('Your browser could not copy the itinerary. You can select the stop names to copy them.'); }
  }
  const routeLabel=road?'Road route':routeStatus==='loading'?'Checking roads…':'Estimated preview';

  return <div className="trip-planner">
    {!atlas&&<div className="planner-intro"><h1>Make a day of it.</h1></div>}
    {!atlas&&<div className="planner-workspace planner-workspace-simple">
      <div className="planner-discover">
        <PlannerMap trip={trip} focused={focused} route={road} picking={picking} locationStatus={locationState==='locating'?'Finding your location…':undefined} onFocus={onFocus} nearbyView={activeTool==='nearby'&&anchor?{key:`${anchor.kind}:${anchor.id}:${anchor.coordinates.join(',')}`,coordinates:anchor.coordinates}:undefined} onPick={coordinates=>{change({...trip,origin:{id:'pin',name:'Your map pin',coordinates}});setPicking(false);onFocus(null);}} />
        {picking&&<button className="planner-cancel-pick" onClick={()=>setPicking(false)}>Cancel pin selection</button>}
        {selected&&<article className="place-spotlight compact-spotlight">
          <div className="spotlight-art"><PlaceArt place={selected}/></div>
          <div className="spotlight-copy"><div className="spotlight-top"><span className={`category-label category-${selected.category}`}>{selected.region} · {formatTime(selected.visitMinutes)} visit</span><button className="quiet-icon" aria-label="Close place details" onClick={()=>onFocus(null)}>×</button></div><h3>{selected.name} <span lang="ar">{selected.arabic}</span></h3><p>{selected.brief}</p><div className="spotlight-actions"><button className="planner-secondary" onClick={()=>toggle(selected)}>{trip.stopIds.includes(selected.id)?'− Remove stop':'+ Add to my day'}</button><a href={selected.source} target="_blank" rel="noreferrer">Read the story ↗</a></div></div>
          <DestinationVisitInfo key={selected.id} placeId={selected.id} placeName={selected.name} primary photoCredit={selected.photoCredit}/>
        </article>}
      </div>
    </div>}
    <PlannerReveal active={activeTool} onChange={tool=>{setActiveTool(tool);if(tool!=='setup')setPicking(false);}} tripCount={trip.stopIds.length}>
    {activeTool==='setup'&&<><div className="planner-toolbar">
      <label className="planner-field"><span>Starting from</span><select aria-label="Starting city" value={trip.origin?.id??''} onChange={e=>{const origin=origins.find(o=>o.id===e.target.value);if(origin){change({...trip,origin});onFocus(null);setPicking(false);}}}><option value="" disabled>{locationState==='locating'?'Finding your location…':'Choose a city'}</option>{origins.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}{trip.origin&&!origins.some(origin=>origin.id===trip.origin?.id)&&<option value={trip.origin.id}>{trip.origin.name}</option>}</select></label>
      <button className={`pin-start-button${picking?' is-active':''}`} aria-pressed={picking} onClick={()=>{setPicking(true);setActiveTool(null);}}><span aria-hidden="true">⌖</span>Drop a pin</button>
      <label className="planner-field time-field"><span>Time available</span><select aria-label="Time available" value={trip.minutes} onChange={e=>change({...trip,minutes:Number(e.target.value)})}>{[60,120,180,240,360,480,600,720,...(![60,120,180,240,360,480,600,720].includes(trip.minutes)?[trip.minutes]:[])].sort((a,b)=>a-b).map(t=><option key={t} value={t}>{formatTime(t)}</option>)}</select></label>
      <button className="planner-primary build-day" onClick={build}>Plan my day <span aria-hidden="true">↗</span></button>
    </div><details className="custom-start"><summary>Enter a custom map point</summary><form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);const coordinates:Coordinates=[Number(data.get('longitude')),Number(data.get('latitude'))];change({...trip,origin:{id:'pin',name:'Your map pin',coordinates}});setPicking(false);setMessage('Starting point updated.');}}><label>Longitude<input aria-label="Starting longitude" name="longitude" type="number" step="any" min="-180" max="180" required defaultValue={trip.origin?.coordinates[0]}/></label><label>Latitude<input aria-label="Starting latitude" name="latitude" type="number" step="any" min="-90" max="90" required defaultValue={trip.origin?.coordinates[1]}/></label><button className="planner-secondary" type="submit">Use this map point</button></form></details><button className="planner-secondary" onClick={()=>setActiveTool('trip')}>View itinerary →</button></>}
    {!atlas&&(activeTool==='setup'||activeTool==='trip')&&<TravelShortcuts context="planner" />}
        {(activeTool==='nearby'||activeTool==='browse')&&<section className="nearby-places" aria-label={activeTool==='browse'?'All destinations':'Nearby destinations'}>
          {activeTool==='nearby'&&<div className="nearby-reference-bar">
            <div className="nearby-reference-tabs" aria-label="Find places near"><button type="button" aria-label="My starting point" aria-pressed={anchor?.kind!=='destination'} onClick={()=>setNearbyMode('start')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>My start</button><button type="button" aria-label="Selected destination" aria-pressed={anchor?.kind==='destination'} disabled={!destination} onClick={()=>setNearbyMode('destination')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M18 10c0 4-6 10-6 10s-6-6-6-10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/></svg>Destination</button></div>
            {anchor?.kind!=='destination'&&<label className="nearby-start-field"><span className="visually-hidden">Starting area</span><select aria-label="Nearby starting area" value={trip.origin?.id??''} onChange={event=>{const origin=origins.find(o=>o.id===event.target.value);if(origin)change({...trip,origin});}}><option value="" disabled>Choose your area</option>{origins.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}{trip.origin&&!origins.some(origin=>origin.id===trip.origin?.id)&&<option value={trip.origin.id}>{trip.origin.name}</option>}</select></label>}
          </div>}
          <div className="nearby-heading"><div><h3>{activeTool==='browse'?'Explore Iraq':anchor?`Around ${anchor.name}`:'What’s around you?'}</h3>{activeTool==='nearby'&&!anchor&&<p className="nearby-context">Choose a starting area.</p>}</div><label className="place-search"><input aria-label="Search destinations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a place"/></label></div>
          <div className="category-filters"><select aria-label="Place category" value={trip.category} onChange={e=>change({...trip,category:e.target.value as Trip['category']})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{listAnchor&&<span>Straight-line distances</span>}</div>
          <div className="place-cards">{nearby.slice(0,activeTool==='browse'||search?nearby.length:3).map(({place,distance})=><article key={place.id} className={`place-card${trip.stopIds.includes(place.id)?' in-plan':''}`}><button className="place-card-main" aria-label={`Explore ${place.name}`} onClick={()=>onFocus(place.id)}><div className="place-card-art"><PlaceArt place={place}/><span className="place-visit-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>{formatTime(place.visitMinutes)}</span><div className="place-card-copy"><span>{place.region}</span><h4>{place.name}</h4></div></div></button><div className="place-card-bottom"><span>{listAnchor?formatDistance(distance):place.category}</span>{place.photoCredit&&<a className="card-photo-credit" href={place.photoCredit.url} target="_blank" rel="noreferrer" aria-label={`Photo credit for ${place.name}`} title={`${place.photoCredit.author} · ${place.photoCredit.license}`}>©</a>}<button aria-label={`${trip.stopIds.includes(place.id)?'Remove':'Add'} ${place.name}`} title={trip.stopIds.includes(place.id)?'Remove from trip':'Add to trip'} aria-pressed={trip.stopIds.includes(place.id)} onClick={()=>toggle(place)}>{trip.stopIds.includes(place.id)?'✓':'+'}</button></div></article>)}</div>
          {!nearby.length&&(activeTool==='browse'||anchor)&&<p className="empty-copy">No matching places in this collection. Try another name or category.</p>}
        </section>}
        <section className="itinerary-panel" hidden={activeTool!=='trip'}>
          <button className="planner-secondary" onClick={()=>setActiveTool('setup')}>Edit start & time</button>
          {trip.stopIds.some(id=>!getPlace(id))&&<div className="journey-error">Some saved destinations are no longer in the collection. They are excluded from routing. {trip.stopIds.filter(id=>!getPlace(id)).map(id=><button key={id} onClick={()=>change({...trip,stopIds:trip.stopIds.filter(s=>s!==id)})}>Remove unavailable stop: {id}</button>)}</div>}
          <div className="trip-settings"><span>Driving</span><label><input type="checkbox" checked={trip.roundTrip} onChange={e=>change({...trip,roundTrip:e.target.checked})}/> Return to start</label></div>
          {!stops.length?<div className="empty-itinerary"><svg className="empty-route-art" viewBox="0 0 200 90" fill="none" aria-hidden="true"><path d="M30 65h95a19 19 0 0 0 0-38H75" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5"/><circle cx="30" cy="65" r="9" stroke="currentColor" strokeWidth="1.5"/><circle cx="75" cy="27" r="6" fill="currentColor"/><circle cx="163" cy="28" r="3" fill="currentColor" opacity=".3"/></svg><h4>Your day starts here.</h4><p>{trip.origin?'Add a place on the map.':'Choose your starting point.'}</p></div>:<>
            {!trip.origin&&<p className="journey-error">Choose a starting city or map pin to calculate travel. These stops are kept in your draft.</p>}
            <div className="trip-summary" aria-live="polite"><div><strong>{formatTime(total)}</strong><span>of your {formatTime(trip.minutes)}</span></div><span className={`route-status${road?' is-road':''}`}>{routeLabel}</span><div className={`time-track${over?' over-budget':''}`}><i style={{width:`${Math.min(100,total/trip.minutes*100)}%`}}/></div><p>{formatTime(road?.minutes??estimate.travel)} travel · {formatTime(estimate.visit)} exploring · 20m buffer</p>{over&&<p className="budget-warning">{formatTime(total-trip.minutes)} over your time. <button onClick={build}>Fit my time</button></p>}</div>
            <ItineraryTimeline stops={stops} originName={trip.origin?.name} legs={road?.legs ?? estimate.legs} road={!!road} roundTrip={trip.roundTrip} onFocus={onFocus} onMove={move} onToggle={toggle} />
            <div className="plan-actions"><button onClick={()=>change({...trip,stopIds:orderStops(trip)})}>Order by proximity</button><button onClick={copyItinerary}>Copy itinerary</button><button onClick={()=>change({...trip,stopIds:[]})}>Clear</button></div>
            {road?<details className="route-directions"><summary>Road directions · {formatDistance(road.km)}</summary>{road.legs.map((leg,i)=><div key={i}><h4>{i<stops.length?stops[i].name:'Return to start'} · {formatTime(leg.minutes)}</h4><ol>{leg.instructions.map((step,n)=><li key={n}>{step}</li>)}</ol></div>)}</details>:routeStatus!=='loading'&&<p className="route-note">Road directions are unavailable. The dashed line connects stops only; travel times are rough estimates. <button onClick={()=>setRouteRetry(r=>r+1)}>Retry roads</button></p>}
            <p className="planning-note">Visit times are suggested. Check access and opening times locally; pins mark site areas, not confirmed entrances.</p>
          </>}
        </section>
        <section className="milai-planner" aria-label="Milai trip assistant" hidden={activeTool!=='milai'}>
          {milai}
        </section>
    {message&&<p className="planner-message" role="status">{message}</p>}
    </PlannerReveal>
    <JourneyBar/>
  </div>;
}
