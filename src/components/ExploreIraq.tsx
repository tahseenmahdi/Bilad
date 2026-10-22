'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { places, type Place, type Coordinates } from '@/lib/destinations';
import { nearestPlaces, tripCoordinates } from '@/lib/trip-planner';
import { useMilaiGuide } from './useMilaiGuide';
import MilaiConversation from './MilaiConversation';
import { useJourneys } from './JourneyProvider';
import type { RoadRoute } from '@/lib/road-route';
import { filters, governorate, matchesFilter, matchesSearch, normalizeSearch, periods, placePeriods, regions, trails, addJourneyStops, type Filter, type Period } from '@/lib/explore';
import type { AtlasView } from './ExploreMap';
import { AtmosphereLink } from './AtmosphereTransition';
import DestinationVisitInfo from './DestinationVisitInfo';
import ExploreIcon from './ExploreIcon';
import './explore.css';
import './explore-polish.css';
import './trip-planner.css';
import './planner-reveal.css';
import './planner-colors.css';
import './explore-planner.css';

const ExploreMap=dynamic(()=>import('./ExploreMap'),{ssr:false,loading:()=> <div className="atlas-loading" role="status">Unfolding Iraq…</div>});
const TripPlanner=dynamic(()=>import('./TripPlanner'),{ssr:false});
type Mode='Places'|'Trails'|'Regions'|'Time';
const modes:Mode[]=['Places','Trails','Regions','Time'];
const national:Coordinates[]=[[38.8,29],[48.6,37.4]];
export default function ExploreIraq(){
  const [mode,setMode]=useState<Mode>('Places'),[panel,setPanel]=useState<'browse'|'place'|'plan'|null>(null);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState<Filter>('All'),[period,setPeriod]=useState<Period>('Ancient');
  const [region,setRegion]=useState<string|null>(null),[trailId,setTrailId]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState(false);
  const {draft,setTrip,ready:sessionReady}=useJourneys(),trip=draft.trip;
  const [view,setView]=useState<AtlasView|null>({key:0,points:national}),[notice,setNotice]=useState(''),[locating,setLocating]=useState(false);
  const [picking,setPicking]=useState(false),[roadState,setRoadState]=useState<{key:string;route:RoadRoute|null}>({key:'',route:null});
  const guide=useMilaiGuide({onFocus:id=>{setSelected(id);const place=places.find(p=>p.id===id);if(place)focus([place.coordinates]);},onMap:()=>setPanel('plan')});
  const pointKey=JSON.stringify(tripCoordinates(trip));
  const onRouteChange=useCallback((route:RoadRoute|null)=>setRoadState({key:pointKey,route}),[pointKey]);
  const panelRef=useRef<HTMLElement>(null), lastTrigger=useRef<HTMLElement|null>(null), modeRefs=useRef<(HTMLButtonElement|null)[]>([]), mounted=useRef(true);
  const planRef=useRef<HTMLElement>(null);
  const selectedPlace=places.find(p=>p.id===selected);
  const trail=trails.find(t=>t.id===trailId);
  const trailPlaces=useMemo(()=>trail?trail.stops.map(id=>places.find(p=>p.id===id)!):[],[trail]);
  const results=useMemo(()=>places.filter(p=>matchesSearch(p,query)&&(mode!=='Places'||matchesFilter(p,filter))&&(mode!=='Time'||placePeriods[p.id]?.includes(period))&&(mode!=='Regions'||!region||governorate(p)===region)&&(mode!=='Trails'||!trail||trail.stops.some(id=>id===p.id))),[query,mode,filter,period,region,trail]);
  useEffect(()=>{mounted.current=true;const follow=()=>{if(location.hash==='#plan')setPanel('plan');};follow();window.addEventListener('hashchange',follow);return()=>{mounted.current=false;window.removeEventListener('hashchange',follow);};},[]);
  useEffect(()=>{if(panel){const element=panel==='plan'?planRef.current:panelRef.current;element?.scrollTo({top:0});if(document.activeElement?.tagName!=='INPUT')element?.focus({preventScroll:true});}},[panel,selected,mode]);
  function remember(){lastTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}
  function close(){setPanel(null);setPicking(false);setDetail(false);requestAnimationFrame(()=>{const target=lastTrigger.current;if(target?.isConnected)target.focus({preventScroll:true});else modeRefs.current[modes.indexOf(mode)]?.focus();});}
  function focus(points:Coordinates[]){setView(v=>({key:(v?.key??0)+1,points}));}
  function choose(p:Place){remember();setSelected(p.id);setDetail(false);setPanel('place');focus([p.coordinates]);}
  function openMode(next:Mode){remember();setPicking(false);setMode(next);setPanel(panel==='browse'&&mode===next?null:'browse');setDetail(false);}
  function chooseRegion(name:string){setRegion(name);setMode('Regions');setPanel('browse');const item=regions.find(r=>r.name===name);if(item)focus(item.places.map(p=>p.coordinates));}
  function chooseTrail(id:string){setTrailId(id);setMode('Trails');setPanel('browse');const item=trails.find(t=>t.id===id);if(item)focus(item.stops.map(id=>places.find(p=>p.id===id)!.coordinates));}
  function add(ids:readonly string[]){const result=addJourneyStops(trip,ids);setTrip(result.trip);setNotice(result.skipped?`${result.added} added · ${result.skipped} over the 6-stop limit.`:result.added?`${result.added===1?'Place':`${result.added} places`} added to “${draft.title}”.`:'Already in this trip.');}
  function locate(){
    if(!navigator.geolocation){setNotice('Location is unavailable. Search for a place or region instead.');return;}
    setLocating(true);setNotice('Finding your location…');
    navigator.geolocation.getCurrentPosition(position=>{if(!mounted.current)return;setLocating(false);focus([[position.coords.longitude,position.coords.latitude]]);setNotice('Map centred on your location. Your position is not saved to your journey.');},error=>{if(!mounted.current)return;setLocating(false);setNotice(error.code===1?'Location permission was denied. Search or browse regions instead.':'Your location could not be found. You can still explore manually.');},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
  }
  function list(items:Place[]){return <div className="atlas-results">{items.map(p=><button className={`atlas-result${selected===p.id?' is-selected':''}`} key={p.id} onClick={()=>choose(p)}><span className="atlas-thumb">{p.image&&<img src={p.image} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><span><strong>{p.name}</strong><small>{governorate(p)} · {p.highlight}</small></span><span aria-hidden="true">↗</span></button>)}</div>;}
  return <main className="atlas" onKeyDown={e=>{if(e.key==='Escape'&&panel){e.stopPropagation();close();}}}>
    <ExploreMap places={results} selected={selected} trail={mode==='Trails'?trailPlaces:[]} view={view} trip={trip} road={roadState.key===pointKey?roadState.route:null} picking={picking} onPick={coordinates=>{setTrip({...trip,origin:{id:'pin',name:'Your map pin',coordinates}});setPicking(false);setPanel('plan');}} onSelect={id=>{const p=places.find(p=>p.id===id);if(p)choose(p);}} onFailure={()=>setPanel(p=>p??'browse')}/>
    <header className="atlas-top">
      <AtmosphereLink href="/#explore" className="atlas-brand"><span aria-hidden="true">←</span> BILAD <span className="atlas-back-label">/ Back to tower</span></AtmosphereLink>
      <div className="atlas-search"><ExploreIcon name="search"/><input aria-label="Search destinations and regions" placeholder="Find a place, a story…" value={query} onChange={e=>{setQuery(e.target.value);setPanel('browse');}} onFocus={()=>{setPanel('browse');}}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><ExploreIcon name="close"/></button>}</div>
      <button className="atlas-location" aria-label="Find my location" title="Find my location" disabled={locating} onClick={locate}><ExploreIcon name="location"/></button>
    </header>
    <nav className="atlas-modes" aria-label="Bap modes">{modes.map((m,i)=><button key={m} ref={el=>{modeRefs.current[i]=el;}} aria-pressed={mode===m} aria-expanded={mode===m&&panel==='browse'} onClick={()=>openMode(m)}><ExploreIcon name={(['places','trails','regions','time'] as const)[i]}/>{m}</button>)}</nav>
    <button className="atlas-plan-action" aria-expanded={panel==='plan'} onClick={()=>{remember();setPicking(false);setPanel(panel==='plan'?null:'plan');}}>↝ Plan a trip <small>{trip.stopIds.length}/6</small></button>
    {picking&&<div className="atlas-pick-message" role="status">Choose a starting point on the map.<button onClick={()=>{setPicking(false);setPanel('plan');}}>Cancel</button></div>}
    {!panel&&<div className="atlas-intro"><span className="atlas-eyebrow">A CULTURAL ATLAS</span><h1><img className="atlas-bap-logo" src="/assets/Bap%20logo.png" alt="" width="1254" height="1254" />Bap</h1><p>Places, stories, and paths.</p><button onClick={()=>{remember();setPanel('browse');}}>Browse {places.length} places <span aria-hidden="true">↗</span></button></div>}
    {panel&&panel!=='plan'&&<section className={`atlas-panel${panel==='place'?' is-place':''}${detail?' is-detail':''}`} ref={panelRef} tabIndex={-1} aria-label={panel==='place'?selectedPlace?.name:`${mode} collection`}>
      <div className="atlas-panel-top"><span className="atlas-eyebrow"><i aria-hidden="true"/>BAP / {panel==='place'?'DISCOVER':mode.toUpperCase()}</span><button aria-label="Close panel" onClick={close}><ExploreIcon name="close"/></button></div>
      {panel==='browse'&&<>
        <h1>{query?'Find your next story':mode==='Places'?'Somewhere remarkable.':mode==='Trails'?'Follow a thread.':mode==='Regions'?'A sense of place.':'Layers of time.'}</h1>
        {mode==='Places'&&<><div className="atlas-pills" aria-label="Place filters">{filters.map(f=><button aria-pressed={filter===f} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div>{filter==='Food'&&<p className="atlas-note">Café culture on Al-Mutanabbi Street. Restaurant listings are not yet curated.</p>}</>}
        {mode==='Time'&&<><div className="atlas-pills">{(Object.keys(periods) as Period[]).map(p=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{p}</button>)}</div><p>{periods[period]}</p><p className="atlas-note">A curated filter of sites today, not historical borders or an exhaustive history. Places can span periods.</p></>}
        {mode==='Regions'&&<><p className="atlas-note">Governorates represented in our collection. Coverage is selective; these are destination locations, not administrative boundaries.</p><div className="atlas-pills"><button aria-pressed={!region} onClick={()=>{setRegion(null);setQuery('');focus(national);}}>All Iraq</button>{regions.filter(r=>!query||normalizeSearch(`${r.name} ${r.arabic}`).includes(normalizeSearch(query))||r.places.some(p=>matchesSearch(p,query))).map(r=><button aria-pressed={region===r.name} key={r.name} onClick={()=>chooseRegion(r.name)}>{r.name} <small>{r.places.length}</small></button>)}</div>{region&&<p>Discover {regions.find(r=>r.name===region)?.places.map(p=>p.name).slice(0,2).join(' and ')} in {region}. Explore the curated places below.</p>}{region&&<div className="atlas-related">{trails.filter(t=>t.stops.some(id=>governorate(places.find(p=>p.id===id)!)===region)).map(t=><button key={t.id} onClick={()=>chooseTrail(t.id)}>{t.name} →</button>)}</div>}</>}
        {mode==='Trails'&&<><div className="atlas-trails">{trails.map(t=><button aria-pressed={trailId===t.id} key={t.id} onClick={()=>chooseTrail(t.id)}><strong>{t.name}</strong><small>{t.stops.length} stops · thematic trail</small></button>)}</div>{trail&&<><p>{trail.intro}</p><p className="atlas-note">Coral dashed lines connect themes, not roads. Access is not confirmed; use Plan a trip to check travel estimates.</p><ol className="atlas-stops">{trail.stops.map(id=><li key={id}><button onClick={()=>choose(places.find(p=>p.id===id)!)}>{places.find(p=>p.id===id)!.name} ↗</button></li>)}</ol><button className="atlas-primary" disabled={!sessionReady} onClick={()=>add(trail.stops)}>Add trail to journey</button><button className="atlas-text-button" onClick={()=>setPanel('plan')}>Choose another trip / new trip →</button></>}</>}
        {query&&mode!=='Regions'&&<div className="atlas-related">{regions.filter(r=>normalizeSearch(`${r.name} ${r.arabic}`).includes(normalizeSearch(query))).map(r=><button key={r.name} onClick={()=>chooseRegion(r.name)}>{r.name} · Region →</button>)}</div>}
        {(mode!=='Trails'||query)&&<><div className="atlas-result-label">{results.length} curated places</div>{results.length?list(results):<div className="atlas-empty"><p>No places match this view.</p><button onClick={()=>{setQuery('');setFilter('All');setRegion(null);setMode('Places');}}>Show all places</button></div>}</>}
      </>}
      {panel==='place'&&selectedPlace&&<>
        <div className="atlas-photo">{selectedPlace.image?<img src={selectedPlace.image} alt={selectedPlace.name} onError={e=>{e.currentTarget.hidden=true;}}/>:<span>Photography coming soon</span>}<span className="atlas-photo-caption">{selectedPlace.arabic}</span></div>
        <div className="atlas-place-meta">{governorate(selectedPlace)}{placePeriods[selectedPlace.id]?.length?` / ${placePeriods[selectedPlace.id].join(' · ')}`:''}</div>
        <h1>{selectedPlace.name}</h1><p>{selectedPlace.brief}</p>
        <div className="atlas-actions"><button className="atlas-primary" aria-expanded={detail} onClick={()=>setDetail(d=>!d)}>{detail?'Less detail':'Discover'} <span aria-hidden="true">↗</span></button><button disabled={!sessionReady} onClick={()=>add([selectedPlace.id])}>{trip.stopIds.includes(selectedPlace.id)?'Added ✓':'Add to journey +'}</button></div>
        <button className="atlas-text-button" onClick={()=>setPanel('plan')}>Adding to {draft.title} · Change trip →</button>
        {detail&&<div className="atlas-details"><h2>{selectedPlace.highlight}</h2>{selectedPlace.id==='erbil-citadel'&&<p>Ancient Arbela lies beneath a settlement whose fan-shaped street pattern reflects its late Ottoman phase.</p>}<DestinationVisitInfo placeId={selectedPlace.id} placeName={selectedPlace.name} primary photoCredit={selectedPlace.photoCredit}/><details><summary>Story sources & photography</summary><p>Maintained editorial context; not live operational information. Pins mark sites or areas, not verified entrances.</p><a href={selectedPlace.source} target="_blank" rel="noreferrer">Destination reference ↗</a><br/><a href={selectedPlace.coordinateSource} target="_blank" rel="noreferrer">Coordinate reference ↗</a>{selectedPlace.photoCredit&&<p>Photo: <a href={selectedPlace.photoCredit.url} target="_blank" rel="noreferrer">{selectedPlace.photoCredit.author}</a> · {selectedPlace.photoCredit.license}</p>}</details><h2>Nearby discoveries</h2>{list(nearestPlaces(selectedPlace.coordinates,'all',[selectedPlace.id]).slice(0,3).map(n=>n.place))}</div>}
        <div className="atlas-crosslinks"><AtmosphereLink href={`/ai/?place=${selectedPlace.id}#chat`}>Ask Milai ↗</AtmosphereLink><AtmosphereLink href="/services/#taxi">Open Daleel ↗</AtmosphereLink><AtmosphereLink href={`/say-it/#${filter==='Food'?'table':'taxi'}`}>Say It ↗</AtmosphereLink></div>
        <button className="atlas-text-button" onClick={()=>{setPanel('browse');setDetail(false);}}>← Back to {mode.toLowerCase()}</button>
      </>}
    </section>}
    <section className="atlas-panel atlas-planner" ref={planRef} hidden={panel!=='plan'} tabIndex={-1} aria-label="Plan a day trip">
      <div className="atlas-panel-top"><span className="atlas-eyebrow">BAP / PLAN YOUR DAY</span><button aria-label="Close planner" onClick={close}>×</button></div>
      <TripPlanner atlas trip={trip} onChange={guide.changeTrip} focused={selected} onFocus={id=>{setSelected(id);const place=places.find(p=>p.id===id);if(place){setPanel('place');focus([place.coordinates]);}}} guideView={guide.guideView} onGuideViewHandled={guide.clearView} milai={<MilaiConversation guide={guide} onPlace={id=>{const place=places.find(p=>p.id===id);if(place)choose(place);}}/>} mapPicking={picking} onMapPicking={next=>{setPicking(next);if(next)setPanel(null);}} onRouteChange={onRouteChange}/>
      <button className="atlas-text-button" onClick={()=>{const points=tripCoordinates(trip);if(points.length)focus(points);}}>Show active route on map ↗</button>
      <details className="atlas-note"><summary>Map key</summary><p>Aqua solid: road route · Aqua dashed: estimate · Coral dashed: thematic trail</p></details>
    </section>
    <footer className="atlas-footer"><span>IRAQ / {places.length} curated discoveries</span><AtmosphereLink href="/journeys/">Your journeys ↗</AtmosphereLink></footer>
    {notice&&<div className="atlas-toast" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={()=>setNotice('')}>×</button></div>}
  </main>;
}
