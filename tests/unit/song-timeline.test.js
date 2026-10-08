import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSongTimeline,
  sectionRunStartIndex,
  songTickForOrderEntry,
} from '../../src/core/song-timeline.js';

function fixture() {
  return {
    song: {
      patterns: [
        { id: 'p1', lengthTicks: 960 },
        { id: 'p2', lengthTicks: 480 },
        { id: 'p3', lengthTicks: 1440 },
      ],
      order: [
        { id: 'o1', patternId: 'p1', sectionId: 'section-a' },
        { id: 'o2', patternId: 'p2', sectionId: 'section-a' },
        { id: 'o3', patternId: 'p3', sectionId: 'section-b' },
        { id: 'o4', patternId: 'p1', sectionId: 'section-a' },
      ],
    },
  };
}

test('SongTimeline memproyeksikan Order ke tick absolut tanpa memutasi Pattern', () => {
  const project = fixture();
  const original = structuredClone(project);

  const timeline = buildSongTimeline(project);

  assert.deepEqual(timeline.entries, [
    {
      orderEntryId: 'o1',
      patternId: 'p1',
      sectionId: 'section-a',
      orderIndex: 0,
      startTickSong: 0,
      endTickSong: 960,
      lengthTicks: 960,
    },
    {
      orderEntryId: 'o2',
      patternId: 'p2',
      sectionId: 'section-a',
      orderIndex: 1,
      startTickSong: 960,
      endTickSong: 1440,
      lengthTicks: 480,
    },
    {
      orderEntryId: 'o3',
      patternId: 'p3',
      sectionId: 'section-b',
      orderIndex: 2,
      startTickSong: 1440,
      endTickSong: 2880,
      lengthTicks: 1440,
    },
    {
      orderEntryId: 'o4',
      patternId: 'p1',
      sectionId: 'section-a',
      orderIndex: 3,
      startTickSong: 2880,
      endTickSong: 3840,
      lengthTicks: 960,
    },
  ]);
  assert.equal(timeline.totalTicks, 3840);
  assert.deepEqual(project, original);
});

test('awal Section memakai run kontigu, bukan sectionId pertama secara global', () => {
  const project = fixture();

  assert.equal(sectionRunStartIndex(project, 'o1'), 0);
  assert.equal(sectionRunStartIndex(project, 'o2'), 0);
  assert.equal(sectionRunStartIndex(project, 'o3'), 2);
  assert.equal(
    sectionRunStartIndex(project, 'o4'),
    3,
    'section-a yang muncul lagi setelah section-b adalah run baru',
  );
});

test('songTickForOrderEntry menambah tick lokal tanpa menyimpan absolute tick', () => {
  const project = fixture();

  assert.equal(songTickForOrderEntry(project, 'o1', 120), 120);
  assert.equal(songTickForOrderEntry(project, 'o2', 120), 1080);
  assert.equal(songTickForOrderEntry(project, 'o4', 959), 3839);

  assert.throws(
    () => songTickForOrderEntry(project, 'o2', 481),
    (error) => error.code === 'E_SONG_TIMELINE_TICK_RANGE',
  );
  assert.throws(
    () => sectionRunStartIndex(project, 'missing'),
    (error) => error.code === 'E_SONG_TIMELINE_ORDER_MISSING',
  );
});
