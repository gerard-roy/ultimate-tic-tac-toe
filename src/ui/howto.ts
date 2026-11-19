/** How to play: four rules, each with a small animated panel. */
import { h } from './dom';

interface Step {
  title: string;
  text: string;
  /** Cells of a 3 by 3 demo: a amber, c cobalt, l lit, . unlit; upper case marks arrive in turn. */
  demo: string;
  wide?: boolean;
}

const STEPS: Step[] = [
  { title: 'Take turns', text: 'Amber plays crosses and Cobalt plays roundels. Place one mark in an empty pane of a lit panel.', demo: 'lAl lCl lAl'.replace(/ /g, '') },
  { title: 'Your pane sends them', text: 'The pane you choose decides where your opponent plays next. Play the top-right pane and they must play in the top-right panel.', demo: '..L ... ...'.replace(/ /g, ''), wide: true },
  { title: 'Win a panel', text: 'Three of your marks in a line wins that panel and closes it. If you are sent to a closed panel, you may play in any lit panel.', demo: 'AcA cAc Acl'.replace(/ /g, '') },
  { title: 'Win the window', text: 'Three won panels in a line wins the game. If every panel closes with no line, it is a draw.', demo: 'A.c .Ac c.A'.replace(/ /g, ''), wide: true },
];

function demo(step: Step): HTMLElement {
  const grid = h('div', { class: `demo${step.wide ? ' demo-wide' : ''}`, 'aria-hidden': 'true' });
  let order = 0;
  for (const ch of step.demo) {
    const lower = ch.toLowerCase();
    const cls = lower === 'a' ? 'amber' : lower === 'c' ? 'cobalt' : lower === 'l' ? 'lit' : 'unlit';
    const cell = h('span', { class: `demo-cell ${cls}${ch !== lower ? ' arrives' : ''}` });
    if (ch !== lower) cell.style.setProperty('--i', String(order++));
    grid.append(cell);
  }
  return grid;
}

export function buildHowTo(): HTMLDialogElement {
  let index = 0;
  const title = h('h2');
  const text = h('p');
  const holder = h('div', { class: 'demo-holder' });
  const count = h('p', { class: 'small' });
  const back = h('button', { type: 'button', text: 'Back' });
  const next = h('button', { type: 'button', class: 'play', text: 'Next' });
  const dialog = h('dialog', { class: 'sheet howto', 'aria-labelledby': 'howto-title', 'data-solid': true }, title, holder, text, count, h('div', { class: 'row' }, back, next));
  title.id = 'howto-title';
  const show = () => {
    const s = STEPS[index];
    title.textContent = s.title;
    text.textContent = s.text;
    holder.replaceChildren(demo(s));
    count.textContent = `Rule ${index + 1} of ${STEPS.length}`;
    back.disabled = index === 0;
    next.textContent = index === STEPS.length - 1 ? 'Close' : 'Next';
  };
  back.addEventListener('click', () => {
    index = Math.max(0, index - 1);
    show();
  });
  next.addEventListener('click', () => {
    if (index === STEPS.length - 1) dialog.close();
    else {
      index++;
      show();
    }
  });
  dialog.addEventListener('close', () => {
    index = 0;
  });
  const open = dialog.showModal.bind(dialog);
  dialog.showModal = () => {
    index = 0;
    show();
    open();
  };
  return dialog;
}
