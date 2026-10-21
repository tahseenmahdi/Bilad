import { seamFocusY } from '../components/tower-clips.ts';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

/** Preserve velocity when the destination changes, including mid-scroll reversals. */
export function springStep(position: number, velocity: number, target: number, seconds: number) {
  const frequency = 11;
  const offset = position - target;
  const impulse = velocity + frequency * offset;
  const decay = Math.exp(-frequency * seconds);
  return {
    position: target + (offset + impulse * seconds) * decay,
    velocity: (velocity - frequency * impulse * seconds) * decay,
  };
}

export function snippetMotion(position: number, floor: number) {
  const distance = position - floor;
  const opacity = 1 - ease((Math.abs(distance) - .1) / .46);
  return { opacity, shift: -distance * 30, blur: (1 - opacity) * 3 };
}

/** Interpolate complete poses so the camera, cut edges and copy share one clock. */
export function towerMotion(progress: number, viewport: number, towerHeight: number, sceneHeight: number, zoom: number) {
  const position = Math.max(0, Math.min(seamFocusY.length, progress));
  const from = Math.floor(position);
  const to = Math.min(seamFocusY.length, from + 1);
  // The spring already eases movement; a second ease here creates sticky stops.
  const amount = position - from;
  function pose(stage: number) {
    const gap = viewport * (stage <= 3 ? .4 : .3);
    const scale = stage === 0 ? 1 : zoom;
    const cameraY = stage === 0 ? 0 : -sceneHeight * .51 + (towerHeight * (1 - seamFocusY[stage - 1] / 1536) + gap / 2) * scale;
    return {
      offsets: Array.from({ length: seamFocusY.length + 1 }, (_, index) => -Math.max(0, stage - index) * gap),
      opacities: Array.from({ length: seamFocusY.length + 1 }, (_, index) => {
        const distance = Math.max(0, stage - 1 - index, index - stage);
        return stage === 0 || distance === 0 ? 1 : Math.max(.32, .68 - distance * .12);
      }),
      stories: seamFocusY.map((_, index) => -Math.max(0, stage - index - .5) * gap),
      cameraY, scale,
    };
  }
  const a = pose(from);
  const b = pose(to);
  return {
    offsets: a.offsets.map((value, index) => mix(value, b.offsets[index], amount)),
    opacities: a.opacities.map((value, index) => mix(value, b.opacities[index], amount)),
    stories: a.stories.map((value, index) => mix(value, b.stories[index], amount)),
    feathers: seamFocusY.map((_, index) => mix(from > index ? 1 : 0, to > index ? 1 : 0, amount)),
    cameraY: mix(a.cameraY, b.cameraY, amount),
    zoom: mix(a.scale, b.scale, amount),
  };
}
