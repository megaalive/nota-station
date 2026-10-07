import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CHANNELS,
  MAX_CHANNELS,
  DEFAULT_ROWS,
  DEFAULT_ROW_TICKS,
  activePattern,
  addTrack,
  createBlankProject,
  deleteNote,
  deleteVoiceRow,
  enterNote,
  enterVoiceNote,
  firstFreeVoiceLane,
  noteAtCell,
  notesAtCell,
  setInitialTempo,
  setTrackPolyphony,
  updateNoteAtCell,
} from '../../src/core/project.js';

function fixture() {
  let seq = 0;
  return createBlankProject({
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-04T00:00:00.000Z',
  });
}

test('setInitialTempo mengubah tempo secara immutable dan menjaga no-op', () => {
  const project = fixture();
  const next = setInitialTempo(
    project,
    138,
    { now: () => '2026-10-04T00:04:00.000Z' },
  );

  assert.equal(project.song.initial.tempo, 120);
  assert.equal(next.song.initial.tempo, 138);
  assert.notEqual(next, project);

  assert.equal(setInitialTempo(next, 138), next);
  assert.throws(
    () => setInitialTempo(project, 19),
    (error) => error.code === 'E_PROJECT_TEMPO_RANGE',
  );
  assert.throws(
    () => setInitialTempo(project, 301),
    (error) => error.code === 'E_PROJECT_TEMPO_RANGE',
  );
});

test('project kosong R1 punya 8 channel, 64 row, dan satu occurrence', () => {
  const project = fixture();
  const pattern = activePattern(project);

  assert.equal(project.song.tracks.length, DEFAULT_CHANNELS);
  assert.deepEqual(
    {
      color: project.song.tracks[0].color,
      kind: project.song.tracks[0].kind,
      defaultInstrumentId: project.song.tracks[0].defaultInstrumentId,
      polyphony: project.song.tracks[0].polyphony,
    },
    {
      color: null,
      kind: 'instrument',
      defaultInstrumentId: 'factory.basic',
      polyphony: 'mono',
    },
  );
  assert.equal('voiceMode' in project.song.tracks[0], false);
  assert.equal(pattern.lengthTicks / pattern.rowTicks, DEFAULT_ROWS);
  assert.equal(pattern.rowTicks, DEFAULT_ROW_TICKS);
  assert.equal(project.song.order.length, 1);
  assert.equal(project.song.initial.tempo, 120);
});


test('channel dapat ditambah sampai 32 tanpa mengubah default 8 channel', () => {
  let project = fixture();
  assert.equal(project.song.tracks.length, DEFAULT_CHANNELS);

  while (project.song.tracks.length < MAX_CHANNELS) {
    const nextIndex = project.song.tracks.length + 1;
    const before = project;
    project = addTrack(
      project,
      {},
      {
        idFactory: (prefix) => `${prefix}-added-${nextIndex}`,
        now: () => '2026-10-07T14:30:00.000Z',
      },
    );
    assert.notEqual(project, before);
    assert.equal(before.song.tracks.length, nextIndex - 1);
  }

  assert.equal(project.song.tracks.length, MAX_CHANNELS);
  assert.equal(project.song.tracks.at(-1).name, 'Channel 32');
  assert.equal(project.song.tracks.at(-1).kind, 'instrument');
  assert.equal(project.song.tracks.at(-1).polyphony, 'mono');
  assert.equal(project.song.tracks.at(-1).defaultInstrumentId, 'factory.basic');

  assert.throws(
    () => addTrack(project),
    (error) => error.code === 'E_PROJECT_TRACK_LIMIT',
  );
});

test('addTrack menerima nama eksplisit tetapi menolak nama kosong atau terlalu panjang', () => {
  const project = fixture();
  const named = addTrack(
    project,
    { name: 'Harmony L' },
    { idFactory: () => 'track-harmony', now: () => '2026-10-07T14:31:00.000Z' },
  );
  assert.equal(named.song.tracks.at(-1).name, 'Harmony L');

  assert.throws(
    () => addTrack(project, { name: '   ' }),
    (error) => error.code === 'E_PROJECT_TRACK_NAME',
  );
  assert.throws(
    () => addTrack(project, { name: 'x'.repeat(81) }),
    (error) => error.code === 'E_PROJECT_TRACK_NAME',
  );
});


test('instrument track dapat diubah poly dan menerima beberapa voice lane pada row yang sama', () => {
  let project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;

  project = setTrackPolyphony(
    project,
    { trackId, polyphony: 'poly' },
    { now: () => '2026-10-07T15:00:00.000Z' },
  );
  assert.equal(project.song.tracks[0].kind, 'instrument');
  assert.equal(project.song.tracks[0].polyphony, 'poly');

  assert.equal(firstFreeVoiceLane(project, { patternId: pattern.id, trackId, row: 4 }), 0);
  project = enterVoiceNote(project, {
    patternId: pattern.id,
    trackId,
    row: 4,
    voiceLane: 0,
    pitch: 60,
  });
  assert.equal(firstFreeVoiceLane(project, { patternId: pattern.id, trackId, row: 4 }), 1);
  project = enterVoiceNote(project, {
    patternId: pattern.id,
    trackId,
    row: 4,
    voiceLane: 1,
    pitch: 64,
  });

  const notes = notesAtCell(project, { patternId: pattern.id, trackId, row: 4 });
  assert.deepEqual(notes.map((note) => [note.voiceLane ?? 0, note.pitch]), [[0, 60], [1, 64]]);
});

test('updateNoteAtCell dapat menarget voice lane tertentu pada track poly', () => {
  let project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;

  project = setTrackPolyphony(project, { trackId, polyphony: 'poly' });
  project = enterVoiceNote(project, {
    patternId: pattern.id,
    trackId,
    row: 6,
    voiceLane: 0,
    pitch: 60,
    velocity: 100,
  });
  project = enterVoiceNote(project, {
    patternId: pattern.id,
    trackId,
    row: 6,
    voiceLane: 1,
    pitch: 64,
    velocity: 100,
  });

  const next = updateNoteAtCell(project, {
    patternId: pattern.id,
    trackId,
    row: 6,
    voiceLane: 1,
    velocity: 64,
  });

  const notes = notesAtCell(next, { patternId: pattern.id, trackId, row: 6 });
  assert.equal(notes[0].velocity, 100);
  assert.equal(notes[1].velocity, 64);
  assert.equal(notes[0].pitch, 60);
  assert.equal(notes[1].pitch, 64);
});

test('poly instrument menolak kembali mono bila voice lane tambahan masih ada', () => {
  let project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;

  project = setTrackPolyphony(project, { trackId, polyphony: 'poly' });
  project = enterVoiceNote(project, {
    patternId: pattern.id,
    trackId,
    row: 2,
    voiceLane: 1,
    pitch: 67,
  });

  assert.throws(
    () => setTrackPolyphony(project, { trackId, polyphony: 'mono' }),
    (error) => error.code === 'E_PROJECT_POLYPHONY_ACTIVE_VOICES',
  );

  project = deleteVoiceRow(project, { patternId: pattern.id, trackId, row: 2 });
  project = setTrackPolyphony(project, { trackId, polyphony: 'mono' });
  assert.equal(project.song.tracks[0].polyphony, 'mono');
});

test('drum track tidak dapat diubah kembali mono', () => {
  let project = fixture();
  const trackId = project.song.tracks[0].id;
  project = {
    ...project,
    song: {
      ...project.song,
      tracks: project.song.tracks.map((track) => (
        track.id === trackId ? { ...track, kind: 'drum', polyphony: 'poly' } : track
      )),
    },
  };

  assert.throws(
    () => setTrackPolyphony(project, { trackId, polyphony: 'mono' }),
    (error) => error.code === 'E_PROJECT_DRUM_POLYPHONY',
  );
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
  assert.equal(note.instrumentId, next.song.tracks[2].defaultInstrumentId);
  assert.equal('absoluteTick' in note, false);
  assert.equal(project.song.patterns[0].notes.length, 0, 'input tidak dimutasi');
});

test('enterNote menerima durationTicks eksplisit tanpa mengubah default satu row', () => {
  const project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;

  const sustained = enterNote(project, {
    patternId: pattern.id,
    trackId,
    row: 8,
    pitch: 60,
    durationTicks: pattern.rowTicks * 8,
  });
  assert.equal(
    noteAtCell(sustained, { patternId: pattern.id, trackId, row: 8 }).durationTicks,
    pattern.rowTicks * 8,
  );

  assert.throws(
    () => enterNote(project, {
      patternId: pattern.id,
      trackId,
      row: 63,
      pitch: 60,
      durationTicks: pattern.rowTicks * 2,
    }),
    (error) => error.code === 'E_PROJECT_DURATION_RANGE',
  );
  assert.throws(
    () => enterNote(project, {
      patternId: pattern.id,
      trackId,
      row: 0,
      pitch: 60,
      durationTicks: 0,
    }),
    (error) => error.code === 'E_PROJECT_DURATION_RANGE',
  );
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

test('deleteNote menghapus satu event tanpa memutasi project lama', () => {
  let project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;
  project = enterNote(project, { patternId: pattern.id, trackId, row: 3, pitch: 60 });
  const before = project;

  const next = deleteNote(
    project,
    { patternId: pattern.id, trackId, row: 3 },
    { now: () => '2026-10-04T00:02:00.000Z' },
  );

  assert.equal(before.song.patterns[0].notes.length, 1);
  assert.equal(next.song.patterns[0].notes.length, 0);
  assert.notEqual(next, before);
});

test('deleteNote pada sel kosong adalah no-op supaya tidak membuat history palsu', () => {
  const project = fixture();
  const pattern = activePattern(project);
  const next = deleteNote(project, {
    patternId: pattern.id,
    trackId: project.song.tracks[0].id,
    row: 9,
  });
  assert.equal(next, project);
});

test('updateNoteAtCell mengubah velocity secara immutable dan no-op bila nilai sama', () => {
  let project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;
  project = enterNote(project, { patternId: pattern.id, trackId, row: 2, pitch: 60 });
  const before = project;

  const next = updateNoteAtCell(
    project,
    { patternId: pattern.id, trackId, row: 2, velocity: 80 },
    { now: () => '2026-10-04T00:03:00.000Z' },
  );

  assert.equal(noteAtCell(before, { patternId: pattern.id, trackId, row: 2 }).velocity, 100);
  assert.equal(noteAtCell(next, { patternId: pattern.id, trackId, row: 2 }).velocity, 80);
  assert.notEqual(next, before);

  const same = updateNoteAtCell(next, { patternId: pattern.id, trackId, row: 2, velocity: 80 });
  assert.equal(same, next);
});

test('updateNoteAtCell menerima instrument valid dan menolak note/instrument/velocity invalid', () => {
  let project = fixture();
  const pattern = activePattern(project);
  const trackId = project.song.tracks[0].id;
  project = enterNote(project, { patternId: pattern.id, trackId, row: 4, pitch: 60 });

  const sameInstrument = updateNoteAtCell(project, {
    patternId: pattern.id,
    trackId,
    row: 4,
    instrumentId: 'factory.basic',
  });
  assert.equal(sameInstrument, project);

  assert.throws(
    () => updateNoteAtCell(project, { patternId: pattern.id, trackId, row: 5, velocity: 80 }),
    (error) => error.code === 'E_PROJECT_NOTE_MISSING',
  );
  assert.throws(
    () => updateNoteAtCell(project, {
      patternId: pattern.id,
      trackId,
      row: 4,
      instrumentId: 'instrument-hilang',
    }),
    (error) => error.code === 'E_PROJECT_INSTRUMENT_MISSING',
  );
  assert.throws(
    () => updateNoteAtCell(project, { patternId: pattern.id, trackId, row: 4, velocity: 128 }),
    (error) => error.code === 'E_PROJECT_VELOCITY_RANGE',
  );
});

test('updateNoteAtCell memilih lane tanpa mengubah voice lain dan menolak lane invalid', () => {
  let project = fixture();
  const patternId = activePattern(project).id;
  const trackId = project.song.tracks[0].id;
  project = setTrackPolyphony(project, { trackId, polyphony: 'poly' });
  for (const [voiceLane, pitch] of [[0, 60], [1, 64]]) {
    project = enterVoiceNote(project, { patternId, trackId, row: 0, voiceLane, pitch });
  }
  const before = project;
  project = updateNoteAtCell(project, { patternId, trackId, row: 0, voiceLane: 1, velocity: 64 });
  assert.equal(noteAtCell(project, { patternId, trackId, row: 0 }).velocity, 100);
  assert.equal(noteAtCell(project, { patternId, trackId, row: 0, voiceLane: 1 }).velocity, 64);
  assert.equal(noteAtCell(before, { patternId, trackId, row: 0, voiceLane: 1 }).velocity, 100);
  assert.equal(updateNoteAtCell(project, { patternId, trackId, row: 0, voiceLane: 1, velocity: 64 }), project);
  for (const voiceLane of [-1, 32, 1.5]) {
    assert.throws(() => updateNoteAtCell(project, { patternId, trackId, row: 0, voiceLane, velocity: 64 }),
      (error) => error.code === 'E_PROJECT_VOICE_LANE');
  }
  assert.throws(() => updateNoteAtCell(project, { patternId, trackId, row: 0, voiceLane: 2 }),
    (error) => error.code === 'E_PROJECT_NOTE_MISSING');
  assert.throws(() => updateNoteAtCell(project, { patternId, trackId, row: 0, voiceLane: 1, instrumentId: 'missing' }),
    (error) => error.code === 'E_PROJECT_INSTRUMENT_MISSING');
});

test('row, pitch, velocity, dan instrument invalid gagal dengan kode stabil', () => {
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
  assert.throws(
    () => enterNote(project, { patternId: pattern.id, trackId, row: 0, pitch: 60, velocity: 200 }),
    (error) => error.code === 'E_PROJECT_VELOCITY_RANGE',
  );
  assert.throws(
    () => enterNote(project, {
      patternId: pattern.id,
      trackId,
      row: 0,
      pitch: 60,
      instrumentId: 'instrument-hilang',
    }),
    (error) => error.code === 'E_PROJECT_INSTRUMENT_MISSING',
  );
});
