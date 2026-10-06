import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

const entries = (page) => page.locator('[data-action="song-entry"]');

test.describe('Song workspace R3-S2', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('tab', { name: 'Song' }).click();
  });

  test('Song Map dan Order List memproyeksikan urutan yang sama', async ({ page }) => {
    const workspace = page.locator('[data-action="song-workspace"]');
    await expect(workspace).toBeVisible();
    await expect(page.locator('[data-action="song-view-map"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(entries(page)).toHaveCount(1);

    const map = await entries(page).evaluateAll((nodes) => nodes.map((node) => ({
      id: node.dataset.entity,
      text: node.textContent,
    })));

    await page.locator('[data-action="song-view-order"]').click();
    await expect(page.locator('[data-action="song-view-order"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(entries(page)).toHaveCount(1);

    const order = await entries(page).evaluateAll((nodes) => nodes.map((node) => ({
      id: node.dataset.entity,
      text: node.textContent,
    })));
    expect(order).toEqual(map);
  });

  test('preset OpenMPT-like membuka Order List sebagai pintu awal Song', async ({ page }) => {
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'openmpt',
      });
    });

    await expect(page.locator('[data-action="song-view-order"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="song-order-list"]')).toBeVisible();
    await expect(entries(page)).toHaveCount(1);
  });

  test('Section mengelompokkan Song Map tanpa mengubah urutan Order dan dapat di-Undo', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const firstOrderId = project.song.order[0].id;
      const second = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: firstOrderId,
      });
      const third = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: second.orderEntryId,
      });
      const verse = window.tracker.commands.execute('song.addSection', {
        name: 'Verse',
        color: '#2563EB',
      });
      const chorus = window.tracker.commands.execute('song.addSection', {
        name: 'Chorus',
        color: '#7C3AED',
      });
      window.tracker.commands.execute('song.assignSection', {
        orderEntryId: firstOrderId,
        sectionId: verse.id,
      });
      window.tracker.commands.execute('song.assignSection', {
        orderEntryId: second.orderEntryId,
        sectionId: verse.id,
      });
      window.tracker.commands.execute('song.assignSection', {
        orderEntryId: third.orderEntryId,
        sectionId: chorus.id,
      });
      return {
        orderIds: window.tracker.getProject().song.order.map((entry) => entry.id),
        secondOrderId: second.orderEntryId,
        verseId: verse.id,
        chorusId: chorus.id,
      };
    });

    const sections = page.locator('[data-action="song-section"]');
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(0)).toContainText('Verse');
    await expect(sections.nth(1)).toContainText('Chorus');

    const mapIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(mapIds).toEqual(ids.orderIds);

    await page.locator('[data-action="song-view-order"]').click();
    const listIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(listIds).toEqual(ids.orderIds);
    await expect(entries(page).nth(0)).toContainText('Verse');
    await expect(entries(page).nth(2)).toContainText('Chorus');

    await page.keyboard.press('Control+z');
    expect(await page.evaluate((orderEntryId) => {
      const entry = window.tracker.getProject().song.order.find((item) => item.id === orderEntryId);
      return entry.sectionId;
    }, ids.orderIds[2])).toBeNull();
  });

  test('Ctrl+D reuse lalu Ctrl+Shift+D membuat occurrence target unik', async ({ page }) => {
    const first = entries(page).first();
    await first.click();
    await first.press('Control+d');

    await expect(entries(page)).toHaveCount(2);
    let state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        order: project.song.order.map((entry) => ({ id: entry.id, patternId: entry.patternId })),
        patterns: project.song.patterns.map((pattern) => pattern.id),
        history: window.tracker.getState().history,
      };
    });

    expect(state.order).toHaveLength(2);
    expect(state.patterns).toHaveLength(1);
    expect(state.order[0].patternId).toBe(state.order[1].patternId);
    expect(state.history.undoLabel).toBe('song.reuseOrderEntry');

    await expect(entries(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await entries(page).nth(1).press('Control+Shift+d');

    state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        order: project.song.order.map((entry) => ({ id: entry.id, patternId: entry.patternId })),
        patterns: project.song.patterns.map((pattern) => pattern.id),
        history: window.tracker.getState().history,
      };
    });

    expect(state.patterns).toHaveLength(2);
    expect(state.order[0].patternId).not.toBe(state.order[1].patternId);
    expect(state.history.undoLabel).toBe('song.makeOrderUnique');
    await expect(entries(page).nth(0)).not.toContainText('×2');
    await expect(entries(page).nth(1)).not.toContainText('×2');

    // Pastikan Undo tetap satu gestur untuk "Jadikan unik".
    await page.keyboard.press('Control+z');
    expect((await page.evaluate(() => window.tracker.getProject().song.patterns.length))).toBe(1);
    expect((await page.evaluate(() => window.tracker.getProject().song.order.length))).toBe(2);
  });

  test('Alt+Arrow memindahkan occurrence dan Map/List tetap satu urutan', async ({ page }) => {
    await entries(page).first().click();
    await entries(page).first().press('Control+d');

    const before = await page.evaluate(() =>
      window.tracker.getProject().song.order.map((entry) => entry.id));
    expect(before).toHaveLength(2);

    await entries(page).nth(1).press('Alt+ArrowUp');

    const moved = await page.evaluate(() =>
      window.tracker.getProject().song.order.map((entry) => entry.id));
    expect(moved).toEqual([before[1], before[0]]);

    const mapIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(mapIds).toEqual(moved);

    await page.locator('[data-action="song-view-order"]').click();
    const listIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(listIds).toEqual(moved);
  });
});
