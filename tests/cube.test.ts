import { describe, expect, it } from 'vitest';
import { CUBE_LINES, cubeChoose, cubeLegal, cubeLine, cubeMoves, cubePlay, cubeUndo, newCube } from '../src/cube';
import { mulberry32 } from '../src/ai/rng';
import type { Move } from '../src/rules';

const mv = (panel: number, pane: number): Move => ({ panel, pane });
const run = (moves: [number, number][], first: 'amber' | 'cobalt' = 'amber') =>
  moves.reduce((s, [a, b]) => cubePlay(s, mv(a, b)), newCube(first));

describe('the board', () => {
  it('has 27 squares, all open at the start', () => {
    const s = newCube();
    expect(s.panes).toHaveLength(27);
    expect(cubeMoves(s)).toHaveLength(27);
    expect(s.next).toBe('amber');
    expect(s.result).toBe('playing');
  });
  it('has 49 lines, each of three different squares in a straight line', () => {
    expect(CUBE_LINES).toHaveLength(49);
    expect(new Set(CUBE_LINES.map((l) => [...l].sort((a, b) => a - b).join())).size).toBe(49);
    const xyz = (c: number) => [Math.floor(c / 9), Math.floor((c % 9) / 3), c % 3];
    for (const [a, b, c] of CUBE_LINES) {
      const [pa, pb, pc] = [xyz(a), xyz(b), xyz(c)];
      for (let i = 0; i < 3; i++) expect(pb[i] - pa[i]).toBe(pc[i] - pb[i]);
    }
  });
  it('puts the very centre on 13 lines, corners on 7, and the rest on 4 or 5', () => {
    const count = (cell: number) => CUBE_LINES.filter((l) => l.includes(cell)).length;
    expect(count(13)).toBe(13);
    for (const corner of [0, 2, 6, 8, 18, 20, 24, 26]) expect(count(corner)).toBe(7);
    expect(count(4)).toBe(5);
    expect(count(1)).toBe(4);
  });
});

describe('turns', () => {
  it('alternates players and places marks on any level', () => {
    const s = run([[2, 4]]);
    expect(s.panes[2 * 9 + 4]).toBe('amber');
    expect(s.next).toBe('cobalt');
    expect(cubeMoves(s)).toHaveLength(26);
  });
  it('refuses a filled square and squares off the board', () => {
    const s = run([[1, 4]]);
    expect(() => cubePlay(s, mv(1, 4))).toThrow();
    expect(cubeLegal(s, mv(3, 0))).toBe(false);
    expect(cubeLegal(s, mv(0, 9))).toBe(false);
  });
  it('the first mover can be cobalt', () => {
    expect(run([[0, 0]], 'cobalt').panes[0]).toBe('cobalt');
  });
});

describe('winning', () => {
  const wins: [string, [number, number][]][] = [
    ['a row on one level', [[1, 3], [0, 0], [1, 4], [0, 1], [1, 5]]],
    ['a column on one level', [[2, 1], [0, 0], [2, 4], [0, 1], [2, 7]]],
    ['a diagonal on one level', [[0, 0], [1, 0], [0, 4], [1, 1], [0, 8]]],
    ['straight down through the levels', [[0, 4], [0, 0], [1, 4], [0, 1], [2, 4]]],
    ['slanting down a side', [[0, 0], [2, 8], [1, 1], [2, 7], [2, 2]]],
    ['corner to corner through the centre', [[0, 0], [0, 1], [1, 4], [0, 2], [2, 8]]],
  ];
  for (const [name, moves] of wins) {
    it(`${name} wins at once`, () => {
      const before = run(moves.slice(0, -1));
      expect(before.result).toBe('playing');
      const s = run(moves);
      expect(s.result).toBe('amber');
      expect(cubeLine(s.panes)).not.toBeNull();
      expect(cubeMoves(s)).toHaveLength(0);
    });
  }
  it('a game cannot continue after it is won', () => {
    const s = run([[0, 4], [0, 0], [1, 4], [0, 1], [2, 4]]);
    expect(() => cubePlay(s, mv(2, 0))).toThrow();
  });
  it('three squares that do not form a straight line do not win', () => {
    expect(run([[0, 0], [2, 0], [1, 1], [2, 1], [0, 2]]).result).toBe('playing');
  });
});

describe('undo', () => {
  it('replays history minus one move, and play is pure', () => {
    const s = run([[0, 4], [1, 4], [2, 0]]);
    const copy = JSON.stringify(s);
    expect(cubeUndo(s)).toEqual(run([[0, 4], [1, 4]]));
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe('2,000 random games', () => {
  it('all end with a winner: three levels of nine squares cannot be filled without a line', () => {
    const rng = mulberry32(99);
    for (let g = 0; g < 2000; g++) {
      let s = newCube(g % 2 ? 'cobalt' : 'amber');
      while (s.result === 'playing') {
        const moves = cubeMoves(s);
        expect(moves.length).toBeGreaterThan(0);
        s = cubePlay(s, moves[Math.floor(rng() * moves.length)]);
      }
      expect(s.result).not.toBe('draw');
      expect(s.history.length).toBeLessThanOrEqual(27);
    }
  });
});

describe('opponents', () => {
  it('every level takes a win when one is on offer', () => {
    const s = run([[0, 4], [0, 0], [1, 4], [0, 1]]);
    for (const level of ['apprentice', 'glazier', 'master'] as const) {
      expect(cubeChoose(level, s, mulberry32(1), { depth: 2 })).toEqual(mv(2, 4));
    }
  });
  it('glazier and master block a line that is one square from done', () => {
    const s = run([[0, 4], [0, 0], [1, 4]]);
    // Seed 3 does not roll Glazier's one-in-four random move.
    expect(cubeChoose('glazier', s, mulberry32(3))).toEqual(mv(2, 4));
    expect(cubeChoose('master', s, mulberry32(3), { depth: 4 })).toEqual(mv(2, 4));
  });
  it('master opens in the very centre', () => {
    expect(cubeChoose('master', newCube(), mulberry32(1), { depth: 2 })).toEqual(mv(1, 4));
  });
  it('is repeatable with a seed and a fixed depth', () => {
    const s = run([[0, 0], [1, 4]]);
    expect(cubeChoose('master', s, mulberry32(8), { depth: 4 })).toEqual(cubeChoose('master', s, mulberry32(8), { depth: 4 }));
  });
  it('master moving first beats random play every time', () => {
    const rng = mulberry32(4);
    for (let g = 0; g < 60; g++) {
      let s = newCube('amber');
      while (s.result === 'playing') {
        const moves = cubeMoves(s);
        const m = s.next === 'amber' ? cubeChoose('master', s, rng, { depth: 3 }) : moves[Math.floor(rng() * moves.length)];
        expect(cubeLegal(s, m)).toBe(true);
        s = cubePlay(s, m);
      }
      expect(s.result).toBe('amber');
    }
  });
});
