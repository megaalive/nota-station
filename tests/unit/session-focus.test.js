import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOCUS_SESSION_KEY,
  restoreSessionFocus,
  saveSessionFocus,
} from '../../src/storage/session-focus.js';

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

test('session focus round-trip hanya menyimpan orderEntryId', () => {
  const storage = memoryStorage();
  const result = saveSessionFocus({ orderEntryId: 'order-2' }, { storage });
  assert.equal(result.saved, true);
  assert.ok(storage.getItem(FOCUS_SESSION_KEY));

  assert.deepEqual(restoreSessionFocus({ storage }), {
    orderEntryId: 'order-2',
  });
});

test('session focus invalid dibuang fail-closed', () => {
  const storage = memoryStorage();
  storage.setItem(FOCUS_SESSION_KEY, '{"version":99,"orderEntryId":42}');

  assert.throws(
    () => restoreSessionFocus({ storage }),
    (error) => error.code === 'E_SESSION_FOCUS_INVALID',
  );
  assert.equal(storage.getItem(FOCUS_SESSION_KEY), null);
});

test('storage focus unavailable bersifat fail-soft pada save dan null pada restore', () => {
  assert.deepEqual(saveSessionFocus({ orderEntryId: 'order-1' }, { storage: null }), {
    saved: false,
    reason: 'unavailable',
  });
  assert.equal(restoreSessionFocus({ storage: null }), null);
});
