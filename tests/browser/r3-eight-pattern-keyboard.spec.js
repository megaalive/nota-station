import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

const entries = (page) => page.locator('[data-action="song-entry"]');

test('R3 exit: 8 Pattern dapat disusun dengan keyboard tanpa mouse', async ({ page }) => {
  await gotoApp(page);

  const seeded = await page.evaluate(() => {
    window.tracker.commands.execute('project.loadTemplate', {
      templateId: 'blank',
      locale: 'id',
      keymap: 'songwriter',
    });

    const first = window.tracker.getProject().song.order[0];
    const sourcePatternId = first.patternId;
    let lastOrderEntryId = first.id;

    for (let index = 1; index < 8; index += 1) {
      const result = window.tracker.commands.execute('song.createSectionOccurrence', {
        name: `Bagian ${index + 1}`,
        patternMode: 'clone',
        sourcePatternId,
        afterOrderEntryId: lastOrderEntryId,
      });
      lastOrderEntryId = result.orderEntryId;
    }

    const project = window.tracker.getProject();
    return {
      orderIds: project.song.order.map((entry) => entry.id),
      patternIds: project.song.patterns.map((pattern) => pattern.id),
    };
  });

  expect(seeded.orderIds).toHaveLength(8);
  expect(seeded.patternIds).toHaveLength(8);

  // Pindah ke Song workspace dengan shortcut global, bukan klik tab.
  await page.keyboard.press('Alt+1');
  const surface = page.locator('[data-action="song-map"]');
  await expect(surface).toBeVisible();
  await expect(entries(page)).toHaveCount(8);
  await surface.focus();

  // Navigasi dari occurrence pertama ke kedelapan.
  for (let index = 0; index < 7; index += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await expect(entries(page).nth(7)).toHaveAttribute('aria-current', 'true');

  // Reorder occurrence kedelapan satu posisi ke kiri.
  await page.keyboard.press('Alt+ArrowLeft');
  let state = await page.evaluate(() => ({
    order: window.tracker.getProject().song.order.map((entry) => ({
      id: entry.id,
      patternId: entry.patternId,
    })),
    patterns: window.tracker.getProject().song.patterns.map((pattern) => pattern.id),
    focus: window.tracker.getState().focus,
  }));

  expect(state.order).toHaveLength(8);
  expect(state.patterns).toHaveLength(8);
  expect(state.order[6].id).toBe(seeded.orderIds[7]);
  expect(state.order[7].id).toBe(seeded.orderIds[6]);
  expect(state.focus.orderEntryId).toBe(seeded.orderIds[7]);

  const reusedPatternId = state.order[6].patternId;

  // Reuse occurrence terpilih dengan keyboard.
  await page.keyboard.press('Control+d');
  await expect(entries(page)).toHaveCount(9);
  state = await page.evaluate(() => ({
    order: window.tracker.getProject().song.order.map((entry) => ({
      id: entry.id,
      patternId: entry.patternId,
    })),
    patterns: window.tracker.getProject().song.patterns.map((pattern) => pattern.id),
    history: window.tracker.getState().history,
    focus: window.tracker.getState().focus,
  }));

  expect(state.order).toHaveLength(9);
  expect(state.patterns).toHaveLength(8);
  expect(state.history.undoLabel).toBe('song.reuseOrderEntry');
  expect(state.focus.orderEntryId).toBe(state.order[7].id);
  expect(state.order[7].patternId).toBe(reusedPatternId);

  // Jadikan occurrence reuse unik, masih tanpa mouse.
  await page.keyboard.press('Control+Shift+d');
  state = await page.evaluate(() => ({
    order: window.tracker.getProject().song.order.map((entry) => ({
      id: entry.id,
      patternId: entry.patternId,
    })),
    patterns: window.tracker.getProject().song.patterns.map((pattern) => pattern.id),
    history: window.tracker.getState().history,
    focus: window.tracker.getState().focus,
  }));

  expect(state.order).toHaveLength(9);
  expect(state.patterns).toHaveLength(9);
  expect(state.history.undoLabel).toBe('song.makeOrderUnique');
  expect(state.focus.orderEntryId).toBe(state.order[7].id);
  expect(state.order[7].patternId).not.toBe(reusedPatternId);

  // Keyboard focus tetap berada pada occurrence target setelah rangkaian operasi.
  await expect(entries(page).nth(7)).toHaveAttribute('aria-current', 'true');
});
