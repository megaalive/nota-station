import test from 'node:test';
import assert from 'node:assert/strict';

import {
  copyPatternBlock,
  pastePatternBlock,
  transposePatternBlock,
} from '../../src/core/pattern-block.js';
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
    targetChannel: 1,
    block,
  }, { idFactory, now });

  const pattern = next.song.patterns.find((item) => item.id === patternId);
  const pasted = pattern.notes.filter((note) => (
    note.startTickLocal >= 5 * pattern.rowTicks
    && note.startTickLocal < 7 * pattern.rowTicks
    && [project.song.tracks[1].id, project.song.tracks[2].id].includes(note.trackId)
  ));

  assert.equal(pasted.length, 2);
  assert.ok(pasted.every((note) => !sourceIds.has(note.id)));
  assert.deepEqual(pasted.map((note) => note.pitch), [60, 64]);
  assert.equal(pasted[0].durationTicks, pattern.rowTicks * 2);
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
