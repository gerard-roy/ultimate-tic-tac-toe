/** Types shared by both games. Each game keeps its own rules: src/cube.ts and src/classic.ts. */
export type Player = 'amber' | 'cobalt';
export type PanelState = 'open' | 'amber' | 'cobalt' | 'drawn';
/** `panel` is the level (0 is the top; always 0 in Classic) and `pane` is the square on it, 0 to 8 row by row. */
export type Move = { panel: number; pane: number };

export interface GameState {
  /** One entry a square, index = panel * 9 + pane. */
  panes: (Player | null)[];
  /** One entry a level. Levels never close, so each stays 'open'. */
  panels: PanelState[];
  next: Player;
  target: number | null;
  result: 'playing' | Player | 'draw';
  history: Move[];
  first: Player;
}

/** The eight lines of one 3 by 3 board. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const other = (p: Player): Player => (p === 'amber' ? 'cobalt' : 'amber');
