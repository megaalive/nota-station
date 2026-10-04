// Model kanonik minimum R1 (§5). Note tetap pattern-local; absolute song tick
// hanya boleh muncul sebagai hasil proyeksi playback, bukan disimpan di project.

export const PPQ = 480;
export const DEFAULT_CHANNELS = 8;
export const DEFAULT_ROWS = 64;
export const DEFAULT_ROW_TICKS = PPQ / 4; // LPB 4 = 1/16.
export const FACTORY_INSTRUMENT_ID = 'factory.basic';

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
    instruments: [
      {
        id: FACTORY_INSTRUMENT_ID,
        name: 'Basic',
        sampleId: 'factory.basic',
        rootPitch: 60,
      },
    ],
    samples: [
      {
        id: 'factory.basic',
        factoryKey: 'basic',
        license: 'CC0-1.0',
      },
    ],
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

export function noteAtCell(project, { patternId, trackId, row }) {
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  if (!pattern) return null;
  const tick = row * pattern.rowTicks;
  return pattern.notes.find((note) => note.trackId === trackId && note.startTickLocal === tick) ?? null;
}

export function enterNote(
  project,
  { patternId, trackId, row, pitch, velocity = 100, instrumentId = FACTORY_INSTRUMENT_ID },
  { idFactory = makeId, now = isoNow } = {},
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
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
    throw projectError('E_PROJECT_PITCH_RANGE', `Pitch di luar MIDI 0..127: ${pitch}`);
  }

  const startTickLocal = row * pattern.rowTicks;
  const existing = pattern.notes.find(
    (note) => note.trackId === trackId && note.startTickLocal === startTickLocal,
  );
  const note = {
    id: existing?.id ?? idFactory('note'),
    trackId,
    startTickLocal,
    durationTicks: pattern.rowTicks,
    pitch,
    instrumentId,
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

export function projectError(code, message) {
  const error = new Error(message);
  error.name = 'ProjectError';
  error.code = code;
  return error;
}
