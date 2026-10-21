import { initialTrip, MAX_STOPS, getPlace, type Trip } from './trip-planner.ts';

export const TRIP_SESSION_KEY = 'bilad.trip.v1';

// Stored plans are tab-local; validate them before they reach routing or the map.
export function restoreTrip(raw: string | null): Trip | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !Array.isArray(value.stopIds)) return null;
    let origin: Trip['origin'] = null;
    const item = value.origin;
    if (item !== null) {
      if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || !item.name.trim() || !Array.isArray(item.coordinates) || item.coordinates.length !== 2) return null;
      const [longitude, latitude] = item.coordinates;
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
      origin = { id: item.id.slice(0, 100), name: item.name.slice(0, 100), coordinates: [longitude, latitude] };
    }
    const category: Trip['category'] = ['all', 'history', 'nature', 'culture'].includes(value.category) ? value.category : initialTrip.category;
    const minutes = Number.isFinite(value.minutes) && value.minutes >= 60 && value.minutes <= 720 ? Math.round(value.minutes) : initialTrip.minutes;
    const stopIds = [...new Set<string>(value.stopIds.filter((id: unknown): id is string => typeof id === 'string' && !!getPlace(id)))].slice(0, MAX_STOPS);
    return { origin, category, minutes, stopIds, roundTrip: typeof value.roundTrip === 'boolean' ? value.roundTrip : initialTrip.roundTrip };
  } catch { return null; }
}
