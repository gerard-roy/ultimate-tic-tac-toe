/**
 * Interactive backgrounds. They are scenery only: they never touch the game.
 * Each scene is drawn in code on one canvas behind the page.
 */
import { SpaceScene } from './space';
import { OceanScene } from './ocean';

export type BackgroundId = 'space-lively' | 'space-calm' | 'ocean-lively' | 'ocean-calm' | 'stone';

export const BACKGROUNDS: { id: BackgroundId; name: string; line: string }[] = [
  { id: 'space-lively', name: 'Space, lively', line: 'Drifting stars, shooting stars and stardust.' },
  { id: 'space-calm', name: 'Space, calm', line: 'A still night sky.' },
  { id: 'ocean-lively', name: 'Ocean, lively', line: 'A busy reef full of animals.' },
  { id: 'ocean-calm', name: 'Ocean, calm', line: 'Quiet water and a few slow animals.' },
  { id: 'stone', name: 'Stone room', line: 'No scenery, just the window.' },
];

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
  card(): CardContent;
}

export interface Scene {
  resize(w: number, h: number, avoid: DOMRect | null): void;
  /** Draws one frame and returns what the pointer is resting on, if anything. */
  frame(ctx: CanvasRenderingContext2D, t: number, dt: number, pointer: Pointer): Focus | null;
}

const DWELL_MS = 420;

export class Background {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private cardEl: HTMLElement;
  private scene: Scene | null = null;
  private id: BackgroundId = 'stone';
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

  get current(): BackgroundId {
    return this.id;
  }

  /** Reduced motion swaps a lively scene for its calm version. */
  set(id: BackgroundId, reduce: boolean): void {
    const effective: BackgroundId = reduce && id === 'space-lively' ? 'space-calm' : reduce && id === 'ocean-lively' ? 'ocean-calm' : id;
    if (effective === this.id && reduce === this.reduce && (this.scene || effective === 'stone')) return;
    this.id = effective;
    this.reduce = reduce;
    this.hideCard();
    document.documentElement.dataset.bg = effective.split('-')[0];
    switch (effective) {
      case 'space-lively': this.scene = new SpaceScene(true); break;
      case 'space-calm': this.scene = new SpaceScene(false); break;
      case 'ocean-lively': this.scene = new OceanScene(true); break;
      case 'ocean-calm': this.scene = new OceanScene(false); break;
      default: this.scene = null;
    }
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
    else if (focus && this.shownId === id) this.place(focus.x, focus.y);
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
    this.place(focus.x, focus.y);
    requestAnimationFrame(() => card.classList.add('show'));
  }

  private place(x: number, y: number): void {
    const card = this.cardEl;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let left = x + 22;
    if (left + cw > this.w - 8) left = x - 22 - cw;
    left = Math.max(8, Math.min(this.w - cw - 8, left));
    const top = Math.max(8, Math.min(this.h - ch - 8, y - ch / 2));
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
