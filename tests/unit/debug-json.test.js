import test from 'node:test';
import assert from 'node:assert/strict';

import { createBlankProject, activePattern, enterNote } from '../../src/core/project.js';
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

test('parser membatasi ukuran dan nama export aman', () => {
  const tooLarge = ' '.repeat(DEBUG_JSON_MAX_BYTES + 1);
  assert.throws(() => parseDebugProject(tooLarge), (e) => e.code === 'E_DEBUG_JSON_SIZE');

  const project = fixture();
  project.title = ' Lagu / Demo : 01 ';
  assert.equal(debugJsonFilename(project), 'Lagu-Demo-01.webtrack.json');
});
