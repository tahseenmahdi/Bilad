'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { DRAFT_KEY, JOURNEYS_KEY, draftFrom, duplicateJourney, emptyCollection, fingerprint, makeJourney, migrateItinerary, newDraft, putJourney, readCollection, readDraft, removeJourney, writeCollection, type Collection, type Draft, type Journey, type JourneyFields, type JourneyStatus } from '@/lib/journeys';
import { restoreTrip, TRIP_SESSION_KEY } from '@/lib/trip-session';
import type { Trip } from '@/lib/trip-planner';
import './journeys.css';

type JourneyContext = {
  ready: boolean; collection: Collection; draft: Draft; dirty: boolean; feedback: string; error: string;
  setTrip: (value: SetStateAction<Trip>) => void; edit: (fields: Partial<JourneyFields>) => void;
  save: (asCopy?: boolean, plannedTrip?: Trip) => Promise<boolean>; open: (journey: Journey) => Promise<boolean>; create: () => Promise<boolean>;
  transition: (journey: Journey, status: JourneyStatus) => Promise<boolean>; duplicate: (journey: Journey) => Promise<void>; remove: (journey: Journey) => Promise<void>; undo: (() => Promise<void>) | null;
};
const Context = createContext<JourneyContext | null>(null);
export const useJourneys = () => { const value = useContext(Context); if (!value) throw new Error('JourneyProvider is missing'); return value; };
const storageMessage = (cause: unknown) => cause instanceof Error && !['QuotaExceededError', 'SecurityError'].includes(cause.name) ? cause.message : 'Device storage is unavailable or full. Your edits are still here, but have not been saved. Free some space or enable site storage and try again.';

export default function JourneyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false), [collection, setCollection] = useState<Collection>(emptyCollection), [draft, setDraft] = useState<Draft>(newDraft);
  const [feedback, setFeedback] = useState(''), [error, setError] = useState(''), [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const [pending, setPending] = useState<{ next: Draft; resolve: (ok: boolean) => void } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const current = useRef(draft); current.current = draft;
  const busy = useRef(false);
  const dirty = fingerprint(draft) !== draft.baseline;

  // Every write re-reads the latest collection under a same-origin Web Lock.
  // Revisions protect a record that another tab changed while this tab was editing.
  const transact = useCallback(async (mutate: (data: Collection) => Collection) => {
    const write = async () => {
      const next = writeCollection(localStorage, mutate);
      setCollection(next); return next;
    };
    return navigator.locks ? navigator.locks.request(JOURNEYS_KEY, write) : write();
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      let restored: Draft | null = null;
      let legacy: Trip | null = null;
      try { restored = readDraft(sessionStorage.getItem(DRAFT_KEY)); legacy = restoreTrip(sessionStorage.getItem(TRIP_SESSION_KEY)); }
      catch { setError('Tab storage is disabled. Keep this page open until you save your journey on this device.'); }
      if (restored) setDraft(restored);
      else if (legacy) setDraft({ ...newDraft(), trip: legacy });
      try {
        const data = readCollection(localStorage.getItem(JOURNEYS_KEY));
        if (alive) setCollection(data);
        if (!restored && legacy && (legacy.stopIds.length || legacy.origin)) {
          let imported: Journey | undefined;
          await transact(latest => { const result = migrateItinerary(latest, legacy!); imported = result.journey; return result.collection; });
          if (alive) {
            const saved = imported!;
            setDraft({ ...draftFrom(saved), trip: legacy });
            setFeedback(legacy.origin?.id === 'device' ? 'Your previous itinerary is now an Idea. Its old device location stays only in this tab; choose a city or map pin for the saved start.' : 'Your previous itinerary is now an Idea. Journeys are saved on this device.');
          }
        }
      } catch (cause) { if (alive) setError(storageMessage(cause)); }
      if (alive) setReady(true);
    })();
    const sync = (event: StorageEvent) => {
      if (event.key !== JOURNEYS_KEY && event.key !== null) return;
      try { setCollection(readCollection(event.newValue)); setUndo(null); setFeedback('Updated in another tab.'); }
      catch (cause) { setError(storageMessage(cause)); }
    };
    window.addEventListener('storage', sync);
    return () => { alive = false; window.removeEventListener('storage', sync); };
  }, [transact]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, draft }));
      sessionStorage.setItem(TRIP_SESSION_KEY, JSON.stringify(draft.trip));
    } catch { setError('Your active draft could not be kept for reloads. It is still open here; use Save to keep a journey on this device.'); }
  }, [draft, ready]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (pending) { returnFocus.current = document.activeElement as HTMLElement; dialog.current?.showModal(); }
    else { dialog.current?.close(); returnFocus.current?.focus({ preventScroll: true }); }
  }, [pending]);

  function edit(fields: Partial<JourneyFields>) { setDraft(d => ({ ...d, ...fields })); setFeedback(''); }
  function setTrip(value: SetStateAction<Trip>) { setDraft(d => ({ ...d, trip: typeof value === 'function' ? value(d.trip) : value })); setFeedback(''); }
  async function save(asCopy = false, plannedTrip?: Trip) {
    if (busy.current) return false;
    busy.current = true;
    const before = current.current;
    const snapshot = plannedTrip ? { ...before, trip: plannedTrip, status: 'idea' as const, title: before.title === 'Untitled day trip' ? `${plannedTrip.origin?.name ?? 'Iraq'} day trip` : before.title, travelDate: '', notes: '' } : before;
    try {
      let saved: Journey | undefined;
      await transact(data => {
        const previous = asCopy ? undefined : data.journeys.find(j => j.id === snapshot.journeyId);
        if (!asCopy && snapshot.journeyId && previous?.revision !== snapshot.baseRevision) throw new Error('This journey changed or was deleted in another tab. Your edits remain open. Save a new copy to keep them.');
        saved = makeJourney({ ...snapshot, status: asCopy ? 'idea' : snapshot.status, trip: { ...snapshot.trip, origin: snapshot.trip.origin?.id === 'device' ? null : snapshot.trip.origin } }, previous);
        return putJourney(data, saved, previous?.revision ?? null);
      });
      // If typing continued during a lock wait, keep those edits unsaved.
      setDraft(d => fingerprint(d) === fingerprint(before) ? draftFrom(saved!) : { ...d, journeyId: saved!.id, baseRevision: saved!.revision, baseline: fingerprint(saved!) });
      setError(''); setUndo(null); setFeedback(snapshot.trip.origin?.id === 'device' ? 'Saved without device location. Choose a city or map pin for your start.' : 'Saved.'); return true;
    } catch (cause) { setError(storageMessage(cause)); return false; }
    finally { busy.current = false; }
  }
  function switchDraft(next: Draft): Promise<boolean> {
    if (fingerprint(current.current) !== current.current.baseline) return new Promise(resolve => setPending({ next, resolve }));
    setDraft(next); setError(''); setUndo(null); setFeedback(''); return Promise.resolve(true);
  }
  function finishSwitch(ok: boolean) {
    if (!pending) return;
    if (ok) {
      let next = pending.next;
      // Save-and-open can target the same record; load the just-saved revision.
      try { const latest = readCollection(localStorage.getItem(JOURNEYS_KEY)).journeys.find(j => j.id === next.journeyId); if (latest) next = draftFrom(latest); } catch { /* The selected snapshot is still available. */ }
      setDraft(next); setUndo(null); setFeedback('');
    }
    pending.resolve(ok); setPending(null);
  }
  async function transition(journey: Journey, status: JourneyStatus) {
    try {
      const changed = makeJourney({ ...journey, status }, journey);
      await transact(data => putJourney(data, changed, journey.revision));
      if (current.current.journeyId === journey.id && current.current.baseRevision === journey.revision) setDraft(d => ({ ...d, status, baseRevision: changed.revision, baseline: fingerprint(changed) }));
      setError(''); setFeedback(status === 'done' ? 'Completed.' : `Moved to ${status === 'idea' ? 'Ideas' : 'Planned'}.`);
      setUndo(() => async () => {
        try {
          const restored = { ...journey, revision: crypto.randomUUID(), updatedAt: new Date().toISOString() };
          await transact(data => putJourney(data, restored, changed.revision));
          if (current.current.journeyId === journey.id) setDraft(d => ({ ...d, status: restored.status, baseRevision: restored.revision, baseline: fingerprint(restored) }));
          setUndo(null); setFeedback('Previous status restored.'); setError('');
        } catch (cause) { setError(storageMessage(cause)); }
      });
      return true;
    } catch (cause) { setError(storageMessage(cause)); return false; }
  }
  async function duplicate(journey: Journey) {
    try { const copy = duplicateJourney(journey); await transact(data => putJourney(data, copy, null)); setError(''); setUndo(null); setFeedback('Copy added to Ideas.'); }
    catch (cause) { setError(storageMessage(cause)); }
  }
  async function remove(journey: Journey) {
    try {
      const editing = current.current.journeyId === journey.id ? current.current : null;
      await transact(data => removeJourney(data, journey));
      if (current.current.journeyId === journey.id) setDraft(d => ({ ...d, journeyId: null, baseRevision: null, baseline: '' }));
      setFeedback('Deleted.'); setError('');
      setUndo(() => async () => {
        try {
          await transact(data => putJourney(data, journey, null));
          if (editing && !current.current.journeyId && fingerprint(current.current) === fingerprint(editing)) setDraft(d => ({ ...d, journeyId: journey.id, baseRevision: journey.revision, baseline: fingerprint(journey) }));
          setUndo(null); setFeedback('Journey restored.'); setError('');
        }
        catch (cause) { setError(storageMessage(cause)); }
      });
    } catch (cause) { setError(storageMessage(cause)); }
  }
  return <Context.Provider value={{ ready, collection, draft, dirty, feedback, error, setTrip, edit, save, open: journey => switchDraft(draftFrom(journey)), create: () => switchDraft(newDraft()), transition, duplicate, remove, undo }}>
    {children}
    <dialog className="journey-dialog" ref={dialog} aria-labelledby="draft-question" onCancel={e => { e.preventDefault(); finishSwitch(false); }}>
      <h2 id="draft-question">Unsaved changes</h2>
      {error && <p role="alert">{error}</p>}
      <div className="journey-actions"><button className="journey-primary" onClick={async () => { if (await save()) finishSwitch(true); }}>Save and open</button><button onClick={() => finishSwitch(true)}>Discard and open</button><button autoFocus onClick={() => finishSwitch(false)}>Keep editing</button></div>
    </dialog>
  </Context.Provider>;
}
