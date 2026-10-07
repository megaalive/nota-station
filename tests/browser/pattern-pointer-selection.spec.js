import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

async function point(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Elemen tidak memiliki bounding box.');
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

test.describe('R3-S10E pointer block selection', () => {
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

  test('drag mouse antar cell memilih blok row × channel', async ({ page }) => {
    const start = page.locator(
      '[data-action="pattern-cell"][data-row="1"][data-channel="1"][data-field="note"]',
    );
    const end = page.locator(
      '[data-action="pattern-cell"][data-row="3"][data-channel="3"][data-field="note"]',
    );
    const a = await point(start);
    const b = await point(end);

    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();

    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toEqual({
      rowStart: 1,
      rowEnd: 3,
      channelStart: 1,
      channelEnd: 3,
    });
    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
      row: 3,
      channel: 3,
      field: 'note',
    });
  });

  test('drag pada header channel memilih seluruh rentang channel', async ({ page }) => {
    const start = page.locator(
      '[data-action="pattern-channel-header"][data-channel="1"] .pattern-channel__name',
    );
    const end = page.locator(
      '[data-action="pattern-channel-header"][data-channel="3"] .pattern-channel__name',
    );
    const a = await point(start);
    const b = await point(end);

    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();

    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toEqual({
      rowStart: 0,
      rowEnd: 63,
      channelStart: 1,
      channelEnd: 3,
    });
  });

  test('kontrol interaktif pada header tidak memulai block selection', async ({ page }) => {
    const trackId = await page.evaluate(() => window.tracker.getProject().song.tracks[0].id);
    await page.locator(
      `[data-action="track-mute"][data-track-id="${trackId}"]`,
    ).click();

    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toBeNull();
  });
});
