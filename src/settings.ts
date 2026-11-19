import { readJson, writeJson, type Mode, type Variant } from './game';
import type { BackgroundId } from './bg';

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

const KEY = 'ninefold.settings';

export const DEFAULTS: Settings = {
  master: 0.8,
  effects: 0.8,
  room: 0.5,
  muted: false,
  reduceMotion: null,
  confirmTaps: false,
  background: 'space-lively',
  variant: 'ninefold',
  mode: 'glazier',
};

export function loadSettings(): Settings {
  return { ...DEFAULTS, ...(readJson<Partial<Settings>>(KEY) ?? {}) };
}

/** Settings save at once. */
export function saveSettings(s: Settings): void {
  writeJson(KEY, s);
}
