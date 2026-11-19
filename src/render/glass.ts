/** Piece shapes, colour variation and the glass texture. Pane unit: 100. */

export const PANE = 100;
export const THIN = 5;
export const PANEL = PANE * 3 + THIN * 2; // 310
export const BAR = 14;
export const FRAME = 30;
export const WIN = FRAME * 2 + PANEL * 3 + BAR * 2; // 1018
export const ARCH = 240;
export const PIECE_LEAD = 3;

export type Role =
  | 'clear'
  | 'amber-arm'
  | 'amber-centre'
  | 'cobalt-ring'
  | 'cobalt-centre'
  | 'amber-band'
  | 'cobalt-band';

const TOKENS = {
  clearLit: '#D9EADF',
  clearUnlit: '#343B47',
  amberLit: '#FFB23E',
  amberDeep: '#E0701A',
  amberUnlit: '#7A4A1C',
  cobaltLit: '#4D8DFF',
  cobaltDeep: '#1F4FD1',
  cobaltUnlit: '#24386E',
  grisLit: '#8E8A99',
  grisUnlit: '#45424F',
  lead: '#08070C',
};

type HSL = [number, number, number];

function hexToHsl(hex: string): HSL {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** Deterministic hash of a position to [-1, 1]. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x27d4eb2d, 0x165667b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca77);
  x ^= x >>> 13;
  return ((x >>> 0) / 4294967295) * 2 - 1;
}

/** Each piece varies by up to 5% lightness and 3 degrees hue, seeded by position. */
export function vary(hex: string, seed: number): string {
  const [h, s, l] = hexToHsl(hex);
  const dh = hash(seed) * 3;
  const dl = hash(seed * 7 + 3) * 5;
  return `hsl(${(h + dh).toFixed(1)} ${s.toFixed(1)}% ${Math.max(0, Math.min(100, l + dl)).toFixed(1)}%)`;
}

export function colourFor(role: Role, lit: boolean, grisaille: boolean): string {
  if (grisaille) {
    if (role === 'clear') return lit ? TOKENS.grisLit : TOKENS.grisUnlit;
    // marks in a drawn panel keep their shape in a darker grisaille
    return lit ? mixHex(TOKENS.grisLit, TOKENS.lead, 0.28) : mixHex(TOKENS.grisUnlit, TOKENS.lead, 0.35);
  }
  switch (role) {
    case 'clear':
      return lit ? TOKENS.clearLit : TOKENS.clearUnlit;
    case 'amber-arm':
      return lit ? TOKENS.amberLit : TOKENS.amberUnlit;
    case 'amber-centre':
    case 'amber-band':
      return lit ? TOKENS.amberDeep : mixHex(TOKENS.amberUnlit, TOKENS.lead, 0.3);
    case 'cobalt-ring':
      return lit ? TOKENS.cobaltLit : TOKENS.cobaltUnlit;
    case 'cobalt-centre':
    case 'cobalt-band':
      return lit ? TOKENS.cobaltDeep : mixHex(TOKENS.cobaltUnlit, TOKENS.lead, 0.3);
  }
}

/** Colour of one piece at a light level from 0 (unlit) to 1 (lit), with its own slight variation. */
export function pieceColour(role: Role, level: number, grisaille: boolean, seed: number): string {
  const unlit = colourFor(role, false, grisaille);
  const lit = colourFor(role, true, grisaille);
  return vary(level <= 0 ? unlit : level >= 1 ? lit : mixHex(unlit, lit, level), seed);
}

export function flatColour(role: Role, level: number, grisaille: boolean): string {
  return mixHex(colourFor(role, false, grisaille), colourFor(role, true, grisaille), Math.max(0, Math.min(1, level)));
}

export interface Piece {
  role: Role;
  d: string; // path data in local pane/panel coordinates
  rule?: 'evenodd';
}

const f = (n: number) => +n.toFixed(2);
const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`;

/** A cross in a square of side `size` (100 for a pane). */
export function crossPieces(size: number, x0 = 0, y0 = 0): Piece[] {
  const k = size / 100;
  const c = 50 * k;
  const hw = 12 * k; // half of bar width 24
  const inset = 10 * k;
  const r2 = Math.SQRT1_2;
  const dj = hw / r2; // diamond half-diagonal
  const pieces: Piece[] = [{ role: 'clear', d: poly([[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size]]) }];
  // four arms: directions to corners
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sy] of corners) {
    const ex = c + sx * (c - inset);
    const ey = c + sy * (c - inset);
    // normal to the arm direction (sx,sy)/sqrt2 is (sy,-sx)/sqrt2 ... use perpendicular
    const nx = -sy * r2 * hw;
    const ny = sx * r2 * hw;
    const a: [number, number] = [ex + nx, ey + ny];
    const b: [number, number] = [ex - nx, ey - ny];
    // diamond vertices adjacent to this arm
    const v1: [number, number] = [c + sx * dj, c];
    const v2: [number, number] = [c, c + sy * dj];
    // order around: a -> (nearest diamond vertex to a) -> other -> b
    const da1 = Math.hypot(a[0] - v1[0], a[1] - v1[1]);
    const da2 = Math.hypot(a[0] - v2[0], a[1] - v2[1]);
    const [p, q] = da1 < da2 ? [v1, v2] : [v2, v1];
    pieces.push({ role: 'amber-arm', d: poly([a, p, q, b].map(([x, y]) => [x0 + x, y0 + y])) });
  }
  pieces.push({
    role: 'amber-centre',
    d: poly(([[c - dj, c], [c, c - dj], [c + dj, c], [c, c + dj]] as [number, number][]).map(([x, y]) => [x0 + x, y0 + y])),
  });
  return pieces;
}

/** A roundel: ring r 38/20 around a disc, with four clear corner pieces. */
export function roundelPieces(size: number, x0 = 0, y0 = 0): Piece[] {
  const k = size / 100;
  const c = 50 * k;
  const ro = 38 * k;
  const ri = 20 * k;
  const X = (v: number) => x0 + v;
  const Y = (v: number) => y0 + v;
  const pieces: Piece[] = [];
  // four clear corner pieces: each quadrant minus the outer circle
  const quads: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const [qx, qy] of quads) {
    const cx = qx ? size : 0;
    const cy = qy ? size : 0;
    // quadrant corners: from edge midpoint (c,cy) -> (cx,cy) -> (cx,c) -> arc back to start along circle
    const startTop: [number, number] = [c, cy === 0 ? 0 : size];
    const sideMid: [number, number] = [cx, c];
    const arcStart: [number, number] = [c + (qx ? ro : -ro), c];
    const arcEnd: [number, number] = [c, c + (qy ? ro : -ro)];
    const sweep = (qx ^ qy) ? 1 : 0;
    const d =
      `M${f(X(startTop[0]))} ${f(Y(startTop[1]))}L${f(X(cx))} ${f(Y(cy))}L${f(X(sideMid[0]))} ${f(Y(sideMid[1]))}` +
      `L${f(X(arcStart[0]))} ${f(Y(arcStart[1]))}A${f(ro)} ${f(ro)} 0 0 ${sweep} ${f(X(arcEnd[0]))} ${f(Y(arcEnd[1]))}Z`;
    pieces.push({ role: 'clear', d });
  }
  pieces.push({ role: 'cobalt-ring', d: circle(X(c), Y(c), ro) + circle(X(c), Y(c), ri), rule: 'evenodd' });
  pieces.push({ role: 'cobalt-centre', d: circle(X(c), Y(c), ri) });
  return pieces;
}

export function emptyPieces(size: number, x0 = 0, y0 = 0): Piece[] {
  return [{ role: 'clear', d: poly([[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size]]) }];
}

/** A won panel: one large emblem inside a band 12 wide in the deep colour. */
export function emblemPieces(player: 'amber' | 'cobalt'): Piece[] {
  const band = 12;
  const inner = PANEL - band * 2;
  const outer = poly([[0, 0], [PANEL, 0], [PANEL, PANEL], [0, PANEL]]);
  const hole = poly([[band, band], [PANEL - band, band], [PANEL - band, PANEL - band], [band, PANEL - band]]);
  const bandPiece: Piece = { role: player === 'amber' ? 'amber-band' : 'cobalt-band', d: outer + hole, rule: 'evenodd' };
  const inside = player === 'amber' ? crossPieces(inner, band, band) : roundelPieces(inner, band, band);
  return [bandPiece, ...inside];
}

let noiseUrl: string | null = null;
/** One 256px noise texture, generated at start. */
export function noiseTexture(): string {
  if (noiseUrl) return noiseUrl;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(256, 256);
  let seed = 99;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = seed >>> 24;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseUrl = c.toDataURL('image/png');
  return noiseUrl;
}
