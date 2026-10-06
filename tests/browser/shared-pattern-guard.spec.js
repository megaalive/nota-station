import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from './helpers.js';

async function makeSharedOccurrence(page) {
  return page.evaluate(() => {
    const project = window.tracker.getProject();
    const firstOrderId = project.song.order[0].id;
    const sharedPatternId = project.song.order[0].patternId;
    const second = window.tracker.commands.execute('song.reuseOrderEntry', {
      orderEntryId: firstOrderId,
    });
    window.tracker.commands.execute('focus.setOrderEntry', {
      orderEntryId: second.orderEntryId,
    });
    return {
      firstOrderId,
      secondOrderId: second.orderEntryId,
      sharedPatternId,
      undoDepth: window.tracker.getState().history.undoDepth,
    };
  });
}

async function openPatternEdit(page) {
  await page.getByRole('tab', { name: 'Pattern' }).click();
  const grid = page.locator('[data-action="pattern-grid"]');
  await grid.focus();
  await page.keyboard.press('Control+e');
  await expect(page.locator('[data-action="pattern-mode"]')).toHaveText('EDIT');
  return grid;
}

test.describe('shared Pattern guard R3-S4C', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('edit pertama diblokir; Edit semua menjalankan edit tertunda dan diingat setelah reload', async ({ page }) => {
    const setup = await makeSharedOccurrence(page);
    await openPatternEdit(page);

    await page.keyboard.press('z');

    const warning = page.locator('[data-action="pattern-shared-warning"]');
    await expect(warning).toBeVisible();
    await expect(page.locator('[data-action="pattern-shared-message"]'))
      .toContainText('dipakai di 2 tempat');

    let state = await page.evaluate(() => ({
      noteCount: window.tracker.getProject().song.patterns[0].notes.length,
      undoDepth: window.tracker.getState().history.undoDepth,
      guard: window.tracker.getState().sharedPatternGuard,
    }));
    expect(state.noteCount).toBe(0);
    expect(state.undoDepth).toBe(setup.undoDepth);
    expect(state.guard.allowedPatternIds).toEqual([]);

    await page.locator('[data-action="pattern-shared-edit-all"]').click();
    await expect(warning).not.toBeVisible();

    state = await page.evaluate(() => ({
      project: window.tracker.getProject(),
      history: window.tracker.getState().history,
      guard: window.tracker.getState().sharedPatternGuard,
    }));
    expect(state.project.song.patterns).toHaveLength(1);
    expect(state.project.song.patterns[0].notes).toHaveLength(1);
    expect(state.history.undoLabel).toBe('pattern.enterNote');
    expect(state.guard.allowedPatternIds).toEqual([setup.sharedPatternId]);

    // Keputusan yang sama berlaku pada edit berikutnya dalam sesi.
    await page.keyboard.press('x');
    await expect(warning).not.toBeVisible();
    expect(await page.evaluate(() =>
      window.tracker.getProject().song.patterns[0].notes.length)).toBe(2);

    // Keputusan "Edit semua" dan occurrence focus dipulihkan setelah reload.
    await page.reload();
    await waitForApp(page);
    const restored = await page.evaluate(() => ({
      focus: window.tracker.getState().focus,
      guard: window.tracker.getState().sharedPatternGuard,
      project: window.tracker.getProject(),
    }));
    expect(restored.focus.orderEntryId).toBe(setup.secondOrderId);
    expect(restored.guard.allowedPatternIds).toEqual([setup.sharedPatternId]);

    const directEdit = await page.evaluate(() => {
      const stateNow = window.tracker.getState();
      const projectNow = window.tracker.getProject();
      const patternId = stateNow.project.patternId;
      const trackId = projectNow.song.tracks[0].id;
      return window.tracker.commands.execute('pattern.enterNote', {
        patternId,
        trackId,
        row: 2,
        pitch: 64,
      });
    });
    expect(directEdit.noteCount).toBe(3);
  });

  test('Jadikan unik meng-clone occurrence fokus lalu menerapkan edit tertunda ke clone', async ({ page }) => {
    const setup = await makeSharedOccurrence(page);
    await openPatternEdit(page);

    await page.keyboard.press('z');
    const warning = page.locator('[data-action="pattern-shared-warning"]');
    await expect(warning).toBeVisible();

    await page.locator('[data-action="pattern-shared-make-unique"]').click();
    await expect(warning).not.toBeVisible();

    const state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const first = project.song.order[0];
      const second = project.song.order[1];
      const firstPattern = project.song.patterns.find((pattern) => pattern.id === first.patternId);
      const secondPattern = project.song.patterns.find((pattern) => pattern.id === second.patternId);
      return {
        patternCount: project.song.patterns.length,
        firstPatternId: first.patternId,
        secondPatternId: second.patternId,
        firstNotes: firstPattern.notes.length,
        secondNotes: secondPattern.notes.length,
        secondPitch: secondPattern.notes[0]?.pitch ?? null,
        focus: window.tracker.getState().focus,
        guard: window.tracker.getState().sharedPatternGuard,
      };
    });

    expect(state.patternCount).toBe(2);
    expect(state.firstPatternId).toBe(setup.sharedPatternId);
    expect(state.secondPatternId).not.toBe(setup.sharedPatternId);
    expect(state.firstNotes).toBe(0);
    expect(state.secondNotes).toBe(1);
    expect(state.secondPitch).toBe(60);
    expect(state.focus.orderEntryId).toBe(setup.secondOrderId);
    expect(state.guard.allowedPatternIds).toEqual([]);
    await expect(page.locator('[data-action="pattern-shared-badge"]')).not.toBeVisible();
  });

  test('Escape menutup warning non-modal tanpa mutasi; percobaan edit berikutnya membuka lagi', async ({ page }) => {
    const setup = await makeSharedOccurrence(page);
    await openPatternEdit(page);

    await page.keyboard.press('z');
    const warning = page.locator('[data-action="pattern-shared-warning"]');
    await expect(warning).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(warning).not.toBeVisible();
    expect(await page.evaluate(() =>
      window.tracker.getProject().song.patterns[0].notes.length)).toBe(0);
    expect(await page.evaluate(() =>
      window.tracker.getState().history.undoDepth)).toBe(setup.undoDepth);

    await page.keyboard.press('z');
    await expect(warning).toBeVisible();
    expect(await page.evaluate(() =>
      window.tracker.getProject().song.patterns[0].notes.length)).toBe(0);
  });
});
