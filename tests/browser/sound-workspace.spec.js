import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

function makePcm16Wav({
  sampleRate = 16000,
  frames = 320,
  frequency = 220,
} = {}) {
  const dataBytes = frames * 2;
  const bytes = Buffer.alloc(44 + dataBytes);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVE', 8, 'ascii');
  bytes.write('fmt ', 12, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(dataBytes, 40);

  for (let frame = 0; frame < frames; frame += 1) {
    const value = Math.round(
      Math.sin(2 * Math.PI * frequency * frame / sampleRate) * 12000,
    );
    bytes.writeInt16LE(value, 44 + frame * 2);
  }
  return bytes;
}

test.describe('Sound workspace R2-S6', () => {
  test('import WAV lewat UI memasang instrument ke track dan Undo menjaga bytes dedup', async ({ page }) => {
    await gotoApp(page);

    await page.evaluate(async () => {
      const { deleteSampleDatabase } = await import('./src/storage/sample-store.js');
      await deleteSampleDatabase().catch(() => {});
    });

    await page.getByRole('tab', { name: 'Suara' }).click();
    await expect(page.getByRole('heading', { name: 'Sample & Instrument' })).toBeVisible();

    const target = page.locator('[data-action="sound-target-track"]');
    await expect(target.locator('option')).toHaveCount(8);
    await target.selectOption({ index: 1 });

    await expect(page.locator('[data-action="sound-sample"]')).toHaveCount(1);
    await expect(page.locator('[data-action="sound-instrument"]')).toHaveCount(1);

    const before = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        sampleCount: project.samples.length,
        instrumentCount: project.instruments.length,
        trackId: project.song.tracks[1].id,
        defaultInstrumentId: project.song.tracks[1].defaultInstrumentId,
      };
    });

    const wav = makePcm16Wav();
    await page.locator('[data-action="sound-wav-input"]').setInputFiles({
      name: 'UITest.wav',
      mimeType: 'audio/wav',
      buffer: wav,
    });

    await expect(page.locator('[data-action="sound-status"]')).toContainText('UITest dipasang ke', {
      timeout: 5000,
    });
    await expect(page.locator('[data-action="sound-sample"]')).toHaveCount(2);
    await expect(page.locator('[data-action="sound-instrument"]')).toHaveCount(2);
    await expect(page.locator('[data-action="sound-sample"]').last()).toContainText('UITest');
    await expect(page.locator('[data-action="sound-instrument"]').last()).toContainText('UITest');

    const imported = await page.evaluate(async () => {
      const project = window.tracker.getProject();
      const { openSampleStore } = await import('./src/storage/sample-store.js');
      const sampleStore = await openSampleStore();
      const stats = await sampleStore.stats();
      sampleStore.close();
      return {
        sampleCount: project.samples.length,
        instrumentCount: project.instruments.length,
        defaultInstrumentId: project.song.tracks[1].defaultInstrumentId,
        stats,
      };
    });

    expect(imported.sampleCount).toBe(before.sampleCount + 1);
    expect(imported.instrumentCount).toBe(before.instrumentCount + 1);
    expect(imported.defaultInstrumentId).not.toBe(before.defaultInstrumentId);
    expect(imported.stats.count).toBe(1);
    expect(imported.stats.bytes).toBe(wav.length);

    const toast = page.locator('[data-action="toast"]');
    await expect(toast).toContainText('UITest dipasang ke');
    await toast.getByRole('button', { name: 'Undo' }).click();

    await expect(page.locator('[data-action="sound-status"]')).toContainText('di-undo');
    await expect(page.locator('[data-action="sound-sample"]')).toHaveCount(1);
    await expect(page.locator('[data-action="sound-instrument"]')).toHaveCount(1);

    const undone = await page.evaluate(async () => {
      const project = window.tracker.getProject();
      const { openSampleStore } = await import('./src/storage/sample-store.js');
      const sampleStore = await openSampleStore();
      const stats = await sampleStore.stats();
      await sampleStore.clear();
      sampleStore.close();
      return {
        sampleCount: project.samples.length,
        instrumentCount: project.instruments.length,
        defaultInstrumentId: project.song.tracks[1].defaultInstrumentId,
        stats,
      };
    });

    expect(undone.sampleCount).toBe(before.sampleCount);
    expect(undone.instrumentCount).toBe(before.instrumentCount);
    expect(undone.defaultInstrumentId).toBe(before.defaultInstrumentId);
    expect(undone.stats.count).toBe(1);
  });

  test('WAV rusak gagal jelas tanpa memutasi Project', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('tab', { name: 'Suara' }).click();

    const before = await page.evaluate(() => JSON.stringify(window.tracker.getProject()));

    await page.locator('[data-action="sound-wav-input"]').setInputFiles({
      name: 'Rusak.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from([1, 2, 3, 4, 5, 6]),
    });

    await expect(page.locator('[data-action="sound-status"]')).toContainText(
      'Import WAV gagal (E_WAV_TRUNCATED)',
      { timeout: 3000 },
    );

    const after = await page.evaluate(() => JSON.stringify(window.tracker.getProject()));
    expect(after).toBe(before);
  });
});
