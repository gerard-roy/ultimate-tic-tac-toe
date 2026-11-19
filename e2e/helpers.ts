import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/rules';

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

/** A saved game resumes on load, so clear it to reach the title screen. */
export async function freshTitle(page: Page): Promise<void> {
  if ((await page.locator('html').getAttribute('data-screen')) === 'title') return;
  await page.evaluate(() => localStorage.removeItem('ninefold.save'));
  await page.reload();
}

export const state = (page: Page) => page.evaluate(() => window.__ninefold.state()) as Promise<GameState>;

export async function start(page: Page, opts: { mode: string; game?: 'ninefold' | 'classic'; query?: string }): Promise<void> {
  await page.goto(`./?bg=stone&${opts.query ?? 'seed=11'}`);
  await freshTitle(page);
  await page.locator(`#game-${opts.game ?? 'ninefold'}`).check({ force: true });
  await page.locator(`#mode-${opts.mode}`).check({ force: true });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'game');
}

/** Waits until the person at the screen may move, or the game is over. */
export async function ready(page: Page): Promise<GameState> {
  await page.waitForFunction(() => {
    const g = window.__ninefold.game;
    return g.state.result !== 'playing' || (!g.thinking && !g.computerToMove);
  });
  return state(page);
}

/** Plays one move by pointer. `pick` chooses among the legal panes. */
export async function playMove(page: Page, phone: boolean, pick: (n: number, s: GameState) => number = (n, s) => (s.history.length * 7 + 3) % n): Promise<boolean> {
  const s = await ready(page);
  if (s.result !== 'playing') return false;
  const legal = page.locator('.pane.legal');
  const n = await legal.count();
  expect(n).toBeGreaterThan(0);
  const pane = legal.nth(pick(n, s));
  const panel = await pane.getAttribute('data-panel');
  const index = await pane.getAttribute('data-pane');
  const target = page.locator(`.pane[data-panel="${panel}"][data-pane="${index}"]`);
  if (phone && s.panels.length > 1 && !(await page.locator('html.zoomed').count())) {
    // Whole-window view on a phone: the first tap zooms to the panel.
    await target.dispatchEvent('click');
    await expect(page.locator('html')).toHaveClass(/zoomed/);
    await page.waitForTimeout(500);
  }
  await target.click();
  await page.waitForFunction((len) => window.__ninefold.state().history.length > len, s.history.length);
  return true;
}

export async function playToEnd(page: Page, phone: boolean): Promise<GameState> {
  for (let i = 0; i < 81; i++) if (!(await playMove(page, phone))) break;
  const s = await state(page);
  expect(s.result).not.toBe('playing');
  return s;
}
