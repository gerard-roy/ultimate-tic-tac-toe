/** Title screen: the game and opponent pickers. */
import { OPPONENTS } from '../ai/opponents';
import { BACKGROUNDS, type BackgroundId } from '../bg';
import { Game, type Mode, type Variant } from '../game';
import { h } from './dom';

export interface TitleChoice {
  variant: Variant;
  mode: Mode;
}

const GAMES: { id: Variant; name: string; line: string }[] = [
  { id: 'ninefold', name: 'Ninefold', line: 'Nine panels of nine panes.' },
  { id: 'classic', name: 'Classic', line: 'Tic-tac-toe on nine squares.' },
];

const MODES: { id: Mode; name: string; line: string }[] = [
  { id: 'apprentice', name: OPPONENTS.apprentice.name, line: OPPONENTS.apprentice.line },
  { id: 'glazier', name: OPPONENTS.glazier.name, line: OPPONENTS.glazier.line },
  { id: 'master', name: OPPONENTS.master.name, line: OPPONENTS.master.line },
  { id: 'two', name: 'Two players', line: 'Take turns on this device.' },
];

export function backgroundSelect(current: BackgroundId, onChange: (id: BackgroundId) => void, id: string): HTMLElement {
  const select = h('select', { id });
  for (const b of BACKGROUNDS) {
    const o = h('option', { value: b.id, text: b.name });
    if (b.id === current) o.selected = true;
    select.append(o);
  }
  select.addEventListener('change', () => onChange(select.value as BackgroundId));
  return h('div', { class: 'field' }, h('label', { for: id, text: 'Background' }), select);
}

export function buildTitle(opts: {
  variant: Variant;
  mode: Mode;
  background: BackgroundId;
  onVariant(v: Variant): void;
  onBackground(id: BackgroundId): void;
  onPlay(choice: TitleChoice): void;
}): HTMLElement {
  let variant = opts.variant;
  let mode = opts.mode;

  const radios = <T extends string>(name: string, legend: string, items: { id: T; name: string; line: string }[], value: T, cls: string, change: (v: T) => void) => {
    const set = h('fieldset', { class: `choices ${cls}` }, h('legend', { text: legend }));
    for (const item of items) {
      const input = h('input', { type: 'radio', name, value: item.id, id: `${name}-${item.id}` });
      input.checked = item.id === value;
      input.addEventListener('change', () => change(item.id));
      set.append(
        h('div', { class: 'choice' }, input, h('label', { for: `${name}-${item.id}` }, h('strong', { text: item.name }), h('span', { text: item.line }))),
      );
    }
    return set;
  };

  const tally = h('p', { class: 'small tally' });
  const showTally = () => {
    if (mode === 'two') {
      tally.textContent = '';
      return;
    }
    const t = Game.stats()[variant === 'classic' ? `classic-${mode}` : mode];
    tally.textContent = t ? `Against ${OPPONENTS[mode].name}: ${t.win} won, ${t.loss} lost, ${t.draw} drawn.` : '';
  };

  const play = h('button', { class: 'play', type: 'submit', text: 'Play' });
  const form = h(
    'form',
    { class: 'title-panel', 'data-solid': true, 'aria-label': 'New game' },
    radios('game', 'Game', GAMES, variant, 'choices-row', (v) => {
      variant = v;
      opts.onVariant(v);
      showTally();
    }),
    radios('mode', 'Opponent', MODES, mode, '', (v) => {
      mode = v;
      showTally();
    }),
    backgroundSelect(opts.background, opts.onBackground, 'title-bg'),
    play,
    tally,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    opts.onPlay({ variant, mode });
  });
  showTally();
  return form;
}
