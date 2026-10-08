import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSongNoteScheduleCursor,
  songNoteEventTemplates,
} from '../../src/audio/song-scheduler.js';

function fixture() {
  return {
    song: {
      initial: { tempo: 120, meter: { num: 4, den: 4 }, key: null },
      tracks: [{ id: 't1', defaultInstrumentId: 'factory.basic' }],
      patterns: [
        {
          id: 'p1',
          lengthTicks: 960,
          notes: [{
            id: 'n1',
            trackId: 't1',
            startTickLocal: 840,
            durationTicks: 120,
            pitch: 60,
            velocity: 100,
            instrumentId: 'factory.basic',
          }],
          effects: [],
        },
        {
          id: 'p2',
          lengthTicks: 480,
          notes: [{
            id: 'n2',
            trackId: 't1',
            startTickLocal: 0,
            durationTicks: 120,
            pitch: 64,
            velocity: 100,
            instrumentId: 'factory.basic',
          }],
          effects: [{
            id: 'delay-p2',
            trackId: 't1',
            tickLocal: 0,
            type: 'delay',
            value: { ticks: 30 },
          }],
        },
      ],
      order: [
        { id: 'o1', patternId: 'p1', sectionId: 'a' },
        { id: 'o2', patternId: 'p2', sectionId: 'a' },
        { id: 'o3', patternId: 'p1', sectionId: 'b' },
      ],
    },
  };
}

test('song note templates menaruh occurrence berurutan pada satu timeline tanpa gap', () => {
  const events = songNoteEventTemplates(fixture(), 120);

  assert.deepEqual(
    events.map((event) => [
      event.orderEntryId,
      event.sourceNoteId,
      event.startTickLocal,
      event.startTickSong,
      Number(event.offsetSecondsSong.toFixed(6)),
    ]),
    [
      ['o1', 'n1', 840, 840, 0.875],
      ['o2', 'n2', 30, 990, 1.03125],
      ['o3', 'n1', 840, 2280, 2.375],
    ],
  );

  assert.equal(
    new Set(events.map((event) => event.id)).size,
    events.length,
    'reuse Pattern pada occurrence berbeda wajib punya scheduled event identity unik',
  );
});

test('cursor section re-anchor occurrence awal ke audio anchor yang sama', () => {
  const cursor = createSongNoteScheduleCursor(fixture(), 120, {
    startOrderIndex: 1,
  });
  const anchor = 10;

  const due = cursor.drainUntil(anchor, anchor + 0.05);
  assert.equal(due.length, 1);
  assert.equal(due[0].orderEntryId, 'o2');
  assert.equal(due[0].sourceNoteId, 'n2');
  assert.equal(due[0].startTickSong, 990);
  assert.equal(Number(due[0].when.toFixed(6)), 10.03125);
  assert.equal(cursor.startTickSong, 960);
});

test('song scheduler tidak menulis absolute tick kembali ke Pattern', () => {
  const project = fixture();
  const original = structuredClone(project);

  songNoteEventTemplates(project, 120);
  createSongNoteScheduleCursor(project, 120, { startOrderIndex: 1 });

  assert.deepEqual(project, original);
  for (const pattern of project.song.patterns) {
    for (const note of pattern.notes) {
      assert.equal(Object.hasOwn(note, 'startTickSong'), false);
      assert.equal(Object.hasOwn(note, 'absoluteTick'), false);
    }
  }
});
