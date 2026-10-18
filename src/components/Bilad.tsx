'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

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

// Coordinates follow the spiral seams in the original 1024 × 1536 image.
// Every layer shares the same canvas, so scrolling back restores alignment.
const floors = [
  'polygon(43.6% 6.8%,47% 6%,53.7% 6.1%,56% 7.4%,56.2% 8.1%,58.1% 9.4%,58.3% 15.4%,57.1% 15.4%,52% 16.2%,46.5% 17.6%,41.8% 18.7%,41.8% 10.3%,42.2% 9.2%,43.6% 8.7%)',
  'polygon(41.8% 18.5%,46.5% 17.4%,52% 16%,57.1% 15.2%,59.5% 16%,59.8% 25.5%,52.7% 26.6%,44% 28.1%,37.3% 29%,37.3% 22.8%,38.5% 20.9%)',
  'polygon(37.3% 28.8%,44% 27.9%,52.7% 26.4%,59.6% 25.3%,63.9% 26.5%,64.2% 39.6%,54% 40.7%,41% 42.6%,32.4% 44.4%,32.4% 32%,33.4% 30.8%)',
  'polygon(32.4% 44.2%,41% 42.4%,54% 40.5%,64.2% 39.4%,68% 41%,68.6% 54.1%,57% 55.5%,40% 58%,27.9% 60%,27.9% 49%,29.4% 47%)',
  'polygon(27.9% 59.8%,40% 57.8%,57% 55.3%,68.6% 53.9%,72.8% 55.7%,73.5% 69.8%,60% 71.4%,40% 74%,23.3% 76.1%,23.3% 64%,24.5% 62%)',
  'polygon(23.3% 75.9%,40% 73.8%,60% 71.2%,73.5% 69.6%,77% 71%,77.3% 89.4%,18% 89.4%,18% 80%,19.6% 78.4%)',
  'polygon(18% 89.2%,77.3% 89.2%,78.3% 89.8%,78.3% 90.7%,85.8% 93.2%,85.8% 97.5%,14.2% 97.5%,14.2% 93.5%,15.3% 92.7%,15.3% 90.3%)',
] as const;

export default function Bilad() {
  const towerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const floorRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    function update() {
      frame = null;
      const track = trackRef.current;
      if (!track) return;
      const viewport = window.innerHeight;
      const progress = reduced.matches ? 0 : Math.max(0, -track.getBoundingClientRect().top / viewport);
      floorRefs.current.forEach((floor, index) => {
        const p = Math.min(1, Math.max(0, progress - index));
        const eased = p * p * (3 - 2 * p);
        if (floor) floor.style.transform = `translate3d(0,${-eased * viewport * 1.15}px,0)`;
      });
    }
    function schedule() {
      if (frame === null) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduced.removeEventListener('change', schedule);
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
      <section className="opening" aria-label="Scroll to lift the Malwiya tower floors, top to bottom">
      <div className="camera-frame">
        <div className="scene">
          <div className="atmosphere" aria-hidden="true" />
          <h1 className="wordmark" aria-label="Bilad" dir="ltr">
            <span>B</span><span>I</span><span className="inverted">L</span><span>A</span><span>D</span>
          </h1>
          <div className="tower-wrap">
            <div ref={towerRef} className="tower" role="img" aria-label="Malwiya Minaret of Samarra, separated into seven scroll-animated tiers">
              <div className="tower-canvas">
                {floors.map((clipPath, index) => (
                  <div key={index} ref={element => { floorRefs.current[index] = element; }} className="tower-floor" aria-hidden="true" style={{ clipPath, zIndex: floors.length - index }}>
                    <img className="floor-image" src="/assets/malwiya.png" alt="" fetchPriority={index === 0 ? 'high' : 'auto'} draggable="false" />
                  </div>
                ))}
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
