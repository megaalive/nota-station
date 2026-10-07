import {
  FACTORY_BASIC_INSTRUMENT_ID,
  createFactoryBasicInstrument,
  createFactoryBasicSample,
} from './sound-model.js';

// Model kanonik minimum R1 (§5). Note tetap pattern-local; absolute song tick
// hanya boleh muncul sebagai hasil proyeksi playback, bukan disimpan di project.

export const PPQ = 480;
export const DEFAULT_CHANNELS = 8;
export const MAX_CHANNELS = 32;
export const DEFAULT_ROWS = 64;
export const DEFAULT_ROW_TICKS = PPQ / 4; // LPB 4 = 1/16.
export const FACTORY_INSTRUMENT_ID = FACTORY_BASIC_INSTRUMENT_ID;

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isoNow() {
  return new Date().toISOString();
}

export function createBlankProject({ idFactory = makeId, now = isoNow } = {}) {
  const createdAt = now();
  const tracks = Array.from({ length: DEFAULT_CHANNELS }, (_, index) => (
    createInstrumentTrack(index + 1, idFactory)
  ));

  const patternId = idFactory('pattern');
  const pattern = {
    id: patternId,
    name: 'Pattern 01',
    lengthTicks: DEFAULT_ROWS * DEFAULT_ROW_TICKS,
    meter: { num: 4, den: 4 },
    rowTicks: DEFAULT_ROW_TICKS,
    notes: [],
    effects: [],
    chords: [],
    tempoEvents: [],
  };

  return {
    schemaVersion: 1,
    id: idFactory('project'),
    title: 'Untitled',
    createdAt,
    modifiedAt: createdAt,
    song: {
      initial: { tempo: 120, meter: { num: 4, den: 4 }, key: null },
      sections: [],
      tracks,
      patterns: [pattern],
      order: [{ id: idFactory('order'), patternId, sectionId: null, keyOverride: null }],
      lyrics: [],
    },
    instruments: [createFactoryBasicInstrument()],
    samples: [createFactoryBasicSample()],
    settings: {
      tuning: 440,
      keymapPreset: 'songwriter',
      language: 'id',
      theme: 'light',
    },
  };
}

export function activePattern(project) {
  const first = project.song.order[0];
  if (!first) throw projectError('E_PROJECT_EMPTY_ORDER', 'Project tidak punya OrderEntry.');
  const pattern = project.song.patterns.find((item) => item.id === first.patternId);
  if (!pattern) throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${first.patternId}`);
  return pattern;
}

export function addTrack(
  project,
  { name = null } = {},
  { idFactory = makeId, now = isoNow } = {},
) {
  const index = project.song.tracks.length + 1;
  if (index > MAX_CHANNELS) {
    throw projectError(
      'E_PROJECT_TRACK_LIMIT',
      `Project hanya mendukung sampai ${MAX_CHANNELS} channel.`,
    );
  }

  const resolvedName = name === null ? `Channel ${index}` : String(name).trim();
  if (resolvedName.length < 1 || resolvedName.length > 80) {
    throw projectError(
      'E_PROJECT_TRACK_NAME',
      'Nama channel harus berisi 1..80 karakter.',
    );
  }

  const track = createInstrumentTrack(index, idFactory, resolvedName);
  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      tracks: [...project.song.tracks, track],
    },
  };
}

export function setInitialTempo(
  project,
  tempo,
  { now = isoNow } = {},
) {
  if (!Number.isInteger(tempo) || tempo < 20 || tempo > 300) {
    throw projectError('E_PROJECT_TEMPO_RANGE', `Tempo di luar 20..300 BPM: ${tempo}`);
  }
  if (project.song.initial.tempo === tempo) return project;

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      initial: {
        ...project.song.initial,
        tempo,
      },
    },
  };
}

export function noteAtCell(project, { patternId, trackId, row, voiceLane = 0 }) {
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  if (!pattern) return null;
  const tick = row * pattern.rowTicks;
  return pattern.notes.find(
    (note) => note.trackId === trackId
      && note.startTickLocal === tick
      && voiceLaneOf(note) === voiceLane,
  ) ?? null;
}

export function notesAtCell(project, { patternId, trackId, row }) {
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  if (!pattern) return [];
  const tick = row * pattern.rowTicks;
  return pattern.notes
    .filter((note) => note.trackId === trackId && note.startTickLocal === tick)
    .sort((a, b) => voiceLaneOf(a) - voiceLaneOf(b));
}

export function setTrackPolyphony(
  project,
  { trackId, polyphony },
  { now = isoNow } = {},
) {
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (!['mono', 'poly'].includes(polyphony)) {
    throw projectError('E_PROJECT_POLYPHONY', `Mode polyphony tidak valid: ${polyphony}`);
  }
  if (track.kind === 'drum' && polyphony !== 'poly') {
    throw projectError('E_PROJECT_DRUM_POLYPHONY', 'Drum Track harus tetap polyphonic.');
  }
  if (track.polyphony === polyphony) return project;

  if (
    polyphony === 'mono'
    && project.song.patterns.some((pattern) => pattern.notes.some(
      (note) => note.trackId === trackId && voiceLaneOf(note) > 0,
    ))
  ) {
    throw projectError(
      'E_PROJECT_POLYPHONY_ACTIVE_VOICES',
      'Track masih memiliki voice lane tambahan; hapus chord sebelum kembali ke mono.',
    );
  }

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      tracks: project.song.tracks.map((item) => (
        item.id === trackId ? { ...item, polyphony } : item
      )),
    },
  };
}

export function firstFreeVoiceLane(
  project,
  { patternId, trackId, row },
) {
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  if (!pattern) {
    throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);
  }
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (track.polyphony !== 'poly') {
    throw projectError(
      'E_PROJECT_POLYPHONY',
      `Track ${trackId} tidak menerima voice lane polifonik.`,
    );
  }
  if (!Number.isInteger(row) || row < 0 || row >= pattern.lengthTicks / pattern.rowTicks) {
    throw projectError('E_PROJECT_ROW_RANGE', `Row di luar pattern: ${row}`);
  }

  const used = new Set(
    pattern.notes
      .filter((note) => note.trackId === trackId && note.startTickLocal === row * pattern.rowTicks)
      .map((note) => voiceLaneOf(note)),
  );
  for (let lane = 0; lane <= 31; lane += 1) {
    if (!used.has(lane)) return lane;
  }
  throw projectError(
    'E_PROJECT_VOICE_LANE_FULL',
    'Semua 32 voice lane pada sel ini sudah terisi.',
  );
}

export function configureDrumTrack(
  project,
  { trackId, instrumentId },
  { now = isoNow } = {},
) {
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (!project.instruments.some((item) => item.id === instrumentId)) {
    throw projectError('E_PROJECT_INSTRUMENT_MISSING', `Instrument tidak ditemukan: ${instrumentId}`);
  }
  if (
    track.kind !== 'drum'
    && project.song.patterns.some((pattern) => (
      pattern.notes.some((note) => note.trackId === trackId)
    ))
  ) {
    throw projectError(
      'E_PROJECT_DRUM_TRACK_NOT_EMPTY',
      'Track berisi note harus dikosongkan sebelum diubah menjadi Drum Track.',
    );
  }
  if (
    track.kind === 'drum'
    && track.polyphony === 'poly'
    && track.defaultInstrumentId === instrumentId
  ) {
    return project;
  }

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      tracks: project.song.tracks.map((item) => (
        item.id === trackId
          ? {
              ...item,
              kind: 'drum',
              polyphony: 'poly',
              defaultInstrumentId: instrumentId,
            }
          : item
      )),
    },
  };
}

export function enterNote(
  project,
  { patternId, trackId, row, pitch, velocity = 100, instrumentId = null, durationTicks = null },
  { idFactory = makeId, now = isoNow } = {},
) {
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);

  const pattern = project.song.patterns[patternIndex];
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (!Number.isInteger(row) || row < 0 || row >= pattern.lengthTicks / pattern.rowTicks) {
    throw projectError('E_PROJECT_ROW_RANGE', `Row di luar pattern: ${row}`);
  }
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
    throw projectError('E_PROJECT_PITCH_RANGE', `Pitch di luar MIDI 0..127: ${pitch}`);
  }
  if (!Number.isInteger(velocity) || velocity < 0 || velocity > 127) {
    throw projectError('E_PROJECT_VELOCITY_RANGE', `Velocity di luar MIDI 0..127: ${velocity}`);
  }

  const resolvedInstrumentId = instrumentId ?? track.defaultInstrumentId ?? FACTORY_INSTRUMENT_ID;
  if (!project.instruments.some((item) => item.id === resolvedInstrumentId)) {
    throw projectError('E_PROJECT_INSTRUMENT_MISSING', `Instrument tidak ditemukan: ${resolvedInstrumentId}`);
  }

  const startTickLocal = row * pattern.rowTicks;
  const resolvedDurationTicks = durationTicks ?? pattern.rowTicks;
  if (
    !Number.isInteger(resolvedDurationTicks)
    || resolvedDurationTicks <= 0
    || startTickLocal + resolvedDurationTicks > pattern.lengthTicks
  ) {
    throw projectError(
      'E_PROJECT_DURATION_RANGE',
      `Duration note di luar Pattern: ${resolvedDurationTicks}`,
    );
  }

  const existing = pattern.notes.find(
    (note) => note.trackId === trackId
      && note.startTickLocal === startTickLocal
      && voiceLaneOf(note) === 0,
  );
  const note = {
    id: existing?.id ?? idFactory('note'),
    trackId,
    startTickLocal,
    durationTicks: resolvedDurationTicks,
    pitch,
    instrumentId: resolvedInstrumentId,
    velocity,
    source: 'user',
    locked: false,
  };

  const notes = pattern.notes
    .filter((item) => !(
      item.trackId === trackId
      && item.startTickLocal === startTickLocal
      && voiceLaneOf(item) === 0
    ))
    .concat(note)
    .sort(compareNotes);

  const patterns = [...project.song.patterns];
  patterns[patternIndex] = { ...pattern, notes };

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
    },
  };
}

export function enterVoiceNote(
  project,
  {
    patternId,
    trackId,
    row,
    voiceLane,
    pitch,
    velocity = 100,
    instrumentId = null,
    durationTicks = null,
  },
  { idFactory = makeId, now = isoNow } = {},
) {
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) {
    throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);
  }

  const pattern = project.song.patterns[patternIndex];
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (track.polyphony !== 'poly') {
    throw projectError(
      'E_PROJECT_POLYPHONY',
      `Track ${trackId} tidak menerima voice lane polifonik.`,
    );
  }
  if (!Number.isInteger(voiceLane) || voiceLane < 0 || voiceLane > 31) {
    throw projectError('E_PROJECT_VOICE_LANE', `voiceLane di luar 0..31: ${voiceLane}`);
  }
  if (!Number.isInteger(row) || row < 0 || row >= pattern.lengthTicks / pattern.rowTicks) {
    throw projectError('E_PROJECT_ROW_RANGE', `Row di luar pattern: ${row}`);
  }
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
    throw projectError('E_PROJECT_PITCH_RANGE', `Pitch di luar MIDI 0..127: ${pitch}`);
  }
  if (!Number.isInteger(velocity) || velocity < 0 || velocity > 127) {
    throw projectError('E_PROJECT_VELOCITY_RANGE', `Velocity di luar MIDI 0..127: ${velocity}`);
  }

  const resolvedInstrumentId = instrumentId ?? track.defaultInstrumentId ?? FACTORY_INSTRUMENT_ID;
  if (!project.instruments.some((item) => item.id === resolvedInstrumentId)) {
    throw projectError(
      'E_PROJECT_INSTRUMENT_MISSING',
      `Instrument tidak ditemukan: ${resolvedInstrumentId}`,
    );
  }

  const startTickLocal = row * pattern.rowTicks;
  const resolvedDurationTicks = durationTicks ?? pattern.rowTicks;
  if (
    !Number.isInteger(resolvedDurationTicks)
    || resolvedDurationTicks <= 0
    || startTickLocal + resolvedDurationTicks > pattern.lengthTicks
  ) {
    throw projectError(
      'E_PROJECT_DURATION_RANGE',
      `Duration note di luar Pattern: ${resolvedDurationTicks}`,
    );
  }

  const existing = pattern.notes.find(
    (note) => note.trackId === trackId
      && note.startTickLocal === startTickLocal
      && voiceLaneOf(note) === voiceLane,
  );
  const note = {
    id: existing?.id ?? idFactory('note'),
    trackId,
    startTickLocal,
    durationTicks: resolvedDurationTicks,
    pitch,
    instrumentId: resolvedInstrumentId,
    velocity,
    voiceLane,
    source: 'user',
    locked: false,
  };

  const notes = pattern.notes
    .filter((item) => !(
      item.trackId === trackId
      && item.startTickLocal === startTickLocal
      && voiceLaneOf(item) === voiceLane
    ))
    .concat(note)
    .sort(compareNotes);

  const patterns = [...project.song.patterns];
  patterns[patternIndex] = { ...pattern, notes };

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
    },
  };
}

export function deleteVoiceNote(
  project,
  { patternId, trackId, row, voiceLane },
  { now = isoNow } = {},
) {
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) {
    throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);
  }

  const pattern = project.song.patterns[patternIndex];
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (track.polyphony !== 'poly') {
    throw projectError(
      'E_PROJECT_POLYPHONY',
      `Track ${trackId} tidak menerima voice lane polifonik.`,
    );
  }
  if (!Number.isInteger(voiceLane) || voiceLane < 0 || voiceLane > 31) {
    throw projectError('E_PROJECT_VOICE_LANE', `voiceLane di luar 0..31: ${voiceLane}`);
  }
  if (!Number.isInteger(row) || row < 0 || row >= pattern.lengthTicks / pattern.rowTicks) {
    throw projectError('E_PROJECT_ROW_RANGE', `Row di luar pattern: ${row}`);
  }

  const startTickLocal = row * pattern.rowTicks;
  const notes = pattern.notes.filter((note) => !(
    note.trackId === trackId
    && note.startTickLocal === startTickLocal
    && voiceLaneOf(note) === voiceLane
  ));
  if (notes.length === pattern.notes.length) return project;

  const patterns = [...project.song.patterns];
  patterns[patternIndex] = { ...pattern, notes };

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
    },
  };
}

export function deleteVoiceRow(
  project,
  { patternId, trackId, row },
  { now = isoNow } = {},
) {
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) {
    throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);
  }
  const pattern = project.song.patterns[patternIndex];
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (track.polyphony !== 'poly') {
    throw projectError(
      'E_PROJECT_POLYPHONY',
      `Track ${trackId} tidak menerima voice lane polifonik.`,
    );
  }
  if (!Number.isInteger(row) || row < 0 || row >= pattern.lengthTicks / pattern.rowTicks) {
    throw projectError('E_PROJECT_ROW_RANGE', `Row di luar pattern: ${row}`);
  }

  const startTickLocal = row * pattern.rowTicks;
  const notes = pattern.notes.filter(
    (note) => !(note.trackId === trackId && note.startTickLocal === startTickLocal),
  );
  if (notes.length === pattern.notes.length) return project;

  const patterns = [...project.song.patterns];
  patterns[patternIndex] = { ...pattern, notes };
  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
    },
  };
}

export function updateNoteAtCell(
  project,
  { patternId, trackId, row, instrumentId, velocity, voiceLane = 0 },
  { now = isoNow } = {},
) {
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);

  const pattern = project.song.patterns[patternIndex];
  if (!project.song.tracks.some((track) => track.id === trackId)) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (!Number.isInteger(row) || row < 0 || row >= pattern.lengthTicks / pattern.rowTicks) {
    throw projectError('E_PROJECT_ROW_RANGE', `Row di luar pattern: ${row}`);
  }

  if (!Number.isInteger(voiceLane) || voiceLane < 0 || voiceLane > 31) {
    throw projectError('E_PROJECT_VOICE_LANE', `voiceLane di luar 0..31: ${voiceLane}`);
  }
  const track = project.song.tracks.find((item) => item.id === trackId);
  if (voiceLane > 0 && track.polyphony !== 'poly') {
    throw projectError('E_PROJECT_POLYPHONY', 'Track mono tidak menerima voice lane tambahan.');
  }
  const startTickLocal = row * pattern.rowTicks;
  const noteIndex = pattern.notes.findIndex(
    (note) => note.trackId === trackId
      && note.startTickLocal === startTickLocal
      && voiceLaneOf(note) === voiceLane,
  );
  if (noteIndex < 0) {
    throw projectError('E_PROJECT_NOTE_MISSING', `Note tidak ditemukan pada row ${row}.`);
  }

  const note = pattern.notes[noteIndex];
  const nextInstrumentId = instrumentId === undefined ? note.instrumentId : instrumentId;
  const nextVelocity = velocity === undefined ? note.velocity : velocity;

  if (!project.instruments.some((item) => item.id === nextInstrumentId)) {
    throw projectError('E_PROJECT_INSTRUMENT_MISSING', `Instrument tidak ditemukan: ${nextInstrumentId}`);
  }
  if (!Number.isInteger(nextVelocity) || nextVelocity < 0 || nextVelocity > 127) {
    throw projectError('E_PROJECT_VELOCITY_RANGE', `Velocity di luar MIDI 0..127: ${nextVelocity}`);
  }
  if (nextInstrumentId === note.instrumentId && nextVelocity === note.velocity) return project;

  const notes = [...pattern.notes];
  notes[noteIndex] = {
    ...note,
    instrumentId: nextInstrumentId,
    velocity: nextVelocity,
  };

  const patterns = [...project.song.patterns];
  patterns[patternIndex] = { ...pattern, notes };

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
    },
  };
}

export function deleteNote(
  project,
  { patternId, trackId, row },
  { now = isoNow } = {},
) {
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);

  const pattern = project.song.patterns[patternIndex];
  if (!project.song.tracks.some((track) => track.id === trackId)) {
    throw projectError('E_PROJECT_TRACK_MISSING', `Track tidak ditemukan: ${trackId}`);
  }
  if (!Number.isInteger(row) || row < 0 || row >= pattern.lengthTicks / pattern.rowTicks) {
    throw projectError('E_PROJECT_ROW_RANGE', `Row di luar pattern: ${row}`);
  }

  const startTickLocal = row * pattern.rowTicks;
  const notes = pattern.notes.filter(
    (note) => !(
      note.trackId === trackId
      && note.startTickLocal === startTickLocal
      && voiceLaneOf(note) === 0
    ),
  );
  if (notes.length === pattern.notes.length) return project;

  const patterns = [...project.song.patterns];
  patterns[patternIndex] = { ...pattern, notes };

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
    },
  };
}

function createInstrumentTrack(index, idFactory, name = `Channel ${index}`) {
  return {
    id: idFactory(`track-${index}`),
    name,
    color: null,
    kind: 'instrument',
    defaultInstrumentId: FACTORY_INSTRUMENT_ID,
    polyphony: 'mono',
  };
}

function voiceLaneOf(note) {
  return Number.isInteger(note?.voiceLane) ? note.voiceLane : 0;
}

function compareNotes(a, b) {
  return a.startTickLocal - b.startTickLocal
    || a.trackId.localeCompare(b.trackId)
    || voiceLaneOf(a) - voiceLaneOf(b)
    || a.id.localeCompare(b.id);
}

export function projectError(code, message) {
  const error = new Error(message);
  error.name = 'ProjectError';
  error.code = code;
  return error;
}
