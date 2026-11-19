/**
 * The SVG window, with squares as buttons.
 * Classic is one flat board. 3D is three boards drawn as tilted levels, one above the other.
 */
import type { GameState, Move, Player } from '../rules';
import type { Rules, Variant } from '../game';
import { FRAME, PANE, PANEL, THIN, crossPieces, emptyPieces, noiseTexture, pieceColour, roundelPieces, type Piece, type Role } from './glass';
import { panelLights, type PanelLight } from './light';
import { EASE, TIMING, animate, markPlaced, reducedMotion } from './motion';

const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const k in attrs) node.setAttribute(k, String(attrs[k]));
  parent?.appendChild(node);
  return node;
}

export const POSITIONS = ['top-left', 'top', 'top-right', 'left', 'centre', 'right', 'bottom-left', 'bottom', 'bottom-right'];
export const LEVELS = ['top', 'middle', 'bottom'];
export const NAMES: Record<Player, string> = { amber: 'Amber', cobalt: 'Cobalt' };

/** How a level is tilted: each row sits this far left of the one behind it, and rows are squashed to this height. */
const SKEW = -0.3;
const SQUASH = 0.6;
const PAD = 12;
const GAP = 26;

export interface Layout {
  variant: Variant;
  levels: number;
  width: number;
  height: number;
  /** Height of the arch above the window. */
  arch: number;
  k: number;
  flat: boolean;
  skew: number;
  squash: number;
  /** Where the back-left corner of each level sits. */
  origins: [number, number][];
}

export function makeLayout(variant: Variant, flat: boolean): Layout {
  if (variant === 'classic') {
    const size = FRAME * 2 + PANEL;
    const k = size / 1018;
    return { variant, levels: 1, width: size, height: size, arch: (flat ? 80 : 240) * k, k, flat, skew: 0, squash: 1, origins: [[FRAME, FRAME]] };
  }
  const lean = -SKEW * PANEL;
  const levelH = SQUASH * PANEL;
  const width = FRAME * 2 + PAD * 2 + PANEL + lean;
  const height = FRAME * 2 + PAD * 2 + levelH * 3 + GAP * 2;
  const k = width / 1018;
  const origins = [0, 1, 2].map((i): [number, number] => [FRAME + PAD + lean, FRAME + PAD + i * (levelH + GAP)]);
  return { variant, levels: 3, width, height, arch: (flat ? 80 : 240) * k, k, flat, skew: SKEW, squash: SQUASH, origins };
}

function levelTransform(l: Layout, level: number): string {
  const [e, f] = l.origins[level];
  return `matrix(1 0 ${l.skew} ${l.squash} ${e} ${f})`;
}
/** A point on a level, in window units. */
function toWindow(l: Layout, level: number, x: number, y: number): [number, number] {
  const [e, f] = l.origins[level];
  return [x + l.skew * y + e, l.squash * y + f];
}
function paneOrigin(pane: number): [number, number] {
  return [(pane % 3) * (PANE + THIN), Math.floor(pane / 3) * (PANE + THIN)];
}

interface Painted {
  el: SVGPathElement;
  role: Role;
  seed: number;
}

export interface RenderOptions {
  title?: boolean;
  /** The person at the screen may place a mark now. */
  interactive?: boolean;
  thinking?: boolean;
  /** Play the motion for this move. */
  move?: Move;
}

export interface WindowCallbacks {
  onPlay(move: Move): void;
  onIllegal(move: Move): void;
}

export class WindowView {
  readonly svg: SVGSVGElement;
  readonly layout: Layout;
  private rules: Rules;
  private cb: WindowCallbacks;
  private state: GameState;
  private lights: PanelLight[] = [];
  private interactive = false;

  private levelGroups: SVGGElement[] = [];
  private paneGroups: (SVGGElement | null)[] = [];
  private panePainted: Painted[][] = [];
  private drawnPane: (Player | null | undefined)[] = [];
  private glowUses: SVGUseElement[] = [];
  private pulses: SVGRectElement[] = [];
  private buttons: SVGGElement[] = [];
  private ghost: SVGGElement;
  private ghostKey = '';
  private winBar: SVGPathElement;
  private turn: SVGCircleElement;
  private turnGlow: SVGCircleElement;
  private archDetail: SVGGElement;
  private focusIndex: number;
  private hover: Move | null = null;
  private armed: Move | null = null;
  /** When set, a first tap arms a square and a second tap places the mark. */
  confirmTaps = false;

  constructor(variant: Variant, flat: boolean, rules: Rules, state: GameState, cb: WindowCallbacks) {
    this.layout = makeLayout(variant, flat);
    this.rules = rules;
    this.cb = cb;
    this.state = state;
    const l = this.layout;
    const W = l.width;
    const H = l.height;
    const A = l.arch;
    this.focusIndex = Math.floor(l.levels / 2) * 9 + 4;

    const svg = el('svg', { viewBox: `0 ${-A} ${W} ${H + A}`, class: `window window-${variant}`, role: 'group', 'aria-label': 'The board' });
    this.svg = svg;

    const defs = el('defs', {}, svg);
    const blur = el('filter', { id: 'glow-blur', filterUnits: 'userSpaceOnUse', x: -60, y: -A - 60, width: W + 120, height: H + A + 120 }, defs);
    el('feGaussianBlur', { stdDeviation: 7 }, blur);
    const noise = el('pattern', { id: 'glass-noise', width: 256, height: 256, patternUnits: 'userSpaceOnUse' }, defs);
    const tex = noiseTexture();
    if (tex) el('image', { href: tex, width: 256, height: 256 }, noise);
    const sweep = el('radialGradient', { id: 'sweep-light' }, defs);
    el('stop', { offset: 0, 'stop-color': '#FFF1C2', 'stop-opacity': 0.12 }, sweep);
    el('stop', { offset: 1, 'stop-color': '#FFF1C2', 'stop-opacity': 0 }, sweep);
    const glassClip = el('clipPath', { id: 'glass-clip' }, defs);
    el('rect', { x: FRAME, y: FRAME, width: W - FRAME * 2, height: H - FRAME * 2 }, glassClip);

    // Stone frame and arch.
    const archPath = (inset: number) => {
      const x0 = inset;
      const x1 = W - inset;
      const top = -A + inset;
      const span = x1 - x0;
      if (l.flat) return `M${x0} 0V${top}H${x1}V0Z`;
      return `M${x0} 0C${x0} ${top * 0.55} ${x0 + span * 0.28} ${top * 0.92} ${W / 2} ${top}C${x1 - span * 0.28} ${top * 0.92} ${x1} ${top * 0.55} ${x1} 0Z`;
    };
    el('path', { d: `${archPath(0)}M0 0H${W}V${H}H0Z`, class: 'stone' }, svg);
    const fi = FRAME * l.k;
    const archClip = el('clipPath', { id: 'arch-clip' }, defs);
    el('path', { d: archPath(fi) }, archClip);
    const arch = el('g', { class: 'arch' }, svg);
    el('path', { d: archPath(fi), class: 'lead-fill' }, arch);
    const archGlass = el('path', { d: archPath(fi + 4 * l.k), class: 'arch-glass' }, arch);
    archGlass.style.fill = pieceColour('clear', 0, false, 9001);
    const detail = el('g', { class: 'arch-detail', 'clip-path': 'url(#arch-clip)' }, arch);
    this.archDetail = detail;
    const tr = Math.min(70 * l.k, (A - fi) * 0.36);
    const tcx = W / 2;
    const tcy = l.flat ? -A / 2 : -A * 0.46;
    for (const a of [-158, -128, -90, -52, -22]) {
      const rad = (a * Math.PI) / 180;
      el('line', { x1: tcx, y1: tcy, x2: tcx + Math.cos(rad) * W, y2: tcy + Math.sin(rad) * W, class: 'lead-line', 'stroke-width': 5 * l.k + 2 }, detail);
    }
    el('line', { x1: fi, y1: tcy, x2: W - fi, y2: tcy, class: 'lead-line', 'stroke-width': 5 * l.k + 2 }, detail);
    el('circle', { cx: tcx, cy: tcy, r: tr + 5 * l.k + 2, class: 'lead-fill' }, detail);
    this.turnGlow = el('circle', { cx: tcx, cy: tcy, r: tr, class: 'turn-glow', filter: 'url(#glow-blur)' }, detail);
    this.turn = el('circle', { cx: tcx, cy: tcy, r: tr, class: 'turn-light' }, detail);
    el('circle', { cx: tcx, cy: tcy, r: tr, fill: 'url(#glass-noise)', class: 'noise' }, detail);

    // The dark opening the boards sit in.
    el('rect', { x: FRAME - 4, y: FRAME - 4, width: W - FRAME * 2 + 8, height: H - FRAME * 2 + 8, class: 'lead-fill' }, svg);
    if (l.levels > 1) {
      // Four posts carry the levels, corner to corner.
      const posts = el('g', { class: 'posts' }, svg);
      for (const [x, y] of [[0, 0], [PANEL, 0], [PANEL, PANEL], [0, PANEL]]) {
        const [x1, y1] = toWindow(l, 0, x, y);
        const [x2, y2] = toWindow(l, l.levels - 1, x, y);
        el('line', { x1, y1, x2, y2, class: 'post' }, posts);
      }
    }
    const glass = el('g', { class: 'glass' }, svg);
    for (let p = 0; p < l.levels; p++) {
      if (l.levels > 1) {
        // Each level is a leaded tray with an edge that catches the light.
        const tray = el('g', { transform: levelTransform(l, p) }, glass);
        el('rect', { x: -7, y: -7, width: PANEL + 14, height: PANEL + 14, class: 'tray' }, tray);
      }
      this.levelGroups.push(el('g', { id: `pg${p}`, class: 'panel', transform: levelTransform(l, p) }, glass));
    }
    this.paneGroups = new Array(l.levels * 9).fill(null);
    this.panePainted = Array.from({ length: l.levels * 9 }, () => []);
    this.drawnPane = new Array(l.levels * 9).fill(undefined);

    // Lit glass casts a blurred copy of itself.
    const glow = el('g', { class: 'glow', filter: 'url(#glow-blur)' }, svg);
    for (let p = 0; p < l.levels; p++) this.glowUses.push(el('use', { href: `#pg${p}`, class: 'glow-use' }, glow));
    el('rect', { x: FRAME, y: FRAME, width: W - FRAME * 2, height: H - FRAME * 2, fill: 'url(#glass-noise)', class: 'noise' }, svg);
    const sweepG = el('g', { 'clip-path': 'url(#glass-clip)' }, svg);
    el('ellipse', { cx: 0, cy: H * 0.45, rx: W * 0.45, ry: H * 0.7, fill: 'url(#sweep-light)', class: 'sweep' }, sweepG);
    if (l.levels === 1) {
      // 1px highlight on the top-left edge of the lead.
      const shine = el('g', { class: 'lead-shine' }, svg);
      el('path', { d: `M${FRAME - 4} ${H - FRAME + 4}V${FRAME - 4}H${W - FRAME + 4}` }, shine);
    }

    // Effects and controls above the glass.
    const fx = el('g', { class: 'fx' }, svg);
    for (let p = 0; p < l.levels; p++) {
      const g = el('g', { transform: levelTransform(l, p) }, fx);
      this.pulses.push(el('rect', { x: 0, y: 0, width: PANEL, height: PANEL, class: 'panel-pulse' }, g));
    }
    this.ghost = el('g', { class: 'ghost' }, fx);
    this.winBar = el('path', { class: 'win-bar' }, fx);

    const buttons = el('g', { class: 'panes' }, svg);
    for (let p = 0; p < l.levels; p++) {
      const g = el('g', { transform: levelTransform(l, p) }, buttons);
      for (let q = 0; q < 9; q++) {
        const [dx, dy] = paneOrigin(q);
        const idx = p * 9 + q;
        const b = el('g', { class: 'pane', role: 'button', tabindex: idx === this.focusIndex ? 0 : -1, 'data-panel': p, 'data-pane': q }, g);
        el('rect', { x: dx - THIN / 2, y: dy - THIN / 2, width: PANE + THIN, height: PANE + THIN, class: 'hit' }, b);
        el('rect', { x: dx + 5, y: dy + 5, width: PANE - 10, height: PANE - 10, class: 'focus-gap' }, b);
        el('rect', { x: dx + 5, y: dy + 5, width: PANE - 10, height: PANE - 10, class: 'focus-ring' }, b);
        this.buttons.push(b);
      }
    }

    buttons.addEventListener('click', (e) => {
      const m = this.moveOf(e.target);
      if (m) this.activate(m, (e as PointerEvent).pointerType === 'touch' || (e as PointerEvent).pointerType === 'pen');
    });
    buttons.addEventListener('pointerover', (e) => this.setHover(this.moveOf(e.target)));
    buttons.addEventListener('pointerdown', (e) => this.setHover(this.moveOf(e.target)));
    buttons.addEventListener('pointerleave', () => this.setHover(null));
    buttons.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') window.setTimeout(() => this.setHover(this.armed), 0);
    });
    buttons.addEventListener('pointercancel', () => this.setHover(null));
    buttons.addEventListener('focusin', (e) => {
      const m = this.moveOf(e.target);
      if (!m) return;
      this.setFocusIndex(m.panel * 9 + m.pane, false);
      if ((e.target as Element).matches(':focus-visible')) this.setHover(m);
    });
    buttons.addEventListener('focusout', () => this.setHover(null));
    buttons.addEventListener('keydown', (e) => this.onKey(e));

    this.render(state, { title: true });
  }

  private moveOf(target: EventTarget | null): Move | null {
    const g = (target as Element | null)?.closest?.('.pane') as SVGGElement | null;
    if (!g) return null;
    return { panel: Number(g.dataset.panel), pane: Number(g.dataset.pane) };
  }

  private activate(m: Move, touch: boolean): void {
    if (!this.interactive || !this.rules.isLegal(this.state, m)) {
      this.cb.onIllegal(m);
      this.pulseLit();
      return;
    }
    if (this.confirmTaps && touch) {
      if (!this.armed || this.armed.panel !== m.panel || this.armed.pane !== m.pane) {
        this.armed = m;
        this.setHover(m);
        return;
      }
    }
    this.armed = null;
    this.setHover(null);
    this.cb.onPlay(m);
  }

  /** Arrow keys walk a grid three squares wide: each level's rows, one level after another. */
  private onKey(e: KeyboardEvent): void {
    const rows = this.layout.levels * 3;
    const idx = this.focusIndex;
    let gx = idx % 3;
    let gy = Math.floor(idx / 3);
    switch (e.key) {
      case 'ArrowLeft': gx = Math.max(0, gx - 1); break;
      case 'ArrowRight': gx = Math.min(2, gx + 1); break;
      case 'ArrowUp': gy = Math.max(0, gy - 1); break;
      case 'ArrowDown': gy = Math.min(rows - 1, gy + 1); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.activate({ panel: Math.floor(idx / 9), pane: idx % 9 }, false);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.setFocusIndex(gy * 3 + gx, true);
  }

  private setFocusIndex(idx: number, focus: boolean): void {
    if (idx !== this.focusIndex) {
      this.buttons[this.focusIndex].setAttribute('tabindex', '-1');
      this.buttons[idx].setAttribute('tabindex', '0');
      this.focusIndex = idx;
    }
    if (focus) this.buttons[idx].focus();
  }

  /** Keeps keyboard focus on a square that can be played. */
  focusLegal(): void {
    const legal = this.rules.legalMoves(this.state);
    if (legal.length === 0) return;
    const cur = { panel: Math.floor(this.focusIndex / 9), pane: this.focusIndex % 9 };
    const m = this.rules.isLegal(this.state, cur) ? cur : legal[Math.floor(legal.length / 2)];
    this.setFocusIndex(m.panel * 9 + m.pane, document.activeElement?.closest?.('.panes') != null);
  }

  /** A ghost of the mark shows where it would go. */
  private setHover(m: Move | null): void {
    const legal = m && this.interactive && this.rules.isLegal(this.state, m) ? m : null;
    this.hover = legal;
    const key = legal ? `${legal.panel}:${legal.pane}:${this.state.next}` : '';
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.ghost.replaceChildren();
    this.ghost.classList.toggle('show', !!legal);
    if (!legal) return;
    this.ghost.setAttribute('transform', levelTransform(this.layout, legal.panel));
    const [dx, dy] = paneOrigin(legal.pane);
    const pieces = this.state.next === 'amber' ? crossPieces(PANE, dx, dy) : roundelPieces(PANE, dx, dy);
    for (const piece of pieces) {
      if (piece.role === 'clear') continue;
      const path = el('path', { d: piece.d }, this.ghost);
      if (piece.rule) path.setAttribute('fill-rule', piece.rule);
      path.style.fill = pieceColour(piece.role, 1, false, 1);
    }
  }

  /** The board pulses once, for a tap that cannot be played. */
  pulseLit(): void {
    if (reducedMotion() || this.state.result !== 'playing') return;
    for (const p of this.pulses) {
      p.getAnimations().forEach((a) => a.cancel());
      p.animate([{ opacity: 0 }, { opacity: 0.28 }, { opacity: 0 }], { duration: 360, easing: 'ease-out' });
    }
  }

  private buildPieces(parent: SVGGElement, pieces: Piece[], seedBase: number, into: Painted[]): { fills: SVGGElement; lead: SVGPathElement } {
    const fills = el('g', { class: 'fills' }, parent);
    let d = '';
    pieces.forEach((piece, i) => {
      const path = el('path', { d: piece.d, class: 'piece' }, fills);
      if (piece.rule) path.setAttribute('fill-rule', piece.rule);
      into.push({ el: path, role: piece.role, seed: seedBase * 16 + i });
      d += piece.d;
    });
    const lead = el('path', { d, class: 'piece-lead', pathLength: 1 }, parent);
    return { fills, lead };
  }

  render(state: GameState, opts: RenderOptions = {}): void {
    const l = this.layout;
    this.state = state;
    this.interactive = !!opts.interactive && state.result === 'playing';
    this.armed = null;
    const lights = panelLights(state, !!opts.title);
    this.lights = lights;
    const move = opts.move;
    const motion = !!move && !reducedMotion();
    this.svg.classList.toggle('is-title', !!opts.title);
    this.svg.classList.toggle('is-over', state.result !== 'playing');
    // Behind the title panel the window is scenery, not a control.
    if (opts.title) this.svg.setAttribute('aria-hidden', 'true');
    else this.svg.removeAttribute('aria-hidden');
    this.buttons[this.focusIndex].setAttribute('tabindex', opts.title ? '-1' : '0');

    for (let p = 0; p < l.levels; p++) {
      const group = this.levelGroups[p];
      const light = lights[p];
      group.style.setProperty('--dur', `${reducedMotion() ? TIMING.reduced : TIMING.light}ms`);
      for (let q = 0; q < 9; q++) {
        const idx = p * 9 + q;
        const mark = state.panes[idx];
        if (this.drawnPane[idx] !== mark) {
          this.paneGroups[idx]?.remove();
          const [dx, dy] = paneOrigin(q);
          const g = el('g', { class: 'pp' }, group);
          const pieces = mark === 'amber' ? crossPieces(PANE, dx, dy) : mark === 'cobalt' ? roundelPieces(PANE, dx, dy) : emptyPieces(PANE, dx, dy);
          this.panePainted[idx] = [];
          const built = this.buildPieces(g, pieces, idx, this.panePainted[idx]);
          this.paneGroups[idx] = g;
          this.drawnPane[idx] = mark;
          if (motion && mark && move!.panel === p && move!.pane === q) {
            const flash = el('rect', { x: dx, y: dy, width: PANE, height: PANE, class: 'flash' }, g);
            markPlaced(built.fills, built.lead, flash);
          }
        }
        for (const pt of this.panePainted[idx]) pt.el.style.fill = pieceColour(pt.role, light.level, light.grisaille, pt.seed);
      }
      this.glowUses[p].style.opacity = String(opts.title || light.grisaille ? 0 : 0.3 * light.level);
    }

    for (let p = 0; p < l.levels; p++) {
      for (let q = 0; q < 9; q++) {
        const b = this.buttons[p * 9 + q];
        const m = { panel: p, pane: q };
        const legal = !opts.title && this.interactive && this.rules.isLegal(state, m);
        b.classList.toggle('legal', legal);
        b.setAttribute('aria-disabled', legal ? 'false' : 'true');
        b.setAttribute('aria-label', this.label(state, m));
      }
    }

    // Turn light.
    const turnOn = !opts.title;
    const side: Player | null = state.result === 'playing' ? state.next : state.result === 'draw' ? null : state.result;
    const role: Role = side === 'cobalt' ? 'cobalt-ring' : side === 'amber' ? 'amber-arm' : 'clear';
    const colour = pieceColour(role, turnOn && side ? 1 : 0, !side && turnOn, 4242);
    this.turn.style.fill = colour;
    this.turnGlow.style.fill = colour;
    this.turnGlow.style.opacity = turnOn && side ? '0.6' : '0';
    this.archDetail.classList.toggle('breathing', !!opts.thinking);
    this.svg.dataset.turn = side ?? 'none';
    this.svg.dataset.thinking = opts.thinking ? 'true' : 'false';

    if (state.result !== 'playing' && !opts.title) this.showWin(state, motion);
    else this.winBar.classList.remove('show');

    const h = this.hover;
    this.ghostKey = '';
    this.setHover(h);
  }

  private label(state: GameState, m: Move): string {
    const mark = state.panes[m.panel * 9 + m.pane];
    const holds = mark === 'amber' ? "holds Amber's cross" : mark === 'cobalt' ? "holds Cobalt's roundel" : 'empty';
    const where = this.layout.levels === 1 ? `${cap(POSITIONS[m.pane])} square` : `${cap(LEVELS[m.panel])} level, ${POSITIONS[m.pane]} square`;
    return `${where}, ${holds}.`;
  }

  /** Centre of a square in window units. */
  private centre(index: number): [number, number] {
    const [dx, dy] = paneOrigin(index % 9);
    return toWindow(this.layout, Math.floor(index / 9), dx + PANE / 2, dy + PANE / 2);
  }

  /** The three winning marks pulse in order, then a bar of light joins them. */
  private showWin(state: GameState, motion: boolean): void {
    const line = state.result === 'draw' ? null : this.rules.line(state);
    if (!line) {
      this.winBar.classList.remove('show');
      return;
    }
    const [ax, ay] = this.centre(line[0]);
    const [bx, by] = this.centre(line[line.length - 1]);
    this.winBar.setAttribute('d', `M${ax} ${ay}L${bx} ${by}`);
    this.winBar.setAttribute('pathLength', '1');
    this.winBar.classList.add('show');
    if (!motion) return;
    line.forEach((i, n) => {
      const g = this.paneGroups[i];
      if (g) animate(g, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 420, delay: 200 + n * 320, easing: EASE.mark });
    });
    animate(this.winBar, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: 700, delay: 1150, easing: 'ease-in-out' });
  }

  currentLights(): PanelLight[] {
    return this.lights;
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
