'use client';
import { useState } from 'react';
import { getPlace, formatTime } from '@/lib/trip-planner';
import { destinationVisits } from '@/lib/destination-visits';
import { serviceApps } from '@/lib/services';
import JourneyBar from './JourneyBar';
import type { MilaiGuide } from './useMilaiGuide';
import './milai.css';

export function MilaiMessages({ guide, onPlace }: { guide: MilaiGuide; onPlace: (id: string) => void }) {
  const { pending } = guide;
  return <div className="milai-conversation">
    <span className="chat-demo-label">Milai · powered by Gemini · curated Bilad content</span>
    <div role="log" aria-label="Conversation with Milai" aria-live="polite" aria-relevant="additions text">
      {guide.turns.map((turn, i) => <article className="chat-plan-reply" key={i}>
        <p className="ai-question" dir="auto">You: {turn.question}</p><p className="milai-text" dir="auto">{turn.response.reply}</p>
        <div className="reply-places">{turn.response.placeIds.map(id => <button type="button" key={id} onClick={() => onPlace(id)}>{getPlace(id)?.name} ↗</button>)}</div>
        {turn.response.placeIds.length > 0 && <details className="milai-sources"><summary>Bilad sources & visitor notes</summary>{turn.response.placeIds.map(id => {
          const place = getPlace(id)!; const visit = destinationVisits[id];
          const sources = [visit?.hours.source, ...(visit?.notes.map(n => n.source) ?? [])].filter(s => !!s);
          return <div key={id}><a href={place.source} target="_blank" rel="noreferrer">{place.name} · story source ↗</a>{visit && <p>{visit.hours.text} · checked {visit.checkedAt}. Confirm current access locally.</p>}{[...new Map(sources.map(s => [s.url, s])).values()].map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.name} ↗ </a>)}</div>;
        })}</details>}
        {turn.response.serviceIds.map(id => { const service = serviceApps.find(s => s.id === id)!; return <div className="milai-service" key={id}><strong>{service.name}</strong><p>{service.brief}</p><a href={service.href} target="_blank" rel="noreferrer">Visit provider ↗</a><small>Check availability with the provider.</small></div>; })}
      </article>)}
    </div>
    {(guide.loading || (guide.error && guide.turns.at(-1)?.question !== guide.lastQuestion)) && guide.lastQuestion && <p className="ai-question" dir="auto">You: {guide.lastQuestion}</p>}
    {guide.loading && <p role="status">Milai is thinking…</p>}
    {guide.error && <div className="journey-error" role="alert"><p>{guide.error}</p>{guide.lastQuestion && <button type="button" disabled={guide.loading} onClick={guide.retry}>Retry question</button>}</div>}
    {pending && <section className="milai-proposal" aria-label="Review Milai proposal">
      <strong>{pending.action.type === 'save_trip' ? 'Save your active trip' : pending.action.type === 'complete_journey' ? 'Confirm journey completion' : 'Review itinerary change'}</strong>
      {pending.nextTrip && <><p>{pending.nextTrip.origin?.name} · {formatTime(pending.nextTrip.minutes)} · {pending.nextTrip.category} · {pending.nextTrip.roundTrip ? 'return to start' : 'one way'}</p><ol>{pending.nextTrip.stopIds.map(id => <li key={id}>{getPlace(id)?.name}</li>)}</ol><p>Estimated plan. Existing road routing will check travel times.</p></>}
      {pending.action.type === 'complete_journey' && <p>Mark “{pending.request.context.journey?.title}” done? This changes the saved journey on this device.</p>}
      {pending.action.type === 'save_trip' ? <><p>Review the title, then use Bilad’s existing Save control below. A new draft is saved as an Idea; existing records retain revision checks.</p><JourneyBar /></> : <button className="planner-primary" type="button" disabled={guide.applying} onClick={() => void guide.confirm()}>{guide.applying ? 'Applying…' : pending.nextTrip ? 'Apply itinerary change' : 'Mark saved journey done'}</button>}
      <button className="planner-secondary" type="button" disabled={guide.applying} onClick={guide.cancel}>{pending.action.type === 'save_trip' ? 'Close save controls' : 'Cancel proposal'}</button>
    </section>}
    {guide.result && <p className="planner-message" role="status">{guide.result}</p>}
    {guide.canUndo && <button className="undo-plan" type="button" onClick={guide.undoTrip}>↶ Undo last itinerary edit</button>}
    {guide.store.feedback && <p className="journey-feedback" role="status">{guide.store.feedback} {guide.store.undo && <button type="button" onClick={() => void guide.store.undo?.()}>Undo status change</button>}</p>}
    {guide.store.error && <p className="journey-error" role="alert">{guide.store.error}</p>}
  </div>;
}

export default function MilaiConversation({ guide, onPlace }: { guide: MilaiGuide; onPlace: (id: string) => void }) {
  const [question, setQuestion] = useState('');
  return <><div className="milai-planner-heading"><img src="/assets/ai%20mascot.png" alt="" width="32" height="38"/><h3>Milai</h3></div>
    <MilaiMessages guide={guide} onPlace={onPlace}/>
    <form className="planner-chat-form" onSubmit={e => { e.preventDefault(); if (question.trim()) { void guide.ask(question.trim()); setQuestion(''); } }}><label className="visually-hidden" htmlFor="milai-question">Ask Milai</label><input id="milai-question" maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Plan 4 hours in Baghdad…"/><button type="submit" aria-label="Send to Milai" disabled={guide.loading || !question.trim()}>↑</button></form>
    <div className="milai-quick-prompts">{['Plan a history day', 'Show nearby places', 'Save my trip'].map(q => <button key={q} disabled={guide.loading} onClick={() => void guide.ask(q)}>{q}</button>)}</div>
  </>;
}
