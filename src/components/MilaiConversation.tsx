'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { getPlace } from '@/lib/trip-planner';
import { destinationVisits } from '@/lib/destination-visits';
import { serviceApps } from '@/lib/services';
import type { MilaiGuide } from './useMilaiGuide';
import './milai.css';

export function MilaiMessages({ guide, onPlace }: { guide: MilaiGuide; onPlace: (id: string) => void }) {
  const thread = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousMessage = useRef<number | null>(null);
  const waitingForReply = !!guide.lastQuestion && !guide.turns.some(turn => turn.id === guide.lastMessageId);
  const messages = [...guide.turns, ...(waitingForReply ? [{ id: guide.lastMessageId!, question: guide.lastQuestion, response: null }] : [])];

  useEffect(() => {
    const element = thread.current;
    if (!element) return;
    if (following.current || previousMessage.current !== guide.lastMessageId) element.scrollTop = element.scrollHeight;
    previousMessage.current = guide.lastMessageId;
  }, [guide.turns, guide.lastMessageId, guide.loading, guide.error, guide.result, guide.store.feedback, guide.store.error]);

  return <div className="milai-conversation">
    <div ref={thread} className="milai-thread" role="log" aria-label="Conversation with Milai" aria-live="polite" aria-relevant="additions text" tabIndex={0} onScroll={event => { const element = event.currentTarget; following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96; }}>
      {!guide.lastQuestion && <article className="milai-message milai-message-assistant milai-welcome" aria-label="Milai message"><MilaiAvatar/><div className="milai-bubble"><span className="milai-welcome-spark" aria-hidden="true">✧</span><p className="milai-welcome-title">Where shall we go?</p><p className="milai-text">A place you’re curious about, a local tip, or a day worth exploring. Let’s start there.</p></div></article>}
      {messages.map(turn => <Fragment key={turn.id}>
        <article className="milai-message milai-message-user" aria-label="Your message"><div className="milai-bubble"><p className="milai-text" dir="auto">{turn.question}</p></div></article>
        {turn.response && <article className="milai-message milai-message-assistant" aria-label="Milai message"><MilaiAvatar/><div className="milai-bubble"><p className="milai-text" dir="auto">{turn.response.reply}</p>
        <div className="reply-places">{turn.response.placeIds.map(id => <button type="button" key={id} onClick={() => onPlace(id)}>{getPlace(id)?.name} ↗</button>)}</div>
        {turn.response.placeIds.length > 0 && <details className="milai-sources"><summary>Bilad sources & visitor notes</summary>{turn.response.placeIds.map(id => {
          const place = getPlace(id)!; const visit = destinationVisits[id];
          const sources = [visit?.hours.source, ...(visit?.notes.map(n => n.source) ?? [])].filter(s => !!s);
          return <div key={id}><a href={place.source} target="_blank" rel="noreferrer">{place.name} · story source ↗</a>{visit && <p>{visit.hours.text} · checked {visit.checkedAt}. Confirm current access locally.</p>}{[...new Map(sources.map(s => [s.url, s])).values()].map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.name} ↗ </a>)}</div>;
        })}</details>}
        {turn.response.serviceIds.map(id => { const service = serviceApps.find(s => s.id === id)!; return <div className="milai-service" key={id}><strong>{service.name}</strong><p>{service.brief}</p><a href={service.href} target="_blank" rel="noreferrer">Visit provider ↗</a><small>Check availability with the provider.</small></div>; })}
        </div></article>}
      </Fragment>)}
      {guide.loading && <div className="milai-message milai-message-assistant milai-loading" role="status"><MilaiAvatar/><div className="milai-bubble milai-typing"><span className="visually-hidden">Milai is thinking…</span><span className="milai-typing-dots" aria-hidden="true"><i/><i/><i/></span></div></div>}
      {guide.error && <div className="milai-chat-error" role="alert"><p>{guide.error}</p>{guide.lastQuestion && <button type="button" disabled={guide.loading} onClick={guide.retry}>Retry question ↗</button>}</div>}
      {(guide.result || guide.canUndo) && <div className="milai-chat-notice">{guide.result && <p role="status">{guide.result}</p>}{guide.canUndo && <button className="undo-plan" type="button" onClick={guide.undoTrip}>↶ Undo last itinerary edit</button>}</div>}
      {guide.store.feedback && <p className="journey-feedback" role="status">{guide.store.feedback} {guide.store.undo && <button type="button" onClick={() => void guide.store.undo?.()}>Undo status change</button>}</p>}
      {guide.store.error && <p className="journey-error" role="alert">{guide.store.error}</p>}
    </div>
  </div>;
}

function MilaiAvatar() {
  return <span className="milai-message-avatar" aria-hidden="true"><img src="/assets/ai%20mascot.png" alt="" width="25" height="30" /></span>;
}

export default function MilaiConversation({ guide, onPlace }: { guide: MilaiGuide; onPlace: (id: string) => void }) {
  const [question, setQuestion] = useState('');
  return <><div className="milai-planner-heading"><img src="/assets/ai%20mascot.png" alt="" width="32" height="38"/><h3>Milai</h3></div>
    <MilaiMessages guide={guide} onPlace={onPlace}/>
    <form className="planner-chat-form" onSubmit={e => { e.preventDefault(); if (question.trim()) { void guide.ask(question.trim()); setQuestion(''); } }}><label className="visually-hidden" htmlFor="milai-question">Ask Milai</label><input id="milai-question" maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Plan 4 hours in Baghdad…"/><button type="submit" aria-label="Send to Milai" disabled={guide.loading || !question.trim()}>↑</button></form>
    <div className="milai-quick-prompts">{['Plan 4 hours in Baghdad', 'Show nearby places', 'Tell me about Babylon'].map(q => <button key={q} disabled={guide.loading} onClick={() => void guide.ask(q)}>{q}</button>)}</div>
  </>;
}
