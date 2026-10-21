'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJourneys } from './JourneyProvider';
import { AtmosphereLink } from './AtmosphereTransition';
import { getPlace, initialTrip, MAX_STOPS, formatTime } from '@/lib/trip-planner';
import { origins } from '@/lib/destinations';
import { trails } from '@/lib/explore';
import type { Journey, JourneyStatus } from '@/lib/journeys';

const sections: { id: JourneyStatus; label: string; empty: string }[] = [
  { id: 'idea', label: 'Ideas', empty: 'No ideas yet.' },
  { id: 'planned', label: 'Planned', empty: 'No planned trips.' },
  { id: 'done', label: 'Done', empty: 'No completed journeys.' },
];
function preview(journey: Journey) { return journey.trip.stopIds.map(getPlace).filter(p => !!p).slice(0, 3); }
const dateLabel = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Journeys() {
  const store = useJourneys(), { draft, collection, dirty, ready, edit, setTrip } = store;
  const [section, setSection] = useState<JourneyStatus>('idea'), [detail, setDetail] = useState(false), [deleteTarget, setDeleteTarget] = useState<Journey | null>(null);
  const panel = useRef<HTMLElement>(null), trigger = useRef<HTMLElement | null>(null), confirm = useRef<HTMLDialogElement>(null);
  const deleteTrigger=useRef<HTMLElement|null>(null);
  const router = useRouter();
  const activeSaved = collection.journeys.find(j => j.id === draft.journeyId);
  const stale = !!draft.journeyId && activeSaved?.revision !== draft.baseRevision;
  const items = collection.journeys.filter(j => j.status === section).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selectedSection = sections.find(s => s.id === section)!;
  useEffect(() => { if (detail) panel.current?.focus({ preventScroll: true }); else trigger.current?.focus({ preventScroll: true }); }, [detail]);
  useEffect(() => { if (detail && activeSaved) setSection(activeSaved.status); }, [detail, activeSaved?.status]);
  useEffect(() => {
    if (deleteTarget) { deleteTrigger.current=document.activeElement as HTMLElement; confirm.current?.showModal(); }
    else { confirm.current?.close(); if(deleteTrigger.current?.isConnected)deleteTrigger.current.focus({preventScroll:true});else if(deleteTrigger.current)panel.current?.focus({preventScroll:true}); }
  }, [deleteTarget]);
  function close() { setDetail(false); }
  async function show(journey?: Journey) {
    trigger.current = document.activeElement as HTMLElement;
    if (journey ? await store.open(journey) : await store.create()) setDetail(true);
  }
  async function openMap(path: string) { router.push(path); }
  function move(index: number, offset: number) { const stopIds = [...draft.trip.stopIds]; [stopIds[index], stopIds[index + offset]] = [stopIds[index + offset], stopIds[index]]; setTrip({ ...draft.trip, stopIds }); }
  const feedback = <>{store.feedback && store.feedback !== 'Saved.' && <div className="journey-collection-feedback" aria-live="polite"><p>{store.feedback} {store.undo && <button onClick={() => void store.undo?.()}>Undo</button>}</p></div>}{store.error && <div className="journey-error" role="alert">{store.error}</div>}{stale && <div className="journey-error">Changed in another tab. <button onClick={()=>void store.save(true)}>Save a copy</button>{activeSaved&&<button onClick={()=>void store.open(activeSaved)}>Open latest</button>}</div>}</>;
  return <main className="journeys-page" onKeyDown={e => { if (e.key === 'Escape' && detail && !deleteTarget) close(); }}>
    <header className="journeys-header"><AtmosphereLink href="/#journeys" className="journeys-brand">← BILAD <span>/ Back to tower</span></AtmosphereLink><div className="journey-map-links"><AtmosphereLink href="/explore/">Explore Iraq ↗</AtmosphereLink><AtmosphereLink href="/ai/#map">Milai ↗</AtmosphereLink></div></header>
    <div className="journeys-heading"><div><h1>Your journeys<span>.</span></h1><span className="journeys-local">Saved on this device</span></div><button className="journey-primary" disabled={!ready} onClick={() => void show()}>＋ New trip</button></div>
    {!detail&&feedback}
    {(dirty || draft.journeyId) && <div className="journeys-active"><span><strong>{draft.title || 'Untitled day trip'}</strong>{dirty && ' · Unsaved'}</span><button onClick={() => { trigger.current = document.activeElement as HTMLElement; setDetail(true); }}>Edit trip →</button></div>}
    <nav className="journey-tabs" aria-label="Journey sections">{sections.map(s => <button key={s.id} aria-pressed={section === s.id} onClick={() => { setSection(s.id); close(); }}>{s.label}<span>{collection.journeys.filter(j => j.status === s.id).length}</span></button>)}</nav>
    <div className={`journeys-workspace${detail ? ' has-detail' : ''}`}>
      <section className="journey-collection" aria-label={`${selectedSection.label} journeys`}>
        {!ready ? <p role="status">Opening your journeys…</p> : items.length ? <div className="journey-grid">{items.map(j => <button className={`journey-card${detail && draft.journeyId === j.id ? ' is-selected' : ''}`} key={j.id} onClick={() => void show(j)}>
          <div className="journey-card-photos">{preview(j).length ? preview(j).map(p => <img key={p.id} src={p.image} alt="" onError={e => { e.currentTarget.style.opacity = '0'; }}/>) : <div className="journey-card-empty-art" aria-hidden="true">↝</div>}<span className={`journey-status status-${j.status}`}>{sections.find(s => s.id === j.status)?.label}</span></div>
          <div className="journey-card-copy"><h2>{j.title}</h2><p>{[j.trip.origin?.name ?? preview(j)[0]?.region,`${j.trip.stopIds.length} ${j.trip.stopIds.length === 1 ? 'stop' : 'stops'}`].filter(Boolean).join(' · ')}</p><div><span>{j.status === 'done' && j.completedAt ? dateLabel(j.completedAt) : j.travelDate ? dateLabel(j.travelDate) : ''}</span><span aria-hidden="true">↗</span></div></div>
        </button>)}</div> : <div className="journey-empty"><div className={`journey-empty-icon status-${section}`} aria-hidden="true">{section === 'done' ? '✓' : section === 'planned' ? '↝' : '✧'}</div><h2>{selectedSection.empty}</h2>{section === 'idea' && <button className="journey-primary" onClick={() => void openMap('/explore/')}>Explore Iraq →</button>}</div>}
        {section === 'idea' && <details className="journey-inspiration"><summary>Suggested trips</summary><div className="journey-suggestions">{trails.slice(0, 2).map(t => <article key={t.id}><strong>{t.name}</strong><p>{t.stops.length} stops</p><button onClick={async () => { if (await store.create()) { edit({ title: t.name, trip: { ...initialTrip, stopIds: [...t.stops], minutes: 480 } }); setDetail(true); } }}>Use trip +</button></article>)}</div></details>}
      </section>
      {detail && <section className="journey-detail" ref={panel} tabIndex={-1} aria-label="Edit active journey">
        <div className="journey-detail-top"><span className="journey-eyebrow">DAY TRIP</span><button aria-label="Close trip editor" onClick={close}>×</button></div>
        {feedback}
        <label>Title<input autoComplete="off" aria-label="Trip title" maxLength={120} value={draft.title} onChange={e => edit({ title: e.target.value })}/></label>
        <div className="journey-edit-row"><label>Date<input aria-label="Intended travel date" type="date" value={draft.travelDate} onChange={e => edit({ travelDate: e.target.value })}/></label><label>Time available<select aria-label="Journey time available" value={draft.trip.minutes} onChange={e => setTrip({ ...draft.trip, minutes: Number(e.target.value) })}>{[...new Set([60,120,180,240,360,480,600,720,draft.trip.minutes])].sort((a,b)=>a-b).map(n => <option key={n} value={n}>{formatTime(n)}</option>)}</select></label></div>
        <label>Starting from<select aria-label="Journey starting city" value={draft.trip.origin?.id ?? ''} onChange={e => setTrip({ ...draft.trip, origin: origins.find(o => o.id === e.target.value) ?? null })}><option value="">Choose a city</option>{origins.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}{draft.trip.origin && !origins.some(o => o.id === draft.trip.origin?.id) && <option value={draft.trip.origin.id}>{draft.trip.origin.name}</option>}</select></label>
        <label className="journey-check"><input type="checkbox" checked={draft.trip.roundTrip} onChange={e => setTrip({ ...draft.trip, roundTrip: e.target.checked })}/>Return to start</label>
        <div className="journey-detail-stops"><h3>{draft.trip.stopIds.length} / {MAX_STOPS} stops</h3><ol>{draft.trip.stopIds.map((id, i) => <li key={id}><span className="journey-stop-number">{i + 1}</span><span>{getPlace(id)?.name ?? 'Unavailable destination'}</span><div><button aria-label={`Move stop ${i+1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button><button aria-label={`Move stop ${i+1} later`} disabled={i === draft.trip.stopIds.length - 1} onClick={() => move(i, 1)}>↓</button><button aria-label={`Remove stop ${i+1}`} onClick={() => setTrip({ ...draft.trip, stopIds: draft.trip.stopIds.filter(s => s !== id) })}>×</button></div></li>)}</ol></div>
        <div className="journey-actions"><button onClick={() => void openMap('/explore/#plan')}>Edit in Explore Iraq ↗</button><button onClick={() => void openMap('/ai/#map')}>Edit in Milai ↗</button></div>
        <label>Notes<textarea aria-label="Personal notes" maxLength={5000} rows={3} value={draft.notes} onChange={e => edit({ notes: e.target.value })}/></label>
        {activeSaved?.completedAt && <p className="journey-completed-date">Completed {dateLabel(activeSaved.completedAt)}</p>}
        <div className="journey-detail-save"><button className="journey-primary" onClick={() => void store.save()} disabled={!ready}>Save {draft.journeyId ? 'changes' : 'as idea'}</button><span role="status">{dirty ? 'Unsaved' : draft.journeyId ? 'Saved' : 'Draft'}</span></div>
        {activeSaved && <div className="journey-lifecycle">{(dirty || stale) && <p className="journey-status-hint">{stale ? 'Reopen the latest trip to change its status.' : 'Save changes to update status.'}</p>}<div className="journey-actions">{activeSaved.status === 'idea' ? <button disabled={dirty||stale} className="journey-primary" onClick={() => void store.transition(activeSaved, 'planned')}>Move to Planned →</button> : activeSaved.status === 'planned' ? <><button disabled={dirty||stale} className="journey-primary" onClick={() => void store.transition(activeSaved, 'done')}>✓ Mark completed</button><button disabled={dirty||stale} onClick={() => void store.transition(activeSaved, 'idea')}>Back to Ideas</button></> : <button disabled={dirty||stale} onClick={() => void store.transition(activeSaved, 'planned')}>Move to Planned →</button>}</div><details><summary>More trip actions</summary><div className="journey-actions"><button disabled={dirty||stale} onClick={() => void store.duplicate(activeSaved)}>Duplicate trip</button><button onClick={() => void store.save(true)}>Save as a new idea</button></div><div className="journey-delete-area"><button onClick={() => setDeleteTarget(activeSaved)}>Delete saved journey…</button></div></details></div>}
      </section>}
    </div>
    <dialog className="journey-dialog" ref={confirm} aria-labelledby="delete-title" onCancel={() => setDeleteTarget(null)}><h2 id="delete-title">Delete “{deleteTarget?.title}”?</h2><div className="journey-actions"><button autoFocus onClick={() => setDeleteTarget(null)}>Cancel</button><button onClick={async () => { if (deleteTarget) await store.remove(deleteTarget); setDeleteTarget(null); }}>Delete journey</button></div></dialog>
  </main>;
}
