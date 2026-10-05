import test from 'node:test';
import assert from 'node:assert/strict';

import { sampleStorageKey } from '../../src/storage/sample-store.js';

test('sampleStorageKey menurunkan key hash-addressed yang stabil', () => {
  const hex = 'a'.repeat(64);
  assert.equal(sampleStorageKey(`sha256:${hex}`), hex);
});

test('sampleStorageKey menolak hash/key yang tidak kanonik', () => {
  for (const value of [
    null,
    '',
    'sha256:abc',
    `sha256:${'A'.repeat(64)}`,
    `md5:${'a'.repeat(64)}`,
  ]) {
    assert.throws(
      () => sampleStorageKey(value),
      (error) => error.code === 'E_SAMPLE_STORE_HASH',
    );
  }
});
