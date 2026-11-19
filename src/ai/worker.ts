import type { OpponentId } from './opponents';
import { classicChoose } from '../classic';
import { cubeChoose } from '../cube';
import { mulberry32 } from './rng';
import type { GameState } from '../rules';

export interface WorkerRequest {
  id: number;
  opponent: OpponentId;
  state: GameState;
  classic: boolean;
  seed?: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, opponent, state, seed, classic } = e.data;
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const move = classic ? classicChoose(opponent, state, rng) : cubeChoose(opponent, state, rng);
  (self as unknown as Worker).postMessage({ id, move });
};
