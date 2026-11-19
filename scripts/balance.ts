import { newGame, play, type Player } from '../src/rules';
import { choose, type OpponentId } from '../src/ai/opponents';

const GAMES = Number(process.env.GAMES ?? 100);

function match(strong: OpponentId, weak: OpponentId): { strong: number; weak: number; draw: number } {
  const tally = { strong: 0, weak: 0, draw: 0 };
  let seed = 1;
  for (let g = 0; g < GAMES; g++) {
    const strongSide: Player = g % 2 === 0 ? 'amber' : 'cobalt';
    // Strong side alternates colour each game and so alternates moving first.
    let s = newGame('amber');
    while (s.result === 'playing') {
      const who = s.next === strongSide ? strong : weak;
      s = play(s, choose(who, s, { fixed: true, seed: seed++ }));
    }
    if (s.result === 'draw') tally.draw++;
    else if (s.result === strongSide) tally.strong++;
    else tally.weak++;
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return tally;
}

const pairs: [OpponentId, OpponentId, number][] = [
  ['glazier', 'apprentice', 85],
  ['master', 'glazier', 70],
];
let ok = true;
for (const [strong, weak, target] of pairs) {
  const t0 = Date.now();
  const r = match(strong, weak);
  const pass = r.strong >= (target * GAMES) / 100;
  ok &&= pass;
  console.log(
    `${strong} vs ${weak}: ${strong} ${r.strong}, ${weak} ${r.weak}, draws ${r.draw} of ${GAMES} ` +
      `(target ${target}/100) ${pass ? 'PASS' : 'FAIL'} in ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
}
process.exit(ok ? 0 : 1);
