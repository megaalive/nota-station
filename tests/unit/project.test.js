import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CHANNELS,
  DEFAULT_ROWS,
  DEFAULT_ROW_TICKS,
  activePattern,
  createBlankProject,
  enterNote,
  noteAtCell,
} from '../../src/core/project.js';

function fixture() {
  let seq = 0;
  return createBlankProject({
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-04T00:00:00.000Z',
  });
}

test('project kosong R1 punya 8 channel, 64 row, dan satu occurrence', () => {
  const project = fixture();
  const pattern = activePattern(project);

  assert.equal(project.song.tracks.length, DEFAULT_CHANNELS);
  assert.equal(pattern.lengthTicks / pattern.rowTicks, DEFAULT_ROWS);
  assert.equal(pattern.rowTicks, DEFAULT_ROW_TICKS);
  assert.equal(project.song.order.length, 1);
  assert.equal(project.song.initial.tempo, 120);
});

test('enterNote menulis NoteEvent pattern-local dengan durationTicks kanonik', () => {
  const project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[2].id;

  const next = enterNote(
    project,
    { patternId: pattern.id, trackId, row: 5, pitch: 64 },
    { idFactory: () => 'note-fixed', now: () => '2026-10-04T00:01:00.000Z' },
  );

  const note = noteAtCell(next, { patternId: pattern.id, trackId, row: 5 });
  assert.equal(note.id, 'note-fixed');
  assert.equal(note.startTickLocal, 5 * DEFAULT_ROW_TICKS);
  assert.equal(note.durationTicks, DEFAULT_ROW_TICKS);
  assert.equal(note.pitch, 64);
  assert.equal('absoluteTick' in note, false);
  assert.equal(project.song.patterns[0].notes.length, 0, 'input tidak dimutasi');
});

test('mengetik ulang sel yang sama mengganti pitch tanpa membuat note duplikat', () => {
  let project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;

  project = enterNote(project, { patternId: pattern.id, trackId, row: 0, pitch: 60 });
  const firstId = project.song.patterns[0].notes[0].id;
  project = enterNote(project, { patternId: pattern.id, trackId, row: 0, pitch: 67 });

  assert.equal(project.song.patterns[0].notes.length, 1);
  assert.equal(project.song.patterns[0].notes[0].id, firstId);
  assert.equal(project.song.patterns[0].notes[0].pitch, 67);
});

test('note pada channel berbeda boleh berada pada row yang sama', () => {
  let project = fixture();
  const pattern = activePattern(project);
  project = enterNote(project, { patternId: pattern.id, trackId: project.song.tracks[0].id, row: 8, pitch: 60 });
  project = enterNote(project, { patternId: pattern.id, trackId: project.song.tracks[1].id, row: 8, pitch: 64 });
  assert.equal(project.song.patterns[0].notes.length, 2);
});

test('row dan pitch di luar rentang gagal dengan kode stabil', () => {
  const project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;

  assert.throws(
    () => enterNote(project, { patternId: pattern.id, trackId, row: 64, pitch: 60 }),
    (error) => error.code === 'E_PROJECT_ROW_RANGE',
  );
  assert.throws(
    () => enterNote(project, { patternId: pattern.id, trackId, row: 0, pitch: 128 }),
    (error) => error.code === 'E_PROJECT_PITCH_RANGE',
  );
});
