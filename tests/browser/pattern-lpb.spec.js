import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

async function seedOffGrid(page, tick) {
  return page.evaluate((targetTick) => {
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
    pattern.notes[0].startTickLocal = targetTick;
    const noteId = pattern.notes[0].id;
    window.tracker.commands.execute('io.importDebugJson', {
      text: JSON.stringify(next),
    });
    return { patternId, trackId, noteId };
  }, tick);
}

test.describe('Pattern LPB + quantize R3-S7B', () => {
  test('Cocokkan LPB mengubah proyeksi tanpa mengubah tick kanonik', async ({ page }) => {
    await gotoApp(page);
    await seedOffGrid(page, 160);

    const note = page.locator(
      '[data-action="pattern-cell"][data-row="1"][data-channel="0"][data-field="note"]',
    );
    await note.click();
    await expect(note).toHaveText('C-4⌁');
    await expect(page.locator('[data-action="pattern-lpb"]')).toHaveValue('4');

    await page.getByRole('button', { name: 'Cocokkan LPB' }).click();

    await expect(page.locator('[data-action="pattern-lpb"]')).toHaveValue('6');
    await expect(page.locator('[data-action="pattern-grid"]')).toHaveAttribute('aria-rowcount', '96');
    await expect(page.locator('.pattern-grid__field-header--delay')).toHaveCount(0);
    await expect(
      page.locator('[data-action="pattern-cell"][data-row="2"][data-channel="0"][data-field="note"]'),
    ).toHaveText('C-4');

    const state = await page.evaluate(() => ({
      tick: window.tracker.getProject().song.patterns[0].notes[0].startTickLocal,
      ui: window.tracker.getState().patternUi,
    }));
    expect(state.tick).toBe(160);
    expect(state.ui).toMatchObject({
      row: 2,
      displayLpb: 6,
      displayRowTicks: 80,
      projectionOnly: true,
    });

    await page.locator('[data-action="pattern-grid"]').focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');
    await expect(page.locator('[data-action="pattern-hint"]')).toContainText('proyeksi');
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].notes[0].startTickLocal,
    )).toBe(160);
  });

  test('Kuantisasi cell memindahkan timing eksplisit dan Undo memulihkan off-grid', async ({ page }) => {
    await gotoApp(page);
    await seedOffGrid(page, 143);

    await page.locator(
      '[data-action="pattern-cell"][data-row="1"][data-channel="0"][data-field="note"]',
    ).click();

    const depth = await page.evaluate(() => window.tracker.getState().history.undoDepth);
    await page.getByRole('button', { name: 'Kuantisasi' }).click();

    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].notes[0].startTickLocal,
    )).toBe(120);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(depth + 1);
    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.quantizeCell');
    await expect(page.locator('.pattern-grid__field-header--delay')).toHaveCount(0);

    await page.evaluate(() => window.tracker.commands.execute('history.undo'));
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].notes[0].startTickLocal,
    )).toBe(143);
    await expect(page.locator('.pattern-grid__field-header--delay')).toHaveCount(8);
  });

  test('quantize shared Pattern + Jadikan unik hanya mengubah occurrence fokus', async ({ page }) => {
    await gotoApp(page);
    const seeded = await seedOffGrid(page, 143);

    const order = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const first = project.song.order[0].id;
      const reused = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: first,
      });
      window.tracker.commands.execute('focus.setOrderEntry', {
        orderEntryId: reused.orderEntryId,
      });
      return { first, second: reused.orderEntryId };
    });

    await page.getByRole('tab', { name: 'Pattern' }).click();
    await page.locator(
      '[data-action="pattern-cell"][data-row="1"][data-channel="0"][data-field="note"]',
    ).click();
    await page.getByRole('button', { name: 'Kuantisasi' }).click();

    await expect(page.locator('[data-action="pattern-shared-warning"]')).toBeVisible();
    await page.getByRole('button', { name: 'Jadikan unik untuk tempat ini' }).click();

    const result = await page.evaluate(({ first, second }) => {
      const project = window.tracker.getProject();
      const entries = new Map(project.song.order.map((entry) => [entry.id, entry]));
      const firstPattern = project.song.patterns.find(
        (pattern) => pattern.id === entries.get(first).patternId,
      );
      const secondPattern = project.song.patterns.find(
        (pattern) => pattern.id === entries.get(second).patternId,
      );
      return {
        samePattern: firstPattern.id === secondPattern.id,
        firstTick: firstPattern.notes[0].startTickLocal,
        secondTick: secondPattern.notes[0].startTickLocal,
        focus: window.tracker.getState().focus.orderEntryId,
      };
    }, order);

    expect(result).toEqual({
      samePattern: false,
      firstTick: 143,
      secondTick: 120,
      focus: order.second,
    });
    expect(seeded.noteId).toBeTruthy();
  });

  test('selector LPB manual hanya mengubah proyeksi dan dapat kembali ke default', async ({ page }) => {
    await gotoApp(page);
    await seedOffGrid(page, 143);

    const select = page.locator('[data-action="pattern-lpb"]');
    await select.selectOption('12');
    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
      displayLpb: 12,
      displayRowTicks: 40,
      projectionOnly: true,
    });
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].notes[0].startTickLocal,
    )).toBe(143);

    await select.selectOption('4');
    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
      displayLpb: 4,
      displayRowTicks: 120,
      projectionOnly: false,
    });
  });
});
