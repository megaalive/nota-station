import {
  cutEffectEventTemplates,
  effectEventTemplates,
  metronomeEventTemplates,
  mixEffectEventTemplates,
  patternEventTemplates,
  secondsPerTick,
} from './scheduler.js';
import { buildSongTimeline } from '../core/song-timeline.js';

export function songNoteEventTemplates(project, tempo, ppq) {
  return occurrenceTemplates(project, (pattern) => patternEventTemplates(pattern, tempo, ppq))
    .flatMap(({ entry, events }) => events.map((event) => ({
      ...event,
      id: `${entry.orderEntryId}:${event.id}`,
      occurrenceId: entry.orderEntryId,
      patternId: entry.patternId,
      orderEntryId: entry.orderEntryId,
      orderIndex: entry.orderIndex,
      sectionId: entry.sectionId,
      startTickSong: entry.startTickSong + event.startTickLocal,
      offsetSecondsSong: (entry.startTickSong + event.startTickLocal) * secondsPerTick(tempo, ppq),
    })));
}

export function songEffectEventTemplates(project, tempo, ppq) {
  return occurrenceTemplates(project, (pattern) => effectEventTemplates(pattern, tempo, ppq))
    .flatMap(({ entry, events }) => events.map((event) => occurrenceEvent(entry, event, tempo, ppq)));
}

export function songCutEventTemplates(project, tempo, ppq) {
  return occurrenceTemplates(project, (pattern) => cutEffectEventTemplates(pattern, tempo, ppq))
    .flatMap(({ entry, events }) => events.map((event) => occurrenceEvent(entry, event, tempo, ppq)));
}

export function songMixEffectEventTemplates(project, tempo, ppq) {
  const timeline = buildSongTimeline(project);
  const patterns = new Map(project.song.patterns.map((pattern) => [pattern.id, pattern]));
  return timeline.entries.flatMap((entry, index) => {
    const pattern = patterns.get(entry.patternId);
    const templates = mixEffectEventTemplates(pattern, tempo, ppq);
    const previousPattern = index > 0
      ? patterns.get(timeline.entries[index - 1].patternId)
      : null;
    const boundaryTracks = new Set([
      ...mixTrackIds(previousPattern),
      ...mixTrackIds(pattern),
    ]);
    const events = [];

    if (index > 0 && boundaryTracks.size > 0) {
      events.push({
        id: `${entry.orderEntryId}:mix-reset`,
        occurrenceId: entry.orderEntryId,
        orderEntryId: entry.orderEntryId,
        orderIndex: entry.orderIndex,
        patternId: entry.patternId,
        kind: 'mix-reset',
        trackIds: [...boundaryTracks].sort(),
        startTickSong: entry.startTickSong,
        startTickLocal: 0,
        offsetSecondsSong: entry.startTickSong * secondsPerTick(tempo, ppq),
      });
    }

    for (const event of templates) {
      if (event.kind === 'mix-reset') continue;
      events.push(occurrenceEvent(entry, event, tempo, ppq));
    }
    return events;
  }).sort(compareSongEvents);
}

export function songMetronomeEventTemplates(project) {
  return occurrenceTemplates(project, (pattern) => metronomeEventTemplates(pattern))
    .flatMap(({ entry, events }) => events.map((event) => ({
      ...event,
      id: `${entry.orderEntryId}:${event.id}`,
      occurrenceId: entry.orderEntryId,
      orderEntryId: entry.orderEntryId,
      orderIndex: entry.orderIndex,
      patternId: entry.patternId,
      startTickSong: entry.startTickSong + event.startTickLocal,
    })));
}

export function createSongNoteScheduleCursor(project, tempo, options = {}) {
  return createSongEventScheduleCursor(songNoteEventTemplates(project, tempo, options.ppq), project, tempo, options);
}

export function createSongEventScheduleCursor(events, project, tempo, options = {}) {
  const timeline = buildSongTimeline(project);
  const startOrderIndex = options.startOrderIndex ?? 0;
  const entry = timeline.entries[startOrderIndex];
  if (!entry) {
    throw songSchedulerError(
      'E_SONG_SCHEDULER_ORDER_INDEX',
      `Indeks OrderEntry tidak valid: ${startOrderIndex}`,
    );
  }

  const startTickSong = entry.startTickSong;
  const cursorTickSong = options.startTickSong ?? startTickSong;
  if (!Number.isFinite(cursorTickSong) || cursorTickSong < startTickSong || cursorTickSong > timeline.totalTicks) {
    throw songSchedulerError('E_SONG_SCHEDULER_TICK_RANGE', 'Tick awal Song di luar batas.');
  }
  const anchorTickSong = options.anchorTickSong ?? cursorTickSong;
  if (!Number.isFinite(anchorTickSong) || anchorTickSong < 0 || anchorTickSong > timeline.totalTicks) {
    throw songSchedulerError('E_SONG_SCHEDULER_TICK_RANGE', 'Tick anchor Song di luar batas.');
  }

  const sorted = events
    .filter((event) => event.startTickSong >= cursorTickSong)
    .slice()
    .sort(compareSongEvents);
  let index = 0;
  const tickSeconds = secondsPerTick(tempo, options.ppq);

  function drainUntil(anchor, horizon) {
    if (!Number.isFinite(anchor) || !Number.isFinite(horizon)) {
      throw new TypeError('Anchor dan horizon scheduler harus finite.');
    }
    if (horizon < anchor || index >= sorted.length) return [];
    const due = [];
    while (index < sorted.length) {
      const event = sorted[index];
      const when = anchor + (event.startTickSong - anchorTickSong) * tickSeconds;
      if (when > horizon) break;
      due.push({ ...event, when, cycle: 0 });
      index += 1;
    }
    return due;
  }

  return {
    drainUntil,
    isExhausted: () => index >= sorted.length,
    startTickSong,
    cursorTickSong,
    anchorTickSong,
    totalTicks: timeline.totalTicks,
  };
}

function occurrenceTemplates(project, createTemplates) {
  const timeline = buildSongTimeline(project);
  const patterns = new Map(project.song.patterns.map((pattern) => [pattern.id, pattern]));
  return timeline.entries.map((entry) => ({
    entry,
    events: createTemplates(patterns.get(entry.patternId)),
  }));
}

function occurrenceEvent(entry, event, tempo, ppq) {
  const startTickSong = entry.startTickSong + event.startTickLocal;
  const sourceEventId = event.id;
  return {
    ...event,
    id: `${entry.orderEntryId}:${sourceEventId}`,
    sourceEventId,
    occurrenceId: entry.orderEntryId,
    patternId: entry.patternId,
    orderEntryId: entry.orderEntryId,
    orderIndex: entry.orderIndex,
    sectionId: entry.sectionId,
    startTickSong,
    offsetSecondsSong: startTickSong * secondsPerTick(tempo, ppq),
  };
}

function mixTrackIds(pattern) {
  return [...new Set((pattern?.effects ?? [])
    .filter((effect) => effect.type === 'volume' || effect.type === 'pan')
    .map((effect) => effect.trackId))];
}

function compareSongEvents(a, b) {
  return a.startTickSong - b.startTickSong
    || Number(b.kind === 'mix-reset') - Number(a.kind === 'mix-reset')
    || (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    || String(a.trackId ?? '').localeCompare(String(b.trackId ?? ''))
    || String(a.id).localeCompare(String(b.id));
}

function songSchedulerError(code, message) {
  const error = new Error(message);
  error.name = 'SongSchedulerError';
  error.code = code;
  return error;
}
