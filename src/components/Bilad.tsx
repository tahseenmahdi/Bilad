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

export default function Bilad() {
  const towerRef = useRef<HTMLImageElement>(null);

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
    <main className="opening">
      <div className="camera-frame">
        <div className="scene">
          <div className="atmosphere" aria-hidden="true" />
          <h1 className="wordmark" aria-label="Bilad" dir="ltr">
            <span>B</span><span>I</span><span className="inverted">L</span><span>A</span><span>D</span>
          </h1>
          <div className="tower-wrap">
            <img ref={towerRef} className="tower" src="/assets/malwiya.png" alt="Malwiya Minaret of Samarra" fetchPriority="high" draggable="false" />
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
    </main>
  );
}
