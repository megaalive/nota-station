import { test, expect } from '@playwright/test';

import { waitForApp } from './helpers.js';

test.describe('stability demo', () => {
  test('query langsung memuat Malam Kota tanpa welcome dan tanpa menulis first-run', async ({ page }) => {
    await page.goto('./?demo=stability');
    await waitForApp(page);

    await expect(page.locator('[data-action="welcome-dialog"]')).toHaveCount(0);

    const result = await page.evaluate(() => ({
      project: window.tracker.getProject(),
      state: window.tracker.getState(),
      welcome: localStorage.getItem('notastation.welcome.completed'),
    }));

    expect(result.project.title).toBe('Malam Kota — Stability Loop');
    expect(result.project.song.initial.tempo).toBe(116);
    expect(result.project.song.initial.key).toBe('Am');
    expect(result.state.project.noteCount).toBeGreaterThanOrEqual(120);
    expect(new Set(result.project.song.patterns[0].notes.map((note) => note.trackId)).size).toBe(8);
    expect(result.welcome).toBeNull();
  });

  test('demo tetap bermain melewati dua putaran tanpa page error', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('./?demo=stability');
    await waitForApp(page);

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    const before = await page.evaluate(() => window.tracker.getState().audio);
    expect(before.schedulerActive).toBe(true);
    expect(before.loop).toBe(true);

    await page.waitForTimeout(18_000);

    const after = await page.evaluate(() => window.tracker.getState().audio);
    expect(after.state).toBe('playing');
    expect(after.schedulerActive).toBe(true);
    expect(after.loop).toBe(true);
    expect(after.scheduleRevision).toBe(before.scheduleRevision);
    expect(pageErrors).toEqual([]);

    await page.getByRole('button', { name: 'Berhenti' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('siap');
  });
});
