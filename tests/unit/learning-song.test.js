import test from 'node:test';
import assert from 'node:assert/strict';

import { createTemplateProject } from '../../src/core/templates.js';
import { buildSongTimeline } from '../../src/core/song-timeline.js';
import { songNoteEventTemplates } from '../../src/audio/song-scheduler.js';
import { serializeDebugProject, parseDebugProject } from '../../src/io/debug-json.js';
import { LEARNING_SONG_TITLE } from '../../src/core/learning-song.js';

function opts() {
  let seq = 0;
  return {
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-08T07:00:00.000Z',
  };
}

test('lagu contoh memiliki 8 channel terisi, Drum Kit dan instrumen berbeda', () => {
  const project = createTemplateProject('learning-song', opts());
  assert.equal(project.title, LEARNING_SONG_TITLE);
  assert.equal(project.schemaVersion, 1);
  assert.equal(project.song.initial.tempo, 112);
  assert.equal(project.song.initial.key, 'Am');
  assert.equal(project.song.tracks.length, 8);
  assert.deepEqual(project.song.tracks.map((t) => t.name), [
    'Drum Kit', 'Bass Triangle', 'Keys Pluck', 'Pad Harmoni',
    'Arpeggio Square', 'Lead Saw', 'Countermelodi', 'Tom Fill Synth',
  ]);
  assert.equal(project.song.tracks[0].kind, 'drum');
  assert.equal(project.song.tracks[0].polyphony, 'poly');
  assert.equal(project.song.tracks[2].polyphony, 'poly');
  assert.equal(project.song.tracks[3].polyphony, 'poly');
  assert.ok(new Set(project.song.tracks.map((t) => t.defaultInstrumentId)).size >= 7);
  assert.ok(project.song.tracks.every((t) => project.instruments.some(
    (instrument) => instrument.id === t.defaultInstrumentId,
  )));
  assert.ok(project.song.tracks.every((t) => project.song.patterns.some(
    (pattern) => pattern.notes.some((n) => n.trackId === t.id),
  )));
  assert.ok(project.song.patterns.some((pattern) => pattern.notes.some(
    (n) => n.instrumentId === 'factory.drum-kit' && n.pitch === 46,
  )));
});

test('lagu contoh punya Intro, Verse, Chorus, Bridge, reprise Chorus, Outro', () => {
  const project = createTemplateProject('learning-song', opts());
  assert.equal(project.song.patterns.length, 7);
  assert.equal(project.song.order.length, 9);
  assert.equal(project.song.sections.length, 5);

  const names = project.song.order.map((entry) => project.song.sections.find(
    (section) => section.id === entry.sectionId,
  )?.name);
  assert.deepEqual(names, [
    'Intro', 'Verse', 'Verse', 'Chorus', 'Chorus',
    'Bridge', 'Chorus', 'Chorus', 'Outro',
  ]);

  // Dua occurrence Chorus memakai Pattern asli; mereka bukan clone diam-diam.
  const ids = project.song.order.map((entry) => entry.patternId);
  assert.equal(ids[3], ids[6]);
  assert.equal(ids[4], ids[7]);
  assert.equal(new Set(ids).size, 7);

  const timeline = buildSongTimeline(project);
  assert.equal(timeline.totalTicks, 9 * 64 * 120);
  assert.equal(timeline.entries.length, 9);
  for (let i = 1; i < timeline.entries.length; i += 1) {
    assert.equal(timeline.entries[i].startTickSong, timeline.entries[i - 1].endTickSong);
  }
});

test('lagu contoh memakai not musikal valid, chord poly dan sustain berbeda', () => {
  const project = createTemplateProject('learning-song', opts());
  const trackIds = new Set(project.song.tracks.map((track) => track.id));
  const instruments = new Set(project.instruments.map((instrument) => instrument.id));
  const allIds = new Set();
  let polyCells = 0;
  let sustained = 0;
  let drumNotes = 0;

  for (const pattern of project.song.patterns) {
    assert.equal(pattern.lengthTicks, 64 * pattern.rowTicks);
    assert.ok(pattern.notes.length >= 60, `Pattern terlalu kosong: ${pattern.name}`);
    const cellLanes = new Set();
    for (const note of pattern.notes) {
      assert.ok(!allIds.has(note.id), `ID note duplikat: ${note.id}`);
      allIds.add(note.id);
      assert.ok(trackIds.has(note.trackId));
      assert.ok(instruments.has(note.instrumentId));
      assert.ok(Number.isInteger(note.startTickLocal));
      assert.ok(note.startTickLocal >= 0);
      assert.ok(note.startTickLocal + note.durationTicks <= pattern.lengthTicks);
      assert.ok(!Object.hasOwn(note, 'startTickSong'));
      assert.ok(!Object.hasOwn(note, 'absoluteTick'));
      assert.ok(note.velocity >= 0 && note.velocity <= 127);
      const laneKey = `${note.trackId}|${note.startTickLocal}|${note.voiceLane ?? 0}`;
      assert.equal(cellLanes.has(laneKey), false, `Voice lane bertabrakan: ${laneKey}`);
      cellLanes.add(laneKey);
      if ((note.voiceLane ?? 0) > 0) polyCells += 1;
      if (note.durationTicks >= 8 * pattern.rowTicks) sustained += 1;
      if (note.instrumentId === 'factory.drum-kit') drumNotes += 1;
    }
  }

  assert.ok(allIds.size > 450, 'lagu contoh terlalu sedikit note');
  assert.ok(polyCells > 50, 'chord poly tidak terlihat');
  assert.ok(sustained > 30, 'durasi sustain tidak terlihat');
  assert.ok(drumNotes > 150, 'drum kurang lengkap');
});

test('scheduler song memproyeksikan reprise tanpa mutasi Pattern', () => {
  const project = createTemplateProject('learning-song', opts());
  const original = structuredClone(project);
  const templates = songNoteEventTemplates(project, 112);
  assert.ok(templates.length > 500);
  assert.equal(new Set(templates.map((event) => event.id)).size, templates.length);
  assert.equal(new Set(templates.map((event) => event.orderEntryId)).size, 9);
  assert.deepEqual(project, original);
});

test('lagu contoh lolos kontrak debug JSON tanpa metadata di luar schema', () => {
  const project = createTemplateProject('learning-song', opts());
  const json = serializeDebugProject(project);
  const restored = parseDebugProject(json);
  assert.deepEqual(restored.song, project.song);
  assert.deepEqual(restored.instruments, project.instruments);
  assert.deepEqual(restored.samples, project.samples);
});
