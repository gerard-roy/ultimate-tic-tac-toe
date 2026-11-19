import { expect, test } from '@playwright/test';
import { DESKTOP, freshTitle, watchConsole } from './helpers';

test.use({ viewport: DESKTOP });

async function open(page: import('@playwright/test').Page, bg: string) {
  await page.goto(`./?bg=${bg}`);
  await freshTitle(page);
  await page.locator('#mode-two').check({ force: true });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => window.__game.background.targets().length > 0);
}

for (const bg of ['space']) {
  test(`${bg}: resting on a star shows its name, brightness, size, colour and picture`, async ({ page }) => {
    const problems = watchConsole(page);
    await open(page, bg);
    const star = await page.evaluate(() => window.__game.background.targets()[0]);
    await page.mouse.move(star.x - 40, star.y - 30);
    await page.mouse.move(star.x, star.y, { steps: 5 });
    const card = page.locator('#bg-card');
    await expect(card).toBeVisible();
    await expect(card.locator('strong')).toHaveText(star.id);
    await expect(card).toContainText('Brightness');
    await expect(card).toContainText('Size');
    await expect(card).toContainText('Colour');
    await expect(card.locator('canvas')).toBeVisible();
    // Moving onto the game hides it again.
    await page.mouse.move(720, 500);
    await expect(card).toBeHidden();
    expect(problems).toEqual([]);
  });
}

for (const bg of ['space']) {
  test(`${bg}: reaching a star draws its whole constellation`, async ({ page }) => {
    await open(page, bg);
    const figures = await page.evaluate(() => window.__game.background.figures());
    expect(figures.map((f) => f.name)).toContain('Orion');
    expect(figures.every((f) => f.show === 0)).toBe(true);
    const orion = figures.find((f) => f.name === 'Orion')!;
    expect(orion.stars).toEqual(['Betelgeuse', 'Rigel', 'Bellatrix', 'Saiph', 'Alnitak', 'Alnilam', 'Mintaka', 'Meissa']);
    const star = await page.evaluate(() => window.__game.background.targets().find((t) => t.id === 'Rigel')!);
    await page.mouse.move(star.x - 30, star.y - 20);
    await page.mouse.move(star.x, star.y, { steps: 4 });
    await page.waitForFunction(() => window.__game.background.figures().find((f) => f.name === 'Orion')!.show > 0.95);
    // Only the constellation that was reached is drawn.
    const after = await page.evaluate(() => window.__game.background.figures());
    expect(after.filter((f) => f.show > 0).map((f) => f.name)).toEqual(['Orion']);
  });
}

for (const bg of ['ocean']) {
  test(`${bg}: animals answer the pointer and never touch the game`, async ({ page }) => {
    const problems = watchConsole(page);
    await open(page, bg);
    const before = await page.evaluate(() => window.__game.state().history.length);
    const puffer = await page.evaluate(() => window.__game.background.targets().find((t) => t.id === 'puffer')!);
    await page.mouse.move(puffer.x - 60, puffer.y);
    await page.mouse.move(puffer.x, puffer.y, { steps: 4 });
    const card = page.locator('#bg-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Reaction');
    expect(await page.evaluate(() => window.__game.state().history.length)).toBe(before);
    expect(problems).toEqual([]);
  });
}

test('the picker offers only Space and Ocean', async ({ page }) => {
  await page.goto('./');
  await freshTitle(page);
  await expect(page.locator('#title-bg option')).toHaveText(['Space', 'Ocean']);
  // Ocean is the default; a different choice is remembered.
  await expect(page.locator('#title-bg')).toHaveValue('ocean');
  await page.locator('#title-bg').selectOption('space');
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'space');
  await page.reload();
  await expect(page.locator('#title-bg')).toHaveValue('space');
});

test('reduce motion draws a quieter ocean with fewer animals', async ({ page }) => {
  await open(page, 'ocean');
  const full = await page.evaluate(() => window.__game.background.targets().length);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'ocean');
  const quiet = await page.evaluate(() => window.__game.background.targets().length);
  expect(full).toBeGreaterThan(quiet * 2);
});
