import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

async function loadBlank(page) {
  return page.evaluate(() => {
    window.tracker.commands.execute('project.loadTemplate', {
      templateId: 'blank',
      locale: 'id',
      keymap: 'songwriter',
    });
    const project = window.tracker.getProject();
    return {
      patternId: project.song.order[0].patternId,
      trackId: project.song.tracks[0].id,
      orderEntryId: project.song.order[0].id,
    };
  });
}

const fxCell = (page, row = 0, channel = 0) => page.locator(
  `[data-action="pattern-cell"][data-row="${row}"][data-channel="${channel}"][data-field="effect"]`,
);
const paramCell = (page, row = 0, channel = 0) => page.locator(
  `[data-action="pattern-cell"][data-row="${row}"][data-channel="${channel}"][data-field="param"]`,
);

test.describe('Pattern FX | PARAM R3-S8C', () => {
  test('FX columns tersembunyi sampai diminta lalu editor typed menambah update dan delete effect', async ({ page }) => {
    await gotoApp(page);
    await loadBlank(page);

    expect(await page.locator('.pattern-grid__field-header[data-field="effect"]').count()).toBe(0);

    await page.locator('[data-action="pattern-toggle-fx"]').click();
    await expect(page.locator('.pattern-grid__field-header[data-field="effect"]').first()).toBeVisible();
    await expect(page.locator('.pattern-grid__field-header[data-field="param"]').first()).toBeVisible();

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');

    await fxCell(page).click();
    await page.keyboard.press('Enter');
    const type = page.locator('[data-action="pattern-effect-type"]');
    const input = page.locator('[data-action="pattern-effect-param"]');
    await expect(input).toBeFocused();

    await input.fill('80');
    await page.locator('[data-action="pattern-effect-apply"]').click();

    expect(await page.evaluate(() => window.tracker.getProject().song.patterns[0].effects))
      .toMatchObject([{ type: 'volume', tickLocal: 0, value: { level: 80 } }]);
    await expect(fxCell(page)).toHaveText('VOL');
    await expect(paramCell(page)).toHaveText('80');

    await type.selectOption('pan');
    await input.fill('+16');
    await page.locator('[data-action="pattern-effect-apply"]').click();

    expect(await page.evaluate(() => (
      window.tracker.getProject().song.patterns[0].effects.map((effect) => effect.type).sort()
    ))).toEqual(['pan', 'volume']);
    await expect(fxCell(page)).toHaveText('PAN+VOL');
    await expect(paramCell(page)).toHaveText('+16 | 80');

    await fxCell(page).click();
    await page.keyboard.press('Delete');
    expect(await page.evaluate(() => (
      window.tracker.getProject().song.patterns[0].effects.map((effect) => effect.type)
    ))).toEqual(['volume']);
    await expect(fxCell(page)).toHaveText('VOL');

    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.deleteEffect');
    await page.keyboard.press('Control+z');
    await expect(fxCell(page)).toHaveText('PAN+VOL');
  });

  test('EffectEvent existing membuka FX otomatis dan off-grid FX tetap terlihat lewat DLY', async ({ page }) => {
    await gotoApp(page);
    const { patternId, trackId } = await loadBlank(page);

    await page.evaluate(({ patternId: id, trackId: track }) => {
      window.tracker.commands.execute('pattern.addEffect', {
        patternId: id,
        trackId: track,
        tickLocal: 23,
        type: 'cut',
        value: { afterTicks: 60 },
      });
    }, { patternId, trackId });

    await expect(page.locator('.pattern-grid__field-header[data-field="effect"]').first()).toBeVisible();
    await expect(page.locator('.pattern-grid__field-header[data-field="delay"]').first()).toBeVisible();
    await expect(fxCell(page)).toHaveText('CUT');
    await expect(paramCell(page)).toHaveText('60t');

    const delayCell = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="delay"]',
    );
    await expect(delayCell).toHaveText('+23t');

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await fxCell(page).click();

    await expect(page.locator('[data-action="pattern-effect-param"]')).toBeDisabled();
    await expect(page.locator('[data-action="pattern-effect-apply"]')).toBeDisabled();
  });

  test('editor FX tetap melewati shared-pattern guard', async ({ page }) => {
    await gotoApp(page);
    const { orderEntryId } = await loadBlank(page);

    await page.evaluate((orderId) => {
      window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: orderId,
      });
    }, orderEntryId);

    await page.locator('[data-action="pattern-toggle-fx"]').click();
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await fxCell(page).click();
    await page.keyboard.press('Enter');
    await page.locator('[data-action="pattern-effect-param"]').fill('90');
    await page.locator('[data-action="pattern-effect-apply"]').click();

    await expect(page.locator('[data-action="pattern-shared-popover"]')).toBeVisible();
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].effects.length,
    )).toBe(0);

    await page.locator('[data-action="pattern-shared-edit-all"]').click();
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].effects.length,
    )).toBe(1);
    await expect(fxCell(page)).toHaveText('VOL');
  });

  test('bahasa Inggris memiliki label FX dan timing tanpa fallback Indonesia', async ({ page }) => {
    await gotoApp(page);
    await loadBlank(page);
    await page.evaluate(() => window.tracker.setLocale('en'));
    await page.locator('[data-action="pattern-toggle-fx"]').click();

    await expect(page.locator('[data-action="pattern-effect-type"]')).toHaveAttribute(
      'aria-label',
      'Effect type',
    );
    await expect(page.locator('[data-action="pattern-effect-param"]')).toHaveAttribute(
      'aria-label',
      'Effect parameter',
    );
    await expect(page.locator('[data-action="pattern-match-lpb"]')).toContainText('Match LPB');
  });
});
