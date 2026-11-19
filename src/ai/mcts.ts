import type { GameState, Move } from '../rules';

/** Fast mutable board used only inside the search. 1 = amber, 2 = cobalt. */
interface Board {
  cells: Uint8Array; // 81
  panels: Uint8Array; // 9: 0 open, 1 amber, 2 cobalt, 3 drawn
  mask: Uint16Array; // 18: per-panel 9-bit masks, [panel*2 + (player-1)]
  next: number;
  target: number; // -1 free
  result: number; // 0 playing, 1, 2, 3 draw
}

const LINES = [0b000000111, 0b000111000, 0b111000000, 0b001001001, 0b010010010, 0b100100100, 0b100010001, 0b001010100];
const WIN = new Uint8Array(512);
for (let m = 0; m < 512; m++) WIN[m] = LINES.some((l) => (m & l) === l) ? 1 : 0;

/** For a (mine, filled) pair: bitmask of panes that would complete a line for "mine". */
function winningPanes(mine: number, filled: number): number {
  let out = 0;
  for (const l of LINES) {
    const have = mine & l;
    if (popcount(have) === 2 && (filled & l & ~mine) === 0) out |= l & ~have;
  }
  return out;
}
function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

export function fromState(s: GameState): Board {
  const b: Board = {
    cells: new Uint8Array(81),
    panels: new Uint8Array(9),
    mask: new Uint16Array(18),
    next: s.next === 'amber' ? 1 : 2,
    target: s.target ?? -1,
    result: s.result === 'playing' ? 0 : s.result === 'amber' ? 1 : s.result === 'cobalt' ? 2 : 3,
  };
  for (let i = 0; i < 81; i++) {
    const v = s.panes[i] === 'amber' ? 1 : s.panes[i] === 'cobalt' ? 2 : 0;
    b.cells[i] = v;
    if (v) b.mask[((i / 9) | 0) * 2 + v - 1] |= 1 << i % 9;
  }
  for (let p = 0; p < 9; p++) {
    const st = s.panels[p];
    b.panels[p] = st === 'open' ? 0 : st === 'amber' ? 1 : st === 'cobalt' ? 2 : 3;
  }
  return b;
}

function clone(b: Board): Board {
  return {
    cells: b.cells.slice(),
    panels: b.panels.slice(),
    mask: b.mask.slice(),
    next: b.next,
    target: b.target,
    result: b.result,
  };
}

function copyInto(dst: Board, src: Board): void {
  dst.cells.set(src.cells);
  dst.panels.set(src.panels);
  dst.mask.set(src.mask);
  dst.next = src.next;
  dst.target = src.target;
  dst.result = src.result;
}

function windowMask(b: Board, player: number): number {
  let m = 0;
  for (let p = 0; p < 9; p++) if (b.panels[p] === player) m |= 1 << p;
  return m;
}

/** Moves encoded as panel*9+pane. */
function moves(b: Board, out: Int8Array): number {
  let n = 0;
  if (b.result) return 0;
  if (b.target >= 0) {
    const base = b.target * 9;
    for (let q = 0; q < 9; q++) if (!b.cells[base + q]) out[n++] = base + q;
    return n;
  }
  for (let p = 0; p < 9; p++) {
    if (b.panels[p]) continue;
    const base = p * 9;
    for (let q = 0; q < 9; q++) if (!b.cells[base + q]) out[n++] = base + q;
  }
  return n;
}

function apply(b: Board, m: number): void {
  const panel = (m / 9) | 0;
  const pane = m % 9;
  const me = b.next;
  b.cells[m] = me;
  const k = panel * 2 + me - 1;
  b.mask[k] |= 1 << pane;
  if (WIN[b.mask[k]]) {
    b.panels[panel] = me;
    if (WIN[windowMask(b, me)]) b.result = me;
  } else if ((b.mask[panel * 2] | b.mask[panel * 2 + 1]) === 511) {
    b.panels[panel] = 3;
  }
  if (!b.result) {
    let anyOpen = false;
    for (let p = 0; p < 9; p++) if (!b.panels[p]) anyOpen = true;
    if (!anyOpen) b.result = 3;
  }
  b.target = !b.result && !b.panels[pane] ? pane : -1;
  b.next = 3 - me;
}

/** Panels where `player` can win the panel with one pane AND that panel win would win the game. */
function gameWinPanels(b: Board, player: number): number {
  const wm = windowMask(b, player);
  let out = 0;
  for (let p = 0; p < 9; p++) {
    if (b.panels[p]) continue;
    if (!WIN[wm | (1 << p)]) continue;
    const mine = b.mask[p * 2 + player - 1];
    const filled = mine | b.mask[p * 2 + 2 - player];
    if (winningPanes(mine, filled)) out |= 1 << p;
  }
  return out;
}

/** A move (in the current panel options) that wins the game at once, or -1. */
function findGameWin(b: Board, list: Int8Array, n: number): number {
  const wm = windowMask(b, b.next);
  for (let i = 0; i < n; i++) {
    const m = list[i];
    const panel = (m / 9) | 0;
    if (!WIN[wm | (1 << panel)]) continue;
    const k = panel * 2 + b.next - 1;
    if (WIN[b.mask[k] | (1 << m % 9)]) return m;
  }
  return -1;
}

/** Does playing m hand the opponent an immediate game win? */
function handsOverWin(b: Board, m: number, scratch: Board): boolean {
  copyInto(scratch, b);
  apply(scratch, m);
  if (scratch.result) return false;
  const danger = gameWinPanels(scratch, scratch.next);
  if (!danger) return false;
  if (scratch.target < 0) return true;
  return (danger & (1 << scratch.target)) !== 0;
}

export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const listBuf = new Int8Array(81);
const safeBuf = new Int8Array(81);

function playout(b: Board, rng: Rng, scratch: Board): number {
  while (!b.result) {
    const n = moves(b, listBuf);
    const win = findGameWin(b, listBuf, n);
    if (win >= 0) {
      apply(b, win);
      break;
    }
    // Pick random moves, skipping ones that hand over an immediate game win.
    let safe = 0;
    const danger = gameWinPanels(b, 3 - b.next);
    if (danger) {
      for (let i = 0; i < n; i++) if (!handsOverWin(b, listBuf[i], scratch)) safeBuf[safe++] = listBuf[i];
    }
    if (safe > 0) apply(b, safeBuf[(rng() * safe) | 0]);
    else apply(b, listBuf[(rng() * n) | 0]);
  }
  return b.result;
}

interface Node {
  move: number;
  parent: Node | null;
  children: Node[];
  untried: number[];
  visits: number;
  wins: number; // from the perspective of the player who made `move`
  mover: number;
}

function makeNode(b: Board, move: number, parent: Node | null, mover: number): Node {
  const n = moves(b, listBuf);
  const untried: number[] = [];
  for (let i = 0; i < n; i++) untried.push(listBuf[i]);
  return { move, parent, children: [], untried, visits: 0, wins: 0, mover };
}

export interface SearchOptions {
  timeMs?: number;
  playouts?: number;
  seed?: number;
  c?: number;
  now?: () => number;
}

export interface SearchResult {
  move: Move;
  playouts: number;
}

export function search(state: GameState, opts: SearchOptions): SearchResult {
  const rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
  const C = opts.c ?? 1.4;
  const now = opts.now ?? (() => performance.now());
  const root0 = fromState(state);
  const rootMoves = moves(root0, listBuf);
  if (rootMoves === 0) throw new Error('No legal moves');
  // Immediate game win: take it.
  const instant = findGameWin(root0, listBuf, rootMoves);
  if (instant >= 0) return { move: { panel: (instant / 9) | 0, pane: instant % 9 }, playouts: 0 };
  if (rootMoves === 1) {
    const m = listBuf[0];
    return { move: { panel: (m / 9) | 0, pane: m % 9 }, playouts: 0 };
  }

  const root = makeNode(root0, -1, null, 3 - root0.next);
  const work = clone(root0);
  const scratch = clone(root0);
  const limit = opts.playouts ?? Infinity;
  const deadline = opts.timeMs !== undefined ? now() + opts.timeMs : Infinity;
  let count = 0;

  while (count < limit) {
    if ((count & 63) === 0 && now() >= deadline) break;
    copyInto(work, root0);
    let node = root;
    // Selection
    while (node.untried.length === 0 && node.children.length > 0) {
      const logN = Math.log(node.visits);
      let best: Node = node.children[0];
      let bestScore = -Infinity;
      for (const ch of node.children) {
        const s = ch.wins / ch.visits + C * Math.sqrt(logN / ch.visits);
        if (s > bestScore) {
          bestScore = s;
          best = ch;
        }
      }
      node = best;
      apply(work, node.move);
    }
    // Expansion
    if (node.untried.length > 0 && !work.result) {
      const i = (rng() * node.untried.length) | 0;
      const m = node.untried[i];
      node.untried[i] = node.untried[node.untried.length - 1];
      node.untried.pop();
      const mover = work.next;
      apply(work, m);
      const child = makeNode(work, m, node, mover);
      node.children.push(child);
      node = child;
    }
    // Simulation
    const result = work.result || playout(work, rng, scratch);
    // Backpropagation
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      if (result === n.mover) n.wins += 1;
      else if (result === 3) n.wins += 0.5;
    }
    count++;
  }

  let best = root.children[0];
  for (const ch of root.children) if (ch.visits > best.visits) best = ch;
  return { move: { panel: (best.move / 9) | 0, pane: best.move % 9 }, playouts: count };
}

/** A pane that wins a panel for the side to move, or null. */
export function panelWinMove(state: GameState): Move | null {
  const b = fromState(state);
  const n = moves(b, listBuf);
  for (let i = 0; i < n; i++) {
    const m = listBuf[i];
    const panel = (m / 9) | 0;
    if (WIN[b.mask[panel * 2 + b.next - 1] | (1 << m % 9)]) return { panel, pane: m % 9 };
  }
  return null;
}
