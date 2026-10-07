import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('R3-S10B poly voice-lane projection + fold', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
      const project = window.tracker.getProject();
      const patternId = project.song.patterns[0].id;
      const trackId = project.song.tracks[0].id;

      window.tracker.commands.execute('track.setPolyphony', {
        trackId,
        polyphony: 'poly',
      });
      window.tracker.commands.execute('pattern.enterVoiceNote', {
        patternId,
        trackId,
        row: 0,
        voiceLane: 0,
        pitch: 60,
      });
      window.tracker.commands.execute('pattern.enterVoiceNote', {
        patternId,
        trackId,
        row: 0,
        voiceLane: 1,
        pitch: 64,
      });
    });
  });

  test('poly channel ringkas secara default lalu dapat menampilkan Lane 1/Lane 2 tanpa mengubah project', async ({ page }) => {
    const fold = page.locator('[data-action="track-lanes-toggle"]').first();
    await expect(fold).toBeVisible();
    await expect(fold).toHaveAttribute('aria-expanded', 'false');

    const collapsed = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"]',
    );
    await expect(collapsed).toContainText('C-4×2');

    const before = await page.evaluate(() => ({
      project: window.tracker.getProject(),
      history: window.tracker.getState().history,
    }));

    await fold.click();
    await expect(fold).toHaveAttribute('aria-expanded', 'true');

    const lane0 = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"][data-voice-lane="0"]',
    );
    const lane1 = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"][data-voice-lane="1"]',
    );
    await expect(lane0).toHaveText('C-4');
    await expect(lane1).toHaveText('E-4');
    const screenshotPath = test.info().outputPath('expanded-lanes.png');
    await page.screenshot({ path: screenshotPath });
    await test.info().attach('expanded-lanes', { path: screenshotPath, contentType: 'image/png' });

    const after = await page.evaluate(() => ({
      project: window.tracker.getProject(),
      history: window.tracker.getState().history,
    }));
    expect(after.project).toEqual(before.project);
    expect(after.history).toEqual(before.history);
  });

  test('cursor menyimpan voice lane dan Delete pada lane terpilih hanya menghapus voice itu', async ({ page }) => {
    const fold = page.locator('[data-action="track-lanes-toggle"]').first();
    await fold.click();

    const lane1 = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"][data-voice-lane="1"]',
    );
    await lane1.click();

    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
      channel: 0,
      row: 0,
      field: 'note',
      voiceLane: 1,
    });

    await page.keyboard.press('Control+e');
    await page.keyboard.press('Delete');

    const notes = await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes);
    expect(notes).toHaveLength(1);
    expect(notes[0].pitch).toBe(60);
    expect(notes[0].voiceLane ?? 0).toBe(0);
  });

  test('INST/VOL pada lane kedua mengedit NoteEvent lane kedua, bukan lane nol', async ({ page }) => {
    const fold = page.locator('[data-action="track-lanes-toggle"]').first();
    await fold.click();

    const volumeLane1 = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="volume"][data-voice-lane="1"]',
    );
    await volumeLane1.click();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('4');
    await page.keyboard.press('0');

    const notes = await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes);
    const lane0 = notes.find((note) => (note.voiceLane ?? 0) === 0);
    const lane1 = notes.find((note) => (note.voiceLane ?? 0) === 1);
    expect(lane0.velocity).toBe(100);
    expect(lane1.velocity).toBe(0x40);
  });

  test('collapse setelah satu voice tersisa kembali ke proyeksi ringkas tanpa marker ×2', async ({ page }) => {
    const fold = page.locator('[data-action="track-lanes-toggle"]').first();
    await fold.click();

    const lane1 = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"][data-voice-lane="1"]',
    );
    await lane1.click();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('Delete');

    await fold.click();
    const collapsed = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"]',
    );
    await expect(collapsed).toHaveText('C-4');
  });

  test('channel mono tidak menampilkan kontrol fold lane', async ({ page }) => {
    const secondTrack = await page.evaluate(() => window.tracker.getProject().song.tracks[1].id);
    await expect(page.locator(
      `[data-action="track-lanes-toggle"][data-track-id="${secondTrack}"]`,
    )).toHaveCount(0);
  });

  test('reload template tidak menyisakan identitas track lama pada cell yang dipakai ulang', async ({ page }) => {
    const trackId = await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', { templateId: 'blank', locale: 'id', keymap: 'songwriter' });
      return window.tracker.getProject().song.tracks[0].id;
    });
    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"]'))
      .toHaveAttribute('data-track-id', trackId);
  });

  test('keyboard berpindah antar lane dan NOTE replacement dapat di-Undo tanpa menyentuh lane nol', async ({ page }) => {
    await page.locator('[data-action="track-lanes-toggle"]').first().press('Enter');
    const lane = page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"][data-voice-lane="1"]');
    await lane.click();
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({ field: 'volume', voiceLane: 0 });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Control+e');
    await page.keyboard.press('x');
    expect(await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes.map((note) => note.pitch))).toEqual([60, 62]);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes.map((note) => note.pitch))).toEqual([60, 64]);
    await page.keyboard.press('Control+y');
    expect(await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes.map((note) => note.pitch))).toEqual([60, 62]);
  });

  test('lebar lane sparse, ARIA dan FX mengikuti track; horizontal window tetap terbatas', async ({ page }) => {
    await page.evaluate(() => {
      const project = window.tracker.getProject();
      window.tracker.commands.execute('pattern.enterVoiceNote', {
        patternId: project.song.patterns[0].id, trackId: project.song.tracks[0].id,
        row: 0, voiceLane: 7, pitch: 67,
      });
      while (window.tracker.getProject().song.tracks.length < 32) window.tracker.commands.execute('song.addTrack');
    });
    await page.locator('[data-action="track-lanes-toggle"]').first().click();
    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"]')).toHaveCount(3);
    await expect(page.locator('[data-action="pattern-grid"]')).toHaveAttribute('aria-colcount', '102');
    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="1"][data-field="note"]')).toHaveAttribute('aria-colindex', '10');
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.evaluate(() => {
      const grid = document.querySelector('[data-action="pattern-grid"]');
      for (let i = 0; i < 99; i += 1) grid.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({ channel: 31, field: 'note', voiceLane: 0 });
    const windowState = await page.evaluate(() => ({
      renderedChannels: new Set([...document.querySelectorAll('[data-action="pattern-cell"]')].map((cell) => cell.dataset.channel)).size,
      rowCount: document.querySelectorAll('.pattern-grid__row').length,
    }));
    expect(windowState.renderedChannels).toBeLessThan(32);
    expect(windowState.rowCount).toBeLessThan(64);
    await page.locator('[data-action="pattern-toggle-fx"]').click();
    await expect(grid).toHaveAttribute('aria-colcount', '166');
    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="31"][data-field="effect"]')).toHaveCount(1);
  });
});
