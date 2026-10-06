import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('EffectEvent command layer R3-S8A', () => {
  test('add update delete EffectEvent masing-masing satu transaksi Undo', async ({ page }) => {
    await gotoApp(page);

    const seeded = await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
      const project = window.tracker.getProject();
      const patternId = project.song.order[0].patternId;
      const trackId = project.song.tracks[0].id;
      const depth = window.tracker.getState().history.undoDepth;

      const added = window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 120,
        type: 'volume',
        value: { level: 80 },
      });
      return { patternId, trackId, depth, effectId: added.effect.id };
    });

    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.addEffect');
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth))
      .toBe(seeded.depth + 1);

    await page.evaluate(({ patternId, effectId }) => {
      window.tracker.commands.execute('pattern.updateEffect', {
        patternId,
        effectId,
        tickLocal: 240,
        value: { level: 96 },
      });
    }, seeded);

    expect(await page.evaluate(() => {
      const effect = window.tracker.getProject().song.patterns[0].effects[0];
      return { tickLocal: effect.tickLocal, value: effect.value };
    })).toEqual({
      tickLocal: 240,
      value: { level: 96 },
    });
    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.updateEffect');

    await page.evaluate(({ patternId, effectId }) => {
      window.tracker.commands.execute('pattern.deleteEffect', {
        patternId,
        effectId,
      });
    }, seeded);
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].effects.length,
    )).toBe(0);
    expect(await page.evaluate(() => window.tracker.getState().history.undoLabel))
      .toBe('pattern.deleteEffect');

    await page.keyboard.press('Control+z');
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].effects.length,
    )).toBe(1);
  });

  test('EffectEvent command tidak dapat melewati shared-pattern guard', async ({ page }) => {
    await gotoApp(page);

    const code = await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
      const project = window.tracker.getProject();
      const patternId = project.song.order[0].patternId;
      const trackId = project.song.tracks[0].id;
      window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: project.song.order[0].id,
      });

      try {
        window.tracker.commands.execute('pattern.addEffect', {
          patternId,
          trackId,
          tickLocal: 120,
          type: 'pan',
          value: { position: 16 },
        });
        return null;
      } catch (error) {
        return error.code ?? null;
      }
    });

    expect(code).toBe('E_SHARED_PATTERN_DECISION_REQUIRED');
    expect(await page.evaluate(
      () => window.tracker.getProject().song.patterns[0].effects.length,
    )).toBe(0);
  });
});
