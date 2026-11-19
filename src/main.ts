import './styles/tokens.css';
import './styles/main.css';
import { Sound } from './audio';
import { Background, toBackground } from './bg';
import { Game, type ChangeEvent } from './game';
import { FloorLight, Motes } from './render/light';
import { TIMING, reducedMotion, setReducedMotion, systemReducedMotion } from './render/motion';
import { NAMES, WindowView } from './render/window';
import type { GameState, Move } from './rules';
import { BRAND, loadSettings, saveSettings } from './settings';
import { h, icon } from './ui/dom';
import { buildHowTo } from './ui/howto';
import { buildMenu } from './ui/menu';
import { announce, resultText, statusText } from './ui/status';
import { buildTitle } from './ui/title';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const settings = loadSettings();
const isPhone = () => window.innerWidth < 600;
const isFlat = () => window.innerHeight < 700 && !isPhone();

const game = new Game({ seed: seedParam === null ? undefined : Number(seedParam) });
const sound = new Sound(settings);
const floor = new FloorLight();
const motes = new Motes();

type Screen = 'title' | 'game';
let screen: Screen = 'title';
let view: WindowView;
let resultTimer = 0;

// ---------- Page skeleton ----------
const app = document.getElementById('app') as HTMLElement;
const brand = h('span', { class: 'brand', text: BRAND });
const turnChip = h('span', { class: 'turn-chip', 'aria-hidden': 'true' });
const helpBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'How to play' }, icon('help'));
const soundBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Sound' });
const menuBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Menu' }, icon('menu'));
const header = h('header', { class: 'top' }, brand, turnChip, h('nav', { 'aria-label': 'Controls' }, helpBtn, soundBtn, menuBtn));

const viewport = h('div', { class: 'viewport', 'data-solid': true });
const archName = h('h1', { class: 'arch-name', text: BRAND });
const titleSlot = h('div', { class: 'title-slot' });
const wrap = h('div', { class: 'window-wrap' }, floor.canvas, viewport, motes.canvas, archName, titleSlot);

const status = h('p', { class: 'status' });
const undoBtn = h('button', { type: 'button', class: 'undo', text: 'Undo' });
const below = h('div', { class: 'below' }, status, undoBtn);

const resultTitle = h('h2', { id: 'result-title' });
const resultLine = h('p', { class: 'small' });
const rematchBtn = h('button', { type: 'button', class: 'play', text: 'Rematch' });
const changeBtn = h('button', { type: 'button', text: 'Change opponent' });
const result = h('section', { class: 'result', 'aria-labelledby': 'result-title', 'data-solid': true, hidden: true }, h('div', {}, resultTitle, resultLine), h('div', { class: 'row' }, rematchBtn, changeBtn));

const live = h('p', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
const howto = buildHowTo();
const menuHolder = h('div');
app.append(header, h('main', { class: 'stage' }, wrap, below), result, live, howto, menuHolder);

const background = new Background(
  document.getElementById('bg') as HTMLCanvasElement,
  document.getElementById('bg-card') as HTMLElement,
  () => viewport.getBoundingClientRect(),
);

// ---------- Settings ----------
function applySettings(): void {
  const reduce = settings.reduceMotion ?? systemReducedMotion();
  setReducedMotion(reduce);
  sound.setLevels(settings);
  soundBtn.replaceChildren(icon(settings.muted ? 'muted' : 'sound'));
  soundBtn.setAttribute('aria-label', settings.muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off');
  soundBtn.setAttribute('aria-pressed', String(!settings.muted));
  const bgParam = params.get('bg');
  // ?bg= picks the scenery for one visit; ?bg=none is for the tests.
  background.set(bgParam === 'none' ? 'none' : bgParam ? toBackground(bgParam) : settings.background, reduce);
  if (view) view.confirmTaps = settings.confirmTaps;
  if (reduce || screen === 'title') motes.stop();
  else motes.start();
  saveSettings(settings);
}

// ---------- The window ----------
function buildView(): void {
  view = new WindowView(game.variant, isFlat(), game.rules, game.state, {
    onPlay: (m) => onPlay(m),
    onIllegal: () => sound.knock(),
  });
  view.confirmTaps = settings.confirmTaps;
  viewport.replaceChildren(view.svg);
  document.documentElement.dataset.variant = game.variant;
  document.documentElement.classList.toggle('flat', isFlat());
  wrap.style.setProperty('--arch-ratio', String(view.layout.arch / view.layout.width));
  background.resize();
  motes.resize();
}

function draw(e?: ChangeEvent): void {
  const s = game.state;
  const title = screen === 'title';
  view.render(s, {
    title,
    interactive: !title && !game.computerToMove && s.result === 'playing',
    thinking: game.thinking,
    move: e?.kind === 'move' ? e.move : undefined,
  });
  const lights = view.currentLights();
  floor.draw(s, lights);
  floor.canvas.classList.toggle('doubled', !title && (s.result === 'amber' || s.result === 'cobalt'));
  floor.canvas.classList.toggle('off', title);
  motes.strength = lights.reduce((n, l) => n + l.level, 0) / lights.length;

  status.textContent = title ? '' : statusText(game);
  undoBtn.disabled = !game.canUndo || s.result !== 'playing';
  undoBtn.style.visibility = s.result === 'playing' ? '' : 'hidden';
  turnChip.dataset.side = s.result === 'playing' ? s.next : s.result === 'draw' ? 'none' : s.result;
  turnChip.classList.toggle('breathing', game.thinking);
  document.documentElement.dataset.screen = screen;
}

// ---------- Play ----------
function onPlay(m: Move): void {
  sound.unlock();
  game.playHuman(m);
}

game.onThinking = () => {
  if (screen === 'game') draw();
};

game.onChange = (e) => {
  const s = e.state;
  window.clearTimeout(resultTimer);
  result.hidden = true;
  result.classList.remove('show');
  if (e.kind === 'move' && e.move && e.prev) {
    sound.mark(e.move.pane, e.prev.next);
    if (s.result !== 'playing') {
      sound.gameOver(s.result === 'draw' ? 'draw' : !game.vsComputer || s.result === game.human ? 'win' : 'loss');
    }
    live.textContent = announce(game, e.prev, e.move);
  } else if (e.kind === 'undo') {
    live.textContent = 'Move taken back.';
  } else {
    // A new or resumed game must not keep the last game's result.
    live.textContent = '';
  }
  draw(e);
  if (e.kind !== 'move' || (!game.computerToMove && s.result === 'playing' && game.vsComputer)) view.focusLegal();
  if (s.result !== 'playing') {
    const won = s.result !== 'draw';
    const wait = e.kind !== 'move' ? 0 : reducedMotion() ? TIMING.reduced : won ? TIMING.gameWon : 700;
    resultTimer = window.setTimeout(showResult, wait);
  }
};

function showResult(): void {
  const s = game.state;
  resultTitle.textContent = resultText(game);
  resultLine.textContent = s.result === 'draw' ? 'Every square is taken.' : `${NAMES[s.result as 'amber' | 'cobalt']} made a line of three.`;
  changeBtn.textContent = game.vsComputer ? 'Change opponent' : 'Change game';
  result.hidden = false;
  requestAnimationFrame(() => result.classList.add('show'));
  if (document.activeElement === document.body || document.activeElement?.closest('.panes')) rematchBtn.focus({ preventScroll: true });
}

// ---------- Screens ----------
function showTitle(): void {
  game.stop();
  game.clearSave();
  screen = 'title';
  window.clearTimeout(resultTimer);
  result.hidden = true;
  live.textContent = '';
  game.variant = settings.variant;
  game.state = game.rules.newGame('amber');
  buildView();
  titleSlot.replaceChildren(
    buildTitle({
      variant: settings.variant,
      mode: settings.mode,
      background: settings.background,
      onVariant: (v) => {
        settings.variant = v;
        saveSettings(settings);
        game.variant = v;
        game.state = game.rules.newGame('amber');
        buildView();
        draw();
      },
      onBackground: (id) => {
        settings.background = id;
        params.delete('bg');
        applySettings();
      },
      onPlay: (choice) => {
        sound.unlock();
        settings.variant = choice.variant;
        settings.mode = choice.mode;
        saveSettings(settings);
        startGame(() => game.start(choice.variant, choice.mode, 'amber'));
      },
    }),
  );
  draw();
  applySettings();
}

function startGame(begin: () => void): void {
  screen = 'game';
  titleSlot.replaceChildren();
  document.documentElement.dataset.screen = screen;
  // The controller knows which game it is only once it begins, so the window is built inside the first change.
  const first = game.onChange;
  let built = false;
  game.onChange = (e) => {
    if (!built) {
      built = true;
      buildView();
      game.onChange = first;
    }
    first(e);
  };
  begin();
  game.onChange = first;
  applySettings();
}

// ---------- Controls ----------
function openMenu(): void {
  if (howto.open) return;
  const menu = buildMenu({
    settings,
    systemReduce: systemReducedMotion(),
    onChange: () => {
      params.delete('bg');
      applySettings();
    },
    onNewGame: showTitle,
  });
  menuHolder.replaceChildren(menu);
  menu.showModal();
}
const anyDialog = () => !!document.querySelector('dialog[open]');

function toggleMute(): void {
  sound.unlock();
  settings.muted = !settings.muted;
  applySettings();
}

helpBtn.addEventListener('click', () => howto.showModal());
menuBtn.addEventListener('click', openMenu);
soundBtn.addEventListener('click', toggleMute);
undoBtn.addEventListener('click', () => game.undo());
rematchBtn.addEventListener('click', () => {
  sound.unlock();
  game.rematch();
});
changeBtn.addEventListener('click', showTitle);

window.addEventListener('pointerdown', () => sound.unlock(), { passive: true });
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const typing = (e.target as Element | null)?.closest?.('input, select, textarea');
  if (anyDialog()) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    openMenu();
    return;
  }
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === 'm') toggleMute();
  else if (k === 'u' && screen === 'game') game.undo();
  else if (e.key === '?') howto.showModal();
});

let flat = isFlat();
window.addEventListener('resize', () => {
  if (flat !== isFlat()) {
    flat = isFlat();
    buildView();
    draw();
  }
  motes.resize();
});
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', applySettings);
}

// ---------- Start ----------
buildView();
applySettings();
if (Game.hasSave()) {
  startGame(() => {
    if (!game.resume()) showTitle();
  });
} else {
  showTitle();
}

// For the end-to-end tests.
declare global {
  interface Window {
    __game: { game: Game; state(): GameState; background: Background };
  }
}
window.__game = { game, state: () => game.state, background };
