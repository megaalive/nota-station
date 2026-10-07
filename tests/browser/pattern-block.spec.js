import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

async function seedBlock(page) {
  return page.evaluate(() => {
    window.tracker.commands.execute('project.loadTemplate', {
      templateId: 'blank',
      locale: 'id',
      keymap: 'songwriter',
    });
    const project = window.tracker.getProject();
    const patternId = project.song.order[0].patternId;
    const tracks = project.song.tracks;

    window.tracker.commands.execute('pattern.enterNote', {
      patternId,
      trackId: tracks[0].id,
      row: 0,
      pitch: 60,
    });
    window.tracker.commands.execute('pattern.enterNote', {
      patternId,
      trackId: tracks[0].id,
      row: 1,
      pitch: 62,
    });
    window.tracker.commands.execute('pattern.enterNote', {
      patternId,
      trackId: tracks[1].id,
      row: 1,
      pitch: 64,
    });
    return { patternId };
  });
}

test.describe('Pattern block editing R3-S5', () => {
  test('keyboard select → copy → paste → transpose dan Undo tetap transaksional', async ({ page }) => {
    await gotoApp(page);
    await seedBlock(page);

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');

    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowRight');

    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toEqual({
      rowStart: 0,
      rowEnd: 1,
      channelStart: 0,
      channelEnd: 1,
    });

    await page.keyboard.press('Control+c');
    expect(await page.evaluate(() => window.tracker.getState().patternClipboard)).toEqual({
      eventCount: 3,
      rowCount: 2,
      channelCount: 2,
    });

    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
      row: 4,
      channel: 2,
      field: 'note',
      selection: null,
    });

    const undoBeforePaste = await page.evaluate(() => window.tracker.getState().history.undoDepth);
    await page.keyboard.press('Control+v');

    let pasted = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find(
        (item) => item.id === window.tracker.getState().project.patternId,
      );
      const tracks = project.song.tracks;
      return pattern.notes
        .filter((note) => [tracks[2].id, tracks[3].id].includes(note.trackId))
        .map((note) => ({
          row: note.startTickLocal / pattern.rowTicks,
          trackId: note.trackId,
          pitch: note.pitch,
        }));
    });
    expect(pasted.map((note) => [note.row, note.pitch])).toEqual([
      [4, 60],
      [5, 62],
      [5, 64],
    ]);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth))
      .toBe(undoBeforePaste + 1);

    await page.keyboard.press('Control+ArrowUp');
    pasted = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find(
        (item) => item.id === window.tracker.getState().project.patternId,
      );
      const tracks = project.song.tracks;
      return pattern.notes
        .filter((note) => [tracks[2].id, tracks[3].id].includes(note.trackId))
        .map((note) => note.pitch);
    });
    expect(pasted).toEqual([61, 63, 65]);

    await page.keyboard.press('Control+Shift+ArrowUp');
    expect(await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find(
        (item) => item.id === window.tracker.getState().project.patternId,
      );
      const tracks = project.song.tracks;
      return pattern.notes
        .filter((note) => [tracks[2].id, tracks[3].id].includes(note.trackId))
        .map((note) => note.pitch);
    })).toEqual([73, 75, 77]);

    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.transposeBlock');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');

    expect(await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find(
        (item) => item.id === window.tracker.getState().project.patternId,
      );
      return pattern.notes.length;
    })).toBe(3);
  });

  test('Ctrl+A bertahap memilih sel aktif → channel → seluruh Pattern', async ({ page }) => {
    await gotoApp(page);
    await seedBlock(page);
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
      row: 1,
      channel: 1,
      field: 'note',
      selection: null,
    });

    await page.keyboard.press('Control+a');
    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toEqual({
      rowStart: 1,
      rowEnd: 1,
      channelStart: 1,
      channelEnd: 1,
    });

    await page.keyboard.press('Control+a');
    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toEqual({
      rowStart: 0,
      rowEnd: 63,
      channelStart: 1,
      channelEnd: 1,
    });

    await page.keyboard.press('Control+a');
    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toEqual({
      rowStart: 0,
      rowEnd: 63,
      channelStart: 0,
      channelEnd: 7,
    });

    await page.keyboard.press('Control+a');
    expect(await page.evaluate(() => window.tracker.getState().patternUi.selection)).toEqual({
      rowStart: 0,
      rowEnd: 63,
      channelStart: 0,
      channelEnd: 7,
    });
  });
});
