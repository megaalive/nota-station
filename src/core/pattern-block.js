import { projectError } from './project.js';

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isoNow() {
  return new Date().toISOString();
}

export function copyPatternBlock(project, {
  patternId,
  rowStart,
  rowEnd,
  channelStart,
  channelEnd,
}) {
  const { pattern, tracks, bounds } = resolveBlock(
    project,
    { patternId, rowStart, rowEnd, channelStart, channelEnd },
  );
  const startTick = bounds.rowStart * pattern.rowTicks;
  const endTick = (bounds.rowEnd + 1) * pattern.rowTicks;
  const selectedTrackIds = new Map();
  for (let channel = bounds.channelStart; channel <= bounds.channelEnd; channel += 1) {
    selectedTrackIds.set(tracks[channel].id, channel - bounds.channelStart);
  }

  const channels = tracks
    .slice(bounds.channelStart, bounds.channelEnd + 1)
    .map((track) => ({
      kind: track.kind,
      polyphony: track.polyphony,
    }));

  const events = pattern.notes
    .filter((note) => (
      selectedTrackIds.has(note.trackId)
      && note.startTickLocal >= startTick
      && note.startTickLocal < endTick
    ))
    .map((note) => ({
      sourceId: note.id,
      channelOffset: selectedTrackIds.get(note.trackId),
      tickOffset: note.startTickLocal - startTick,
      durationTicks: note.durationTicks,
      pitch: note.pitch,
      instrumentId: note.instrumentId,
      velocity: note.velocity,
      voiceLane: voiceLaneOf(note),
      source: note.source ?? 'user',
      locked: Boolean(note.locked),
    }))
    .sort(compareClipboardEvents);

  return Object.freeze({
    version: 1,
    rowCount: bounds.rowEnd - bounds.rowStart + 1,
    channelCount: bounds.channelEnd - bounds.channelStart + 1,
    sourceRowTicks: pattern.rowTicks,
    spanTicks: endTick - startTick,
    channels: Object.freeze(channels.map((channel) => Object.freeze(channel))),
    events: Object.freeze(events.map((event) => Object.freeze(event))),
  });
}

export function pastePatternBlock(
  project,
  {
    patternId,
    targetRow,
    targetChannel,
    block,
  },
  { idFactory = makeId, now = isoNow } = {},
) {
  const { pattern, patternIndex, tracks } = resolvePattern(project, patternId);
  validateClipboard(block);
  validateIndex(targetRow, 0, pattern.lengthTicks / pattern.rowTicks - 1, 'row');
  validateIndex(targetChannel, 0, tracks.length - 1, 'channel');

  if (targetChannel + block.channelCount > tracks.length) {
    throw projectError(
      'E_PATTERN_BLOCK_RANGE',
      'Paste block melewati channel terakhir.',
    );
  }

  const targetStartTick = targetRow * pattern.rowTicks;
  const pasted = block.events.map((event) => {
    const track = tracks[targetChannel + event.channelOffset];
    const sourceChannel = block.channels[event.channelOffset];
    if (!track) {
      throw projectError('E_PATTERN_BLOCK_RANGE', 'Channel tujuan block tidak tersedia.');
    }
    if (sourceChannel.kind !== track.kind) {
      throw projectError(
        'E_PATTERN_BLOCK_TRACK_KIND',
        `Jenis channel clipboard ${sourceChannel.kind} tidak cocok dengan tujuan ${track.kind}.`,
      );
    }
    const startTickLocal = targetStartTick + event.tickOffset;
    if (
      startTickLocal < 0
      || startTickLocal >= pattern.lengthTicks
      || startTickLocal + event.durationTicks > pattern.lengthTicks
    ) {
      throw projectError(
        'E_PATTERN_BLOCK_RANGE',
        'Paste block melewati panjang Pattern.',
      );
    }
    if (
      track.polyphony !== 'poly'
      && event.voiceLane !== 0
    ) {
      throw projectError(
        'E_PATTERN_BLOCK_POLYPHONY',
        `Channel ${targetChannel + event.channelOffset + 1} tidak menerima voice lane ${event.voiceLane}.`,
      );
    }
    if (!project.instruments.some((item) => item.id === event.instrumentId)) {
      throw projectError(
        'E_PROJECT_INSTRUMENT_MISSING',
        `Instrument clipboard tidak ditemukan: ${event.instrumentId}`,
      );
    }

    return {
      id: idFactory('note'),
      trackId: track.id,
      startTickLocal,
      durationTicks: event.durationTicks,
      pitch: event.pitch,
      instrumentId: event.instrumentId,
      velocity: event.velocity,
      ...(event.voiceLane === 0 ? {} : { voiceLane: event.voiceLane }),
      source: 'user',
      locked: false,
    };
  });

  const collisionKeys = new Set(
    pasted.map((note) => noteCellKey(note.trackId, note.startTickLocal, voiceLaneOf(note))),
  );
  const notes = pattern.notes
    .filter((note) => !collisionKeys.has(
      noteCellKey(note.trackId, note.startTickLocal, voiceLaneOf(note)),
    ))
    .concat(pasted)
    .sort(compareNotes);

  if (pasted.length === 0) return project;
  return replacePatternNotes(project, patternIndex, pattern, notes, now);
}

export function insertPatternRows(
  project,
  {
    patternId,
    row,
    count = 1,
    channelStart,
    channelEnd,
  },
  { now = isoNow } = {},
) {
  const { pattern, patternIndex, tracks } = resolvePattern(project, patternId);
  const rowCount = pattern.lengthTicks / pattern.rowTicks;
  validateRowOperation(row, count, rowCount);
  validateIndex(channelStart, 0, tracks.length - 1, 'channelStart');
  validateIndex(channelEnd, 0, tracks.length - 1, 'channelEnd');

  const firstChannel = Math.min(channelStart, channelEnd);
  const lastChannel = Math.max(channelStart, channelEnd);
  const selectedTrackIds = new Set(
    tracks.slice(firstChannel, lastChannel + 1).map((track) => track.id),
  );
  const atTick = row * pattern.rowTicks;
  const delta = count * pattern.rowTicks;

  const notes = [];
  let changed = false;

  for (const note of pattern.notes) {
    if (!selectedTrackIds.has(note.trackId)) {
      notes.push(note);
      continue;
    }

    const start = note.startTickLocal;
    const end = start + note.durationTicks;
    if (start >= atTick) {
      const nextStart = start + delta;
      if (nextStart >= pattern.lengthTicks) {
        changed = true;
        continue;
      }
      const nextEnd = Math.min(pattern.lengthTicks, end + delta);
      notes.push({
        ...note,
        startTickLocal: nextStart,
        durationTicks: nextEnd - nextStart,
      });
      changed = true;
      continue;
    }

    if (end > atTick) {
      const nextEnd = Math.min(pattern.lengthTicks, end + delta);
      notes.push({
        ...note,
        durationTicks: nextEnd - start,
      });
      changed = true;
      continue;
    }

    notes.push(note);
  }

  if (!changed) return project;
  notes.sort(compareNotes);
  return replacePatternNotes(project, patternIndex, pattern, notes, now);
}

export function deletePatternRows(
  project,
  {
    patternId,
    row,
    count = 1,
    channelStart,
    channelEnd,
  },
  { now = isoNow } = {},
) {
  const { pattern, patternIndex, tracks } = resolvePattern(project, patternId);
  const rowCount = pattern.lengthTicks / pattern.rowTicks;
  validateRowOperation(row, count, rowCount);
  validateIndex(channelStart, 0, tracks.length - 1, 'channelStart');
  validateIndex(channelEnd, 0, tracks.length - 1, 'channelEnd');

  const firstChannel = Math.min(channelStart, channelEnd);
  const lastChannel = Math.max(channelStart, channelEnd);
  const selectedTrackIds = new Set(
    tracks.slice(firstChannel, lastChannel + 1).map((track) => track.id),
  );
  const atTick = row * pattern.rowTicks;
  const delta = count * pattern.rowTicks;
  const deleteEnd = atTick + delta;

  const notes = [];
  let changed = false;

  for (const note of pattern.notes) {
    if (!selectedTrackIds.has(note.trackId)) {
      notes.push(note);
      continue;
    }

    const start = note.startTickLocal;
    const end = start + note.durationTicks;

    if (start >= deleteEnd) {
      notes.push({
        ...note,
        startTickLocal: start - delta,
      });
      changed = true;
      continue;
    }

    if (start >= atTick) {
      changed = true;
      continue;
    }

    if (end > atTick) {
      const nextEnd = end <= deleteEnd ? atTick : end - delta;
      if (nextEnd > start) {
        notes.push({
          ...note,
          durationTicks: nextEnd - start,
        });
      }
      changed = true;
      continue;
    }

    notes.push(note);
  }

  if (!changed) return project;
  notes.sort(compareNotes);
  return replacePatternNotes(project, patternIndex, pattern, notes, now);
}

export function interpolatePatternVelocity(
  project,
  {
    patternId,
    rowStart,
    rowEnd,
    channelStart,
    channelEnd,
  },
  { now = isoNow } = {},
) {
  const { pattern, patternIndex, tracks, bounds } = resolveBlock(
    project,
    { patternId, rowStart, rowEnd, channelStart, channelEnd },
  );
  const startTick = bounds.rowStart * pattern.rowTicks;
  const endTick = (bounds.rowEnd + 1) * pattern.rowTicks;
  const selectedTrackIds = new Set(
    tracks.slice(bounds.channelStart, bounds.channelEnd + 1).map((track) => track.id),
  );

  const groups = new Map();
  for (const note of pattern.notes) {
    if (
      !selectedTrackIds.has(note.trackId)
      || note.startTickLocal < startTick
      || note.startTickLocal >= endTick
    ) {
      continue;
    }
    const key = `${note.trackId}|${voiceLaneOf(note)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }

  const velocityById = new Map();
  for (const group of groups.values()) {
    group.sort((a, b) => a.startTickLocal - b.startTickLocal || a.id.localeCompare(b.id));
    const first = group[0];
    const last = group[group.length - 1];
    if (!first || !last || first.startTickLocal === last.startTickLocal) continue;

    const span = last.startTickLocal - first.startTickLocal;
    for (const note of group) {
      const ratio = (note.startTickLocal - first.startTickLocal) / span;
      const velocity = Math.max(
        0,
        Math.min(
          127,
          Math.round(first.velocity + (last.velocity - first.velocity) * ratio),
        ),
      );
      velocityById.set(note.id, velocity);
    }
  }

  if (velocityById.size === 0) return project;

  let changed = false;
  const notes = pattern.notes.map((note) => {
    if (!velocityById.has(note.id)) return note;
    const velocity = velocityById.get(note.id);
    if (velocity === note.velocity) return note;
    changed = true;
    return { ...note, velocity };
  });

  if (!changed) return project;
  return replacePatternNotes(project, patternIndex, pattern, notes, now);
}

export function transposePatternBlock(
  project,
  {
    patternId,
    rowStart,
    rowEnd,
    channelStart,
    channelEnd,
    semitones,
  },
  { now = isoNow } = {},
) {
  if (!Number.isInteger(semitones) || semitones < -127 || semitones > 127) {
    throw projectError(
      'E_PATTERN_BLOCK_TRANSPOSE',
      `Transpose harus integer -127..127: ${semitones}`,
    );
  }
  if (semitones === 0) return project;

  const { pattern, patternIndex, tracks, bounds } = resolveBlock(
    project,
    { patternId, rowStart, rowEnd, channelStart, channelEnd },
  );
  const startTick = bounds.rowStart * pattern.rowTicks;
  const endTick = (bounds.rowEnd + 1) * pattern.rowTicks;
  const selectedTrackIds = new Set(
    tracks
      .slice(bounds.channelStart, bounds.channelEnd + 1)
      .filter((track) => track.kind !== 'drum')
      .map((track) => track.id),
  );

  const selected = pattern.notes.filter((note) => (
    selectedTrackIds.has(note.trackId)
    && note.startTickLocal >= startTick
    && note.startTickLocal < endTick
  ));
  if (selected.length === 0) return project;

  for (const note of selected) {
    const pitch = note.pitch + semitones;
    if (pitch < 0 || pitch > 127) {
      throw projectError(
        'E_PATTERN_BLOCK_PITCH_RANGE',
        `Transpose membuat pitch di luar MIDI 0..127: ${pitch}`,
      );
    }
  }

  const selectedIds = new Set(selected.map((note) => note.id));
  const notes = pattern.notes.map((note) => (
    selectedIds.has(note.id)
      ? { ...note, pitch: note.pitch + semitones }
      : note
  ));

  return replacePatternNotes(project, patternIndex, pattern, notes, now);
}

function validateRowOperation(row, count, rowCount) {
  validateIndex(row, 0, rowCount - 1, 'row');
  if (!Number.isInteger(count) || count < 1 || row + count > rowCount) {
    throw projectError(
      'E_PATTERN_ROW_RANGE',
      `Jumlah row di luar Pattern: row=${row}, count=${count}`,
    );
  }
}

function resolveBlock(project, {
  patternId,
  rowStart,
  rowEnd,
  channelStart,
  channelEnd,
}) {
  const resolved = resolvePattern(project, patternId);
  const rowCount = resolved.pattern.lengthTicks / resolved.pattern.rowTicks;
  validateIndex(rowStart, 0, rowCount - 1, 'rowStart');
  validateIndex(rowEnd, 0, rowCount - 1, 'rowEnd');
  validateIndex(channelStart, 0, resolved.tracks.length - 1, 'channelStart');
  validateIndex(channelEnd, 0, resolved.tracks.length - 1, 'channelEnd');

  return {
    ...resolved,
    bounds: {
      rowStart: Math.min(rowStart, rowEnd),
      rowEnd: Math.max(rowStart, rowEnd),
      channelStart: Math.min(channelStart, channelEnd),
      channelEnd: Math.max(channelStart, channelEnd),
    },
  };
}

function resolvePattern(project, patternId) {
  const patternIndex = project.song.patterns.findIndex((item) => item.id === patternId);
  if (patternIndex < 0) {
    throw projectError(
      'E_PROJECT_PATTERN_MISSING',
      `Pattern tidak ditemukan: ${patternId}`,
    );
  }
  return {
    pattern: project.song.patterns[patternIndex],
    patternIndex,
    tracks: project.song.tracks,
  };
}

function validateClipboard(block) {
  if (
    !block
    || block.version !== 1
    || !Number.isInteger(block.rowCount)
    || block.rowCount < 1
    || !Number.isInteger(block.channelCount)
    || block.channelCount < 1
    || !Array.isArray(block.channels)
    || block.channels.length !== block.channelCount
    || !Array.isArray(block.events)
  ) {
    throw projectError('E_PATTERN_BLOCK_CLIPBOARD', 'Clipboard block tidak valid.');
  }

  for (const channel of block.channels) {
    if (
      !channel
      || !['instrument', 'drum'].includes(channel.kind)
      || !['mono', 'poly'].includes(channel.polyphony)
    ) {
      throw projectError('E_PATTERN_BLOCK_CLIPBOARD', 'Metadata channel clipboard tidak valid.');
    }
  }

  for (const event of block.events) {
    if (
      !event
      || !Number.isInteger(event.channelOffset)
      || event.channelOffset < 0
      || event.channelOffset >= block.channelCount
      || !Number.isInteger(event.tickOffset)
      || event.tickOffset < 0
      || !Number.isInteger(event.durationTicks)
      || event.durationTicks <= 0
      || !Number.isInteger(event.pitch)
      || event.pitch < 0
      || event.pitch > 127
      || !Number.isInteger(event.velocity)
      || event.velocity < 0
      || event.velocity > 127
      || !Number.isInteger(event.voiceLane)
      || event.voiceLane < 0
      || event.voiceLane > 31
      || typeof event.instrumentId !== 'string'
      || event.instrumentId.length === 0
    ) {
      throw projectError('E_PATTERN_BLOCK_CLIPBOARD', 'Event clipboard block tidak valid.');
    }
  }
}

function validateIndex(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw projectError(
      'E_PATTERN_BLOCK_RANGE',
      `${label} di luar rentang ${min}..${max}: ${value}`,
    );
  }
}

function replacePatternNotes(project, patternIndex, pattern, notes, now) {
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

function voiceLaneOf(note) {
  return Number.isInteger(note?.voiceLane) ? note.voiceLane : 0;
}

function noteCellKey(trackId, tick, voiceLane) {
  return `${trackId}|${tick}|${voiceLane}`;
}

function compareClipboardEvents(a, b) {
  return a.tickOffset - b.tickOffset
    || a.channelOffset - b.channelOffset
    || a.voiceLane - b.voiceLane
    || a.sourceId.localeCompare(b.sourceId);
}

function compareNotes(a, b) {
  return a.startTickLocal - b.startTickLocal
    || a.trackId.localeCompare(b.trackId)
    || voiceLaneOf(a) - voiceLaneOf(b)
    || a.id.localeCompare(b.id);
}
