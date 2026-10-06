import test from 'node:test';
import assert from 'node:assert/strict';

import {
  scheduleTrackMixEffect,
  scheduleTrackMixReset,
} from '../../src/audio/track-mix-effects.js';

function fakeParam() {
  const calls = [];
  return {
    calls,
    setValueAtTime(value, when) {
      calls.push({ value, when });
    },
  };
}

function fakeBus({ panner = true } = {}) {
  return {
    fxGain: { gain: fakeParam() },
    fxPanner: panner ? { pan: fakeParam() } : null,
  };
}

test('volume FX memetakan 0..127 ke gain 0..1 pada audio clock', () => {
  const bus = fakeBus();
  const result = scheduleTrackMixEffect(bus, {
    type: 'volume',
    value: { level: 64 },
  }, {
    when: 4,
    currentTime: 3,
  });

  assert.equal(result.type, 'volume');
  assert.equal(result.when, 4);
  assert.equal(result.value, 64 / 127);
  assert.deepEqual(bus.fxGain.gain.calls, [{ value: 64 / 127, when: 4 }]);
});

test('pan FX memetakan -64..64 ke -1..1 dan clamp waktu ke currentTime', () => {
  const bus = fakeBus();
  const result = scheduleTrackMixEffect(bus, {
    type: 'pan',
    value: { position: -32 },
  }, {
    when: 2,
    currentTime: 3,
  });

  assert.deepEqual(result, {
    type: 'pan',
    when: 3,
    value: -0.5,
    applied: true,
  });
  assert.deepEqual(bus.fxPanner.pan.calls, [{ value: -0.5, when: 3 }]);
});

test('pan fallback tanpa StereoPanner bersifat eksplisit dan tidak gagal', () => {
  const bus = fakeBus({ panner: false });
  const result = scheduleTrackMixEffect(bus, {
    type: 'pan',
    value: { position: 64 },
  }, {
    when: 1,
    currentTime: 0,
  });

  assert.equal(result.applied, false);
  assert.equal(result.value, 1);
});

test('reset mengembalikan gain 1 dan pan center pada waktu yang sama', () => {
  const bus = fakeBus();
  const when = scheduleTrackMixReset(bus, {
    when: 5,
    currentTime: 4,
  });

  assert.equal(when, 5);
  assert.deepEqual(bus.fxGain.gain.calls, [{ value: 1, when: 5 }]);
  assert.deepEqual(bus.fxPanner.pan.calls, [{ value: 0, when: 5 }]);
});

test('track mix helper fail-closed untuk bus, waktu, dan value invalid', () => {
  assert.throws(
    () => scheduleTrackMixEffect({}, {
      type: 'volume',
      value: { level: 64 },
    }, { when: 1 }),
    TypeError,
  );
  assert.throws(
    () => scheduleTrackMixEffect(fakeBus(), {
      type: 'volume',
      value: { level: 128 },
    }, { when: 1 }),
    TypeError,
  );
  assert.throws(
    () => scheduleTrackMixEffect(fakeBus(), {
      type: 'pan',
      value: { position: -65 },
    }, { when: 1 }),
    TypeError,
  );
  assert.throws(
    () => scheduleTrackMixEffect(fakeBus(), {
      type: 'cut',
      value: { afterTicks: 60 },
    }, { when: 1 }),
    TypeError,
  );
  assert.throws(
    () => scheduleTrackMixReset(fakeBus(), { when: Number.NaN }),
    TypeError,
  );
});
