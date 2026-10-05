import test from 'node:test';
import assert from 'node:assert/strict';

import { activePattern } from '../../src/core/project.js';
import {
  createDemoProject,
  STABILITY_DEMO_ID,
  STABILITY_DEMO_INSTRUMENTS,
} from '../../src/core/demos.js';

function opts() {
  let seq = 0;
  return {
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-05T01:30:00.000Z',
  };
}

test('stability demo adalah loop musikal 4 bar dengan delapan channel aktif', () => {
  const project = createDemoProject(STABILITY_DEMO_ID, opts());
  const pattern = activePattern(project);

  assert.equal(project.title, 'Malam Kota — Stability Loop');
  assert.equal(project.song.initial.tempo, 116);
  assert.equal(project.song.initial.key, 'Am');
  assert.deepEqual(project.song.initial.meter, { num: 4, den: 4 });
  assert.equal(pattern.lengthTicks / pattern.rowTicks, 64);
  assert.deepEqual(
    project.song.tracks.map((track) => track.name),
    ['Kick Pulse', 'Snare Pulse', 'Hi-Hat', 'Bass', 'Arpeggio', 'Lead', 'Harmony', 'Fill'],
  );

  const activeTracks = new Set(pattern.notes.map((note) => note.trackId));
  assert.equal(activeTracks.size, 8);
  assert.deepEqual(
    project.song.tracks.map((track) => track.defaultInstrumentId),
    STABILITY_DEMO_INSTRUMENTS.map((instrument) => instrument.id),
  );
  assert.equal(new Set(pattern.notes.map((note) => note.instrumentId)).size, 8);
  assert.ok(pattern.notes.length >= 120);
  assert.ok(pattern.notes.every((note) => !Object.hasOwn(note, 'absoluteTick')));

  const cells = new Set(pattern.notes.map((note) => `${note.trackId}|${note.startTickLocal}`));
  assert.equal(cells.size, pattern.notes.length);
});

test('demo asing ditolak tanpa memperluas kontrak template R1', () => {
  assert.throws(
    () => createDemoProject('demo-lain', opts()),
    (error) => error.code === 'E_DEMO_UNKNOWN',
  );
});
