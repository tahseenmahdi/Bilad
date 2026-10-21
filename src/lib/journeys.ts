import { initialTrip, MAX_STOPS, type Trip } from './trip-planner.ts';
import { restoreTrip } from './trip-session.ts';

export const JOURNEYS_KEY = 'bilad.journeys.v1';
export const DRAFT_KEY = 'bilad.draft.v1';
export type JourneyStatus = 'idea' | 'planned' | 'done';
export type JourneyFields = { title: string; status: JourneyStatus; trip: Trip; travelDate: string; notes: string };
export type Journey = JourneyFields & { id: string; scope: 'day'; createdAt: string; updatedAt: string; completedAt: string | null; revision: string };
export type Collection = { version: 1; journeys: Journey[] };
export type Draft = JourneyFields & { journeyId: string | null; baseRevision: string | null; baseline: string };
export const uniqueId = () => globalThis.crypto.randomUUID();
export const emptyCollection = (): Collection => ({ version: 1, journeys: [] });
export function fingerprint(fields: JourneyFields) {
  const { origin, minutes, category, stopIds, roundTrip } = fields.trip;
  return JSON.stringify([fields.title, fields.status, [origin ? [origin.id, origin.name, origin.coordinates] : null, minutes, category, stopIds, roundTrip], fields.travelDate, fields.notes]);
}
export function newDraft(): Draft {
  const fields: JourneyFields = { title: 'Untitled day trip', status: 'idea', trip: { ...initialTrip, stopIds: [] }, travelDate: '', notes: '' };
  return { ...fields, journeyId: null, baseRevision: null, baseline: fingerprint(fields) };
}
export function draftFrom(journey: Journey): Draft {
  return { title: journey.title, status: journey.status, trip: journey.trip, travelDate: journey.travelDate, notes: journey.notes, journeyId: journey.id, baseRevision: journey.revision, baseline: fingerprint(journey) };
}
const dateTime = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
export const validTravelDate = (v: unknown): v is string => typeof v === 'string' && (v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v));
export function validateIntent(value: unknown): Trip | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Trip;
  const restored = restoreTrip(JSON.stringify(v));
  if (!restored || !Array.isArray(v.stopIds) || v.stopIds.length > MAX_STOPS || !v.stopIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 100)) return null;
  // Keep references to removed editorial records so a saved journey is never silently shortened.
  return { ...restored, stopIds: [...new Set(v.stopIds)] };
}
function validFields(v: JourneyFields, draft = false) {
  return !!v && typeof v.title === 'string' && (draft || v.title.trim().length > 0) && v.title.length <= 120 && ['idea', 'planned', 'done'].includes(v.status) && validTravelDate(v.travelDate) && typeof v.notes === 'string' && v.notes.length <= 5000 && !!validateIntent(v.trip);
}
export function readCollection(raw: string | null): Collection {
  if (raw === null) return emptyCollection();
  let value: Collection;
  try { value = JSON.parse(raw); } catch { throw new Error('Saved journey data could not be read. It has been kept unchanged.'); }
  if (!value || value.version !== 1 || !Array.isArray(value.journeys) || value.journeys.some(v => !v || !validFields(v) || v.scope !== 'day' || typeof v.id !== 'string' || !v.id || typeof v.revision !== 'string' || !v.revision || !dateTime(v.createdAt) || !dateTime(v.updatedAt) || (v.status === 'done' ? !dateTime(v.completedAt) : v.completedAt !== null)) || new Set(value.journeys.map(v => v.id)).size !== value.journeys.length) throw new Error('Saved journeys use invalid or unsupported data. The original data has been kept unchanged.');
  return { version: 1, journeys: value.journeys.map(v => ({ ...v, trip: validateIntent(v.trip)! })) };
}
export function readDraft(raw: string | null): Draft | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || v.version !== 1 || !validFields(v.draft, true) || typeof v.draft.baseline !== 'string' || !(v.draft.journeyId === null || typeof v.draft.journeyId === 'string') || !(v.draft.baseRevision === null || typeof v.draft.baseRevision === 'string')) return null;
    return { ...v.draft, trip: validateIntent(v.draft.trip)! };
  } catch { return null; }
}
export function makeJourney(fields: JourneyFields, previous?: Journey, now = new Date().toISOString()): Journey {
  if (!validFields(fields)) throw new Error('Please enter a title and valid day-trip settings before saving.');
  return { title: fields.title.trim(), status: fields.status, trip: structuredClone(fields.trip), travelDate: fields.travelDate, notes: fields.notes, id: previous?.id ?? uniqueId(), scope: 'day', createdAt: previous?.createdAt ?? now, updatedAt: now, revision: uniqueId(), completedAt: fields.status === 'done' ? previous?.completedAt ?? now : null };
}
export function duplicateJourney(source: Journey): Journey {
  return makeJourney({ title: `${source.title.slice(0, 111)} (copy)`, status: 'idea', trip: structuredClone(source.trip), travelDate: '', notes: source.notes });
}
export function putJourney(collection: Collection, journey: Journey, expected: string | null): Collection {
  const current = collection.journeys.find(j => j.id === journey.id);
  if ((current?.revision ?? null) !== expected) throw new Error('This journey changed in another tab. Your edits are still here. Save a new copy, or reopen the latest journey.');
  return { version: 1, journeys: [...collection.journeys.filter(j => j.id !== journey.id), journey] };
}
export function removeJourney(collection: Collection, journey: Journey): Collection {
  if (collection.journeys.find(j => j.id === journey.id)?.revision !== journey.revision) throw new Error('This journey changed in another tab. Review the latest version before deleting.');
  return { version: 1, journeys: collection.journeys.filter(j => j.id !== journey.id) };
}
export function writeCollection(storage: Pick<Storage, 'getItem' | 'setItem'>, mutate: (data: Collection) => Collection): Collection {
  const next = mutate(readCollection(storage.getItem(JOURNEYS_KEY)));
  storage.setItem(JOURNEYS_KEY, JSON.stringify(next));
  return next;
}
export function migrateItinerary(data: Collection, trip: Trip): { collection: Collection; journey: Journey } {
  // Deterministic import identity prevents a second import after an interrupted initialization.
  const id = `legacy-${fingerprint({ ...newDraft(), trip })}`;
  const existing = data.journeys.find(j => j.id === id);
  if (existing) return { collection: data, journey: existing };
  const journey = { ...makeJourney({ ...newDraft(), title: 'My first day with Bilad', trip: { ...trip, origin: trip.origin?.id === 'device' ? null : trip.origin } }), id };
  return { collection: putJourney(data, journey, null), journey };
}
