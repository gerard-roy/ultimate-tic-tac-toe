import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, playMove, playToEnd, ready, square, start, state, watchConsole } from './helpers';
import { cubeLine, cubePlay, newCube } from '../src/cube';

test.use({ viewport: DESKTOP });

for (const mode of ['apprentice', 'glazier', 'master']) {
  test(`a full 3D game against ${mode} finishes with the right result`, async ({ page }) => {
    const problems = watchConsole(page);
    await start(page, { mode });
    const s = await playToEnd(page);
    // The rules engine, replaying the same moves, agrees with what the page shows.
    const replayed = s.history.reduce((g, m) => cubePlay(g, m), newCube(s.first));
    expect(replayed.result).toBe(s.result);
    expect(cubeLine(s.panes)).not.toBeNull();
    const title = page.locator('#result-title');
    await expect(title).toBeVisible({ timeout: 6000 });
    const name = mode[0].toUpperCase() + mode.slice(1);
    await expect(title).toHaveText(s.result === 'amber' ? 'You win.' : `${name} wins.`);
    await expect(page.locator('.win-bar')).toHaveClass(/show/);
    expect(problems).toEqual([]);
  });
}

test('the board has three levels of nine squares, all open at the start', async ({ page }) => {
  await start(page, { mode: 'two' });
  await expect(page.locator('.pane')).toHaveCount(27);
  await expect(page.locator('.pane.legal')).toHaveCount(27);
  await expect(square(page, 1, 4)).toHaveAttribute('aria-label', 'Middle level, centre square, empty.');
  await expect(page.locator('.brand')).toHaveText('3D Tic-Tac-Toe');
});

test('a line straight down through the three levels wins', async ({ page }) => {
  await start(page, { mode: 'two' });
  // Amber takes the centre of each level; Cobalt plays two squares on the top level.
  for (const [level, pane] of [[0, 4], [0, 0], [1, 4], [0, 1], [2, 4]]) await square(page, level, pane).click();
  expect((await state(page)).result).toBe('amber');
  await expect(page.locator('#result-title')).toHaveText('Amber wins.', { timeout: 6000 });
  await expect(page.locator('.win-bar')).toHaveClass(/show/);
  await expect(square(page, 2, 4)).toHaveAttribute('aria-label', "Bottom level, centre square, holds Amber's cross.");
});

test('a slanting line from corner to corner through the centre wins', async ({ page }) => {
  await start(page, { mode: 'two' });
  for (const [level, pane] of [[0, 0], [0, 1], [1, 4], [0, 2], [2, 8]]) await square(page, level, pane).click();
  expect((await state(page)).result).toBe('amber');
});

test('no computer move appears in under 700ms, and the page keeps drawing while it thinks', async ({ page }) => {
  await start(page, { mode: 'master' });
  for (let i = 0; i < 3; i++) {
    const before = (await ready(page)).history.length;
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number; __gap: number };
      w.__frames = 0;
      w.__gap = 0;
      let last = performance.now();
      const tick = (t: number) => {
        w.__frames++;
        w.__gap = Math.max(w.__gap, t - last);
        last = t;
        if (window.__game.game.thinking || w.__frames < 5) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (!(await playMove(page))) break;
    await page.waitForFunction((n) => window.__game.state().history.length >= n + 2 || window.__game.state().result !== 'playing', before);
    if ((await state(page)).history.length < before + 2) break;
    const { delay, gap } = await page.evaluate(() => ({ delay: window.__game.game.lastComputerDelay, gap: (window as unknown as { __gap: number }).__gap }));
    expect(delay).toBeGreaterThanOrEqual(700);
    // The search runs in a worker, so frames keep coming while it thinks.
    expect(gap).toBeLessThan(250);
  }
});

test('two players, undo, rematch and resume after reload', async ({ page }) => {
  await start(page, { mode: 'two' });
  await expect(page.locator('.status')).toHaveText('Amber to move.');
  await square(page, 1, 0).click();
  await expect(page.locator('.status')).toHaveText('Cobalt to move.');
  await square(page, 0, 8).click();
  expect((await state(page)).history).toHaveLength(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await state(page)).history).toHaveLength(1);
  await page.keyboard.press('u');
  expect((await state(page)).history).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await square(page, 1, 4).click();
  await square(page, 2, 1).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'game');
  const resumed = await state(page);
  expect(resumed.history).toEqual([{ panel: 1, pane: 4 }, { panel: 2, pane: 1 }]);
  expect(resumed.next).toBe('amber');

  const s = await playToEnd(page);
  await expect(page.locator('#result-title')).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: 'Rematch' }).click();
  const next = await state(page);
  expect(next.history).toHaveLength(0);
  // The first mover alternates on every rematch.
  expect(next.first).not.toBe(s.first);
  expect(next.next).toBe('cobalt');
});

test('undo against the computer removes its reply and the player move together', async ({ page }) => {
  await start(page, { mode: 'apprentice' });
  await playMove(page);
  expect((await ready(page)).history).toHaveLength(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  const s = await state(page);
  expect(s.history).toHaveLength(0);
  expect(s.next).toBe('amber');
});

test('a square that is already taken is refused', async ({ page }) => {
  await start(page, { mode: 'two' });
  await square(page, 0, 4).click();
  // The square reports aria-disabled, so the click is forced as a stray tap would be.
  await square(page, 0, 4).click({ force: true });
  const s = await state(page);
  expect(s.history).toHaveLength(1);
  expect(s.next).toBe('cobalt');
});

test('a full game with the keyboard alone, with every move announced', async ({ page }) => {
  await page.goto('./?bg=stone&seed=5');
  await page.locator('#game-cube').check({ force: true });
  await page.locator('#mode-two').focus();
  await page.locator('#mode-two').check({ force: true });
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'game');
  await page.locator('.pane[tabindex="0"]').focus();
  const seen: string[] = [];
  for (let turn = 0; turn < 27; turn++) {
    const s = await state(page);
    if (s.result !== 'playing') break;
    const legal = await page.locator('.pane.legal').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-panel')), Number(e.getAttribute('data-pane'))]));
    const [panel, pane] = legal[(turn * 5 + 2) % legal.length];
    // Walk the focus there with the arrow keys: a grid three squares wide, level after level.
    const gx = pane % 3;
    const gy = panel * 3 + Math.floor(pane / 3);
    for (let guard = 0; guard < 14; guard++) {
      const [fp, fq] = await page.evaluate(() => {
        const e = document.activeElement as Element;
        return [Number(e.getAttribute('data-panel')), Number(e.getAttribute('data-pane'))];
      });
      const fx = fq % 3;
      const fy = fp * 3 + Math.floor(fq / 3);
      if (fx === gx && fy === gy) break;
      await page.keyboard.press(fx < gx ? 'ArrowRight' : fx > gx ? 'ArrowLeft' : fy < gy ? 'ArrowDown' : 'ArrowUp');
    }
    await page.keyboard.press(turn % 2 ? 'Enter' : 'Space');
    await page.waitForFunction((n) => window.__game.state().history.length > n, s.history.length);
    seen.push((await page.locator('[aria-live]').textContent()) ?? '');
  }
  const end = await state(page);
  expect(end.result).not.toBe('playing');
  expect(seen.length).toBe(end.history.length);
  expect(seen.every((t) => /^(Amber|Cobalt) played the (top|middle|bottom) level, /.test(t))).toBe(true);
  expect(seen[seen.length - 1]).toMatch(/wins\.$/);
});

test('classic tic-tac-toe on nine squares', async ({ page }) => {
  const problems = watchConsole(page);
  await start(page, { mode: 'two', game: 'classic' });
  await expect(page.locator('.pane')).toHaveCount(9);
  for (const pane of [0, 3, 1, 4, 2]) await square(page, 0, pane).click();
  expect((await state(page)).result).toBe('amber');
  await expect(page.locator('#result-title')).toHaveText('Amber wins.', { timeout: 6000 });

  await start(page, { mode: 'master', game: 'classic' });
  const s = await playToEnd(page);
  // Master never loses at nine squares.
  expect(s.result).not.toBe('amber');
  expect(problems).toEqual([]);
});

test('keys: M mutes, ? opens the rules, Esc opens the menu', async ({ page }) => {
  await start(page, { mode: 'two' });
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: /Sound is off/ })).toBeVisible();
  await page.keyboard.press('?');
  await expect(page.getByRole('heading', { name: 'Take turns' })).toBeVisible();
  await page.locator('.howto .play').click();
  await page.locator('.howto .play').click();
  await expect(page.getByRole('heading', { name: 'Lines run through the levels' })).toBeVisible();
  await page.locator('.howto .play').click();
  await page.locator('.howto .play').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
});

test('reduce motion stops the motes and the mark animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, { mode: 'two' });
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await square(page, 0, 4).click();
  expect(await page.locator('.glass').evaluate((e) => e.getAnimations({ subtree: true }).filter((a) => !(a instanceof CSSTransition)).length)).toBe(0);
  await expect(page.locator('.motes')).toBeHidden();
});

test('the floor light changes after a move', async ({ page }) => {
  await start(page, { mode: 'two' });
  const floor = () => page.locator('.floor-light').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  const before = await floor();
  await square(page, 2, 8).click();
  expect(await floor()).not.toBe(before);
});

test.describe('phone', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('every square is at least 44px wide and tall, and nothing scrolls sideways', async ({ page }) => {
    await start(page, { mode: 'two' });
    for (const [level, pane] of [[0, 0], [1, 4], [2, 8]]) {
      const box = await square(page, level, pane).locator('.hit').boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    // The whole board is on screen without scrolling.
    const last = await square(page, 2, 8).locator('.hit').boundingBox();
    expect(last!.y + last!.height).toBeLessThan(PHONE.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('a full game against the apprentice by touch', async ({ page }) => {
    const problems = watchConsole(page);
    await start(page, { mode: 'apprentice' });
    await playToEnd(page, true);
    await expect(page.locator('#result-title')).toBeVisible({ timeout: 6000 });
    expect(problems).toEqual([]);
  });
});
