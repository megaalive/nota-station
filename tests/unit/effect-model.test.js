import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EFFECT_TYPES,
  addPatternEffect,
  deletePatternEffect,
  normalizeEffectValue,
  updatePatternEffect,
  validateEffectEvent,
} from '../../src/core/effect-model.js';
import { createBlankProject } from '../../src/core/project.js';

function ids() {
  let seq = 0;
  return (prefix) => `${prefix}-fx-${++seq}`;
}

function fixture() {
  const idFactory = ids();
  const now = () => '2026-10-06T06:30:00.000Z';
  const project = createBlankProject({ idFactory, now });
  return {
    project,
    patternId: project.song.patterns[0].id,
    trackId: project.song.tracks[0].id,
    idFactory,
    now,
  };
}

test('EFFECT_TYPES memuat tepat subset v0.1 PLAN', () => {
  assert.deepEqual(EFFECT_TYPES, [
    'volume',
    'pan',
    'pitchSlide',
    'porta',
    'vibrato',
    'retrigger',
    'offset',
    'cut',
    'delay',
    'arpeggio',
  ]);
});

test('normalizeEffectValue menghasilkan shape kanonik per type', () => {
  assert.deepEqual(normalizeEffectValue('volume', { level: 96 }), { level: 96 });
  assert.deepEqual(normalizeEffectValue('pan', { position: -32 }), { position: -32 });
  assert.deepEqual(
    normalizeEffectValue('pitchSlide', { semitones: -7, durationTicks: 240 }),
    { semitones: -7, durationTicks: 240 },
  );
  assert.deepEqual(
    normalizeEffectValue('porta', { targetPitch: 67, durationTicks: 480 }),
    { targetPitch: 67, durationTicks: 480 },
  );
  assert.deepEqual(
    normalizeEffectValue('vibrato', { depthSemitones: 0.5, rateHz: 5 }),
    { depthSemitones: 0.5, rateHz: 5 },
  );
  assert.deepEqual(
    normalizeEffectValue('retrigger', { intervalTicks: 60, count: 4 }),
    { intervalTicks: 60, count: 4 },
  );
  assert.deepEqual(normalizeEffectValue('offset', { frames: 2048 }), { frames: 2048 });
  assert.deepEqual(normalizeEffectValue('cut', { afterTicks: 30 }), { afterTicks: 30 });
  assert.deepEqual(normalizeEffectValue('delay', { ticks: 23 }), { ticks: 23 });
  assert.deepEqual(
    normalizeEffectValue('arpeggio', { semitones: [0, 4, 7], stepTicks: 40 }),
    { semitones: [0, 4, 7], stepTicks: 40 },
  );
});

test('validator type-specific menolak range/shape ambigu', () => {
  const base = {
    id: 'fx-1',
    trackId: 'track-1',
    tickLocal: 120,
  };

  const bad = [
    { ...base, type: 'volume', value: { level: 128 } },
    { ...base, type: 'pan', value: { position: 65 } },
    { ...base, type: 'pitchSlide', value: { semitones: 80, durationTicks: 120 } },
    { ...base, type: 'porta', value: { targetPitch: 128, durationTicks: 120 } },
    { ...base, type: 'vibrato', value: { depthSemitones: 0.5, rateHz: 0 } },
    { ...base, type: 'retrigger', value: { intervalTicks: 0, count: 4 } },
    { ...base, type: 'offset', value: { frames: -1 } },
    { ...base, type: 'cut', value: { afterTicks: -1 } },
    { ...base, type: 'delay', value: { ticks: -1 } },
    { ...base, type: 'arpeggio', value: { semitones: [0], stepTicks: 40 } },
    { ...base, type: 'unknown', value: {} },
  ];

  for (const effect of bad) {
    assert.throws(
      () => validateEffectEvent(effect, { patternLengthTicks: 7680 }),
      (error) => error.code?.startsWith('E_EFFECT_'),
      effect.type,
    );
  }
});

test('add/update/delete EffectEvent immutable dan deterministic', () => {
  const { project, patternId, trackId, idFactory, now } = fixture();

  let next = addPatternEffect(project, {
    patternId,
    trackId,
    tickLocal: 240,
    type: 'pan',
    value: { position: -16 },
  }, { idFactory, now });
  next = addPatternEffect(next, {
    patternId,
    trackId,
    tickLocal: 120,
    type: 'volume',
    value: { level: 80 },
  }, { idFactory, now });

  const original = project.song.patterns[0];
  assert.equal(original.effects.length, 0);
  const pattern = next.song.patterns.find((item) => item.id === patternId);
  assert.deepEqual(pattern.effects.map((effect) => [effect.tickLocal, effect.type]), [
    [120, 'volume'],
    [240, 'pan'],
  ]);

  const volumeId = pattern.effects[0].id;
  const updated = updatePatternEffect(next, {
    patternId,
    effectId: volumeId,
    tickLocal: 360,
    value: { level: 100 },
  }, { now });
  const updatedEffect = updated.song.patterns
    .find((item) => item.id === patternId)
    .effects.find((effect) => effect.id === volumeId);
  assert.deepEqual(updatedEffect, {
    id: volumeId,
    trackId,
    tickLocal: 360,
    type: 'volume',
    value: { level: 100 },
  });

  const removed = deletePatternEffect(updated, {
    patternId,
    effectId: volumeId,
  }, { now });
  assert.equal(
    removed.song.patterns.find((item) => item.id === patternId).effects.length,
    1,
  );
});

test('EffectEvent menolak duplicate track+tick+type tetapi mengizinkan type berbeda', () => {
  const { project, patternId, trackId, idFactory, now } = fixture();
  let next = addPatternEffect(project, {
    patternId,
    trackId,
    tickLocal: 120,
    type: 'volume',
    value: { level: 80 },
  }, { idFactory, now });

  assert.throws(
    () => addPatternEffect(next, {
      patternId,
      trackId,
      tickLocal: 120,
      type: 'volume',
      value: { level: 90 },
    }, { idFactory, now }),
    (error) => error.code === 'E_EFFECT_DUPLICATE_CELL',
  );

  next = addPatternEffect(next, {
    patternId,
    trackId,
    tickLocal: 120,
    type: 'pan',
    value: { position: 0 },
  }, { idFactory, now });
  assert.equal(next.song.patterns[0].effects.length, 2);
});

test('EffectEvent track/tick/reference invalid fail-closed', () => {
  const { project, patternId, trackId, idFactory, now } = fixture();

  assert.throws(
    () => addPatternEffect(project, {
      patternId,
      trackId: 'missing',
      tickLocal: 0,
      type: 'volume',
      value: { level: 100 },
    }, { idFactory, now }),
    (error) => error.code === 'E_PROJECT_TRACK_MISSING',
  );
  assert.throws(
    () => addPatternEffect(project, {
      patternId,
      trackId,
      tickLocal: project.song.patterns[0].lengthTicks,
      type: 'volume',
      value: { level: 100 },
    }, { idFactory, now }),
    (error) => error.code === 'E_EFFECT_TICK_RANGE',
  );
});


test('delay dan cut tidak boleh menjadwalkan timing efektif di luar Pattern', () => {
  const base = {
    id: 'fx-timing',
    trackId: 'track-1',
    tickLocal: 7600,
  };

  assert.throws(
    () => validateEffectEvent({
      ...base,
      type: 'delay',
      value: { ticks: 80 },
    }, { patternLengthTicks: 7680 }),
    (error) => error.code === 'E_EFFECT_TIMING_RANGE',
  );

  assert.doesNotThrow(() => validateEffectEvent({
    ...base,
    type: 'cut',
    value: { afterTicks: 80 },
  }, { patternLengthTicks: 7680 }));

  assert.throws(
    () => validateEffectEvent({
      ...base,
      type: 'cut',
      value: { afterTicks: 81 },
    }, { patternLengthTicks: 7680 }),
    (error) => error.code === 'E_EFFECT_TIMING_RANGE',
  );
});
