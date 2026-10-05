import { test, expect } from '@playwright/test';

import { waitForApp } from './helpers.js';

test.describe('sustain demo UAT', () => {
  test('project menyimpan duration panjang dan Harmony tetap bersuara di tengah sustain', async ({ page }, testInfo) => {
    await page.goto('./?demo=stability&uat=sustain');
    await waitForApp(page);

    const shape = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns[0];
      const rowTicks = pattern.rowTicks;
      const durations = {};
      for (const note of pattern.notes) {
        const key = note.instrumentId;
        durations[key] ??= [];
        durations[key].push(note.durationTicks / rowTicks);
      }
      return { durations, tracks: project.song.tracks };
    });

    expect(new Set(shape.durations['demo.bass'])).toEqual(new Set([4]));
    expect(new Set(shape.durations['demo.lead'])).toEqual(new Set([8]));
    expect(new Set(shape.durations['demo.harmony'])).toEqual(new Set([16]));
    expect(new Set(shape.durations['demo.arp'])).toEqual(new Set([1]));

    const harmonyTrack = shape.tracks[6];
    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    const solo = page.locator(
      `[data-action="track-solo"][data-track-id="${harmonyTrack.id}"]`
    );
    await solo.click();
    await expect(solo).toHaveAttribute('aria-pressed', 'true');

    if (testInfo.project.name === 'chromium') {
      // Harmony note pertama tahan satu bar (~2,07 dtk). Sampling dimulai jauh
      // setelah transient note-on; meter harus tetap hidup karena sustain.
      await page.waitForTimeout(700);
      let sustainedSamples = 0;
      for (let i = 0; i < 16; i += 1) {
        const level = await page.evaluate((trackId) => {
          const item = window.tracker.getState().audio.trackMeters
            .find((entry) => entry.trackId === trackId);
          return item?.level ?? 0;
        }, harmonyTrack.id);
        if (level > 0.003) sustainedSamples += 1;
        await page.waitForTimeout(50);
      }
      expect(sustainedSamples).toBeGreaterThanOrEqual(10);
    }

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });
});
