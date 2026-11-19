/**
 * Interactive backgrounds. They are scenery only: they never touch the game.
 * Each scene is drawn in code on one canvas behind the page.
 */
import { SpaceScene } from './space';
import { OceanScene } from './ocean';

export type BackgroundId = 'space' | 'ocean';

export const BACKGROUNDS: { id: BackgroundId; name: string }[] = [
  { id: 'space', name: 'Space' },
  { id: 'ocean', name: 'Ocean' },
];

/** Reads a background name, accepting the names an earlier build saved. */
export function toBackground(value: unknown): BackgroundId {
  return typeof value === 'string' && value.startsWith('ocean') ? 'ocean' : 'space';
}

export interface Pointer {
  x: number;
  y: number;
  /** The pointer is over open background, not over the game. */
  active: boolean;
  /** Pixels a second, smoothed. */
  speed: number;
}

export interface CardContent {
  title: string;
  subtitle?: string;
  rows: [string, string][];
  note?: string;
  /** Draws the little picture into a square canvas of side `size`. */
  draw(ctx: CanvasRenderingContext2D, size: number): void;
}

export interface Focus {
  id: string;
  x: number;
  y: number;
  /** An area the card should leave uncovered, such as the constellation the star belongs to. */
  keep?: { x: number; y: number; w: number; h: number };
  card(): CardContent;
}

export interface Scene {
  resize(w: number, h: number, avoid: DOMRect | null): void;
  /** Draws one frame and returns what the pointer is resting on, if anything. */
  frame(ctx: CanvasRenderingContext2D, t: number, dt: number, pointer: Pointer): Focus | null;
  /** Points the pointer can rest on to open a card. Used by the tests. */
  targets(): { id: string; x: number; y: number }[];
  /** Constellations on screen, for scenes that have them. */
  figures?(): { name: string; show: number; stars: string[] }[];
}

const DWELL_MS = 420;

export class Background {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private cardEl: HTMLElement;
  private scene: Scene | null = null;
  private id: BackgroundId | 'none' = 'none';
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private pointer: Pointer = { x: -999, y: -999, active: false, speed: 0 };
  private touchTimer = 0;
  private focusId = '';
  private focusSince = 0;
  private shownId = '';
  private avoid: () => DOMRect | null;
  private reduce = false;

  constructor(canvas: HTMLCanvasElement, card: HTMLElement, avoid: () => DOMRect | null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cardEl = card;
    this.avoid = avoid;

    const over = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const solid = !!target?.closest?.('[data-solid], button, input, select, a, dialog, label');
      const p = this.pointer;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (p.active) p.speed = Math.min(2000, p.speed * 0.6 + Math.hypot(dx, dy) * 24);
      p.x = e.clientX;
      p.y = e.clientY;
      p.active = !solid;
    };
    window.addEventListener('pointermove', over, { passive: true });
    window.addEventListener(
      'pointerdown',
      (e) => {
        over(e);
        if (e.pointerType !== 'mouse') {
          // A touch has no hover, so it lingers for a moment instead.
          window.clearTimeout(this.touchTimer);
          this.touchTimer = window.setTimeout(() => (this.pointer.active = false), 4000);
        }
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => (this.pointer.active = false));
    window.addEventListener('blur', () => (this.pointer.active = false));
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else this.play();
    });
  }

  targets(): { id: string; x: number; y: number }[] {
    return this.scene?.targets() ?? [];
  }

  figures(): { name: string; show: number; stars: string[] }[] {
    return this.scene?.figures?.() ?? [];
  }

  get current(): BackgroundId | 'none' {
    return this.id;
  }

  /**
   * Reduced motion draws the same scene with fewer things and less movement.
   * 'none' leaves the page bare; only the tests ask for it.
   */
  set(id: BackgroundId | 'none', reduce: boolean): void {
    if (id === this.id && reduce === this.reduce && (this.scene || id === 'none')) return;
    this.id = id;
    this.reduce = reduce;
    this.hideCard();
    document.documentElement.dataset.bg = id;
    this.scene = id === 'space' ? new SpaceScene(!reduce) : id === 'ocean' ? new OceanScene(!reduce) : null;
    this.canvas.hidden = !this.scene;
    this.resize();
    if (this.scene) this.play();
    else this.pause();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scene?.resize(this.w, this.h, this.avoid());
  }

  private play(): void {
    if (this.raf || !this.scene || document.hidden) return;
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      const ctx = this.ctx;
      if (!ctx || !this.scene) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.pointer.speed *= Math.pow(0.02, dt);
      if (this.pointer.active && document.querySelector('dialog[open]')) this.pointer.active = false;
      const focus = this.scene.frame(ctx, now / 1000, dt, this.pointer);
      this.track(focus, now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private pause(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private track(focus: Focus | null, now: number): void {
    const id = focus?.id ?? '';
    if (id !== this.focusId) {
      this.focusId = id;
      this.focusSince = now;
      if (this.shownId && id !== this.shownId) this.hideCard();
    }
    if (focus && this.shownId !== id && now - this.focusSince >= DWELL_MS) this.showCard(focus);
    else if (focus && this.shownId === id) this.place(focus.x, focus.y, focus.keep);
  }

  private showCard(focus: Focus): void {
    const c = focus.card();
    const card = this.cardEl;
    card.replaceChildren();
    const size = 88;
    const pic = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pic.width = pic.height = size * dpr;
    pic.style.width = pic.style.height = `${size}px`;
    const pctx = pic.getContext('2d');
    if (pctx) {
      pctx.scale(dpr, dpr);
      c.draw(pctx, size);
    }
    card.appendChild(pic);
    const text = document.createElement('div');
    const h = document.createElement('strong');
    h.textContent = c.title;
    text.appendChild(h);
    if (c.subtitle) {
      const s = document.createElement('span');
      s.className = 'bg-card-sub';
      s.textContent = c.subtitle;
      text.appendChild(s);
    }
    const dl = document.createElement('dl');
    for (const [k, v] of c.rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    text.appendChild(dl);
    if (c.note) {
      const p = document.createElement('p');
      p.textContent = c.note;
      text.appendChild(p);
    }
    card.appendChild(text);
    card.hidden = false;
    this.shownId = focus.id;
    this.place(focus.x, focus.y, focus.keep);
    requestAnimationFrame(() => card.classList.add('show'));
  }

  /** Beside the pointer, on whichever side keeps the card on screen and off the game. */
  private place(x: number, y: number, keep?: { x: number; y: number; w: number; h: number }): void {
    const card = this.cardEl;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const gap = 26;
    const clampX = (v: number) => Math.max(8, Math.min(this.w - cw - 8, v));
    const clampY = (v: number) => Math.max(8, Math.min(this.h - ch - 8, v));
    const hole = this.avoid();
    // Above or below, slide sideways if that keeps the card off the game.
    let mid = clampX(x - cw / 2);
    if (hole && x < hole.left) mid = Math.max(8, Math.min(mid, hole.left - cw - 6));
    else if (hole && x > hole.right) mid = Math.min(this.w - cw - 8, Math.max(mid, hole.right + 6));
    const spots: [number, number][] = [
      [x + gap, clampY(y - ch / 2)],
      [x - gap - cw, clampY(y - ch / 2)],
      // Clear of the whole constellation, below it or above it.
      ...(keep ? ([[mid, keep.y + keep.h + 14], [mid, keep.y - ch - 14]] as [number, number][]) : []),
      [mid, y + gap],
      [mid, y - gap - ch],
    ];
    const open = ([l, t]: [number, number]) => !keep || l + cw < keep.x || l > keep.x + keep.w || t + ch < keep.y || t > keep.y + keep.h;
    const fits = ([l, t]: [number, number]) => l >= 8 && t >= 8 && l + cw <= this.w - 8 && t + ch <= this.h - 8;
    const clear = ([l, t]: [number, number]) => !hole || l + cw < hole.left || l > hole.right || t + ch < hole.top || t > hole.bottom;
    const [left, top] = spots.find((s) => fits(s) && clear(s) && open(s)) ?? spots.find((s) => fits(s) && clear(s)) ?? spots.find(fits) ?? [clampX(x + gap), clampY(y + gap)];
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  private hideCard(): void {
    this.shownId = '';
    this.cardEl.classList.remove('show');
    this.cardEl.hidden = true;
  }
}

/** Small seeded random source, so a scene lays out the same way every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
