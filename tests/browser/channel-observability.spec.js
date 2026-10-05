import { test, expect } from '@playwright/test';

import { waitForApp } from './helpers.js';

test.describe('channel observability UAT', () => {
  test('meter + Mute/Solo membuat channel 6-8 dapat diuji terpisah', async ({ page }, testInfo) => {
    await page.goto('./?demo=stability&uat=channels');
    await waitForApp(page);

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    const project = await page.evaluate(() => window.tracker.getProject());
    const tracks = project.song.tracks;
    expect(tracks).toHaveLength(8);

    await expect(page.locator('[data-action="track-meter"]')).toHaveCount(8);
    await expect(page.locator('[data-action="track-mute"]')).toHaveCount(8);
    await expect(page.locator('[data-action="track-solo"]')).toHaveCount(8);

    const solo6 = page.locator(`[data-action="track-solo"][data-track-id="${tracks[5].id}"]`);
    await solo6.click();
    await expect(solo6).toHaveAttribute('aria-pressed', 'true');

    let mix = await page.evaluate(() => window.tracker.getState().audio.trackMeters);
    expect(mix.find((item) => item.trackId === tracks[5].id).audible).toBe(true);
    expect(mix.filter((item) => item.trackId !== tracks[5].id).every((item) => !item.audible)).toBe(true);

    const mute6 = page.locator(`[data-action="track-mute"][data-track-id="${tracks[5].id}"]`);
    await mute6.click();
    mix = await page.evaluate(() => window.tracker.getState().audio.trackMeters);
    expect(mix.find((item) => item.trackId === tracks[5].id).audible).toBe(false);

    await mute6.click();
    await solo6.click();

    if (testInfo.project.name === 'chromium') {
      const heard = new Set();
      for (let i = 0; i < 100 && heard.size < 3; i += 1) {
        const states = await page.evaluate(() => window.tracker.getState().audio.trackMeters);
        for (const index of [5, 6, 7]) {
          if ((states.find((item) => item.trackId === tracks[index].id)?.level ?? 0) > 0.003) {
            heard.add(index);
          }
        }
        await page.waitForTimeout(50);
      }
      expect([...heard].sort()).toEqual([5, 6, 7]);
    }

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });

  test('playhead Pattern bergerak dan scroller mengikuti playback', async ({ page }) => {
    await page.goto('./?demo=stability&uat=follow');
    await waitForApp(page);

    const grid = page.locator('[data-action="pattern-grid"]');
    expect(await grid.evaluate((node) => node.scrollTop)).toBe(0);

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    const targetRow = 40;
    await page.evaluate((row) => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns[0];
      window.tracker.commands.execute('playback.seek', { tick: row * pattern.rowTicks });
    }, targetRow);

    await expect.poll(
      () => page.locator('.pattern-grid__row.is-playhead').getAttribute('data-row'),
      { timeout: 3000 },
    ).toBe(String(targetRow));

    await expect.poll(
      () => grid.evaluate((node) => node.scrollTop),
      { timeout: 3000 },
    ).toBeGreaterThan(0);

    const uiRow = Number(await page.locator('.pattern-grid__row.is-playhead').getAttribute('data-row'));
    expect(Math.abs(uiRow - targetRow)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });
});
