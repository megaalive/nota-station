import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

async function playSeekPause(page, row) {
  await page.getByRole('button', { name: 'Putar' }).click();
  await expect.poll(
    () => page.evaluate(() => window.tracker.getState().audio.state),
    { timeout: 5000 },
  ).toBe('playing');

  return page.evaluate((targetRow) => {
    const project = window.tracker.getProject();
    const pattern = project.song.patterns[0];

    window.tracker.commands.execute('playback.seek', {
      tick: targetRow * pattern.rowTicks,
    });
    window.tracker.commands.execute('playback.pause');

    const grid = document.querySelector('[data-action="pattern-grid"]');
    const playhead = grid.querySelector('.pattern-grid__row.is-playhead');
    return {
      scrollTop: grid.scrollTop,
      maxScrollTop: Math.max(0, grid.scrollHeight - grid.clientHeight),
      playheadRow: Number(playhead?.dataset.row ?? -1),
    };
  }, row);
}

test.describe('Pattern playhead follow tiga fase', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 760 });
    await gotoApp(page);
  });

  test('awal turun, tengah center-follow, akhir turun lagi', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await expect(grid).toBeVisible();

    const start = await playSeekPause(page, 2);
    expect(start.playheadRow).toBe(2);
    expect(start.scrollTop).toBe(0);

    const middle = await playSeekPause(page, 32);
    expect(middle.playheadRow).toBe(32);
    expect(middle.scrollTop).toBeGreaterThan(0);
    expect(middle.scrollTop).toBeLessThan(middle.maxScrollTop);

    const middleNext = await playSeekPause(page, 33);
    expect(middleNext.playheadRow).toBe(33);
    expect(middleNext.scrollTop).toBeGreaterThan(middle.scrollTop);

    const end = await playSeekPause(page, 63);
    expect(end.playheadRow).toBe(63);
    expect(Math.abs(end.scrollTop - end.maxScrollTop)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });
});
