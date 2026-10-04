import { PPQ } from '../core/project.js';

export const SCHEDULE_AHEAD_SECONDS = 0.12;
export const SCHEDULER_WAKE_MS = 25;

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
      offsetSeconds: note.startTickLocal * tickSeconds,
      durationSeconds: note.durationTicks * tickSeconds,
    }));
}

/**
 * Cursor scheduler murni. Ia tidak memakai wall-clock; caller memberi anchor audio
 * clock dan horizon. Loop dihitung dari cycle integer * durasi Pattern agar tidak
 * mengakumulasi rounding dari penjumlahan waktu sebelumnya.
 */
export function createPatternScheduleCursor(pattern, tempo, { loop = false, ppq = PPQ } = {}) {
  const events = patternEventTemplates(pattern, tempo, ppq);
  const durationSeconds = patternDurationSeconds(pattern, tempo, ppq);
  let cycle = 0;
  let index = 0;
  let loopEnabled = Boolean(loop);
  let exhausted = events.length === 0;

  function setLoop(enabled) {
    loopEnabled = Boolean(enabled);
    // Kalau cycle berikutnya belum mulai dijadwalkan, mematikan loop harus berhenti
    // persis di batas Pattern, bukan membocorkan event pertama cycle berikutnya.
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
      const when = anchor + cycle * durationSeconds + event.offsetSeconds;
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

  return {
    drainUntil,
    setLoop,
    isExhausted: () => exhausted,
    durationSeconds,
    eventCount: events.length,
  };
}
