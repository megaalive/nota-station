import test from 'node:test';
import assert from 'node:assert/strict';

import {
  schedulePitchSlide,
  schedulePortamento,
  scheduleVibrato,
  semitoneRatio,
} from '../../src/audio/pitch-spike.js';

function fakeParam() {
  const calls = [];
  return {
    calls,
    cancelScheduledValues: (...args) => calls.push(['cancelScheduledValues', ...args]),
    setValueAtTime: (...args) => calls.push(['setValueAtTime', ...args]),
    exponentialRampToValueAtTime: (...args) => calls.push(['exponentialRampToValueAtTime', ...args]),
    setValueCurveAtTime: (...args) => calls.push(['setValueCurveAtTime', ...args]),
  };
}

test('semitoneRatio mengikuti equal temperament', () => {
  assert.equal(semitoneRatio(0), 1);
  assert.equal(semitoneRatio(12), 2);
  assert.ok(Math.abs(semitoneRatio(-12) - 0.5) < 1e-12);
});

test('pitch slide dan portamento memakai automation playbackRate yang positif', () => {
  const p1 = fakeParam();
  const slide = schedulePitchSlide(p1, {
    startTime: 1,
    duration: 0.5,
    fromSemitones: 0,
    toSemitones: 7,
  });
  assert.equal(p1.calls[0][0], 'cancelScheduledValues');
  assert.deepEqual(p1.calls[1], ['setValueAtTime', 1, 1]);
  assert.equal(p1.calls[2][0], 'exponentialRampToValueAtTime');
  assert.ok(slide.to > 1);

  const p2 = fakeParam();
  const porta = schedulePortamento(p2, {
    startTime: 2,
    duration: 0.25,
    fromPitch: 60,
    toPitch: 72,
  });
  assert.equal(porta.to, 2);
});

test('vibrato membuat kurva rasio periodik tanpa nilai non-positif', () => {
  const param = fakeParam();
  const result = scheduleVibrato(param, {
    startTime: 0,
    duration: 1,
    depthSemitones: 0.5,
    frequencyHz: 5,
  });
  assert.equal(param.calls[1][0], 'setValueCurveAtTime');
  assert.ok(result.curve.length > 100);
  assert.ok([...result.curve].every((value) => Number.isFinite(value) && value > 0));
  assert.ok(Math.max(...result.curve) > 1);
  assert.ok(Math.min(...result.curve) < 1);
});
