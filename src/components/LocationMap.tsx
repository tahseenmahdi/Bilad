'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, GeolocateControl } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createResilientGeolocation } from '@/lib/geolocation';
import { getApproximateArea, type ApproximateArea } from '@/lib/approximate-area';

const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
type MapState = 'loading' | 'ready' | 'missing-token' | 'error';
type LocationState = 'idle' | 'locating' | 'retrying' | 'located' | 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'unsupported';

function LocateIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg>;
}

export default function LocationMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const geolocateRef = useRef<GeolocateControl | null>(null);
  const [mapState, setMapState] = useState<MapState>(token?.startsWith('pk.') ? 'loading' : 'missing-token');
  const [location, setLocation] = useState<LocationState>('idle');
  const [locationDetail, setLocationDetail] = useState('');
  const [approximateArea, setApproximateArea] = useState<ApproximateArea | null>(null);
  const [areaLoading, setAreaLoading] = useState(true);
  const preciseRequested = useRef(false);

  useEffect(() => {
    if (!token?.startsWith('pk.')) return;
    let disposed = false;
    let resize: ResizeObserver | undefined;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let disposeLocation: (() => void) | undefined;
    const areaRequest = new AbortController();
    let areaEstimate: ApproximateArea | null = null;
    let manuallyMoved = false;

    function showApproximateArea(map: MapboxMap, area: ApproximateArea) {
      if (manuallyMoved) return;
      map.flyTo({
        center: [area.longitude, area.latitude],
        zoom: area.zoom,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1600,
      });
    }

    async function initialize() {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (disposed || !container.current) return;
        if (!mapboxgl.supported()) { setMapState('error'); return; }
        const map = new mapboxgl.Map({
          container: container.current,
          accessToken: token,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [44.36, 33.31],
          zoom: 5.2,
          attributionControl: false,
          logoPosition: 'bottom-left',
          cooperativeGestures: true,
        });
        mapRef.current = map;
        map.on('movestart', event => { if (event.originalEvent) manuallyMoved = true; });
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        const locationProvider = navigator.geolocation ? createResilientGeolocation(navigator.geolocation, () => {
          if (!disposed) setLocation('retrying');
        }) : undefined;
        disposeLocation = locationProvider?.dispose;
        const geolocate = new mapboxgl.GeolocateControl({
          geolocation: locationProvider?.provider,
          showButton: false,
          positionOptions: { enableHighAccuracy: false, timeout: 35000, maximumAge: 300000 },
          trackUserLocation: false,
          showAccuracyCircle: true,
          showUserLocation: true,
          fitBoundsOptions: { maxZoom: 14, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200 },
        });
        geolocateRef.current = geolocate;
        map.addControl(geolocate, 'top-right');
        geolocate.on('geolocate', () => { if (!disposed) setLocation('located'); });
        geolocate.on('error', (event: { code?: number; message?: string }) => {
          if (process.env.NODE_ENV === 'development') console.warn('Bilad geolocation error', event.code, event.message);
          if (!disposed) {
            preciseRequested.current = false;
            setLocation(event.code === 1 ? 'denied' : event.code === 3 ? 'timeout' : 'unavailable');
            setLocationDetail(`Browser error ${event.code ?? 2}: ${event.message || 'Location provider unavailable.'}`);
            if (areaEstimate) showApproximateArea(map, areaEstimate);
          }
        });
        loadTimer = setTimeout(() => { if (!disposed) setMapState('error'); }, 20000);
        map.on('load', () => {
          if (disposed) return;
          clearTimeout(loadTimer);
          // Recolor vector layers while preserving labels and required attribution.
          for (const layer of map.getStyle().layers ?? []) {
            if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#07151e');
            if (layer.type === 'fill') {
              const color = layer.id.includes('water') ? '#0b3e54' : layer.id.includes('building') ? '#153344' : '#0d2532';
              map.setPaintProperty(layer.id, 'fill-color', color);
            }
            if (layer.type === 'line' && layer.id.includes('road')) map.setPaintProperty(layer.id, 'line-color', '#2a5265');
            if (layer.type === 'symbol' && layer.layout?.['text-field']) {
              map.setPaintProperty(layer.id, 'text-color', '#96b7c5');
              map.setPaintProperty(layer.id, 'text-halo-color', '#07151e');
            }
          }
          setMapState('ready');
          void getApproximateArea(areaRequest.signal).then(area => {
            if (disposed) return;
            areaEstimate = area;
            setApproximateArea(area);
            setAreaLoading(false);
            // An IP estimate must never replace a newer device location or
            // pull the camera away after the visitor starts browsing.
            if (!preciseRequested.current) showApproximateArea(map, area);
          }).catch(() => {
            if (!disposed) setAreaLoading(false);
          });
        });
        map.on('error', (event: { error: Error & { status?: number } }) => {
          if (!disposed && (event.error.status === 401 || event.error.status === 403)) {
            clearTimeout(loadTimer);
            setMapState('error');
          }
        });
        resize = new ResizeObserver(() => map.resize());
        resize.observe(container.current);
      } catch {
        if (!disposed) setMapState('error');
      }
    }
    void initialize();
    return () => {
      disposed = true;
      clearTimeout(loadTimer);
      resize?.disconnect();
      disposeLocation?.();
      areaRequest.abort();
      preciseRequested.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
      geolocateRef.current = null;
    };
  }, []);

  function locate() {
    setLocationDetail('');
    if (!window.isSecureContext) { setLocation('insecure'); return; }
    if (!navigator.geolocation) { setLocation('unsupported'); return; }
    preciseRequested.current = true;
    setLocation('locating');
    if (!geolocateRef.current?.trigger()) { preciseRequested.current = false; setLocation('unavailable'); }
  }

  const locationText = {
    idle: approximateArea ? `${approximateArea.label} · approximate area` : areaLoading ? 'Finding your approximate area…' : 'Browse Iraq. Area estimate unavailable.',
    locating: 'Finding your location…',
    retrying: 'Trying another location fix…',
    located: 'You are here.',
    denied: 'Location access is off. Allow it in your browser to find yourself.',
    unavailable: 'Your device’s location service couldn’t find a position.',
    timeout: 'Location took too long. Try again near a window or on Wi-Fi.',
    insecure: 'Location needs HTTPS or localhost. Open the site securely.',
    unsupported: 'This browser doesn’t provide location access.',
  }[location];
  const connected = mapState === 'ready';
  const showingApproximate = approximateArea && location !== 'located';

  return (
    <div className="location-map">
      <div ref={container} className="map-canvas" aria-label="Interactive map" />
      <div className="map-caption"><span className={`map-caption-dot${showingApproximate ? ' is-approximate' : ''}`} />{showingApproximate ? 'Approximate area' : 'Your map'}</div>
      {!connected && <div className="map-empty" role="status">
        <div className="map-empty-grid" aria-hidden="true" />
        <div className="map-empty-content">
          <span className={`map-empty-icon${mapState === 'loading' ? ' is-loading' : ''}`}><LocateIcon /></span>
          <h2>{mapState === 'loading' ? 'Opening your map…' : mapState === 'missing-token' ? 'A world waiting to open.' : 'The map couldn’t load.'}</h2>
          <p>{mapState === 'missing-token' ? 'Your live map will appear once Mapbox is connected.' : mapState === 'error' ? 'Check your connection and try opening the map again.' : 'Just a moment.'}</p>
        </div>
      </div>}
      {connected && <div className="map-location-bar">
        <div className="map-location-copy" role="status"><span className={location === 'located' ? 'location-live-dot' : showingApproximate ? 'location-approximate-dot' : 'location-idle-dot'} /><div><span>{locationText}</span>{showingApproximate && location !== 'idle' && <span className="location-estimate-note">Showing {approximateArea.label} · IP estimate</span>}{locationDetail && <details className="location-details"><summary>Location details</summary><p>{locationDetail}</p></details>}</div></div>
        <button type="button" className="locate-button" onClick={locate} disabled={location === 'locating' || location === 'retrying'}><LocateIcon />{location === 'located' ? 'Recenter' : location === 'locating' || location === 'retrying' ? 'Locating…' : 'Use my location'}</button>
      </div>}
    </div>
  );
}
