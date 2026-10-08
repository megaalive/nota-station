import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSongNoteScheduleCursor,
  songCutEventTemplates,
  songEffectEventTemplates,
  songMetronomeEventTemplates,
  songMixEffectEventTemplates,
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

test('note akhir Pattern dan note awal occurrence berikutnya rapat pada satu audio anchor', () => {
  const project = fixture();
  project.song.patterns[1].effects = [];
  const endNote = project.song.patterns[0].notes[0];
  endNote.startTickLocal = 840;
  endNote.durationTicks = 120;
  project.song.patterns[1].notes[0].startTickLocal = 0;
  const events = songNoteEventTemplates(project, 120);
  const first = events.find((event) => event.orderEntryId === 'o1');
  const next = events.find((event) => event.orderEntryId === 'o2');

  assert.equal(first.startTickSong + 120, next.startTickSong);
  assert.equal(first.offsetSecondsSong + first.durationSeconds, next.offsetSecondsSong);
  const due = createSongNoteScheduleCursor(project, 120).drainUntil(4, 7);
  assert.equal(due.find((event) => event.orderEntryId === 'o1').when + first.durationSeconds,
    due.find((event) => event.orderEntryId === 'o2').when);
});

test('retrigger dan offset membawa identitas occurrence tanpa mengganti ID sumber', () => {
  const project = fixture();
  project.song.patterns[0].effects = [
    { id: 'repeat', trackId: 't1', tickLocal: 840, type: 'retrigger', value: { intervalTicks: 30, count: 1 } },
    { id: 'sample-offset', trackId: 't1', tickLocal: 840, type: 'offset', value: { frames: 1234 } },
  ];
  const events = songNoteEventTemplates(project, 120)
    .filter((event) => event.sourceNoteId === 'n1');

  assert.deepEqual(events.map((event) => [
    event.orderEntryId,
    event.sourceNoteId,
    event.retriggerIndex,
    event.sampleOffsetFrames,
  ]), [
    ['o1', 'n1', 0, 1234],
    ['o1', 'n1', 1, 1234],
    ['o3', 'n1', 0, 1234],
    ['o3', 'n1', 1, 1234],
  ]);
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
});

test('boundary volume/pan reset mengembalikan FX ke baseline meski Pattern berikutnya kosong', () => {
  const project = fixture();
  project.song.patterns[0].effects = [
    { id: 'vol', trackId: 't1', tickLocal: 0, type: 'volume', value: { level: 32 } },
    { id: 'pan', trackId: 't1', tickLocal: 0, type: 'pan', value: { position: 40 } },
  ];
  project.song.patterns[1].effects = [];

  const events = songMixEffectEventTemplates(project, 120);
  const resetAtSecond = events.find((event) => event.orderEntryId === 'o2' && event.kind === 'mix-reset');
  const resetAtReuse = events.find((event) => event.orderEntryId === 'o3' && event.kind === 'mix-reset');
  assert.deepEqual(resetAtSecond.trackIds, ['t1']);
  assert.deepEqual(resetAtReuse.trackIds, ['t1']);
  assert.ok(events.findIndex((event) => event.id === 'o3:mix-reset')
    < events.findIndex((event) => event.sourceEventId === 'vol' && event.orderEntryId === 'o3'));
});

test('cut dan pitch effect di-rebase ke occurrence dan tidak berbagi runtime identity', () => {
  const project = fixture();
  project.song.patterns[1].effects = [
    { id: 'cut-next', trackId: 't1', tickLocal: 0, type: 'cut', value: { afterTicks: 30 } },
  ];
  project.song.patterns[0].effects = [
    { id: 'pitch', trackId: 't1', tickLocal: 0, type: 'pitchSlide', value: { semitones: 4, durationTicks: 60 } },
  ];

  const [cut] = songCutEventTemplates(project, 120);
  const pitchEvents = songEffectEventTemplates(project, 120).filter((event) => event.sourceEventId === 'pitch');
  assert.equal(cut.orderEntryId, 'o2');
  assert.equal(cut.startTickSong, 990);
  assert.deepEqual(pitchEvents.map((event) => event.occurrenceId), ['o1', 'o3']);
  assert.notEqual(pitchEvents[0].id, pitchEvents[1].id);
});

test('metronome menghitung beat/accent lokal tiap Pattern occurrence', () => {
  const project = fixture();
  project.song.patterns[0].lengthTicks = 1920;
  project.song.patterns[0].meter = { num: 2, den: 4 };
  project.song.patterns[1].lengthTicks = 1440;
  project.song.patterns[1].meter = { num: 3, den: 4 };

  const events = songMetronomeEventTemplates(project);
  const second = events.filter((event) => event.orderEntryId === 'o2');
  const third = events.filter((event) => event.orderEntryId === 'o3');
  assert.deepEqual(second.map((event) => [event.startTickLocal, event.accent]), [
    [0, true], [480, false], [960, false],
  ]);
  assert.equal(third[0].startTickSong, 3360);
  assert.equal(third[0].accent, true);
  assert.equal(events.filter((event) => event.startTickSong === 3360).length, 1);
});
