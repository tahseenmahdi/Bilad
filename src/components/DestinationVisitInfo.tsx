'use client';

import { useEffect, useState } from 'react';
import { getDestinationVisit, visitReviewDue, type VisitSource } from '@/lib/destination-visits';
import type { Place } from '@/lib/destinations';
import './destination-visit-info.css';

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Baghdad' }).format(new Date(`${date}T12:00:00+03:00`));
}

export default function DestinationVisitInfo({ placeId, placeName, primary = false, photoCredit }: { placeId: string; placeName: string; primary?: boolean; photoCredit?: Place['photoCredit'] }) {
  const info = getDestinationVisit(placeId);
  const [due, setDue] = useState(false);
  useEffect(() => { setDue(info ? visitReviewDue(info, new Date()) : false); }, [info]);
  if (!info) return null;
  const [hoursMain, ...hoursContext] = info.hours.text.split(' · ');
  const sources: VisitSource[] = [];
  for (const source of [info.hours.source, ...info.notes.map(note => note.source)]) {
    if (source && !sources.some(item => item.url === source.url)) sources.push(source);
  }
  const reference = (source?: VisitSource) => source ? <a className="visit-reference" href={source.url} target="_blank" rel="noreferrer" aria-label={`Source: ${source.name}`}>[{sources.findIndex(item => item.url === source.url) + 1}]</a> : null;
  return <>
    {primary && <aside className={`destination-hours hours-${info.hours.status}`} aria-label={`Visiting hours for ${placeName}`}>
      <span className="hours-dial" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><circle className="hours-dial-track" cx="20" cy="20" r="17"/><circle className="hours-dial-accent" cx="20" cy="20" r="17"/><path d="M20 10v10l7 4"/><circle className="hours-dial-center" cx="20" cy="20" r="1.5"/></svg></span>
      <div className="hours-copy"><span className="hours-eyebrow">Visiting hours</span><strong>{hoursMain}</strong><span className="hours-disclaimer">{hoursContext.length > 0 && `${hoursContext.join(' · ')} · `}{due ? 'Review overdue — confirm locally.' : info.hours.status === 'reported' ? 'Confirm before travel' : info.hours.status === 'unconfirmed' ? 'Ask locally before travel' : 'Local arrangements may vary'}</span></div>
      {info.hours.source && <a className="hours-source" href={info.hours.source.url} target="_blank" rel="noreferrer" aria-label={`Hours source: ${info.hours.source.name}`}>Source ↗</a>}
    </aside>}
    <details className="destination-visit" id={primary ? `visit-details-${placeId}` : undefined} key={placeId}>
    <summary aria-label={`${primary ? 'Plan your visit' : 'Visit info'}: ${placeName}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>
      <span>{primary ? 'Plan your visit' : 'Visit info'}</span>
      <span className="visit-chevron" aria-hidden="true">+</span>
    </summary>
    <div className="visit-content">
      <div className="visit-facts">
        {!primary && <div><h4>When to go</h4><p>{info.hours.text} {reference(info.hours.source)}</p></div>}
        <div><h4>Before you go</h4><ul>{info.notes.map((note, index) => <li key={index}>{note.text} {reference(note.source)}</li>)}</ul></div>
      </div>
      <div className="visit-bottom"><span className="visit-caution">{due ? 'Review overdue — reconfirm locally.' : 'Confirm locally before travelling. Not live availability.'}</span>
        <details className="visit-sources"><summary>Sources &amp; review <span aria-hidden="true">↗</span></summary><div className="visit-source-list">
          {sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {source.name} ↗ <span>{source.type}{source.publishedAt ? ` · ${dateLabel(source.publishedAt)}` : ''}</span></a>)}
          <span>Source checked <time dateTime={info.checkedAt}>{dateLabel(info.checkedAt)}</time> · Review every {info.reviewAfterDays} days.</span>
          {info.notes.some(note => !note.source) && <span>Uncited notes are Bilad planning advice, not admission confirmations.</span>}
          {photoCredit && <span>Photo: <a href={photoCredit.url} target="_blank" rel="noreferrer">{photoCredit.author}</a> · {photoCredit.licenseUrl ? <a href={photoCredit.licenseUrl} target="_blank" rel="noreferrer">{photoCredit.license}</a> : photoCredit.license}</span>}
        </div></details>
      </div>
    </div>
  </details></>;
}
