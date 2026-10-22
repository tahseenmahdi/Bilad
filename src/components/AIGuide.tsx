'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AtmosphereLink } from './AtmosphereTransition';
import ReturnToChoices from './ReturnToChoices';
import BackToTower from './BackToTower';
import dynamic from 'next/dynamic';
import { getPlace } from '@/lib/trip-planner';
import { useMilaiGuide } from './useMilaiGuide';
import MilaiConversation, { MilaiMessages } from './MilaiConversation';
import './trip-planner.css';
import './planner-reveal.css';
import './planner-colors.css';

const TripPlanner = dynamic(() => import('./TripPlanner'), {
  ssr: false,
  loading: () => <div className="map-loading" role="status"><span className="map-loading-orbit" />Opening your map…</div>,
});

function MapIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" /><path d="M9 3v16M15 5v16" /></svg>;
}

const suggestions = ['What should I know before visiting Iraq?', 'Tell me about Iraqi culture', 'Recommend historic places'];

export default function AIGuide() {
  const [prompt, setPrompt] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [view, setView] = useState<'choices' | 'chat' | 'map'>('choices');
  const guide = useMilaiGuide({ onFocus: setFocused, onMap: () => setView('map') });
  const trip = guide.store.draft.trip;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const expanded = view === 'chat';
  const input = useRef<HTMLInputElement>(null);
  const launch = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);
  const mapPanel = useRef<HTMLDivElement>(null);
  const switcher = useRef<HTMLDivElement>(null);
  const switchButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const followMapLink = () => {
      if (window.location.hash === '#map') setView('map');
      const place = getPlace(new URLSearchParams(window.location.search).get('place') ?? '');
      if (place) {
        setFocused(place.id);
        setPrompt(`Tell me about ${place.name}`);
        if (window.location.hash !== '#map') setView('chat');
      }
    };
    followMapLink();
    window.addEventListener('hashchange', followMapLink);
    return () => window.removeEventListener('hashchange', followMapLink);
  }, []);

  useEffect(() => {
    if (view === 'choices') {
      if (hasOpened.current) launch.current?.focus({ preventScroll: true });
      return;
    }
    hasOpened.current = true;
    const timer = setTimeout(() => {
      if (view === 'chat') input.current?.focus({ preventScroll: true });
      else mapPanel.current?.focus({ preventScroll: true });
    },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550);
    return () => clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    if (!optionsOpen) return;
    switcher.current?.querySelector<HTMLButtonElement>('.option-choice')?.focus({ preventScroll: true });
    function dismiss(event: PointerEvent) {
      if (!switcher.current?.contains(event.target as Node)) setOptionsOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [optionsOpen]);

  function open(next: 'choices' | 'chat' | 'map') {
    setOptionsOpen(false);
    setView(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guide.loading || !guide.store.ready) return;
    if (!prompt.trim()) { input.current?.focus(); return; }
    sendQuestion(prompt);
  }

  function sendQuestion(question: string) {
    if (guide.loading || !guide.store.ready) return;
    setPrompt('');
    void guide.ask(question.trim());
    input.current?.focus({ preventScroll: true });
  }

  function showPlace(id: string) { setFocused(id); open('map'); }

  return (
    <main className={`ai-page${view === 'map' ? ' map-is-open' : expanded ? ' chat-is-open' : ''}`}>
      <header className="ai-header">
        <AtmosphereLink href="/" className="ai-brand"><span aria-label="Bilad">BI<span className="inverted">L</span>AD</span></AtmosphereLink>
        <div className="journey-map-links">{view === 'map' && <AtmosphereLink href="/journeys/">Your journeys ↗</AtmosphereLink>}<BackToTower href="/#guide" /></div>
      </header>
      <div className="ai-page-particles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="ai-ghost-tower" aria-hidden="true" />
      <section className="ai-core" aria-label="Milai local tour guide" onKeyDown={event => {
        if (event.key !== 'Escape') return;
        if (optionsOpen) { setOptionsOpen(false); switchButton.current?.focus(); }
        else if (view === 'chat') open('choices');
      }}>
        {view === 'choices' && <><div className="ai-mascot-halo"><img src="/assets/ai%20mascot.png" alt="Bilad local guide mascot" width="160" height="192" className="ai-mascot" /></div>
        <h1 className="ai-question-heading">Lost? don&apos;t know how to discover iraq?</h1></>}
        <div className={`discovery-stage view-${view}`}>
        {view === 'choices' && <div className="discovery-choices">
        <button ref={launch} type="button" disabled={!guide.store.ready} className="ai-composer ai-launch discovery-launch" onClick={() => open('chat')}>
          <span className="launch-spark" aria-hidden="true">✧</span>
          <span className="launch-label">Ask Milai</span>
          <span className="launch-trace" aria-hidden="true" />
        </button>
        <button type="button" disabled={!guide.store.ready} className="ai-composer ai-launch discovery-launch map-launch" onClick={() => open('map')}>
          <MapIcon /><span className="launch-label">Open map</span><span className="launch-trace" aria-hidden="true" />
        </button>
        </div>}
        {view !== 'choices' && <div className="discovery-switcher" ref={switcher}>
          <button ref={switchButton} type="button" className="options-orb" aria-label="More options" aria-expanded={optionsOpen} aria-controls="discovery-options" onClick={() => setOptionsOpen(!optionsOpen)}>
            <span className="option-dots" aria-hidden="true"><i /><i /><i /></span>
          </button>
          <div id="discovery-options" className="options-popover" hidden={!optionsOpen}>
            <button className="option-choice" type="button" onClick={() => open(expanded ? 'map' : 'chat')}>
              {expanded ? <MapIcon /> : <span className="option-spark" aria-hidden="true">✧</span>}
              {expanded ? 'Open map' : 'Ask Milai'}
            </button>
            <ReturnToChoices label="Both options" compact onClick={() => open('choices')} />
          </div>
        </div>}
        {expanded && <div className="chat-view milai-chat-shell">
        <header className="milai-chat-header">
          <div className="milai-chat-identity"><span className="milai-header-avatar"><img src="/assets/ai%20mascot.png" alt="" width="36" height="43" /></span><div><h1>Milai<span aria-hidden="true">✧</span></h1><p>Your Iraq companion</p></div></div>
          <button type="button" className="milai-map-link" aria-label="Explore your trip on the map" onClick={() => open('map')}><MapIcon/><span>Map</span></button>
        </header>
        <MilaiMessages guide={guide} onPlace={showPlace}/>
        <div className="milai-composer-dock">
        {!guide.lastQuestion && <div className="ai-suggestions milai-starter-prompts" aria-label="Suggested questions">
          {suggestions.map(suggestion => <button key={suggestion} type="button" disabled={guide.loading} onClick={() => sendQuestion(suggestion)}>{suggestion}<span aria-hidden="true">↗</span></button>)}
        </div>}
        <form id="guide-composer" className="ai-composer milai-chat-composer" onSubmit={submit}>
          <span className="composer-compass" aria-hidden="true">✧</span>
          <label className="visually-hidden" htmlFor="guide-prompt">What would you like to discover in Iraq?</label>
          <input id="guide-prompt" ref={input} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Ask Milai about Iraq…" autoComplete="off" maxLength={1000} />
          <button type="submit" aria-label="Begin conversation" disabled={guide.loading || !guide.store.ready || !prompt.trim()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
        </form>
        </div>
        </div>}
        {view === 'map' && <div ref={mapPanel} tabIndex={-1} className="trip-planner-panel" aria-label="Your Iraq trip planner"><TripPlanner trip={trip} onChange={guide.changeTrip} focused={focused} onFocus={setFocused} guideView={guide.guideView} onGuideViewHandled={guide.clearView} milai={<MilaiConversation guide={guide} onPlace={showPlace}/>}/></div>}
        </div>
      </section>
    </main>
  );
}
