import test from 'node:test';
import assert from 'node:assert/strict';

import { playheadFollowScrollTop } from '../../src/ui/playhead-follow.js';

const geometry = {
  rowCount: 64,
  rowHeight: 28,
  headerHeight: 92,
  clientHeight: 428,
};

test('awal Pattern: playhead turun sebelum viewport mulai scroll', () => {
  assert.equal(playheadFollowScrollTop({ ...geometry, row: 0 }), 0);
  assert.equal(playheadFollowScrollTop({ ...geometry, row: 5 }), 0);
  assert.equal(playheadFollowScrollTop({ ...geometry, row: 6 }), 14);
});

test('bagian tengah: scroll maju satu row saat playhead tetap di tengah', () => {
  const row20 = playheadFollowScrollTop({ ...geometry, row: 20 });
  const row21 = playheadFollowScrollTop({ ...geometry, row: 21 });
  assert.equal(row21 - row20, geometry.rowHeight);
});

test('akhir Pattern: scroll mentok lalu playhead turun menuju row terakhir', () => {
  const viewport = geometry.clientHeight - geometry.headerHeight;
  const max = geometry.rowCount * geometry.rowHeight - viewport;
  assert.equal(playheadFollowScrollTop({ ...geometry, row: 58 }), max);
  assert.equal(playheadFollowScrollTop({ ...geometry, row: 63 }), max);
});

test('Pattern lebih pendek dari viewport tidak pernah dipaksa scroll', () => {
  assert.equal(playheadFollowScrollTop({
    row: 7,
    rowCount: 8,
    rowHeight: 28,
    headerHeight: 92,
    clientHeight: 600,
  }), 0);
});
