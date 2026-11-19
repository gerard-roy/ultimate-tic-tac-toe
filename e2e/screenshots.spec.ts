import { test } from '@playwright/test';
import { DESKTOP, PHONE, freshTitle, playMove, square, start } from './helpers';

/** Title, mid-game and game won, at phone and desktop size, plus Classic. */
for (const [name, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
  test(`screenshots at ${name} size`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: name === 'phone' });
    const page = await context.newPage();
    const shot = (what: string) => page.screenshot({ path: `e2e/screenshots/${name}-${what}.png` });
    await page.goto('./?seed=3&bg=space-calm');
    await freshTitle(page);
    await page.locator('#game-cube').check({ force: true });
    await page.waitForTimeout(700);
    await shot('title');
    await start(page, { mode: 'apprentice', query: 'seed=3&bg=space-calm' });
    for (let i = 0; i < 2; i++) await playMove(page);
    await page.waitForTimeout(1200);
    await shot('mid-game');
    // A two-player game to a known finish: Amber wins corner to corner through the centre.
    await start(page, { mode: 'two', query: 'seed=3&bg=space-calm' });
    for (const [level, pane] of [[0, 0], [0, 2], [1, 4], [2, 6], [2, 8]]) await square(page, level, pane).click();
    await page.waitForTimeout(3200);
    await shot('game-won');
    await start(page, { mode: 'two', game: 'classic', query: 'seed=3&bg=space-calm' });
    for (const pane of [4, 0, 2]) await square(page, 0, pane).click();
    await page.waitForTimeout(800);
    await shot('classic');
    await context.close();
  });
}
