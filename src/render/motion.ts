/** Every timed animation, and the reduce-motion switch. */

export const TIMING = {
  mark: 240,
  light: 450,
  gameWon: 2400,
  resultRise: 300,
  hover: 120,
  reduced: 150,
};

export const EASE = {
  mark: 'cubic-bezier(.2, .9, .3, 1.2)',
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
