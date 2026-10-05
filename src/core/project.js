import {
  FACTORY_BASIC_INSTRUMENT_ID,
  createFactoryBasicInstrument,
  createFactoryBasicSample,
} from './sound-model.js';

// Model kanonik minimum R1 (§5). Note tetap pattern-local; absolute song tick
// hanya boleh muncul sebagai hasil proyeksi playback, bukan disimpan di project.

export const PPQ = 480;
export const DEFAULT_CHANNELS = 8;
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
  const tracks = Array.from({ length: DEFAULT_CHANNELS }, (_, index) => ({
    id: idFactory(`track-${index + 1}`),
    name: `Channel ${index + 1}`,
    color: null,
    kind: 'instrument',
    defaultInstrumentId: FACTORY_INSTRUMENT_ID,
    polyphony: 'mono',
  }));

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

export function noteAtCell(project, { patternId, trackId, row }) {
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  if (!pattern) return null;
  const tick = row * pattern.rowTicks;
  return pattern.notes.find((note) => note.trackId === trackId && note.startTickLocal === tick) ?? null;
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
    (note) => note.trackId === trackId && note.startTickLocal === startTickLocal,
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
    .filter((item) => !(item.trackId === trackId && item.startTickLocal === startTickLocal))
    .concat(note)
    .sort((a, b) => a.startTickLocal - b.startTickLocal || a.trackId.localeCompare(b.trackId));

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
  { patternId, trackId, row, instrumentId, velocity },
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
  const noteIndex = pattern.notes.findIndex(
    (note) => note.trackId === trackId && note.startTickLocal === startTickLocal,
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

export function projectError(code, message) {
  const error = new Error(message);
  error.name = 'ProjectError';
  error.code = code;
  return error;
}
