import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from './helpers.js';

test.describe('R1 automated exit', () => {
  test('T1 mesin: first-run Pop 4/4 sampai playback siap <= 3 detik', async ({ page }) => {
    const started = Date.now();

    await page.goto('./');
    await waitForApp(page);
    await expect(page.locator('[data-action="welcome-dialog"]')).toBeVisible();
    await page.locator('[data-action="welcome-start"]').click();

    await expect(page.locator('[data-action="welcome-dialog"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 3000 });

    const elapsedMs = Date.now() - started;
    expect(elapsedMs).toBeLessThanOrEqual(3000);
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(18);

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });

  test('jalur exit R1: 16 note -> play -> tempo live -> stop -> undo -> JSON reload/import', async ({ page }) => {
    await gotoApp(page);

    const setup = await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
      const project = window.tracker.getProject();
      const patternId = project.song.patterns[0].id;
      for (let row = 0; row < 16; row += 1) {
        window.tracker.commands.execute('pattern.enterNote', {
          patternId,
          trackId: project.song.tracks[row % 3].id,
          row,
          pitch: 48 + (row % 12),
        });
      }
      return window.tracker.getState().project.noteCount;
    });
    expect(setup).toBe(16);

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    const revisionBefore = await page.evaluate(() => window.tracker.getState().audio.scheduleRevision);
    const tempo = page.locator('[data-action="tempo-input"]');
    await tempo.fill('180');
    await tempo.press('Tab');

    let audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.state).toBe('playing');
    expect(audio.tempo).toBe(180);
    expect(audio.scheduleRevision).toBeGreaterThan(revisionBefore);

    await page.getByRole('button', { name: 'Berhenti' }).click();
    audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.positionTick).toBe(0);

    const editResult = await page.evaluate(() => {
      const project = window.tracker.getProject();
      window.tracker.commands.execute('pattern.deleteNote', {
        patternId: project.song.patterns[0].id,
        trackId: project.song.tracks[0].id,
        row: 0,
      });
      const afterDelete = window.tracker.getState().project.noteCount;
      window.tracker.commands.execute('history.undo');
      return {
        afterDelete,
        afterUndo: window.tracker.getState().project.noteCount,
      };
    });
    expect(editResult.afterDelete).toBe(15);
    expect(editResult.afterUndo).toBe(16);

    const exported = await page.evaluate(() =>
      window.tracker.commands.execute('io.exportDebugJson', { download: false }));
    const expected = JSON.parse(exported.text);
    expect(expected.song.initial.tempo).toBe(180);
    expect(expected.song.patterns[0].notes).toHaveLength(16);

    await page.reload();
    await waitForApp(page);
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);

    await page.evaluate((text) =>
      window.tracker.commands.execute('io.importDebugJson', { text }), exported.text);

    expect(await page.evaluate(() => window.tracker.getProject())).toEqual(expected);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(0);

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });
    await page.getByRole('button', { name: 'Berhenti' }).click();
  });
});
