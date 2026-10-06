import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EFFECT_UI,
  effectCode,
  effectTypeFromCode,
  formatEffectParam,
  parseEffectParam,
  summarizeEffects,
} from '../../src/core/effect-display.js';

const CASES = [
  ['volume', { level: 80 }, '80'],
  ['pan', { position: -16 }, '-16'],
  ['pitchSlide', { semitones: 2, durationTicks: 120 }, '+2/120t'],
  ['porta', { targetPitch: 64, durationTicks: 240 }, '64/240t'],
  ['vibrato', { depthSemitones: 0.5, rateHz: 5 }, '0.5/5Hz'],
  ['retrigger', { intervalTicks: 60, count: 4 }, '60t×4'],
  ['offset', { frames: 1024 }, '1024f'],
  ['cut', { afterTicks: 180 }, '180t'],
  ['delay', { ticks: 30 }, '30t'],
  ['arpeggio', { semitones: [0, 4, 7], stepTicks: 120 }, '0,+4,+7/120t'],
];

test('seluruh EffectEvent memiliki mnemonic UI unik', () => {
  const codes = Object.values(EFFECT_UI).map((item) => item.code);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);

  for (const [type] of CASES) {
    assert.equal(effectTypeFromCode(effectCode(type)), type);
  }
});

test('format dan parse PARAM round-trip untuk seluruh effect v0.1', () => {
  for (const [type, value, expected] of CASES) {
    assert.equal(formatEffectParam(type, value), expected, type);
    assert.deepEqual(parseEffectParam(type, expected), value, type);
  }
});

test('parser menerima unit opsional dan tetap divalidasi typed', () => {
  assert.deepEqual(parseEffectParam('cut', '60'), { afterTicks: 60 });
  assert.deepEqual(parseEffectParam('vibrato', '1.25/6'), {
    depthSemitones: 1.25,
    rateHz: 6,
  });
  assert.throws(
    () => parseEffectParam('volume', '200'),
    (error) => error.code === 'E_EFFECT_PARAM',
  );
  assert.throws(
    () => parseEffectParam('arpeggio', '0/120t'),
    (error) => error.code === 'E_EFFECT_PARAM',
  );
});

test('summarizeEffects tidak menyembunyikan beberapa effect pada cell yang sama', () => {
  const summary = summarizeEffects([
    { id: 'b', type: 'pan', value: { position: 16 } },
    { id: 'a', type: 'volume', value: { level: 90 } },
  ]);

  assert.equal(summary.fx, 'PAN+VOL');
  assert.equal(summary.param, '+16 | 90');
  assert.equal(summary.title, 'PAN +16 · VOL 90');
});
