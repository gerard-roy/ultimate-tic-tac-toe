import { test } from '@playwright/test';
import { DESKTOP, PHONE, playMove, start, state } from './helpers';

/** Title, mid-game, panel won and game won, at phone and desktop size. */
for (const [name, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
  test(`screenshots at ${name} size`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: name === 'phone' });
    const page = await context.newPage();
    const shot = (what: string) => page.screenshot({ path: `e2e/screenshots/${name}-${what}.png` });
    await page.goto('./?seed=3&bg=space-calm');
    await page.waitForTimeout(700);
    await shot('title');
    await start(page, { mode: 'apprentice', query: 'seed=3&bg=space-calm' });
    for (let i = 0; i < 9; i++) await playMove(page, name === 'phone');
    await page.waitForTimeout(1600);
    await shot('mid-game');
    let won = false;
    for (let i = 0; i < 81; i++) {
      const before = (await state(page)).panels.join();
      if (!(await playMove(page, name === 'phone'))) break;
      if (!won && (await state(page)).panels.join() !== before) {
        won = true;
        await page.waitForTimeout(1300);
        await shot('panel-won');
      }
    }
    await page.waitForTimeout(3200);
    await shot('game-won');
    await context.close();
  });
}
