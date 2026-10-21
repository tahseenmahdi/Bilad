'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as GLMap, GeoJSONSource, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Place, Coordinates } from '@/lib/destinations';
import { tripCoordinates, type Trip } from '@/lib/trip-planner';
import type { RoadRoute } from '@/lib/road-route';

export type AtlasView = { key: number; points: Coordinates[] };
type Props = { places: Place[]; selected: string | null; trail: Place[]; view: AtlasView | null; onSelect: (id: string) => void; onFailure: () => void; trip:Trip; road:RoadRoute|null; picking:boolean; onPick:(coordinates:Coordinates)=>void };
type AtlasFeature = { geometry: { type: string; coordinates: Coordinates }; properties: { id?: string; cluster_id?: number; point_count?: number } };
type PhotoMarker = { marker: Marker; button: HTMLButtonElement; ids: string[] };
const emptyCollection = { type: 'FeatureCollection' as const, features: [] };
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function photo(place: Place) {
  const frame = document.createElement('span');
  frame.className = 'atlas-pin-photo';
  frame.setAttribute('aria-hidden', 'true');
  frame.textContent = place.name.slice(0, 1);
  if (place.image) {
    const image = document.createElement('img');
    image.src = place.image; image.alt = ''; image.draggable = false;
    image.addEventListener('error', () => image.remove(), { once: true });
    frame.append(image);
  }
  return frame;
}

export default function ExploreMap(props: Props) {
  const container = useRef<HTMLDivElement>(null), mapRef = useRef<GLMap | null>(null), latest = useRef(props);
  const resetMarkers = useRef<() => void>(() => {});
  const originMarker = useRef<Marker|null>(null);
  latest.current = props;
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout>, observer: ResizeObserver | undefined;
    let generation = 0;
    const markers = new Map<string, PhotoMarker>();
    const pending = new Set<string>();
    let visible = new Set<string>();
    const clearMarkers = () => {
      generation++;
      for (const entry of markers.values()) entry.marker.remove();
      markers.clear(); pending.clear(); visible.clear();
    };
    resetMarkers.current = clearMarkers;
    const fail = () => { if (!disposed) { setFailed(true); latest.current.onFailure(); } };
    setFailed(false); setReady(false);
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
    if (!token?.startsWith('pk.')) { fail(); return; }
    void (async () => {
      try {
        const gl = (await import('mapbox-gl')).default;
        if (disposed || !container.current) return;
        if (!gl.supported()) throw new Error('WebGL unavailable');
        const map = new gl.Map({ container: container.current, accessToken: token, style: 'mapbox://styles/mapbox/dark-v11', center: [43.8, 33.5], zoom: 5.6, attributionControl: false });
        mapRef.current = map;
        map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
        map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click',event=>{if(latest.current.picking)latest.current.onPick([Number(event.lngLat.lng.toFixed(5)),Number(event.lngLat.lat.toFixed(5))]);});
        timer = setTimeout(fail, 20000);
        map.on('error', e => { if ([401, 403].includes((e.error as Error & { status?: number }).status ?? 0)) fail(); });
        map.on('load', () => {
          if (disposed) return;
          clearTimeout(timer); setFailed(false);
          for (const layer of map.getStyle().layers ?? []) {
            const id = layer.id;
            if (layer.type === 'background') map.setPaintProperty(id, 'background-color', '#21536c');
            if (layer.type === 'fill') {
              const color = id.includes('water') ? '#1384aa' : id.includes('building') ? '#498497' : id.includes('park') ? '#3b8587' : id.includes('landuse') || id.includes('landcover') ? '#316a7c' : '#285c74';
              map.setPaintProperty(id, 'fill-color', color);
            }
            if (layer.type === 'line') {
              if (id.includes('admin') && id.includes('boundary')) {
                const backdrop = id.endsWith('-bg');
                map.setPaintProperty(id, 'line-color', backdrop ? '#214d65' : id.includes('admin-0') ? '#f1bdab' : '#9acddc');
                map.setPaintProperty(id, 'line-opacity', backdrop ? .65 : id.includes('admin-0') ? .8 : .38);
              } else if (id.includes('road')) {
                map.setPaintProperty(id, 'line-color', id.includes('motorway') || id.includes('trunk') ? '#bddbcf' : id.includes('case') ? '#28586c' : '#79aab9');
                map.setPaintProperty(id, 'line-opacity', id.includes('case') ? .6 : .55);
              } else if (id.includes('water')) {
                map.setPaintProperty(id, 'line-color', '#55c3dc');
              }
            }
            if (layer.type === 'symbol' && layer.layout?.['text-field']) {
              const country = id.includes('country'), water = id.includes('water');
              map.setPaintProperty(id, 'text-color', country ? '#f7d3be' : water ? '#b9eaf6' : id.includes('settlement') ? '#f0f7f4' : '#d1e9ed');
              map.setPaintProperty(id, 'text-halo-color', '#24546b');
              map.setPaintProperty(id, 'text-halo-width', country ? 1.5 : 1.2);
              map.setPaintProperty(id, 'text-opacity', 1);
            }
            if (layer.type === 'symbol' && (layer.id.includes('poi') || layer.id.includes('transit'))) map.setLayoutProperty(layer.id, 'visibility', 'none');
          }
          // Frozen Natural Earth geography gives Iraq a clear national silhouette.
          const firstLine = map.getStyle().layers?.find(layer => layer.type === 'line')?.id;
          const firstLabel = map.getStyle().layers?.find(layer => layer.type === 'symbol')?.id;
          map.addSource('iraq-outline', { type: 'geojson', data: '/data/iraq.geojson' });
          map.addLayer({ id: 'iraq-wash', type: 'fill', source: 'iraq-outline', paint: { 'fill-color': '#65c9d6', 'fill-opacity': .09 } }, firstLine);
          map.addLayer({ id: 'iraq-border', type: 'line', source: 'iraq-outline', paint: { 'line-color': '#f6c1ab', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.8, 8, 2.5], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, .95, 10, .35] } }, firstLabel);
          map.addSource('atlas', { type: 'geojson', cluster: true, clusterMaxZoom: 14, clusterRadius: 48, data: emptyCollection });
          // An invisible layer keeps source tiles available for the HTML marker pool.
          map.addLayer({ id: 'atlas-anchor', source: 'atlas', type: 'circle', paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
          map.addSource('thread', { type: 'geojson', data: emptyCollection });
          map.addLayer({ id: 'thread', source: 'thread', type: 'line', paint: { 'line-color': '#f3ad98', 'line-width': 2, 'line-dasharray': [3, 3] } });
          map.addSource('active-day', { type:'geojson', data:emptyCollection });
          map.addLayer({id:'active-day-casing',source:'active-day',type:'line',paint:{'line-color':'#19465b','line-width':7}});
          map.addLayer({id:'active-day-line',source:'active-day',type:'line',paint:{'line-color':'#93f3ed','line-width':3,'line-dasharray':[2,2]}});
          const originElement=document.createElement('div');originElement.className='atlas-origin';originElement.textContent='S';originElement.setAttribute('aria-label','Trip starting point');
          originMarker.current=new gl.Marker({element:originElement});

          function makeMarker(key: string, coordinates: Coordinates, members: Place[], clusterId?: number) {
            const root = document.createElement('div'); root.className = 'atlas-marker'; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Destination photos');
            const button = document.createElement('button'); button.type = 'button';
            const group = clusterId !== undefined;
            button.className = `atlas-photo-pin${group ? ' is-group' : ''}`;
            const names = members.map(p => p.name);
            button.setAttribute('aria-label', group ? `Explore ${members.length} nearby places: ${names.slice(0, 3).join(', ')}${members.length > 3 ? ' and more' : ''}` : `Discover ${names[0]}`);
            button.title = group ? `${members.length} nearby places · zoom in to explore` : names[0];
            const stack = document.createElement('span'); stack.className = 'atlas-pin-stack';
            members.slice(0, 3).forEach(p => stack.append(photo(p))); button.append(stack);
            if (group) {
              const count = document.createElement('span'); count.className = 'atlas-pin-count'; count.textContent = String(members.length); button.append(count);
            }
            const label = document.createElement('span'); label.className = 'atlas-pin-label';
            label.textContent = group ? `${members.length} places to discover` : members[0].name; button.append(label);
            button.addEventListener('click', event => {
              event.stopPropagation();
              if(latest.current.picking){latest.current.onPick(coordinates);return;}
              if (!group) { latest.current.onSelect(members[0].id); return; }
              const source = map.getSource('atlas') as GeoJSONSource;
              source.getClusterExpansionZoom(clusterId!, (error, zoom) => {
                if (error || disposed) return;
                if (event.detail === 0) map.once('idle', () => {
                  if (disposed) return;
                  const next = [...markers.entries()].find(([key, entry]) => visible.has(key) && entry.ids.some(id => members.some(p => p.id === id)));
                  next?.[1].button.focus({ preventScroll: true });
                });
                map.easeTo({ center: coordinates, zoom: Math.max(map.getZoom() + 1, zoom ?? 12), padding: { top: 0, bottom: 0, left: 0, right: 0 }, offset: window.innerWidth < 700 ? [0, -65] : [120, 0], duration: reduced() ? 0 : 650 });
              });
            });
            root.append(button);
            const entry = { marker: new gl.Marker({ element: root, anchor: 'bottom' }).setLngLat(coordinates), button, ids: members.map(p => p.id) };
            markers.set(key, entry);
            return entry;
          }
          function updateMarkers() {
            if (disposed || !map.isSourceLoaded('atlas')) return;
            const next = new Set<string>();
            const features = map.querySourceFeatures('atlas') as unknown as AtlasFeature[];
            const lookup = new Map(latest.current.places.map(p => [p.id, p]));
            for (const feature of features) {
              if (feature.geometry.type !== 'Point') continue;
              const { id, cluster_id: clusterId } = feature.properties;
              const key = clusterId === undefined ? `place:${id}` : `cluster:${clusterId}`;
              if (next.has(key)) continue;
              next.add(key);
              let entry = markers.get(key);
              if (!entry && clusterId !== undefined && !pending.has(key)) {
                pending.add(key);
                const version = generation;
                (map.getSource('atlas') as GeoJSONSource).getClusterLeaves(clusterId, latest.current.places.length, 0, (error, leaves) => {
                  if (disposed || generation !== version) return;
                  pending.delete(key);
                  if (error || !leaves) return;
                  const members = (leaves as unknown as AtlasFeature[]).map(f => lookup.get(f.properties.id ?? '')).filter((p): p is Place => !!p);
                  if (!members.length) return;
                  const created = makeMarker(key, feature.geometry.coordinates, members, clusterId);
                  if (visible.has(key)) created.marker.addTo(map);
                  map.triggerRepaint();
                });
              } else if (!entry && clusterId === undefined && id && lookup.has(id)) {
                entry = makeMarker(key, feature.geometry.coordinates, [lookup.get(id)!]);
              }
              if (entry) {
                const active = entry.ids.includes(latest.current.selected ?? '');
                entry.button.classList.toggle('is-selected', active);
                entry.button.setAttribute('aria-pressed', String(active));
                entry.marker.getElement().classList.toggle('is-active', active);
                if (!visible.has(key)) entry.marker.addTo(map);
              }
            }
            for (const key of visible) if (!next.has(key)) markers.get(key)?.marker.remove();
            visible = next;
          }
          map.on('render', updateMarkers);
          setReady(true);
        });
        let mobile = window.innerWidth < 700;
        observer = new ResizeObserver(() => {
          map.resize();
          const nextMobile = window.innerWidth < 700;
          if (nextMobile !== mobile) {
            mobile = nextMobile;
            const selected = latest.current.places.find(p => p.id === latest.current.selected);
            if (selected) map.easeTo({ center: selected.coordinates, offset: mobile ? [0, -90] : [180, 0], padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 });
          }
        }); observer.observe(container.current);
      } catch { fail(); }
    })();
    return () => { disposed = true; clearTimeout(timer); observer?.disconnect(); clearMarkers(); originMarker.current?.remove(); originMarker.current=null; resetMarkers.current = () => {}; mapRef.current?.remove(); mapRef.current = null; };
  }, [retry]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    resetMarkers.current();
    (map.getSource('atlas') as GeoJSONSource).setData({ type: 'FeatureCollection', features: props.places.map(p => ({ type: 'Feature', properties: { id: p.id }, geometry: { type: 'Point', coordinates: p.coordinates } })) });
  }, [props.places, ready]);
  useEffect(() => { if (ready) mapRef.current?.triggerRepaint(); }, [props.selected, ready]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const points=tripCoordinates(props.trip);
    const geometry=props.road?.geometry??{type:'LineString' as const,coordinates:points};
    (map.getSource('active-day') as GeoJSONSource).setData({type:'FeatureCollection',features:points.length>1?[{type:'Feature',properties:{},geometry}]:[]});
    map.setPaintProperty('active-day-line','line-dasharray',props.road?[1,0]:[2,2]);
    if(props.trip.origin)originMarker.current?.setLngLat(props.trip.origin.coordinates).addTo(map);else originMarker.current?.remove();
  },[props.trip,props.road,ready]);
  useEffect(()=>{if(mapRef.current)mapRef.current.getCanvas().style.cursor=props.picking?'crosshair':'';},[props.picking,ready]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    (map.getSource('thread') as GeoJSONSource).setData({ type: 'FeatureCollection', features: props.trail.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: props.trail.map(p => p.coordinates) } }] : [] });
  }, [props.trail, ready]);
  useEffect(() => {
    const map = mapRef.current, points = props.view?.points; if (!ready || !map || !points?.length) return;
    const duration = reduced() ? 0 : 700;
    if (points.length === 1) map.flyTo({ center: points[0], zoom: 15, padding: { top: 0, bottom: 0, left: 0, right: 0 }, offset: window.innerWidth < 700 ? [0, -90] : [180, 0], duration });
    else {
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      const mobilePadding=props.view?.key===0?{top:190,bottom:180,left:30,right:30}:{ top: Math.min(255, window.innerHeight * .32), bottom: Math.min(window.innerHeight * .46 + 90, window.innerHeight * .68 - 90), left: 65, right: 65 };
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: window.innerWidth < 700 ? mobilePadding : { top: 150, bottom: 100, left: 445, right: 100 }, retainPadding: false, maxZoom: 13, duration });
    }
  }, [props.view, ready]);
  return <><div ref={container} className="atlas-canvas" aria-label="Bap map. Use the Places list for keyboard access to every destination." />{(!ready || failed) && <div className="atlas-map-status" role="status"><img src="/assets/iraq-outline.svg" alt="Outline of Iraq" /><p>{failed ? 'Map unavailable. Explore the collection in the list.' : 'Unfolding Iraq…'}</p>{failed && <button onClick={() => setRetry(n => n + 1)}>Retry map</button>}</div>}</>;
}
