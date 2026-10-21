'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { floorClipPaths as floors, towerOutline, clipCoordinateScale, staircaseSeamPaths, seamFocusY } from './tower-clips';
import { AtmosphereLink } from './AtmosphereTransition';
import ServiceLogos from './ServiceLogos';
import './services.css';
import { snippetMotion, springStep, towerMotion } from '@/lib/tower-motion';
import { createFloorGesture } from '@/lib/floor-gesture';
import './tower-motion.css';
import './explore-intro.css';
import './journeys-intro.css';

// Fixed values keep the server and browser render identical.
const embers = [
  [24, -3, 1.6, 17, -5, 24], [38, 2, 2, 15, -11, -18],
  [57, -5, 1.4, 19, -3, 30], [72, 5, 1.8, 16, -13, -25],
  [32, 8, 1.3, 18, -8, 20], [63, 1, 2.1, 14, -6, -15],
  [46, -7, 1.5, 17, -14, 28], [81, 3, 1.4, 20, -9, -30],
  [18, 6, 1.8, 16, -2, 22], [53, 9, 1.2, 19, -16, -20],
  [68, -2, 1.6, 18, -10, 18], [42, 4, 1.9, 15, -4, -24],
  [29, -6, 1.2, 20, -15, 32], [76, 10, 1.5, 17, -7, -18],
] as const;

const floorStories = [
  { title: 'Every layer tells a story.', text: 'Discover the places that shaped a culture.' },
  { title: 'Follow a different path.', text: 'Let curiosity lead you through Bilad.' },
  { title: 'Step into living heritage.', text: 'Find beauty in the details left behind.' },
  { title: 'Meet the heart of a place.', text: 'Its people. Its craft. Its everyday rituals.' },
  { title: 'Make room for discovery.', text: 'There is always another story around the corner.' },
  { title: 'Your journey starts here.', text: 'Explore Iraq, one story at a time.' },
] as const;

export default function Bilad() {
  const towerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const floorRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focusRef = useRef<HTMLDivElement>(null);
  const fadeRefs = useRef<(SVGGElement | null)[]>([]);
  const storyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const featureRef = useRef<HTMLDivElement>(null);
  const sayRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);
  const journeysRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let stage = -1;
    let touching = false;
    const wheelGesture = createFloorGesture();
    let travel = false;
    let velocity = 0;
    let touchX = 0;
    let touchY = 0;
    let touchFloor = 0;
    let touchAdvanced = false;
    let viewport = 1;
    let trackTop = 0;
    let towerHeight = 0;
    let sceneHeight = 0;
    let target = 0;
    let displayed = 0;
    let lastTime = 0;

    function measure() {
      const track = trackRef.current;
      if (!track) return;
      viewport = Math.max(1, track.querySelector('section')!.clientHeight);
      trackTop = window.scrollY + track.getBoundingClientRect().top;
      const tower = towerRef.current;
      towerHeight = tower?.clientHeight ?? 0;
      sceneHeight = tower?.parentElement?.parentElement?.clientHeight ?? viewport;
    }
    function readScroll() {
      target = reduced.matches ? 0 : Math.max(0, Math.min(floors.length - 1, (window.scrollY - trackTop) / viewport));
    }
    function paint() {
      const track = trackRef.current;
      if (!track) return;
      // Hysteresis keeps small trackpad reversals from replaying a snippet.
      if (stage < 0 || Math.abs(displayed - stage) > .57 || reduced.matches) {
        stage = Math.round(displayed);
        track.dataset.stage = String(stage);
      }
      const motion = towerMotion(displayed, viewport, towerHeight, sceneHeight, window.innerWidth < 600 ? 1.2 : 1.38);
      floorRefs.current.forEach((floor, index) => {
        if (!floor) return;
        floor.style.transform = `translate3d(0,${motion.offsets[index]}px,0)`;
        floor.style.opacity = String(motion.opacities[index]);
      });
      fadeRefs.current.forEach((fade, index) => {
        if (fade) fade.style.opacity = String(motion.feathers[Math.floor(index / 2)]);
      });
      [featureRef.current, sayRef.current, servicesRef.current, exploreRef.current, journeysRef.current].forEach((feature, index) => {
        if (!feature) return;
        const snippet = snippetMotion(displayed, index + 1);
        feature.style.setProperty('--snippet-opacity', String(snippet.opacity));
        feature.style.setProperty('--snippet-shift', `${snippet.shift}px`);
        const active = stage === index + 1 && snippet.opacity > .6;
        feature.inert = !active;
        feature.setAttribute('aria-hidden', String(!active));
      });
      storyRefs.current.forEach((story, index) => {
        if (!story) return;
        const snippet = snippetMotion(displayed, index + 1);
        const active = stage === index + 1 && snippet.opacity > .05;
        story.style.transform = `translate3d(0,${motion.stories[index]}px,0)`;
        story.style.setProperty('--snippet-opacity', String(snippet.opacity));
        story.style.setProperty('--snippet-shift', `${snippet.shift}px`);
        story.style.setProperty('--snippet-blur', `${snippet.blur}px`);
        story.dataset.active = String(active);
        story.setAttribute('aria-hidden', String(!active));
      });
      if (focusRef.current) focusRef.current.style.transform = `translate3d(0,${motion.cameraY}px,0) scale(${motion.zoom})`;
    }
    function animate(time: number) {
      const elapsed = lastTime ? Math.min(64, time - lastTime) : 16;
      lastTime = time;
      if (travel) {
        const spring = springStep(displayed, velocity, target, elapsed / 1000);
        displayed = spring.position;
        velocity = spring.velocity;
        if (Math.abs(target - displayed) < .001 && Math.abs(velocity) < .015) {
          displayed = target;
          velocity = 0;
          travel = false;
        }
        window.scrollTo({ top: trackTop + displayed * viewport, behavior: 'instant' });
      } else {
        displayed = reduced.matches ? target : displayed + (target - displayed) * (1 - Math.exp(-elapsed / 45));
      }
      const settled = !travel && Math.abs(target - displayed) < .0005;
      if (settled) displayed = target;
      paint();
      if (settled) { frame = null; lastTime = 0; }
      else frame = requestAnimationFrame(animate);
    }
    function queue() {
      if (frame === null) frame = requestAnimationFrame(animate);
    }
    function settle() {
      if (touching || travel || reduced.matches) return;
      if (Math.abs(target - Math.round(target)) < .002) return;
      moveTo(Math.round(target));
    }
    function schedule() {
      if (travel) return;
      readScroll();
      queue();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 100);
    }
    function moveTo(floor: number) {
      clearTimeout(settleTimer);
      target = Math.max(0, Math.min(floors.length - 1, floor));
      travel = true;
      queue();
    }
    function cancelTravel() {
      clearTimeout(settleTimer);
      if (!travel) return;
      travel = false;
      velocity = 0;
      readScroll();
    }
    function wheel(event: WheelEvent) {
      if (reduced.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport : 1);
      const next = wheelGesture.push(delta, performance.now(), target, floors.length - 1);
      if (next !== null) moveTo(next);
    }
    function resize() {
      const floor = Math.round(target);
      clearTimeout(settleTimer);
      travel = false; velocity = 0;
      measure();
      target = displayed = reduced.matches ? 0 : floor;
      window.scrollTo({ top: trackTop + target * viewport, behavior: 'instant' });
      queue();
    }
    function restoreReveal() {
      const floor = ({ '#guide': 1, '#say-it': 2, '#services': 3, '#explore': 4, '#journeys': 5 } as Record<string, number>)[window.location.hash];
      if (floor === undefined || reduced.matches) return;
      clearTimeout(settleTimer);
      measure(); travel = false; velocity = 0;
      target = displayed = floor;
      window.scrollTo({ top: trackTop + floor * viewport, behavior: 'instant' });
      paint();
    }
    function touchStart(event: TouchEvent) {
      if (event.touches.length !== 1) { touching = false; return; }
      touching = true;
      clearTimeout(settleTimer);
      touchX = event.touches[0].clientX;
      touchY = event.touches[0].clientY;
      touchFloor = Math.round(target);
      touchAdvanced = false;
    }
    function touchMove(event: TouchEvent) {
      if (reduced.matches || !touching || event.touches.length !== 1) return;
      const distance = touchY - event.touches[0].clientY;
      if (Math.abs(distance) < Math.abs(touchX - event.touches[0].clientX)) return;
      event.preventDefault();
      if (touchAdvanced || Math.abs(distance) < 6) return;
      touchAdvanced = true;
      moveTo(touchFloor + Math.sign(distance));
    }
    function touchEnd() { touching = false; if (!travel) schedule(); }
    function keyDown(event: KeyboardEvent) {
      if (reduced.matches || event.ctrlKey || event.altKey || event.metaKey) return;
      const element = event.target as HTMLElement;
      if (element.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === ' ' && element.closest('a,button')) return;
      if (event.key === 'Home' || event.key === 'End') { cancelTravel(); wheelGesture.reset(); return; }
      if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(event.key)) return;
      event.preventDefault();
      if (event.repeat) return;
      const direction = event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -1 : 1;
      moveTo(Math.round(target) + direction);
    }
    function pointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse') cancelTravel();
    }
    measure();
    readScroll();
    displayed = target;
    paint();
    const entryFrame = requestAnimationFrame(restoreReveal);
    window.addEventListener('hashchange', restoreReveal);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointerdown', pointerDown, { passive: true });
    window.addEventListener('keydown', keyDown);
    reduced.addEventListener('change', resize);
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('touchend', touchEnd, { passive: true });
    window.addEventListener('touchcancel', touchEnd, { passive: true });
    return () => {
      cancelAnimationFrame(entryFrame);
      window.removeEventListener('hashchange', restoreReveal);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resize);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('keydown', keyDown);
      reduced.removeEventListener('change', resize);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('touchend', touchEnd);
      window.removeEventListener('touchcancel', touchEnd);
      clearTimeout(settleTimer);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const tower = towerRef.current;
    if (!tower) return;
    const enabled = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    let frame: number | null = null;
    let x = 0;
    let y = 0;

    function reset() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      tower!.style.setProperty('--cursor-x', '0px');
      tower!.style.setProperty('--cursor-y', '0px');
    }

    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      const nx = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1));
      const ny = Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1));
      const length = Math.max(1, Math.hypot(nx, ny));
      x = nx / length * 4;
      y = ny / length * 4;
      if (frame === null) frame = requestAnimationFrame(() => {
        tower!.style.setProperty('--cursor-x', `${x.toFixed(2)}px`);
        tower!.style.setProperty('--cursor-y', `${y.toFixed(2)}px`);
        frame = null;
      });
    }

    function sync() {
      window.removeEventListener('pointermove', move);
      reset();
      if (enabled.matches) window.addEventListener('pointermove', move, { passive: true });
    }

    sync();
    enabled.addEventListener('change', sync);
    window.addEventListener('blur', reset);
    document.documentElement.addEventListener('pointerleave', reset);
    return () => {
      enabled.removeEventListener('change', sync);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', reset);
      document.documentElement.removeEventListener('pointerleave', reset);
      reset();
    };
  }, []);

  return (
    <main className="scroll-journey" ref={trackRef}>
      <div id="guide" className="guide-anchor" aria-hidden="true" />
      <div id="say-it" className="say-anchor" aria-hidden="true" />
      <div id="services" className="services-anchor" aria-hidden="true" />
      <div id="explore" className="explore-anchor" aria-hidden="true" />
      <div id="journeys" className="journeys-anchor" aria-hidden="true" />
      <svg className="tower-clip-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="floor-feather" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1536" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="24" />
          </filter>
          <filter id="floor-feather-edge" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1536" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          {floors.map((_, index) => (
            <mask id={`floor-fade-${index}`} key={index} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1" style={{ maskType: 'luminance' }}>
              <rect width="1" height="1" fill="white" />
              <g transform={clipCoordinateScale}>
                {[index - 1, index].filter(seam => seam >= 0 && seam < staircaseSeamPaths.length).map(seam => (
                  <g key={seam} ref={element => { fadeRefs.current[seam * 2 + (seam === index ? 0 : 1)] = element; }} className="floor-feather" style={{ opacity: 0 }}>
                    <path d={staircaseSeamPaths[seam]} fill="none" stroke="black" strokeWidth="112" strokeLinecap="round" filter="url(#floor-feather)" />
                    <path d={staircaseSeamPaths[seam]} fill="none" stroke="black" strokeWidth="38" strokeLinecap="round" filter="url(#floor-feather-edge)" />
                  </g>
                ))}
              </g>
            </mask>
          ))}
          <clipPath id="tower-outline" clipPathUnits="objectBoundingBox">
            <path d={towerOutline} transform={clipCoordinateScale} />
          </clipPath>
          {floors.map((path, index) => (
            <clipPath id={`tower-floor-${index}`} key={index} clipPathUnits="objectBoundingBox">
              <path d={path} transform={clipCoordinateScale} />
            </clipPath>
          ))}
        </defs>
      </svg>
      <section className="opening" aria-label="Scroll to lift the Malwiya tower floors, top to bottom">
        <div className="wordmark-focus">
          <h1 className="wordmark" aria-label="Bilad" dir="ltr">
            <span>B</span><span>I</span><span className="inverted">L</span><span>A</span><span>D</span>
          </h1>
        </div>
        <div ref={featureRef} className="ai-feature floor-snippet" aria-label="Meet the Bilad AI guide" inert>
          <div className="ai-feature-content">
            <img className="feature-mascot" src="/assets/ai%20mascot.png" alt="Bilad’s friendly blue spiral mascot" width="112" height="134" />
            <h2>Find your way through Iraq.</h2>
            <p>Meet your AI tour guide.</p>
            <AtmosphereLink href="/ai/" className="guide-cta">
              <span>Meet Milai</span>
              <span className="guide-cta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M6 12h11" />
                  <path d="m13 8 4 4-4 4" />
                </svg>
              </span>
            </AtmosphereLink>
          </div>
        </div>
        <div ref={sayRef} className="say-feature floor-snippet" aria-label="Say it in Iraq" inert>
          <div className="say-feature-content">
            <img className="say-welcome" src="/assets/hala-wordmark.png" alt="هلا" width="1536" height="1024" draggable="false" />
            <span className="say-welcome-meaning">A little hello goes a long way.</span>
            <AtmosphereLink href="/say-it/" className="say-doorway">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" /></svg>
              <span>Say it in Iraq</span><span aria-hidden="true">↗</span>
            </AtmosphereLink>
          </div>
        </div>
        <div ref={servicesRef} className="services-feature floor-snippet" aria-label="Daleel service apps" inert>
          <div className="services-feature-content">
            <ServiceLogos />
            <h2><span>You want a taxi?</span><span>Order or get internet.</span></h2>
            <p>Then use Daleel.</p>
            <AtmosphereLink href="/services/" className="guide-cta">
              <span>Open Daleel</span>
              <span className="guide-cta-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 12h11" /><path d="m13 8 4 4-4 4" /></svg></span>
            </AtmosphereLink>
          </div>
        </div>
        <div ref={exploreRef} className="explore-feature floor-snippet" aria-label="Bap" inert>
          <div className="explore-feature-content">
            <img className="explore-bap-logo" src="/assets/Bap%20logo.png" alt="Bap logo" width="1254" height="1254" draggable="false" />
            <h2>Bap</h2><p>Explore its places, stories, and paths.</p>
            <AtmosphereLink href="/explore/" className="guide-cta">
              <span>Open Bap</span>
              <span className="guide-cta-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 12h11" /><path d="m13 8 4 4-4 4" /></svg></span>
            </AtmosphereLink>
          </div>
        </div>
        <div ref={journeysRef} className="journeys-feature floor-snippet" aria-label="Your journeys" inert>
          <div className="journeys-feature-content">
            <div className="journeys-mini-cards" aria-hidden="true">
              <div><div className="journey-symbol"><img src="/assets/journey-icons/ideas-1.svg" alt="" width="96" height="96" draggable="false"/></div><span>Ideas</span><small>A spark of possibility</small></div>
              <div><div className="journey-symbol"><img src="/assets/journey-icons/planned-1.svg" alt="" width="96" height="96" draggable="false"/></div><span>Planned</span><small>A path taking shape</small></div>
              <div><div className="journey-symbol"><img src="/assets/journey-icons/done-1.svg" alt="" width="96" height="96" draggable="false"/></div><span>Done</span><small>A memory to keep</small></div>
            </div>
            <h2>Every journey, yours.</h2><p>Keep your ideas, plans, and memories together.</p>
            <AtmosphereLink href="/journeys/" className="guide-cta"><span>Open your journeys</span><span className="guide-cta-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 12h11" /><path d="m13 8 4 4-4 4" /></svg></span></AtmosphereLink>
          </div>
        </div>
        <div className="reduced-feature-links">
          <AtmosphereLink href="/ai/">Meet Milai →</AtmosphereLink>
          <AtmosphereLink href="/say-it/">Say it in Iraq →</AtmosphereLink>
          <AtmosphereLink href="/services/">Open Daleel →</AtmosphereLink>
          <AtmosphereLink href="/explore/">Bap →</AtmosphereLink>
          <AtmosphereLink href="/journeys/">Your journeys →</AtmosphereLink>
        </div>
      <div className="camera-frame">
        <div className="scene">
          <div className="atmosphere" aria-hidden="true" />
          <div className="tower-wrap">
            <div ref={towerRef} className="tower" role="group" aria-label="Malwiya Minaret of Samarra, separated into seven scroll-animated tiers">
              <div className="tower-focus" ref={focusRef}>
              <div className="tower-canvas">
                {floors.map((_, index) => (
                  <div key={index} ref={element => { floorRefs.current[index] = element; }} className="tower-floor" aria-hidden="true" style={{ clipPath: `url(#tower-floor-${index})`, zIndex: floors.length - index }}>
                    <div className="floor-surface" style={{ maskImage: `url(#floor-fade-${index})` }}>
                      <img className={`floor-image${index === floors.length - 1 ? ' floor-image-base' : ''}`} src="/assets/malwiya.png" alt="" fetchPriority={index === 0 ? 'high' : 'auto'} draggable="false" />
                    </div>
                  </div>
                ))}
                {floorStories.map((story, index) => (
                  <div key={story.title} ref={element => { storyRefs.current[index] = element; }} className="floor-story" aria-hidden="true" data-active="false" style={{ top: `${seamFocusY[index] / 1536 * 100}%` }}>
                    <div className={`floor-story-copy${index < 5 ? ' replaced-by-ai' : ''}`}>
                      <span className="floor-story-number">{String(index + 1).padStart(2, '0')} / BILAD</span>
                      <h2>{story.title}</h2>
                      <p>{story.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
          <div className="embers" aria-hidden="true">
            {embers.map(([left, bottom, size, duration, delay, drift], index) => (
              <span key={index} className="ember" style={{
                left: `${left}%`, bottom: `${bottom}%`, width: `${size}px`, height: `${size}px`,
                '--ember-duration': `${duration}s`, '--ember-delay': `${delay}s`, '--ember-drift': `${drift}px`,
              } as CSSProperties} />
            ))}
          </div>
        </div>
      </div>
      </section>
    </main>
  );
}
