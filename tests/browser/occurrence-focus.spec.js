import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from './helpers.js';

const songEntries = (page) => page.locator('[data-action="song-entry"]');

test.describe('occurrence focus R3-S3', () => {
  test('Song focus menentukan Pattern yang diedit/diputar dan pulih setelah reload', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('tab', { name: 'Song' }).click();

    await songEntries(page).first().click();
    await songEntries(page).first().press('Control+d');
    await expect(songEntries(page)).toHaveCount(2);
    await songEntries(page).nth(1).press('Control+Shift+d');

    const arranged = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        order: project.song.order.map((entry) => ({
          id: entry.id,
          patternId: entry.patternId,
        })),
        historyDepth: window.tracker.getState().history.undoDepth,
        focus: window.tracker.getState().focus,
      };
    });

    expect(arranged.order).toHaveLength(2);
    expect(arranged.order[0].patternId).not.toBe(arranged.order[1].patternId);
    expect(arranged.focus.orderEntryId).toBe(arranged.order[1].id);

    // Fokus UI bukan data lagu dan tidak boleh membuat langkah Undo.
    await songEntries(page).first().click();
    await songEntries(page).nth(1).click();
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth))
      .toBe(arranged.historyDepth);

    await page.getByRole('tab', { name: 'Pattern' }).click();
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');

    const afterEdit = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const focus = window.tracker.getState().focus;
      return {
        focus,
        patternIds: project.song.order.map((entry) => entry.patternId),
        noteCounts: project.song.patterns.map((pattern) => ({
          id: pattern.id,
          count: pattern.notes.length,
        })),
      };
    });

    const firstCount = afterEdit.noteCounts.find(
      (item) => item.id === afterEdit.patternIds[0],
    )?.count;
    const secondCount = afterEdit.noteCounts.find(
      (item) => item.id === afterEdit.patternIds[1],
    )?.count;
    expect(firstCount).toBe(0);
    expect(secondCount).toBe(1);
    expect(afterEdit.focus.orderEntryId).toBe(arranged.order[1].id);

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.notesScheduled),
      { timeout: 5000 },
    ).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Berhenti' }).click();

    await page.reload();
    await waitForApp(page);
    expect(await page.evaluate(() => window.tracker.getState().focus.orderEntryId))
      .toBe(arranged.order[1].id);

    await page.getByRole('tab', { name: 'Song' }).click();
    await expect(songEntries(page).nth(1)).toHaveAttribute('aria-current', 'true');
  });
});
