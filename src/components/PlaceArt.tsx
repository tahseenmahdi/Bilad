import type { Place } from '@/lib/destinations';

export default function PlaceArt({place}:{place:Place}) {
  return place.image?<img src={place.image} alt={place.name} loading="lazy" />:<div className={`place-art art-${place.category}`} aria-hidden="true"><svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="1.1">{place.category==='nature'?<><path d="M5 66 35 24 60 56 79 13 115 66M24 40l11 5 7-9M65 34l14 7 10-10M7 74c20-9 33 9 53 0s34 8 53 0M13 82h92"/><circle cx="20" cy="19" r="6"/></>:place.category==='culture'?<><path d="M22 65V28q20-8 38 3 18-11 38-3v37q-20-8-38 3-18-11-38-3ZM60 31v37M29 36l23 3M29 45l23 3M68 39l22-3M68 48l22-3M13 75h94"/></>:<><path d="M12 72h96M21 70V41h78v29M29 41V29h62v12M39 29V17h42v12M48 70V47h24v23M28 49h10M82 49h10M28 58h10M82 58h10"/><path d="M60 9v-6M8 29h10M102 29h10"/></>}</svg></div>;
}

