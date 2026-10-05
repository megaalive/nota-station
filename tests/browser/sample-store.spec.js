import { test, expect } from '@playwright/test';

import { waitForApp } from './helpers.js';

test.describe('sample IndexedDB R2-S3', () => {
  test('persist, concurrent dedup, reload, dan bytes round-trip', async ({ page }) => {
    const dbName = `notastation-r2-s3-${test.info().project.name}`;

    await page.goto('./');
    await waitForApp(page);

    const first = await page.evaluate(async (name) => {
      const {
        deleteSampleDatabase,
        openSampleStore,
      } = await import('./src/storage/sample-store.js');
      const {
        prepareWavImport,
        persistPreparedWavImport,
      } = await import('./src/io/wav-import.js');

      await deleteSampleDatabase({ dbName: name }).catch(() => {});
      const store = await openSampleStore({ dbName: name });

      const channels = 1;
      const bits = 16;
      const sampleRate = 44100;
      const frames = 24;
      const blockAlign = channels * (bits / 8);
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
      for (let i = 44; i < bytes.length; i += 1) bytes[i] = (i * 23) & 0xff;

      const project = window.tracker.getProject();
      let seq = 0;
      const prepared = await prepareWavImport(project, {
        bytes,
        sourceFilename: 'Persist_Test.wav',
        idFactory: (prefix) => `${prefix}-persist-${++seq}`,
      });

      const [left, right] = await Promise.all([
        persistPreparedWavImport(prepared, bytes, store),
        persistPreparedWavImport(prepared, bytes, store),
      ]);

      const stats = await store.stats();
      const roundTrip = await store.getBytes(prepared.sample.storageRef.key);
      const record = await store.getRecord(prepared.sample.storageRef.key);
      store.close();

      return {
        dbName: name,
        key: prepared.sample.storageRef.key,
        contentHash: prepared.contentHash,
        inserted: [left.storage.inserted, right.storage.inserted],
        stats,
        sameBytes: roundTrip.length === bytes.length
          && roundTrip.every((value, index) => value === bytes[index]),
        record: {
          contentHash: record.contentHash,
          byteLength: record.byteLength,
          sourceFilename: record.sourceFilename,
        },
      };
    }, dbName);

    expect(first.inserted.filter(Boolean)).toHaveLength(1);
    expect(first.stats.count).toBe(1);
    expect(first.stats.bytes).toBeGreaterThan(44);
    expect(first.sameBytes).toBe(true);
    expect(first.record.contentHash).toBe(first.contentHash);
    expect(first.record.sourceFilename).toBe('Persist_Test.wav');

    await page.reload();
    await waitForApp(page);

    const afterReload = await page.evaluate(async ({ dbName: name, key }) => {
      const {
        deleteSampleDatabase,
        openSampleStore,
      } = await import('./src/storage/sample-store.js');
      const store = await openSampleStore({ dbName: name });
      const exists = await store.has(key);
      const bytes = await store.getBytes(key);
      const stats = await store.stats();
      const deleted = await store.delete(key);
      const existsAfterDelete = await store.has(key);
      store.close();
      await deleteSampleDatabase({ dbName: name });
      return {
        exists,
        byteLength: bytes?.byteLength ?? 0,
        stats,
        deleted,
        existsAfterDelete,
      };
    }, { dbName, key: first.key });

    expect(afterReload.exists).toBe(true);
    expect(afterReload.byteLength).toBe(first.record.byteLength);
    expect(afterReload.stats.count).toBe(1);
    expect(afterReload.deleted).toBe(true);
    expect(afterReload.existsAfterDelete).toBe(false);
  });

  test('persist menolak bytes yang berubah setelah prepare', async ({ page }) => {
    await page.goto('./');
    await waitForApp(page);

    const code = await page.evaluate(async () => {
      const { openSampleStore, deleteSampleDatabase } = await import('./src/storage/sample-store.js');
      const { prepareWavImport, persistPreparedWavImport } = await import('./src/io/wav-import.js');

      const dbName = 'notastation-r2-s3-hash-mismatch';
      await deleteSampleDatabase({ dbName }).catch(() => {});
      const store = await openSampleStore({ dbName });

      const bytes = new Uint8Array(46);
      const view = new DataView(bytes.buffer);
      const ascii = (offset, text) => {
        for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
      };
      ascii(0, 'RIFF');
      view.setUint32(4, 38, true);
      ascii(8, 'WAVE');
      ascii(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true);
      view.setUint32(28, 8000, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      ascii(36, 'data');
      view.setUint32(40, 2, true);
      bytes[44] = 128;
      bytes[45] = 129;

      const project = window.tracker.getProject();
      let seq = 0;
      const prepared = await prepareWavImport(project, {
        bytes,
        sourceFilename: 'Hash.wav',
        idFactory: (prefix) => `${prefix}-hash-${++seq}`,
      });
      const changed = bytes.slice();
      changed[45] ^= 1;

      try {
        await persistPreparedWavImport(prepared, changed, store);
        return null;
      } catch (error) {
        return error.code;
      } finally {
        store.close();
        await deleteSampleDatabase({ dbName });
      }
    });

    expect(code).toBe('E_WAV_HASH_MISMATCH');
  });
});
