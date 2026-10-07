import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Kapasitas 32 channel R3-S9A', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
    });
  });

  test('Tambah channel adalah satu transaksi history dan Undo/Redo menyinkronkan UI', async ({ page }) => {
    const add = page.locator('[data-action="pattern-add-channel"]');
    await expect(add).toBeEnabled();

    await add.click();
    expect((await page.evaluate(() => window.tracker.getProject())).song.tracks).toHaveLength(9);
    await expect(page.locator('.pattern-grid__channel')).toHaveCount(9);

    await page.evaluate(() => window.tracker.commands.execute('history.undo'));
    expect((await page.evaluate(() => window.tracker.getProject())).song.tracks).toHaveLength(8);
    await expect(page.locator('.pattern-grid__channel')).toHaveCount(8);

    await page.evaluate(() => window.tracker.commands.execute('history.redo'));
    expect((await page.evaluate(() => window.tracker.getProject())).song.tracks).toHaveLength(9);
    await expect(page.locator('.pattern-grid__channel')).toHaveCount(9);
  });

  test('32 channel tetap dapat dicapai dan diedit lewat keyboard dengan render windowed', async ({ page }) => {
    const result = await page.evaluate(() => {
      while (window.tracker.getProject().song.tracks.length < 32) {
        window.tracker.commands.execute('song.addTrack');
      }
      return {
        trackCount: window.tracker.getProject().song.tracks.length,
        history: window.tracker.getState().history,
      };
    });

    expect(result.trackCount).toBe(32);
    await expect(page.locator('.pattern-grid__channel')).toHaveCount(32);
    await expect(page.locator('[data-action="pattern-add-channel"]')).toBeDisabled();

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();

    const uiResult = await page.evaluate(() => {
      const gridNode = document.querySelector('[data-action="pattern-grid"]');
      const dispatch = (code, options = {}) => gridNode.dispatchEvent(new KeyboardEvent('keydown', {
        code,
        key: options.key ?? '',
        ctrlKey: Boolean(options.ctrlKey),
        bubbles: true,
        cancelable: true,
      }));

      dispatch('KeyE', { ctrlKey: true });
      for (let index = 0; index < 31 * 3; index += 1) dispatch('ArrowRight');

      const before = window.tracker.getState().patternUi;
      const started = performance.now();
      dispatch('KeyZ', { key: 'z' });
      const elapsedMs = performance.now() - started;
      const after = window.tracker.getState();

      return {
        before,
        elapsedMs,
        noteCount: after.project.noteCount,
        afterUi: after.patternUi,
        rowNodes: document.querySelectorAll('.pattern-grid__row').length,
        scrollLeft: gridNode.scrollLeft,
      };
    });

    expect(uiResult.before.channel).toBe(31);
    expect(uiResult.before.field).toBe('note');
    expect(uiResult.noteCount).toBe(1);
    expect(uiResult.afterUi.channel).toBe(31);
    expect(uiResult.afterUi.row).toBe(1);
    expect(uiResult.scrollLeft).toBeGreaterThan(0);
    expect(uiResult.rowNodes).toBeLessThan(64);
    expect(uiResult.elapsedMs).toBeLessThan(50);

    const project = await page.evaluate(() => window.tracker.getProject());
    expect(project.song.patterns[0].notes[0].trackId).toBe(project.song.tracks[31].id);
  });

  test('command menolak channel ke-33 secara fail-closed', async ({ page }) => {
    const result = await page.evaluate(() => {
      while (window.tracker.getProject().song.tracks.length < 32) {
        window.tracker.commands.execute('song.addTrack');
      }
      try {
        window.tracker.commands.execute('song.addTrack');
        return { code: null, count: window.tracker.getProject().song.tracks.length };
      } catch (error) {
        return { code: error.code, count: window.tracker.getProject().song.tracks.length };
      }
    });

    expect(result).toEqual({ code: 'E_PROJECT_TRACK_LIMIT', count: 32 });
  });
});
