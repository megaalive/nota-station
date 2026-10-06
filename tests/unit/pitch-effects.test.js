import test from 'node:test';
import assert from 'node:assert/strict';

import {
  pitchOffsetAtTime,
  scheduleFinitePitchEffect,
  semitoneRatio,
} from '../../src/audio/pitch-effects.js';

function fakeParam() {
  const calls = [];
  return {
    calls,
    cancelScheduledValues(time) { calls.push(['cancel', time]); },
    setValueAtTime(value, time) { calls.push(['set', value, time]); },
    exponentialRampToValueAtTime(value, time) { calls.push(['ramp', value, time]); },
  };
}

test('pitch slide berjalan relatif dari state pitch saat efek mulai', () => {
  const param = fakeParam();
  const prior = {
    kind: 'slide',
    startTime: 1,
    endTime: 3,
    fromSemitones: 0,
    toSemitones: 4,
  };

  const result = scheduleFinitePitchEffect(param, {
    type: 'pitchSlide',
    value: { semitones: 7, durationTicks: 240 },
  }, {
    when: 2,
    currentTime: 2,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 4,
    tickSeconds: 1 / 960,
    priorState: prior,
  });

  assert.equal(result.fromSemitones, 2);
  assert.equal(result.toSemitones, 9);
  assert.ok(Math.abs(result.toRate - semitoneRatio(9)) < 1e-12);
  assert.deepEqual(param.calls.map((item) => item[0]), ['cancel', 'set', 'ramp']);
});

test('portamento menuju targetPitch absolut terhadap pitch dasar voice', () => {
  const param = fakeParam();
  const result = scheduleFinitePitchEffect(param, {
    type: 'porta',
    value: { targetPitch: 72, durationTicks: 480 },
  }, {
    when: 0.5,
    currentTime: 0.5,
    baseRate: 0.75,
    basePitch: 60,
    voiceEndTime: 2,
    tickSeconds: 1 / 960,
  });

  assert.equal(result.fromSemitones, 0);
  assert.equal(result.toSemitones, 12);
  assert.ok(Math.abs(result.toRate - 1.5) < 1e-12);
});

test('automation dipotong pada note-off tanpa memperpanjang voice', () => {
  const param = fakeParam();
  const result = scheduleFinitePitchEffect(param, {
    type: 'pitchSlide',
    value: { semitones: 12, durationTicks: 960 },
  }, {
    when: 0,
    currentTime: 0,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 0.25,
    tickSeconds: 1 / 960,
  });

  assert.equal(result.truncated, true);
  assert.equal(result.endTime, 0.25);
  assert.equal(result.toSemitones, 3);
});

test('effect setelah note-off tidak menjadwalkan AudioParam', () => {
  const param = fakeParam();
  const result = scheduleFinitePitchEffect(param, {
    type: 'pitchSlide',
    value: { semitones: 3, durationTicks: 120 },
  }, {
    when: 1,
    currentTime: 1,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 1,
    tickSeconds: 1 / 960,
  });

  assert.equal(result.applied, false);
  assert.equal(param.calls.length, 0);
});

test('pitchOffsetAtTime menginterpolasi semitone, bukan rasio playbackRate', () => {
  const state = {
    kind: 'slide',
    startTime: 2,
    endTime: 4,
    fromSemitones: -2,
    toSemitones: 6,
  };
  assert.equal(pitchOffsetAtTime(state, 1), -2);
  assert.equal(pitchOffsetAtTime(state, 3), 2);
  assert.equal(pitchOffsetAtTime(state, 5), 6);
});
