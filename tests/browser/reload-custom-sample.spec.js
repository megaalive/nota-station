import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from './helpers.js';

function makePcm16Wav({
  sampleRate = 16000,
  frames = 640,
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

test.describe('R2-S11 reload custom sample', () => {
  test('WAV import + note kromatis pulih setelah reload dan decode tetap satu kali per sesi', async ({ page }) => {
    await gotoApp(page);

    await page.evaluate(async () => {
      sessionStorage.clear();
      const { deleteSampleDatabase } = await import('./src/storage/sample-store.js');
      await deleteSampleDatabase().catch(() => {});
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
    });

    await page.getByRole('tab', { name: 'Suara' }).click();
    const wav = makePcm16Wav();
    await page.locator('[data-action="sound-wav-input"]').setInputFiles({
      name: 'Reload.wav',
      mimeType: 'audio/wav',
      buffer: wav,
    });
    await expect(page.locator('[data-action="sound-status"]')).toContainText('Reload dipasang ke', {
      timeout: 5000,
    });

    const beforeReload = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns[0];
      const track = project.song.tracks[0];
      const instrumentId = track.defaultInstrumentId;

      window.tracker.commands.execute('pattern.enterNote', {
        patternId: pattern.id,
        trackId: track.id,
        row: 0,
        pitch: 60,
      });
      window.tracker.commands.execute('pattern.enterNote', {
        patternId: pattern.id,
        trackId: track.id,
        row: 1,
        pitch: 67,
      });

      const next = window.tracker.getProject();
      return {
        projectId: next.id,
        trackId,
        instrumentId,
        sampleId: next.instruments.find((item) => item.id === instrumentId).zones[0].sampleId,
        session: window.tracker.getState().session,
      };
    });

    expect(beforeReload.instrumentId).not.toBe('factory.basic');
    expect(beforeReload.session.saved).toBe(true);
    expect(beforeReload.session.bytes).toBeGreaterThan(0);

    await page.reload();
    await waitForApp(page);

    const restored = await page.evaluate(async ({ expectedProjectId, expectedTrackId, expectedInstrumentId }) => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns[0];
      const notes = pattern.notes
        .filter((note) => note.trackId === expectedTrackId)
        .sort((a, b) => a.startTickLocal - b.startTickLocal);
      const { openSampleStore } = await import('./src/storage/sample-store.js');
      const sampleStore = await openSampleStore();
      const stats = await sampleStore.stats();
      const sample = project.samples.find((item) => (
        item.id === project.instruments.find((instrument) => instrument.id === expectedInstrumentId)
          ?.zones[0]?.sampleId
      ));
      const bytes = sample ? await sampleStore.getBytes(sample.storageRef.key) : null;
      sampleStore.close();

      return {
        projectId: project.id,
        defaultInstrumentId: project.song.tracks[0].defaultInstrumentId,
        pitches: notes.map((note) => note.pitch),
        instrumentIds: notes.map((note) => note.instrumentId),
        sampleStorageKind: sample?.storageRef?.kind ?? null,
        persistedBytes: bytes?.byteLength ?? 0,
        stats,
        session: window.tracker.getState().session,
        expectedProjectId,
      };
    }, {
      expectedProjectId: beforeReload.projectId,
      expectedTrackId: beforeReload.trackId,
      expectedInstrumentId: beforeReload.instrumentId,
    });

    expect(restored.projectId).toBe(beforeReload.projectId);
    expect(restored.defaultInstrumentId).toBe(beforeReload.instrumentId);
    expect(restored.pitches).toEqual([60, 67]);
    expect(restored.instrumentIds).toEqual([beforeReload.instrumentId, beforeReload.instrumentId]);
    expect(restored.sampleStorageKind).toBe('indexeddb');
    expect(restored.persistedBytes).toBe(wav.length);
    expect(restored.stats.count).toBe(1);
    expect(restored.session.restored).toBe(true);
    expect(restored.session.errorCode).toBeNull();

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.sampleDecodeCount),
      { timeout: 5000 },
    ).toBe(1);
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.scheduledInstrumentIds),
      { timeout: 5000 },
    ).toContain(beforeReload.instrumentId);

    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
    await page.getByRole('button', { name: 'Putar' }).click();
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.sampleDecodeCount),
      { timeout: 5000 },
    ).toBe(1);

    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
  });
});
