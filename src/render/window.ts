/** The SVG window, with panes as buttons. */
import { LINES, other, winningLine, type GameState, type Move, type Player } from '../rules';
import { classicLine } from '../classic';
import type { Rules, Variant } from '../game';
import {
  BAR,
  FRAME,
  PANE,
  PANEL,
  THIN,
  crossPieces,
  emblemPieces,
  emptyPieces,
  noiseTexture,
  pieceColour,
  roundelPieces,
  type Piece,
  type Role,
} from './glass';
import { panelLights, type PanelLight } from './light';
import { EASE, TIMING, animate, markPlaced, reducedMotion, runSpark } from './motion';

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
export const NAMES: Record<Player, string> = { amber: 'Amber', cobalt: 'Cobalt' };

export interface Layout {
  variant: Variant;
  side: number; // panels per side
  size: number; // square window
  arch: number; // height above the square
  k: number; // scale of arch details against the full window
  flat: boolean;
}

export function makeLayout(variant: Variant, flat: boolean): Layout {
  const side = variant === 'classic' ? 1 : 3;
  const size = FRAME * 2 + PANEL * side + BAR * (side - 1);
  const k = size / 1018;
  return { variant, side, size, arch: (flat ? 80 : 240) * k, k, flat };
}

export function panelOrigin(l: Layout, panel: number): [number, number] {
  return [FRAME + (panel % l.side) * (PANEL + BAR), FRAME + Math.floor(panel / l.side) * (PANEL + BAR)];
}
export function paneOrigin(pane: number): [number, number] {
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
  prev?: GameState | null;
}

export interface WindowCallbacks {
  onPlay(move: Move): void;
  onIllegal(move: Move): void;
  onPreview(target: number | null | undefined): void;
}

export class WindowView {
  readonly svg: SVGSVGElement;
  readonly layout: Layout;
  private rules: Rules;
  private cb: WindowCallbacks;
  private state: GameState;
  private lights: PanelLight[] = [];
  private interactive = false;

  private panelGroups: SVGGElement[] = [];
  private paneGroups: (SVGGElement | null)[] = [];
  private painted: Painted[][] = [];
  private panePainted: Painted[][] = [];
  private drawnPane: (Player | null | undefined)[] = [];
  private drawnPanel: string[] = [];
  private glowUses: SVGUseElement[] = [];
  private outlines: SVGRectElement[] = [];
  private pulses: SVGRectElement[] = [];
  private buttons: SVGGElement[] = [];
  private ghost: SVGGElement;
  private ghostKey = '';
  private spark: SVGPathElement;
  private winBar: SVGPathElement;
  private fx: SVGGElement;
  private turn: SVGCircleElement;
  private turnGlow: SVGCircleElement;
  private archDetail: SVGGElement;
  private focusIndex: number;
  private hover: Move | null = null;
  private armed: Move | null = null;
  /** When set, a first tap arms a pane and a second tap places the mark. */
  confirmTaps = false;

  constructor(variant: Variant, flat: boolean, rules: Rules, state: GameState, cb: WindowCallbacks) {
    this.layout = makeLayout(variant, flat);
    this.rules = rules;
    this.cb = cb;
    this.state = state;
    const l = this.layout;
    const total = l.side * l.side;
    this.focusIndex = Math.floor(total / 2) * 9 + 4;

    const svg = el('svg', {
      viewBox: `0 ${-l.arch} ${l.size} ${l.size + l.arch}`,
      class: `window window-${variant}`,
      role: 'group',
      'aria-label': variant === 'classic' ? 'The board' : 'The window',
    });
    this.svg = svg;

    const defs = el('defs', {}, svg);
    const blur = el('filter', { id: 'glow-blur', filterUnits: 'userSpaceOnUse', x: -60, y: -l.arch - 60, width: l.size + 120, height: l.size + l.arch + 120 }, defs);
    el('feGaussianBlur', { stdDeviation: 12 * (variant === 'classic' ? 0.6 : 1) }, blur);
    const noise = el('pattern', { id: 'glass-noise', width: 256, height: 256, patternUnits: 'userSpaceOnUse' }, defs);
    const tex = noiseTexture();
    if (tex) el('image', { href: tex, width: 256, height: 256 }, noise);
    const sweep = el('radialGradient', { id: 'sweep-light' }, defs);
    el('stop', { offset: 0, 'stop-color': '#FFF1C2', 'stop-opacity': 0.12 }, sweep);
    el('stop', { offset: 1, 'stop-color': '#FFF1C2', 'stop-opacity': 0 }, sweep);
    const glassClip = el('clipPath', { id: 'glass-clip' }, defs);
    el('rect', { x: FRAME, y: FRAME, width: l.size - FRAME * 2, height: l.size - FRAME * 2 }, glassClip);

    // Stone frame and arch.
    const W = l.size;
    const A = l.arch;
    const archPath = (inset: number) => {
      const x0 = inset;
      const x1 = W - inset;
      const top = -A + inset;
      const w = x1 - x0;
      if (l.flat) return `M${x0} 0V${top}H${x1}V0Z`;
      return `M${x0} 0C${x0} ${top * 0.55} ${x0 + w * 0.28} ${top * 0.92} ${W / 2} ${top}C${x1 - w * 0.28} ${top * 0.92} ${x1} ${top * 0.55} ${x1} 0Z`;
    };
    el('path', { d: `${archPath(0)}M0 0H${W}V${W}H0Z`, class: 'stone' }, svg);
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

    // Lead under the glass, then the glass itself.
    el('rect', { x: FRAME - 4, y: FRAME - 4, width: W - FRAME * 2 + 8, height: W - FRAME * 2 + 8, class: 'lead-fill' }, svg);
    const glass = el('g', { class: 'glass' }, svg);
    for (let p = 0; p < total; p++) {
      const [x, y] = panelOrigin(l, p);
      const g = el('g', { id: `pg${p}`, class: 'panel', transform: `translate(${x} ${y})` }, glass);
      this.panelGroups.push(g);
      this.painted.push([]);
      this.drawnPanel.push('');
    }
    this.paneGroups = new Array(total * 9).fill(null);
    this.panePainted = Array.from({ length: total * 9 }, () => []);
    this.drawnPane = new Array(total * 9).fill(undefined);

    // Lit glass casts a blurred copy of itself.
    const glow = el('g', { class: 'glow', filter: 'url(#glow-blur)' }, svg);
    for (let p = 0; p < total; p++) {
      this.glowUses.push(el('use', { href: `#pg${p}`, class: 'glow-use' }, glow));
    }
    el('rect', { x: FRAME, y: FRAME, width: W - FRAME * 2, height: W - FRAME * 2, fill: 'url(#glass-noise)', class: 'noise' }, svg);
    const sweepG = el('g', { 'clip-path': 'url(#glass-clip)' }, svg);
    el('ellipse', { cx: 0, cy: W * 0.45, rx: W * 0.45, ry: W * 0.7, fill: 'url(#sweep-light)', class: 'sweep' }, sweepG);

    // 1px highlight on the top-left edge of the lead.
    const shine = el('g', { class: 'lead-shine' }, svg);
    el('path', { d: `M${FRAME - 4} ${W - FRAME + 4}V${FRAME - 4}H${W - FRAME + 4}` }, shine);
    for (let i = 1; i < l.side; i++) {
      const c = FRAME + i * PANEL + (i - 1) * BAR;
      el('path', { d: `M${c + 0.5} ${FRAME}V${W - FRAME}M${FRAME} ${c + 0.5}H${W - FRAME}` }, shine);
    }

    // Effects and controls above the glass.
    this.fx = el('g', { class: 'fx' }, svg);
    for (let p = 0; p < total; p++) {
      const [x, y] = panelOrigin(l, p);
      this.pulses.push(el('rect', { x, y, width: PANEL, height: PANEL, class: 'panel-pulse' }, this.fx));
      this.outlines.push(el('rect', { x: x - 3, y: y - 3, width: PANEL + 6, height: PANEL + 6, class: 'panel-outline' }, this.fx));
    }
    this.ghost = el('g', { class: 'ghost' }, this.fx);
    this.winBar = el('path', { class: 'win-bar' }, this.fx);
    this.spark = el('path', { class: 'spark' }, this.fx);

    const buttons = el('g', { class: 'panes' }, svg);
    for (let p = 0; p < total; p++) {
      const [x, y] = panelOrigin(l, p);
      for (let q = 0; q < 9; q++) {
        const [dx, dy] = paneOrigin(q);
        const idx = p * 9 + q;
        const b = el('g', { class: 'pane', role: 'button', tabindex: idx === this.focusIndex ? 0 : -1, 'data-panel': p, 'data-pane': q }, buttons);
        el('rect', { x: x + dx - THIN / 2, y: y + dy - THIN / 2, width: PANE + THIN, height: PANE + THIN, class: 'hit' }, b);
        el('rect', { x: x + dx + 5, y: y + dy + 5, width: PANE - 10, height: PANE - 10, class: 'focus-gap' }, b);
        el('rect', { x: x + dx + 5, y: y + dy + 5, width: PANE - 10, height: PANE - 10, class: 'focus-ring' }, b);
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

  private onKey(e: KeyboardEvent): void {
    const n = this.layout.side * 3;
    const idx = this.focusIndex;
    const panel = Math.floor(idx / 9);
    const pane = idx % 9;
    let gx = (panel % this.layout.side) * 3 + (pane % 3);
    let gy = Math.floor(panel / this.layout.side) * 3 + Math.floor(pane / 3);
    switch (e.key) {
      case 'ArrowLeft': gx = Math.max(0, gx - 1); break;
      case 'ArrowRight': gx = Math.min(n - 1, gx + 1); break;
      case 'ArrowUp': gy = Math.max(0, gy - 1); break;
      case 'ArrowDown': gy = Math.min(n - 1, gy + 1); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.activate({ panel, pane }, false);
        return;
      default:
        return;
    }
    e.preventDefault();
    const np = Math.floor(gy / 3) * this.layout.side + Math.floor(gx / 3);
    const nq = (gy % 3) * 3 + (gx % 3);
    this.setFocusIndex(np * 9 + nq, true);
  }

  private setFocusIndex(idx: number, focus: boolean): void {
    if (idx !== this.focusIndex) {
      this.buttons[this.focusIndex].setAttribute('tabindex', '-1');
      this.buttons[idx].setAttribute('tabindex', '0');
      this.focusIndex = idx;
    }
    if (focus) this.buttons[idx].focus();
  }

  /** Move keyboard focus to a sensible pane: the first legal one if focus is elsewhere. */
  focusLegal(): void {
    const legal = this.rules.legalMoves(this.state);
    if (legal.length === 0) return;
    const cur = { panel: Math.floor(this.focusIndex / 9), pane: this.focusIndex % 9 };
    const m = this.rules.isLegal(this.state, cur) ? cur : legal[Math.floor(legal.length / 2)];
    this.setFocusIndex(m.panel * 9 + m.pane, document.activeElement?.closest?.('.panes') != null);
  }

  private target(m: Move): number | null | undefined {
    if (this.layout.variant === 'classic') return undefined;
    const after = this.rules.play(this.state, m);
    if (after.result !== 'playing') return undefined;
    return after.target;
  }

  private setHover(m: Move | null): void {
    const legal = m && this.interactive && this.rules.isLegal(this.state, m) ? m : null;
    this.hover = legal;
    const key = legal ? `${legal.panel}:${legal.pane}:${this.state.next}` : '';
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.ghost.replaceChildren();
    this.ghost.classList.toggle('show', !!legal);
    let target: number | null | undefined;
    if (legal) {
      const [px, py] = panelOrigin(this.layout, legal.panel);
      const [dx, dy] = paneOrigin(legal.pane);
      const pieces = this.state.next === 'amber' ? crossPieces(PANE, px + dx, py + dy) : roundelPieces(PANE, px + dx, py + dy);
      for (const piece of pieces) {
        if (piece.role === 'clear') continue;
        const path = el('path', { d: piece.d }, this.ghost);
        if (piece.rule) path.setAttribute('fill-rule', piece.rule);
        path.style.fill = pieceColour(piece.role, 1, false, 1);
      }
      target = this.target(legal);
    }
    const after = legal && target === null ? this.rules.play(this.state, legal) : null;
    this.outlines.forEach((o, i) => {
      const on = legal != null && (target === i || (after != null && after.panels[i] === 'open'));
      o.classList.toggle('show', on);
    });
    this.cb.onPreview(legal ? target : undefined);
  }

  /** The lit panels pulse once, for an illegal tap. */
  pulseLit(): void {
    this.lights.forEach((light, i) => {
      if (light.level < 1 || this.state.result !== 'playing') return;
      const p = this.pulses[i];
      if (reducedMotion()) return;
      p.getAnimations().forEach((a) => a.cancel());
      p.animate([{ opacity: 0 }, { opacity: 0.28 }, { opacity: 0 }], { duration: 360, easing: 'ease-out' });
    });
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

  private paint(list: Painted[], light: PanelLight): void {
    for (const p of list) p.el.style.fill = pieceColour(p.role, light.level, light.grisaille, p.seed);
  }

  render(state: GameState, opts: RenderOptions = {}): void {
    const l = this.layout;
    const classic = l.variant === 'classic';
    const prevLights = this.lights;
    this.state = state;
    this.interactive = !!opts.interactive && state.result === 'playing';
    this.armed = null;
    const lights = panelLights(state, { title: !!opts.title, classic });
    this.lights = lights;
    const move = opts.move;
    const motion = !!move && !reducedMotion();
    const total = l.side * l.side;
    this.svg.classList.toggle('is-title', !!opts.title);
    this.svg.classList.toggle('is-over', state.result !== 'playing');
    this.svg.classList.toggle('is-won', state.result === 'amber' || state.result === 'cobalt');

    for (let p = 0; p < total; p++) {
      const owner = state.panels[p];
      const group = this.panelGroups[p];
      const light = lights[p];
      const before = prevLights[p];
      const dimming = before && light.level < before.level;
      // Old panel dims in 300ms; the new one lights in 450ms, after the spark has set off.
      group.style.setProperty('--dur', `${reducedMotion() ? TIMING.reduced : dimming ? TIMING.dim : TIMING.light}ms`);
      group.style.setProperty('--delay', motion && !dimming && !classic ? `${TIMING.lightDelay}ms` : '0ms');

      const emblem = !classic && (owner === 'amber' || owner === 'cobalt');
      const key = emblem ? owner : 'panes';
      if (key !== this.drawnPanel[p]) {
        const wonNow = emblem && motion && move!.panel === p;
        const old = Array.from(group.children);
        this.painted[p] = [];
        for (let q = 0; q < 9; q++) {
          this.paneGroups[p * 9 + q] = null;
          this.panePainted[p * 9 + q] = [];
          this.drawnPane[p * 9 + q] = undefined;
        }
        if (emblem) {
          const g = el('g', { class: 'emblem' }, group);
          const built = this.buildPieces(g, emblemPieces(owner as Player), 1000 + p, this.painted[p]);
          if (wonNow) {
            // Panes fade in a 40ms stagger, the emblem's lead draws, colour floods from the centre, then one bloom.
            old.forEach((o, i) => {
              const a = animate(o, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: i * 40, fill: 'both' });
              if (a) a.onfinish = () => o.remove();
              else o.remove();
            });
            animate(built.lead, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: 120, easing: 'ease-in-out' });
            animate(built.fills, [{ transform: 'scale(0.02)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 480, delay: 380, easing: 'cubic-bezier(.3,0,.2,1)' });
            const pulse = this.pulses[p];
            pulse.animate([{ opacity: 0 }, { opacity: 0.5 }, { opacity: 0 }], { duration: 300, delay: 800, easing: 'ease-out' });
          } else old.forEach((o) => o.remove());
        } else {
          old.forEach((o) => o.remove());
        }
        this.drawnPanel[p] = key;
      }

      if (!emblem) {
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
              // The new mark arrives lit, whatever its panel does next.
              for (const pt of this.panePainted[idx]) pt.el.style.fill = pieceColour(pt.role, 1, false, pt.seed);
              const flash = el('rect', { x: dx, y: dy, width: PANE, height: PANE, class: 'flash' }, g);
              markPlaced(built.fills, built.lead, flash);
              void g.getBoundingClientRect();
            }
          }
          this.paint(this.panePainted[idx], light);
        }
      } else {
        this.paint(this.painted[p], light);
      }

      const lit = light.level;
      const won = owner === 'amber' || owner === 'cobalt';
      const glow = opts.title ? 0 : light.grisaille ? 0 : won ? 0.6 * lit : classic ? 0.3 * lit : 0.25 * lit;
      this.glowUses[p].style.opacity = String(glow);
    }

    // Buttons: labels, state.
    const next = state.next;
    for (let p = 0; p < total; p++) {
      for (let q = 0; q < 9; q++) {
        const idx = p * 9 + q;
        const b = this.buttons[idx];
        const m = { panel: p, pane: q };
        const legal = state.result === 'playing' && !opts.title && this.rules.isLegal(state, m);
        b.classList.toggle('legal', legal && this.interactive);
        b.setAttribute('aria-disabled', legal && this.interactive ? 'false' : 'true');
        b.setAttribute('aria-label', this.label(state, m, legal, next));
      }
    }

    // Turn light.
    const turnOn = !opts.title;
    const side: Player | null = state.result === 'playing' ? next : state.result === 'draw' ? null : state.result;
    const role: Role = side === 'cobalt' ? 'cobalt-ring' : side === 'amber' ? 'amber-arm' : 'clear';
    const colour = pieceColour(role, turnOn && side ? 1 : 0, !side && turnOn, 4242);
    this.turn.style.fill = colour;
    this.turnGlow.style.fill = colour;
    this.turnGlow.style.opacity = turnOn && side ? '0.6' : '0';
    this.archDetail.classList.toggle('breathing', !!opts.thinking);
    this.svg.dataset.turn = side ?? 'none';
    this.svg.dataset.thinking = opts.thinking ? 'true' : 'false';

    // The move explains itself.
    if (motion && !classic && state.result === 'playing') {
      runSpark(this.spark, this.sparkPath(move!, move!.pane));
      const t = state.target;
      const flashOutline = (i: number) =>
        this.outlines[i].animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.35 }, { opacity: 0 }], {
          duration: TIMING.light + 150,
          delay: TIMING.lightDelay,
          easing: 'ease-out',
        });
      if (t !== null) flashOutline(t);
    }
    if (state.result !== 'playing' && !opts.title) this.showWin(state, motion);
    else this.winBar.classList.remove('show');

    if (this.hover) {
      const h = this.hover;
      this.ghostKey = '';
      this.setHover(h);
    } else this.setHover(null);
  }

  private label(state: GameState, m: Move, legal: boolean, next: Player): string {
    const classic = this.layout.variant === 'classic';
    const mark = state.panes[m.panel * 9 + m.pane];
    const holds = mark === 'amber' ? "holds Amber's cross" : mark === 'cobalt' ? "holds Cobalt's roundel" : 'empty';
    if (classic) {
      return `${cap(POSITIONS[m.pane])} square, ${holds}.`;
    }
    const where = `${cap(POSITIONS[m.panel])} panel, ${POSITIONS[m.pane]} pane, ${holds}.`;
    const owner = state.panels[m.panel];
    if (owner === 'amber' || owner === 'cobalt') return `${where} Panel won by ${NAMES[owner]}.`;
    if (owner === 'drawn') return `${where} Panel drawn.`;
    if (!legal) return mark ? where : `${where} Not in play this turn.`;
    const target = this.target(m);
    const them = NAMES[other(next)];
    if (target === undefined) return `${where} Ends the game.`;
    if (target === null) return `${where} Gives ${them} a free move.`;
    return `${where} Sends ${them} to the ${POSITIONS[target]} panel.`;
  }

  /** Centre of a pane in window units. */
  paneCentre(m: Move): [number, number] {
    const [px, py] = panelOrigin(this.layout, m.panel);
    const [dx, dy] = paneOrigin(m.pane);
    return [px + dx + PANE / 2, py + dy + PANE / 2];
  }

  /** Along the lead from the pane played to the panel it points at, then round that panel. */
  private sparkPath(m: Move, targetPanel: number): string {
    const [sx, sy] = this.paneCentre(m);
    const [tx0, ty0] = panelOrigin(this.layout, targetPanel);
    const tx1 = tx0 + PANEL;
    const ty1 = ty0 + PANEL;
    const tcx = tx0 + PANEL / 2;
    const off = THIN / 2;
    const lx = tcx >= sx ? sx + PANE / 2 + off : sx - PANE / 2 - off;
    const top = ty0 - off;
    const bottom = ty1 + off;
    const ly = Math.abs(top - sy) <= Math.abs(bottom - sy) ? top : bottom;
    const left = tx0 - off;
    const right = tx1 + off;
    const ex = Math.abs(left - lx) <= Math.abs(right - lx) ? left : right;
    const oy = ly === top ? bottom : top;
    const ox = ex === left ? right : left;
    return `M${sx} ${sy}H${lx}V${ly}H${ex}V${oy}H${ox}V${ly}H${ex}`;
  }

  private showWin(state: GameState, motion: boolean): void {
    const classic = this.layout.variant === 'classic';
    let line: readonly [number, number, number] | null = null;
    if (state.result === 'amber' || state.result === 'cobalt') {
      line = classic ? classicLine(state.panes) : winningLine(state.panels);
    }
    if (!line) {
      this.winBar.classList.remove('show');
      return;
    }
    const centre = (i: number): [number, number] => {
      if (classic) return this.paneCentre({ panel: 0, pane: i });
      const [x, y] = panelOrigin(this.layout, i);
      return [x + PANEL / 2, y + PANEL / 2];
    };
    const [ax, ay] = centre(line[0]);
    const [bx, by] = centre(line[2]);
    this.winBar.setAttribute('d', `M${ax} ${ay}L${bx} ${by}`);
    this.winBar.setAttribute('pathLength', '1');
    this.winBar.classList.add('show');
    if (!motion) return;
    // The three winning emblems pulse in order, a bar of light joins them, the whole window lights.
    line.forEach((i, n) => {
      const target: Element = classic ? (this.paneGroups[i] as Element) : this.pulses[i];
      if (classic) {
        animate(target, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 420, delay: 200 + n * 320, easing: EASE.mark });
      } else {
        animate(target, [{ opacity: 0 }, { opacity: 0.55 }, { opacity: 0 }], { duration: 420, delay: 300 + n * 320, easing: 'ease-out' });
      }
    });
    animate(this.winBar, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: 700, delay: 1150, easing: 'ease-in-out' });
    this.panelGroups.forEach((g) => g.style.setProperty('--delay', '1500ms'));
    this.panelGroups.forEach((g) => g.style.setProperty('--dur', '800ms'));
  }

  /** Panels that are lit now, for the map and the phone view. */
  litPanels(): number[] {
    return this.lights.map((x, i) => (x.level >= 1 ? i : -1)).filter((i) => i >= 0);
  }
  currentLights(): PanelLight[] {
    return this.lights;
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { LINES };
