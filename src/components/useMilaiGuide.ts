'use client';
import { useRef, useState } from 'react';
import { useJourneys } from './JourneyProvider';
import { askGeminiGuide } from '@/lib/gemini-guide';
import { applyGuideTripAction, completionAllowed, isTripAction } from '@/lib/ai-guide';
import type { GuideAction, GuideResponse } from '@/lib/ai-guide';
import type { Trip } from '@/lib/trip-planner';
import { formatTime, getPlace } from '@/lib/trip-planner';

export type GuideView = { key: number; tool: 'nearby' | 'trip'; reference?: 'start' | 'destination'; fit?: boolean };
type Turn = { id: number; question: string; response: Pick<GuideResponse, 'reply' | 'placeIds' | 'serviceIds'> };
type Pending = { action: GuideAction; before: string; journeyId: string | null; revision: string | null; label: string };

export function useMilaiGuide({ onFocus, onMap, focused }: { onFocus: (id: string | null) => void; onMap?: () => void; focused: string | null }) {
  const store = useJourneys();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [previous, setPrevious] = useState<{ trip: Trip; after: string; journeyId: string | null } | null>(null);
  const [guideView, setGuideView] = useState<GuideView | undefined>();
  const messageSequence = useRef(0), viewSequence = useRef(0), inFlight = useRef(false);
  const historyRef = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const latest = useRef({ store, onFocus, onMap, focused }); latest.current = { store, onFocus, onMap, focused };

  function changeTrip(trip: Trip) {
    const current = latest.current.store;
    if (JSON.stringify(current.draft.trip) === JSON.stringify(trip)) return;
    setPrevious({ trip: current.draft.trip, after: JSON.stringify(trip), journeyId: current.draft.journeyId });
    current.setTrip(trip);
  }
  function showTrip(fit = false) { setGuideView({ key: ++viewSequence.current, tool: 'trip', fit }); latest.current.onMap?.(); }

  function proposalLabel(action: GuideAction, preview: Trip | null): string {
    switch (action.type) {
      case 'build_day': return `Create a ${formatTime(preview!.minutes)} route from ${preview!.origin!.name} with ${preview!.stopIds.map(id => getPlace(id)?.name).join(' → ')} and save it as a new Idea?`;
      case 'add_stop': return `Add ${getPlace(action.placeId)?.name} to your active route?`;
      case 'remove_stop': return `Remove ${getPlace(action.placeId)?.name} from your active route?`;
      case 'reorder_stops': return `Reorder your active route to ${preview!.stopIds.map(id => getPlace(id)?.name).join(' → ')}?`;
      case 'save_trip': return latest.current.store.draft.journeyId ? 'Save the changes to your open journey?' : 'Save your active trip as a new Idea?';
      case 'complete_journey': return 'Mark this saved journey Done?';
      default: return '';
    }
  }

  async function confirm() {
    if (!pending) return;
    const current = latest.current.store;
    if (pending.before !== JSON.stringify(current.draft.trip) || pending.journeyId !== current.draft.journeyId || pending.revision !== current.draft.baseRevision) {
      setPending(null); setError('Your trip changed since Milai proposed this action. Ask again using the current trip.'); return;
    }
    try {
      const action = pending.action;
      if (isTripAction(action)) {
        const trip = applyGuideTripAction(current.draft.trip, action);
        if (action.type === 'build_day') {
          if (current.draft.journeyId && current.dirty) throw new Error('Save your current journey changes before creating a new Idea, so they are not lost.');
          if (!await current.save(true, trip)) throw new Error('The Idea could not be saved. Review the journey error and retry.');
          setPrevious(null);
          setResult('Route created and saved as a new Idea. You can view it on the map or in Your journeys.');
        } else {
          changeTrip(trip);
          setResult('Your active route was updated. Use Undo to restore it. Save when you are ready.');
        }
        showTrip();
      } else if (action.type === 'save_trip') {
        if (!await current.save()) throw new Error('The trip could not be saved. Review the journey error and retry.');
        setResult('Your trip was saved.');
      } else if (action.type === 'complete_journey') {
        const journey = current.collection.journeys.find(j => j.id === action.journeyId);
        completionAllowed(journey && { id: journey.id, title: journey.title, status: journey.status }, action, current.dirty);
        if (!journey || current.draft.journeyId !== journey.id || current.draft.baseRevision !== journey.revision) throw new Error('Open the latest saved journey before marking it Done.');
        if (!await current.transition(journey, 'done')) throw new Error('The journey could not be completed. Review the journey error and retry.');
        setResult('Journey marked Done. You can undo this status change below.');
      }
      setPending(null); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Milai could not apply this action.'); }
  }

  async function ask(question: string) {
    question = question.trim();
    if (!question || inFlight.current) return;
    const messageId = ++messageSequence.current;
    setLastMessageId(messageId); setLastQuestion(question); setError(''); setResult(''); setPending(null);
    const { store: current, focused: selected } = latest.current;
    if (!current.ready) { setError('Your journey workspace is still loading. Please retry in a moment.'); return; }
    inFlight.current = true; setLoading(true);
    try {
      const journey = current.collection.journeys.find(j => j.id === current.draft.journeyId);
      const { response } = await askGeminiGuide(question, current.draft.trip, selected, historyRef.current, journey && { id: journey.id, title: journey.title, status: journey.status });
      const serviceIds = [...new Set([...response.serviceIds, ...response.actions.filter(a => a.type === 'recommend_service').map(a => a.serviceId)])];
      setTurns(t => [...t.slice(-7), { id: messageId, question, response: { reply: response.reply, placeIds: response.placeIds, serviceIds } }]);
      historyRef.current = [...historyRef.current.slice(-4), { role: 'user', text: question }, { role: 'assistant', text: response.reply }];
      for (const action of response.actions) {
        if (action.type === 'open_map') latest.current.onMap?.();
        else if (action.type === 'focus_place') { latest.current.onFocus(action.placeId); latest.current.onMap?.(); }
        else if (action.type === 'nearby') {
          if (action.placeId) latest.current.onFocus(action.placeId);
          setGuideView({ key: ++viewSequence.current, tool: 'nearby', reference: action.reference }); latest.current.onMap?.();
        } else if (isTripAction(action) || action.type === 'save_trip' || action.type === 'complete_journey') {
          const preview = isTripAction(action) ? applyGuideTripAction(current.draft.trip, action) : null;
          setPending({ action, before: JSON.stringify(current.draft.trip), journeyId: current.draft.journeyId, revision: current.draft.baseRevision, label: proposalLabel(action, preview) });
        }
      }
    } catch (cause) {
      setTurns(t => [...t.slice(-7), { id: messageId, question, response: { reply: 'I could not complete that request.', placeIds: [], serviceIds: [] } }]);
      setError(cause instanceof Error ? cause.message : 'Milai is unavailable. Please retry.');
    } finally { inFlight.current = false; setLoading(false); }
  }

  function undoTrip() {
    if (!previous) return;
    const current = latest.current.store;
    if (previous.journeyId !== current.draft.journeyId || previous.after !== JSON.stringify(current.draft.trip)) { setError('The trip changed again. Undo is no longer available for that edit.'); return; }
    current.setTrip(previous.trip); setPrevious(null); setResult('Your previous route is back.');
  }
  const canUndo = !!previous && previous.journeyId === store.draft.journeyId && previous.after === JSON.stringify(store.draft.trip);
  return { turns, loading, error, result, pending, confirm, cancel: () => setPending(null), guideView, clearView: () => setGuideView(undefined), ask, retry: () => void ask(lastQuestion), lastQuestion, lastMessageId, changeTrip, undoTrip, canUndo, store };
}

export type MilaiGuide = ReturnType<typeof useMilaiGuide>;
