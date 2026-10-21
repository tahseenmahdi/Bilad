'use client';
import { useJourneys } from './JourneyProvider';
import { AtmosphereLink } from './AtmosphereTransition';

export default function JourneyBar() {
  const { ready, draft, dirty, edit, save, feedback, error, collection, open, create } = useJourneys();
  const saved = collection.journeys.find(j => j.id === draft.journeyId);
  const stale = !!draft.journeyId && saved?.revision !== draft.baseRevision;
  return <section className="journey-bar" aria-label="Active day trip">
    <div className="journey-bar-heading"><span>DAY TRIP</span><AtmosphereLink href="/journeys/">Your journeys ↗</AtmosphereLink></div>
    <label className="journey-title-label">Title<input aria-label="Active trip title" maxLength={120} value={draft.title} onChange={e => edit({ title: e.target.value })}/></label>
    <div className="journey-actions"><button className="journey-primary" disabled={!ready} onClick={() => void save()}>{draft.journeyId ? 'Save changes' : 'Save as idea'}</button><span className="journey-save-state" role="status">{stale ? 'Changed in another tab' : dirty ? 'Unsaved' : draft.journeyId ? 'Saved' : 'Draft'}</span></div>
    {stale && <p className="journey-error">Changed in another tab. <button onClick={() => void save(true)}>Save a copy</button>{saved && <button onClick={() => void open(saved)}>Open latest</button>}</p>}
    <details className="journey-switch"><summary>Switch trip</summary><div className="journey-actions"><button onClick={() => void create()}>New trip</button><button onClick={() => void save(true)}>Save a copy</button></div><div className="journey-switch-list">{collection.journeys.filter(j => j.id !== draft.journeyId).map(j => <button key={j.id} onClick={() => void open(j)}>{j.title} <small>{j.status === 'done' ? 'Done' : j.status === 'planned' ? 'Planned' : 'Idea'} · {j.trip.stopIds.length} stops</small></button>)}</div></details>
    {feedback && feedback !== 'Saved.' && <p className="journey-feedback" role="status">{feedback}</p>}{error && <p className="journey-error" role="alert">{error}</p>}
  </section>;
}
