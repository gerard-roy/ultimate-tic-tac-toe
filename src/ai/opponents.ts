export type OpponentId = 'apprentice' | 'glazier' | 'master';

export interface Opponent {
  id: OpponentId;
  name: string;
  line: string;
}

export const OPPONENTS: Record<OpponentId, Opponent> = {
  apprentice: { id: 'apprentice', name: 'Apprentice', line: 'Still learning. Plays fast and misses traps.' },
  glazier: { id: 'glazier', name: 'Glazier', line: 'Steady hands. Takes what you give away.' },
  master: { id: 'master', name: 'Master', line: 'Plans many moves ahead. Rarely forgives.' },
};
