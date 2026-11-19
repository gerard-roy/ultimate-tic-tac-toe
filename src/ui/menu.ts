/** Menu: resume, new game, sound levels, motion and tap options. Settings save at once. */
import type { Settings } from '../settings';
import { backgroundSelect } from './title';
import { h } from './dom';

export function buildMenu(opts: {
  settings: Settings;
  systemReduce: boolean;
  onChange(s: Settings): void;
  onNewGame(): void;
}): HTMLDialogElement {
  const s = opts.settings;
  const slider = (id: string, label: string, key: 'master' | 'effects' | 'room') => {
    const input = h('input', { type: 'range', id, min: 0, max: 100, step: 5, value: Math.round(s[key] * 100) });
    input.addEventListener('input', () => {
      s[key] = Number(input.value) / 100;
      opts.onChange(s);
    });
    return h('div', { class: 'field' }, h('label', { for: id, text: label }), input);
  };
  const check = (id: string, label: string, hint: string, value: boolean, change: (v: boolean) => void) => {
    const input = h('input', { type: 'checkbox', id });
    input.checked = value;
    input.addEventListener('change', () => change(input.checked));
    return h('div', { class: 'check' }, input, h('label', { for: id }, h('strong', { text: label }), h('span', { text: hint })));
  };

  const resume = h('button', { type: 'button', class: 'play', text: 'Resume' });
  const fresh = h('button', { type: 'button', text: 'New game' });
  const dialog = h(
    'dialog',
    { class: 'sheet menu', 'aria-labelledby': 'menu-title', 'data-solid': true },
    h('h2', { id: 'menu-title', text: 'Menu' }),
    h('div', { class: 'row' }, resume, fresh),
    h('h3', { text: 'Sound' }),
    slider('vol-master', 'Master', 'master'),
    slider('vol-effects', 'Effects', 'effects'),
    slider('vol-room', 'Room tone', 'room'),
    h('h3', { text: 'Motion and taps' }),
    check('opt-motion', 'Reduce motion', 'Marks and light change without movement, and the scenery is quieter.', s.reduceMotion ?? opts.systemReduce, (v) => {
      s.reduceMotion = v;
      opts.onChange(s);
    }),
    check('opt-taps', 'Tap twice to place', 'On a touch screen, the first tap previews a move.', s.confirmTaps, (v) => {
      s.confirmTaps = v;
      opts.onChange(s);
    }),
    h('h3', { text: 'Scenery' }),
    backgroundSelect(
      s.background,
      (id) => {
        s.background = id;
        opts.onChange(s);
      },
      'menu-bg',
    ),
    h('p', { class: 'small', text: 'Move the pointer over the scenery while you wait. Rest on a star or an animal to read about it.' }),
    h('p', { class: 'small', text: 'Keys: arrows move, Enter places, U undoes, M mutes, ? shows the rules.' }),
  );
  resume.addEventListener('click', () => dialog.close());
  fresh.addEventListener('click', () => {
    dialog.close();
    opts.onNewGame();
  });
  return dialog;
}
