import { test, expect } from '@playwright/test';

import { waitForApp } from './helpers.js';

test.describe('import transaction + decode cache R2-S4', () => {
  test('persist → commit Project → cache decode hanya sekali', async ({ page }) => {
    await page.goto('./');
    await waitForApp(page);

    const result = await page.evaluate(async () => {
      const { openSampleStore, deleteSampleDatabase } = await import('./src/storage/sample-store.js');
      const { prepareWavImport, persistPreparedWavImport } = await import('./src/io/wav-import.js');
      const { applyPreparedWavImport } = await import('./src/core/sample-import.js');
      const {
        createProjectSampleBytesLoader,
        createSampleBufferCache,
      } = await import('./src/audio/sample-buffer-cache.js');

      const dbName = 'notastation-r2-s4-browser';
      await deleteSampleDatabase({ dbName }).catch(() => {});
      const store = await openSampleStore({ dbName });

      const channels = 1;
      const bits = 16;
      const sampleRate = 22050;
      const frames = 32;
      const blockAlign = 2;
      const dataBytes = frames * blockAlign;
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
      view.setUint16(22, channels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bits, true);
      ascii(36, 'data');
      view.setUint32(40, dataBytes, true);
      for (let i = 44; i < bytes.length; i += 1) bytes[i] = (i * 31) & 0xff;

      const project = window.tracker.getProject();
      const trackId = project.song.tracks[2].id;
      let seq = 0;
      const prepared = await prepareWavImport(project, {
        bytes,
        sourceFilename: 'S4_Test.wav',
        idFactory: (prefix) => `${prefix}-s4-${++seq}`,
      });
      const persisted = await persistPreparedWavImport(prepared, bytes, store);
      const committed = applyPreparedWavImport(project, persisted, { trackId });

      let decodes = 0;
      const cache = createSampleBufferCache({
        loadBytes: createProjectSampleBytesLoader({ sampleStore: store }),
        decodeBytes: async (buffer) => {
          decodes += 1;
          return { marker: 'decoded', byteLength: buffer.byteLength };
        },
      });
      const sample = committed.project.samples.find((item) => item.id === committed.sampleId);
      const [a, b, c] = await Promise.all([
        cache.get(sample),
        cache.get(sample),
        cache.get({ ...sample, id: 'alias-same-hash' }),
      ]);

      const stats = await store.stats();
      store.close();
      await deleteSampleDatabase({ dbName });

      return {
        sampleAdded: committed.sampleAdded,
        sampleId: committed.sampleId,
        instrumentId: committed.instrumentId,
        assignedInstrument: committed.project.song.tracks
          .find((track) => track.id === trackId).defaultInstrumentId,
        samples: committed.project.samples.length,
        instruments: committed.project.instruments.length,
        storageInserted: persisted.storage.inserted,
        storageCount: stats.count,
        decodes,
        sameDecodedObject: a === b && b === c,
        decodedByteLength: a.byteLength,
        cacheState: cache.getState(),
      };
    });

    expect(result.sampleAdded).toBe(true);
    expect(result.assignedInstrument).toBe(result.instrumentId);
    expect(result.storageInserted).toBe(true);
    expect(result.storageCount).toBe(1);
    expect(result.decodes).toBe(1);
    expect(result.sameDecodedObject).toBe(true);
    expect(result.decodedByteLength).toBeGreaterThan(44);
    expect(result.cacheState.decoded).toBe(1);
    expect(result.cacheState.pending).toBe(0);
  });
});
