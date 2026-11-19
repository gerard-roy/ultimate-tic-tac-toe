import './styles/tokens.css';
import './styles/main.css';
import { Sound } from './audio';
import { Background } from './bg';
import { Game, type ChangeEvent } from './game';
import { FloorLight, Motes } from './render/light';
import { TIMING, reducedMotion, setReducedMotion, systemReducedMotion } from './render/motion';
import { NAMES, WindowView } from './render/window';
import { BAR, FRAME, PANEL } from './render/glass';
import type { GameState, Move } from './rules';
import { loadSettings, saveSettings } from './settings';
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

const game = new Game({ seed: seedParam === null ? undefined : Number(seedParam), phone: isPhone() });
const sound = new Sound(settings);
const floor = new FloorLight();
const motes = new Motes();

type Screen = 'title' | 'game';
let screen: Screen = 'title';
let view: WindowView;
let zoom: number | null = null;
let lastZoom = 4;
let coachLeft = Game.coachingTurnsLeft();
let resultTimer = 0;

// ---------- Page skeleton ----------
const app = document.getElementById('app') as HTMLElement;
const brand = h('span', { class: 'brand', text: 'Ninefold' });
const turnChip = h('span', { class: 'turn-chip', 'aria-hidden': 'true' });
const helpBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'How to play' }, icon('help'));
const soundBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Sound' });
const menuBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Menu' }, icon('menu'));
const header = h('header', { class: 'top' }, brand, turnChip, h('nav', { 'aria-label': 'Controls' }, helpBtn, soundBtn, menuBtn));

const glide = h('div', { class: 'glide' });
const viewport = h('div', { class: 'viewport', 'data-solid': true }, glide);
const archName = h('h1', { class: 'arch-name', text: 'Ninefold' });
const mapBtn = h('button', { type: 'button', class: 'map', 'aria-label': 'Show the whole window' });
for (let i = 0; i < 9; i++) mapBtn.append(h('span'));
const titleSlot = h('div', { class: 'title-slot' });
const wrap = h('div', { class: 'window-wrap' }, floor.canvas, viewport, motes.canvas, archName, mapBtn, titleSlot);

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
  background.set((bgParam as typeof settings.background | null) ?? settings.background, reduce);
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
    onPreview: (target) => showPreview(target),
  });
  view.confirmTaps = settings.confirmTaps;
  glide.replaceChildren(view.svg);
  document.documentElement.dataset.variant = game.variant;
  document.documentElement.classList.toggle('flat', isFlat());
  wrap.style.setProperty('--arch-ratio', String(view.layout.arch / view.layout.size));
  background.resize();
}

function draw(e?: ChangeEvent): void {
  const s = game.state;
  const title = screen === 'title';
  const interactive = !title && !game.computerToMove && s.result === 'playing';
  view.render(s, {
    title,
    interactive,
    thinking: game.thinking,
    move: e?.kind === 'move' ? e.move : undefined,
    prev: e?.prev,
  });
  const lights = view.currentLights();
  floor.draw(s, lights);
  floor.canvas.classList.toggle('doubled', !title && (s.result === 'amber' || s.result === 'cobalt'));
  floor.canvas.classList.toggle('off', title);
  motes.strength = lights.reduce((n, l) => n + l.level, 0) / lights.length;

  const coaching = coachLeft > 0 && game.vsComputer;
  status.textContent = title ? '' : statusText(game, coaching);
  undoBtn.disabled = !game.canUndo || s.result !== 'playing';
  undoBtn.style.visibility = s.result === 'playing' ? '' : 'hidden';
  const side = s.result === 'playing' ? s.next : s.result === 'draw' ? 'none' : s.result;
  turnChip.dataset.side = side;
  turnChip.classList.toggle('breathing', game.thinking);
  document.documentElement.dataset.screen = screen;
  drawMap();
}

function drawMap(preview?: number | null): void {
  const s = game.state;
  const lit = view.litPanels();
  Array.from(mapBtn.children).forEach((cell, i) => {
    const p = s.panels[i];
    cell.className = [p === 'amber' || p === 'cobalt' || p === 'drawn' ? p : '', lit.includes(i) ? 'lit' : '', preview === i ? 'preview' : ''].join(' ');
  });
  mapBtn.setAttribute('aria-label', zoom === null ? 'Zoom to the lit panel' : 'Show the whole window');
}

function showPreview(target: number | null | undefined): void {
  drawMap(target);
}

// ---------- Phone zoom ----------
function applyZoom(): void {
  const on = isPhone() && game.variant === 'ninefold' && screen === 'game' && zoom !== null;
  document.documentElement.classList.toggle('zoomed', on);
  if (!on) {
    glide.style.transform = '';
    return;
  }
  const l = view.layout;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  // Matches --win for phones in main.css; measuring the SVG is unreliable mid-glide.
  const svgW = Math.min(0.92 * window.innerWidth, 0.56 * window.innerHeight);
  const u = svgW / l.size;
  const p = zoom as number;
  const cx = (vw - svgW) / 2 + (FRAME + (p % 3) * (PANEL + BAR) + PANEL / 2) * u;
  const cy = (l.arch + FRAME + Math.floor(p / 3) * (PANEL + BAR) + PANEL / 2) * u;
  const scale = (0.78 * vw) / (PANEL * u);
  glide.style.transform = `translate(${(vw / 2 - cx * scale).toFixed(1)}px, ${(vh / 2 - cy * scale).toFixed(1)}px) scale(${scale.toFixed(4)})`;
}
function followLight(): void {
  const s = game.state;
  if (!isPhone() || game.variant !== 'ninefold' || screen !== 'game') zoom = null;
  else if (s.result !== 'playing') zoom = null;
  else if (s.target !== null) zoom = s.target;
  else zoom = null; // a free move shows the whole window
  if (zoom !== null) lastZoom = zoom;
  applyZoom();
  drawMap();
}

// ---------- Play ----------
function onPlay(m: Move): void {
  sound.unlock();
  // On a phone showing the whole window, the first tap zooms to the panel.
  if (isPhone() && game.variant === 'ninefold' && zoom === null) {
    zoom = m.panel;
    lastZoom = m.panel;
    applyZoom();
    drawMap();
    return;
  }
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
    const mover = e.prev.next;
    sound.mark(e.move.pane, mover);
    if (game.variant === 'ninefold' && s.panels[e.move.panel] !== e.prev.panels[e.move.panel] && s.panels[e.move.panel] !== 'drawn') {
      sound.panelWon(mover);
    }
    if (s.result !== 'playing') {
      sound.gameOver(s.result === 'draw' ? 'draw' : !game.vsComputer || s.result === game.human ? 'win' : 'loss');
    }
    if (game.vsComputer && mover === game.human && coachLeft > 0) {
      coachLeft--;
      Game.coachingUsed();
    }
    live.textContent = announce(game, e.prev, e.move);
  } else if (e.kind === 'undo') {
    live.textContent = 'Move taken back.';
  }
  draw(e);
  followLight();
  if (e.kind !== 'move') view.focusLegal();
  else if (!game.computerToMove && s.result === 'playing' && game.vsComputer) view.focusLegal();
  if (s.result !== 'playing') {
    const won = s.result !== 'draw';
    const wait = e.kind !== 'move' ? 0 : reducedMotion() ? TIMING.reduced : won ? TIMING.gameWon : 700;
    resultTimer = window.setTimeout(showResult, wait);
  }
};

function showResult(): void {
  const s = game.state;
  resultTitle.textContent = resultText(game);
  if (game.variant === 'classic') {
    resultLine.textContent = s.result === 'draw' ? 'Every square is taken.' : `${NAMES[s.result as 'amber' | 'cobalt']} made a line of three.`;
  } else {
    const count = (who: string) => s.panels.filter((p) => p === who).length;
    const plural = (n: number) => `${n} ${n === 1 ? 'panel' : 'panels'}`;
    resultLine.textContent = `Amber won ${plural(count('amber'))}. Cobalt won ${plural(count('cobalt'))}.`;
  }
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
  zoom = null;
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
        applyZoom();
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
  applyZoom();
  applySettings();
}

function startGame(begin: () => void): void {
  screen = 'game';
  titleSlot.replaceChildren();
  document.documentElement.dataset.screen = screen;
  // The controller knows the variant only after it begins, so build the window inside the first change.
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
      applyZoom();
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
mapBtn.addEventListener('click', () => {
  if (zoom === null) {
    const lit = view.litPanels();
    zoom = game.state.target ?? (lit.includes(lastZoom) ? lastZoom : lit[0] ?? lastZoom);
    lastZoom = zoom;
  } else zoom = null;
  applyZoom();
  drawMap();
});

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
let phone = isPhone();
window.addEventListener('resize', () => {
  if (flat !== isFlat() || phone !== isPhone()) {
    flat = isFlat();
    phone = isPhone();
    buildView();
    draw();
    followLight();
  } else applyZoom();
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
    __ninefold: { game: Game; state(): GameState; background: Background };
  }
}
window.__ninefold = { game, state: () => game.state, background };
