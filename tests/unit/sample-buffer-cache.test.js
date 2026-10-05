import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProjectSampleBytesLoader,
  createSampleBufferCache,
} from '../../src/audio/sample-buffer-cache.js';
import { createFactoryBasicSample } from '../../src/core/sound-model.js';

const HASH = `sha256:${'a'.repeat(64)}`;

test('concurrent get untuk contentHash sama hanya load+decode sekali', async () => {
  let loads = 0;
  let decodes = 0;
  const cache = createSampleBufferCache({
    loadBytes: async () => {
      loads += 1;
      await Promise.resolve();
      return new Uint8Array([1, 2, 3, 4]);
    },
    decodeBytes: async (bytes) => {
      decodes += 1;
      return { token: 'decoded', byteLength: bytes.byteLength };
    },
  });

  const a = { id: 'sample-a', contentHash: HASH };
  const b = { id: 'sample-b', contentHash: HASH };
  const [left, right] = await Promise.all([cache.get(a), cache.get(b)]);

  assert.equal(left, right);
  assert.equal(loads, 1);
  assert.equal(decodes, 1);
  assert.deepEqual(cache.getState(), {
    decoded: 1,
    pending: 0,
    loadCount: 1,
    decodeCount: 1,
    hashes: [HASH],
  });

  assert.equal(await cache.get(a), left);
  assert.equal(loads, 1);
  assert.equal(decodes, 1);
});

test('failure tidak meracuni cache dan retry boleh berhasil', async () => {
  let attempt = 0;
  const cache = createSampleBufferCache({
    loadBytes: async () => new Uint8Array([9]),
    decodeBytes: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('decode gagal sekali');
      return { ok: true };
    },
  });
  const sample = { id: 'sample-retry', contentHash: HASH };

  await assert.rejects(
    () => cache.get(sample),
    (error) => error.code === 'E_SAMPLE_CACHE_LOAD',
  );
  assert.equal(cache.getState().decoded, 0);
  assert.deepEqual(await cache.get(sample), { ok: true });
  assert.equal(cache.getState().decodeCount, 2);
});

test('loader membaca factory lazy dan IndexedDB melalui sampleStore', async () => {
  const calls = [];
  const loader = createProjectSampleBytesLoader({
    sampleStore: {
      async getBytes(key) {
        calls.push(key);
        return new Uint8Array([5, 6, 7]);
      },
    },
  });

  const factory = createFactoryBasicSample();
  const firstFactory = await loader(factory);
  const secondFactory = await loader(factory);
  assert.ok(firstFactory.byteLength > 44);
  assert.equal(firstFactory.byteLength, secondFactory.byteLength);

  const custom = {
    id: 'custom',
    contentHash: HASH,
    storageRef: { kind: 'indexeddb', key: 'a'.repeat(64) },
  };
  const bytes = new Uint8Array(await loader(custom));
  assert.deepEqual([...bytes], [5, 6, 7]);
  assert.deepEqual(calls, ['a'.repeat(64)]);
});

test('loader menolak sample IndexedDB yang hilang', async () => {
  const loader = createProjectSampleBytesLoader({
    sampleStore: { async getBytes() { return null; } },
  });
  await assert.rejects(
    () => loader({
      id: 'missing',
      contentHash: HASH,
      storageRef: { kind: 'indexeddb', key: 'a'.repeat(64) },
    }),
    (error) => error.code === 'E_SAMPLE_CACHE_MISSING',
  );
});
