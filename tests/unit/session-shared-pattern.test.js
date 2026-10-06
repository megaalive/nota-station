import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHARED_PATTERN_SESSION_KEY,
  restoreSessionSharedPatternGuard,
  saveSessionSharedPatternGuard,
} from '../../src/storage/session-shared-pattern.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test('shared guard session round-trip menyimpan patternId yang diizinkan', () => {
  const storage = memoryStorage();
  const state = { allowedPatternIds: ['pattern-1', 'pattern-2'] };

  assert.deepEqual(saveSessionSharedPatternGuard(state, { storage }), {
    saved: true,
    reason: null,
  });
  assert.deepEqual(restoreSessionSharedPatternGuard({ storage }), state);
});

test('shared guard session invalid dibuang fail-closed', () => {
  const storage = memoryStorage();
  storage.setItem(SHARED_PATTERN_SESSION_KEY, '{"version":1,"allowedPatternIds":[42]}');

  assert.throws(
    () => restoreSessionSharedPatternGuard({ storage }),
    (error) => error.code === 'E_SESSION_SHARED_PATTERN_INVALID',
  );
  assert.equal(storage.getItem(SHARED_PATTERN_SESSION_KEY), null);
});

test('shared guard session membatasi jumlah ID', () => {
  const storage = memoryStorage();
  const ids = Array.from({ length: 129 }, (_, index) => `pattern-${index}`);

  assert.throws(
    () => saveSessionSharedPatternGuard({ allowedPatternIds: ids }, { storage }),
    (error) => error.code === 'E_SESSION_SHARED_PATTERN_INVALID',
  );
});

test('storage unavailable fail-soft', () => {
  assert.deepEqual(
    saveSessionSharedPatternGuard({ allowedPatternIds: [] }, { storage: null }),
    { saved: false, reason: 'unavailable' },
  );
  assert.equal(restoreSessionSharedPatternGuard({ storage: null }), null);
});
