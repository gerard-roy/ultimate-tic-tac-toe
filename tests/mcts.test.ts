import { describe, expect, it } from 'vitest';
import { isLegal, newGame, play, type GameState } from '../src/rules';
import { search } from '../src/ai/mcts';
import { choose } from '../src/ai/opponents';

describe('search', () => {
  it('returns a legal move', () => {
    const s = play(newGame(), { panel: 4, pane: 4 });
    const r = search(s, { playouts: 300, seed: 7 });
    expect(isLegal(s, r.move)).toBe(true);
  });
  it('is repeatable with a seed', () => {
    const s = play(newGame(), { panel: 0, pane: 2 });
    expect(search(s, { playouts: 500, seed: 42 }).move).toEqual(search(s, { playouts: 500, seed: 42 }).move);
  });
  it('takes an immediate game win', () => {
    const panes: GameState['panes'] = new Array(81).fill(null);
    panes[2 * 9 + 0] = 'amber';
    panes[2 * 9 + 1] = 'amber';
    const s: GameState = {
      ...newGame(),
      panes,
      panels: ['amber', 'amber', 'open', 'open', 'open', 'open', 'open', 'open', 'open'],
      target: 2,
    };
    expect(search(s, { playouts: 200, seed: 1 }).move).toEqual({ panel: 2, pane: 2 });
  });
  it('apprentice takes a panel win when on offer', () => {
    const panes: GameState['panes'] = new Array(81).fill(null);
    panes[5 * 9 + 3] = 'amber';
    panes[5 * 9 + 4] = 'amber';
    const s: GameState = { ...newGame(), panes, target: 5 };
    expect(choose('apprentice', s, { seed: 3, fixed: true })).toEqual({ panel: 5, pane: 5 });
  });
  it('plays whole games between opponents without illegal moves', () => {
    let s = newGame();
    let seed = 1;
    while (s.result === 'playing') {
      const m = choose(s.next === 'amber' ? 'glazier' : 'apprentice', s, { fixed: true, seed: seed++ });
      expect(isLegal(s, m)).toBe(true);
      s = play(s, m);
    }
    expect(['amber', 'cobalt', 'draw']).toContain(s.result);
  });
});
