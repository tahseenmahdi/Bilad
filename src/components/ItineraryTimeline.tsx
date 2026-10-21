import type { Place } from '@/lib/destinations';
import { formatTime, formatDistance } from '@/lib/trip-planner';
import PlaceArt from './PlaceArt';
import DestinationVisitInfo from './DestinationVisitInfo';

type Props = {
  stops: Place[];
  originName?: string;
  legs: { minutes: number; km: number }[];
  road: boolean;
  roundTrip: boolean;
  onFocus: (id: string) => void;
  onMove: (index: number, offset: number) => void;
  onToggle: (place: Place) => void;
};

export default function ItineraryTimeline({ stops, originName, legs, road, roundTrip, onFocus, onMove, onToggle }: Props) {
  return (<ol className="itinerary-list photo-itinerary">
              <li className="itinerary-start"><span className="timeline-dot">S</span><div><small>START HERE</small><strong>{originName}</strong></div></li>
              {stops.map((place,i)=>{const leg=legs[i];return <li key={place.id} className="itinerary-destination">
                <button className="itinerary-photo" aria-label={`Explore ${place.name}`} onClick={()=>onFocus(place.id)}>
                  <PlaceArt place={place}/><span className="itinerary-photo-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
                </button>
                <div className="itinerary-destination-body">
                  <div className="itinerary-stop-copy"><small className="itinerary-drive"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m5 10 2-5h10l2 5M5 10h14v8H5zM8 18v2m8-2v2M8 13h1m6 0h1"/></svg>{road?'Drive':'Est. drive'} {formatTime(leg?.minutes??0)} · {formatDistance(leg?.km??0)}</small><button className="stop-name" onClick={()=>onFocus(place.id)}>{place.name}</button><span className="itinerary-place-region">{place.region} <span aria-hidden="true">·</span> {formatTime(place.visitMinutes)} to explore</span></div>
                  <div className="stop-controls"><button aria-label={`Move ${place.name} earlier`} disabled={i===0} onClick={()=>onMove(i,-1)}>↑</button><button aria-label={`Move ${place.name} later`} disabled={i===stops.length-1} onClick={()=>onMove(i,1)}>↓</button><button aria-label={`Remove ${place.name} from plan`} onClick={()=>onToggle(place)}>×</button></div>
                </div>
                <DestinationVisitInfo placeId={place.id} placeName={place.name}/>
              </li>;})}
              {roundTrip&&<li className="itinerary-return"><span className="timeline-dot">↩</span><div><small>{road?'DRIVE':'EST. DRIVE'} {formatTime(legs.at(-1)?.minutes??0)}</small><strong>Back to {originName}</strong></div></li>}
            </ol>);
}

