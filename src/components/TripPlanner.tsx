'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { origins, type Category, type Coordinates, type Place } from '@/lib/destinations';
import { buildDay, estimateTrip, formatDistance, formatTime, getPlace, MAX_STOPS, nearbyReference, nearestPlaces, orderStops, tripCoordinates, tripPlaces, type MilaiReply, type NearbyMode, type Trip } from '@/lib/trip-planner';
import { fetchRoadRoute, type RoadRoute } from '@/lib/road-route';
import PlannerReveal, { type PlannerTool } from './PlannerReveal';

const PlannerMap=dynamic(()=>import('./PlannerMap'),{ssr:false,loading:()=> <div className="planner-map planner-map-loading">Unfolding Iraq…</div>});
const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
type Props={trip:Trip;onChange:(trip:Trip)=>void;onAsk:(prompt:string)=>void;reply:MilaiReply|null;onUndo:()=>void;canUndo:boolean;focused:string|null;onFocus:(id:string|null)=>void};
const categories: {id:Category|'all';name:string}[]=[{id:'all',name:'All places'},{id:'history',name:'History'},{id:'nature',name:'Nature'},{id:'culture',name:'Culture'}];

function PlaceArt({place}:{place:Place}) {
  return place.image?<img src={place.image} alt={place.name} loading="lazy" />:<div className={`place-art art-${place.category}`} aria-hidden="true"><svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="1.1">{place.category==='nature'?<><path d="M5 66 35 24 60 56 79 13 115 66M24 40l11 5 7-9M65 34l14 7 10-10M7 74c20-9 33 9 53 0s34 8 53 0M13 82h92"/><circle cx="20" cy="19" r="6"/></>:place.category==='culture'?<><path d="M22 65V28q20-8 38 3 18-11 38-3v37q-20-8-38 3-18-11-38-3ZM60 31v37M29 36l23 3M29 45l23 3M68 39l22-3M68 48l22-3M13 75h94"/></>:<><path d="M12 72h96M21 70V41h78v29M29 41V29h62v12M39 29V17h42v12M48 70V47h24v23M28 49h10M82 49h10M28 58h10M82 58h10"/><path d="M60 9v-6M8 29h10M102 29h10"/></>}</svg></div>;
}

export default function TripPlanner({trip,onChange,onAsk,reply,onUndo,canUndo,focused,onFocus}:Props) {
  const [picking,setPicking]=useState(false);
  const [search,setSearch]=useState('');
  const [message,setMessage]=useState('');
  const [question,setQuestion]=useState('');
  const [nearbyMode,setNearbyMode]=useState<NearbyMode>('start');
  const [activeTool,setActiveTool]=useState<PlannerTool|null>(()=>trip.stopIds.length?'trip':null);
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

  function change(next:Trip) {autoFit.current=false;setMessage('');onChange(next);}
  function ask(prompt:string) {autoFit.current=false;setMessage('');onAsk(prompt);}
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
    if(!trip.origin){setActiveTool('setup');setMessage('Choose a starting city or drop a pin before adding stops.');return;}
    if(trip.stopIds.includes(place.id))change({...trip,stopIds:trip.stopIds.filter(id=>id!==place.id)});
    else if(trip.stopIds.length<MAX_STOPS)change({...trip,stopIds:[...trip.stopIds,place.id]});
    else {setActiveTool('trip');setMessage(`Your day can have up to ${MAX_STOPS} stops. Remove one to make room.`);}
  }
  function move(index:number,offset:number) {
    const ids=[...trip.stopIds];[ids[index],ids[index+offset]]=[ids[index+offset],ids[index]];
    change({...trip,stopIds:ids});
  }
  const routeLabel=road?'Road route':routeStatus==='loading'?'Checking roads…':'Estimated preview';

  return <div className="trip-planner">
    <div className="planner-intro"><h1>Make a day of it.</h1></div>
    <div className="planner-workspace planner-workspace-simple">
      <div className="planner-discover">
        <PlannerMap trip={trip} focused={focused} route={road} picking={picking} onFocus={onFocus} nearbyView={activeTool==='nearby'&&anchor?{key:`${anchor.kind}:${anchor.id}:${anchor.coordinates.join(',')}`,coordinates:anchor.coordinates}:undefined} onPick={coordinates=>{change({...trip,origin:{id:'pin',name:'Your map pin',coordinates}});setPicking(false);onFocus(null);}} />
        {picking&&<button className="planner-cancel-pick" onClick={()=>setPicking(false)}>Cancel pin selection</button>}
        {selected&&<article className="place-spotlight">
          <div className="spotlight-art"><PlaceArt place={selected}/></div>
          <div className="spotlight-copy"><div className="spotlight-top"><span className={`category-label category-${selected.category}`}>{selected.highlight}</span><button className="quiet-icon" aria-label="Close place details" onClick={()=>onFocus(null)}>×</button></div><h3>{selected.name} <span lang="ar">{selected.arabic}</span></h3><p>{selected.brief}</p><div className="spotlight-actions"><span>Allow {formatTime(selected.visitMinutes)}</span><a href={selected.source} target="_blank" rel="noreferrer">Read the story ↗</a><button className="planner-secondary" onClick={()=>toggle(selected)}>{trip.stopIds.includes(selected.id)?'− Remove stop':'+ Add to my day'}</button></div>{selected.photoCredit&&<small className="photo-credit">Photo: <a href={selected.photoCredit.url} target="_blank" rel="noreferrer">{selected.photoCredit.author}</a> · {selected.photoCredit.licenseUrl?<a href={selected.photoCredit.licenseUrl} target="_blank" rel="noreferrer">{selected.photoCredit.license}</a>:selected.photoCredit.license}</small>}</div>
        </article>}
      </div>
    </div>
    <PlannerReveal active={activeTool} onChange={tool=>{setActiveTool(tool);if(tool!=='setup')setPicking(false);}} tripCount={stops.length}>
    {activeTool==='setup'&&<div className="planner-toolbar">
      <label className="planner-field"><span>Starting from</span><select aria-label="Starting city" value={trip.origin?.id??''} onChange={e=>{const origin=origins.find(o=>o.id===e.target.value);if(origin){change({...trip,origin});onFocus(null);setPicking(false);}}}><option value="" disabled>Choose a city</option>{origins.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}{trip.origin?.id==='pin'&&<option value="pin">Your map pin</option>}</select></label>
      <button className={`pin-start-button${picking?' is-active':''}`} aria-pressed={picking} onClick={()=>{setPicking(true);setActiveTool(null);}}><span aria-hidden="true">⌖</span>Drop a pin</button>
      <label className="planner-field time-field"><span>Time available</span><select aria-label="Time available" value={trip.minutes} onChange={e=>change({...trip,minutes:Number(e.target.value)})}>{[60,120,180,240,360,480,600,720,...(![60,120,180,240,360,480,600,720].includes(trip.minutes)?[trip.minutes]:[])].sort((a,b)=>a-b).map(t=><option key={t} value={t}>{formatTime(t)}</option>)}</select></label>
      <button className="planner-primary build-day" onClick={build}>Plan my day <span aria-hidden="true">↗</span></button>
    </div>}
        {(activeTool==='nearby'||activeTool==='browse')&&<section className="nearby-places" aria-label={activeTool==='browse'?'All destinations':'Nearby destinations'}>
          {activeTool==='nearby'&&<div className="nearby-reference-bar">
            <div className="nearby-reference-tabs" aria-label="Find places near"><button type="button" aria-label="My starting point" aria-pressed={anchor?.kind!=='destination'} onClick={()=>setNearbyMode('start')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>My start</button><button type="button" aria-label="Selected destination" aria-pressed={anchor?.kind==='destination'} disabled={!destination} onClick={()=>setNearbyMode('destination')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M18 10c0 4-6 10-6 10s-6-6-6-10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/></svg>Destination</button></div>
            {anchor?.kind!=='destination'&&<label className="nearby-start-field"><span className="visually-hidden">Starting area</span><select aria-label="Nearby starting area" value={trip.origin?.id??''} onChange={event=>{const origin=origins.find(o=>o.id===event.target.value);if(origin)change({...trip,origin});}}><option value="" disabled>Choose your area</option>{origins.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}{trip.origin?.id==='pin'&&<option value="pin">Your map pin</option>}</select></label>}
          </div>}
          <div className="nearby-heading"><div><h3>{activeTool==='browse'?'Explore Iraq':anchor?`Around ${anchor.name}`:'What’s around you?'}</h3>{activeTool==='nearby'&&!anchor&&<p className="nearby-context">Choose a starting area.</p>}</div><label className="place-search"><input aria-label="Search destinations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a place"/></label></div>
          <div className="category-filters"><select aria-label="Place category" value={trip.category} onChange={e=>change({...trip,category:e.target.value as Trip['category']})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{listAnchor&&<span>Straight-line distances</span>}</div>
          <div className="place-cards">{nearby.slice(0,activeTool==='browse'||search?nearby.length:3).map(({place,distance})=><article key={place.id} className={`place-card${trip.stopIds.includes(place.id)?' in-plan':''}`}><button className="place-card-main" aria-label={`Explore ${place.name}`} onClick={()=>onFocus(place.id)}><div className="place-card-art"><PlaceArt place={place}/><span className="place-visit-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>{formatTime(place.visitMinutes)}</span><div className="place-card-copy"><span>{place.region}</span><h4>{place.name}</h4></div></div></button><div className="place-card-bottom"><span>{listAnchor?formatDistance(distance):place.category}</span>{place.photoCredit&&<a className="card-photo-credit" href={place.photoCredit.url} target="_blank" rel="noreferrer" aria-label={`Photo credit for ${place.name}`} title={`${place.photoCredit.author} · ${place.photoCredit.license}`}>©</a>}<button aria-label={`${trip.stopIds.includes(place.id)?'Remove':'Add'} ${place.name}`} title={trip.stopIds.includes(place.id)?'Remove from trip':'Add to trip'} aria-pressed={trip.stopIds.includes(place.id)} onClick={()=>toggle(place)}>{trip.stopIds.includes(place.id)?'✓':'+'}</button></div></article>)}</div>
          {!nearby.length&&(activeTool==='browse'||anchor)&&<p className="empty-copy">No matching places in this collection. Try another name or category.</p>}
        </section>}
        <section className="itinerary-panel" hidden={activeTool!=='trip'}>
          <div className="trip-settings"><span>Driving</span><label><input type="checkbox" checked={trip.roundTrip} onChange={e=>change({...trip,roundTrip:e.target.checked})}/> Return to start</label></div>
          {!stops.length?<div className="empty-itinerary"><svg className="empty-route-art" viewBox="0 0 200 90" fill="none" aria-hidden="true"><path d="M30 65h95a19 19 0 0 0 0-38H75" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5"/><circle cx="30" cy="65" r="9" stroke="currentColor" strokeWidth="1.5"/><circle cx="75" cy="27" r="6" fill="currentColor"/><circle cx="163" cy="28" r="3" fill="currentColor" opacity=".3"/></svg><h4>Your day starts here.</h4><p>{trip.origin?'Add a place on the map.':'Choose your starting point.'}</p></div>:<>
            <div className="trip-summary" aria-live="polite"><div><strong>{formatTime(total)}</strong><span>of your {formatTime(trip.minutes)}</span></div><span className={`route-status${road?' is-road':''}`}>{routeLabel}</span><div className={`time-track${over?' over-budget':''}`}><i style={{width:`${Math.min(100,total/trip.minutes*100)}%`}}/></div><p>{formatTime(road?.minutes??estimate.travel)} travel · {formatTime(estimate.visit)} exploring · 20m buffer</p>{over&&<p className="budget-warning">{formatTime(total-trip.minutes)} over your time. <button onClick={build}>Fit my time</button></p>}</div>
            <ol className="itinerary-list"><li className="itinerary-start"><span className="timeline-dot">S</span><div><small>START HERE</small><strong>{trip.origin?.name}</strong></div></li>{stops.map((place,i)=>{const leg=road?.legs[i]??estimate.legs[i];return <li key={place.id}><span className="timeline-dot">{i+1}</span><div className="itinerary-stop-copy"><small>{road?'Drive':'Est. drive'} {formatTime(leg?.minutes??0)} · {formatDistance(leg?.km??0)}</small><button className="stop-name" onClick={()=>onFocus(place.id)}>{place.name}</button><span>{formatTime(place.visitMinutes)} to explore</span></div><div className="stop-controls"><button aria-label={`Move ${place.name} earlier`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`Move ${place.name} later`} disabled={i===stops.length-1} onClick={()=>move(i,1)}>↓</button><button aria-label={`Remove ${place.name} from plan`} onClick={()=>toggle(place)}>×</button></div></li>;})}{trip.roundTrip&&<li className="itinerary-return"><span className="timeline-dot">↩</span><div><small>{road?'DRIVE':'EST. DRIVE'} {formatTime((road?.legs.at(-1)??estimate.legs.at(-1))?.minutes??0)}</small><strong>Back to {trip.origin?.name}</strong></div></li>}</ol>
            <div className="plan-actions"><button onClick={()=>change({...trip,stopIds:orderStops(trip)})}>Order by proximity</button><button onClick={()=>change({...trip,stopIds:[]})}>Clear</button></div>
            {road?<details className="route-directions"><summary>Road directions · {formatDistance(road.km)}</summary>{road.legs.map((leg,i)=><div key={i}><h4>{i<stops.length?stops[i].name:'Return to start'} · {formatTime(leg.minutes)}</h4><ol>{leg.instructions.map((step,n)=><li key={n}>{step}</li>)}</ol></div>)}</details>:routeStatus!=='loading'&&<p className="route-note">Road directions are unavailable. The dashed line connects stops only; travel times are rough estimates. <button onClick={()=>setRouteRetry(r=>r+1)}>Retry roads</button></p>}
            <p className="planning-note">Visit times are suggested. Check access and opening times locally; pins mark site areas, not confirmed entrances.</p>
          </>}
        </section>
        <section className="milai-planner" aria-label="Milai trip assistant" hidden={activeTool!=='milai'}>
          <div className="milai-planner-heading"><img src="/assets/ai%20mascot.png" alt="" width="32" height="38"/><div><h3>Milai</h3><span>Demo guide</span></div></div>
          <p className="milai-reply" aria-live="polite">{reply?.message??'Where shall we go?'}</p>
          {reply?.recommendations.length? <div className="reply-places">{reply.recommendations.slice(0,3).map(id=><button key={id} onClick={()=>onFocus(id)}>{getPlace(id)?.name} ↗</button>)}</div>:null}
          <form className="planner-chat-form" onSubmit={e=>{e.preventDefault();if(question.trim()){ask(question);setQuestion('');}}}><label className="visually-hidden" htmlFor="planner-question">Ask Milai to change your plan</label><input id="planner-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={500} placeholder="A little more history…"/><button type="submit" aria-label="Send to Milai" disabled={!question.trim()}>↑</button></form>
          <div className="milai-quick-prompts">{['Plan a history day','Show nearby places','Plan a nature day'].map(q=><button key={q} onClick={()=>ask(q)}>{q.replace('Plan a ','').replace(' day','')}</button>)}</div>
          {canUndo&&<button className="undo-plan" onClick={()=>{autoFit.current=false;setMessage('');onUndo();}}>↶ Undo last plan change</button>}
        </section>
    {message&&<p className="planner-message" role="status">{message}</p>}
    </PlannerReveal>
  </div>;
}
