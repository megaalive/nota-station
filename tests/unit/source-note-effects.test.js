import test from 'node:test';
import assert from 'node:assert/strict';

import {
  expandRetriggerTicks,
  sampleOffsetSeconds,
} from '../../src/audio/source-note-effects.js';

test('retrigger count berarti jumlah pengulangan tambahan', () => {
  assert.deepEqual(expandRetriggerTicks({
    startTick: 120,
    durationTicks: 360,
    patternLengthTicks: 1920,
    intervalTicks: 90,
    count: 3,
  }), [120, 210, 300, 390]);
});

test('retrigger berhenti pada tail note dan batas Pattern', () => {
  assert.deepEqual(expandRetriggerTicks({
    startTick: 1800,
    durationTicks: 240,
    patternLengthTicks: 1920,
    intervalTicks: 60,
    count: 8,
  }), [1800, 1860]);
  assert.deepEqual(expandRetriggerTicks({
    startTick: 0,
    durationTicks: 120,
    patternLengthTicks: 1920,
    intervalTicks: 120,
    count: 4,
  }), [0]);
});

test('sample offset frames dikonversi ke detik dan out-of-buffer menjadi silence', () => {
  assert.equal(sampleOffsetSeconds(24000, 48000, 1), 0.5);
  assert.equal(sampleOffsetSeconds(48000, 48000, 1), null);
  assert.equal(sampleOffsetSeconds(60000, 48000, 1), null);
});
