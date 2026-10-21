import { origins, places } from './destinations.ts';
import { serviceApps } from './services.ts';
import { buildDay, estimateTrip, getPlace, MAX_STOPS, nearbyReference, nearestPlaces, type Trip } from './trip-planner.ts';

// Shared by Express and the static client. Model output is data, never instructions.
export type GuideAction =
  | { type: 'focus_place'; placeId: string }
  | { type: 'nearby'; reference: 'start' | 'destination'; placeId?: string }
  | { type: 'build_day'; originId?: string; minutes?: number; category?: Trip['category']; roundTrip?: boolean }
  | { type: 'add_stop' | 'remove_stop'; placeId: string }
  | { type: 'reorder_stops'; stopIds: string[] }
  | { type: 'save_trip' }
  | { type: 'complete_journey'; journeyId: string }
  | { type: 'recommend_service'; serviceId: string };
export type GuideResponse = { reply: string; placeIds: string[]; serviceIds: string[]; actions: GuideAction[] };
export type GuideContext = {
  trip?: Trip;
  focusedPlaceId?: string;
  journey?: { id: string; title: string; status: 'idea' | 'planned' | 'done' };
};
export type GuideRequest = { message: string; history: { role: 'user' | 'assistant'; text: string }[]; context: GuideContext };
export const GUIDE_LIMITS = { message: 1000, history: 6, reply: 4000, actions: 4 } as const;
export const isTripAction = (a: GuideAction) => ['build_day', 'add_stop', 'remove_stop', 'reorder_stops'].includes(a.type);
export const isWriteAction = (a: GuideAction) => isTripAction(a) || a.type === 'save_trip' || a.type === 'complete_journey';
function fail(message: string): never { throw new Error(message); }
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail('Expected an object.');
function keys(v: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(v).some(k => !allowed.includes(k))) fail('Unknown field or action argument.');
}
function text(v: unknown, max: number): string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v : fail(`Expected non-empty text up to ${max} characters.`);
}
const knownPlace = (v: unknown) => typeof v === 'string' && !!getPlace(v) ? v : fail('Unknown place ID.');
const knownService = (v: unknown) => typeof v === 'string' && serviceApps.some(s => s.id === v) ? v : fail('Unknown service ID.');
function ids(v: unknown, max: number, check: (v: unknown) => string): string[] {
  if (!Array.isArray(v) || v.length > max) fail(`Expected at most ${max} IDs.`);
  const result = (v as unknown[]).map(check);
  if (new Set(result).size !== result.length) fail('Duplicate IDs are not allowed.');
  return result;
}
function minutes(v: unknown) { return Number.isInteger(v) && Number(v) >= 60 && Number(v) <= 720 ? Number(v) : fail('Time must be 60–720 whole minutes.'); }
function category(v: unknown): Trip['category'] { return ['all', 'history', 'nature', 'culture'].includes(String(v)) ? v as Trip['category'] : fail('Unknown category.'); }
function boolean(v: unknown): boolean { return typeof v === 'boolean' ? v : fail('Expected a boolean.'); }

export function validateGuideTrip(value: unknown): Trip {
  const v = object(value); keys(v, ['origin', 'minutes', 'category', 'stopIds', 'roundTrip']);
  let origin: Trip['origin'] = null;
  if (v.origin !== null) {
    const o = object(v.origin); keys(o, ['id', 'name', 'coordinates']);
    const city = origins.find(city => city.id === o.id);
    if (city) origin = city; // City coordinates always come from Bilad.
    else if (o.id === 'pin') {
      if (!Array.isArray(o.coordinates) || o.coordinates.length !== 2 || !o.coordinates.every(Number.isFinite) || Math.abs(o.coordinates[0]) > 180 || Math.abs(o.coordinates[1]) > 90) fail('Invalid map pin coordinates.');
      origin = { id: 'pin', name: 'Your map pin', coordinates: [...o.coordinates] as [number, number] };
    } else fail('Choose a known starting city or map pin.');
  }
  return { origin, minutes: minutes(v.minutes), category: category(v.category), stopIds: ids(v.stopIds, MAX_STOPS, knownPlace), roundTrip: boolean(v.roundTrip) };
}
export function validateGuideContext(value: unknown): GuideContext {
  const v = object(value); keys(v, ['trip', 'focusedPlaceId', 'journey']);
  const context: GuideContext = {};
  if (v.trip !== undefined) context.trip = validateGuideTrip(v.trip);
  if (v.focusedPlaceId !== undefined) context.focusedPlaceId = knownPlace(v.focusedPlaceId);
  if (v.journey !== undefined) {
    const j = object(v.journey); keys(j, ['id', 'title', 'status']);
    if (!['idea', 'planned', 'done'].includes(String(j.status))) fail('Invalid journey status.');
    context.journey = { id: text(j.id, 500), title: text(j.title, 120), status: j.status as 'idea' | 'planned' | 'done' };
  }
  return context;
}
export function validateGuideRequest(value: unknown): GuideRequest {
  const v = object(value); keys(v, ['message', 'history', 'context']);
  if (!Array.isArray(v.history) || v.history.length > GUIDE_LIMITS.history) fail('Chat history is limited to six messages.');
  const history = v.history.map(item => {
    const h = object(item); keys(h, ['role', 'text']);
    if (h.role !== 'user' && h.role !== 'assistant') fail('Unknown history role.');
    return { role: h.role as 'user' | 'assistant', text: text(h.text, 1000) };
  });
  return { message: text(v.message, GUIDE_LIMITS.message), history, context: validateGuideContext(v.context) };
}

// Conservative intent gate. Ambiguous/negated requests can still receive advice;
// the model cannot turn them into writes. Every proposed write also needs a UI click.
export function explicitIntent(message: string, kind: 'edit' | 'save' | 'complete') {
  message = message.replace(/[’‘]/g, "'");
  if (/\b(not|never|don't|dont|if|maybe|might|should|would|explain|how)\b|\bwithout (saving|storing|changing|editing|adding|removing|reordering|building|planning|completing|marking|finishing)\b|لا |ليس|كيف|ربما|إذا/iu.test(message)) return false;
  if (kind === 'save') return /\b(save|store)\b|احفظ|خزن/iu.test(message);
  if (kind === 'complete') return /\b(mark|complete|finish)\b|أكمل|اكمل|مكتملة/iu.test(message) && /\b(done|complete|completed|journey|trip|itinerary)\b|رحل|مكتملة/iu.test(message);
  return /\b(plan|build|add|include|remove|skip|reorder|move|arrange|change|set|shorten|extend)\b|خطط|أضف|اضف|احذف|رتب|غير/iu.test(message);
}
export function needsTripContext(message: string) {
  return explicitIntent(message, 'edit') || explicitIntent(message, 'save') || /\b(active|current|nearby|nearest|near|around|destination|last stop|this trip|(?:my|our|the) (?:trip|itinerary|plan|origin|start|route|journey|day))\b|رحلتي|بالقرب|قريب/iu.test(message);
}
export function validateGuideResponse(value: unknown, request: GuideRequest): GuideResponse {
  const v = object(value); keys(v, ['reply', 'placeIds', 'serviceIds', 'actions']);
  if (!Array.isArray(v.actions) || v.actions.length > GUIDE_LIMITS.actions) fail('Too many or malformed actions.');
  const actions = v.actions.map(value => {
    const a = object(value);
    switch (a.type) {
      case 'focus_place': case 'add_stop': case 'remove_stop':
        keys(a, ['type', 'placeId']); knownPlace(a.placeId); break;
      case 'nearby':
        keys(a, ['type', 'reference', 'placeId']);
        if (a.reference !== 'start' && a.reference !== 'destination') fail('Invalid nearby reference.');
        if (a.placeId !== undefined) { knownPlace(a.placeId); if (a.reference !== 'destination') fail('A named nearby place requires destination reference.'); }
        guideNearby(request.context.trip, request.context.focusedPlaceId ?? null, a as Extract<GuideAction, { type: 'nearby' }>);
        break;
      case 'build_day':
        keys(a, ['type', 'originId', 'minutes', 'category', 'roundTrip']);
        if (a.originId !== undefined && !origins.some(o => o.id === a.originId)) fail('Unknown origin ID.');
        if (a.minutes !== undefined) minutes(a.minutes);
        if (a.category !== undefined) category(a.category);
        if (a.roundTrip !== undefined) boolean(a.roundTrip);
        validateSettingsIntent(a as Extract<GuideAction, { type: 'build_day' }>, request);
        break;
      case 'reorder_stops': keys(a, ['type', 'stopIds']); ids(a.stopIds, MAX_STOPS, knownPlace); break;
      case 'save_trip': keys(a, ['type']); break;
      case 'complete_journey':
        keys(a, ['type', 'journeyId']);
        if (!request.context.journey || a.journeyId !== request.context.journey.id) fail('Identify an existing saved journey first.');
        break;
      case 'recommend_service': keys(a, ['type', 'serviceId']); knownService(a.serviceId); break;
      default: fail('Unknown or forbidden website action.');
    }
    const action = a as GuideAction;
    if (isTripAction(action) && !explicitIntent(request.message, 'edit')) fail('Itinerary edits require an explicit request.');
    if (action.type === 'save_trip' && !explicitIntent(request.message, 'save')) fail('Saving requires an explicit request.');
    if (action.type === 'complete_journey' && !explicitIntent(request.message, 'complete')) fail('Completion requires an explicit request.');
    if (action.type === 'complete_journey') completionAllowed(request.context.journey, action, false);
    if ((isTripAction(action) || action.type === 'save_trip') && !request.context.trip) fail('The active trip was not provided. Ask again with a trip request.');
    return action;
  });
  // One write per response avoids partial updates, edit/save races, and silent overwrites.
  if (actions.filter(isWriteAction).length > 1) fail('Only one write may be proposed at a time.');
  return { reply: text(v.reply, GUIDE_LIMITS.reply), placeIds: ids(v.placeIds, 6, knownPlace), serviceIds: ids(v.serviceIds, 3, knownService), actions };
}

function validateSettingsIntent(action: Extract<GuideAction, { type: 'build_day' }>, request: GuideRequest) {
  const current = request.context.trip, message = request.message.toLowerCase();
  if (!current) return;
  if (action.originId !== undefined && action.originId !== current.origin?.id) {
    const city = origins.find(o => o.id === action.originId);
    if (!city || !message.includes(city.name.toLowerCase())) fail('Changing the starting city requires naming it in your request.');
  }
  const time = message.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?)\b/);
  const requestedMinutes = time ? Number(time[1]) * (time[2].startsWith('h') ? 60 : 1) : null;
  if (requestedMinutes !== null) minutes(requestedMinutes);
  if (action.minutes !== undefined && action.minutes !== current.minutes) {
    if (requestedMinutes !== action.minutes) fail('Name the new time budget in hours or minutes before changing it.');
  }
  if (requestedMinutes !== null && action.minutes !== requestedMinutes && current.minutes !== requestedMinutes) fail('The proposal does not match your requested time budget.');
  if (action.category !== undefined && action.category !== current.category) {
    const words = { all: /\b(all|mix|everything|balanced)\b/, history: /\b(history|historical|historic|ancient|heritage)\b/, nature: /\b(nature|waterfalls?|mountains?|lakes?)\b/, culture: /\b(culture|cultural|books|cafes?)\b/ };
    if (!words[action.category].test(message)) fail('Changing category requires an explicit category request.');
  }
  if (action.roundTrip !== undefined && action.roundTrip !== current.roundTrip && !(action.roundTrip ? /round trip|return to (the )?start/ : /one way|no return|without return/).test(message)) fail('Changing return travel requires an explicit request.');
}

export function applyGuideTripAction(current: Trip, action: GuideAction): Trip {
  validateGuideTrip(current);
  let next = { ...current, stopIds: [...current.stopIds] };
  switch (action.type) {
    case 'build_day':
      next = { ...next, ...(action.originId !== undefined ? { origin: origins.find(o => o.id === action.originId) ?? fail('Unknown origin ID.') } : {}), ...(action.minutes !== undefined ? { minutes: minutes(action.minutes) } : {}), ...(action.category !== undefined ? { category: category(action.category) } : {}), ...(action.roundTrip !== undefined ? { roundTrip: boolean(action.roundTrip) } : {}) };
      if (!next.origin) fail('Choose a starting city or map pin before building a day.');
      next.stopIds = buildDay(next);
      if (!next.stopIds.length) fail('No stops fit this time and category. Try a longer day or another starting point.');
      break;
    case 'add_stop':
      knownPlace(action.placeId);
      if (next.stopIds.includes(action.placeId)) fail('This stop is already in your trip.');
      if (next.stopIds.length >= MAX_STOPS) fail(`Your day supports at most ${MAX_STOPS} stops. Remove one first.`);
      next.stopIds.push(action.placeId); break;
    case 'remove_stop':
      knownPlace(action.placeId);
      if (!next.stopIds.includes(action.placeId)) fail('That place is not a stop in your active trip.');
      next.stopIds = next.stopIds.filter(id => id !== action.placeId); break;
    case 'reorder_stops':
      ids(action.stopIds, MAX_STOPS, knownPlace);
      if (action.stopIds.length !== next.stopIds.length || action.stopIds.some(id => !next.stopIds.includes(id))) fail('Reordering must preserve every current stop.');
      next.stopIds = [...action.stopIds]; break;
    default: fail('This action cannot edit an itinerary.');
  }
  validateGuideTrip(next);
  if (action.type !== 'remove_stop' && (!next.origin || estimateTrip(next).total > next.minutes)) fail('This edit exceeds your estimated time, or needs a starting point. Adjust your settings first.');
  return next;
}

export function guideNearby(trip: Trip | undefined, focused: string | null, action: Extract<GuideAction, { type: 'nearby' }>) {
  if (action.placeId) knownPlace(action.placeId);
  const reference = nearbyReference(trip ?? { origin: null, minutes: 240, category: 'all', stopIds: [], roundTrip: true }, action.placeId ?? focused, action.reference);
  if (!reference) fail('Choose a starting area or select a destination to find nearby places.');
  return nearestPlaces(reference.coordinates, trip?.category ?? 'all', reference.kind === 'destination' ? [reference.id] : []).slice(0, 3).map(p => p.place.id);
}

// Only a deliberately selected saved record can be completed, never an invented one.
export function completionAllowed(journey: GuideContext['journey'], action: GuideAction, dirty: boolean) {
  if (action.type !== 'complete_journey' || !journey || action.journeyId !== journey.id) fail('Open the saved journey you want to complete first.');
  if (dirty) fail('Save your active changes before completing this journey.');
  if (journey.status !== 'planned') fail(journey.status === 'done' ? 'This journey is already done.' : 'Move this saved Idea to Planned in Your journeys before completing it.');
}

export function guideRequestContext(message: string, trip: Trip, focused: string | null, journey?: GuideContext['journey']): GuideContext {
  return {
    ...(!explicitIntent(message, 'complete') && needsTripContext(message) ? { trip: validateGuideTrip(trip) } : {}),
    ...(focused && /\b(this|selected|destination|nearby|it|here)\b|هذا|قريب/iu.test(message) ? { focusedPlaceId: knownPlace(focused) } : {}),
    ...(explicitIntent(message, 'complete') && journey ? { journey: { id: journey.id, title: journey.title, status: journey.status } } : {}),
  };
}

export const guidePlaceIndex = () => places.map(({ id, name, arabic, region, category }) => ({ id, name, arabic, region, category }));
