/** Lit states, the floor light and the dust motes. */
import type { GameState } from '../rules';
import { flatColour } from './glass';

export interface PanelLight {
  /** 0 unlit to 1 lit. */
  level: number;
  grisaille: boolean;
}

/** Every level is lit during play, a drawn board turns grisaille, and the title shows the window unlit. */
export function panelLights(state: GameState, title: boolean): PanelLight[] {
  return state.panels.map(() => {
    if (title) return { level: 0, grisaille: false };
    if (state.result === 'draw') return { level: 0.35, grisaille: true };
    return { level: 1, grisaille: false };
  });
}

/** A small copy of the window that CSS flips, stretches, skews and blurs onto the floor. */
export class FloorLight {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'floor-light';
    this.canvas.setAttribute('aria-hidden', 'true');
    // The picture sits in the middle two thirds, so the blur has room to spill sideways.
    this.canvas.width = 162;
    this.canvas.height = 135;
    this.ctx = this.canvas.getContext('2d');
  }

  draw(state: GameState, lights: PanelLight[]): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // Levels fall on the floor one under the other, as they stand in the window.
    const levels = state.panels.length;
    const cellW = 108 / 3;
    const cellH = 108 / (3 * levels);
    const ox = 27;
    const oy = 27;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let level = 0; level < levels; level++) {
      const light = lights[level];
      for (let pane = 0; pane < 9; pane++) {
        const mark = state.panes[level * 9 + pane];
        const role = mark === 'amber' ? 'amber-arm' : mark === 'cobalt' ? 'cobalt-ring' : 'clear';
        // Unlit glass casts almost nothing on the floor.
        ctx.globalAlpha = 0.12 + 0.88 * light.level;
        ctx.fillStyle = flatColour(role, light.level, light.grisaille);
        ctx.fillRect(ox + (pane % 3) * cellW + 0.5, oy + (level * 3 + Math.floor(pane / 3)) * cellH + 0.5, cellW - 1, cellH - 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

/** Forty dust motes drifting through the light, 1 to 2px wide, under 8px a second. */
export class Motes {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private motes: Mote[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  /** 0 to 1: how much light there is for the motes to catch. */
  strength = 0.5;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'motes';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.motes.length === 0 && this.w > 0) {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) {
        const a = rnd() * Math.PI * 2;
        const v = 1.5 + rnd() * 5.5;
        this.motes.push({ x: rnd() * this.w, y: rnd() * this.h, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 + 1, r: 0.5 + rnd() * 0.5, phase: rnd() * 6.28 });
      }
    }
  }

  start(): void {
    if (this.raf) return;
    this.canvas.hidden = false;
    this.resize();
    this.last = performance.now();
    const tick = (t: number) => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      const ctx = this.ctx;
      if (!ctx || this.w === 0) return;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#FFF1C2';
      for (const m of this.motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.x < -2) m.x = this.w + 2;
        if (m.x > this.w + 2) m.x = -2;
        if (m.y < -2) m.y = this.h + 2;
        if (m.y > this.h + 2) m.y = -2;
        ctx.globalAlpha = (0.25 + 0.3 * Math.sin(t / 1700 + m.phase)) * (0.35 + 0.65 * this.strength);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ctx?.clearRect(0, 0, this.w, this.h);
    this.canvas.hidden = true;
  }
}
