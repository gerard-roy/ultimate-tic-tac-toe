import { legalMoves, type GameState, type Move } from '../rules';
import { mulberry32, panelWinMove, search } from './mcts';

export type OpponentId = 'apprentice' | 'glazier' | 'master';

export interface Opponent {
  id: OpponentId;
  name: string;
  line: string;
}

export const OPPONENTS: Record<OpponentId, Opponent> = {
  apprentice: { id: 'apprentice', name: 'Apprentice', line: 'Still learning. Plays fast and misses traps.' },
  glazier: { id: 'glazier', name: 'Glazier', line: 'Steady hands. Takes what you give away.' },
  master: { id: 'master', name: 'Master', line: 'Plans many moves ahead. Rarely forgives.' },
};

export interface ChooseOptions {
  seed?: number;
  /** Use fixed playout counts instead of thinking time (balance script, tests). */
  fixed?: boolean;
  phone?: boolean;
}

export const FIXED_PLAYOUTS: Record<OpponentId, number> = { apprentice: 150, glazier: 1500, master: 12000 };

export function choose(id: OpponentId, state: GameState, opts: ChooseOptions = {}): Move {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const fixed = opts.fixed ?? false;
  if (id === 'apprentice') {
    const win = panelWinMove(state);
    if (win) return win;
    const rng = mulberry32(seed ^ 0x9e3779b9);
    if (rng() < 0.6) {
      const ms = legalMoves(state);
      return ms[Math.floor(rng() * ms.length)];
    }
    return search(state, fixed ? { playouts: FIXED_PLAYOUTS.apprentice, seed } : { timeMs: 30, seed }).move;
  }
  if (id === 'glazier') return search(state, fixed ? { playouts: FIXED_PLAYOUTS.glazier, seed } : { timeMs: 250, seed }).move;
  return search(state, fixed ? { playouts: FIXED_PLAYOUTS.master, seed } : { timeMs: opts.phone ? 800 : 1200, seed }).move;
}
