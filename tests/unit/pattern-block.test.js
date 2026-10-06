import test from 'node:test';
import assert from 'node:assert/strict';

import {
  copyPatternBlock,
  deletePatternRows,
  insertPatternRows,
  interpolatePatternVelocity,
  pastePatternBlock,
  transposePatternBlock,
} from '../../src/core/pattern-block.js';
import { addPatternEffect } from '../../src/core/effect-model.js';
import {
  configureDrumTrack,
  createBlankProject,
  enterNote,
  enterVoiceNote,
} from '../../src/core/project.js';
import {
  createFactoryDrumKitInstrument,
  createFactoryDrumSamples,
} from '../../src/core/factory-drum-kit.js';

function ids() {
  let seq = 0;
  return (prefix) => `${prefix}-block-${++seq}`;
}

function fixture() {
  const idFactory = ids();
  const now = () => '2026-10-06T02:00:00.000Z';
  let project = createBlankProject({ idFactory, now });
  const pattern = project.song.patterns[0];
  const [trackA, trackB, drumTrack] = project.song.tracks;

  project = enterNote(project, {
    patternId: pattern.id,
    trackId: trackA.id,
    row: 1,
    pitch: 60,
    velocity: 90,
    durationTicks: pattern.rowTicks * 2,
  }, { idFactory, now });
  project = enterNote(project, {
    patternId: pattern.id,
    trackId: trackB.id,
    row: 2,
    pitch: 64,
    velocity: 80,
  }, { idFactory, now });

  const drumSamples = createFactoryDrumSamples();
  const drumKit = createFactoryDrumKitInstrument();
  project = {
    ...project,
    samples: [...project.samples, ...drumSamples],
    instruments: [...project.instruments, drumKit],
  };
  project = configureDrumTrack(project, {
    trackId: drumTrack.id,
    instrumentId: drumKit.id,
  }, { now });
  project = enterVoiceNote(project, {
    patternId: pattern.id,
    trackId: drumTrack.id,
    row: 2,
    voiceLane: 0,
    pitch: 36,
    velocity: 100,
  }, { idFactory, now });
  project = enterVoiceNote(project, {
    patternId: pattern.id,
    trackId: drumTrack.id,
    row: 2,
    voiceLane: 1,
    pitch: 38,
    velocity: 88,
  }, { idFactory, now });

  return {
    project,
    patternId: pattern.id,
    tracks: [trackA, trackB, drumTrack],
    idFactory,
    now,
  };
}

test('copyPatternBlock menyimpan offset tick/channel dan seluruh voice lane', () => {
  const { project, patternId } = fixture();
  const block = copyPatternBlock(project, {
    patternId,
    rowStart: 1,
    rowEnd: 2,
    channelStart: 0,
    channelEnd: 2,
  });

  assert.equal(block.version, 1);
  assert.equal(block.rowCount, 2);
  assert.equal(block.channelCount, 3);
  assert.equal(block.events.length, 4);
  assert.deepEqual(
    block.events.map((event) => ({
      channelOffset: event.channelOffset,
      tickOffset: event.tickOffset,
      voiceLane: event.voiceLane,
      pitch: event.pitch,
    })),
    [
      { channelOffset: 0, tickOffset: 0, voiceLane: 0, pitch: 60 },
      { channelOffset: 1, tickOffset: 120, voiceLane: 0, pitch: 64 },
      { channelOffset: 2, tickOffset: 120, voiceLane: 0, pitch: 36 },
      { channelOffset: 2, tickOffset: 120, voiceLane: 1, pitch: 38 },
    ],
  );
});

test('pastePatternBlock membuat ID baru, memetakan channel, dan mengganti collision lane yang sama', () => {
  const { project, patternId, idFactory, now } = fixture();
  const block = copyPatternBlock(project, {
    patternId,
    rowStart: 1,
    rowEnd: 2,
    channelStart: 0,
    channelEnd: 1,
  });

  const sourceIds = new Set(block.events.map((event) => event.sourceId));
  const next = pastePatternBlock(project, {
    patternId,
    targetRow: 5,
    targetChannel: 3,
    block,
  }, { idFactory, now });

  const pattern = next.song.patterns.find((item) => item.id === patternId);
  const pasted = pattern.notes.filter((note) => (
    note.startTickLocal >= 5 * pattern.rowTicks
    && note.startTickLocal < 7 * pattern.rowTicks
    && [project.song.tracks[3].id, project.song.tracks[4].id].includes(note.trackId)
  ));

  assert.equal(pasted.length, 2);
  assert.ok(pasted.every((note) => !sourceIds.has(note.id)));
  assert.deepEqual(pasted.map((note) => note.pitch), [60, 64]);
  assert.equal(pasted[0].durationTicks, pattern.rowTicks * 2);
});

test('pastePatternBlock menolak mapping instrument ke Drum Track', () => {
  const { project, patternId } = fixture();
  const block = copyPatternBlock(project, {
    patternId,
    rowStart: 1,
    rowEnd: 2,
    channelStart: 0,
    channelEnd: 1,
  });

  assert.throws(
    () => pastePatternBlock(project, {
      patternId,
      targetRow: 5,
      targetChannel: 1,
      block,
    }),
    (error) => error.code === 'E_PATTERN_BLOCK_TRACK_KIND',
  );
});

test('pastePatternBlock menolak overflow secara atomik', () => {
  const { project, patternId } = fixture();
  const block = copyPatternBlock(project, {
    patternId,
    rowStart: 1,
    rowEnd: 2,
    channelStart: 0,
    channelEnd: 2,
  });
  const before = structuredClone(project);

  assert.throws(
    () => pastePatternBlock(project, {
      patternId,
      targetRow: 63,
      targetChannel: 6,
      block,
    }),
    (error) => error.code === 'E_PATTERN_BLOCK_RANGE',
  );
  assert.deepEqual(project, before);
});

test('transposePatternBlock mengubah melodic note, melewati drum, dan satu mutation', () => {
  const { project, patternId, now } = fixture();
  const next = transposePatternBlock(project, {
    patternId,
    rowStart: 1,
    rowEnd: 2,
    channelStart: 0,
    channelEnd: 2,
    semitones: 2,
  }, { now });

  const pattern = next.song.patterns.find((item) => item.id === patternId);
  assert.deepEqual(
    pattern.notes.map((note) => note.pitch),
    [62, 66, 36, 38],
  );
  assert.equal(project.song.patterns.find((item) => item.id === patternId).notes[0].pitch, 60);
});

test('transposePatternBlock fail-closed bila satu pitch keluar MIDI 0..127', () => {
  const { project, patternId, idFactory, now } = fixture();
  const trackId = project.song.tracks[0].id;
  let high = enterNote(project, {
    patternId,
    trackId,
    row: 3,
    pitch: 127,
  }, { idFactory, now });

  assert.throws(
    () => transposePatternBlock(high, {
      patternId,
      rowStart: 1,
      rowEnd: 3,
      channelStart: 0,
      channelEnd: 0,
      semitones: 1,
    }),
    (error) => error.code === 'E_PATTERN_BLOCK_PITCH_RANGE',
  );
  assert.equal(
    high.song.patterns.find((item) => item.id === patternId)
      .notes.find((note) => note.startTickLocal === 120).pitch,
    60,
  );
});


test('insertPatternRows menggeser event terpilih, memanjangkan sustain yang melintasi sisipan, dan mempertahankan channel lain', () => {
  const { project, patternId, idFactory, now } = fixture();
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  const trackA = project.song.tracks[0].id;
  const trackB = project.song.tracks[1].id;

  let seeded = enterNote(project, {
    patternId,
    trackId: trackA,
    row: 4,
    pitch: 67,
    velocity: 70,
  }, { idFactory, now });
  seeded = enterNote(seeded, {
    patternId,
    trackId: trackA,
    row: 63,
    pitch: 72,
    velocity: 60,
  }, { idFactory, now });

  const next = insertPatternRows(seeded, {
    patternId,
    row: 2,
    count: 2,
    channelStart: 0,
    channelEnd: 0,
  }, { now });

  const notes = next.song.patterns.find((item) => item.id === patternId).notes;
  const sustain = notes.find((note) => note.trackId === trackA && note.pitch === 60);
  const shifted = notes.find((note) => note.trackId === trackA && note.pitch === 67);
  const untouched = notes.find((note) => note.trackId === trackB && note.pitch === 64);

  assert.equal(sustain.startTickLocal, pattern.rowTicks);
  assert.equal(sustain.durationTicks, pattern.rowTicks * 4);
  assert.equal(shifted.startTickLocal, pattern.rowTicks * 6);
  assert.equal(untouched.startTickLocal, pattern.rowTicks * 2);
  assert.equal(notes.some((note) => note.pitch === 72), false, 'event yang terdorong melewati akhir dipotong dari Pattern');
});

test('deletePatternRows menghapus note yang mulai pada area terhapus, menggeser sesudahnya, dan memendekkan sustain', () => {
  const { project, patternId, idFactory, now } = fixture();
  const trackA = project.song.tracks[0].id;
  let seeded = enterNote(project, {
    patternId,
    trackId: trackA,
    row: 4,
    pitch: 67,
    velocity: 70,
  }, { idFactory, now });

  const next = deletePatternRows(seeded, {
    patternId,
    row: 2,
    count: 2,
    channelStart: 0,
    channelEnd: 0,
  }, { now });

  const pattern = next.song.patterns.find((item) => item.id === patternId);
  const sustain = pattern.notes.find((note) => note.trackId === trackA && note.pitch === 60);
  const shifted = pattern.notes.find((note) => note.trackId === trackA && note.pitch === 67);

  assert.equal(sustain.startTickLocal, pattern.rowTicks);
  assert.equal(sustain.durationTicks, pattern.rowTicks);
  assert.equal(shifted.startTickLocal, pattern.rowTicks * 2);
  assert.equal(
    pattern.notes.some((note) => note.trackId === trackA && note.startTickLocal >= pattern.rowTicks * 2 && note.pitch === 60),
    false,
  );
});

test('row operations mempertahankan voice lane Drum Track', () => {
  const { project, patternId, now } = fixture();

  const inserted = insertPatternRows(project, {
    patternId,
    row: 1,
    count: 1,
    channelStart: 2,
    channelEnd: 2,
  }, { now });
  const afterInsert = inserted.song.patterns.find((item) => item.id === patternId).notes
    .filter((note) => note.trackId === project.song.tracks[2].id);

  assert.deepEqual(
    afterInsert.map((note) => [note.startTickLocal / 120, note.voiceLane, note.pitch]),
    [[3, 0, 36], [3, 1, 38]],
  );

  const deleted = deletePatternRows(inserted, {
    patternId,
    row: 1,
    count: 1,
    channelStart: 2,
    channelEnd: 2,
  }, { now });
  const afterDelete = deleted.song.patterns.find((item) => item.id === patternId).notes
    .filter((note) => note.trackId === project.song.tracks[2].id);

  assert.deepEqual(
    afterDelete.map((note) => [note.startTickLocal / 120, note.voiceLane, note.pitch]),
    [[2, 0, 36], [2, 1, 38]],
  );
});

test('interpolatePatternVelocity menginterpolasi existing note per track/voice lane secara deterministik', () => {
  const { project, patternId, idFactory, now } = fixture();
  const trackA = project.song.tracks[0].id;
  let seeded = enterNote(project, {
    patternId,
    trackId: trackA,
    row: 0,
    pitch: 58,
    velocity: 20,
  }, { idFactory, now });
  seeded = enterNote(seeded, {
    patternId,
    trackId: trackA,
    row: 2,
    pitch: 61,
    velocity: 100,
  }, { idFactory, now });
  seeded = enterNote(seeded, {
    patternId,
    trackId: trackA,
    row: 4,
    pitch: 65,
    velocity: 80,
  }, { idFactory, now });

  const next = interpolatePatternVelocity(seeded, {
    patternId,
    rowStart: 0,
    rowEnd: 4,
    channelStart: 0,
    channelEnd: 0,
  }, { now });

  const velocities = next.song.patterns.find((item) => item.id === patternId).notes
    .filter((note) => note.trackId === trackA)
    .sort((a, b) => a.startTickLocal - b.startTickLocal)
    .map((note) => note.velocity);

  assert.deepEqual(velocities, [20, 35, 50, 80]);
  assert.notEqual(next, seeded);
});

test('interpolatePatternVelocity no-op bila tiap lane hanya punya satu titik', () => {
  const { project, patternId, now } = fixture();
  const next = interpolatePatternVelocity(project, {
    patternId,
    rowStart: 1,
    rowEnd: 2,
    channelStart: 0,
    channelEnd: 2,
  }, { now });

  assert.equal(next, project);
});


test('insert/delete row menggeser EffectEvent track-local bersama NoteEvent', () => {
  const { project, patternId, idFactory, now } = fixture();
  const trackA = project.song.tracks[0].id;
  const trackB = project.song.tracks[1].id;
  let seeded = addPatternEffect(project, {
    patternId,
    trackId: trackA,
    tickLocal: 4 * 120,
    type: 'volume',
    value: { level: 80 },
  }, { idFactory, now });
  seeded = addPatternEffect(seeded, {
    patternId,
    trackId: trackB,
    tickLocal: 4 * 120,
    type: 'pan',
    value: { position: 16 },
  }, { idFactory, now });

  const inserted = insertPatternRows(seeded, {
    patternId,
    row: 2,
    count: 2,
    channelStart: 0,
    channelEnd: 0,
  }, { now });

  let effects = inserted.song.patterns.find((item) => item.id === patternId).effects;
  assert.deepEqual(
    effects.map((effect) => [effect.trackId, effect.tickLocal, effect.type]),
    [
      [trackB, 480, 'pan'],
      [trackA, 720, 'volume'],
    ],
  );

  const deleted = deletePatternRows(inserted, {
    patternId,
    row: 2,
    count: 2,
    channelStart: 0,
    channelEnd: 0,
  }, { now });
  effects = deleted.song.patterns.find((item) => item.id === patternId).effects;
  assert.deepEqual(
    effects.map((effect) => [effect.trackId, effect.tickLocal, effect.type]),
    [
      [trackA, 480, 'volume'],
      [trackB, 480, 'pan'],
    ],
  );
});

test('insert row membuang EffectEvent berdurasi yang tak lagi muat di Pattern', () => {
  const { project, patternId, idFactory, now } = fixture();
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  const trackId = project.song.tracks[0].id;
  let seeded = addPatternEffect(project, {
    patternId,
    trackId,
    tickLocal: pattern.lengthTicks - 240,
    type: 'pitchSlide',
    value: { semitones: 7, durationTicks: 240 },
  }, { idFactory, now });

  const next = insertPatternRows(seeded, {
    patternId,
    row: 62,
    count: 1,
    channelStart: 0,
    channelEnd: 0,
  }, { now });

  assert.equal(
    next.song.patterns.find((item) => item.id === patternId).effects.length,
    0,
  );
});
