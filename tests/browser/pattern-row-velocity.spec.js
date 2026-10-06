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
      trackIds: project.song.tracks.map((track) => track.id),
    };
  });
}

async function noteRows(page) {
  return page.evaluate(() => {
    const project = window.tracker.getProject();
    const pattern = project.song.patterns.find(
      (item) => item.id === window.tracker.getState().project.patternId,
    );
    return pattern.notes.map((note) => ({
      trackId: note.trackId,
      row: note.startTickLocal / pattern.rowTicks,
      pitch: note.pitch,
      velocity: note.velocity,
      durationRows: note.durationTicks / pattern.rowTicks,
      voiceLane: note.voiceLane ?? 0,
    }));
  });
}

test.describe('Pattern row + velocity R3-S6', () => {
  test('Insert dan Backspace menggeser row channel aktif sebagai satu transaksi', async ({ page }) => {
    await gotoApp(page);
    const { patternId, trackIds } = await loadBlank(page);

    await page.evaluate(({ patternId: id, tracks }) => {
      window.tracker.commands.execute('pattern.enterNote', {
        patternId: id,
        trackId: tracks[0],
        row: 1,
        pitch: 60,
        velocity: 40,
      });
      window.tracker.commands.execute('pattern.enterNote', {
        patternId: id,
        trackId: tracks[0],
        row: 3,
        pitch: 64,
        velocity: 60,
      });
      window.tracker.commands.execute('pattern.enterNote', {
        patternId: id,
        trackId: tracks[1],
        row: 2,
        pitch: 67,
        velocity: 70,
      });
    }, { patternId, tracks: trackIds });

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('ArrowDown');

    const undoBefore = await page.evaluate(() => window.tracker.getState().history.undoDepth);
    await page.keyboard.press('Insert');

    let rows = await noteRows(page);
    expect(rows.filter((note) => note.trackId === trackIds[0]).map((note) => note.row))
      .toEqual([2, 4]);
    expect(rows.find((note) => note.trackId === trackIds[1]).row).toBe(2);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth))
      .toBe(undoBefore + 1);
    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.insertRows');

    await page.keyboard.press('Backspace');
    rows = await noteRows(page);
    expect(rows.filter((note) => note.trackId === trackIds[0]).map((note) => note.row))
      .toEqual([1, 3]);
    expect(rows.find((note) => note.trackId === trackIds[1]).row).toBe(2);
    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.deleteRows');
  });

  test('Ctrl+Insert dan Ctrl+Backspace mengoperasikan seluruh channel', async ({ page }) => {
    await gotoApp(page);
    const { patternId, trackIds } = await loadBlank(page);

    await page.evaluate(({ patternId: id, tracks }) => {
      window.tracker.commands.execute('pattern.enterNote', {
        patternId: id,
        trackId: tracks[0],
        row: 1,
        pitch: 60,
      });
      window.tracker.commands.execute('pattern.enterNote', {
        patternId: id,
        trackId: tracks[1],
        row: 2,
        pitch: 64,
      });
    }, { patternId, tracks: trackIds });

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Control+Insert');

    expect((await noteRows(page)).map((note) => note.row)).toEqual([2, 3]);

    await page.keyboard.press('Control+Backspace');
    expect((await noteRows(page)).map((note) => note.row)).toEqual([1, 2]);
  });

  test('Ctrl+J menginterpolasi velocity existing note pada selection dan Undo mengembalikan nilai', async ({ page }) => {
    await gotoApp(page);
    const { patternId, trackIds } = await loadBlank(page);

    await page.evaluate(({ patternId: id, trackId }) => {
      for (const [row, pitch, velocity] of [
        [0, 60, 20],
        [2, 62, 100],
        [4, 64, 80],
      ]) {
        window.tracker.commands.execute('pattern.enterNote', {
          patternId: id,
          trackId,
          row,
          pitch,
          velocity,
        });
      }
    }, { patternId, trackId: trackIds[0] });

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press('Shift+ArrowDown');
    }

    await page.keyboard.press('Control+j');

    let velocities = (await noteRows(page))
      .filter((note) => note.trackId === trackIds[0])
      .map((note) => note.velocity);
    expect(velocities).toEqual([20, 50, 80]);
    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.interpolateVelocity');

    await page.keyboard.press('Control+z');
    velocities = (await noteRows(page))
      .filter((note) => note.trackId === trackIds[0])
      .map((note) => note.velocity);
    expect(velocities).toEqual([20, 100, 80]);
  });

  test('row edit dan interpolation command tetap ditahan shared-pattern guard', async ({ page }) => {
    await gotoApp(page);
    const { patternId, trackIds } = await loadBlank(page);

    const codes = await page.evaluate(({ patternId: id }) => {
      const firstOrder = window.tracker.getProject().song.order[0].id;
      window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: firstOrder,
      });

      const run = (command, args) => {
        try {
          window.tracker.commands.execute(command, args);
          return null;
        } catch (error) {
          return error.code ?? null;
        }
      };

      return [
        run('pattern.insertRows', {
          patternId: id,
          row: 0,
          count: 1,
          channelStart: 0,
          channelEnd: 0,
        }),
        run('pattern.deleteRows', {
          patternId: id,
          row: 0,
          count: 1,
          channelStart: 0,
          channelEnd: 0,
        }),
        run('pattern.interpolateVelocity', {
          patternId: id,
          rowStart: 0,
          rowEnd: 4,
          channelStart: 0,
          channelEnd: 0,
        }),
      ];
    }, { patternId, trackIds });

    expect(codes).toEqual([
      'E_SHARED_PATTERN_DECISION_REQUIRED',
      'E_SHARED_PATTERN_DECISION_REQUIRED',
      'E_SHARED_PATTERN_DECISION_REQUIRED',
    ]);
  });
});
