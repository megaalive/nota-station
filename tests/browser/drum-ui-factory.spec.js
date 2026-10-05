import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

const noteCell = (page, row, channel = 0) => (
  page.locator(
    `[data-action="pattern-cell"][data-row="${row}"][data-channel="${channel}"][data-field="note"]`,
  )
);

test.describe('factory Drum Kit + Pattern lanes R2-S10', () => {
  test('template Pop memakai satu Drum Track dan 1-4 toggle lane tanpa auto-advance', async ({ page }) => {
    await gotoApp(page);

    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'pop-4-4',
        locale: 'id',
        keymap: 'songwriter',
      });
    });

    await expect(page.locator('.pattern-channel__name').first()).toContainText('Drums · DRUM');
    await expect(page.locator('[data-action="track-instrument"]').first()).toHaveValue('factory.drum-kit');
    await expect(noteCell(page, 4)).toHaveText('KSC');

    const beforePack = await page.evaluate(() => performance.getEntriesByType('resource')
      .some((entry) => entry.name.includes('factory-drum-samples.js')));
    expect(beforePack).toBe(false);

    await page.locator('[data-action="pattern-mode"]').click();
    await expect(page.locator('[data-action="pattern-mode"]')).toContainText('EDIT');

    await noteCell(page, 1).click();
    const grid = page.locator('[data-action="pattern-grid"]');
    await expect(grid).toBeFocused();

    await grid.press('1');
    await grid.press('2');
    await grid.press('3');

    await expect(noteCell(page, 1)).toHaveText('KSC');
    let state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns[0];
      const track = project.song.tracks[0];
      const tick = pattern.rowTicks;
      return {
        hits: pattern.notes
          .filter((note) => note.trackId === track.id && note.startTickLocal === tick)
          .map((note) => ({ lane: note.voiceLane, pitch: note.pitch })),
        row: document.querySelector('[data-action="pattern-cell"].is-cursor')?.dataset.row,
      };
    });
    expect(state.hits).toEqual([
      { lane: 0, pitch: 36 },
      { lane: 1, pitch: 38 },
      { lane: 2, pitch: 42 },
    ]);
    expect(state.row).toBe('1');

    await grid.press('3');
    await expect(noteCell(page, 1)).toHaveText('KS');
    await grid.press('4');
    await expect(noteCell(page, 1)).toHaveText('KSO');

    await grid.press('Delete');
    await expect(noteCell(page, 1)).toHaveText('···');
    state = await page.evaluate(() => ({
      history: window.tracker.getState().history,
      project: window.tracker.getProject(),
    }));
    expect(state.history.undoLabel).toBe('pattern.clearVoiceRow');
    const pattern = state.project.song.patterns[0];
    const track = state.project.song.tracks[0];
    expect(pattern.notes.filter(
      (note) => note.trackId === track.id && note.startTickLocal === pattern.rowTicks,
    )).toHaveLength(0);

    await page.getByRole('button', { name: 'Putar' }).click();

    await expect.poll(
      () => page.evaluate(() => performance.getEntriesByType('resource')
        .some((entry) => entry.name.includes('factory-drum-samples.js'))),
      { timeout: 5000 },
    ).toBe(true);

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.sampleDecodeCount),
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(4);

    const audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.scheduledInstrumentIds).toContain('factory.drum-kit');
    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
  });

  test('memilih Factory Drum Kit dari picker mengubah track biasa menjadi Drum Track', async ({ page }) => {
    await gotoApp(page);

    // Blank project belum membawa pack; gunakan Pop lalu pilih channel ke-4 yang masih kosong.
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'pop-4-4',
        locale: 'id',
        keymap: 'songwriter',
      });
    });

    const emptyPicker = page.locator('[data-action="track-instrument"]').nth(3);
    await emptyPicker.selectOption('factory.drum-kit');

    const track = await page.evaluate(() => window.tracker.getProject().song.tracks[3]);
    expect(track.kind).toBe('drum');
    expect(track.polyphony).toBe('poly');
    expect(track.defaultInstrumentId).toBe('factory.drum-kit');
    await expect(page.locator('.pattern-channel__name').nth(3)).toContainText('DRUM');
  });
});
