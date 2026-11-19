import { choose, type OpponentId } from './opponents';
import { classicChoose } from '../classic';
import { mulberry32 } from './mcts';
import type { GameState } from '../rules';

export interface WorkerRequest {
  id: number;
  opponent: OpponentId;
  state: GameState;
  phone: boolean;
  classic: boolean;
  seed?: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, opponent, state, phone, seed, classic } = e.data;
  const move = classic
    ? classicChoose(opponent, state, seed === undefined ? Math.random : mulberry32(seed))
    : choose(opponent, state, { phone, seed });
  (self as unknown as Worker).postMessage({ id, move });
};
