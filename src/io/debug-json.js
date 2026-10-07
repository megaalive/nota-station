import {
  normalizeLegacySoundModel,
  validateInstrumentModel,
  validateSampleModel,
} from '../core/sound-model.js';
import {
  effectCellKey,
  validateEffectEvent,
} from '../core/effect-model.js';

// JSON debug R1. Ini bukan format portable final .webtrack ZIP (R4);
// tujuannya fixture/test dan round-trip proyek tanpa sample binary.

export const DEBUG_JSON_MAX_BYTES = 10 * 1024 * 1024;
export const DEBUG_JSON_MAX_DEPTH = 64;

export function serializeDebugProject(project) {
  validateDebugProject(project);
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseDebugProject(text) {
  if (typeof text !== 'string') {
    throw debugJsonError('E_DEBUG_JSON_TYPE', 'JSON debug harus berupa teks.');
  }
  if (new TextEncoder().encode(text).byteLength > DEBUG_JSON_MAX_BYTES) {
    throw debugJsonError('E_DEBUG_JSON_SIZE', 'JSON debug melebihi batas 10 MiB.');
  }

  let project;
  try {
    project = JSON.parse(text);
  } catch {
    throw debugJsonError('E_DEBUG_JSON_PARSE', 'JSON debug tidak valid.');
  }

  project = normalizeLegacyTrackMetadata(normalizeLegacySoundModel(project));
  validateDebugProject(project);
  return project;
}

function normalizeLegacyTrackMetadata(project) {
  if (!Array.isArray(project?.song?.tracks)) return project;

  let changed = false;
  const tracks = project.song.tracks.map((track) => {
    if (Object.hasOwn(track, 'color')) return track;
    changed = true;
    return { ...track, color: null };
  });
  if (!changed) return project;

  return {
    ...project,
    song: {
      ...project.song,
      tracks,
    },
  };
}

export function debugJsonFilename(project) {
  const raw = String(project?.title || 'untitled').trim() || 'untitled';
  const safe = raw
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
  return `${safe}.webtrack.json`;
}

export function validateDebugProject(project) {
  assertObject(project, 'project');
  assertJsonTree(project, 0);

  if (project.schemaVersion !== 1) {
    throw debugJsonError('E_DEBUG_JSON_SCHEMA', `schemaVersion tidak didukung: ${project.schemaVersion}`);
  }
  assertString(project.id, 'project.id');
  assertString(project.title, 'project.title');
  assertObject(project.song, 'project.song');
  assertObject(project.song.initial, 'project.song.initial');

  const tempo = project.song.initial.tempo;
  if (!Number.isInteger(tempo) || tempo < 20 || tempo > 300) {
    throw debugJsonError('E_DEBUG_JSON_TEMPO', 'Tempo project harus integer 20..300.');
  }
  validateMeter(project.song.initial.meter, 'project.song.initial.meter');

  assertArray(project.song.sections, 'project.song.sections', 0, 128);
  assertArray(project.song.tracks, 'project.song.tracks', 1, 32);
  assertArray(project.song.patterns, 'project.song.patterns', 1);
  assertArray(project.song.order, 'project.song.order', 1);
  assertArray(project.instruments, 'project.instruments', 1);
  assertArray(project.samples, 'project.samples', 1);

  const sectionIds = uniqueIds(project.song.sections, 'section');
  const trackIds = uniqueIds(project.song.tracks, 'track');
  const tracksById = new Map(project.song.tracks.map((track) => [track.id, track]));
  const sampleIds = uniqueIds(project.samples, 'sample');
  const instrumentIds = uniqueIds(project.instruments, 'instrument');
  const patternIds = uniqueIds(project.song.patterns, 'pattern');

  for (const section of project.song.sections) {
    assertString(section.name, 'section.name');
    const sectionNameLength = section.name.trim().length;
    if (sectionNameLength < 1 || sectionNameLength > 80) {
      throw debugJsonError(
        'E_DEBUG_JSON_SECTION',
        'Nama Section harus berisi 1..80 karakter setelah trim.',
      );
    }
    if (typeof section.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(section.color)) {
      throw debugJsonError('E_DEBUG_JSON_SECTION', `Warna Section tidak valid: ${section.color}`);
    }
  }

  for (const sample of project.samples) {
    try {
      validateSampleModel(sample);
    } catch (error) {
      throw debugJsonError('E_DEBUG_JSON_SAMPLE', error.message);
    }
  }
  for (const instrument of project.instruments) {
    try {
      validateInstrumentModel(instrument, sampleIds);
    } catch (error) {
      const code = error.code === 'E_SOUND_SAMPLE_REF'
        ? 'E_DEBUG_JSON_SAMPLE_REF'
        : 'E_DEBUG_JSON_INSTRUMENT';
      throw debugJsonError(code, error.message);
    }
  }
  for (const track of project.song.tracks) {
    if (track.color !== null && (
      typeof track.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(track.color)
    )) {
      throw debugJsonError('E_DEBUG_JSON_TRACK_COLOR', `Warna Track tidak valid: ${track.color}`);
    }
    if (!['instrument', 'drum'].includes(track.kind)) {
      throw debugJsonError('E_DEBUG_JSON_TRACK_KIND', `Track kind tidak valid: ${track.kind}`);
    }
    if (!['mono', 'poly'].includes(track.polyphony)) {
      throw debugJsonError(
        'E_DEBUG_JSON_TRACK_POLYPHONY',
        `Track polyphony tidak valid: ${track.polyphony}`,
      );
    }
    if (track.kind === 'drum' && track.polyphony !== 'poly') {
      throw debugJsonError(
        'E_DEBUG_JSON_TRACK_POLYPHONY',
        'Drum Track harus polyphonic.',
      );
    }
    if (!instrumentIds.has(track.defaultInstrumentId)) {
      throw debugJsonError(
        'E_DEBUG_JSON_INSTRUMENT_REF',
        `Default instrument track tidak ada: ${track.defaultInstrumentId}`,
      );
    }
  }
  uniqueIds(project.song.order, 'order');

  for (const pattern of project.song.patterns) {
    if (!Number.isInteger(pattern.lengthTicks) || pattern.lengthTicks <= 0) {
      throw debugJsonError('E_DEBUG_JSON_PATTERN_LENGTH', 'lengthTicks Pattern harus integer > 0.');
    }
    if (!Number.isInteger(pattern.rowTicks) || pattern.rowTicks <= 0 || pattern.lengthTicks % pattern.rowTicks !== 0) {
      throw debugJsonError('E_DEBUG_JSON_ROW_TICKS', 'rowTicks Pattern harus membagi lengthTicks.');
    }
    validateMeter(pattern.meter, `pattern ${pattern.id}.meter`);
    assertArray(pattern.notes, `pattern ${pattern.id}.notes`, 0);

    const noteIds = new Set();
    const cells = new Set();
    for (const note of pattern.notes) {
      assertObject(note, 'note');
      assertString(note.id, 'note.id');
      if (noteIds.has(note.id)) throw debugJsonError('E_DEBUG_JSON_DUPLICATE_ID', `ID note duplikat: ${note.id}`);
      noteIds.add(note.id);
      if (!trackIds.has(note.trackId)) throw debugJsonError('E_DEBUG_JSON_TRACK_REF', `Track note tidak ada: ${note.trackId}`);
      const track = tracksById.get(note.trackId);
      if (!instrumentIds.has(note.instrumentId)) throw debugJsonError('E_DEBUG_JSON_INSTRUMENT_REF', `Instrument note tidak ada: ${note.instrumentId}`);
      const voiceLane = note.voiceLane === undefined ? 0 : note.voiceLane;
      if (!Number.isInteger(voiceLane) || voiceLane < 0 || voiceLane > 31) {
        throw debugJsonError('E_DEBUG_JSON_VOICE_LANE', 'voiceLane note harus integer 0..31.');
      }
      if (track.polyphony !== 'poly' && voiceLane !== 0) {
        throw debugJsonError(
          'E_DEBUG_JSON_VOICE_LANE',
          'Track mono tidak boleh memiliki voiceLane nonzero.',
        );
      }
      if (!Number.isInteger(note.startTickLocal) || note.startTickLocal < 0 || note.startTickLocal >= pattern.lengthTicks) {
        throw debugJsonError('E_DEBUG_JSON_NOTE_TICK', 'startTickLocal note di luar Pattern.');
      }
      if (!Number.isInteger(note.durationTicks) || note.durationTicks <= 0) {
        throw debugJsonError('E_DEBUG_JSON_NOTE_DURATION', 'durationTicks note harus integer > 0.');
      }
      if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127) {
        throw debugJsonError('E_DEBUG_JSON_NOTE_PITCH', 'Pitch note harus 0..127.');
      }
      if (!Number.isInteger(note.velocity) || note.velocity < 0 || note.velocity > 127) {
        throw debugJsonError('E_DEBUG_JSON_NOTE_VELOCITY', 'Velocity note harus 0..127.');
      }
      const cell = `${note.trackId}|${note.startTickLocal}|${voiceLane}`;
      if (cells.has(cell)) {
        throw debugJsonError(
          'E_DEBUG_JSON_DUPLICATE_CELL',
          `Dua note menempati voice lane yang sama: ${cell}`,
        );
      }
      cells.add(cell);
    }

    assertArray(pattern.effects, `pattern ${pattern.id}.effects`, 0, 4096);
    const effectIds = new Set();
    const effectCells = new Set();
    for (const effect of pattern.effects) {
      let validated;
      try {
        validated = validateEffectEvent(effect, {
          trackIds,
          patternLengthTicks: pattern.lengthTicks,
        });
      } catch (error) {
        const code = error.code === 'E_EFFECT_TRACK_REF'
          ? 'E_DEBUG_JSON_TRACK_REF'
          : error.code === 'E_EFFECT_TICK_RANGE'
            ? 'E_DEBUG_JSON_EFFECT_TICK'
            : error.code === 'E_EFFECT_TYPE'
              ? 'E_DEBUG_JSON_EFFECT_TYPE'
              : 'E_DEBUG_JSON_EFFECT_VALUE';
        throw debugJsonError(code, error.message);
      }

      if (effectIds.has(validated.id)) {
        throw debugJsonError(
          'E_DEBUG_JSON_DUPLICATE_ID',
          `ID effect duplikat: ${validated.id}`,
        );
      }
      effectIds.add(validated.id);

      const cell = effectCellKey(validated);
      if (effectCells.has(cell)) {
        throw debugJsonError(
          'E_DEBUG_JSON_DUPLICATE_EFFECT_CELL',
          `Effect type yang sama duplikat pada track/tick: ${cell}`,
        );
      }
      effectCells.add(cell);
    }
  }

  for (const entry of project.song.order) {
    if (!patternIds.has(entry.patternId)) {
      throw debugJsonError('E_DEBUG_JSON_PATTERN_REF', `Pattern OrderEntry tidak ada: ${entry.patternId}`);
    }
    if (entry.sectionId !== null && entry.sectionId !== undefined && !sectionIds.has(entry.sectionId)) {
      throw debugJsonError(
        'E_DEBUG_JSON_SECTION_REF',
        `Section OrderEntry tidak ada: ${entry.sectionId}`,
      );
    }
  }

  return project;
}

function assertJsonTree(value, depth) {
  if (depth > DEBUG_JSON_MAX_DEPTH) {
    throw debugJsonError('E_DEBUG_JSON_DEPTH', 'Kedalaman JSON melebihi 64.');
  }
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && Object.hasOwn(value, 'absoluteTick')) {
    throw debugJsonError('E_DEBUG_JSON_ABSOLUTE_TICK', 'absoluteTick tidak boleh disimpan di project.');
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    assertJsonTree(child, depth + 1);
  }
}

function validateMeter(meter, label) {
  assertObject(meter, label);
  if (!Number.isInteger(meter.num) || meter.num < 1 || meter.num > 32 ||
      !Number.isInteger(meter.den) || ![1, 2, 4, 8, 16, 32].includes(meter.den)) {
    throw debugJsonError('E_DEBUG_JSON_METER', `${label} tidak valid.`);
  }
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    assertObject(item, label);
    assertString(item.id, `${label}.id`);
    if (ids.has(item.id)) throw debugJsonError('E_DEBUG_JSON_DUPLICATE_ID', `ID ${label} duplikat: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

function assertArray(value, label, min = 0, max = Infinity) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw debugJsonError('E_DEBUG_JSON_SHAPE', `${label} tidak valid.`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw debugJsonError('E_DEBUG_JSON_SHAPE', `${label} harus object.`);
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw debugJsonError('E_DEBUG_JSON_SHAPE', `${label} harus string non-kosong.`);
  }
}

function debugJsonError(code, message) {
  const error = new Error(message);
  error.name = 'DebugJsonError';
  error.code = code;
  return error;
}
