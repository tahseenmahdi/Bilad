'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as GLMap, GeoJSONSource, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { places, type Coordinates } from '@/lib/destinations';
import { tripCoordinates, type Trip } from '@/lib/trip-planner';
import type { RoadRoute } from '@/lib/road-route';

type Props={trip:Trip;focused:string|null;route:RoadRoute|null;picking:boolean;locationStatus?:string;onPick:(coordinates:Coordinates)=>void;onFocus:(id:string|null)=>void;nearbyView?:{key:string;coordinates:Coordinates}};
const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
const routeColors=['#57d9ff','#f2c96d','#ff8192','#a994ff','#62dfa5','#ff9f5a','#e47de8'];
type JourneyFeature={type:'Feature';properties:{color:string;leg:number};geometry:{type:'LineString';coordinates:Coordinates[]}};

function distanceSquared(a:Coordinates,b:Coordinates) {
  return (a[0]-b[0])**2+(a[1]-b[1])**2;
}

function visitLabel(minutes:number) {
  if(minutes<60)return `${minutes} min`;
  const hours=Math.floor(minutes/60);
  const remainder=minutes%60;
  return `${hours} hr${hours===1?'':'s'}${remainder?` ${remainder} min`:''}`;
}

function journeyFeatures(points:Coordinates[],road:RoadRoute|null):JourneyFeature[] {
  if(points.length<2)return [];
  if(!road)return points.slice(1).map((point,index)=>({type:'Feature',properties:{color:routeColors[index%routeColors.length],leg:index+1},geometry:{type:'LineString',coordinates:[points[index],point]}}));
  const coordinates=road.geometry.coordinates;
  const cuts=[0];
  let cursor=0;
  for(let pointIndex=1;pointIndex<points.length-1;pointIndex++) {
    let closest=Math.min(cursor+1,coordinates.length-1);
    let closestDistance=Infinity;
    const lastCandidate=Math.max(closest,coordinates.length-(points.length-pointIndex));
    for(let coordinateIndex=closest;coordinateIndex<=lastCandidate;coordinateIndex++) {
      const distance=distanceSquared(coordinates[coordinateIndex],points[pointIndex]);
      if(distance<closestDistance){closestDistance=distance;closest=coordinateIndex;}
    }
    cuts.push(closest);cursor=closest;
  }
  cuts.push(coordinates.length-1);
  return cuts.slice(1).map((end,index)=>({
    type:'Feature',
    properties:{color:routeColors[index%routeColors.length],leg:index+1},
    geometry:{type:'LineString',coordinates:coordinates.slice(cuts[index],end+1)},
  }));
}

export default function PlannerMap(props: Props) {
  const container=useRef<HTMLDivElement>(null);
  const mapRef=useRef<GLMap|null>(null);
  const latest=useRef(props); latest.current=props;
  const markers=useRef<{id:string;marker:Marker;button:HTMLButtonElement}[]>([]);
  const startMarker=useRef<Marker|null>(null);
  const [ready,setReady]=useState(false);
  const [failed,setFailed]=useState(false);
  const [retry,setRetry]=useState(0);
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(()=>{
    let disposed=false;
    let resize:ResizeObserver|undefined;
    let timeout:ReturnType<typeof setTimeout>;
    setReady(false);setFailed(false);
    if(!token?.startsWith('pk.')) {setFailed(true);return;}
    void (async()=>{
      try {
        const gl=(await import('mapbox-gl')).default;
        if(disposed||!container.current)return;
        if(!gl.supported())throw new Error('WebGL unavailable');
        const map=new gl.Map({container:container.current,accessToken:token,style:'mapbox://styles/mapbox/dark-v11',center:[44.3,33.6],zoom:5.4,attributionControl:false,logoPosition:'bottom-left',cooperativeGestures:true});
        mapRef.current=map;
        map.addControl(new gl.AttributionControl({compact:true}),'bottom-right');
        map.addControl(new gl.NavigationControl({showCompass:false}),'top-right');
        timeout=setTimeout(()=>{if(!disposed)setFailed(true);},20000);
        map.on('error',e=>{if(!disposed && [401,403].includes((e.error as Error & {status?:number}).status??0))setFailed(true);});
        map.on('click',event=>{if(latest.current.picking)latest.current.onPick([Number(event.lngLat.lng.toFixed(5)),Number(event.lngLat.lat.toFixed(5))]);});
        map.on('zoom',()=>container.current?.classList.toggle('show-pin-labels',map.getZoom()>=13));
        map.on('load',()=>{
          if(disposed)return;
          clearTimeout(timeout);setFailed(false);
          for(const layer of map.getStyle().layers??[]) {
            if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#081a23');
            if(layer.type==='fill')map.setPaintProperty(layer.id,'fill-color',layer.id.includes('water')?'#124356':layer.id.includes('building')?'#1e3540':'#122b36');
            if(layer.type==='line'&&layer.id.includes('road'))map.setPaintProperty(layer.id,'line-color','#2b414b');
            if(layer.type==='symbol'&&layer.layout?.['text-field']){map.setPaintProperty(layer.id,'text-color','#a4bdc6');map.setPaintProperty(layer.id,'text-halo-color','#0a202a');}
            if(layer.type==='symbol'&&(layer.id.includes('poi')||layer.id.includes('transit')))map.setLayoutProperty(layer.id,'visibility','none');
          }
          map.addSource('journey',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
          map.addLayer({id:'journey-casing',type:'line',source:'journey',paint:{'line-color':'#06141c','line-width':7,'line-opacity':.82},layout:{'line-join':'round','line-cap':'round'}});
          map.addLayer({id:'journey-line',type:'line',source:'journey',paint:{'line-color':['get','color'],'line-width':4,'line-opacity':1},layout:{'line-join':'round','line-cap':'round'}});
          map.addLayer({id:'journey-direction',type:'symbol',source:'journey',layout:{'symbol-placement':'line','symbol-spacing':85,'text-field':'›','text-size':17,'text-font':['DIN Pro Medium','Arial Unicode MS Regular'],'text-rotation-alignment':'map','text-keep-upright':false,'text-allow-overlap':true},paint:{'text-color':['get','color'],'text-halo-color':'#071820','text-halo-width':1.5,'text-opacity':.95}});
          markers.current=places.map(place=>{
            const button=document.createElement('button');
            button.type='button';button.className=`place-pin pin-${place.category}`;
            button.setAttribute('role','button');
            button.setAttribute('aria-label',`Explore ${place.name}`);button.title=place.name;
            const dot=document.createElement('span');dot.className='pin-core';button.append(dot);
            const label=document.createElement('span');label.className='pin-label';label.textContent=place.name;button.append(label);
            button.addEventListener('click',event=>{event.stopPropagation();if(latest.current.picking)latest.current.onPick(place.coordinates);else latest.current.onFocus(place.id);});
            return {id:place.id,button,marker:new gl.Marker({element:button,anchor:'center'}).setLngLat(place.coordinates).addTo(map)};
          });
          const start=document.createElement('div');start.className='origin-pin';start.title='Your chosen starting point';
          const mascot=document.createElement('img');
          mascot.src='/assets/ai%20mascot.png';mascot.alt='Milai — your chosen starting point';mascot.width=40;mascot.height=48;mascot.draggable=false;
          start.append(mascot);
          startMarker.current=new gl.Marker({element:start,anchor:'bottom'});
          setReady(true);
        });
        resize=new ResizeObserver(()=>map.resize());resize.observe(container.current);
      } catch {if(!disposed)setFailed(true);}
    })();
    return()=>{disposed=true;clearTimeout(timeout);resize?.disconnect();markers.current.forEach(m=>m.marker.remove());markers.current=[];startMarker.current?.remove();startMarker.current=null;mapRef.current?.remove();mapRef.current=null;};
  },[retry]);

  useEffect(()=>{
    if(!ready||!mapRef.current)return;
    const map=mapRef.current;
    const points=tripCoordinates(props.trip);
    const source=map.getSource('journey') as GeoJSONSource;
    source.setData({type:'FeatureCollection',features:journeyFeatures(points,props.route)});
    map.setPaintProperty('journey-line','line-dasharray',props.route?[1,0]:[2,2]);
    map.setPaintProperty('journey-casing','line-dasharray',props.route?[1,0]:[2,2]);
    for(const {id,button} of markers.current) {
      const index=props.trip.stopIds.indexOf(id);
      button.classList.toggle('is-chosen',index>=0);
      button.classList.toggle('is-focused',props.focused===id);
      button.setAttribute('aria-pressed',String(props.focused===id));
      button.style.setProperty('--leg-color',index>=0?routeColors[index%routeColors.length]:'');
      button.querySelector('.pin-core')!.textContent=index>=0?String(index+1):'';
    }
    if(props.trip.origin)startMarker.current?.setLngLat(props.trip.origin.coordinates).addTo(map);
    else startMarker.current?.remove();
  },[props.trip,props.route,props.focused,ready]);
  const originKey=props.trip.origin?.coordinates.join(',');
  useEffect(()=>{
    if(!ready||!mapRef.current||!props.trip.origin)return;
    mapRef.current.flyTo({center:props.trip.origin.coordinates,zoom:9.2,duration:reduced()?0:1200});
    // Camera follows explicit start changes, not every planner edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[originKey,ready]);
  useEffect(()=>{
    const place=places.find(p=>p.id===props.focused);
    if(ready&&place&&mapRef.current)mapRef.current.flyTo({center:place.coordinates,zoom:Math.max(mapRef.current.getZoom(),10.5),duration:reduced()?0:1000});
  },[props.focused,ready]);
  useEffect(()=>{if(mapRef.current)mapRef.current.getCanvas().style.cursor=props.picking?'crosshair':'';},[props.picking,ready]);
  const routeKey=props.trip.stopIds.join(',');
  useEffect(()=>{
    const points=tripCoordinates(latest.current.trip);
    if(!ready||!mapRef.current||points.length<2)return;
    const lng=points.map(p=>p[0]),lat=points.map(p=>p[1]);
    mapRef.current.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],{padding:{top:80,bottom:90,left:65,right:65},maxZoom:13,duration:reduced()?0:1100});
  },[routeKey,originKey,ready]);
  const nearbyKey=props.nearbyView?.key;
  useEffect(()=>{
    const view=latest.current.nearbyView;
    if(!ready||!mapRef.current||!view)return;
    mapRef.current.flyTo({center:view.coordinates,zoom:10,duration:reduced()?0:1000});
  },[nearbyKey,ready]);
  const selected=places.find(place=>place.id===props.focused);
  return <div className={`planner-map${props.picking?' is-picking':''}`}>
    <div ref={container} className="planner-map-canvas" aria-label="Map of Iraqi destinations" />
    {(props.picking||props.locationStatus)&&<div className={`planner-map-label${props.locationStatus?' is-locating':''}`} role="status">{props.picking?'Tap the map to set your start':props.locationStatus}</div>}
    {(!ready||failed)&&<div className="planner-map-fallback" role="status"><span>◇</span><p>{failed?'The map is unavailable. You can still choose a city and plan below.':'Unfolding Iraq…'}</p>{failed&&<button onClick={()=>setRetry(r=>r+1)}>Retry map</button>}</div>}
    {ready&&selected&&<article key={selected.id} className={`map-place-popup popup-${selected.category}`} role="dialog" aria-label={`${selected.name} place preview`}>
      <div className="map-popup-photo">
        {selected.image&&<img src={selected.image} alt={`View of ${selected.name}`} />}
        <span className="map-popup-photo-shade" aria-hidden="true" />
        <span className="map-popup-index" aria-hidden="true">{String(places.findIndex(place=>place.id===selected.id)+1).padStart(2,'0')}</span>
      </div>
      <div className="map-place-popup-copy">
        <button type="button" className="map-popup-close" aria-label="Close place preview" onClick={()=>props.onFocus(null)}>×</button>
        <span className={`map-popup-category pin-${selected.category}`}><i aria-hidden="true" />{selected.category}<b aria-hidden="true">/</b>{selected.region}</span>
        <h3><span className="map-popup-title-en">{selected.name}</span><span className="map-popup-title-ar" lang="ar">{selected.arabic}</span></h3>
        <span className="map-popup-title-rule" aria-hidden="true" />
        <p>{selected.brief}</p>
        <div className="map-popup-meta">
          <span className="map-popup-duration"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>{visitLabel(selected.visitMinutes)}</span>
          <a className="map-story-link" href={selected.source} target="_blank" rel="noreferrer"><span>Read the story</span><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 12h11"/><path d="m13 8 4 4-4 4"/></svg></i></a>
        </div>
        <button className="map-visit-details" onClick={()=>{const details=document.getElementById(`visit-details-${selected.id}`);if(details){(details as HTMLDetailsElement).open=true;details.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'center'});details.querySelector('summary')?.focus({preventScroll:true});}}}>Plan your visit <span aria-hidden="true">↓</span></button>
      </div>
    </article>}
    <button className="map-overview" aria-label="Show all Iraqi destinations" onClick={()=>mapRef.current?.fitBounds([[42.3,30.5],[47.5,37.5]],{padding:55,duration:reduced()?0:1000})}>↗ <span>All places</span></button>
  </div>;
}
