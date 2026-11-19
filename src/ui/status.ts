/** Status line wording and screen-reader announcements. */
import { OPPONENTS } from '../ai/opponents';
import type { Game } from '../game';
import { other, type GameState, type Move } from '../rules';
import { NAMES, POSITIONS } from '../render/window';

export function resultText(game: Game): string {
  const s = game.state;
  if (s.result === 'draw') return 'Draw. Nobody made a line.';
  if (s.result === 'playing') return '';
  if (!game.vsComputer) return `${NAMES[s.result]} wins.`;
  return s.result === game.human ? 'You win.' : `${OPPONENTS[game.mode as keyof typeof OPPONENTS].name} wins.`;
}

export function statusText(game: Game, coaching: boolean): string {
  const s = game.state;
  const classic = game.variant === 'classic';
  if (s.result !== 'playing') return resultText(game);
  const free = s.target === null && !classic;
  const where = classic ? '' : free ? ' Play in any lit panel.' : ' Play in the lit panel.';
  if (!game.vsComputer) {
    return `${NAMES[s.next]} to move.${free && s.history.length > 0 ? ' Free move.' : ''}${where}`;
  }
  const name = OPPONENTS[game.mode as keyof typeof OPPONENTS].name;
  if (s.next !== game.human) return `${name} is thinking.`;
  const last = s.history[s.history.length - 1];
  if (coaching && last && !classic) {
    const pane = POSITIONS[last.pane];
    const article = /^[aeiou]/.test(pane) ? 'an' : 'a';
    if (s.target !== null) return `${name} played ${article} ${pane} pane, so you play in the ${pane} panel.`;
    return `${name} played ${article} ${pane} pane, but that panel is closed, so you play in any lit panel.`;
  }
  if (classic) return 'Your move.';
  if (free && s.history.length > 0) return 'Free move. Play in any lit panel.';
  return free ? 'Your move. Play in any lit panel.' : 'Your move. Play in the lit panel.';
}

/** What a screen reader hears after a move. */
export function announce(game: Game, prev: GameState, move: Move): string {
  const s = game.state;
  const who = NAMES[prev.next];
  const classic = game.variant === 'classic';
  const parts: string[] = [];
  parts.push(classic ? `${who} played the ${POSITIONS[move.pane]} square.` : `${who} played the ${POSITIONS[move.panel]} panel, ${POSITIONS[move.pane]} pane.`);
  if (!classic) {
    const owner = s.panels[move.panel];
    if (owner !== prev.panels[move.panel]) {
      parts.push(owner === 'drawn' ? `The ${POSITIONS[move.panel]} panel is drawn.` : `${who} won the ${POSITIONS[move.panel]} panel.`);
    }
  }
  if (s.result !== 'playing') parts.push(resultText(game));
  else if (!classic) {
    const them = NAMES[other(prev.next)];
    parts.push(s.target === null ? `${them} has a free move.` : `${them} plays in the ${POSITIONS[s.target]} panel.`);
  }
  return parts.join(' ');
}
