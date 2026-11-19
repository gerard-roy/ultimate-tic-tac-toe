/** Night sky. Stars light up under the pointer; rest on a named star to read about it. */
import { seeded, type CardContent, type Focus, type Pointer, type Scene } from './index';
import { STARS, brightnessWords, colourName, sizeWords, tempToRgb, type Star } from './stars';

interface Named {
  star: Star;
  x: number;
  y: number;
  r: number;
  rgb: [number, number, number];
  lit: number;
  phase: number;
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
  private layers: HTMLCanvasElement[] = [];
  private named: Named[] = [];
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

    // Two drifting layers of small stars.
    this.layers = [];
    for (let l = 0; l < 2; l++) {
      const [c, cx] = offscreen(w, h);
      const n = Math.round((w * h) / (l === 0 ? 2600 : 5200));
      for (let i = 0; i < n; i++) {
        const [r0, g0, b0] = tempToRgb(3000 + rnd() * rnd() * 24000);
        cx.fillStyle = `rgba(${r0}, ${g0}, ${b0}, ${0.35 + rnd() * 0.5})`;
        const r = (l === 0 ? 0.45 : 0.7) + rnd() * 0.6;
        cx.beginPath();
        cx.arc(rnd() * w, rnd() * h, r, 0, 6.283);
        cx.fill();
      }
      this.layers.push(c);
    }

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

    // Named stars sit in the open sky around the game, never behind it.
    const want = this.lively ? STARS.length : 22;
    const order = STARS.map((star, i) => ({ star, k: i < 12 ? -1 + rnd() * 0.01 : rnd() })).sort((a, b) => a.k - b.k);
    const hole = avoid ? { l: avoid.left - 26, t: avoid.top - 26, r: avoid.right + 26, b: avoid.bottom + 26 } : null;
    const placed: Named[] = [];
    const gap = Math.max(64, Math.min(120, Math.sqrt((w * h) / 60)));
    for (const { star } of order) {
      if (placed.length >= want) break;
      for (let tries = 0; tries < 60; tries++) {
        const x = 26 + rnd() * (w - 52);
        const y = 64 + rnd() * (h - 100);
        if (hole && x > hole.l && x < hole.r && y > hole.t && y < hole.b) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < gap)) continue;
        placed.push({
          star,
          x,
          y,
          r: Math.max(1.5, Math.min(4.2, 3.4 - star.mag * 0.45)),
          rgb: tempToRgb(star.temp),
          lit: 0,
          phase: rnd() * 6.283,
        });
        break;
      }
    }
    this.named = placed;
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
    this.layers.forEach((layer, i) => {
      const speed = lively ? (i === 0 ? 2.2 : 5) : 0;
      const ox = (((this.drift * speed + this.px * (i === 0 ? 10 : 18)) % w) + w) % w;
      const oy = this.py * (i === 0 ? 10 : 18);
      ctx.drawImage(layer, ox, oy);
      ctx.drawImage(layer, ox - w, oy);
    });

    // Light falls off with distance from the pointer; stars fade slowly once it has passed.
    const reach = (x: number, y: number) => (on ? Math.max(0, 1 - Math.hypot(x - pointer.x, y - pointer.y) / REACH) : 0);
    const ease = (cur: number, target: number) => cur + (target - cur) * Math.min(1, dt * (target > cur ? 10 : lively ? 1.1 : 0.7));

    const litPoints: { x: number; y: number; lit: number }[] = [];
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
        const gg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, gr);
        gg.addColorStop(0, `rgba(${s.rgb}, ${0.5 * s.lit})`);
        gg.addColorStop(1, `rgba(${s.rgb}, 0)`);
        ctx.fillStyle = gg;
        ctx.fillRect(s.x - gr, s.y - gr, gr * 2, gr * 2);
        if (s.lit > 0.25) litPoints.push(s);
      }
    }

    let nearest: Named | null = null;
    let nearestD = 30;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.named) {
      s.lit = ease(s.lit, reach(s.x, s.y));
      const d = on ? Math.hypot(s.x - pointer.x, s.y - pointer.y) : Infinity;
      if (d < nearestD) {
        nearestD = d;
        nearest = s;
      }
      const pulse = 1 + (lively ? 0.12 : 0.05) * Math.sin(t * (lively ? 1.3 : 0.5) + s.phase);
      const rgb = `${s.rgb[0]}, ${s.rgb[1]}, ${s.rgb[2]}`;
      const halo = s.r * (5 + s.lit * 9) * pulse;
      const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, halo);
      hg.addColorStop(0, `rgba(${rgb}, ${0.5 + 0.4 * s.lit})`);
      hg.addColorStop(0.25, `rgba(${rgb}, ${0.16 + 0.25 * s.lit})`);
      hg.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = hg;
      ctx.fillRect(s.x - halo, s.y - halo, halo * 2, halo * 2);
      // Diffraction spikes grow as the star lights.
      const spike = s.r * (4 + s.lit * 16) * pulse;
      ctx.lineWidth = 1;
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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.8 + 0.5 * s.lit), 0, 6.283);
      ctx.fill();
      if (s.lit > 0.25) litPoints.push(s);
    }

    // Lit neighbours join up, like a constellation being sketched.
    ctx.lineWidth = 1;
    for (let i = 0; i < litPoints.length && i < 48; i++) {
      for (let j = i + 1; j < litPoints.length && j < 48; j++) {
        const a = litPoints[i];
        const b = litPoints[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 120) continue;
        ctx.strokeStyle = `rgba(255, 241, 194, ${Math.min(a.lit, b.lit) * 0.3 * (1 - d / 120)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
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
      if (s.lit < 0.35) continue;
      const a = Math.min(1, (s.lit - 0.35) * 2.4);
      const label = s.star.name;
      const tw = ctx.measureText(label).width;
      const right = s.x + 14 + tw < w - 6;
      ctx.fillStyle = `rgba(241, 236, 225, ${a})`;
      ctx.fillText(label, right ? s.x + 14 : s.x - 14 - tw, s.y + 1);
    }

    if (!nearest) return null;
    const star = nearest;
    ctx.strokeStyle = 'rgba(255, 241, 194, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 13 + Math.sin(t * 3) * 1.2, 0, 6.283);
    ctx.stroke();
    return { id: star.star.name, x: star.x, y: star.y, card: () => starCard(star.star) };
  }
}

function starCard(star: Star): CardContent {
  const [r, g, b] = tempToRgb(star.temp);
  return {
    title: star.name,
    subtitle: `${star.kind} in ${star.constellation}`,
    rows: [
      ['Brightness', `Magnitude ${star.mag.toFixed(star.mag % 1 === 0 ? 0 : 2).replace('-', '−').replace(/(\.\d)0$/, '$1')}, ${brightnessWords(star.mag)}`],
      ['Size', sizeWords(star.radius)],
      ['Colour', `${colourName(star.temp)}, about ${(Math.round(star.temp / 100) * 100).toLocaleString('en')} K`],
      ['Distance', `${star.ly.toLocaleString('en')} light-years`],
    ],
    note: star.note,
    draw(ctx, size) {
      const rnd = seeded(Math.round(star.temp + star.radius * 10));
      const ratio = star.radius;
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
      if (ratio >= 1) {
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
