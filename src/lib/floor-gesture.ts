/** Consume a wheel burst, including its momentum tail, at most once. */
export function createFloorGesture() {
  let lastEvent = -Infinity;
  let consumed = false;
  let accumulated = 0;
  let direction = 0;
  return {
    push(delta: number, time: number, floor: number, lastFloor: number): number | null {
      if (time - lastEvent > 100) { consumed = false; accumulated = 0; }
      lastEvent = time;
      // A reversal is new intent, even while the camera is still moving.
      if (consumed && Math.sign(delta) === direction) { accumulated = 0; return null; }
      if (Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0;
      accumulated += delta;
      if (Math.abs(accumulated) < 2) return null;
      consumed = true;
      direction = Math.sign(accumulated);
      const next = Math.max(0, Math.min(lastFloor, Math.round(floor) + direction));
      return next === Math.round(floor) ? null : next;
    },
    reset() { lastEvent = -Infinity; consumed = false; accumulated = 0; direction = 0; },
  };
}
