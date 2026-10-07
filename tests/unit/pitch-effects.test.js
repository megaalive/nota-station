import test from 'node:test';
import assert from 'node:assert/strict';

import {
  pitchOffsetAtTime,
  scheduleFinitePitchEffect,
  scheduleRepeatingPitchEffect,
  semitoneRatio,
} from '../../src/audio/pitch-effects.js';

function fakeParam() {
  const calls = [];
  return {
    calls,
    cancelScheduledValues(time) { calls.push(['cancel', time]); },
    setValueAtTime(value, time) { calls.push(['set', value, time]); },
    exponentialRampToValueAtTime(value, time) { calls.push(['exp', value, time]); },
    linearRampToValueAtTime(value, time) { calls.push(['linear', value, time]); },
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
  assert.deepEqual(param.calls.map((item) => item[0]), ['cancel', 'set', 'exp']);
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

test('automation finite dipotong pada note-off tanpa memperpanjang voice', () => {
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

test('vibrato mempertahankan base pitch dan menghasilkan automation siklik sampai voice end', () => {
  const param = fakeParam();
  const result = scheduleRepeatingPitchEffect(param, {
    type: 'vibrato',
    value: { depthSemitones: 2, rateHz: 5 },
  }, {
    when: 1,
    currentTime: 1,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 1.5,
    tickSeconds: 1 / 960,
    priorState: {
      kind: 'slide',
      startTime: 0,
      endTime: 2,
      fromSemitones: 0,
      toSemitones: 4,
    },
  });

  assert.equal(result.state.kind, 'vibrato');
  assert.equal(result.state.baseSemitones, 2);
  assert.equal(pitchOffsetAtTime(result.state, 1), 2);
  assert.ok(Math.abs(pitchOffsetAtTime(result.state, 1.05) - 4) < 1e-9);
  assert.equal(param.calls[0][0], 'cancel');
  assert.equal(param.calls[1][0], 'set');
  assert.ok(param.calls.some((call) => call[0] === 'linear'));
  assert.equal(param.calls.at(-1)[2], 1.5);
});

test('arpeggio mengulang interval typed pada tick step dan tetap relatif terhadap state sebelumnya', () => {
  const param = fakeParam();
  const result = scheduleRepeatingPitchEffect(param, {
    type: 'arpeggio',
    value: { semitones: [0, 4, 7], stepTicks: 120 },
  }, {
    when: 2,
    currentTime: 2,
    baseRate: 0.5,
    basePitch: 48,
    voiceEndTime: 2.51,
    tickSeconds: 1 / 480,
    priorState: { kind: 'static', offsetSemitones: 3 },
  });

  assert.equal(result.state.kind, 'arpeggio');
  assert.equal(result.state.baseSemitones, 3);
  const sets = param.calls.filter((call) => call[0] === 'set');
  assert.deepEqual(sets.map((call) => Number(call[2].toFixed(2))), [2, 2.25, 2.5]);
  assert.ok(Math.abs(sets[0][1] - 0.5 * semitoneRatio(3)) < 1e-12);
  assert.ok(Math.abs(sets[1][1] - 0.5 * semitoneRatio(7)) < 1e-12);
  assert.ok(Math.abs(sets[2][1] - 0.5 * semitoneRatio(10)) < 1e-12);
  assert.equal(pitchOffsetAtTime(result.state, 2.26), 7);
  assert.equal(pitchOffsetAtTime(result.state, 2.50), 10);
});

test('pitch effect berikutnya memotong vibrato pada offset aktual tanpa reset ke note pitch', () => {
  const vibratoParam = fakeParam();
  const vibrato = scheduleRepeatingPitchEffect(vibratoParam, {
    type: 'vibrato',
    value: { depthSemitones: 2, rateHz: 5 },
  }, {
    when: 0,
    currentTime: 0,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 2,
    tickSeconds: 1 / 960,
  });

  const portaParam = fakeParam();
  const porta = scheduleFinitePitchEffect(portaParam, {
    type: 'porta',
    value: { targetPitch: 55, durationTicks: 240 },
  }, {
    when: 0.05,
    currentTime: 0.05,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 2,
    tickSeconds: 1 / 960,
    priorState: vibrato.state,
  });

  assert.ok(Math.abs(porta.fromSemitones - 2) < 1e-9);
  assert.equal(porta.toSemitones, -5);
});

test('pitch effect berikutnya memotong arpeggio pada step aktif', () => {
  const arpParam = fakeParam();
  const arp = scheduleRepeatingPitchEffect(arpParam, {
    type: 'arpeggio',
    value: { semitones: [0, 4, 7], stepTicks: 120 },
  }, {
    when: 0,
    currentTime: 0,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 2,
    tickSeconds: 1 / 480,
  });

  const slideParam = fakeParam();
  const slide = scheduleFinitePitchEffect(slideParam, {
    type: 'pitchSlide',
    value: { semitones: -2, durationTicks: 120 },
  }, {
    when: 0.26,
    currentTime: 0.26,
    baseRate: 1,
    basePitch: 60,
    voiceEndTime: 2,
    tickSeconds: 1 / 480,
    priorState: arp.state,
  });

  assert.equal(slide.fromSemitones, 4);
  assert.equal(slide.toSemitones, 2);
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
