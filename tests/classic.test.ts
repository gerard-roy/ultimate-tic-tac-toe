import { describe, expect, it } from 'vitest';
import { classicChoose, classicMoves, classicPlay, classicUndo, newClassic } from '../src/classic';
import { mulberry32 } from '../src/ai/mcts';

const run = (panes: number[]) => panes.reduce((s, p) => classicPlay(s, { panel: 0, pane: p }), newClassic());

describe('classic tic-tac-toe', () => {
  it('starts with nine legal squares', () => {
    expect(classicMoves(newClassic())).toHaveLength(9);
  });
  it('alternates and rejects a filled square', () => {
    const s = run([4]);
    expect(s.next).toBe('cobalt');
    expect(() => classicPlay(s, { panel: 0, pane: 4 })).toThrow();
  });
  it('three in a line wins and ends the game', () => {
    const s = run([0, 3, 1, 4, 2]);
    expect(s.result).toBe('amber');
    expect(classicMoves(s)).toHaveLength(0);
    expect(() => classicPlay(s, { panel: 0, pane: 8 })).toThrow();
  });
  it('a full board with no line is a draw', () => {
    expect(run([0, 1, 2, 4, 3, 5, 7, 6, 8]).result).toBe('draw');
  });
  it('undo removes one move', () => {
    expect(classicUndo(run([0, 4])).history).toEqual([{ panel: 0, pane: 0 }]);
  });
  it('master never loses to random play, from either side', () => {
    const rng = mulberry32(5);
    for (let g = 0; g < 200; g++) {
      const masterSide = g % 2 ? 'amber' : 'cobalt';
      let s = newClassic('amber');
      while (s.result === 'playing') {
        const m =
          s.next === masterSide
            ? classicChoose('master', s, rng)
            : classicMoves(s)[Math.floor(rng() * classicMoves(s).length)];
        s = classicPlay(s, m);
      }
      expect(s.result === masterSide || s.result === 'draw').toBe(true);
    }
  });
  it('apprentice takes a win when one is on offer', () => {
    const s = run([0, 3, 1, 4]);
    expect(classicChoose('apprentice', s).pane).toBe(2);
  });
});
