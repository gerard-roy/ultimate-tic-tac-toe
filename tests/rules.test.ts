import { describe, expect, it } from 'vitest';
import { GameState, Move, legalMoves, newGame, play, replay, undo, isLegal, openPanels, sendTarget } from '../src/rules';

const mv = (panel: number, pane: number): Move => ({ panel, pane });
const run = (moves: [number, number][], first: 'amber' | 'cobalt' = 'amber') =>
  moves.reduce((s, [a, b]) => play(s, mv(a, b)), newGame(first));

/** Build a state directly for edge cases. */
function custom(partial: Partial<GameState>): GameState {
  return { ...newGame('amber'), ...partial };
}

describe('newGame', () => {
  it('starts empty with the given first player', () => {
    const s = newGame('cobalt');
    expect(s.panes).toHaveLength(81);
    expect(s.panes.every((p) => p === null)).toBe(true);
    expect(s.panels).toEqual(new Array(9).fill('open'));
    expect(s.next).toBe('cobalt');
    expect(s.target).toBeNull();
    expect(s.result).toBe('playing');
  });
});

describe('first move', () => {
  it('may go in any of the 81 panes', () => {
    expect(legalMoves(newGame())).toHaveLength(81);
  });
});

describe('turns', () => {
  it('alternates players and places marks', () => {
    const s = run([[4, 0]]);
    expect(s.panes[4 * 9 + 0]).toBe('amber');
    expect(s.next).toBe('cobalt');
  });
  it('rejects a mark in a filled pane', () => {
    const s = run([[4, 4]]);
    expect(() => play(s, mv(4, 4))).toThrow();
  });
});

describe('send rule', () => {
  it('a mark in pane n sends the opponent to panel n', () => {
    const s = run([[0, 5]]);
    expect(s.target).toBe(5);
    expect(legalMoves(s).every((m) => m.panel === 5)).toBe(true);
    expect(legalMoves(s)).toHaveLength(9);
    expect(isLegal(s, mv(3, 0))).toBe(false);
  });
  it('sending to a closed panel gives a free move', () => {
    // amber wins panel 0 with panes 0,1,2
    const st = custom({ panels: ['amber', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open'] });
    const st2 = play(st, mv(4, 0));
    expect(st2.target).toBeNull();
    expect(legalMoves(st2).some((m) => m.panel === 0)).toBe(false);
    expect(openPanels(st2)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('winning a panel', () => {
  for (const line of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) {
    it(`line ${line.join(',')} wins the panel`, () => {
      const panes = new Array(81).fill(null);
      panes[2 * 9 + line[0]] = 'amber';
      panes[2 * 9 + line[1]] = 'amber';
      const s = play(custom({ panes }), mv(2, line[2]));
      expect(s.panels[2]).toBe('amber');
    });
  }
  it('a won panel is closed to further play', () => {
    const s = custom({ panels: ['open', 'open', 'cobalt', 'open', 'open', 'open', 'open', 'open', 'open'], target: null });
    expect(isLegal(s, mv(2, 0))).toBe(false);
    expect(() => play(s, mv(2, 0))).toThrow();
  });
});

describe('drawn panels', () => {
  it('nine marks with no winner draws the panel', () => {
    // a b a / a b b / b a ? -> fill last with a: a b a / a b b / b a a  (no line)
    const pattern: ('amber' | 'cobalt' | null)[] = ['amber', 'cobalt', 'amber', 'amber', 'cobalt', 'cobalt', 'cobalt', 'amber', null];
    const panes = new Array(81).fill(null);
    pattern.forEach((p, i) => (panes[i] = p));
    const s = play(custom({ panes }), mv(0, 8));
    expect(s.panels[0]).toBe('drawn');
  });
  it('a drawn panel never counts toward a line for either player', () => {
    const s = custom({ panels: ['amber', 'amber', 'drawn', 'open', 'open', 'open', 'open', 'open', 'open'] });
    expect(s.result).toBe('playing');
    const panes = new Array(81).fill(null);
    panes[3 * 9 + 0] = 'cobalt';
    panes[3 * 9 + 1] = 'cobalt';
    const t = play({ ...s, panes, next: 'cobalt' }, mv(3, 2));
    expect(t.panels[3]).toBe('cobalt');
    expect(t.result).toBe('playing');
  });
});

describe('winning the game', () => {
  it('three won panels in a line wins at once', () => {
    const panes = new Array(81).fill(null);
    panes[2 * 9 + 0] = 'amber';
    panes[2 * 9 + 1] = 'amber';
    const s = custom({ panes, panels: ['amber', 'amber', 'open', 'open', 'open', 'open', 'open', 'open', 'open'] });
    const t = play(s, mv(2, 2));
    expect(t.result).toBe('amber');
    expect(t.target).toBeNull();
    expect(legalMoves(t)).toHaveLength(0);
  });
  it('a game cannot continue after it is won, even with open panes', () => {
    const s = custom({ result: 'cobalt' });
    expect(legalMoves(s)).toHaveLength(0);
    expect(() => play(s, mv(4, 4))).toThrow();
  });
  it('all panels closed with no line is a draw', () => {
    // panels: A C A / A C C / C A drawn-to-be
    const panels = ['amber', 'cobalt', 'amber', 'amber', 'cobalt', 'cobalt', 'cobalt', 'amber', 'open'] as GameState['panels'];
    const pattern = ['amber', 'cobalt', 'amber', 'amber', 'cobalt', 'cobalt', 'cobalt', 'amber', null];
    const panes = new Array(81).fill(null);
    pattern.forEach((p, i) => (panes[8 * 9 + i] = p));
    const t = play(custom({ panels, panes, target: 8 }), mv(8, 8));
    expect(t.panels[8]).toBe('drawn');
    expect(t.result).toBe('draw');
  });
});

describe('edge cases', () => {
  it('winning a panel while sending to that same panel gives a free move', () => {
    const panes = new Array(81).fill(null);
    panes[4 * 9 + 0] = 'amber';
    panes[4 * 9 + 8] = 'amber';
    const t = play(custom({ panes, target: 4 }), mv(4, 4));
    expect(t.panels[4]).toBe('amber');
    expect(t.target).toBeNull();
  });
  it('filling the last pane closes the panel before the target is worked out', () => {
    const pattern = ['amber', 'cobalt', 'amber', 'amber', 'cobalt', 'cobalt', 'cobalt', 'amber', null];
    const panes = new Array(81).fill(null);
    pattern.forEach((p, i) => (panes[8 * 9 + i] = p));
    const t = play(custom({ panes, target: 8 }), mv(8, 8));
    expect(t.panels[8]).toBe('drawn');
    expect(t.target).toBeNull();
  });
  it('sendTarget predicts the target, null for a free move', () => {
    expect(sendTarget(newGame(), mv(0, 3))).toBe(3);
    const panes = new Array(81).fill(null);
    panes[4 * 9 + 0] = 'amber';
    panes[4 * 9 + 8] = 'amber';
    expect(sendTarget(custom({ panes }), mv(4, 4))).toBeNull();
  });
  it('the first mover can be cobalt (rematches alternate)', () => {
    const s = run([[0, 0]], 'cobalt');
    expect(s.panes[0]).toBe('cobalt');
    expect(s.next).toBe('amber');
  });
});

describe('undo and replay', () => {
  it('undo replays history minus one move', () => {
    const s = run([[0, 4], [4, 4], [4, 0]]);
    const u = undo(s);
    expect(u.history).toEqual([mv(0, 4), mv(4, 4)]);
    expect(u).toEqual(run([[0, 4], [4, 4]]));
    expect(replay('amber', s.history)).toEqual(s);
  });
  it('play is pure', () => {
    const s = newGame();
    const copy = JSON.stringify(s);
    play(s, mv(0, 0));
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe('1,000 random games', () => {
  it('play to the end with no illegal state and no crash', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (let g = 0; g < 1000; g++) {
      let s = newGame(g % 2 ? 'cobalt' : 'amber');
      let turns = 0;
      while (s.result === 'playing') {
        const moves = legalMoves(s);
        expect(moves.length).toBeGreaterThan(0);
        const m = moves[Math.floor(rnd() * moves.length)];
        const prevTarget = s.target;
        if (prevTarget !== null) expect(m.panel).toBe(prevTarget);
        s = play(s, m);
        turns++;
        // invariants
        for (let p = 0; p < 9; p++) {
          if (s.panels[p] === 'open') expect(s.panes.slice(p * 9, p * 9 + 9).some((c) => c === null)).toBe(true);
        }
        if (s.target !== null) {
          expect(s.panels[s.target]).toBe('open');
          expect(s.target).toBe(m.pane);
        }
        if (s.result === 'playing') {
          expect(s.panels.some((p) => p === 'open')).toBe(true);
          for (const l of LINES) {
            const a = s.panels[l[0]];
            if (a === 'amber' || a === 'cobalt') expect(s.panels[l[1]] === a && s.panels[l[2]] === a).toBe(false);
          }
        }
      }
      expect(turns).toBeLessThanOrEqual(81);
      expect(legalMoves(s)).toHaveLength(0);
    }
  });
});
