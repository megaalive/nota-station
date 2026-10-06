import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Pattern off-grid DLY R3-S7A', () => {
  test('note off-grid tetap terlihat dengan marker dan offset tanpa kuantisasi', async ({ page }) => {
    await gotoApp(page);

    const originalTick = await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
      const project = window.tracker.getProject();
      const patternId = project.song.order[0].patternId;
      const trackId = project.song.tracks[0].id;

      window.tracker.commands.execute('pattern.enterNote', {
        patternId,
        trackId,
        row: 1,
        pitch: 60,
        velocity: 90,
      });

      const next = window.tracker.getProject();
      const pattern = next.song.patterns.find((item) => item.id === patternId);
      pattern.notes[0].startTickLocal += 23;
      const tick = pattern.notes[0].startTickLocal;

      window.tracker.commands.execute('io.importDebugJson', {
        text: JSON.stringify(next),
      });
      return tick;
    });

    expect(originalTick).toBe(143);

    const grid = page.locator('[data-action="pattern-grid"]');
    await expect(grid).toHaveAttribute('aria-colcount', '32');
    await expect(page.locator('.pattern-grid__field-header--delay')).toHaveCount(8);

    const note = page.locator(
      '[data-action="pattern-cell"][data-row="1"][data-channel="0"][data-field="note"]',
    );
    const delay = page.locator(
      '[data-action="pattern-cell"][data-row="1"][data-channel="0"][data-field="delay"]',
    );

    await expect(note).toHaveText('C-4⌁');
    await expect(delay).toHaveText('+23t');
    await expect(note).toHaveAttribute('title', /\+23t/);

    expect(await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find(
        (item) => item.id === window.tracker.getState().project.patternId,
      );
      return pattern.notes[0].startTickLocal;
    })).toBe(143);
  });

  test('edit sel off-grid ditahan agar tidak membuat note grid kedua', async ({ page }) => {
    await gotoApp(page);

    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
      const project = window.tracker.getProject();
      const patternId = project.song.order[0].patternId;
      const trackId = project.song.tracks[0].id;
      window.tracker.commands.execute('pattern.enterNote', {
        patternId,
        trackId,
        row: 1,
        pitch: 60,
      });

      const next = window.tracker.getProject();
      const pattern = next.song.patterns.find((item) => item.id === patternId);
      pattern.notes[0].startTickLocal += 23;
      window.tracker.commands.execute('io.importDebugJson', {
        text: JSON.stringify(next),
      });
    });

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('ArrowDown');

    const before = await page.evaluate(() => ({
      depth: window.tracker.getState().history.undoDepth,
      notes: window.tracker.getProject().song.patterns[0].notes.map((note) => ({
        id: note.id,
        tick: note.startTickLocal,
        pitch: note.pitch,
      })),
    }));

    await page.keyboard.press('z');
    await expect(page.locator('[data-action="pattern-hint"]')).toContainText('off-grid');

    let after = await page.evaluate(() => ({
      depth: window.tracker.getState().history.undoDepth,
      notes: window.tracker.getProject().song.patterns[0].notes.map((note) => ({
        id: note.id,
        tick: note.startTickLocal,
        pitch: note.pitch,
      })),
    }));
    expect(after).toEqual(before);

    await page.keyboard.press('Delete');
    after = await page.evaluate(() => ({
      depth: window.tracker.getState().history.undoDepth,
      notes: window.tracker.getProject().song.patterns[0].notes.map((note) => ({
        id: note.id,
        tick: note.startTickLocal,
        pitch: note.pitch,
      })),
    }));
    expect(after).toEqual(before);
  });

  test('Pattern aligned tetap tiga kolom tanpa DLY', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
    });

    await expect(page.locator('[data-action="pattern-grid"]')).toHaveAttribute('aria-colcount', '24');
    await expect(page.locator('.pattern-grid__field-header--delay')).toHaveCount(0);
  });
});
