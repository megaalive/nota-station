import test from 'node:test';
import assert from 'node:assert/strict';

import { createBlankProject, activePattern, enterNote } from '../../src/core/project.js';
import { addPatternEffect } from '../../src/core/effect-model.js';
import {
  DEBUG_JSON_MAX_BYTES,
  debugJsonFilename,
  parseDebugProject,
  serializeDebugProject,
} from '../../src/io/debug-json.js';

function fixture() {
  let seq = 0;
  return createBlankProject({
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-05T00:00:00.000Z',
  });
}

test('JSON debug round-trip menjaga project secara semantik', () => {
  let project = fixture();
  const pattern = activePattern(project);
  project = enterNote(project, {
    patternId: pattern.id,
    trackId: project.song.tracks[0].id,
    row: 4,
    pitch: 64,
  });

  const text = serializeDebugProject(project);
  const restored = parseDebugProject(text);
  assert.deepEqual(restored, project);
  assert.equal(text.endsWith('\n'), true);
});

test('parser fail-closed pada JSON rusak, schema asing, reference rusak, dan absoluteTick', () => {
  assert.throws(() => parseDebugProject('{'), (e) => e.code === 'E_DEBUG_JSON_PARSE');

  const foreign = fixture();
  foreign.schemaVersion = 2;
  assert.throws(() => parseDebugProject(JSON.stringify(foreign)), (e) => e.code === 'E_DEBUG_JSON_SCHEMA');

  const brokenRef = fixture();
  brokenRef.song.order[0].patternId = 'hilang';
  assert.throws(() => parseDebugProject(JSON.stringify(brokenRef)), (e) => e.code === 'E_DEBUG_JSON_PATTERN_REF');

  const absolute = fixture();
  absolute.song.patterns[0].notes.push({
    id: 'n1',
    trackId: absolute.song.tracks[0].id,
    startTickLocal: 0,
    absoluteTick: 0,
    durationTicks: 120,
    pitch: 60,
    instrumentId: 'factory.basic',
    velocity: 100,
  });
  assert.throws(() => parseDebugProject(JSON.stringify(absolute)), (e) => e.code === 'E_DEBUG_JSON_ABSOLUTE_TICK');
});

test('JSON debug round-trip menjaga EffectEvent typed', () => {
  let project = fixture();
  const patternId = project.song.patterns[0].id;
  const trackId = project.song.tracks[0].id;
  project = addPatternEffect(project, {
    patternId,
    trackId,
    tickLocal: 120,
    type: 'vibrato',
    value: { depthSemitones: 0.5, rateHz: 5 },
  }, {
    idFactory: () => 'effect-debug-1',
    now: () => '2026-10-06T06:45:00.000Z',
  });

  const restored = parseDebugProject(serializeDebugProject(project));
  assert.deepEqual(restored.song.patterns[0].effects, [{
    id: 'effect-debug-1',
    trackId,
    tickLocal: 120,
    type: 'vibrato',
    value: { depthSemitones: 0.5, rateHz: 5 },
  }]);
});

test('parser menolak EffectEvent type/value/ref/tick/cell invalid', () => {
  const makeEffectProject = () => {
    const project = fixture();
    project.song.patterns[0].effects = [{
      id: 'effect-debug-1',
      trackId: project.song.tracks[0].id,
      tickLocal: 120,
      type: 'volume',
      value: { level: 100 },
    }];
    return project;
  };

  const badType = makeEffectProject();
  badType.song.patterns[0].effects[0].type = 'opaqueHex';
  assert.throws(
    () => parseDebugProject(JSON.stringify(badType)),
    (error) => error.code === 'E_DEBUG_JSON_EFFECT_TYPE',
  );

  const badValue = makeEffectProject();
  badValue.song.patterns[0].effects[0].value = { level: 999 };
  assert.throws(
    () => parseDebugProject(JSON.stringify(badValue)),
    (error) => error.code === 'E_DEBUG_JSON_EFFECT_VALUE',
  );

  const badTrack = makeEffectProject();
  badTrack.song.patterns[0].effects[0].trackId = 'missing';
  assert.throws(
    () => parseDebugProject(JSON.stringify(badTrack)),
    (error) => error.code === 'E_DEBUG_JSON_TRACK_REF',
  );

  const badTick = makeEffectProject();
  badTick.song.patterns[0].effects[0].tickLocal = badTick.song.patterns[0].lengthTicks;
  assert.throws(
    () => parseDebugProject(JSON.stringify(badTick)),
    (error) => error.code === 'E_DEBUG_JSON_EFFECT_TICK',
  );

  const duplicate = makeEffectProject();
  duplicate.song.patterns[0].effects.push({
    ...structuredClone(duplicate.song.patterns[0].effects[0]),
    id: 'effect-debug-2',
  });
  assert.throws(
    () => parseDebugProject(JSON.stringify(duplicate)),
    (error) => error.code === 'E_DEBUG_JSON_DUPLICATE_EFFECT_CELL',
  );
});

test('parser membatasi ukuran dan nama export aman', () => {
  const tooLarge = ' '.repeat(DEBUG_JSON_MAX_BYTES + 1);
  assert.throws(() => parseDebugProject(tooLarge), (e) => e.code === 'E_DEBUG_JSON_SIZE');

  const project = fixture();
  project.title = ' Lagu / Demo : 01 ';
  assert.equal(debugJsonFilename(project), 'Lagu-Demo-01.webtrack.json');
});


test('parser menormalisasi sound model R1 lama ke kontrak R2', () => {
  const project = fixture();
  project.samples = [{ id: 'factory.basic', factoryKey: 'basic', license: 'CC0-1.0' }];
  project.instruments = [{
    id: 'factory.basic',
    name: 'Basic',
    sampleId: 'factory.basic',
    rootPitch: 60,
  }];

  const restored = parseDebugProject(JSON.stringify(project));
  assert.equal(restored.samples[0].storageRef.kind, 'factory');
  assert.equal(restored.instruments[0].type, 'sampler');
  assert.equal(restored.instruments[0].zones[0].sampleId, 'factory.basic');
});

test('JSON debug menjaga warna Track dan menolak warna invalid', () => {
  const project = fixture();
  project.song.tracks[0].color = '#336699';

  const restored = parseDebugProject(serializeDebugProject(project));
  assert.equal(restored.song.tracks[0].color, '#336699');

  const invalid = fixture();
  invalid.song.tracks[0].color = 'red';
  assert.throws(
    () => parseDebugProject(JSON.stringify(invalid)),
    (error) => error.code === 'E_DEBUG_JSON_TRACK_COLOR',
  );
});

test('parser menolak default instrument track dan sample zone yang tidak ada', () => {
  const brokenTrack = fixture();
  brokenTrack.song.tracks[0].defaultInstrumentId = 'missing';
  assert.throws(
    () => parseDebugProject(JSON.stringify(brokenTrack)),
    (error) => error.code === 'E_DEBUG_JSON_INSTRUMENT_REF',
  );

  const brokenZone = fixture();
  brokenZone.instruments[0].zones[0].sampleId = 'missing';
  assert.throws(
    () => parseDebugProject(JSON.stringify(brokenZone)),
    (error) => error.code === 'E_DEBUG_JSON_SAMPLE_REF',
  );
});
