'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as GLMap, GeoJSONSource, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { places, type Coordinates } from '@/lib/destinations';
import { tripCoordinates, type Trip } from '@/lib/trip-planner';
import type { RoadRoute } from '@/lib/road-route';

type Props={trip:Trip;focused:string|null;route:RoadRoute|null;picking:boolean;onPick:(coordinates:Coordinates)=>void;onFocus:(id:string)=>void;nearbyView?:{key:string;coordinates:Coordinates}};
const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
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
          map.addLayer({id:'journey-line',type:'line',source:'journey',paint:{'line-color':'#83e6ff','line-width':2.5,'line-opacity':.95},layout:{'line-join':'round','line-cap':'round'}});
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
    source.setData(points.length>1?{type:'Feature',properties:{},geometry:props.route?.geometry??{type:'LineString',coordinates:points}}:{type:'FeatureCollection',features:[]});
    map.setPaintProperty('journey-line','line-dasharray',props.route?[1,0]:[2,2]);
    for(const {id,button} of markers.current) {
      const index=props.trip.stopIds.indexOf(id);
      button.classList.toggle('is-chosen',index>=0);
      button.classList.toggle('is-focused',props.focused===id);
      button.setAttribute('aria-pressed',String(props.focused===id));
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
  return <div className={`planner-map${props.picking?' is-picking':''}`}>
    <div ref={container} className="planner-map-canvas" aria-label="Map of Iraqi destinations" />
    {props.picking&&<div className="planner-map-label">Tap the map to set your start</div>}
    {(!ready||failed)&&<div className="planner-map-fallback" role="status"><span>◇</span><p>{failed?'The map is unavailable. You can still choose a city and plan below.':'Unfolding Iraq…'}</p>{failed&&<button onClick={()=>setRetry(r=>r+1)}>Retry map</button>}</div>}
    <button className="map-overview" aria-label="Show all Iraqi destinations" onClick={()=>mapRef.current?.fitBounds([[42.3,30.5],[47.5,37.5]],{padding:55,duration:reduced()?0:1000})}>↗ <span>All places</span></button>
  </div>;
}
