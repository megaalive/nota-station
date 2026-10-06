import { projectError } from './project.js';

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
