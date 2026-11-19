/**
 * Classic tic-tac-toe on nine squares. It reuses the GameState shape with a
 * single panel, so the same window, controller and saves work for both games.
 */
import { LINES, other, type GameState, type Move, type Player } from './rules';

export function newClassic(first: Player = 'amber'): GameState {
  return {
    panes: new Array(9).fill(null),
    panels: ['open'],
    next: first,
    target: 0,
    result: 'playing',
    history: [],
    first,
  };
}

export function classicLegal(state: GameState, move: Move): boolean {
  return (
    state.result === 'playing' &&
    move.panel === 0 &&
    Number.isInteger(move.pane) &&
    move.pane >= 0 &&
    move.pane <= 8 &&
    state.panes[move.pane] === null
  );
}

export function classicMoves(state: GameState): Move[] {
  if (state.result !== 'playing') return [];
  const out: Move[] = [];
  for (let i = 0; i < 9; i++) if (state.panes[i] === null) out.push({ panel: 0, pane: i });
  return out;
}

export function classicLine(panes: readonly (Player | null)[]): readonly [number, number, number] | null {
  for (const l of LINES) {
    const p = panes[l[0]];
    if (p && panes[l[1]] === p && panes[l[2]] === p) return l;
  }
  return null;
}

export function classicPlay(state: GameState, move: Move): GameState {
  if (!classicLegal(state, move)) throw new Error(`Illegal move: pane ${move.pane}`);
  const panes = state.panes.slice();
  panes[move.pane] = state.next;
  const line = classicLine(panes);
  const result: GameState['result'] = line ? state.next : panes.every((p) => p !== null) ? 'draw' : 'playing';
  return {
    panes,
    panels: ['open'],
    next: other(state.next),
    target: result === 'playing' ? 0 : null,
    result,
    history: [...state.history, { panel: 0, pane: move.pane }],
    first: state.first,
  };
}

export function classicUndo(state: GameState): GameState {
  let s = newClassic(state.first);
  for (const m of state.history.slice(0, -1)) s = classicPlay(s, m);
  return s;
}

/** Minimax value for the side to move: 1 win, 0 draw, -1 loss. Prefers faster wins. */
const memo = new Map<number, number>();
function minimax(panes: (Player | null)[], me: Player, depth: number): number {
  const line = classicLine(panes);
  if (line) return -(10 - depth); // the previous mover just won
  if (panes.every((p) => p !== null)) return 0;
  let key = me === 'amber' ? 1 : 2;
  for (let i = 0; i < 9; i++) key = key * 3 + (panes[i] === null ? 0 : panes[i] === 'amber' ? 1 : 2);
  const known = memo.get(key);
  if (known !== undefined) return known;
  let best = -Infinity;
  for (let i = 0; i < 9; i++) {
    if (panes[i] !== null) continue;
    panes[i] = me;
    const v = -minimax(panes, other(me), depth + 1);
    panes[i] = null;
    if (v > best) best = v;
  }
  memo.set(key, best);
  return best;
}

export type ClassicLevel = 'apprentice' | 'glazier' | 'master';

/**
 * Apprentice takes a win when one is on offer, otherwise plays at random.
 * Glazier also blocks, and plays the best move three times in four.
 * Master never loses.
 */
export function classicChoose(level: ClassicLevel, state: GameState, rng: () => number = Math.random): Move {
  const moves = classicMoves(state);
  const panes = state.panes.slice();
  const me = state.next;
  const random = () => moves[Math.floor(rng() * moves.length)];
  const completes = (who: Player) =>
    moves.find((m) => {
      panes[m.pane] = who;
      const hit = classicLine(panes) !== null;
      panes[m.pane] = null;
      return hit;
    });
  const win = completes(me);
  if (win) return win;
  if (level === 'apprentice') return random();
  const block = completes(other(me));
  if (block) return block;
  if (level === 'glazier' && rng() < 0.25) return random();
  let best: Move[] = [];
  let bestV = -Infinity;
  for (const m of moves) {
    panes[m.pane] = me;
    const v = -minimax(panes, other(me), 1);
    panes[m.pane] = null;
    if (v > bestV) {
      bestV = v;
      best = [m];
    } else if (v === bestV) best.push(m);
  }
  return best[Math.floor(rng() * best.length)];
}
