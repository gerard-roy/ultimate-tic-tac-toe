/** Game controller: turns, undo, save, resume, and the computer opponent. */
import { other, type GameState, type Move, type Player } from './rules';
import { classicLegal, classicMoves, classicPlay, classicUndo, classicWin, newClassic } from './classic';
import { cubeLegal, cubeMoves, cubePlay, cubeUndo, cubeWin, newCube } from './cube';
import type { OpponentId } from './ai/opponents';
import type { WorkerRequest } from './ai/worker';

/** 'cube' is 3D tic-tac-toe on three levels; 'classic' is one board of nine squares. */
export type Variant = 'cube' | 'classic';
export type Mode = OpponentId | 'two';

export interface Rules {
  newGame(first: Player): GameState;
  legalMoves(s: GameState): Move[];
  isLegal(s: GameState, m: Move): boolean;
  play(s: GameState, m: Move): GameState;
  undo(s: GameState): GameState;
  /** The winning line as indexes into `panes`, or null. */
  line(s: GameState): readonly number[] | null;
}

export const RULES: Record<Variant, Rules> = {
  cube: { newGame: newCube, legalMoves: cubeMoves, isLegal: cubeLegal, play: cubePlay, undo: cubeUndo, line: cubeWin },
  classic: { newGame: newClassic, legalMoves: classicMoves, isLegal: classicLegal, play: classicPlay, undo: classicUndo, line: classicWin },
};

export interface Save {
  variant: Variant;
  mode: Mode;
  first: Player;
  history: Move[];
}

export type Tally = { win: number; loss: number; draw: number };
export type Stats = Record<string, Tally>;

const SAVE_KEY = 'ttt3d.save';
const STATS_KEY = 'ttt3d.stats';

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable; the game still plays */
  }
}

export interface ChangeEvent {
  state: GameState;
  prev: GameState | null;
  /** 'move' carries the move just played; other kinds redraw without motion. */
  kind: 'new' | 'move' | 'undo' | 'resume';
  move?: Move;
  mover?: Player;
}

export const MIN_COMPUTER_MS = 700;

export class Game {
  variant: Variant = 'cube';
  mode: Mode = 'glazier';
  state: GameState = newCube('amber');
  thinking = false;
  /** Timestamp of the last computer move appearing, for tests. */
  lastComputerDelay = 0;
  onChange: (e: ChangeEvent) => void = () => {};
  onThinking: (thinking: boolean) => void = () => {};

  private worker: Worker | null = null;
  private requestId = 0;
  private timer = 0;
  private seed: number | undefined;

  constructor(opts: { seed?: number } = {}) {
    this.seed = opts.seed;
  }

  get rules(): Rules {
    return RULES[this.variant];
  }
  get human(): Player {
    return 'amber';
  }
  get vsComputer(): boolean {
    return this.mode !== 'two';
  }
  get computerToMove(): boolean {
    return this.vsComputer && this.state.result === 'playing' && this.state.next !== this.human;
  }
  get canUndo(): boolean {
    const n = this.state.history.length;
    if (n === 0) return false;
    if (!this.vsComputer) return true;
    // Need a human move in the history to take back.
    return this.state.first === this.human ? n >= 1 : n >= 2;
  }

  start(variant: Variant, mode: Mode, first: Player = 'amber'): void {
    this.cancelThinking();
    this.variant = variant;
    this.mode = mode;
    this.state = this.rules.newGame(first);
    this.persist();
    this.onChange({ state: this.state, prev: null, kind: 'new' });
    this.maybeThink();
  }

  /** The first mover alternates on every rematch; marks stay with their colours. */
  rematch(): void {
    this.start(this.variant, this.mode, other(this.state.first));
  }

  resume(): boolean {
    const save = readJson<Save>(SAVE_KEY);
    if (!save || !Array.isArray(save.history)) return false;
    try {
      this.variant = save.variant === 'classic' ? 'classic' : 'cube';
      this.mode = save.mode;
      let s = this.rules.newGame(save.first);
      for (const m of save.history) s = this.rules.play(s, m);
      this.state = s;
    } catch {
      this.clearSave();
      return false;
    }
    this.onChange({ state: this.state, prev: null, kind: 'resume' });
    this.maybeThink();
    return true;
  }

  static hasSave(): boolean {
    const save = readJson<Save>(SAVE_KEY);
    return !!save && Array.isArray(save.history);
  }

  clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** A move by the person at the screen. Returns false when it is not legal. */
  playHuman(move: Move): boolean {
    if (this.thinking || this.computerToMove) return false;
    if (!this.rules.isLegal(this.state, move)) return false;
    this.apply(move);
    this.maybeThink();
    return true;
  }

  undo(): void {
    if (!this.canUndo) return;
    const prev = this.state;
    this.cancelThinking();
    let s = this.rules.undo(this.state);
    // Against the computer, also remove the computer's reply so it is the player's turn again.
    if (this.vsComputer && s.next !== this.human && s.history.length > 0) s = this.rules.undo(s);
    this.state = s;
    this.persist();
    this.onChange({ state: s, prev, kind: 'undo' });
    this.maybeThink();
  }

  stop(): void {
    this.cancelThinking();
  }

  private apply(move: Move): void {
    const prev = this.state;
    this.state = this.rules.play(prev, move);
    this.persist();
    if (this.state.result !== 'playing') this.record();
    this.onChange({ state: this.state, prev, kind: 'move', move, mover: prev.next });
  }

  private persist(): void {
    const save: Save = { variant: this.variant, mode: this.mode, first: this.state.first, history: this.state.history };
    writeJson(SAVE_KEY, save);
  }

  private record(): void {
    if (!this.vsComputer) return;
    const stats = Game.stats();
    const key = `${this.variant}-${this.mode}`;
    const t = stats[key] ?? { win: 0, loss: 0, draw: 0 };
    if (this.state.result === 'draw') t.draw++;
    else if (this.state.result === this.human) t.win++;
    else t.loss++;
    stats[key] = t;
    writeJson(STATS_KEY, stats);
  }

  static stats(): Stats {
    return readJson<Stats>(STATS_KEY) ?? {};
  }

  private cancelThinking(): void {
    this.requestId++;
    window.clearTimeout(this.timer);
    if (this.thinking) {
      this.thinking = false;
      // A search may still be running; replace the worker so it cannot hold the next request up.
      this.worker?.terminate();
      this.worker = null;
      this.onThinking(false);
    }
  }

  private maybeThink(): void {
    if (!this.computerToMove) return;
    const id = ++this.requestId;
    const started = performance.now();
    this.thinking = true;
    this.onThinking(true);
    if (!this.worker) {
      this.worker = new Worker(new URL('./ai/worker.ts', import.meta.url), { type: 'module' });
    }
    const worker = this.worker;
    worker.onmessage = (e: MessageEvent<{ id: number; move: Move }>) => {
      if (e.data.id !== id) return;
      const show = () => {
        if (id !== this.requestId) return;
        // Timers can fire a little early, so check the clock before showing the move.
        const left = MIN_COMPUTER_MS - (performance.now() - started);
        if (left > 0) {
          this.timer = window.setTimeout(show, left);
          return;
        }
        this.thinking = false;
        this.lastComputerDelay = performance.now() - started;
        this.onThinking(false);
        this.apply(e.data.move);
      };
      show();
    };
    const req: WorkerRequest = {
      id,
      opponent: this.mode as OpponentId,
      state: this.state,
      classic: this.variant === 'classic',
      seed: this.seed === undefined ? undefined : this.seed + this.state.history.length,
    };
    worker.postMessage(req);
  }
}
