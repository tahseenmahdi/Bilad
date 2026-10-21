import { places, type Place } from './destinations.ts';
import { MAX_STOPS, getPlace, type Trip } from './trip-planner.ts';

export const periods = {
  Ancient: 'Cities, temples and settlements from Mesopotamia and the ancient world.',
  Abbasid: 'Learning, brickwork and the cities of the Abbasid era.',
  Ottoman: 'Explore the late Ottoman urban fabric preserved at Erbil Citadel.',
  Modern: 'Living literary culture and the contemporary renewal of heritage.',
} as const;
export type Period = keyof typeof periods;
export const placePeriods: Record<string, Period[]> = {
  'mustansiriya':['Abbasid'], 'abbasid':['Abbasid'], 'samarra':['Abbasid'], 'ukhaidir':['Abbasid'],
  'aqar-quf':['Ancient'], 'ctesiphon':['Ancient'], 'babylon':['Ancient'], 'ur':['Ancient'], 'hatra':['Ancient'], 'ashur':['Ancient'],
  'erbil-citadel':['Ancient','Ottoman'], 'mutanabbi':['Modern'], 'al-nuri':['Modern'],
};
export const filters = ['All','Historical','Nature','Culture & museums','Food','Religious heritage'] as const;
export type Filter = typeof filters[number];
export const governorate = (p: Place) => ({'Al-Mada’in':'Baghdad',Samarra:'Salah al-Din',Mosul:'Nineveh',Rawanduz:'Erbil'}[p.region] ?? p.region);
const arabicRegions: Record<string,string> = {Baghdad:'بغداد',Babil:'بابل',Erbil:'أربيل اربيل هولير',Nineveh:'نينوى نينوه', 'Dhi Qar':'ذي قار',Duhok:'دهوك',Sulaymaniyah:'السليمانية','Salah al-Din':'صلاح الدين',Kirkuk:'كركوك',Karbala:'كربلاء',Najaf:'النجف'};
export const regions = [...new Set(places.map(governorate))].map(name=>({name,arabic:arabicRegions[name]??'',places:places.filter(p=>governorate(p)===name)}));
export const trails = [
  {id:'ancient',name:'Ancient Mesopotamia',intro:'A thematic thread through Sumerian, Babylonian and Assyrian city landscapes.',stops:['ur','babylon','ashur','hatra']},
  {id:'abbasid',name:'Abbasid Baghdad',intro:'Courtyards and seats of learning beside the Tigris.',stops:['mustansiriya','abbasid']},
  {id:'nature',name:'Nature of Kurdistan',intro:'Waterfalls, mountain views and the waters of Dukan.',stops:['gali-ali-beg','bekhal','korek','dukan']},
] as const;
export const normalizeSearch = (s:string) => s.toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/[’'\-]/g,' ').trim();
export function matchesSearch(p:Place,q:string) {
  return normalizeSearch([p.name,p.arabic,p.region,governorate(p),arabicRegions[governorate(p)],...p.aliases].join(' ')).includes(normalizeSearch(q));
}
export function matchesFilter(p:Place,f:Filter) {
  if(f==='Historical') return p.category==='history';
  if(f==='Nature') return p.category==='nature';
  if(f==='Culture & museums') return p.category==='culture';
  if(f==='Food') return p.id==='mutanabbi';
  if(f==='Religious heritage') return ['lalish','al-nuri','wadi-al-salam','imam-husayn'].includes(p.id);
  return true;
}
export function addJourneyStops(trip:Trip,ids:readonly string[]) {
  const unique=[...new Set(ids)].filter(id=>getPlace(id)&&!trip.stopIds.includes(id));
  const added=unique.slice(0,Math.max(0,MAX_STOPS-trip.stopIds.length));
  return {trip:{...trip,stopIds:[...trip.stopIds,...added]},added:added.length,skipped:unique.length-added.length};
}
