import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('JSON debug R1-S7', () => {
  test('export → reload → import menjaga row, tempo, dan history import mulai bersih', async ({ page }) => {
    await gotoApp(page);

    const exported = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const patternId = project.song.patterns[0].id;
      const trackId = project.song.tracks[0].id;
      window.tracker.commands.execute('pattern.enterNote', { patternId, trackId, row: 16, pitch: 67 });
      window.tracker.commands.execute('song.setTempo', { tempo: 144 });
      return window.tracker.commands.execute('io.exportDebugJson', { download: false });
    });

    expect(exported.filename.endsWith('.webtrack.json')).toBe(true);
    expect(JSON.parse(exported.text).song.initial.tempo).toBe(144);

    await page.reload();
    await gotoApp(page);
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);

    const imported = await page.evaluate((text) =>
      window.tracker.commands.execute('io.importDebugJson', { text }), exported.text);

    expect(imported.noteCount).toBe(1);
    expect(await page.evaluate(() => window.tracker.getProject().song.initial.tempo)).toBe(144);
    expect(await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes[0].startTickLocal)).toBe(1920);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(0);
    await expect(page.locator('[data-action="save-status"]')).toContainText('JSON dimuat');
  });

  test('command palette export menghasilkan download .webtrack.json', async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-action="palette-input"]');
    await input.fill('Export JSON debug');

    const row = page.locator('[data-action="palette-item"][data-entity="io.exportDebugJson"]');
    await expect(row).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await row.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.webtrack\.json$/);
  });

  test('import invalid tidak mengubah project aktif', async ({ page }) => {
    await gotoApp(page);
    const before = await page.evaluate(() => window.tracker.getProject());
    const result = await page.evaluate(() => {
      try {
        window.tracker.commands.execute('io.importDebugJson', { text: '{"schemaVersion":999}' });
        return null;
      } catch (error) {
        return error.code;
      }
    });
    expect(result).toBe('E_DEBUG_JSON_SCHEMA');
    expect(await page.evaluate(() => window.tracker.getProject())).toEqual(before);
  });
});
