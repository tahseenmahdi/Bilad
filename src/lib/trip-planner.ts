import { origins, places, type Coordinates, type Origin, type Category, type Place } from './destinations.ts';

export type Trip = { origin: Origin | null; minutes: number; category: Category | 'all'; stopIds: string[]; roundTrip: boolean };
export const initialTrip: Trip = {origin:null, minutes:240, category:'all', stopIds:[], roundTrip:true};
export const MAX_STOPS = 6;
export const getPlace = (id: string) => places.find(place => place.id === id);
export const tripPlaces = (trip: Trip) => trip.stopIds.map(getPlace).filter((place): place is Place => !!place);
export type NearbyMode = 'start' | 'destination';
export function nearbyReference(trip: Trip, focused: string | null, mode: NearbyMode = 'start') {
  const destination = getPlace(focused ?? '') ?? tripPlaces(trip).at(-1);
  if (mode === 'destination' && destination) return {id:destination.id,name:destination.name,coordinates:destination.coordinates,kind:'destination' as const};
  return trip.origin ? {...trip.origin,kind:'start' as const} : null;
}
export function distanceKm(a: Coordinates, b: Coordinates) {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1]-a[1])*rad/2)**2 + Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1,h)));
}
export function nearestPlaces(point: Coordinates, category: Trip['category'] = 'all', exclude: string[] = []) {
  return places.filter(p => (category === 'all' || p.category === category) && !exclude.includes(p.id))
    .map(place => ({place, distance:distanceKm(point,place.coordinates)})).sort((a,b) => a.distance-b.distance);
}
export function tripCoordinates(trip: Trip): Coordinates[] {
  if (!trip.origin) return [];
  const stops = tripPlaces(trip);
  return [trip.origin.coordinates,...stops.map(p => p.coordinates),...(trip.roundTrip && stops.length ? [trip.origin.coordinates] : [])];
}
export function estimateTrip(trip: Trip) {
  const points = tripCoordinates(trip);
  const legs = points.slice(1).map((point,i) => {
    const km = distanceKm(points[i],point) * 1.4;
    return {km, minutes:Math.ceil(km/(km < 20 ? 25 : 50)*60)+5};
  });
  const visit = tripPlaces(trip).reduce((sum,p) => sum+p.visitMinutes,0);
  const travel = legs.reduce((sum,l) => sum+l.minutes,0);
  const buffer = trip.stopIds.length ? 20 : 0;
  return {legs,visit,travel,buffer,total:visit+travel+buffer,km:legs.reduce((sum,l)=>sum+l.km,0)};
}
export function buildDay(trip: Trip): string[] {
  if (!trip.origin) return [];
  const ids: string[] = [];
  let point = trip.origin.coordinates;
  while (ids.length < MAX_STOPS) {
    const next = nearestPlaces(point,trip.category,ids).find(({place}) => estimateTrip({...trip,stopIds:[...ids,place.id]}).total <= trip.minutes);
    if (!next) break;
    ids.push(next.place.id);
    point = next.place.coordinates;
  }
  return ids;
}
export function orderStops(trip: Trip): string[] {
  if (!trip.origin) return trip.stopIds;
  const remaining = tripPlaces(trip);
  const result: string[] = [];
  let point = trip.origin.coordinates;
  while(remaining.length) {
    remaining.sort((a,b) => distanceKm(point,a.coordinates)-distanceKm(point,b.coordinates));
    const next=remaining.shift()!;
    result.push(next.id); point=next.coordinates;
  }
  return [...result,...trip.stopIds.filter(id=>!getPlace(id))];
}
export function formatTime(minutes: number) {
  const rounded=Math.max(0,Math.round(minutes));
  return rounded < 60 ? `${rounded} min` : `${Math.floor(rounded/60)}h${rounded%60 ? ` ${rounded%60}m` : ''}`;
}
export function formatDistance(km: number) { return km < 1 ? `${Math.round(km*1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`; }
const normalize = (text: string) => text.toLowerCase().replace(/[-’']/g,' ').replace(/\s+/g,' ').trim();
const contains = (text: string, phrase: string) => (` ${text} `).includes(` ${normalize(phrase)} `);
export type MilaiReply = { trip: Trip; message: string; recommendations: string[]; changed: boolean };

// Deterministic demo commands. This module never sends prompts to a model/API.
export function applyMilaiCommand(input: string, current: Trip): MilaiReply {
  const text=normalize(input).replace(/[?!.,]/g,'');
  const result = (trip: Trip, message: string, recommendations: string[] = []): MilaiReply => ({trip,message,recommendations,changed:JSON.stringify(trip)!==JSON.stringify(current)});
  if (/\b(clear|reset|start over)\b/.test(text)) return result({...current,stopIds:[]},'Your plan is clear. Choose a place or ask me to build a new day.');
  const matches=places.filter(p => p.aliases.some(alias=>contains(text,alias)) || contains(text,p.name));
  if (/\b(remove|skip|drop)\b/.test(text)) {
    const ids=matches.map(p=>p.id);
    if (!ids.some(id=>current.stopIds.includes(id))) return result(current,'Name a stop in your plan to remove, for example “Remove Babylon”.');
    return result({...current,stopIds:current.stopIds.filter(id=>!ids.includes(id))},`Removed ${matches.filter(p=>current.stopIds.includes(p.id)).map(p=>p.name).join(' and ')}. Your route will update.`);
  }
  let trip: Trip={...current};
  const city=origins.find(o=>contains(text,o.name) && (!matches.length || new RegExp(`(?:from|in|start at|starting at) ${o.name.toLowerCase()}\\b`).test(text)));
  if (city) trip={...trip,origin:city};
  const time=text.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?)\b/);
  if (time) {
    const minutes=Number(time[1])*(time[2].startsWith('h')?60:1);
    if (minutes < 60 || minutes > 720) return result(current,'This day planner supports 1–12 hours. Try “Plan 4 hours in Baghdad”.');
    trip.minutes=Math.round(minutes);
  } else if (/\b(half a day|half day)\b/.test(text)) trip.minutes=240;
  else if (/\b(full day|all day)\b/.test(text)) trip.minutes=480;
  else if (/\bday\b/.test(text) && city) trip.minutes=480;
  else if (/\b(shorter|less time|shorten)\b/.test(text)) trip.minutes=Math.max(60,trip.minutes-60);
  else if (/\b(longer|more time)\b/.test(text)) trip.minutes=Math.min(720,trip.minutes+60);
  if (/\b(nature|waterfalls?|mountains?|lakes?)\b/.test(text)) trip.category='nature';
  else if (/\b(history|historical|ancient|heritage)\b/.test(text)) trip.category='history';
  else if (/\b(culture|cafes?|books?)\b/.test(text)) trip.category='culture';
  else if (/\b(mix|everything|all places)\b/.test(text)) trip.category='all';
  if (/\b(one way|no return)\b/.test(text)) trip.roundTrip=false;
  else if (/\b(round trip|return to start)\b/.test(text)) trip.roundTrip=true;
  if (!trip.origin) return result(trip,'Choose your starting city first, or tell me “Plan 4 hours in Baghdad”. You can also drop a pin on the map.');
  if (/\b(nearby|nearest|close by|around here|near me|near my start|near my destination)\b/.test(text) && !/\b(plan|build|add)\b/.test(text)) {
    const anchor=matches[0] ?? (/\b(destination|last stop)\b/.test(text)?tripPlaces(trip).at(-1):undefined);
    const near=nearestPlaces(anchor?.coordinates ?? trip.origin.coordinates,trip.category,anchor?[anchor.id]:trip.stopIds).slice(0,3);
    return result(trip,`Closest in our collection to ${anchor?.name ?? trip.origin.name}: ${near.map(x=>`${x.place.name} (${formatDistance(x.distance)} away)`).join(', ')}. These are straight-line distances; tap a place for its story.`,near.map(x=>x.place.id));
  }
  if (/\b(add|include|visit|go to)\b/.test(text) && matches.length) {
    const ids=[...new Set([...trip.stopIds,...matches.map(p=>p.id)])];
    if(ids.length>MAX_STOPS) return result(current,`Keep your day to ${MAX_STOPS} stops. Remove one before adding another.`);
    trip.stopIds=ids;
    const over=estimateTrip(trip).total>trip.minutes;
    return result(trip,`Added ${matches.map(p=>p.name).join(' and ')}.${over?' This may exceed your time. Check the route total or give yourself longer.':' Your route is updating.'}`,matches.map(p=>p.id));
  }
  if (/\b(optimi[sz]e|reorder|shortest)\b/.test(text)) return result({...trip,stopIds:orderStops(trip)},'Reordered your stops by proximity. Road travel times will refresh.');
  if (city || time || /\b(plan|build|suggest|explore|nature|history|historical|culture|less|shorter|shorten|longer|more time|full day|half day|one way|round trip)\b/.test(text)) {
    trip.stopIds=buildDay(trip);
    return result(trip,trip.stopIds.length?`I’ve put together ${trip.stopIds.length} ${trip.category==='all'?'nearby':trip.category} stop${trip.stopIds.length===1?'':'s'} from ${trip.origin.name} for your ${formatTime(trip.minutes)} day. Visits, travel and a 20-minute buffer are included in the estimate. Check the road total before heading out.`:`No ${trip.category==='all'?'places':trip.category+' places'} in this collection fit the estimated ${formatTime(trip.minutes)} ${trip.roundTrip?'round trip':'trip'} from ${trip.origin.name}. Try more time or another starting point.`,trip.stopIds);
  }
  if (matches.length) return result(trip,matches.map(p=>`${p.name}: ${p.brief} Allow about ${formatTime(p.visitMinutes)}.`).join(' '),matches.map(p=>p.id));
  return result(current,'Try “Plan 4 hours in Baghdad”, “Show nearby places”, “Add Babylon”, “Remove Babylon” or “Plan a nature day in Erbil”. I can update this demo plan using our curated places.');
}
