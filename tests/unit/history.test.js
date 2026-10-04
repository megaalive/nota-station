import test from 'node:test';
import assert from 'node:assert/strict';

import { createHistory } from '../../src/core/history.js';

test('commit lalu undo/redo memulihkan snapshot immutable', () => {
  const a = { value: 'a' };
  const b = { value: 'b' };
  const history = createHistory(a);

  assert.equal(history.current(), a);
  history.commit(b, 'ubah');
  assert.equal(history.current(), b);
  assert.equal(history.getState().canUndo, true);

  assert.equal(history.undo(), a);
  assert.equal(history.current(), a);
  assert.equal(history.getState().canRedo, true);

  assert.equal(history.redo(), b);
  assert.equal(history.current(), b);
});

test('commit baru setelah undo membuang redo branch', () => {
  const history = createHistory({ value: 0 });
  history.commit({ value: 1 }, 'satu');
  history.commit({ value: 2 }, 'dua');

  history.undo();
  assert.equal(history.getState().redoLabel, 'dua');

  history.commit({ value: 3 }, 'tiga');
  assert.equal(history.getState().canRedo, false);
  assert.equal(history.current().value, 3);
});

test('history membatasi jumlah snapshot lama', () => {
  const history = createHistory({ value: 0 }, { limit: 2 });
  history.commit({ value: 1 }, 'satu');
  history.commit({ value: 2 }, 'dua');
  history.commit({ value: 3 }, 'tiga');

  assert.equal(history.getState().undoDepth, 2);
  assert.equal(history.undo().value, 2);
  assert.equal(history.undo().value, 1);
  assert.equal(history.undo(), null);
});
