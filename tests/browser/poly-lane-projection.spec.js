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

    expect((await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
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
});
