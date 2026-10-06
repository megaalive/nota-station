import { PPQ, projectError } from './project.js';

export const SUPPORTED_LPB = Object.freeze([1, 2, 3, 4, 5, 6, 8, 12]);

export function rowTicksForLpb(lpb, ppq = PPQ) {
  if (
    !SUPPORTED_LPB.includes(lpb)
    || !Number.isInteger(ppq)
    || ppq <= 0
    || ppq % lpb !== 0
  ) {
    throw projectError(
      'E_PATTERN_GRID_LPB',
      `LPB tidak didukung untuk PPQ ${ppq}: ${lpb}`,
    );
  }
  return ppq / lpb;
}

export function findMatchingLpb(ticks, {
  currentLpb = 4,
  ppq = PPQ,
} = {}) {
  if (!Array.isArray(ticks) || ticks.some((tick) => !Number.isInteger(tick) || tick < 0)) {
    throw projectError('E_PATTERN_GRID_TICKS', 'Daftar tick untuk pencarian LPB tidak valid.');
  }
  if (!SUPPORTED_LPB.includes(currentLpb)) {
    throw projectError('E_PATTERN_GRID_LPB', `LPB aktif tidak didukung: ${currentLpb}`);
  }
  if (ticks.length === 0) return currentLpb;

  const matches = SUPPORTED_LPB.filter((lpb) => {
    const rowTicks = rowTicksForLpb(lpb, ppq);
    return ticks.every((tick) => tick % rowTicks === 0);
  });
  if (matches.length === 0) return null;
  if (matches.includes(currentLpb)) return currentLpb;

  return matches.find((lpb) => lpb > currentLpb)
    ?? [...matches].reverse().find((lpb) => lpb < currentLpb)
    ?? null;
}

export function projectNoteToDisplayGrid(note, rowTicks) {
  validateRowTicks(rowTicks);
  if (!Number.isInteger(note?.startTickLocal) || note.startTickLocal < 0) {
    throw projectError(
      'E_PATTERN_GRID_NOTE_TICK',
      `startTickLocal note tidak valid: ${note?.startTickLocal}`,
    );
  }

  const row = Math.floor(note.startTickLocal / rowTicks);
  const rowStartTick = row * rowTicks;
  const delayTicks = note.startTickLocal - rowStartTick;
  return Object.freeze({
    row,
    rowStartTick,
    delayTicks,
    offGrid: delayTicks !== 0,
  });
}

export function patternHasOffGridNotes(pattern, rowTicks = pattern?.rowTicks) {
  validateRowTicks(rowTicks);
  return (pattern?.notes ?? []).some(
    (note) => note.startTickLocal % rowTicks !== 0,
  );
}

export function quantizePatternNotes(
  project,
  {
    patternId,
    noteIds,
    rowTicks,
  },
  { now = () => new Date().toISOString() } = {},
) {
  validateRowTicks(rowTicks);
  if (!Array.isArray(noteIds) || noteIds.length === 0) {
    throw projectError('E_PATTERN_QUANTIZE_NOTES', 'Kuantisasi membutuhkan minimal satu note.');
  }
  const uniqueIds = new Set(noteIds);
  if (uniqueIds.size !== noteIds.length || [...uniqueIds].some((id) => typeof id !== 'string' || !id)) {
    throw projectError('E_PATTERN_QUANTIZE_NOTES', 'Daftar note kuantisasi tidak valid.');
  }

  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) {
    throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);
  }
  const pattern = project.song.patterns[patternIndex];
  const selected = pattern.notes.filter((note) => uniqueIds.has(note.id));
  if (selected.length !== uniqueIds.size) {
    throw projectError('E_PATTERN_QUANTIZE_NOTE', 'Satu atau lebih note kuantisasi tidak ditemukan.');
  }

  const replacements = new Map();
  for (const note of selected) {
    let targetTick = Math.round(note.startTickLocal / rowTicks) * rowTicks;
    if (targetTick >= pattern.lengthTicks) {
      targetTick = Math.floor((pattern.lengthTicks - 1) / rowTicks) * rowTicks;
    }
    if (targetTick + note.durationTicks > pattern.lengthTicks) {
      throw projectError(
        'E_PATTERN_QUANTIZE_DURATION',
        `Kuantisasi membuat duration note melewati akhir Pattern: ${note.id}`,
      );
    }
    replacements.set(note.id, {
      ...note,
      startTickLocal: targetTick,
    });
  }

  const occupied = new Set();
  for (const note of pattern.notes) {
    const candidate = replacements.get(note.id) ?? note;
    const key = noteCellKey(candidate);
    if (occupied.has(key)) {
      throw projectError(
        'E_PATTERN_QUANTIZE_COLLISION',
        `Kuantisasi membuat collision pada ${key}.`,
      );
    }
    occupied.add(key);
  }

  let changed = false;
  const notes = pattern.notes.map((note) => {
    const replacement = replacements.get(note.id);
    if (!replacement) return note;
    if (
      replacement.startTickLocal === note.startTickLocal
      && replacement.durationTicks === note.durationTicks
    ) {
      return note;
    }
    changed = true;
    return replacement;
  });
  if (!changed) return project;

  notes.sort(compareNotes);
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

export function quantizePatternCell(
  project,
  {
    patternId,
    trackId,
    row,
    rowTicks,
  },
  options = {},
) {
  const notes = notesAtDisplayCell(project, {
    patternId,
    trackId,
    row,
    rowTicks,
  });
  if (notes.length === 0) return project;
  return quantizePatternNotes(project, {
    patternId,
    noteIds: notes.map((note) => note.id),
    rowTicks,
  }, options);
}

export function notesAtDisplayCell(
  project,
  {
    patternId,
    trackId,
    row,
    rowTicks = null,
  },
) {
  const pattern = project.song.patterns.find((item) => item.id === patternId);
  if (!pattern) {
    throw projectError(
      'E_PROJECT_PATTERN_MISSING',
      `Pattern tidak ditemukan: ${patternId}`,
    );
  }
  if (!project.song.tracks.some((track) => track.id === trackId)) {
    throw projectError(
      'E_PROJECT_TRACK_MISSING',
      `Track tidak ditemukan: ${trackId}`,
    );
  }

  const resolvedRowTicks = rowTicks ?? pattern.rowTicks;
  validateRowTicks(resolvedRowTicks);
  const rowCount = Math.ceil(pattern.lengthTicks / resolvedRowTicks);
  if (!Number.isInteger(row) || row < 0 || row >= rowCount) {
    throw projectError(
      'E_PATTERN_GRID_ROW_RANGE',
      `Row tampilan di luar Pattern: ${row}`,
    );
  }

  const start = row * resolvedRowTicks;
  const end = Math.min(pattern.lengthTicks, start + resolvedRowTicks);
  return pattern.notes
    .filter((note) => (
      note.trackId === trackId
      && note.startTickLocal >= start
      && note.startTickLocal < end
    ))
    .sort((a, b) => (
      a.startTickLocal - b.startTickLocal
      || voiceLaneOf(a) - voiceLaneOf(b)
      || a.id.localeCompare(b.id)
    ));
}

function noteCellKey(note) {
  return `${note.trackId}|${note.startTickLocal}|${voiceLaneOf(note)}`;
}

function compareNotes(a, b) {
  return a.startTickLocal - b.startTickLocal
    || a.trackId.localeCompare(b.trackId)
    || voiceLaneOf(a) - voiceLaneOf(b)
    || a.id.localeCompare(b.id);
}

function validateRowTicks(rowTicks) {
  if (!Number.isInteger(rowTicks) || rowTicks <= 0) {
    throw projectError(
      'E_PATTERN_GRID_ROW_TICKS',
      `rowTicks tampilan harus integer > 0: ${rowTicks}`,
    );
  }
}

function voiceLaneOf(note) {
  return Number.isInteger(note?.voiceLane) ? note.voiceLane : 0;
}
