/** Every timed animation, and the reduce-motion switch. */

export const TIMING = {
  mark: 240,
  spark: 400,
  dim: 300,
  light: 450,
  lightDelay: 250,
  glide: 450,
  panelWon: 1100,
  gameWon: 2400,
  resultRise: 300,
  hover: 120,
  reduced: 150,
};

export const EASE = {
  mark: 'cubic-bezier(.2, .9, .3, 1.2)',
  glide: 'cubic-bezier(.3, 0, .2, 1)',
};

let reduced = false;

export function setReducedMotion(on: boolean): void {
  reduced = on;
  document.documentElement.classList.toggle('reduce-motion', on);
}
export function reducedMotion(): boolean {
  return reduced;
}
export function systemReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Frames = Keyframe[] | PropertyIndexedKeyframes;

/** Runs a Web Animation unless motion is reduced. */
export function animate(el: Element, frames: Frames, opts: KeyframeAnimationOptions): Animation | null {
  if (reduced || typeof el.animate !== 'function') return null;
  return el.animate(frames, { fill: 'backwards', ...opts });
}

/** Pieces scale from 0.9 to 1 and flash, and the lead draws in. */
export function markPlaced(pieces: SVGGElement, lead: SVGPathElement | null, flash: SVGElement | null): void {
  animate(pieces, [{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: TIMING.mark, easing: EASE.mark });
  if (flash) animate(flash, [{ opacity: 0.6 }, { opacity: 0 }], { duration: TIMING.mark, easing: 'ease-out' });
  if (lead) animate(lead, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: TIMING.mark, easing: 'ease-out' });
}

/** A spark runs along the lead from the pane played to the target panel. */
export function runSpark(path: SVGPathElement, d: string): void {
  if (reduced) return;
  path.setAttribute('d', d);
  const len = path.getTotalLength();
  const dash = Math.min(150, len * 0.5);
  path.style.strokeDasharray = `${dash} ${len + dash}`;
  path.getAnimations().forEach((a) => a.cancel());
  path.animate(
    [
      { strokeDashoffset: dash, opacity: 1 },
      { strokeDashoffset: -len * 0.9, opacity: 1, offset: 0.9 },
      { strokeDashoffset: -len, opacity: 0 },
    ],
    { duration: TIMING.spark, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'both' },
  );
}
