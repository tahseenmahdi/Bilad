'use client';

import BackToTower from './BackToTower';

import { useEffect, useRef, useState } from 'react';
import { expressionCategories, expressions, type ExpressionCategory } from '@/lib/expressions';
import { AtmosphereLink } from './AtmosphereTransition';
import TaxiIcon from './TaxiIcon';
import TravelShortcuts from './TravelShortcuts';
import { useCategoryHash } from '@/lib/use-category-hash';
import './say-it.css';

function MomentIcon({ category }: { category: ExpressionCategory }) {
  if (category === 'taxi') return <span className="moment-icon moment-icon-taxi" aria-hidden="true"><TaxiIcon /></span>;
  const paths = {
    hello: <><path d="M5.5 16.5 4 20l4.6-2H18a3.5 3.5 0 0 0 3.5-3.5v-6A3.5 3.5 0 0 0 18 5H7A3.5 3.5 0 0 0 3.5 8.5v4.5a3.5 3.5 0 0 0 2 3.5Z" /><path d="M8 10h7.5M8 13.5h4" /></>,
    table: <><path d="M4.5 9h13v5.5a5.5 5.5 0 0 1-5.5 5.5h-2a5.5 5.5 0 0 1-5.5-5.5Z" /><path d="M17.5 10.5h1.2a2.8 2.8 0 0 1 0 5.5h-1.2M8 4v2M13 3v3" /></>,
    market: <><path d="m3.5 8.5 1.8-4h13.4l1.8 4" /><path d="M4 8.5h16v12H4Z" /><path d="M3.5 8.5c.2 2 1.3 3 2.8 3s2.5-1 2.7-3c.2 2 1.2 3 2.7 3s2.5-1 2.7-3c.2 2 1.2 3 2.7 3s2.6-1 2.7-3c.2 2 1.2 3 2.5 3" /></>,
    kindness: <><path d="M12 20s-7.7-4.7-8.9-9C2 7.2 4.1 4.5 7 4.5c2.1 0 3.7 1.2 5 3 1.3-1.8 2.9-3 5-3 2.9 0 5 2.7 3.9 6.5C19.7 15.3 12 20 12 20Z" /><path d="M8.5 11.5h.1M15.4 11.5h.1" /></>,
    goodbye: <><path d="M4 15a8 8 0 0 1 16 0" /><path d="M12 3v2M4.9 5.9l1.4 1.4M19.1 5.9l-1.4 1.4M2.5 15h19" /><path d="M7 19h10M9.5 22h5" /></>,
  };
  return <span className={`moment-icon moment-icon-${category}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">{paths[category]}</svg></span>;
}

function SoundIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></svg>;
}

export default function SayIt({ recordings }: { recordings: Record<string, string> }) {
  const [category, setCategory] = useCategoryHash(expressionCategories, 'hello');
  const [selected, setSelected] = useState('hala');
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [playback, setPlayback] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  const request = useRef(0);
  const collection = expressions.filter(item => item.category === category);
  const phrase = collection.find(item => item.id === selected) ?? collection[0];
  const currentCategory = expressionCategories.find(item => item.id === category)!;

  function stop() {
    request.current++;
    if (audio.current) {
      audio.current.pause();
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current = null;
    }
    setPlayback('idle');
  }

  useEffect(() => { stop(); }, [category]);

  useEffect(() => {
    function pauseWhenHidden() {
      if (document.hidden) stop();
    }
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      request.current++;
      if (audio.current) {
        audio.current.onended = null;
        audio.current.onerror = null;
        audio.current.pause();
      }
      document.removeEventListener('visibilitychange', pauseWhenHidden);
    };
  }, []);

  function choose(id: string) {
    stop();
    setCopyError(false);
    setSelected(id);
  }

  function changeCategory(next: ExpressionCategory) {
    choose(expressions.find(item => item.category === next)!.id);
    setCategory(next);
  }

  async function play() {
    if (playback === 'playing' || playback === 'loading') { stop(); return; }
    if (!recordings[phrase.id]) return;
    stop();
    const token = request.current;
    const clip = new Audio(recordings[phrase.id]);
    audio.current = clip;
    setPlayback('loading');
    clip.onended = () => { if (request.current === token) setPlayback('idle'); };
    clip.onerror = () => { if (request.current === token) setPlayback('error'); };
    try {
      await clip.play();
      if (request.current === token) setPlayback('playing');
    } catch {
      if (request.current === token) setPlayback('error');
    }
  }

  async function copyPhrase() {
    try {
      await navigator.clipboard.writeText(phrase.arabic);
      setCopied(phrase.id);
      setCopyError(false);
    } catch { setCopyError(true); }
  }

  return (
    <main className="say-page">
      <header className="ai-header">
        <AtmosphereLink href="/" className="ai-brand"><span aria-label="Bilad">BI<span className="inverted">L</span>AD</span></AtmosphereLink>
        <BackToTower href="/#say-it" />
      </header>
      <div className="say-content">
        <div className="say-intro">
          <span className="say-eyebrow">A LITTLE CLOSER TO IRAQ</span>
          <h1>Say it in Iraq<span>.</span></h1>
          <p>A few words. A shared smile. A moment to take with you.</p>
        </div>
        <nav className="moment-categories" aria-label="Choose a moment">
          {expressionCategories.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => changeCategory(item.id)}>
            <MomentIcon category={item.id} /><span>{item.label}</span>
          </button>)}
        </nav>
        <section className="say-experience" aria-label={currentCategory.label}>
          <div className="phrase-focus">
            <span className="moment-invitation">{currentCategory.invitation}</span>
            <div key={phrase.id} className="phrase-arrival" aria-live="polite" aria-atomic="true">
              <h2 lang="ar-IQ" dir="rtl">{phrase.arabic}</h2>
              <p className="phrase-meaning">{phrase.meaning}</p>
              <p className="phrase-moment">{phrase.moment}</p>
            </div>
            <button type="button" className={`phrase-listen${playback === 'playing' ? ' is-playing' : ''}`} disabled={!recordings[phrase.id]} onClick={play} aria-label={!recordings[phrase.id] ? 'Voice recording coming soon' : `${playback === 'playing' || playback === 'loading' ? 'Stop' : 'Hear'} ${phrase.meaning}`}>
              <SoundIcon />
              <span>{!recordings[phrase.id] ? 'Voice coming soon' : playback === 'playing' ? 'Stop listening' : playback === 'loading' ? 'Cancel loading' : playback === 'error' ? 'Try again' : 'Hear it in Iraq'}</span>
              <span className="sound-bars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            </button>
            <button type="button" className="phrase-copy" onClick={copyPhrase}>{copied === phrase.id ? '✓ Copied' : 'Copy Arabic phrase'}</button>
            {copyError && <p className="phrase-copy-error" role="status">Select the Arabic text above to copy it.</p>}
            <div className="audio-status" role="status">{playback === 'error' ? 'The recording couldn’t play. Please try again.' : playback === 'loading' ? 'Loading voice…' : ''}</div>
          </div>
          <div className="phrase-collection">
            <div className="collection-heading"><span>{currentCategory.label}</span><span>{String(collection.length).padStart(2, '0')} EXPRESSIONS</span></div>
            {collection.map((item, index) => <button key={item.id} type="button" className="phrase-row" aria-pressed={item.id === phrase.id} onClick={() => choose(item.id)}>
              <span className="phrase-number">0{index + 1}</span>
              <span className="phrase-row-copy"><span lang="ar-IQ" dir="rtl">{item.arabic}</span><span>{item.meaning}</span></span>
              <span className="phrase-row-arrow" aria-hidden="true">↗</span>
            </button>)}
          </div>
        </section>
        {category === 'taxi' && <TravelShortcuts context="phrases" />}
        <footer className="say-footer"><span>Everyday Iraqi Arabic · {expressions.length} expressions</span><span>Listen, learn, and take a phrase with you.</span></footer>
      </div>
    </main>
  );
}
