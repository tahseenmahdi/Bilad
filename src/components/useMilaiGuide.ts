'use client';
import { useEffect, useRef, useState } from 'react';
import { useJourneys } from './JourneyProvider';
import { applyGuideTripAction, completionAllowed, explicitIntent, guideNearby, guideRequestContext, isTripAction, isWriteAction, type GuideAction, type GuideRequest, type GuideResponse } from '@/lib/ai-guide';
import { assertGuideSnapshot, fetchGuide } from '@/lib/ai-guide-client';
import { type Trip } from '@/lib/trip-planner';

export type GuideView = { key: number; tool: 'nearby' | 'trip'; reference?: 'start' | 'destination'; fit?: boolean };
type Pending = { action: GuideAction; request: GuideRequest; snapshot: string; journeyRevision?: string; nextTrip?: Trip };
type Turn = { question: string; response: GuideResponse };

export function useMilaiGuide({ focused, onFocus, onMap }: { focused: string | null; onFocus: (id: string | null) => void; onMap?: () => void }) {
  const store = useJourneys();
  const [turns, setTurns] = useState<Turn[]>([]), [loading, setLoading] = useState(false), [applying, setApplying] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const [pending, setPending] = useState<Pending | null>(null), [lastQuestion, setLastQuestion] = useState('');
  const [previous, setPrevious] = useState<{ trip: Trip; after: string; journeyId: string | null } | null>(null);
  const [guideView, setGuideView] = useState<GuideView | undefined>();
  const latest = useRef({ store, focused, onFocus, onMap }); latest.current = { store, focused, onFocus, onMap };
  const requestController = useRef<AbortController | null>(null), inFlight = useRef(false), lastCall = useRef(0);
  const confirming = useRef(false);
  useEffect(() => () => { requestController.current?.abort(); }, []);

  function changeTrip(trip: Trip) {
    const current = latest.current.store;
    if (JSON.stringify(current.draft.trip) === JSON.stringify(trip)) return;
    setPrevious({ trip: current.draft.trip, after: JSON.stringify(trip), journeyId: current.draft.journeyId });
    current.setTrip(trip);
  }
  const snapshot = () => JSON.stringify(latest.current.store.draft);
  function showTrip(fit = false) { setGuideView({ key: Date.now(), tool: 'trip', fit }); }

  async function ask(question: string) {
    if (inFlight.current) return;
    if (Date.now() - lastCall.current < 2000) { setError('Please wait two seconds before asking again.'); return; }
    setLastQuestion(question); setError(''); setResult(''); setPending(null);
    const { store: current, focused } = latest.current;
    if (!current.ready) { setError('Your journey workspace is still loading. Please retry in a moment.'); return; }
    let request: GuideRequest;
    const expected = snapshot();
    let target;
    try {
      if (explicitIntent(question, 'complete')) {
        const named = current.collection.journeys.filter(j => question.toLowerCase().includes(j.title.toLowerCase()));
        if (named.length > 1) throw new Error('Several saved journeys match. Open the one you want in Your journeys, then ask to mark the current journey done.');
        target = named[0] ?? (/\b(my|current|active|this|the trip|the journey)\b|رحلتي|الحالية/iu.test(question) ? current.collection.journeys.find(j => j.id === current.draft.journeyId) : undefined);
      }
      request = { message: question, history: turns.flatMap(t => [{ role: 'user' as const, text: t.question.slice(0, 1000) }, { role: 'assistant' as const, text: t.response.reply.slice(0, 1000) }]).slice(-6), context: guideRequestContext(question, current.draft.trip, focused, target) };
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not prepare your trip context.'); return; }
    const controller = new AbortController(); requestController.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    inFlight.current = true; lastCall.current = Date.now(); setLoading(true);
    try {
      const response = await fetchGuide(request, process.env.NEXT_PUBLIC_BILAD_AI_API_URL, controller.signal);
      if (controller.signal.aborted) return;
      setTurns(t => [...t.slice(-4), { question, response }]);
      // Read-only answers remain useful, but no old response can change the current map/draft.
      if (response.actions.length) assertGuideSnapshot(expected, snapshot());
      const messages: string[] = [];
      for (const action of response.actions) {
        if (isWriteAction(action)) {
          const nextTrip = isTripAction(action) ? applyGuideTripAction(latest.current.store.draft.trip, action) : undefined;
          if (action.type === 'complete_journey') completionAllowed(request.context.journey, action, target?.id === current.draft.journeyId && current.dirty);
          setPending({ action, request, snapshot: expected, journeyRevision: target?.revision, nextTrip });
        } else if (action.type === 'focus_place') {
          latest.current.onFocus(action.placeId); latest.current.onMap?.();
          messages.push('Place selected on the map.');
        } else if (action.type === 'nearby') {
          const recommendations = guideNearby(request.context.trip, focused, action);
          setTurns(t => t.map((turn, i) => i === t.length - 1 ? { ...turn, response: { ...turn.response, placeIds: [...new Set([...turn.response.placeIds, ...recommendations])].slice(0, 6) } } : turn));
          if (action.placeId) latest.current.onFocus(action.placeId);
          setGuideView({ key: Date.now(), tool: 'nearby', reference: action.reference }); latest.current.onMap?.();
          messages.push('Nearby places shown using Bilad’s straight-line estimates.');
        } else if (action.type === 'recommend_service') {
          setTurns(t => t.map((turn, i) => i === t.length - 1 ? { ...turn, response: { ...turn.response, serviceIds: [...new Set([...turn.response.serviceIds, action.serviceId])].slice(0, 3) } } : turn));
        }
      }
      setResult(messages.join(' '));
    } catch (cause) {
      setPending(null);
      setError(controller.signal.aborted ? 'Milai timed out. Your trip is unchanged. Please retry.' : cause instanceof Error ? cause.message : 'Milai is unavailable. Check your connection and retry.');
    } finally { clearTimeout(timer); inFlight.current = false; setLoading(false); }
  }

  async function confirm() {
    if (!pending || confirming.current) return;
    confirming.current = true; setApplying(true);
    try {
      assertGuideSnapshot(pending.snapshot, snapshot());
      const { store: current } = latest.current;
      if (pending.nextTrip) {
        const next = applyGuideTripAction(current.draft.trip, pending.action);
        changeTrip(next); showTrip(pending.action.type === 'build_day');
        setResult('Itinerary updated. Use Undo to restore it. Road times will refresh on the map; check the route total before travelling.');
      } else if (pending.action.type === 'complete_journey') {
        const action = pending.action;
        const journey = current.collection.journeys.find(j => j.id === action.journeyId);
        if (!journey || journey.revision !== pending.journeyRevision) throw new Error('This journey changed in another tab. Reopen it and ask again.');
        completionAllowed(journey, action, journey.id === current.draft.journeyId && current.dirty);
        const ok = await current.transition(journey, 'done');
        if (!ok) throw new Error('The journey could not be completed. Review the journey error below and retry.');
        setResult(`“${journey.title}” marked done. You can undo the status change below.`);
      }
      setPending(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be applied.'); setPending(null); }
    finally { confirming.current = false; setApplying(false); }
  }
  function undoTrip() {
    if (!previous) return;
    const current = latest.current.store;
    if (previous.journeyId !== current.draft.journeyId || previous.after !== JSON.stringify(current.draft.trip)) { setError('The trip changed again. Undo is no longer available for that edit.'); return; }
    current.setTrip(previous.trip); setPrevious(null); setPending(null); setResult('Your previous plan is back.');
  }
  const canUndo = !!previous && previous.journeyId === store.draft.journeyId && previous.after === JSON.stringify(store.draft.trip);
  return { turns, loading, applying, error, result, pending, guideView, clearView: () => setGuideView(undefined), ask, confirm, cancel: () => { if (confirming.current) return; setPending(null); setResult('Proposal dismissed.'); }, retry: () => void ask(lastQuestion), lastQuestion, changeTrip, undoTrip, canUndo, store };
}
export type MilaiGuide = ReturnType<typeof useMilaiGuide>;
