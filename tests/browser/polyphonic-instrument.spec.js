import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Polyphonic instrument track R3-S9B', () => {
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

  test('toggle P + Shift+note membuat chord voice-lane pada row yang sama', async ({ page }) => {
    const poly = page.locator('[data-action="track-polyphony"]').first();
    await expect(poly).toHaveAttribute('aria-pressed', 'false');
    await poly.click();
    await expect(poly).toHaveAttribute('aria-pressed', 'true');

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('Shift+z');
    await page.keyboard.press('Shift+c');

    const state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const notes = project.song.patterns[0].notes;
      return {
        track: project.song.tracks[0],
        notes: notes.map((note) => ({
          pitch: note.pitch,
          tick: note.startTickLocal,
          lane: note.voiceLane ?? 0,
        })),
        ui: window.tracker.getState().patternUi,
      };
    });

    expect(state.track.kind).toBe('instrument');
    expect(state.track.polyphony).toBe('poly');
    expect(state.notes).toEqual([
      { pitch: 60, tick: 0, lane: 0 },
      { pitch: 64, tick: 0, lane: 1 },
    ]);
    expect(state.ui.row).toBe(0);

    const noteCell = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"]',
    );
    await expect(noteCell).toContainText('C-4×2');
  });

  test('mode mono ditahan selama chord ada lalu Delete membersihkan seluruh row', async ({ page }) => {
    const poly = page.locator('[data-action="track-polyphony"]').first();
    await poly.click();

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('Shift+z');
    await page.keyboard.press('Shift+c');

    await poly.click();
    await expect(poly).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="pattern-hint"]')).toContainText(
      'Hapus voice tambahan',
    );

    await grid.focus();
    await page.keyboard.press('Delete');
    expect((await page.evaluate(() => window.tracker.getProject())).song.patterns[0].notes).toHaveLength(0);

    await poly.click();
    await expect(poly).toHaveAttribute('aria-pressed', 'false');
    expect((await page.evaluate(() => window.tracker.getProject())).song.tracks[0].polyphony).toBe('mono');
  });
});
