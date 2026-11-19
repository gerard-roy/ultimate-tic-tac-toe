export type Player = 'amber' | 'cobalt';
export type PanelState = 'open' | 'amber' | 'cobalt' | 'drawn';
export type Move = { panel: number; pane: number };

export interface GameState {
  panes: (Player | null)[];
  panels: PanelState[];
  next: Player;
  target: number | null;
  result: 'playing' | Player | 'draw';
  history: Move[];
  first: Player;
}

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const other = (p: Player): Player => (p === 'amber' ? 'cobalt' : 'amber');

export function newGame(first: Player = 'amber'): GameState {
  return {
    panes: new Array(81).fill(null),
    panels: new Array(9).fill('open'),
    next: first,
    target: null,
    result: 'playing',
    history: [],
    first,
  };
}

export function lineWinner<T>(cells: readonly T[], isOwner: (c: T) => Player | null): Player | null {
  for (const [a, b, c] of LINES) {
    const p = isOwner(cells[a]);
    if (p && isOwner(cells[b]) === p && isOwner(cells[c]) === p) return p;
  }
  return null;
}

export function winningLine(panels: readonly PanelState[]): readonly [number, number, number] | null {
  for (const line of LINES) {
    const p = panels[line[0]];
    if ((p === 'amber' || p === 'cobalt') && panels[line[1]] === p && panels[line[2]] === p) return line;
  }
  return null;
}

export function panelWinLine(state: GameState, panel: number): readonly [number, number, number] | null {
  const base = panel * 9;
  for (const line of LINES) {
    const p = state.panes[base + line[0]];
    if (p && state.panes[base + line[1]] === p && state.panes[base + line[2]] === p) return line;
  }
  return null;
}

export function isLegal(state: GameState, move: Move): boolean {
  if (state.result !== 'playing') return false;
  const { panel, pane } = move;
  if (!Number.isInteger(panel) || !Number.isInteger(pane) || panel < 0 || panel > 8 || pane < 0 || pane > 8) return false;
  if (state.panels[panel] !== 'open') return false;
  if (state.target !== null && state.target !== panel) return false;
  return state.panes[panel * 9 + pane] === null;
}

export function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  if (state.result !== 'playing') return moves;
  for (let panel = 0; panel < 9; panel++) {
    if (state.panels[panel] !== 'open') continue;
    if (state.target !== null && state.target !== panel) continue;
    for (let pane = 0; pane < 9; pane++) {
      if (state.panes[panel * 9 + pane] === null) moves.push({ panel, pane });
    }
  }
  return moves;
}

export function openPanels(state: GameState): number[] {
  if (state.result !== 'playing') return [];
  if (state.target !== null) return [state.target];
  const out: number[] = [];
  for (let i = 0; i < 9; i++) if (state.panels[i] === 'open') out.push(i);
  return out;
}

/** Panel the opponent would be sent to if `move` were played; null = free move. */
export function sendTarget(state: GameState, move: Move): number | null {
  const after = play(state, move);
  return after.result === 'playing' ? after.target : null;
}

export function play(state: GameState, move: Move): GameState {
  if (!isLegal(state, move)) throw new Error(`Illegal move: panel ${move.panel}, pane ${move.pane}`);
  const panes = state.panes.slice();
  const panels = state.panels.slice();
  const me = state.next;
  const base = move.panel * 9;
  panes[base + move.pane] = me;

  const panelCells = panes.slice(base, base + 9);
  const won = lineWinner(panelCells, (c) => c);
  if (won) panels[move.panel] = won;
  else if (panelCells.every((c) => c !== null)) panels[move.panel] = 'drawn';

  let result: GameState['result'] = 'playing';
  const gameWinner = lineWinner(panels, (p) => (p === 'amber' || p === 'cobalt' ? p : null));
  if (gameWinner) result = gameWinner;
  else if (panels.every((p) => p !== 'open')) result = 'draw';

  const target = result === 'playing' && panels[move.pane] === 'open' ? move.pane : null;

  return {
    panes,
    panels,
    next: other(me),
    target,
    result,
    history: [...state.history, { panel: move.panel, pane: move.pane }],
    first: state.first,
  };
}

export function undo(state: GameState): GameState {
  let s = newGame(state.first);
  for (const m of state.history.slice(0, -1)) s = play(s, m);
  return s;
}

export function replay(first: Player, history: Move[]): GameState {
  let s = newGame(first);
  for (const m of history) s = play(s, m);
  return s;
}
