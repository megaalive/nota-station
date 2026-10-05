import test from 'node:test';
import assert from 'node:assert/strict';

import {
  configureDrumTrack,
  createBlankProject,
  enterVoiceNote,
  notesAtCell,
} from '../../src/core/project.js';
import {
  createDrumKitInstrument,
  createFactoryBasicSample,
  validateInstrumentModel,
} from '../../src/core/sound-model.js';
import { patternEventTemplates } from '../../src/audio/scheduler.js';
import { resolveSamplerVoice } from '../../src/audio/instrument-resolver.js';
import {
  parseDebugProject,
  serializeDebugProject,
} from '../../src/io/debug-json.js';

function fixture() {
  let seq = 0;
  let project = createBlankProject({
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-05T11:00:00.000Z',
  });

  const base = createFactoryBasicSample();
  const drumSample = {
    ...base,
    id: 'factory.drum-sustain',
    name: 'Drum Sustain Fixture',
    loop: {
      enabled: true,
      startFrame: 100,
      endFrame: 1400,
      mode: 'forward',
    },
  };

  const kit = createDrumKitInstrument({
    id: 'instrument.drum-kit',
    name: 'R2 Drum Kit',
    zones: [
      { note: 36, sampleId: drumSample.id, rootNote: 48, gain: 1.0 },
      { note: 38, sampleId: drumSample.id, rootNote: 60, gain: 0.8 },
      { note: 42, sampleId: drumSample.id, rootNote: 72, gain: 0.55, chokeGroup: 'hihat' },
      { note: 46, sampleId: drumSample.id, rootNote: 67, gain: 0.5, chokeGroup: 'hihat' },
    ],
  });

  project = {
    ...project,
    samples: [...project.samples, drumSample],
    instruments: [...project.instruments, kit],
  };
  const trackId = project.song.tracks[0].id;
  const patternId = project.song.patterns[0].id;
  project = configureDrumTrack(project, { trackId, instrumentId: kit.id });

  return { project, trackId, patternId, kit, drumSample };
}

test('satu Drum Track menerima tiga voice lane pada tick yang sama', () => {
  let { project, trackId, patternId, kit } = fixture();

  project = enterVoiceNote(project, {
    patternId, trackId, row: 0, voiceLane: 0, pitch: 36, durationTicks: 960,
  });
  project = enterVoiceNote(project, {
    patternId, trackId, row: 0, voiceLane: 1, pitch: 38, durationTicks: 960,
  });
  project = enterVoiceNote(project, {
    patternId, trackId, row: 0, voiceLane: 2, pitch: 46, durationTicks: 960,
  });

  const cell = notesAtCell(project, { patternId, trackId, row: 0 });
  assert.deepEqual(cell.map((note) => note.voiceLane), [0, 1, 2]);
  assert.deepEqual(cell.map((note) => note.pitch), [36, 38, 46]);

  const track = project.song.tracks[0];
  assert.equal(track.kind, 'drum');
  assert.equal(track.polyphony, 'poly');
  assert.equal(track.defaultInstrumentId, kit.id);

  const events = patternEventTemplates(project.song.patterns[0], 120);
  assert.deepEqual(events.slice(0, 3).map((event) => event.voiceLane), [0, 1, 2]);
  assert.equal(events[0].offsetSeconds, events[1].offsetSeconds);
  assert.equal(events[1].offsetSeconds, events[2].offsetSeconds);
});

test('Drum Kit resolve zone per pitch dan choke hanya pada pasangan hi-hat', () => {
  const { project, kit } = fixture();
  validateInstrumentModel(kit, new Set(project.samples.map((sample) => sample.id)));

  const kick = resolveSamplerVoice(project, { instrumentId: kit.id, pitch: 36 });
  const closed = resolveSamplerVoice(project, { instrumentId: kit.id, pitch: 42 });
  const open = resolveSamplerVoice(project, { instrumentId: kit.id, pitch: 46 });

  assert.equal(kick.chokeGroup, null);
  assert.equal(closed.chokeGroup, 'hihat');
  assert.equal(open.chokeGroup, 'hihat');
  assert.equal(closed.zone.keyLow, 42);
  assert.equal(open.zone.keyHigh, 46);
});

test('JSON debug round-trip mempertahankan voice lane dan menolak collision', () => {
  let { project, trackId, patternId } = fixture();
  for (const [voiceLane, pitch] of [[0, 36], [1, 38], [2, 46]]) {
    project = enterVoiceNote(project, {
      patternId, trackId, row: 0, voiceLane, pitch, durationTicks: 960,
    });
  }

  const parsed = parseDebugProject(serializeDebugProject(project));
  assert.deepEqual(
    notesAtCell(parsed, { patternId, trackId, row: 0 }).map((note) => note.voiceLane),
    [0, 1, 2],
  );

  const duplicate = structuredClone(project);
  duplicate.song.patterns[0].notes.push({
    ...duplicate.song.patterns[0].notes.find((note) => note.voiceLane === 1),
    id: 'note-duplicate-lane',
  });
  assert.throws(
    () => parseDebugProject(JSON.stringify(duplicate)),
    (error) => error.code === 'E_DEBUG_JSON_DUPLICATE_CELL',
  );

  const mono = createBlankProject({
    idFactory: (() => {
      let seq = 0;
      return (prefix) => `mono-${prefix}-${++seq}`;
    })(),
    now: () => '2026-10-05T11:00:00.000Z',
  });
  mono.song.patterns[0].notes.push({
    id: 'mono-illegal-lane',
    trackId: mono.song.tracks[0].id,
    startTickLocal: 0,
    durationTicks: 120,
    pitch: 60,
    instrumentId: mono.song.tracks[0].defaultInstrumentId,
    velocity: 100,
    voiceLane: 1,
    source: 'user',
    locked: false,
  });
  assert.throws(
    () => parseDebugProject(JSON.stringify(mono)),
    (error) => error.code === 'E_DEBUG_JSON_VOICE_LANE',
  );
});

test('enterVoiceNote menolak lane pada track mono dan lane di luar batas', () => {
  const project = createBlankProject({
    idFactory: (() => {
      let seq = 0;
      return (prefix) => `plain-${prefix}-${++seq}`;
    })(),
    now: () => '2026-10-05T11:00:00.000Z',
  });
  const patternId = project.song.patterns[0].id;
  const trackId = project.song.tracks[0].id;

  assert.throws(
    () => enterVoiceNote(project, {
      patternId, trackId, row: 0, voiceLane: 1, pitch: 60,
    }),
    (error) => error.code === 'E_PROJECT_POLYPHONY',
  );

  const { project: drum, trackId: drumTrack, patternId: drumPattern } = fixture();
  assert.throws(
    () => enterVoiceNote(drum, {
      patternId: drumPattern,
      trackId: drumTrack,
      row: 0,
      voiceLane: 32,
      pitch: 36,
    }),
    (error) => error.code === 'E_PROJECT_VOICE_LANE',
  );
});


test('configureDrumTrack menolak konversi track berisi note agar data lama tidak ditafsirkan ulang', () => {
  let project = createBlankProject({
    idFactory: (() => {
      let seq = 0;
      return (prefix) => `filled-${prefix}-${++seq}`;
    })(),
    now: () => '2026-10-05T11:20:00.000Z',
  });
  const patternId = project.song.patterns[0].id;
  const trackId = project.song.tracks[0].id;
  project = enterVoiceNote(
    configureDrumTrack({
      ...project,
      instruments: [...project.instruments, fixture().kit],
      samples: [...project.samples, fixture().drumSample],
    }, { trackId, instrumentId: 'instrument.drum-kit' }),
    { patternId, trackId, row: 0, voiceLane: 0, pitch: 36 },
  );

  // Kembalikan metadata track saja menjadi instrument untuk mensimulasikan track lama berisi note.
  const legacyLike = {
    ...project,
    song: {
      ...project.song,
      tracks: project.song.tracks.map((track) => (
        track.id === trackId ? { ...track, kind: 'instrument', polyphony: 'mono' } : track
      )),
    },
  };

  assert.throws(
    () => configureDrumTrack(legacyLike, {
      trackId,
      instrumentId: 'instrument.drum-kit',
    }),
    (error) => error.code === 'E_PROJECT_DRUM_TRACK_NOT_EMPTY',
  );
});
