import type { Coordinates } from './destinations.ts';
export type RoadLeg = { minutes: number; km: number; instructions: string[] };
export type RoadRoute = { geometry: {type:'LineString';coordinates:Coordinates[]}; legs:RoadLeg[]; minutes:number; km:number };

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value>=0; }
export function parseRoadRoute(data: unknown, pointCount: number): RoadRoute {
  const body=data as {code?:string;waypoints?:{distance?:number}[];routes?:{duration:number;distance:number;geometry:RoadRoute['geometry'];legs:{duration:number;distance:number;steps?:{maneuver?:{instruction?:string}}[]}[]}[]};
  const route=body?.routes?.[0];
  if (body?.code!=='Ok' || !route || !finite(route.duration) || !finite(route.distance) || route.geometry?.type!=='LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length<2 || !Array.isArray(route.legs) || route.legs.length!==pointCount-1) throw new Error('No complete road route');
  if (!route.geometry.coordinates.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)) throw new Error('Invalid road geometry');
  if (!Array.isArray(body.waypoints) || body.waypoints.length!==pointCount || body.waypoints.some(w=>!finite(w.distance)||w.distance>1000)) throw new Error('A place is too far from a mapped road');
  if(route.legs.some(l=>!finite(l.duration)||!finite(l.distance))) throw new Error('Invalid travel time');
  return {geometry:route.geometry,minutes:route.duration/60,km:route.distance/1000,legs:route.legs.map(leg=>({minutes:leg.duration/60,km:leg.distance/1000,instructions:(leg.steps??[]).flatMap(step=>typeof step.maneuver?.instruction==='string'?[step.maneuver.instruction]:[])}))};
}
export async function fetchRoadRoute(points: Coordinates[], token: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RoadRoute> {
  if(points.length<2 || points.length>25) throw new Error('Invalid stop count');
  const query=new URLSearchParams({access_token:token,geometries:'geojson',overview:'full',steps:'true',radiuses:points.map(()=>'1000').join(';')});
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal.throwIfAborted(); signal.addEventListener('abort',abort,{once:true});
  const deadline=setTimeout(abort,12000);
  try {
    const response=await fetcher(`https://api.mapbox.com/directions/v5/mapbox/driving/${points.map(p=>p.join(',')).join(';')}?${query}`,{signal:controller.signal,credentials:'omit'});
    if(!response.ok) throw new Error('Road directions unavailable');
    const result=parseRoadRoute(await response.json(),points.length);
    signal.throwIfAborted();
    return result;
  } finally {clearTimeout(deadline);signal.removeEventListener('abort',abort);}
}
