import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findMatchingLpb,
  notesAtDisplayCell,
  patternHasOffGridNotes,
  projectNoteToDisplayGrid,
  quantizePatternNotes,
  rowTicksForLpb,
  SUPPORTED_LPB,
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


test('rowTicksForLpb mengikuti PPQ 480 dan hanya menerima LPB yang didukung', () => {
  assert.deepEqual(SUPPORTED_LPB, [1, 2, 3, 4, 5, 6, 8, 12]);
  assert.equal(rowTicksForLpb(4), 120);
  assert.equal(rowTicksForLpb(6), 80);
  assert.equal(rowTicksForLpb(12), 40);

  assert.throws(
    () => rowTicksForLpb(7),
    (error) => error.code === 'E_PATTERN_GRID_LPB',
  );
});

test('findMatchingLpb memilih resolusi >= current paling dekat yang menyelaraskan semua tick', () => {
  assert.equal(findMatchingLpb([160, 320], { currentLpb: 4 }), 6);
  assert.equal(findMatchingLpb([160, 320], { currentLpb: 6 }), 6);
  assert.equal(findMatchingLpb([143], { currentLpb: 4 }), null);
  assert.equal(findMatchingLpb([], { currentLpb: 4 }), 4);
});

test('quantizePatternNotes memindahkan note ke grid terdekat, mempertahankan duration, dan immutable', () => {
  const { project, patternId, note } = fixture();
  const before = structuredClone(project);

  const next = quantizePatternNotes(project, {
    patternId,
    noteIds: [note.id],
    rowTicks: 120,
  }, { now: () => '2026-10-06T06:10:00.000Z' });

  const quantized = next.song.patterns
    .find((item) => item.id === patternId)
    .notes.find((item) => item.id === note.id);

  assert.equal(quantized.startTickLocal, 120);
  assert.equal(quantized.durationTicks, note.durationTicks);
  assert.deepEqual(project, before);
});

test('quantizePatternNotes menolak bila start baru membuat duration melewati akhir Pattern', () => {
  const { project, patternId, note } = fixture();
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  const pattern = project.song.patterns[patternIndex];
  const nearEnd = {
    ...note,
    startTickLocal: pattern.lengthTicks - 179,
    durationTicks: 179,
  };
  const patterns = [...project.song.patterns];
  patterns[patternIndex] = {
    ...pattern,
    notes: [nearEnd],
  };
  const nextProject = { ...project, song: { ...project.song, patterns } };
  const before = structuredClone(nextProject);

  assert.throws(
    () => quantizePatternNotes(nextProject, {
      patternId,
      noteIds: [nearEnd.id],
      rowTicks: 120,
    }),
    (error) => error.code === 'E_PATTERN_QUANTIZE_DURATION',
  );
  assert.deepEqual(nextProject, before);
});

test('quantizePatternNotes menolak collision target secara atomik', () => {
  const { project, patternId, trackId, note } = fixture();
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  const collision = {
    ...note,
    id: 'note-grid-collision',
    startTickLocal: 120,
  };
  const patterns = [...project.song.patterns];
  patterns[patternIndex] = {
    ...patterns[patternIndex],
    notes: [note, collision],
  };
  const nextProject = { ...project, song: { ...project.song, patterns } };
  const before = structuredClone(nextProject);

  assert.throws(
    () => quantizePatternNotes(nextProject, {
      patternId,
      noteIds: [note.id],
      rowTicks: 120,
    }),
    (error) => error.code === 'E_PATTERN_QUANTIZE_COLLISION',
  );
  assert.deepEqual(nextProject, before);
});
