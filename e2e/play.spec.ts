import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, playMove, playToEnd, ready, start, state, watchConsole } from './helpers';
import { replay } from '../src/rules';

test.use({ viewport: DESKTOP });

for (const mode of ['apprentice', 'glazier', 'master']) {
  test(`a full game against ${mode} finishes with the right result`, async ({ page }) => {
    const problems = watchConsole(page);
    await start(page, { mode });
    const s = await playToEnd(page, false);
    // The engine's own replay of the history agrees with what the page shows.
    expect(replay(s.first, s.history).result).toBe(s.result);
    const title = page.locator('#result-title');
    await expect(title).toBeVisible({ timeout: 6000 });
    const name = mode[0].toUpperCase() + mode.slice(1);
    await expect(title).toHaveText(s.result === 'draw' ? 'Draw. Nobody made a line.' : s.result === 'amber' ? 'You win.' : `${name} wins.`);
    expect(problems).toEqual([]);
  });
}

test('no computer move appears in under 700ms, and the page keeps drawing while it thinks', async ({ page }) => {
  await start(page, { mode: 'master' });
  for (let i = 0; i < 4; i++) {
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
        if (window.__ninefold.game.thinking || w.__frames < 5) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await playMove(page, false);
    await page.waitForFunction((n) => window.__ninefold.state().history.length >= n + 2 || window.__ninefold.state().result !== 'playing', before);
    const { delay, gap } = await page.evaluate(() => ({ delay: window.__ninefold.game.lastComputerDelay, gap: (window as unknown as { __gap: number }).__gap }));
    expect(delay).toBeGreaterThanOrEqual(700);
    // The search runs in a worker, so frames keep coming while it thinks.
    expect(gap).toBeLessThan(250);
  }
});

test('two players, undo, rematch and resume after reload', async ({ page }) => {
  await start(page, { mode: 'two' });
  await expect(page.locator('.status')).toHaveText('Amber to move. Play in any lit panel.');
  await page.locator('.pane[data-panel="4"][data-pane="0"]').click();
  await expect(page.locator('.status')).toHaveText('Cobalt to move. Play in the lit panel.');
  await page.locator('.pane[data-panel="0"][data-pane="8"]').click();
  expect((await state(page)).history).toHaveLength(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await state(page)).history).toHaveLength(1);
  await page.keyboard.press('u');
  expect((await state(page)).history).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await page.locator('.pane[data-panel="4"][data-pane="4"]').click();
  await page.locator('.pane[data-panel="4"][data-pane="1"]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'game');
  const resumed = await state(page);
  expect(resumed.history).toEqual([{ panel: 4, pane: 4 }, { panel: 4, pane: 1 }]);
  expect(resumed.target).toBe(1);

  const s = await playToEnd(page, false);
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
  await playMove(page, false);
  expect((await ready(page)).history).toHaveLength(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  const s = await state(page);
  expect(s.history).toHaveLength(0);
  expect(s.next).toBe('amber');
});

test('only lit glass can be played, and an unlit pane is refused', async ({ page }) => {
  await start(page, { mode: 'two' });
  await page.locator('.pane[data-panel="0"][data-pane="4"]').click();
  // Sent to the centre panel: every legal pane is in it.
  const panels = await page.locator('.pane.legal').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-panel')))]);
  expect(panels).toEqual(['4']);
  // The pane reports aria-disabled, so the click is forced as a stray tap would be.
  await page.locator('.pane[data-panel="8"][data-pane="0"]').click({ force: true });
  expect((await state(page)).history).toHaveLength(1);
});

test('a full game with the keyboard alone, with every move announced', async ({ page }) => {
  await page.goto('./?bg=stone&seed=5');
  await page.locator('#mode-two').focus();
  await page.locator('#mode-two').check({ force: true });
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'game');
  await page.locator('.pane[tabindex="0"]').focus();
  const seen: string[] = [];
  for (let turn = 0; turn < 81; turn++) {
    const s = await state(page);
    if (s.result !== 'playing') break;
    const legal = await page.locator('.pane.legal').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-panel')), Number(e.getAttribute('data-pane'))]));
    const [panel, pane] = legal[(turn * 5 + 2) % legal.length];
    // Walk the focus there with the arrow keys.
    const gx = (panel % 3) * 3 + (pane % 3);
    const gy = Math.floor(panel / 3) * 3 + Math.floor(pane / 3);
    for (let guard = 0; guard < 20; guard++) {
      const [fp, fq] = await page.evaluate(() => {
        const e = document.activeElement as Element;
        return [Number(e.getAttribute('data-panel')), Number(e.getAttribute('data-pane'))];
      });
      const fx = (fp % 3) * 3 + (fq % 3);
      const fy = Math.floor(fp / 3) * 3 + Math.floor(fq / 3);
      if (fx === gx && fy === gy) break;
      await page.keyboard.press(fx < gx ? 'ArrowRight' : fx > gx ? 'ArrowLeft' : fy < gy ? 'ArrowDown' : 'ArrowUp');
    }
    await page.keyboard.press(turn % 2 ? 'Enter' : 'Space');
    await page.waitForFunction((n) => window.__ninefold.state().history.length > n, s.history.length);
    seen.push((await page.locator('[aria-live]').textContent()) ?? '');
  }
  const end = await state(page);
  expect(end.result).not.toBe('playing');
  expect(seen.length).toBe(end.history.length);
  expect(seen.every((t) => /^(Amber|Cobalt) played the /.test(t))).toBe(true);
  expect(seen[seen.length - 1]).toMatch(/wins\.|Draw\./);
  expect(seen.some((t) => /won the .* panel/.test(t))).toBe(true);
});

test('pane labels say what a pane holds and where it sends', async ({ page }) => {
  await start(page, { mode: 'two' });
  await expect(page.locator('.pane[data-panel="0"][data-pane="4"]')).toHaveAttribute('aria-label', 'Top-left panel, centre pane, empty. Sends Cobalt to the centre panel.');
});

test('classic tic-tac-toe on nine squares', async ({ page }) => {
  const problems = watchConsole(page);
  await start(page, { mode: 'two', game: 'classic' });
  await expect(page.locator('.pane')).toHaveCount(9);
  for (const pane of [0, 3, 1, 4, 2]) await page.locator(`.pane[data-pane="${pane}"]`).click();
  expect((await state(page)).result).toBe('amber');
  await expect(page.locator('#result-title')).toHaveText('Amber wins.', { timeout: 6000 });

  await start(page, { mode: 'master', game: 'classic' });
  const s = await playToEnd(page, false);
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
  for (let i = 0; i < 4; i++) await page.locator('.howto .play').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
});

test('reduce motion removes the glide, spark and motes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, { mode: 'two' });
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await page.locator('.pane[data-panel="0"][data-pane="4"]').click();
  expect(await page.locator('.spark').evaluate((e) => e.getAnimations().length)).toBe(0);
  await expect(page.locator('.motes')).toBeHidden();
  expect(await page.locator('.glide').evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
});

test('the spark shows the path of a send, and the floor light changes after a move', async ({ page }) => {
  await start(page, { mode: 'two' });
  const floor = () => page.locator('.floor-light').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  const before = await floor();
  await page.locator('.pane[data-panel="0"][data-pane="8"]').click();
  expect(await page.locator('.spark').evaluate((e) => e.getAnimations().length)).toBe(1);
  expect(await page.locator('.spark').getAttribute('d')).toMatch(/^M/);
  expect(await floor()).not.toBe(before);
});

test.describe('phone', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('panes are at least 44px wide when the player must choose, and the view glides to the lit panel', async ({ page }) => {
    await start(page, { mode: 'two' });
    // First move is free: the whole window shows, and a tap zooms.
    await expect(page.locator('html')).not.toHaveClass(/zoomed/);
    await playMove(page, true, () => 40);
    for (let i = 0; i < 12; i++) {
      const s = await state(page);
      if (s.target !== null) {
        await expect(page.locator('html')).toHaveClass(/zoomed/);
        await page.waitForTimeout(520);
        const box = await page.locator('.pane.legal .hit').first().boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        const panelBox = await page.locator(`.panel-outline`).nth(s.target).boundingBox();
        expect(panelBox!.width / PHONE.width).toBeGreaterThan(0.74);
        expect(panelBox!.width / PHONE.width).toBeLessThan(0.84);
      }
      if (!(await playMove(page, true))) break;
    }
    // The map switches to the whole window and back.
    const zoomedNow = (await page.locator('html.zoomed').count()) > 0;
    await page.locator('.map').click();
    await expect(page.locator('html')).toHaveClass(zoomedNow ? /^(?!.*zoomed)/ : /zoomed/);
    await page.locator('.map').click();
    await expect(page.locator('html')).toHaveClass(zoomedNow ? /zoomed/ : /^(?!.*zoomed)/);
    // Nothing scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('a full game against the apprentice on a phone', async ({ page }) => {
    const problems = watchConsole(page);
    await start(page, { mode: 'apprentice' });
    await playToEnd(page, true);
    await expect(page.locator('#result-title')).toBeVisible({ timeout: 6000 });
    expect(problems).toEqual([]);
  });
});
