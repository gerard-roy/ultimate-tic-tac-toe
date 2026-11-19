/**
 * Night sky. Stars light up under the pointer, real constellations draw themselves
 * when you reach them, and resting on a named star shows a card about it.
 */
import { seeded, type CardContent, type Focus, type Pointer, type Scene } from './index';
import { FIGURES, type Figure } from './constellations';
import { STARS, brightnessWords, colourName, sizeWords, tempToRgb, type Star } from './stars';

interface Named {
  star: Star;
  x: number;
  y: number;
  r: number;
  rgb: [number, number, number];
  lit: number;
  /** How close the pointer is, 0 to 1. Drives the name label. */
  near: number;
  phase: number;
  /** The constellation this star belongs to, if it is part of one on screen. */
  figure: Shown | null;
  /** Halo drawn once, so a frame costs one blit a star instead of a gradient. */
  sprite: HTMLCanvasElement;
}
/** A constellation placed on screen. */
interface Shown {
  figure: Figure;
  stars: Named[];
  /** 0 hidden to 1 fully drawn. */
  show: number;
  box: { x: number; y: number; w: number; h: number };
}
interface SmallStar {
  x: number;
  y: number;
  size: number;
}
interface Twinkler {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  rgb: string;
  lit: number;
}
interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}
interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  rgb: string;
}

const REACH = 170;
const PAD = 24;

function offscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

export class SpaceScene implements Scene {
  private lively: boolean;
  private w = 0;
  private h = 0;
  private sky: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;
  private layers: { style: string; stars: SmallStar[] }[][] = [];
  private named: Named[] = [];
  private shown: Shown[] = [];
  private twinklers: Twinkler[] = [];
  private meteors: Meteor[] = [];
  private dust: Dust[] = [];
  private nextMeteor = 3;
  private drift = 0;
  private px = 0;
  private py = 0;
  private lastPX = 0;
  private lastPY = 0;

  constructor(lively: boolean) {
    this.lively = lively;
  }

  resize(w: number, h: number, avoid: DOMRect | null): void {
    this.w = w;
    this.h = h;
    const rnd = seeded(2026);

    // Still sky: deep gradient, nebulae and the band of the Milky Way.
    const [sky, s] = offscreen(w + PAD * 2, h + PAD * 2);
    const g = s.createLinearGradient(0, 0, 0, sky.height);
    g.addColorStop(0, '#04030b');
    g.addColorStop(0.55, '#0b0920');
    g.addColorStop(1, '#141024');
    s.fillStyle = g;
    s.fillRect(0, 0, sky.width, sky.height);
    s.globalCompositeOperation = 'lighter';
    const clouds: [number, number, number, string][] = [
      [0.12, 0.2, 0.55, '58, 31, 120'],
      [0.85, 0.3, 0.5, '18, 78, 110'],
      [0.75, 0.85, 0.6, '96, 34, 92'],
      [0.2, 0.8, 0.45, '26, 52, 120'],
      [0.5, 0.05, 0.4, '90, 50, 30'],
    ];
    const scale = Math.max(w, h);
    for (const [cx, cy, cr, rgb] of clouds) {
      for (let i = 0; i < 5; i++) {
        const x = cx * sky.width + (rnd() - 0.5) * scale * 0.25;
        const y = cy * sky.height + (rnd() - 0.5) * scale * 0.2;
        const r = cr * scale * (0.35 + rnd() * 0.5);
        const ng = s.createRadialGradient(x, y, 0, x, y, r);
        ng.addColorStop(0, `rgba(${rgb}, 0.11)`);
        ng.addColorStop(0.5, `rgba(${rgb}, 0.04)`);
        ng.addColorStop(1, `rgba(${rgb}, 0)`);
        s.fillStyle = ng;
        s.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // The Milky Way: a diagonal band of glow and thousands of faint stars.
    const band = (u: number): [number, number] => [u * sky.width, sky.height * (0.92 - u * 0.84)];
    for (let i = 0; i < 26; i++) {
      const [bx, by] = band(rnd());
      const r = scale * (0.08 + rnd() * 0.12);
      const ng = s.createRadialGradient(bx, by, 0, bx, by, r);
      ng.addColorStop(0, 'rgba(150, 140, 200, 0.05)');
      ng.addColorStop(1, 'rgba(150, 140, 200, 0)');
      s.fillStyle = ng;
      s.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
    const faint = Math.round((w * h) / 520);
    for (let i = 0; i < faint; i++) {
      const [bx, by] = band(rnd());
      const spread = scale * 0.16;
      const x = bx + gauss() * spread;
      const y = by + gauss() * spread;
      s.fillStyle = `rgba(${200 + Math.floor(rnd() * 55)}, ${200 + Math.floor(rnd() * 40)}, 255, ${0.15 + rnd() * 0.45})`;
      const r = rnd() < 0.9 ? 0.5 : 0.9;
      s.fillRect(x, y, r, r);
    }
    s.globalCompositeOperation = 'source-over';
    this.sky = sky;

    // Two drifting layers of small stars, kept as points: far cheaper to draw than full-screen layers.
    this.layers = [];
    const tints = ['255, 214, 170', '255, 244, 234', '202, 216, 255', '170, 191, 255'];
    for (let l = 0; l < 2; l++) {
      const n = Math.round((w * h) / (l === 0 ? 2600 : 5200));
      const groups: SmallStar[][] = tints.map(() => []);
      for (let i = 0; i < n; i++) {
        const size = (l === 0 ? 0.9 : 1.4) + rnd() * 1.1;
        groups[Math.floor(rnd() * rnd() * 4)].push({ x: rnd() * w, y: rnd() * h, size });
      }
      this.layers.push(groups.map((stars, i) => ({ style: `rgba(${tints[i]}, ${l === 0 ? 0.6 : 0.8})`, stars })));
      // A calm sky does not drift, so its small stars are painted straight onto it.
      if (!this.lively) {
        for (const g2 of this.layers[l]) {
          s.fillStyle = g2.style;
          for (const st of g2.stars) s.fillRect(PAD + st.x, PAD + st.y, st.size, st.size);
        }
      }
    }

    const [glow, gc] = offscreen(64, 64);
    const glowFill = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
    glowFill.addColorStop(0, 'rgba(235, 240, 255, 1)');
    glowFill.addColorStop(1, 'rgba(235, 240, 255, 0)');
    gc.fillStyle = glowFill;
    gc.fillRect(0, 0, 64, 64);
    this.glow = glow;

    // Twinkling stars that answer the pointer.
    const tw = Math.round(((w * h) / 9000) * (this.lively ? 1 : 0.6));
    this.twinklers = [];
    for (let i = 0; i < tw; i++) {
      const [r0, g0, b0] = tempToRgb(3500 + rnd() * 16000);
      this.twinklers.push({
        x: rnd() * w,
        y: rnd() * h,
        r: 0.7 + rnd() * 0.9,
        phase: rnd() * 6.283,
        speed: (this.lively ? 0.8 : 0.25) + rnd() * (this.lively ? 1.6 : 0.4),
        rgb: `${r0}, ${g0}, ${b0}`,
        lit: 0,
      });
    }

    // Constellations and named stars sit in the open sky around the game, never behind it.
    const hole = avoid ? { l: avoid.left - 26, t: avoid.top - 26, r: avoid.right + 26, b: avoid.bottom + 26 } : null;
    const placed: Named[] = [];
    const make = (star: Star, x: number, y: number, figure: Shown | null): Named => {
      const rgb = tempToRgb(star.temp);
      const [sprite, sc] = offscreen(96, 96);
      const hg = sc.createRadialGradient(48, 48, 0, 48, 48, 48);
      hg.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`);
      hg.addColorStop(0.25, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.38)`);
      hg.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
      sc.fillStyle = hg;
      sc.fillRect(0, 0, 96, 96);
      const n: Named = { star, sprite, x, y, r: Math.max(1.5, Math.min(4.2, 3.4 - star.mag * 0.45)), rgb, lit: 0, near: 0, phase: rnd() * 6.283, figure };
      placed.push(n);
      return n;
    };

    // Free areas: the margins beside the game, or the strip under it on a narrow screen.
    const areas: { x: number; y: number; w: number; h: number }[] = [];
    const top = 64;
    const bottom = h - 34;
    if (!hole) areas.push({ x: 20, y: top, w: w - 40, h: bottom - top });
    else {
      if (hole.l - 20 >= 170) areas.push({ x: 20, y: top, w: hole.l - 20, h: bottom - top });
      if (w - 20 - hole.r >= 170) areas.push({ x: hole.r, y: top, w: w - 20 - hole.r, h: bottom - top });
      if (areas.length === 0 && bottom - (hole.b + 90) >= 150) areas.push({ x: 20, y: hole.b + 90, w: w - 40, h: bottom - (hole.b + 90) });
    }
    // A lively sky packs in more constellations; a calm one gives a few more room.
    const cell = this.lively ? 240 : 330;
    const boxes: { x: number; y: number; w: number; h: number }[][] = areas.map((a) => {
      const cols = Math.max(1, Math.floor(a.w / cell));
      const rows = Math.max(1, Math.floor(a.h / (cell * 0.95)));
      const list: { x: number; y: number; w: number; h: number }[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) list.push({ x: a.x + (c * a.w) / cols, y: a.y + (r * a.h) / rows, w: a.w / cols, h: a.h / rows });
      return list;
    });
    // Deal the boxes out side by side, so both margins fill evenly.
    const slots: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; boxes.some((list) => i < list.length); i++) for (const list of boxes) if (i < list.length) slots.push(list[i]);

    const byName = new Map(STARS.map((st) => [st.name, st]));
    const used = new Set<string>();
    this.shown = [];
    slots.slice(0, FIGURES.length).forEach((box, i) => {
      const figure = FIGURES[i];
      // Flat map of a small patch of sky: east is to the left, north is up.
      const ra0 = figure.stars.reduce((n, st) => n + st.ra, 0) / figure.stars.length;
      const dec0 = figure.stars.reduce((n, st) => n + st.dec, 0) / figure.stars.length;
      const k = Math.cos((dec0 * Math.PI) / 180) * 15;
      const flat = figure.stars.map((st) => ({ x: -(st.ra - ra0) * k, y: -(st.dec - dec0) }));
      const xs = flat.map((f) => f.x);
      const ys = flat.map((f) => f.y);
      const spanX = Math.max(...xs) - Math.min(...xs) || 1;
      const spanY = Math.max(...ys) - Math.min(...ys) || 1;
      // Room is kept under the figure for its name.
      const scale = Math.min((box.w - 70) / spanX, (box.h - 96) / spanY);
      const cx = box.x + box.w / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * scale;
      const cy = box.y + (box.h - 44) / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * scale;
      const entry: Shown = { figure, stars: [], show: 0, box };
      figure.stars.forEach((fs, j) => {
        const known = byName.get(fs.name);
        // Stars outside the hand-written catalogue get what the HYG catalogue gives: no size.
        const star: Star = known ?? {
          name: fs.name,
          constellation: figure.name,
          mag: fs.mag,
          radius: null,
          temp: Math.round(4600 * (1 / (0.92 * fs.ci + 1.7) + 1 / (0.92 * fs.ci + 0.62))),
          kind: 'star',
          ly: fs.ly,
          note: `Part of ${figure.name}, ${figure.meaning}.`,
        };
        used.add(star.name);
        entry.stars.push(make(star, cx + flat[j].x * scale, cy + flat[j].y * scale, entry));
      });
      this.shown.push(entry);
    });

    // The rest of the catalogue is scattered between them as lone stars.
    const lone = STARS.filter((st) => !used.has(st.name));
    const want = Math.min(lone.length, this.lively ? 14 : 7);
    const gap = Math.max(64, Math.min(120, Math.sqrt((w * h) / 60)));
    let count = 0;
    for (const star of lone) {
      if (count >= want) break;
      for (let tries = 0; tries < 60; tries++) {
        const x = 26 + rnd() * (w - 52);
        const y = 64 + rnd() * (h - 100);
        if (hole && x > hole.l && x < hole.r && y > hole.t && y < hole.b) continue;
        // Lone stars keep out of the constellations, so the figures read cleanly.
        if (this.shown.some((f) => x > f.box.x && x < f.box.x + f.box.w && y > f.box.y && y < f.box.y + f.box.h)) continue;
        if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < gap)) continue;
        make(star, x, y, null);
        count++;
        break;
      }
    }
    this.named = placed;
  }

  /** Constellations on screen and how far each is drawn. Used by the tests. */
  figures(): { name: string; show: number; stars: string[] }[] {
    return this.shown.map((f) => ({ name: f.figure.name, show: f.show, stars: f.stars.map((n) => n.star.name) }));
  }

  targets(): { id: string; x: number; y: number }[] {
    return this.named.map((n) => ({ id: n.star.name, x: n.x, y: n.y }));
  }

  frame(ctx: CanvasRenderingContext2D, t: number, dt: number, pointer: Pointer): Focus | null {
    const { w, h, lively } = this;
    const on = pointer.active;

    // Parallax: the sky leans a little away from the pointer.
    const tx = on && lively ? (pointer.x / w - 0.5) * -2 : 0;
    const ty = on && lively ? (pointer.y / h - 0.5) * -2 : 0;
    this.px += (tx - this.px) * Math.min(1, dt * 2.5);
    this.py += (ty - this.py) * Math.min(1, dt * 2.5);
    if (lively) this.drift += dt;

    if (this.sky) ctx.drawImage(this.sky, -PAD + this.px * 6, -PAD + this.py * 6);
    if (lively) {
      this.layers.forEach((layer, i) => {
        const ox = this.drift * (i === 0 ? 2.2 : 5) + this.px * (i === 0 ? 10 : 18);
        const oy = this.py * (i === 0 ? 10 : 18);
        for (const group of layer) {
          ctx.fillStyle = group.style;
          for (const st of group.stars) {
            const x = (((st.x + ox) % w) + w) % w;
            ctx.fillRect(x, st.y + oy, st.size, st.size);
          }
        }
      });
    }

    // Light falls off with distance from the pointer; stars fade slowly once it has passed.
    const reach = (x: number, y: number) => (on ? Math.max(0, 1 - Math.hypot(x - pointer.x, y - pointer.y) / REACH) : 0);
    const ease = (cur: number, target: number) => cur + (target - cur) * Math.min(1, dt * (target > cur ? 10 : lively ? 1.1 : 0.7));

    // A constellation draws itself when the pointer reaches any of its stars, and lingers after.
    for (const f of this.shown) {
      const b = f.box;
      const inside = on && pointer.x > b.x && pointer.x < b.x + b.w && pointer.y > b.y && pointer.y < b.y + b.h;
      const touched = inside && f.stars.some((n) => Math.hypot(n.x - pointer.x, n.y - pointer.y) < 70);
      if (touched) f.show = Math.min(1, f.show + dt * 1.1);
      else f.show = Math.max(0, f.show - dt * (lively ? 0.16 : 0.22));
    }

    for (const s of this.twinklers) {
      s.lit = ease(s.lit, reach(s.x, s.y));
      const tw = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      const a = Math.min(1, 0.25 + 0.5 * tw + s.lit);
      const r = s.r * (1 + s.lit * 1.3);
      ctx.fillStyle = `rgba(${s.rgb}, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, 6.283);
      ctx.fill();
      if (s.lit > 0.05) {
        const gr = r * 7;
        if (this.glow) {
          ctx.globalAlpha = 0.5 * s.lit;
          ctx.drawImage(this.glow, s.x - gr, s.y - gr, gr * 2, gr * 2);
          ctx.globalAlpha = 1;
        }
      }
    }

    let nearest: Named | null = null;
    let nearestD = 30;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.named) {
      s.near = ease(s.near, reach(s.x, s.y));
      // Every star of a drawn constellation shines, not only the ones under the pointer.
      s.lit = Math.max(s.near, s.figure ? Math.min(1, s.figure.show * 1.5) * 0.7 : 0);
      const d = on ? Math.hypot(s.x - pointer.x, s.y - pointer.y) : Infinity;
      if (d < nearestD) {
        nearestD = d;
        nearest = s;
      }
      const pulse = 1 + (lively ? 0.12 : 0.05) * Math.sin(t * (lively ? 1.3 : 0.5) + s.phase);
      const rgb = `${s.rgb[0]}, ${s.rgb[1]}, ${s.rgb[2]}`;
      const halo = s.r * (5 + s.lit * 9) * pulse;
      ctx.globalAlpha = 0.55 + 0.45 * s.lit;
      ctx.drawImage(s.sprite, s.x - halo, s.y - halo, halo * 2, halo * 2);
      ctx.globalAlpha = 1;
      // Diffraction spikes grow as the star lights.
      const spike = s.r * (4 + s.lit * 16) * pulse;
      ctx.lineWidth = 1;
      if (s.lit < 0.03) {
        ctx.strokeStyle = `rgba(${rgb}, 0.22)`;
        ctx.beginPath();
        ctx.moveTo(s.x - spike, s.y);
        ctx.lineTo(s.x + spike, s.y);
        ctx.moveTo(s.x, s.y - spike);
        ctx.lineTo(s.x, s.y + spike);
        ctx.stroke();
      } else {
        for (let k = 0; k < 2; k++) {
          const sg = k === 0 ? ctx.createLinearGradient(s.x - spike, s.y, s.x + spike, s.y) : ctx.createLinearGradient(s.x, s.y - spike, s.x, s.y + spike);
          sg.addColorStop(0, `rgba(${rgb}, 0)`);
          sg.addColorStop(0.5, `rgba(255, 255, 255, ${0.35 + 0.6 * s.lit})`);
          sg.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.strokeStyle = sg;
          ctx.beginPath();
          if (k === 0) {
            ctx.moveTo(s.x - spike, s.y);
            ctx.lineTo(s.x + spike, s.y);
          } else {
            ctx.moveTo(s.x, s.y - spike);
            ctx.lineTo(s.x, s.y + spike);
          }
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.8 + 0.5 * s.lit), 0, 6.283);
      ctx.fill();
    }

    // The figure's lines draw in one after another.
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (const f of this.shown) {
      if (f.show <= 0) continue;
      const n = f.figure.lines.length;
      const alpha = Math.min(1, f.show * 3) * 0.7;
      ctx.strokeStyle = `rgba(255, 241, 194, ${alpha})`;
      ctx.beginPath();
      f.figure.lines.forEach(([ia, ib], i) => {
        const part = Math.max(0, Math.min(1, f.show * 1.25 * n - i));
        if (part <= 0) return;
        const a = f.stars[ia];
        const b = f.stars[ib];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / len;
        const uy = (b.y - a.y) / len;
        // Stop short of each star so the line does not cross its core.
        const from = Math.min(len / 2, a.r + 6);
        const to = from + (len - Math.min(len / 2, b.r + 6) - from) * part;
        ctx.moveTo(a.x + ux * from, a.y + uy * from);
        ctx.lineTo(a.x + ux * to, a.y + uy * to);
      });
      ctx.stroke();
    }

    if (lively) {
      // Shooting stars.
      this.nextMeteor -= dt;
      if (this.nextMeteor <= 0) {
        this.nextMeteor = 3.5 + Math.random() * 6;
        const a = 0.35 + Math.random() * 0.5;
        const v = 620 + Math.random() * 420;
        const left = Math.random() < 0.5;
        this.meteors.push({
          x: left ? Math.random() * w * 0.6 : w * 0.4 + Math.random() * w * 0.6,
          y: Math.random() * h * 0.4,
          vx: Math.cos(a) * v * (left ? 1 : -1),
          vy: Math.sin(a) * v,
          life: 0,
          max: 0.7 + Math.random() * 0.5,
        });
      }
      for (const m of this.meteors) {
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const k = Math.sin(Math.min(1, m.life / m.max) * Math.PI);
        const tail = 0.16;
        const mg = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * tail, m.y - m.vy * tail);
        mg.addColorStop(0, `rgba(255, 255, 255, ${0.9 * k})`);
        mg.addColorStop(1, 'rgba(160, 190, 255, 0)');
        ctx.strokeStyle = mg;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * tail, m.y - m.vy * tail);
        ctx.stroke();
      }
      this.meteors = this.meteors.filter((m) => m.life < m.max);

      // Stardust follows the pointer.
      if (on) {
        const moved = Math.hypot(pointer.x - this.lastPX, pointer.y - this.lastPY);
        if (moved > 5 && this.dust.length < 90) {
          for (let i = 0; i < Math.min(3, Math.floor(moved / 5)); i++) {
            const a = Math.random() * 6.283;
            const sp = 6 + Math.random() * 26;
            this.dust.push({
              x: pointer.x + (Math.random() - 0.5) * 10,
              y: pointer.y + (Math.random() - 0.5) * 10,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              life: 1,
              rgb: Math.random() < 0.5 ? '255, 241, 194' : '170, 200, 255',
            });
          }
        }
        this.lastPX = pointer.x;
        this.lastPY = pointer.y;
      }
      for (const d of this.dust) {
        d.life -= dt * 1.1;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        ctx.fillStyle = `rgba(${d.rgb}, ${Math.max(0, d.life) * 0.8})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 0.6 + d.life * 0.9, 0, 6.283);
        ctx.fill();
      }
      this.dust = this.dust.filter((d) => d.life > 0);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Names appear as stars light up.
    ctx.font = "500 14px 'Alegreya Sans', 'Gill Sans', 'Trebuchet MS', sans-serif";
    ctx.textBaseline = 'middle';
    for (const s of this.named) {
      // Inside a constellation only the stars right under the pointer are named, to keep the figure clear.
      const from = s.figure ? 0.78 : 0.35;
      if (s.near < from) continue;
      const a = Math.min(1, (s.near - from) * (s.figure ? 6 : 2.4));
      const label = s.star.name;
      const tw = ctx.measureText(label).width;
      const right = s.x + 14 + tw < w - 6;
      ctx.fillStyle = `rgba(241, 236, 225, ${a})`;
      ctx.fillText(label, right ? s.x + 14 : s.x - 14 - tw, s.y + 1);
    }

    // Each constellation is named under its figure.
    ctx.textAlign = 'center';
    for (const f of this.shown) {
      if (f.show <= 0.02) continue;
      const a = Math.min(1, f.show * 2);
      const cx = Math.max(90, Math.min(w - 90, f.box.x + f.box.w / 2));
      const y = f.box.y + f.box.h - 34;
      ctx.font = "400 21px 'Federo', Optima, Candara, serif";
      ctx.fillStyle = `rgba(255, 241, 194, ${a})`;
      ctx.fillText(f.figure.name, cx, y);
      ctx.font = "400 14px 'Alegreya Sans', 'Gill Sans', 'Trebuchet MS', sans-serif";
      ctx.fillStyle = `rgba(167, 159, 181, ${a})`;
      ctx.fillText(f.figure.meaning, cx, y + 20, f.box.w - 8);
    }
    ctx.textAlign = 'left';

    if (!nearest) return null;
    const star = nearest;
    ctx.strokeStyle = 'rgba(255, 241, 194, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 13 + Math.sin(t * 3) * 1.2, 0, 6.283);
    ctx.stroke();
    let keep: { x: number; y: number; w: number; h: number } | undefined;
    if (star.figure) {
      const xs = star.figure.stars.map((n) => n.x);
      const ys = star.figure.stars.map((n) => n.y);
      // The figure and the name written under it.
      const b = star.figure.box;
      const top = Math.min(...ys) - 12;
      keep = { x: Math.min(...xs) - 12, y: top, w: Math.max(...xs) - Math.min(...xs) + 24, h: b.y + b.h - 4 - top };
    }
    return { id: star.star.name, x: star.x, y: star.y, keep, card: () => starCard(star.star) };
  }
}

function starCard(star: Star): CardContent {
  const [r, g, b] = tempToRgb(star.temp);
  return {
    title: star.name,
    subtitle: `${star.kind} in ${star.constellation}`,
    rows: [
      ['Brightness', `Magnitude ${star.mag.toFixed(star.mag % 1 === 0 ? 0 : 2).replace('-', '−').replace(/(\.\d)0$/, '$1')}, ${brightnessWords(star.mag)}`],
      ...(star.radius === null ? [] : ([['Size', sizeWords(star.radius)]] as [string, string][])),
      ['Colour', `${colourName(star.temp)}, about ${(Math.round(star.temp / 100) * 100).toLocaleString('en')} K`],
      ['Distance', `${star.ly.toLocaleString('en')} light-years`],
    ],
    note: star.note,
    draw(ctx, size) {
      const rnd = seeded(Math.round(star.temp + (star.radius ?? 1) * 10));
      const ratio = star.radius ?? 1;
      const big = size * 0.34;
      const sr = Math.max(2.2, big * Math.min(1, ratio));
      const sunR = Math.max(1.1, big * Math.min(1, 1 / ratio));
      const cx = size * 0.46;
      const cy = size * 0.46;
      ctx.fillStyle = '#08070C';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.4})`;
        ctx.fillRect(rnd() * size, rnd() * size, 0.8, 0.8);
      }
      const halo = ctx.createRadialGradient(cx, cy, sr * 0.6, cx, cy, sr + size * 0.3);
      halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);
      halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);
      // The disc darkens toward its limb.
      const disc = ctx.createRadialGradient(cx - sr * 0.25, cy - sr * 0.25, sr * 0.05, cx, cy, sr);
      const lift = (v: number) => Math.round(v + (255 - v) * 0.7);
      disc.addColorStop(0, `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`);
      disc.addColorStop(0.6, `rgb(${r}, ${g}, ${b})`);
      disc.addColorStop(1, `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.5)}, ${Math.round(b * 0.55)})`);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, sr, 0, 6.283);
      ctx.fillStyle = disc;
      ctx.fill();
      ctx.clip();
      // Convection cells: cool giants have a few huge ones, hot stars a fine grain.
      const cells = star.temp < 4500 ? 14 : 46;
      for (let i = 0; i < cells; i++) {
        const a = rnd() * 6.283;
        const d = Math.sqrt(rnd()) * sr;
        const cr = sr * (star.temp < 4500 ? 0.18 + rnd() * 0.25 : 0.05 + rnd() * 0.1);
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
      // The Sun to the same scale.
      ctx.font = "11px 'Alegreya Sans', 'Gill Sans', sans-serif";
      ctx.fillStyle = '#A79FB5';
      ctx.textBaseline = 'alphabetic';
      if (star.radius === null) {
        // No size on record: the picture shows colour only.
      } else if (ratio >= 1) {
        const sx = size - 12;
        const sy = size - 20;
        ctx.fillStyle = '#FFE9A8';
        ctx.beginPath();
        ctx.arc(sx, sy, sunR, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#A79FB5';
        ctx.textAlign = 'right';
        ctx.fillText('Sun', size - 5, size - 5);
      } else {
        ctx.strokeStyle = '#FFE9A8';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, sunR, 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = 'right';
        ctx.fillText('Sun', size - 5, size - 5);
      }
    },
  };
}
