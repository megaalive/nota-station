import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('custom sample playback R2-S5', () => {
  test('IndexedDB WAV dimainkan lewat Instrument/Zone dan tidak didecode ulang', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await gotoApp(page);

    await page.evaluate(async () => {
      const { openSampleStore, deleteSampleDatabase } = await import('./src/storage/sample-store.js');
      const { prepareWavImport, persistPreparedWavImport } = await import('./src/io/wav-import.js');
      const { applyPreparedWavImport } = await import('./src/core/sample-import.js');
      const { enterNote, activePattern } = await import('./src/core/project.js');
      const { createAudioEngine } = await import('./src/audio/engine.js');

      const dbName = 'notastation-r2-s5-playback';
      await deleteSampleDatabase({ dbName }).catch(() => {});
      const store = await openSampleStore({ dbName });

      const sampleRate = 8000;
      const frames = 8000;
      const dataBytes = frames * 2;
      const bytes = new Uint8Array(44 + dataBytes);
      const view = new DataView(bytes.buffer);
      const ascii = (offset, text) => {
        for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
      };
      ascii(0, 'RIFF');
      view.setUint32(4, bytes.length - 8, true);
      ascii(8, 'WAVE');
      ascii(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      ascii(36, 'data');
      view.setUint32(40, dataBytes, true);
      for (let frame = 0; frame < frames; frame += 1) {
        const value = Math.round(Math.sin(2 * Math.PI * 220 * frame / sampleRate) * 12000);
        view.setInt16(44 + frame * 2, value, true);
      }

      const base = window.tracker.getProject();
      const trackId = base.song.tracks[0].id;
      let seq = 0;
      const prepared = await prepareWavImport(base, {
        bytes,
        sourceFilename: 'Custom_Sine.wav',
        idFactory: (prefix) => `${prefix}-s5-${++seq}`,
      });
      await persistPreparedWavImport(prepared, bytes, store);
      let project = applyPreparedWavImport(base, prepared, { trackId }).project;
      const pattern = activePattern(project);
      project = enterNote(project, {
        patternId: pattern.id,
        trackId,
        row: 0,
        pitch: 60,
        durationTicks: pattern.rowTicks * 8,
      });

      const instrumentId = project.song.tracks[0].defaultInstrumentId;
      const engine = createAudioEngine({
        getSampleStore: async () => store,
      });

      const button = document.createElement('button');
      button.id = 'custom-sample-play';
      button.textContent = 'custom sample play';
      button.addEventListener('click', async () => {
        await engine.playPattern(project, activePattern(project), { loop: true });
        window.__customSampleState = engine.getState();
      });
      document.body.append(button);

      window.__customSampleEngine = engine;
      window.__customSampleStore = store;
      window.__customSampleDbName = dbName;
      window.__customInstrumentId = instrumentId;
    });

    await page.locator('#custom-sample-play').click();
    await expect.poll(() => page.evaluate(() => window.__customSampleState ?? null), {
      timeout: 5000,
    }).not.toBeNull();

    const first = await page.evaluate(() => window.__customSampleEngine.getState());
    expect(first.state).toBe('playing');
    expect(first.scheduledInstrumentIds).toContain(
      await page.evaluate(() => window.__customInstrumentId),
    );
    expect(first.sampleDecodeCount).toBe(1);
    expect(first.sampleCacheDecoded).toBeGreaterThanOrEqual(2);
    expect(first.preparedVoiceProfiles).toBe(1);

    await page.evaluate(() => window.__customSampleEngine.stop());
    await page.locator('#custom-sample-play').click();
    await expect.poll(
      () => page.evaluate(() => window.__customSampleEngine.getState().notesScheduled),
      { timeout: 3000 },
    ).toBeGreaterThan(0);

    const second = await page.evaluate(() => window.__customSampleEngine.getState());
    expect(second.sampleDecodeCount).toBe(1);
    expect(second.sampleLoadCount).toBe(1);
    expect(errors).toEqual([]);

    await page.evaluate(async () => {
      window.__customSampleEngine.stop();
      window.__customSampleStore.close();
      const { deleteSampleDatabase } = await import('./src/storage/sample-store.js');
      await deleteSampleDatabase({ dbName: window.__customSampleDbName });
    });
  });
});
