'use client';
import { useRef, useState } from 'react';
import { useJourneys } from './JourneyProvider';
import { answerMilaiLocally } from '@/lib/milai-local';
import type { LocalGuideResponse } from '@/lib/milai-local';
import { askGeminiGuide } from '@/lib/gemini-guide';
import { applyGuideTripAction, isTripAction } from '@/lib/ai-guide';
import type { GuideAction, GuideResponse } from '@/lib/ai-guide';
import type { Trip } from '@/lib/trip-planner';

export type GuideView = { key: number; tool: 'nearby' | 'trip'; reference?: 'start' | 'destination'; fit?: boolean };
type Turn = { id: number; question: string; response: LocalGuideResponse };

export function useMilaiGuide({ onFocus, onMap }: { onFocus: (id: string | null) => void; onMap?: () => void }) {
  const store = useJourneys();
  const [turns, setTurns] = useState<Turn[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const messageSequence = useRef(0);
  const [previous, setPrevious] = useState<{ trip: Trip; after: string; journeyId: string | null } | null>(null);
  const [guideView, setGuideView] = useState<GuideView | undefined>();
  const latest = useRef({ store, onFocus, onMap }); latest.current = { store, onFocus, onMap };
  const inFlight = useRef(false);
  // Keep conversation history for multi-turn Gemini context
  const historyRef = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);

  function changeTrip(trip: Trip) {
    const current = latest.current.store;
    if (JSON.stringify(current.draft.trip) === JSON.stringify(trip)) return;
    setPrevious({ trip: current.draft.trip, after: JSON.stringify(trip), journeyId: current.draft.journeyId });
    current.setTrip(trip);
  }
  function showTrip(fit = false) { setGuideView({ key: Date.now(), tool: 'trip', fit }); }

  function handleGeminiActions(actions: GuideAction[], trip: Trip, question: string) {
    let updatedTrip = trip;
    let tripChanged = false;

    for (const action of actions) {
      switch (action.type) {
        case 'focus_place':
          latest.current.onFocus(action.placeId);
          break;
        case 'nearby':
          setGuideView({ key: Date.now(), tool: 'nearby', reference: action.reference });
          latest.current.onMap?.();
          break;
        case 'build_day':
        case 'add_stop':
        case 'remove_stop':
        case 'reorder_stops':
          try {
            updatedTrip = applyGuideTripAction(updatedTrip, action);
            tripChanged = true;
          } catch {
            // If the action fails validation, skip it silently
          }
          break;
        case 'save_trip':
          // Save is handled through the UI confirmation flow
          setResult('Milai suggests saving your trip. Use the save button when ready.');
          break;
        case 'recommend_service':
          // Services are shown via serviceIds in the response
          break;
        case 'complete_journey':
          // Completion is handled through the UI confirmation flow
          break;
      }
    }

    if (tripChanged) {
      changeTrip(updatedTrip);
      showTrip(/\b(plan|build)\b/i.test(question));
      setResult('Your trip was updated by Milai. Use Undo to restore it.');
    }
  }

  async function ask(question: string) {
    if (inFlight.current) return;
    const messageId = ++messageSequence.current;
    setLastMessageId(messageId);
    setLastQuestion(question); setError(''); setResult('');
    const { store: current } = latest.current;
    if (!current.ready) { setError('Your journey workspace is still loading. Please retry in a moment.'); return; }
    inFlight.current = true;
    setLoading(true);

    try {
      // Try Gemini API first
      const gemini = await askGeminiGuide(
        question,
        current.draft.trip,
        null, // focused place passed separately if needed
        historyRef.current,
        current.draft.journeyId ? { id: current.draft.journeyId, title: '', status: 'planned' } : undefined,
      );

      const response: LocalGuideResponse = {
        reply: gemini.response.reply,
        placeIds: gemini.response.placeIds,
        serviceIds: gemini.response.serviceIds,
      };

      setTurns(t => [...t.slice(-4), { id: messageId, question, response }]);

      // Update conversation history for multi-turn context
      historyRef.current = [
        ...historyRef.current.slice(-4),
        { role: 'user' as const, text: question },
        { role: 'assistant' as const, text: gemini.response.reply },
      ];

      // Handle any actions the AI proposed
      if (gemini.response.actions.length) {
        handleGeminiActions(gemini.response.actions, current.draft.trip, question);
      } else if (response.placeIds.length) {
        latest.current.onFocus(response.placeIds[0]);
        if (latest.current.onMap && question.toLowerCase().includes('map')) latest.current.onMap();
      }
    } catch {
      // Gemini failed — fall back to local regex-based guide
      console.warn('Gemini guide unavailable, falling back to local guide.');
      try {
        const local = answerMilaiLocally(question, current.draft.trip);
        setTurns(t => [...t.slice(-4), { id: messageId, question, response: local.response }]);
        if (local.changed) {
          changeTrip(local.trip);
          showTrip(/\b(plan|build)\b/i.test(question));
          setResult('Your trip was updated using Bilad\'s local guide. Use Undo to restore it.');
        } else if (local.openMap === 'nearby') {
          setGuideView({ key: Date.now(), tool: 'nearby', reference: /\b(destination|last stop)\b/i.test(question) ? 'destination' : 'start' });
          latest.current.onMap?.();
        } else if (local.response.placeIds.length) {
          latest.current.onFocus(local.response.placeIds[0]);
          if (latest.current.onMap && question.toLowerCase().includes('map')) latest.current.onMap();
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The guide could not answer this question.');
      }
    } finally { inFlight.current = false; setLoading(false); }
  }

  function undoTrip() {
    if (!previous) return;
    const current = latest.current.store;
    if (previous.journeyId !== current.draft.journeyId || previous.after !== JSON.stringify(current.draft.trip)) {
      setError('The trip changed again. Undo is no longer available for that edit.');
      return;
    }
    current.setTrip(previous.trip); setPrevious(null); setResult('Your previous plan is back.');
  }

  const canUndo = !!previous && previous.journeyId === store.draft.journeyId && previous.after === JSON.stringify(store.draft.trip);
  return { turns, loading, error, result, guideView, clearView: () => setGuideView(undefined), ask, retry: () => void ask(lastQuestion), lastQuestion, lastMessageId, changeTrip, undoTrip, canUndo, store };
}

export type MilaiGuide = ReturnType<typeof useMilaiGuide>;
