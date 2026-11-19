/** Status line wording and screen-reader announcements. */
import { OPPONENTS } from '../ai/opponents';
import type { Game } from '../game';
import type { GameState, Move } from '../rules';
import { LEVELS, NAMES, POSITIONS } from '../render/window';

export function resultText(game: Game): string {
  const s = game.state;
  if (s.result === 'draw') return 'Draw. Nobody made a line.';
  if (s.result === 'playing') return '';
  if (!game.vsComputer) return `${NAMES[s.result]} wins.`;
  return s.result === game.human ? 'You win.' : `${OPPONENTS[game.mode as keyof typeof OPPONENTS].name} wins.`;
}

export function statusText(game: Game): string {
  const s = game.state;
  if (s.result !== 'playing') return resultText(game);
  if (!game.vsComputer) return `${NAMES[s.next]} to move.`;
  if (s.next !== game.human) return `${OPPONENTS[game.mode as keyof typeof OPPONENTS].name} is thinking.`;
  return 'Your move.';
}

/** Where a square is, in words. */
export function place(game: Game, move: Move): string {
  return game.variant === 'classic' ? `the ${POSITIONS[move.pane]} square` : `the ${LEVELS[move.panel]} level, ${POSITIONS[move.pane]} square`;
}

/** What a screen reader hears after a move. */
export function announce(game: Game, prev: GameState, move: Move): string {
  const said = `${NAMES[prev.next]} played ${place(game, move)}.`;
  return game.state.result === 'playing' ? said : `${said} ${resultText(game)}`;
}
