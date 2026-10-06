import { projectError } from './project.js';

export const EFFECT_TYPES = Object.freeze([
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

const EFFECT_TYPE_SET = new Set(EFFECT_TYPES);

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isoNow() {
  return new Date().toISOString();
}

export function normalizeEffectValue(type, value) {
  if (!EFFECT_TYPE_SET.has(type)) {
    throw effectError('E_EFFECT_TYPE', `Effect type tidak dikenal: ${type}`);
  }
  assertPlainObject(value, 'value');

  if (type === 'volume') {
    assertExactKeys(value, ['level']);
    return Object.freeze({
      level: integerRange(value.level, 0, 127, 'volume.level'),
    });
  }
  if (type === 'pan') {
    assertExactKeys(value, ['position']);
    return Object.freeze({
      position: integerRange(value.position, -64, 64, 'pan.position'),
    });
  }
  if (type === 'pitchSlide') {
    assertExactKeys(value, ['semitones', 'durationTicks']);
    return Object.freeze({
      semitones: finiteRange(value.semitones, -48, 48, 'pitchSlide.semitones'),
      durationTicks: positiveInteger(value.durationTicks, 'pitchSlide.durationTicks'),
    });
  }
  if (type === 'porta') {
    assertExactKeys(value, ['targetPitch', 'durationTicks']);
    return Object.freeze({
      targetPitch: integerRange(value.targetPitch, 0, 127, 'porta.targetPitch'),
      durationTicks: positiveInteger(value.durationTicks, 'porta.durationTicks'),
    });
  }
  if (type === 'vibrato') {
    assertExactKeys(value, ['depthSemitones', 'rateHz']);
    return Object.freeze({
      depthSemitones: finiteRange(value.depthSemitones, 0, 12, 'vibrato.depthSemitones'),
      rateHz: finiteRange(value.rateHz, 0.1, 20, 'vibrato.rateHz'),
    });
  }
  if (type === 'retrigger') {
    assertExactKeys(value, ['intervalTicks', 'count']);
    return Object.freeze({
      intervalTicks: positiveInteger(value.intervalTicks, 'retrigger.intervalTicks'),
      count: integerRange(value.count, 1, 64, 'retrigger.count'),
    });
  }
  if (type === 'offset') {
    assertExactKeys(value, ['frames']);
    return Object.freeze({
      frames: integerRange(value.frames, 0, 0x7fffffff, 'offset.frames'),
    });
  }
  if (type === 'cut') {
    assertExactKeys(value, ['afterTicks']);
    return Object.freeze({
      afterTicks: nonNegativeInteger(value.afterTicks, 'cut.afterTicks'),
    });
  }
  if (type === 'delay') {
    assertExactKeys(value, ['ticks']);
    return Object.freeze({
      ticks: nonNegativeInteger(value.ticks, 'delay.ticks'),
    });
  }

  assertExactKeys(value, ['semitones', 'stepTicks']);
  if (
    !Array.isArray(value.semitones)
    || value.semitones.length < 2
    || value.semitones.length > 8
  ) {
    throw effectError(
      'E_EFFECT_VALUE',
      'arpeggio.semitones harus array berisi 2..8 interval.',
    );
  }
  const semitones = value.semitones.map((item, index) => (
    integerRange(item, -48, 48, `arpeggio.semitones[${index}]`)
  ));
  return Object.freeze({
    semitones: Object.freeze(semitones),
    stepTicks: positiveInteger(value.stepTicks, 'arpeggio.stepTicks'),
  });
}

export function validateEffectEvent(effect, {
  trackIds = null,
  patternLengthTicks = null,
} = {}) {
  assertPlainObject(effect, 'EffectEvent');
  assertEffectKeys(effect);
  if (typeof effect.id !== 'string' || effect.id.length === 0) {
    throw effectError('E_EFFECT_ID', 'EffectEvent.id harus string non-kosong.');
  }
  if (typeof effect.trackId !== 'string' || effect.trackId.length === 0) {
    throw effectError('E_EFFECT_TRACK', 'EffectEvent.trackId harus string non-kosong.');
  }
  if (trackIds && !trackIds.has(effect.trackId)) {
    throw effectError(
      'E_EFFECT_TRACK_REF',
      `Track EffectEvent tidak ditemukan: ${effect.trackId}`,
    );
  }
  if (!Number.isInteger(effect.tickLocal) || effect.tickLocal < 0) {
    throw effectError('E_EFFECT_TICK_RANGE', 'EffectEvent.tickLocal harus integer >= 0.');
  }
  if (
    Number.isInteger(patternLengthTicks)
    && effect.tickLocal >= patternLengthTicks
  ) {
    throw effectError(
      'E_EFFECT_TICK_RANGE',
      `EffectEvent.tickLocal melewati Pattern: ${effect.tickLocal}`,
    );
  }

  const value = normalizeEffectValue(effect.type, effect.value);
  validateDurationWithinPattern(effect.type, value, effect.tickLocal, patternLengthTicks);

  return Object.freeze({
    id: effect.id,
    trackId: effect.trackId,
    tickLocal: effect.tickLocal,
    type: effect.type,
    value,
  });
}

export function addPatternEffect(
  project,
  {
    patternId,
    trackId,
    tickLocal,
    type,
    value,
  },
  { idFactory = makeId, now = isoNow } = {},
) {
  const { pattern, patternIndex } = resolvePattern(project, patternId);
  if (!project.song.tracks.some((track) => track.id === trackId)) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }

  const effect = validateEffectEvent({
    id: idFactory('effect'),
    trackId,
    tickLocal,
    type,
    value,
  }, {
    trackIds: new Set(project.song.tracks.map((track) => track.id)),
    patternLengthTicks: pattern.lengthTicks,
  });
  rejectDuplicateCell(pattern.effects, effect);

  const effects = [...pattern.effects, effect].sort(compareEffects);
  return replacePatternEffects(project, patternIndex, pattern, effects, now);
}

export function updatePatternEffect(
  project,
  {
    patternId,
    effectId,
    trackId,
    tickLocal,
    type,
    value,
  },
  { now = isoNow } = {},
) {
  const { pattern, patternIndex } = resolvePattern(project, patternId);
  const current = pattern.effects.find((effect) => effect.id === effectId);
  if (!current) {
    throw effectError('E_EFFECT_MISSING', `EffectEvent tidak ditemukan: ${effectId}`);
  }

  const next = validateEffectEvent({
    id: current.id,
    trackId: trackId ?? current.trackId,
    tickLocal: tickLocal ?? current.tickLocal,
    type: type ?? current.type,
    value: value ?? current.value,
  }, {
    trackIds: new Set(project.song.tracks.map((track) => track.id)),
    patternLengthTicks: pattern.lengthTicks,
  });
  rejectDuplicateCell(
    pattern.effects.filter((effect) => effect.id !== effectId),
    next,
  );

  if (sameEffect(current, next)) return project;
  const effects = pattern.effects
    .map((effect) => effect.id === effectId ? next : effect)
    .sort(compareEffects);
  return replacePatternEffects(project, patternIndex, pattern, effects, now);
}

export function deletePatternEffect(
  project,
  { patternId, effectId },
  { now = isoNow } = {},
) {
  const { pattern, patternIndex } = resolvePattern(project, patternId);
  const effects = pattern.effects.filter((effect) => effect.id !== effectId);
  if (effects.length === pattern.effects.length) return project;
  return replacePatternEffects(project, patternIndex, pattern, effects, now);
}

export function effectCellKey(effect) {
  return `${effect.trackId}|${effect.tickLocal}|${effect.type}`;
}

export function compareEffects(a, b) {
  return a.tickLocal - b.tickLocal
    || a.trackId.localeCompare(b.trackId)
    || EFFECT_TYPES.indexOf(a.type) - EFFECT_TYPES.indexOf(b.type)
    || a.id.localeCompare(b.id);
}

function resolvePattern(project, patternId) {
  const patternIndex = project.song.patterns.findIndex((pattern) => pattern.id === patternId);
  if (patternIndex < 0) {
    throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);
  }
  return {
    pattern: project.song.patterns[patternIndex],
    patternIndex,
  };
}

function replacePatternEffects(project, patternIndex, pattern, effects, now) {
  const patterns = [...project.song.patterns];
  patterns[patternIndex] = { ...pattern, effects };
  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
    },
  };
}

function rejectDuplicateCell(effects, candidate) {
  if (effects.some((effect) => effectCellKey(effect) === effectCellKey(candidate))) {
    throw effectError(
      'E_EFFECT_DUPLICATE_CELL',
      `Effect type ${candidate.type} sudah ada pada track/tick yang sama.`,
    );
  }
}

function validateDurationWithinPattern(type, value, tickLocal, patternLengthTicks) {
  if (!Number.isInteger(patternLengthTicks)) return;
  const durationTicks = (
    type === 'pitchSlide' || type === 'porta'
      ? value.durationTicks
      : null
  );
  if (durationTicks !== null && tickLocal + durationTicks > patternLengthTicks) {
    throw effectError(
      'E_EFFECT_DURATION_RANGE',
      `${type}.durationTicks melewati akhir Pattern.`,
    );
  }

  if (type === 'delay' && tickLocal + value.ticks >= patternLengthTicks) {
    throw effectError(
      'E_EFFECT_TIMING_RANGE',
      'delay.ticks membuat onset efektif berada di luar Pattern.',
    );
  }
  if (type === 'cut' && tickLocal + value.afterTicks > patternLengthTicks) {
    throw effectError(
      'E_EFFECT_TIMING_RANGE',
      'cut.afterTicks melewati akhir Pattern.',
    );
  }
}

function sameEffect(a, b) {
  return a.id === b.id
    && a.trackId === b.trackId
    && a.tickLocal === b.tickLocal
    && a.type === b.type
    && JSON.stringify(a.value) === JSON.stringify(b.value);
}

function assertEffectKeys(effect) {
  const expected = ['id', 'trackId', 'tickLocal', 'type', 'value'];
  const actual = Object.keys(effect).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length
    || actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw effectError(
      'E_EFFECT_SHAPE',
      'EffectEvent harus tepat berisi id, trackId, tickLocal, type, value.',
    );
  }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw effectError('E_EFFECT_VALUE', `${label} harus object.`);
  }
}

function assertExactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw effectError(
      'E_EFFECT_VALUE',
      `Field value EffectEvent harus tepat: ${expected.join(', ')}.`,
    );
  }
}

function integerRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw effectError('E_EFFECT_VALUE', `${label} harus integer ${min}..${max}.`);
  }
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw effectError('E_EFFECT_VALUE', `${label} harus integer >= 0.`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw effectError('E_EFFECT_VALUE', `${label} harus integer > 0.`);
  }
  return value;
}

function finiteRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw effectError('E_EFFECT_VALUE', `${label} harus angka ${min}..${max}.`);
  }
  return value;
}

function effectError(code, message) {
  const error = new Error(message);
  error.name = 'EffectModelError';
  error.code = code;
  return error;
}
