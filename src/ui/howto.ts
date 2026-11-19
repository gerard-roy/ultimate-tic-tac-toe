/** How to play: four rules, each with a small animated board. */
import { h } from './dom';

interface Step {
  title: string;
  text: string;
  /** One string of nine squares a level: a amber, c cobalt, l empty; upper case marks arrive in turn. */
  demo: string[];
}

const STEPS: Step[] = [
  { title: 'Take turns', text: 'Amber plays crosses and Cobalt plays roundels. Place one mark in any empty square, on any of the three levels.', demo: ['lllllllll', 'llllAllll', 'lllllClll'] },
  { title: 'Three in a line wins', text: 'A row, a column or a diagonal on one level wins the game at once.', demo: ['AlclAcllA'] },
  { title: 'Lines run through the levels', text: 'A line can also go straight down through all three levels, or slant across them from one level to the next.', demo: ['Allllllll', 'llllAllll', 'llllllllA'] },
  { title: 'Classic', text: 'Classic is the same game on a single board of nine squares. If every square fills with no line, it is a draw.', demo: ['acaacccaA'] },
];

function demo(step: Step): HTMLElement {
  const stack = h('div', { class: `demo-stack${step.demo.length > 1 ? ' demo-levels' : ''}`, 'aria-hidden': 'true' });
  let order = 0;
  for (const level of step.demo) {
    const grid = h('div', { class: 'demo' });
    for (const ch of level) {
      const lower = ch.toLowerCase();
      const cls = lower === 'a' ? 'amber' : lower === 'c' ? 'cobalt' : 'lit';
      const cell = h('span', { class: `demo-cell ${cls}${ch !== lower ? ' arrives' : ''}` });
      if (ch !== lower) cell.style.setProperty('--i', String(order++));
      grid.append(cell);
    }
    stack.append(grid);
  }
  return stack;
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
  const open = dialog.showModal.bind(dialog);
  dialog.showModal = () => {
    index = 0;
    show();
    open();
  };
  return dialog;
}
