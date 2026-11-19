/**
 * 3D tic-tac-toe on three stacked 3 by 3 levels: 27 squares and 49 lines.
 * A square is `panel` (the level, 0 at the top) and `pane` (0 to 8, row by row).
 */
import { other, type GameState, type Move, type Player } from './rules';

/** Every line of three: along a level, straight down through the levels, or slanting across them. */
export const CUBE_LINES: readonly (readonly [number, number, number])[] = (() => {
  const lines: [number, number, number][] = [];
  const at = (z: number, y: number, x: number) => z * 9 + y * 3 + x;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // Each direction once: the first step that is not zero must be positive.
        const lead = dz !== 0 ? dz : dy !== 0 ? dy : dx;
        if (lead <= 0) continue;
        for (let z = 0; z < 3; z++) {
          for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
              const ez = z + 2 * dz;
              const ey = y + 2 * dy;
              const ex = x + 2 * dx;
              if (ez < 0 || ez > 2 || ey < 0 || ey > 2 || ex < 0 || ex > 2) continue;
              lines.push([at(z, y, x), at(z + dz, y + dy, x + dx), at(ez, ey, ex)]);
            }
          }
        }
      }
    }
  }
  return lines;
})();

const THROUGH: number[][] = Array.from({ length: 27 }, (_, cell) =>
  CUBE_LINES.map((line, i) => (line.includes(cell) ? i : -1)).filter((i) => i >= 0),
);
/** Squares on the most lines first: the centre, then corners, then the rest. */
const ORDER: number[] = Array.from({ length: 27 }, (_, i) => i).sort((a, b) => THROUGH[b].length - THROUGH[a].length);

export function newCube(first: Player = 'amber'): GameState {
  return {
    panes: new Array(27).fill(null),
    panels: ['open', 'open', 'open'],
    next: first,
    target: null,
    result: 'playing',
    history: [],
    first,
  };
}

export function cubeLegal(state: GameState, move: Move): boolean {
  const { panel, pane } = move;
  if (state.result !== 'playing') return false;
  if (!Number.isInteger(panel) || !Number.isInteger(pane) || panel < 0 || panel > 2 || pane < 0 || pane > 8) return false;
  return state.panes[panel * 9 + pane] === null;
}

export function cubeMoves(state: GameState): Move[] {
  if (state.result !== 'playing') return [];
  const out: Move[] = [];
  for (let i = 0; i < 27; i++) if (state.panes[i] === null) out.push({ panel: Math.floor(i / 9), pane: i % 9 });
  return out;
}

/** The winning line as indexes into `panes`, or null. */
export function cubeLine(panes: readonly (Player | null)[]): readonly [number, number, number] | null {
  for (const l of CUBE_LINES) {
    const p = panes[l[0]];
    if (p && panes[l[1]] === p && panes[l[2]] === p) return l;
  }
  return null;
}

export function cubePlay(state: GameState, move: Move): GameState {
  if (!cubeLegal(state, move)) throw new Error(`Illegal move: level ${move.panel}, square ${move.pane}`);
  const panes = state.panes.slice();
  panes[move.panel * 9 + move.pane] = state.next;
  const result: GameState['result'] = cubeLine(panes) ? state.next : panes.every((p) => p !== null) ? 'draw' : 'playing';
  return {
    panes,
    panels: state.panels,
    next: other(state.next),
    target: null,
    result,
    history: [...state.history, { panel: move.panel, pane: move.pane }],
    first: state.first,
  };
}

export function cubeUndo(state: GameState): GameState {
  let s = newCube(state.first);
  for (const m of state.history.slice(0, -1)) s = cubePlay(s, m);
  return s;
}

// ---------- Opponents ----------

export type CubeLevel = 'apprentice' | 'glazier' | 'master';

export interface CubeSearch {
  /** How many moves ahead to look. */
  depth?: number;
  /** Stop deepening after this long. Leave out for a fixed depth, which is repeatable. */
  timeMs?: number;
  now?: () => number;
}

const WIN = 10000;
/** Worth of a line holding one or two marks of one side and none of the other. */
const WORTH = [0, 1, 6];

function completes(board: Int8Array, cell: number, who: number): boolean {
  for (const i of THROUGH[cell]) {
    const l = CUBE_LINES[i];
    if (board[l[0]] === who && board[l[1]] === who && board[l[2]] === who) return true;
  }
  return false;
}

function evaluate(board: Int8Array, who: number): number {
  let score = 0;
  for (const l of CUBE_LINES) {
    let mine = 0;
    let theirs = 0;
    for (const c of l) {
      if (board[c] === who) mine++;
      else if (board[c] !== 0) theirs++;
    }
    if (theirs === 0) score += WORTH[mine];
    else if (mine === 0) score -= WORTH[theirs];
  }
  return score;
}

interface Budget {
  nodes: number;
  deadline: number;
  now: () => number;
  out: boolean;
}

/** Best score the side to move can reach, looking `depth` moves ahead. */
function negamax(board: Int8Array, who: number, depth: number, alpha: number, beta: number, budget: Budget): number {
  if ((++budget.nodes & 1023) === 0 && budget.now() >= budget.deadline) budget.out = true;
  if (budget.out) return 0;
  let best = -Infinity;
  let any = false;
  for (const cell of ORDER) {
    if (board[cell] !== 0) continue;
    any = true;
    board[cell] = who;
    let v: number;
    // A sooner win scores higher, so the search does not dawdle.
    if (completes(board, cell, who)) v = WIN + depth;
    else if (depth <= 1) v = evaluate(board, who);
    else v = -negamax(board, 3 - who, depth - 1, -beta, -alpha, budget);
    board[cell] = 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}

/**
 * Apprentice takes a win when one is on offer, otherwise plays at random.
 * Glazier also blocks, looks two moves ahead, and plays at random one time in four.
 * Master blocks and looks up to six moves ahead.
 */
export function cubeChoose(level: CubeLevel, state: GameState, rng: () => number = Math.random, search: CubeSearch = {}): Move {
  const moves = cubeMoves(state);
  if (moves.length === 0) throw new Error('No legal moves');
  const board = new Int8Array(27);
  state.panes.forEach((p, i) => (board[i] = p === 'amber' ? 1 : p === 'cobalt' ? 2 : 0));
  const me = state.next === 'amber' ? 1 : 2;
  const cellOf = (m: Move) => m.panel * 9 + m.pane;
  const random = () => moves[Math.floor(rng() * moves.length)];
  const finishing = (who: number) =>
    moves.find((m) => {
      const c = cellOf(m);
      board[c] = who;
      const hit = completes(board, c, who);
      board[c] = 0;
      return hit;
    });

  const win = finishing(me);
  if (win) return win;
  if (level === 'apprentice') return random();
  const block = finishing(3 - me);
  if (block) return block;
  if (level === 'glazier' && rng() < 0.25) return random();

  const maxDepth = search.depth ?? (level === 'glazier' ? 2 : 6);
  const now = search.now ?? (() => performance.now());
  const limit = search.timeMs ?? (search.depth === undefined && level === 'master' ? 500 : Infinity);
  const budget: Budget = { nodes: 0, deadline: limit === Infinity ? Infinity : now() + limit, now, out: false };
  let best: Move[] = moves;
  for (let depth = 2; depth <= maxDepth; depth++) {
    let top = -Infinity;
    let found: Move[] = [];
    for (const m of moves) {
      const c = cellOf(m);
      board[c] = me;
      // A full window, so equal moves stay equal and the choice among them is left to chance.
      const v = -negamax(board, 3 - me, depth - 1, -Infinity, Infinity, budget);
      board[c] = 0;
      if (budget.out) break;
      if (v > top) {
        top = v;
        found = [m];
      } else if (v === top) found.push(m);
    }
    // A depth that ran out of time is thrown away; the last finished one stands.
    if (budget.out) break;
    best = found;
    if (top >= WIN) break;
  }
  return best[Math.floor(rng() * best.length)];
}

export const cubeWin = (state: GameState) => cubeLine(state.panes);
