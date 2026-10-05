import test from 'node:test';
import assert from 'node:assert/strict';

import { createBlankProject } from '../../src/core/project.js';
import {
  SESSION_PROJECT_KEY,
  clearSessionProject,
  restoreSessionProject,
  saveSessionProject,
} from '../../src/storage/session-project.js';

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

function fixture() {
  let seq = 0;
  return createBlankProject({
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-05T12:20:00.000Z',
  });
}

test('session project round-trip memakai validator JSON kanonik', () => {
  const storage = memoryStorage();
  const project = fixture();

  const result = saveSessionProject(project, { storage });
  assert.equal(result.saved, true);
  assert.ok(result.bytes > 0);
  assert.ok(storage.getItem(SESSION_PROJECT_KEY));

  const restored = restoreSessionProject({ storage });
  assert.deepEqual(restored, project);
});

test('session project invalid dibuang fail-closed', () => {
  const storage = memoryStorage();
  storage.setItem(SESSION_PROJECT_KEY, '{"schemaVersion":999}');

  assert.throws(
    () => restoreSessionProject({ storage }),
    (error) => error.code === 'E_SESSION_PROJECT_INVALID',
  );
  assert.equal(storage.getItem(SESSION_PROJECT_KEY), null);
});

test('storage unavailable tidak memblokir aplikasi dan clear idempotent', () => {
  const project = fixture();
  assert.deepEqual(saveSessionProject(project, { storage: null }), {
    saved: false,
    reason: 'unavailable',
    bytes: 0,
  });
  assert.equal(restoreSessionProject({ storage: null }), null);
  assert.equal(clearSessionProject({ storage: null }), false);

  const storage = memoryStorage();
  assert.equal(clearSessionProject({ storage }), false);
  saveSessionProject(project, { storage });
  assert.equal(clearSessionProject({ storage }), true);
  assert.equal(clearSessionProject({ storage }), false);
});

test('quota write dipetakan ke error stabil', () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    const error = new Error('penuh');
    error.name = 'QuotaExceededError';
    throw error;
  };

  assert.throws(
    () => saveSessionProject(fixture(), { storage }),
    (error) => error.code === 'E_SESSION_PROJECT_QUOTA',
  );
});
