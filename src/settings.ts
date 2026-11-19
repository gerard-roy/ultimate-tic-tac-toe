import { readJson, writeJson, type Mode, type Variant } from './game';
import { toBackground, type BackgroundId } from './bg';

export interface Settings {
  master: number;
  effects: number;
  room: number;
  muted: boolean;
  /** null follows the system setting. */
  reduceMotion: boolean | null;
  confirmTaps: boolean;
  background: BackgroundId;
  variant: Variant;
  mode: Mode;
}

export const BRAND = '3D Tic-Tac-Toe';

const KEY = 'ttt3d.settings';

export const DEFAULTS: Settings = {
  master: 0.8,
  effects: 0.8,
  room: 0.5,
  muted: false,
  reduceMotion: null,
  confirmTaps: false,
  background: 'space',
  variant: 'cube',
  mode: 'glazier',
};

export function loadSettings(): Settings {
  const s = { ...DEFAULTS, ...(readJson<Partial<Settings>>(KEY) ?? {}) };
  if (s.variant !== 'classic') s.variant = 'cube';
  s.background = toBackground(s.background);
  return s;
}

/** Settings save at once. */
export function saveSettings(s: Settings): void {
  writeJson(KEY, s);
}
