import test from 'node:test';
import assert from 'node:assert/strict';

import {
  notesAtDisplayCell,
  patternHasOffGridNotes,
  projectNoteToDisplayGrid,
} from '../../src/core/pattern-grid.js';
import { createBlankProject, enterNote } from '../../src/core/project.js';

function ids() {
  let seq = 0;
  return (prefix) => `${prefix}-grid-${++seq}`;
}

function fixture() {
  const idFactory = ids();
  const now = () => '2026-10-06T06:00:00.000Z';
  let project = createBlankProject({ idFactory, now });
  const patternId = project.song.patterns[0].id;
  const trackId = project.song.tracks[0].id;
  project = enterNote(project, {
    patternId,
    trackId,
    row: 1,
    pitch: 60,
    velocity: 90,
  }, { idFactory, now });

  const pattern = project.song.patterns.find((item) => item.id === patternId);
  const note = pattern.notes[0];
  const offGrid = {
    ...note,
    startTickLocal: note.startTickLocal + 23,
  };
  const patterns = project.song.patterns.map((item) => (
    item.id === patternId ? { ...item, notes: [offGrid] } : item
  ));

  return {
    project: {
      ...project,
      song: { ...project.song, patterns },
    },
    patternId,
    trackId,
    rowTicks: pattern.rowTicks,
    note: offGrid,
  };
}

test('projectNoteToDisplayGrid memproyeksikan tick off-grid tanpa mengubah event', () => {
  const { note, rowTicks } = fixture();
  const projection = projectNoteToDisplayGrid(note, rowTicks);

  assert.deepEqual(projection, {
    row: 1,
    rowStartTick: 120,
    delayTicks: 23,
    offGrid: true,
  });
  assert.equal(note.startTickLocal, 143);
});

test('notesAtDisplayCell mengembalikan semua event dalam satu row tampilan secara deterministik', () => {
  const { project, patternId, trackId, rowTicks } = fixture();
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  const original = project.song.patterns[patternIndex].notes[0];
  const second = {
    ...original,
    id: 'note-second-offgrid',
    startTickLocal: original.startTickLocal + 40,
    pitch: 64,
  };
  const patterns = [...project.song.patterns];
  patterns[patternIndex] = {
    ...patterns[patternIndex],
    notes: [second, original],
  };
  const next = { ...project, song: { ...project.song, patterns } };

  const notes = notesAtDisplayCell(next, {
    patternId,
    trackId,
    row: 1,
    rowTicks,
  });

  assert.deepEqual(notes.map((note) => [note.id, note.startTickLocal]), [
    [original.id, 143],
    ['note-second-offgrid', 183],
  ]);
});

test('patternHasOffGridNotes hanya aktif bila ada event yang tidak sejajar rowTicks', () => {
  const { project, patternId, rowTicks } = fixture();
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  assert.equal(patternHasOffGridNotes(pattern, rowTicks), true);

  const aligned = {
    ...pattern,
    notes: pattern.notes.map((note) => ({
      ...note,
      startTickLocal: rowTicks,
    })),
  };
  assert.equal(patternHasOffGridNotes(aligned, rowTicks), false);
});

test('rowTicks tampilan invalid ditolak eksplisit', () => {
  const { note } = fixture();
  assert.throws(
    () => projectNoteToDisplayGrid(note, 0),
    (error) => error.code === 'E_PATTERN_GRID_ROW_TICKS',
  );
});
