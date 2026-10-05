import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from './helpers.js';

function makePcm16Wav({ sampleRate = 16000, frames = 160 } = {}) {
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
    const value = Math.round(Math.sin(2 * Math.PI * 220 * frame / sampleRate) * 12000);
    bytes.writeInt16LE(value, 44 + frame * 2);
  }
  return bytes;
}

test.describe('global drop + Instrument picker R2-S8', () => {
  test('ArrowUp/Down pada picker mengganti default Instrument dan mengaudisi', async ({ page }) => {
    await page.goto('./?demo=stability');
    await waitForApp(page);

    const picker = page.locator('[data-action="track-instrument"]').first();
    await expect(picker).toBeVisible();
    expect(await picker.locator('option').count()).toBeGreaterThan(1);

    const before = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        trackId: project.song.tracks[0].id,
        instrumentId: project.song.tracks[0].defaultInstrumentId,
      };
    });

    await picker.press('ArrowDown');

    const after = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        instrumentId: project.song.tracks[0].defaultInstrumentId,
        history: window.tracker.getState().history,
      };
    });

    expect(after.instrumentId).not.toBe(before.instrumentId);
    expect(after.history.undoLabel).toBe('track.setDefaultInstrument');
    await expect(page.locator('[data-action="track-instrument"]').first()).toHaveValue(after.instrumentId);

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.activeVoices),
      { timeout: 3000 },
    ).toBeGreaterThan(0);

    await page.keyboard.press('Control+Z');
    await expect.poll(
      () => page.evaluate(() => window.tracker.getProject().song.tracks[0].defaultInstrumentId),
    ).toBe(before.instrumentId);
  });

  test('drop WAV global memasang ke track di bawah kursor dan Undo memulihkan Project', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(async () => {
      const { deleteSampleDatabase } = await import('./src/storage/sample-store.js');
      await deleteSampleDatabase().catch(() => {});
    });

    const targetCell = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="1"][data-field="note"]',
    );
    await targetCell.click();

    const before = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        activeTab: window.tracker.getState().activeTab,
        trackId: project.song.tracks[1].id,
        trackName: project.song.tracks[1].name,
        instrumentId: project.song.tracks[1].defaultInstrumentId,
        sampleCount: project.samples.length,
        instrumentCount: project.instruments.length,
      };
    });

    const wav = makePcm16Wav();
    await page.evaluate(({ bytes }) => {
      const file = new File([new Uint8Array(bytes)], 'Dropped.wav', { type: 'audio/wav' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      window.__wavDropTransfer = transfer;
      document.body.dispatchEvent(new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }));
    }, { bytes: [...wav] });

    const overlay = page.locator('[data-action="wav-drop-overlay"]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(before.trackName);

    await page.evaluate(() => {
      document.body.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: window.__wavDropTransfer,
      }));
    });

    await expect(overlay).toBeHidden();
    const toast = page.locator('[data-action="toast"]');
    await expect(toast).toContainText(`Dropped dipasang ke ${before.trackName}`, {
      timeout: 5000,
    });

    const imported = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        activeTab: window.tracker.getState().activeTab,
        instrumentId: project.song.tracks[1].defaultInstrumentId,
        sampleCount: project.samples.length,
        instrumentCount: project.instruments.length,
      };
    });

    expect(imported.activeTab).toBe(before.activeTab);
    expect(imported.instrumentId).not.toBe(before.instrumentId);
    expect(imported.sampleCount).toBe(before.sampleCount + 1);
    expect(imported.instrumentCount).toBe(before.instrumentCount + 1);

    await toast.getByRole('button', { name: 'Undo' }).click();

    await expect.poll(
      () => page.evaluate(() => window.tracker.getProject().song.tracks[1].defaultInstrumentId),
    ).toBe(before.instrumentId);

    const undone = await page.evaluate(async () => {
      const project = window.tracker.getProject();
      const { openSampleStore } = await import('./src/storage/sample-store.js');
      const sampleStore = await openSampleStore();
      await sampleStore.clear();
      sampleStore.close();
      return {
        sampleCount: project.samples.length,
        instrumentCount: project.instruments.length,
      };
    });
    expect(undone.sampleCount).toBe(before.sampleCount);
    expect(undone.instrumentCount).toBe(before.instrumentCount);
  });
});
