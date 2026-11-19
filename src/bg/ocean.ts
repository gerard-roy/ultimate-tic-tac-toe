/** Under the sea. Every animal answers the pointer in its own way. */
import { seeded, type CardContent, type Focus, type Pointer, type Scene } from './index';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Info {
  name: string;
  kind: string;
  reacts: string;
  size: string;
  fact: string;
}

const INFO: Record<string, Info> = {
  fish: { name: 'Blue-green chromis', kind: 'Schooling reef fish', reacts: 'The school scatters, then regroups', size: 'About 8 cm long', fact: 'Schooling makes it hard for a hunter to pick out one fish.' },
  jelly: { name: 'Moon jellyfish', kind: 'Jellyfish', reacts: 'Glows and pulses faster', size: 'Bell 25 to 40 cm across', fact: 'It has no brain, heart or bones, and is about 95% water.' },
  turtle: { name: 'Green sea turtle', kind: 'Reptile', reacts: 'Curious: it swims over to look', size: 'Shell about 1 m long', fact: 'It can hold its breath for hours while it rests.' },
  puffer: { name: 'Pufferfish', kind: 'Fish', reacts: 'Puffs up into a spiky ball', size: 'Most are 10 to 30 cm long', fact: 'It swallows water to swell to several times its size.' },
  octopus: { name: 'Common octopus', kind: 'Mollusc', reacts: 'Changes colour, inks and jets away', size: 'Arms up to 1 m long', fact: 'It has three hearts, blue blood and nine brains.' },
  crab: { name: 'Red rock crab', kind: 'Crustacean', reacts: 'Raises its claws and scuttles off sideways', size: 'Shell about 8 cm wide', fact: 'Its leg joints bend sideways, so sideways is the quick way to run.' },
  seahorse: { name: 'Seahorse', kind: 'Fish', reacts: 'Blushes and turns to face you', size: '2 to 35 cm tall', fact: 'The father carries the eggs in a pouch until they hatch.' },
  manta: { name: 'Manta ray', kind: 'Ray', reacts: 'Rolls over in a loop', size: 'Up to 7 m from wingtip to wingtip', fact: 'It has the largest brain of any fish.' },
  whale: { name: 'Humpback whale', kind: 'Mammal', reacts: 'Sings', size: '12 to 16 m long', fact: 'Its songs can last 20 minutes and carry for many kilometres.' },
  clown: { name: 'Clownfish', kind: 'Reef fish', reacts: 'Hides in its anemone', size: 'About 10 cm long', fact: 'A coat of mucus protects it from the stings of its anemone.' },
  starfish: { name: 'Sea star', kind: 'Echinoderm', reacts: 'Glows and curls its arms', size: 'Most are 12 to 25 cm across', fact: 'It can grow back a lost arm, and has an eye at the tip of each one.' },
};

interface Animal {
  kind: keyof typeof INFO;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number; // 1 faces right, -1 faces left
  size: number;
  phase: number;
  /** 0 to 1: how strongly it is reacting now. */
  mood: number;
  hx: number;
  hy: number;
  hue: number;
  spin: number;
  cool: number;
}

interface Bubble { x: number; y: number; r: number; v: number; phase: number; pop: number }
interface Puff { x: number; y: number; r: number; life: number; vx: number; vy: number }
interface Ring { x: number; y: number; r: number; life: number }
interface Kelp { x: number; h: number; phase: number; bend: number; hue: number }

function fishShape(c: Ctx, len: number, wag: number): void {
  c.beginPath();
  c.moveTo(len * 0.5, 0);
  c.quadraticCurveTo(len * 0.15, -len * 0.3, -len * 0.3, 0);
  c.quadraticCurveTo(len * 0.15, len * 0.3, len * 0.5, 0);
  c.fill();
  c.beginPath();
  c.moveTo(-len * 0.24, 0);
  c.lineTo(-len * 0.56, -len * 0.22 + wag);
  c.lineTo(-len * 0.44, wag * 0.6);
  c.lineTo(-len * 0.56, len * 0.22 + wag);
  c.closePath();
  c.fill();
}

const DRAW: Record<string, (c: Ctx, a: Animal, t: number) => void> = {
  fish(c, a, t) {
    const len = a.size;
    const wag = Math.sin(t * (9 + a.mood * 10) + a.phase) * len * 0.12;
    const g = c.createLinearGradient(0, -len * 0.2, 0, len * 0.2);
    g.addColorStop(0, `hsl(${a.hue} 70% 62%)`);
    g.addColorStop(1, `hsl(${a.hue + 30} 60% 82%)`);
    c.fillStyle = g;
    fishShape(c, len, wag);
    c.fillStyle = '#06202e';
    c.beginPath();
    c.arc(len * 0.3, -len * 0.04, len * 0.045, 0, TAU);
    c.fill();
  },
  clown(c, a, t) {
    const len = a.size;
    const wag = Math.sin(t * 8 + a.phase) * len * 0.1;
    c.fillStyle = '#f47a1f';
    fishShape(c, len, wag);
    c.strokeStyle = '#fff6ea';
    c.lineWidth = len * 0.1;
    c.lineCap = 'round';
    for (const x of [0.22, -0.02, -0.24]) {
      const hgt = len * (x === -0.24 ? 0.05 : 0.2) * (x === 0.22 ? 0.75 : 1);
      c.beginPath();
      c.moveTo(len * x, -hgt);
      c.lineTo(len * x, hgt);
      c.stroke();
    }
    c.fillStyle = '#1b1208';
    c.beginPath();
    c.arc(len * 0.36, -len * 0.04, len * 0.045, 0, TAU);
    c.fill();
  },
  jelly(c, a, t) {
    const s = a.size;
    const beat = Math.sin(t * (1.6 + a.mood * 2.4) + a.phase);
    const wide = s * (1 + beat * 0.1);
    const tall = s * (0.75 - beat * 0.08);
    const glow = 0.25 + a.mood * 0.75;
    const gg = c.createRadialGradient(0, 0, 0, 0, 0, s * 2.6);
    gg.addColorStop(0, `hsla(${a.hue}, 90%, 75%, ${0.35 * glow})`);
    gg.addColorStop(1, `hsla(${a.hue}, 90%, 75%, 0)`);
    c.fillStyle = gg;
    c.fillRect(-s * 2.6, -s * 2.6, s * 5.2, s * 5.2);
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x0 = (i / 6 - 0.5) * wide * 1.5;
      c.strokeStyle = `hsla(${a.hue}, 85%, ${72 + a.mood * 14}%, ${0.3 + 0.4 * glow})`;
      c.lineWidth = i % 2 ? 1 : 1.8;
      c.beginPath();
      c.moveTo(x0, 0);
      const n = i % 2 ? 9 : 6;
      for (let k = 1; k <= n; k++) {
        const yy = k * s * 0.26;
        c.lineTo(x0 + Math.sin(t * 2 + a.phase + k * 0.7 + i) * s * 0.11 * (1 + k * 0.12), yy);
      }
      c.stroke();
    }
    const bg = c.createRadialGradient(0, -tall * 0.5, s * 0.1, 0, -tall * 0.2, wide);
    bg.addColorStop(0, `hsla(${a.hue}, 90%, ${86 + a.mood * 10}%, ${0.55 + 0.35 * glow})`);
    bg.addColorStop(1, `hsla(${a.hue + 20}, 80%, 62%, ${0.28 + 0.3 * glow})`);
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-wide, 0);
    c.bezierCurveTo(-wide, -tall * 1.4, wide, -tall * 1.4, wide, 0);
    for (let i = 0; i < 5; i++) {
      const x1 = wide - ((i + 1) / 5) * wide * 2;
      c.quadraticCurveTo(x1 + wide * 0.2, s * 0.14, x1, 0);
    }
    c.fill();
    c.strokeStyle = `hsla(${a.hue}, 90%, 92%, ${0.4 + 0.4 * glow})`;
    c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * TAU + 0.4;
      c.beginPath();
      c.ellipse(Math.cos(ang) * s * 0.22, -tall * 0.5 + Math.sin(ang) * s * 0.14, s * 0.14, s * 0.1, 0, 0, TAU);
      c.stroke();
    }
  },
  turtle(c, a, t) {
    const s = a.size;
    const flap = Math.sin(t * (1.6 + a.mood * 1.2) + a.phase);
    c.fillStyle = '#4f8a5b';
    // flippers
    for (const side of [-1, 1]) {
      c.save();
      c.translate(s * 0.3, side * s * 0.12);
      c.rotate(side * (0.6 + flap * 0.45) + 0.5 * side);
      c.beginPath();
      c.ellipse(s * 0.02, side * s * 0.34, s * 0.14, s * 0.42, 0, 0, TAU);
      c.fill();
      c.restore();
      c.save();
      c.translate(-s * 0.48, side * s * 0.2);
      c.rotate(side * (0.9 - flap * 0.2));
      c.beginPath();
      c.ellipse(0, side * s * 0.14, s * 0.09, s * 0.2, 0, 0, TAU);
      c.fill();
      c.restore();
    }
    c.beginPath();
    c.ellipse(s * 0.74, 0, s * 0.2, s * 0.15, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#0d241a';
    c.beginPath();
    c.arc(s * 0.82, -s * 0.06, s * 0.025, 0, TAU);
    c.arc(s * 0.82, s * 0.06, s * 0.025, 0, TAU);
    c.fill();
    const sg = c.createRadialGradient(-s * 0.05, -s * 0.1, s * 0.05, 0, 0, s * 0.62);
    sg.addColorStop(0, '#7a8f4a');
    sg.addColorStop(1, '#2f5238');
    c.fillStyle = sg;
    c.beginPath();
    c.ellipse(0, 0, s * 0.6, s * 0.46, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(16, 40, 28, 0.6)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU;
      c.moveTo(Math.cos(ang) * s * 0.2, Math.sin(ang) * s * 0.16);
      c.lineTo(Math.cos(ang) * s * 0.58, Math.sin(ang) * s * 0.44);
    }
    c.ellipse(0, 0, s * 0.2, s * 0.16, 0, 0, TAU);
    c.stroke();
  },
  puffer(c, a, t) {
    const s = a.size * (1 + a.mood * 0.9);
    const wag = Math.sin(t * 6 + a.phase) * 0.3;
    c.fillStyle = '#d9b45a';
    c.save();
    c.translate(-s * 0.5, 0);
    c.rotate(wag);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-s * 0.4, -s * 0.24);
    c.lineTo(-s * 0.4, s * 0.24);
    c.closePath();
    c.fill();
    c.restore();
    if (a.mood > 0.08) {
      c.strokeStyle = '#f3e3a8';
      c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i < 22; i++) {
        const ang = (i / 22) * TAU + 0.1;
        c.moveTo(Math.cos(ang) * s * 0.5, Math.sin(ang) * s * 0.5);
        c.lineTo(Math.cos(ang) * s * (0.5 + 0.2 * a.mood), Math.sin(ang) * s * (0.5 + 0.2 * a.mood));
      }
      c.stroke();
    }
    const bg = c.createRadialGradient(-s * 0.1, -s * 0.2, s * 0.05, 0, 0, s * 0.56);
    bg.addColorStop(0, '#f1d98a');
    bg.addColorStop(0.7, '#c99a3c');
    bg.addColorStop(1, '#8f6a24');
    c.fillStyle = bg;
    c.beginPath();
    c.ellipse(0, 0, s * 0.54, s * lerp(0.4, 0.54, a.mood), 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255, 248, 225, 0.75)';
    c.beginPath();
    c.ellipse(0, s * 0.2, s * 0.4, s * 0.2, 0, 0, Math.PI);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(s * 0.28, -s * 0.12, s * 0.12, 0, TAU);
    c.fill();
    c.fillStyle = '#111';
    c.beginPath();
    c.arc(s * 0.31, -s * 0.12, s * (0.05 + 0.03 * a.mood), 0, TAU);
    c.fill();
    c.strokeStyle = '#5b3d12';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(s * 0.5, s * 0.06, s * 0.05, 0.5, TAU - 0.5);
    c.stroke();
  },
  octopus(c, a, t) {
    const s = a.size;
    const hue = lerp(18, 330, a.mood);
    const body = `hsl(${hue} ${60 + a.mood * 25}% ${52 - a.mood * 8}%)`;
    c.strokeStyle = body;
    c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const spread = (i / 7 - 0.5) * 1.9;
      c.lineWidth = s * 0.13;
      c.beginPath();
      c.moveTo(-s * 0.1 + spread * s * 0.2, s * 0.2);
      let x = -s * 0.1 + spread * s * 0.2;
      let y = s * 0.2;
      for (let k = 1; k <= 6; k++) {
        const stretch = 1 + a.mood * 0.6;
        x += (spread * s * 0.13 - s * 0.1 * a.mood) * stretch;
        y += s * 0.15;
        c.lineTo(x + Math.sin(t * (2 + a.mood * 4) + i + k * 0.9) * s * 0.07 * k * 0.5, y);
        c.lineWidth = s * 0.13 * (1 - k / 8);
      }
      c.stroke();
    }
    const hg = c.createRadialGradient(-s * 0.1, -s * 0.25, s * 0.05, 0, -s * 0.1, s * 0.6);
    hg.addColorStop(0, `hsl(${hue} 80% 70%)`);
    hg.addColorStop(1, body);
    c.fillStyle = hg;
    c.beginPath();
    c.ellipse(-s * 0.05, -s * 0.12, s * 0.42, s * 0.5, 0, 0, TAU);
    c.fill();
    for (const ex of [0.1, 0.3]) {
      c.fillStyle = '#fff8e8';
      c.beginPath();
      c.ellipse(s * ex, s * 0.1, s * 0.08, s * 0.1, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#16100c';
      c.fillRect(s * ex - s * 0.05, s * 0.09, s * 0.1, s * 0.035);
    }
  },
  crab(c, a, t) {
    const s = a.size;
    const run = Math.abs(a.vx) > 4 ? Math.sin(t * 22) : 0;
    c.strokeStyle = '#b4381f';
    c.lineWidth = s * 0.08;
    c.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const lx = side * s * (0.3 + i * 0.07);
        c.beginPath();
        c.moveTo(lx, s * 0.05);
        c.lineTo(lx + side * s * 0.28, s * 0.02 + (i % 2 ? run : -run) * s * 0.07);
        c.lineTo(lx + side * s * 0.36, s * 0.3);
        c.stroke();
      }
      // Claws lift as it takes fright.
      c.save();
      c.translate(side * s * 0.36, -s * 0.08);
      c.rotate(side * (0.3 - a.mood * 1.3));
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(side * s * 0.3, -s * 0.1);
      c.stroke();
      c.fillStyle = '#d8502c';
      c.beginPath();
      c.arc(side * s * 0.38, -s * 0.14, s * 0.15, side > 0 ? -2.4 + a.mood * 0.5 : -0.75 - a.mood * 0.5, side > 0 ? 3.2 : 5.6 + a.mood * 0.5 - 0.5);
      c.lineTo(side * s * 0.38, -s * 0.14);
      c.fill();
      c.restore();
    }
    const g = c.createRadialGradient(0, -s * 0.12, s * 0.05, 0, 0, s * 0.5);
    g.addColorStop(0, '#f0714a');
    g.addColorStop(1, '#a9301a');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, s * 0.46, s * 0.28, 0, 0, TAU);
    c.fill();
    for (const side of [-1, 1]) {
      c.strokeStyle = '#a9301a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(side * s * 0.12, -s * 0.24);
      c.lineTo(side * s * 0.14, -s * 0.4);
      c.stroke();
      c.fillStyle = '#111';
      c.beginPath();
      c.arc(side * s * 0.14, -s * 0.42, s * 0.05, 0, TAU);
      c.fill();
    }
  },
  seahorse(c, a, t) {
    const s = a.size;
    const col = `hsl(${lerp(46, 350, a.mood)} ${70 + a.mood * 15}% ${58 + a.mood * 6}%)`;
    c.fillStyle = col;
    // Body: beads along an S curve, tapering into a curled tail.
    for (let i = 0; i <= 26; i++) {
      const u = i / 26;
      let x: number;
      let y: number;
      if (u < 0.6) {
        const v = u / 0.6;
        x = Math.sin(v * Math.PI) * s * 0.22 - s * 0.05;
        y = lerp(-s * 0.35, s * 0.3, v);
      } else {
        const v = (u - 0.6) / 0.4;
        const ang = v * 4.4 + Math.sin(t * 1.5 + a.phase) * 0.2;
        const rad = s * 0.16 * (1 - v * 0.75);
        x = -s * 0.05 + Math.sin(ang) * rad - s * 0.02;
        y = s * 0.3 + s * 0.16 - Math.cos(ang) * rad;
      }
      const r = s * lerp(0.15, 0.03, Math.pow(u, 0.8)) * (u < 0.15 ? 0.8 + u : 1);
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    // Head and snout.
    c.beginPath();
    c.ellipse(s * 0.02, -s * 0.44, s * 0.15, s * 0.13, -0.3, 0, TAU);
    c.fill();
    c.fillRect(s * 0.1, -s * 0.45, s * 0.26, s * 0.065);
    c.beginPath();
    c.moveTo(-s * 0.06, -s * 0.55);
    c.lineTo(-s * 0.02, -s * 0.68);
    c.lineTo(s * 0.05, -s * 0.56);
    c.fill();
    // Fluttering fin.
    c.fillStyle = `hsla(${lerp(46, 350, a.mood)}, 80%, 80%, 0.7)`;
    c.beginPath();
    c.moveTo(-s * 0.1, -s * 0.1);
    c.lineTo(-s * 0.3, -s * 0.14 + Math.sin(t * 18) * s * 0.03);
    c.lineTo(-s * 0.28, s * 0.06 + Math.cos(t * 18) * s * 0.03);
    c.lineTo(-s * 0.06, s * 0.08);
    c.fill();
    c.fillStyle = '#1a1205';
    c.beginPath();
    c.arc(s * 0.06, -s * 0.47, s * 0.03, 0, TAU);
    c.fill();
  },
  manta(c, a, t) {
    const s = a.size;
    const flap = Math.sin(t * 1.8 + a.phase) * s * 0.22;
    c.strokeStyle = '#13283d';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-s * 0.4, 0);
    c.quadraticCurveTo(-s * 0.9, flap * 0.3, -s * 1.3, flap * 0.5);
    c.stroke();
    const g = c.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
    g.addColorStop(0, '#1c3a57');
    g.addColorStop(0.5, '#2d5677');
    g.addColorStop(1, '#1c3a57');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(s * 0.5, -s * 0.1);
    c.quadraticCurveTo(s * 0.1, -s * 0.3, -s * 0.1, -s * 0.75 + flap);
    c.quadraticCurveTo(-s * 0.25, -s * 0.2, -s * 0.45, 0);
    c.quadraticCurveTo(-s * 0.25, s * 0.2, -s * 0.1, s * 0.75 - flap);
    c.quadraticCurveTo(s * 0.1, s * 0.3, s * 0.5, s * 0.1);
    c.closePath();
    c.fill();
    c.fillStyle = '#2d5677';
    c.fillRect(s * 0.45, -s * 0.14, s * 0.14, s * 0.06);
    c.fillRect(s * 0.45, s * 0.08, s * 0.14, s * 0.06);
    c.fillStyle = 'rgba(220, 235, 245, 0.35)';
    c.beginPath();
    c.ellipse(s * 0.12, 0, s * 0.16, s * 0.08, 0, 0, TAU);
    c.fill();
  },
  whale(c, a, t) {
    const s = a.size;
    const sway = Math.sin(t * 0.7 + a.phase) * s * 0.05;
    c.fillStyle = `rgba(9, 38, 66, ${0.55 + a.mood * 0.25})`;
    c.beginPath();
    c.moveTo(s * 0.5, s * 0.02);
    c.bezierCurveTo(s * 0.45, -s * 0.16, 0, -s * 0.2, -s * 0.3, -s * 0.06);
    c.quadraticCurveTo(-s * 0.42, -s * 0.03 + sway * 0.5, -s * 0.5, -s * 0.14 + sway);
    c.quadraticCurveTo(-s * 0.47, sway, -s * 0.52, s * 0.1 + sway);
    c.quadraticCurveTo(-s * 0.42, s * 0.03 + sway * 0.5, -s * 0.3, s * 0.05);
    c.bezierCurveTo(0, s * 0.16, s * 0.4, s * 0.16, s * 0.5, s * 0.02);
    c.fill();
    c.beginPath();
    c.moveTo(s * 0.18, s * 0.08);
    c.quadraticCurveTo(s * 0.1, s * 0.3, -s * 0.02, s * 0.3 + sway);
    c.quadraticCurveTo(s * 0.06, s * 0.16, s * 0.06, s * 0.1);
    c.fill();
    c.fillStyle = 'rgba(160, 200, 225, 0.25)';
    c.beginPath();
    c.ellipse(s * 0.28, s * 0.07, s * 0.2, s * 0.035, -0.08, 0, Math.PI);
    c.fill();
    c.fillStyle = 'rgba(210, 235, 250, 0.6)';
    c.beginPath();
    c.arc(s * 0.38, -s * 0.02, s * 0.008, 0, TAU);
    c.fill();
  },
  starfish(c, a, t) {
    const s = a.size;
    if (a.mood > 0.02) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 1.6);
      g.addColorStop(0, `rgba(255, 170, 110, ${0.45 * a.mood})`);
      g.addColorStop(1, 'rgba(255, 170, 110, 0)');
      c.fillStyle = g;
      c.fillRect(-s * 1.6, -s * 1.6, s * 3.2, s * 3.2);
    }
    c.fillStyle = `hsl(${18 + a.mood * 14} 85% ${56 + a.mood * 10}%)`;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU - Math.PI / 2;
      const curl = Math.sin(t * 3 + i * 1.3) * 0.3 * a.mood;
      const tipA = ang + curl;
      const l = ang - 0.63;
      const r = ang + 0.63;
      if (i === 0) c.moveTo(Math.cos(l) * s * 0.3, Math.sin(l) * s * 0.3);
      c.quadraticCurveTo(Math.cos(ang - 0.18) * s * 0.7, Math.sin(ang - 0.18) * s * 0.7, Math.cos(tipA) * s, Math.sin(tipA) * s);
      c.quadraticCurveTo(Math.cos(ang + 0.18) * s * 0.7, Math.sin(ang + 0.18) * s * 0.7, Math.cos(r) * s * 0.3, Math.sin(r) * s * 0.3);
    }
    c.fill();
    c.fillStyle = 'rgba(255, 235, 200, 0.7)';
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU - Math.PI / 2;
      for (const d of [0.25, 0.5, 0.72]) {
        c.beginPath();
        c.arc(Math.cos(ang) * s * d, Math.sin(ang) * s * d, s * 0.045, 0, TAU);
        c.fill();
      }
    }
  },
};

export class OceanScene implements Scene {
  private lively: boolean;
  private w = 0;
  private h = 0;
  private water: HTMLCanvasElement | null = null;
  private bed: HTMLCanvasElement | null = null;
  private animals: Animal[] = [];
  private bubbles: Bubble[] = [];
  private puffs: Puff[] = [];
  private rings: Ring[] = [];
  private kelp: Kelp[] = [];
  private snow: { x: number; y: number; r: number; v: number }[] = [];
  private anemone = { x: 0, y: 0, lean: 0 };
  private floor = 0;
  private built = false;

  constructor(lively: boolean) {
    this.lively = lively;
  }

  resize(w: number, h: number): void {
    const first = !this.built;
    const sx = this.w ? w / this.w : 1;
    const sy = this.h ? h / this.h : 1;
    this.w = w;
    this.h = h;
    this.floor = h - Math.max(26, Math.min(70, h * 0.07));
    const rnd = seeded(77);

    const water = document.createElement('canvas');
    water.width = Math.max(1, w);
    water.height = Math.max(1, h);
    const c = water.getContext('2d') as Ctx;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0f6d8f');
    g.addColorStop(0.35, '#0a4a74');
    g.addColorStop(0.75, '#062a52');
    g.addColorStop(1, '#031634');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const glow = c.createRadialGradient(w * 0.5, -h * 0.2, 0, w * 0.5, -h * 0.2, Math.max(w, h) * 0.9);
    glow.addColorStop(0, 'rgba(140, 230, 235, 0.35)');
    glow.addColorStop(1, 'rgba(140, 230, 235, 0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    // Far reef shapes, lost in the blue.
    c.fillStyle = 'rgba(4, 30, 58, 0.55)';
    c.beginPath();
    c.moveTo(0, h);
    for (let x = 0; x <= w; x += 24) c.lineTo(x, this.floor - 30 - Math.abs(Math.sin(x * 0.006 + 1) * 70) - rnd() * 14);
    c.lineTo(w, h);
    c.fill();
    this.water = water;

    // Seabed with rocks and coral.
    const bed = document.createElement('canvas');
    bed.width = Math.max(1, w);
    bed.height = Math.max(1, h);
    const b = bed.getContext('2d') as Ctx;
    const sand = b.createLinearGradient(0, this.floor - 20, 0, h);
    sand.addColorStop(0, '#1d4a66');
    sand.addColorStop(1, '#0a2238');
    b.fillStyle = sand;
    b.beginPath();
    b.moveTo(0, h);
    for (let x = 0; x <= w + 20; x += 20) b.lineTo(x, this.floor + Math.sin(x * 0.011) * 9 + Math.sin(x * 0.04) * 3);
    b.lineTo(w, h);
    b.fill();
    const corals = Math.max(3, Math.round(w / 190));
    for (let i = 0; i < corals; i++) {
      const cx = (i + 0.2 + rnd() * 0.6) * (w / corals);
      const hue = [340, 18, 280, 45][Math.floor(rnd() * 4)];
      if (rnd() < 0.45) {
        b.fillStyle = '#122f47';
        b.beginPath();
        b.ellipse(cx, this.floor + 6, 30 + rnd() * 30, 16 + rnd() * 14, 0, Math.PI, TAU);
        b.fill();
      }
      // Branching coral.
      b.strokeStyle = `hsl(${hue} 55% 46%)`;
      b.lineCap = 'round';
      const branch = (x: number, y: number, ang: number, len: number, wd: number, depth: number) => {
        const x2 = x + Math.cos(ang) * len;
        const y2 = y + Math.sin(ang) * len;
        b.lineWidth = wd;
        b.beginPath();
        b.moveTo(x, y);
        b.lineTo(x2, y2);
        b.stroke();
        if (depth > 0) {
          branch(x2, y2, ang - 0.35 - rnd() * 0.3, len * 0.72, wd * 0.72, depth - 1);
          branch(x2, y2, ang + 0.35 + rnd() * 0.3, len * 0.72, wd * 0.72, depth - 1);
        }
      };
      branch(cx + 30, this.floor + 6, -Math.PI / 2 + (rnd() - 0.5) * 0.3, 13 + rnd() * 9, 6, 3);
    }
    this.bed = bed;

    const many = this.lively;
    this.kelp = [];
    const stalks = Math.round((w / 150) * (many ? 1.3 : 0.8));
    for (let i = 0; i < stalks; i++) {
      this.kelp.push({ x: rnd() * w, h: h * (0.16 + rnd() * 0.22), phase: rnd() * TAU, bend: 0, hue: 130 + rnd() * 40 });
    }
    this.anemone = { x: w * (w > 700 ? 0.12 : 0.2), y: this.floor + 4, lean: 0 };
    this.snow = [];
    for (let i = 0; i < (many ? 70 : 34); i++) this.snow.push({ x: rnd() * w, y: rnd() * h, r: 0.5 + rnd() * 1, v: 3 + rnd() * 7 });

    if (!first) {
      for (const a of this.animals) {
        a.x *= sx;
        a.hx *= sx;
        const grounded = a.kind === 'crab' || a.kind === 'starfish' || a.kind === 'clown';
        a.y = grounded ? this.floor - (a.kind === 'clown' ? 30 : a.kind === 'crab' ? 6 : -4) : a.y * sy;
        a.hy = grounded ? a.y : a.hy * sy;
      }
      for (const bb of this.bubbles) bb.x *= sx;
      return;
    }
    this.built = true;
    const add = (kind: Animal['kind'], x: number, y: number, size: number, hue = 0): Animal => {
      const a: Animal = { kind, x, y, vx: 0, vy: 0, dir: rnd() < 0.5 ? 1 : -1, size, phase: rnd() * TAU, mood: 0, hx: x, hy: y, hue, spin: 0, cool: 0 };
      this.animals.push(a);
      return a;
    };
    const big = Math.min(1.25, Math.max(0.7, w / 1300));
    if (many) add('whale', w * 0.7, h * 0.24, 520 * big).vx = -9;
    const school = (n: number, cx: number, cy: number, hue: number) => {
      for (let i = 0; i < n; i++) {
        const a = add('fish', cx + (rnd() - 0.5) * 160, cy + (rnd() - 0.5) * 100, 15 + rnd() * 6, hue + rnd() * 20);
        a.vx = 30 * (many ? 1 : 0.5);
      }
    };
    school(many ? 34 : 10, w * 0.18, h * 0.42, 172);
    if (many) school(14, w * 0.85, h * 0.62, 38);
    const jellies = many ? 5 : 2;
    for (let i = 0; i < jellies; i++) add('jelly', w * (i % 2 ? 0.08 + rnd() * 0.14 : 0.8 + rnd() * 0.14), h * (0.2 + rnd() * 0.5), 20 + rnd() * 14, [285, 200, 320, 180, 260][i]);
    add('turtle', w * 0.88, h * 0.4, 46 * big);
    add('puffer', w * 0.1, h * 0.68, 24);
    add('seahorse', w * 0.93, this.floor - 80, 40);
    add('starfish', w * 0.82, this.floor + 14, 16);
    add('clown', this.anemone.x + 8, this.floor - 30, 20);
    if (many) {
      add('clown', this.anemone.x - 14, this.floor - 44, 16);
      add('octopus', w * 0.9, this.floor - 28, 34);
      add('crab', w * 0.24, this.floor - 6, 22);
      add('manta', w * 0.3, h * 0.2, 80 * big).vx = 22;
      add('starfish', w * 0.06, this.floor + 16, 13).hue = 1;
    }
  }

  private step(a: Animal, t: number, dt: number, p: Pointer): void {
    const { w, h, lively } = this;
    const pace = lively ? 1 : 0.5;
    const dx = a.x - p.x;
    const dy = a.y - p.y;
    const d = p.active ? Math.hypot(dx, dy) : Infinity;
    const near = (r: number) => clamp(1 - d / r, 0, 1);
    const mood = (target: number, up = 6, down = 1.2) => {
      a.mood += (target - a.mood) * Math.min(1, dt * (target > a.mood ? up : down));
    };
    const wrap = (m: number) => {
      if (a.x < -m) a.x = w + m;
      if (a.x > w + m) a.x = -m;
    };
    switch (a.kind) {
      case 'fish': {
        // Boids: stay together, match heading, keep apart; flee the pointer.
        let cx = 0, cy = 0, ax = 0, ay = 0, sxp = 0, syp = 0, n = 0;
        for (const o of this.animals) {
          if (o === a || o.kind !== 'fish' || Math.abs(o.hue - a.hue) > 40) continue;
          const ox = o.x - a.x;
          const oy = o.y - a.y;
          const od = Math.hypot(ox, oy);
          if (od > 130) continue;
          cx += o.x; cy += o.y; ax += o.vx; ay += o.vy; n++;
          if (od < 22 && od > 0) { sxp -= ox / od; syp -= oy / od; }
        }
        let fx = 0, fy = 0;
        if (n) {
          fx += (cx / n - a.x) * 0.5 + (ax / n - a.vx) * 0.9 + sxp * 60;
          fy += (cy / n - a.y) * 0.5 + (ay / n - a.vy) * 0.9 + syp * 60;
        }
        const fear = near(150);
        mood(fear, 10, 1.5);
        if (fear > 0 && d > 0) { fx += (dx / d) * fear * 1500; fy += (dy / d) * fear * 1500; }
        // Keep to mid-water.
        fy += (clamp(a.y, h * 0.14, this.floor - 60) - a.y) * 3;
        fx += Math.sin(t * 0.3 + a.phase) * 8;
        a.vx += fx * dt;
        a.vy += fy * dt;
        const sp = Math.hypot(a.vx, a.vy) || 1;
        const want = clamp(sp, 26 * pace, (60 + a.mood * 220) * pace + a.mood * 120);
        a.vx = (a.vx / sp) * want;
        a.vy = (a.vy / sp) * want * 0.985;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        wrap(30);
        break;
      }
      case 'jelly': {
        mood(near(150));
        const beat = Math.max(0, Math.sin(t * (1.6 + a.mood * 2.4) + a.phase));
        a.vy += (-beat * 16 * pace - a.mood * 30 + 5) * dt;
        a.vy *= Math.pow(0.4, dt);
        a.vx = Math.sin(t * 0.3 + a.phase) * 5 * pace + (d < 150 && d > 0 ? (dx / d) * a.mood * 18 : 0);
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.y < -a.size * 3) { a.y = h + a.size; a.x = a.hx; }
        if (a.y > h + a.size * 4) a.y = h + a.size;
        break;
      }
      case 'turtle': {
        // Curious: it glides over to the pointer and circles it.
        const curious = p.active && d < 420;
        mood(curious ? 1 : 0, 2, 0.8);
        let tx = a.hx + Math.cos(t * 0.11 * pace + a.phase) * w * 0.1;
        let ty = a.hy + Math.sin(t * 0.17 * pace + a.phase) * h * 0.12;
        if (curious) { tx = p.x + Math.cos(t * 0.6) * 70; ty = p.y + Math.sin(t * 0.6) * 46; }
        const ddx = tx - a.x;
        const ddy = ty - a.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        const sp = Math.min(dd, (22 + a.mood * 34) * pace + 6);
        a.vx += ((ddx / dd) * sp - a.vx) * Math.min(1, dt * 1.5);
        a.vy += ((ddy / dd) * sp - a.vy) * Math.min(1, dt * 1.5);
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        break;
      }
      case 'puffer': {
        mood(near(130) > 0 ? 1 : 0, 7, 0.7);
        const tx = a.hx + Math.cos(t * 0.2 * pace + a.phase) * 60;
        const ty = a.hy + Math.sin(t * 0.33 * pace + a.phase) * 34;
        a.vx += ((tx - a.x) * 0.5 - a.vx) * Math.min(1, dt * 2);
        a.vy += ((ty - a.y) * 0.5 - a.vy) * Math.min(1, dt * 2);
        a.x += a.vx * dt * (1 - a.mood * 0.8);
        a.y += a.vy * dt * (1 - a.mood * 0.8);
        break;
      }
      case 'octopus': {
        const scared = near(120) > 0;
        mood(scared || a.cool > 0 ? 1 : 0, 8, 0.5);
        a.cool = Math.max(0, a.cool - dt);
        if (scared && a.cool <= 0 && d > 0) {
          // Ink, then jet away from the pointer.
          a.cool = lively ? 2.6 : 4;
          for (let i = 0; i < 16; i++) {
            const ang = Math.random() * TAU;
            this.puffs.push({ x: a.x, y: a.y, r: 6 + Math.random() * 10, life: 1, vx: Math.cos(ang) * 20, vy: Math.sin(ang) * 20 - 6 });
          }
          if (lively) { a.vx = (dx / d) * 330; a.vy = (dy / d) * 200 - 60; }
        }
        // Drift back home when calm.
        if (a.cool <= 0) {
          a.vx += (a.hx - a.x) * 0.35 * dt;
          a.vy += (a.hy - a.y) * 0.35 * dt;
        }
        a.vx *= Math.pow(0.12, dt);
        a.vy *= Math.pow(0.12, dt);
        a.x = clamp(a.x + a.vx * dt, 30, w - 30);
        a.y = clamp(a.y + a.vy * dt, 40, this.floor - 10);
        break;
      }
      case 'crab': {
        const fear = near(140);
        mood(fear > 0 ? 1 : 0, 9, 1);
        const flee = fear > 0 ? Math.sign(dx || 1) * 170 * fear : 0;
        const stroll = Math.sin(t * 0.35 + a.phase) > 0.55 ? Math.sign(Math.sin(t * 0.13 + a.phase)) * 22 : 0;
        a.vx += ((flee || stroll) - a.vx) * Math.min(1, dt * 6);
        a.x = clamp(a.x + a.vx * dt, 20, w - 20);
        a.y = this.floor - 6 + Math.sin(a.x * 0.011) * 9;
        break;
      }
      case 'seahorse': {
        mood(near(140) > 0 ? 1 : 0, 4, 0.8);
        a.y = a.hy + Math.sin(t * 0.8 * pace + a.phase) * 10;
        a.x = a.hx + Math.sin(t * 0.37 * pace + a.phase) * 6;
        if (p.active && d < 200) a.dir = p.x > a.x ? 1 : -1;
        break;
      }
      case 'manta': {
        if (near(150) > 0 && a.spin <= 0 && a.cool <= 0) { a.spin = 1; a.cool = 4; }
        a.cool = Math.max(0, a.cool - dt);
        if (a.spin > 0) a.spin = Math.max(0, a.spin - dt * 0.8);
        mood(a.spin > 0 ? 1 : 0);
        a.x += a.vx * dt * (1 + a.mood);
        a.y = a.hy + Math.sin(t * 0.25 + a.phase) * h * 0.06;
        a.dir = a.vx > 0 ? 1 : -1;
        if (a.x > w + 160) a.x = -160;
        break;
      }
      case 'whale': {
        const here = near(a.size * 0.5) > 0;
        mood(here ? 1 : 0, 3, 0.6);
        a.cool -= dt;
        if (here && a.cool <= 0) {
          a.cool = 0.7;
          this.rings.push({ x: a.x + a.dir * a.size * 0.4, y: a.y, r: 14, life: 1 });
        }
        a.x += a.vx * dt;
        a.y = a.hy + Math.sin(t * 0.15) * 14;
        a.dir = a.vx > 0 ? 1 : -1;
        if (a.x < -a.size) a.x = w + a.size;
        break;
      }
      case 'clown': {
        // It ducks into the anemone and peeks back out.
        const hide = near(150) > 0 ? 1 : 0;
        mood(hide, 9, 0.9);
        const tx = a.hx + Math.sin(t * 0.9 + a.phase) * 16 * (1 - a.mood);
        const ty = a.hy + Math.cos(t * 1.3 + a.phase) * 8 * (1 - a.mood) + a.mood * 30;
        a.dir = Math.cos(t * 0.9 + a.phase) > 0 ? 1 : -1;
        a.x += (tx - a.x) * Math.min(1, dt * 6);
        a.y += (ty - a.y) * Math.min(1, dt * 6);
        break;
      }
      case 'starfish':
        mood(near(110) > 0 ? 1 : 0, 5, 0.6);
        break;
    }
  }

  targets(): { id: string; x: number; y: number }[] {
    return this.animals.map((a) => ({ id: a.kind, x: a.x, y: a.y }));
  }

  frame(ctx: Ctx, t: number, dt: number, p: Pointer): Focus | null {
    const { w, h, lively } = this;
    if (this.water) ctx.drawImage(this.water, 0, 0);

    // Shafts of light from the surface. They lean toward the pointer.
    ctx.globalCompositeOperation = 'lighter';
    const rays = lively ? 7 : 4;
    const lean = p.active ? (p.x / w - 0.5) * 60 : 0;
    for (let i = 0; i < rays; i++) {
      const sway = Math.sin(t * (lively ? 0.22 : 0.07) + i * 1.7) * (lively ? 50 : 18);
      const x0 = ((i + 0.5) / rays) * w + sway * 0.4;
      const wd = w * 0.035 + (i % 3) * 14;
      const x1 = x0 - w * 0.12 + sway + lean;
      const rg = ctx.createLinearGradient(0, 0, 0, h * 0.85);
      rg.addColorStop(0, `rgba(170, 240, 240, ${0.09 + 0.03 * Math.sin(t * 0.5 + i)})`);
      rg.addColorStop(1, 'rgba(170, 240, 240, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x0 - wd * 0.5, 0);
      ctx.lineTo(x0 + wd * 0.5, 0);
      ctx.lineTo(x1 + wd * 2, h * 0.85);
      ctx.lineTo(x1 - wd * 2, h * 0.85);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const a of this.animals) this.step(a, t, dt, p);
    const draw = (a: Animal) => {
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.kind === 'fish') {
        ctx.rotate(Math.atan2(a.vy, Math.abs(a.vx)) * (a.vx < 0 ? -1 : 1));
        ctx.scale(a.vx < 0 ? -1 : 1, 1);
      } else if (a.kind === 'turtle') {
        ctx.rotate(Math.atan2(a.vy, a.vx));
      } else if (a.kind === 'manta') {
        ctx.scale(a.dir, 1);
        ctx.rotate(-a.spin * TAU);
      } else if (a.kind !== 'jelly' && a.kind !== 'starfish' && a.kind !== 'crab' && a.kind !== 'octopus') {
        ctx.scale(a.dir, 1);
      }
      if (a.kind === 'clown') ctx.globalAlpha = 1 - a.mood * 0.55;
      DRAW[a.kind](ctx, a, t);
      ctx.restore();
    };
    const back = ['whale', 'manta'];
    for (const a of this.animals) if (back.includes(a.kind)) draw(a);

    // Whale song.
    for (const r of this.rings) {
      r.life -= dt * 0.5;
      r.r += dt * 70;
      ctx.strokeStyle = `rgba(190, 235, 245, ${Math.max(0, r.life) * 0.45})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
    }
    this.rings = this.rings.filter((r) => r.life > 0);

    // Marine snow.
    ctx.fillStyle = 'rgba(200, 235, 240, 0.28)';
    for (const s of this.snow) {
      s.y += s.v * dt * (lively ? 1 : 0.5);
      s.x += Math.sin(t * 0.4 + s.y * 0.02) * 4 * dt;
      if (s.y > h) s.y = -2;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // Kelp bends away from the pointer.
    for (const k of this.kelp) {
      const baseY = this.floor + Math.sin(k.x * 0.011) * 9 + 4;
      const reachY = p.active && p.y > baseY - k.h - 30 && p.y < baseY + 20;
      const push = reachY ? clamp(1 - Math.abs(k.x - p.x) / 130, 0, 1) * Math.sign(k.x - p.x || 1) : 0;
      k.bend += (push - k.bend) * Math.min(1, dt * 3);
      const segs = 9;
      ctx.lineCap = 'round';
      let px = k.x;
      let py = baseY;
      for (let i = 1; i <= segs; i++) {
        const u = i / segs;
        const x = k.x + Math.sin(t * (lively ? 0.9 : 0.4) + k.phase + u * 2.4) * 16 * u + k.bend * 70 * u * u;
        const y = baseY - k.h * u;
        ctx.strokeStyle = `hsl(${k.hue} 45% ${22 + u * 14}%)`;
        ctx.lineWidth = 7 * (1 - u * 0.7);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = `hsl(${k.hue} 50% ${26 + u * 14}%)`;
        ctx.beginPath();
        ctx.ellipse(x + (i % 2 ? 9 : -9), y + 3, 10 * (1 - u * 0.5), 3.4, (i % 2 ? 0.5 : -0.5) + k.bend * 0.6, 0, TAU);
        ctx.fill();
        px = x;
        py = y;
      }
    }

    if (this.bed) ctx.drawImage(this.bed, 0, 0);

    // Anemone: tentacles lean away from the pointer.
    const an = this.anemone;
    const ad = p.active ? Math.hypot(an.x - p.x, an.y - 30 - p.y) : Infinity;
    an.lean += ((ad < 170 ? Math.sign(an.x - p.x || 1) * (1 - ad / 170) : 0) - an.lean) * Math.min(1, dt * 4);
    const hidden = this.animals.filter((a) => a.kind === 'clown');
    for (const a of hidden) draw(a);
    ctx.lineCap = 'round';
    for (let i = 0; i < 15; i++) {
      const u = i / 14 - 0.5;
      const len = 42 - Math.abs(u) * 30;
      const sway = Math.sin(t * (lively ? 1.4 : 0.6) + i * 0.8) * 5 + an.lean * 26;
      ctx.strokeStyle = `hsl(${312 + i * 3} 60% ${52 + (i % 3) * 6}%)`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(an.x + u * 44, an.y);
      ctx.quadraticCurveTo(an.x + u * 60, an.y - len * 0.6, an.x + u * 70 + sway, an.y - len);
      ctx.stroke();
      ctx.fillStyle = '#ffd9ee';
      ctx.beginPath();
      ctx.arc(an.x + u * 70 + sway, an.y - len, 3.2, 0, TAU);
      ctx.fill();
    }

    for (const a of this.animals) if (!back.includes(a.kind) && a.kind !== 'clown') draw(a);

    // Ink.
    for (const q of this.puffs) {
      q.life -= dt * 0.45;
      q.r += dt * 22;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      ctx.fillStyle = `rgba(10, 8, 24, ${Math.max(0, q.life) * 0.4})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, TAU);
      ctx.fill();
    }
    this.puffs = this.puffs.filter((q) => q.life > 0);

    // Bubbles rise; the pointer pops them.
    const wantBubbles = lively ? 34 : 10;
    if (this.bubbles.length < wantBubbles && Math.random() < dt * (lively ? 6 : 1.5)) {
      const src = this.kelp.length ? this.kelp[Math.floor(Math.random() * this.kelp.length)].x : Math.random() * w;
      this.bubbles.push({ x: src + (Math.random() - 0.5) * 30, y: this.floor, r: 2 + Math.random() * 5, v: 24 + Math.random() * 34, phase: Math.random() * TAU, pop: 0 });
    }
    for (const b of this.bubbles) {
      if (b.pop > 0) {
        b.pop += dt * 4;
        ctx.strokeStyle = `rgba(220, 245, 250, ${Math.max(0, 1 - b.pop)})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * TAU;
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(ang) * b.r * (1 + b.pop), b.y + Math.sin(ang) * b.r * (1 + b.pop));
          ctx.lineTo(b.x + Math.cos(ang) * b.r * (1.6 + b.pop * 2), b.y + Math.sin(ang) * b.r * (1.6 + b.pop * 2));
          ctx.stroke();
        }
        continue;
      }
      b.y -= b.v * dt * (lively ? 1 : 0.6);
      b.x += Math.sin(t * 2 + b.phase) * 10 * dt;
      if (p.active && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 14) b.pop = 0.01;
      ctx.strokeStyle = 'rgba(210, 245, 250, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, TAU);
      ctx.fill();
    }
    this.bubbles = this.bubbles.filter((b) => b.y > -10 && b.pop < 1);

    // A soft pool of light around the pointer.
    if (p.active) {
      const lg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 150);
      lg.addColorStop(0, 'rgba(190, 245, 245, 0.10)');
      lg.addColorStop(1, 'rgba(190, 245, 245, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(p.x - 150, p.y - 150, 300, 300);
    }

    if (!p.active) return null;
    let best: Animal | null = null;
    let bestD = Infinity;
    for (const a of this.animals) {
      const reach = a.kind === 'whale' ? a.size * 0.3 : a.kind === 'fish' ? 36 : Math.max(34, a.size * 1.1);
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < reach && d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (!best) return null;
    const a = best;
    const id = a.kind === 'fish' ? 'fish' : `${a.kind}-${this.animals.indexOf(a)}`;
    return { id, x: p.x, y: p.y, card: () => animalCard(a) };
  }
}

function animalCard(a: Animal): CardContent {
  const info = INFO[a.kind];
  return {
    title: info.name,
    subtitle: info.kind,
    rows: [
      ['Size', info.size],
      ['Reaction', info.reacts],
    ],
    note: info.fact,
    draw(ctx, size) {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#0f6d8f');
      g.addColorStop(1, '#062a52');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const span: Record<string, number> = { fish: 1.1, clown: 1.1, jelly: 3.4, turtle: 2.1, puffer: 1.5, octopus: 2.2, crab: 1.9, seahorse: 1.5, manta: 2.2, whale: 1.1, starfish: 2.3 };
      const s = (size * 0.84) / span[a.kind];
      const model: Animal = { ...a, x: 0, y: 0, vx: 1, vy: 0, dir: 1, size: s, mood: 0, spin: 0 };
      ctx.save();
      ctx.translate(size / 2, size / 2 + (a.kind === 'jelly' ? -s * 0.5 : a.kind === 'octopus' ? -s * 0.35 : 0));
      DRAW[a.kind](ctx, model, 0.4);
      ctx.restore();
    },
  };
}
