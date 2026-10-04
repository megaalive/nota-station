import { PPQ } from '../core/project.js';

export const SCHEDULE_AHEAD_SECONDS = 0.12;
export const SCHEDULER_WAKE_MS = 25;
export const LIVE_EDIT_FREEZE_SECONDS = 0.03;

export function liveEditFreezeTime(nowAudioTime, freezeSeconds = LIVE_EDIT_FREEZE_SECONDS) {
  if (!Number.isFinite(nowAudioTime) || !Number.isFinite(freezeSeconds) || freezeSeconds < 0) {
    throw new TypeError('Freeze window live-edit harus angka finite >= 0.');
  }
  return nowAudioTime + freezeSeconds;
}

export function isLiveEditMutable(when, nowAudioTime, freezeSeconds = LIVE_EDIT_FREEZE_SECONDS) {
  if (!Number.isFinite(when)) throw new TypeError('Waktu event live-edit harus finite.');
  return when >= liveEditFreezeTime(nowAudioTime, freezeSeconds);
}

export function secondsPerTick(tempo, ppq = PPQ) {
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new TypeError('Tempo harus angka > 0.');
  }
  return 60 / tempo / ppq;
}

export function patternDurationSeconds(pattern, tempo, ppq = PPQ) {
  return pattern.lengthTicks * secondsPerTick(tempo, ppq);
}

export function patternEventTemplates(pattern, tempo, ppq = PPQ) {
  const tickSeconds = secondsPerTick(tempo, ppq);
  return [...pattern.notes]
    .sort((a, b) => a.startTickLocal - b.startTickLocal || a.trackId.localeCompare(b.trackId))
    .map((note) => ({
      id: note.id,
      pitch: note.pitch,
      velocity: note.velocity,
      startTickLocal: note.startTickLocal,
      offsetSeconds: note.startTickLocal * tickSeconds,
      durationSeconds: note.durationTicks * tickSeconds,
    }));
}

export function metronomeEventTemplates(pattern, ppq = PPQ) {
  const meter = pattern.meter ?? { num: 4, den: 4 };
  const beatTicks = ppq * (4 / meter.den);
  const barTicks = beatTicks * meter.num;
  const events = [];

  for (let tick = 0; tick < pattern.lengthTicks; tick += beatTicks) {
    events.push({
      id: `metronome-${tick}`,
      startTickLocal: tick,
      accent: tick % barTicks === 0,
    });
  }
  return events;
}

export function transportTickAtAudioTime({
  anchorAudioTime,
  anchorTick,
  nowAudioTime,
  tempo,
  patternLengthTicks,
  loop = false,
  ppq = PPQ,
}) {
  if (![anchorAudioTime, anchorTick, nowAudioTime, patternLengthTicks].every(Number.isFinite)) {
    throw new TypeError('Posisi transport membutuhkan angka finite.');
  }
  if (patternLengthTicks <= 0) return 0;

  const elapsed = Math.max(0, nowAudioTime - anchorAudioTime);
  const raw = anchorTick + elapsed / secondsPerTick(tempo, ppq);
  if (loop) return ((raw % patternLengthTicks) + patternLengthTicks) % patternLengthTicks;
  return Math.max(0, Math.min(patternLengthTicks, raw));
}

function createTickScheduleCursor(events, patternLengthTicks, tempo, {
  loop = false,
  startTick = 0,
  ppq = PPQ,
} = {}) {
  if (!Number.isFinite(startTick) || startTick < 0 || startTick > patternLengthTicks) {
    throw new RangeError(`startTick di luar Pattern: ${startTick}`);
  }

  const tickSeconds = secondsPerTick(tempo, ppq);
  const normalizedStart = loop && startTick === patternLengthTicks ? 0 : startTick;
  let cycle = 0;
  let index = events.findIndex((event) => event.startTickLocal >= normalizedStart);
  let loopEnabled = Boolean(loop);
  let exhausted = events.length === 0;

  if (!exhausted && index < 0) {
    if (loopEnabled) {
      cycle = 1;
      index = 0;
    } else {
      exhausted = true;
      index = 0;
    }
  }

  function setLoop(enabled) {
    loopEnabled = Boolean(enabled);
    if (!loopEnabled && cycle > 0 && index === 0) exhausted = true;
  }

  function drainUntil(anchor, horizon) {
    if (!Number.isFinite(anchor) || !Number.isFinite(horizon)) {
      throw new TypeError('Anchor dan horizon scheduler harus finite.');
    }
    if (horizon < anchor || exhausted) return [];

    const due = [];
    while (!exhausted) {
      const event = events[index];
      const absoluteTick = cycle * patternLengthTicks + event.startTickLocal;
      const when = anchor + (absoluteTick - normalizedStart) * tickSeconds;
      if (when > horizon) break;

      due.push({ ...event, when, cycle });
      index += 1;
      if (index >= events.length) {
        if (!loopEnabled) {
          exhausted = true;
          break;
        }
        cycle += 1;
        index = 0;
      }
    }
    return due;
  }

  return { drainUntil, setLoop, isExhausted: () => exhausted };
}

export function createPatternScheduleCursor(pattern, tempo, {
  loop = false,
  startTick = 0,
  ppq = PPQ,
} = {}) {
  const events = patternEventTemplates(pattern, tempo, ppq);
  const cursor = createTickScheduleCursor(events, pattern.lengthTicks, tempo, { loop, startTick, ppq });
  return {
    ...cursor,
    durationSeconds: patternDurationSeconds(pattern, tempo, ppq),
    eventCount: events.length,
  };
}

export function createMetronomeScheduleCursor(pattern, tempo, {
  loop = false,
  startTick = 0,
  ppq = PPQ,
} = {}) {
  return createTickScheduleCursor(
    metronomeEventTemplates(pattern, ppq),
    pattern.lengthTicks,
    tempo,
    { loop, startTick, ppq },
  );
}
