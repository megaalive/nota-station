// Audio R1 memakai AudioContext.currentTime sebagai jam musik (§7.2).
// S4 menambahkan look-ahead scheduler; setInterval hanya wake-up, bukan sumber waktu musikal.

import {
  FACTORY_BASIC_ROOT_PITCH,
  FACTORY_BASIC_WAV_BASE64,
} from './factory-sample.js';
import {
  SCHEDULE_AHEAD_SECONDS,
  SCHEDULER_WAKE_MS,
  createPatternScheduleCursor,
} from './scheduler.js';

const ROOT_PITCH = FACTORY_BASIC_ROOT_PITCH;
const PREVIEW_SECONDS = 0.18;

export function createAudioEngine({ onStateChange = null } = {}) {
  let context = null;
  let sampleBytesPromise = null;
  let buffer = null;
  let state = 'locked';
  let schedulerTimer = null;
  let playback = null;
  const activeSources = new Map();

  function preload() {
    if (!sampleBytesPromise) {
      // Sample kecil sengaja embedded di R1 supaya first sound tidak bergantung request
      // tambahan. Factory pack lazy yang sebenarnya baru masuk R2.
      sampleBytesPromise = Promise.resolve(decodeBase64(FACTORY_BASIC_WAV_BASE64));
    }
    return sampleBytesPromise;
  }

  async function ensureReady() {
    if (!context) context = new AudioContext({ latencyHint: 'interactive' });

    // Minta resume langsung dari click/keydown tepercaya, tetapi jangan menjadikan
    // penyelesaian Promise resume sebagai gate scheduler. Firefox headless dapat
    // membiarkan Promise itu pending walau node audio tetap boleh dibuat/dijadwalkan.
    // Di browser interaktif, context akan berpindah ke running setelah izin gestur.
    requestResume();

    if (!buffer) {
      const bytes = await preload();
      buffer = await context.decodeAudioData(bytes.slice(0));
    }
    state = 'ready';
    return context;
  }

  function requestResume() {
    if (!context || context.state !== 'suspended') return;
    try {
      const pending = context.resume();
      if (pending && typeof pending.catch === 'function') {
        void pending.catch(() => {
          // Status context tetap tersedia lewat getState(); scheduler tidak dirusak
          // hanya karena browser menolak/menunda unlock audio.
        });
      }
    } catch {
      // Beberapa implementasi bisa melempar sinkron. Node tetap dapat dijadwalkan
      // dan UI dapat membaca contextState untuk diagnosa.
    }
  }

  function scheduleVoice({ pitch, velocity = 100, when, durationSeconds }) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(2 ** ((pitch - ROOT_PITCH) / 12), when);

    const level = Math.max(0.0001, Math.min(1, velocity / 127) * 0.75);
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.03, durationSeconds));

    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => activeSources.delete(source);
    activeSources.set(source, { when });
    source.start(when);
    source.stop(when + Math.max(0.04, durationSeconds));
    return source;
  }

  async function preview(pitch, velocity = 100) {
    await ensureReady();
    const when = context.currentTime + 0.005;
    scheduleVoice({ pitch, velocity, when, durationSeconds: PREVIEW_SECONDS });
    return when;
  }

  async function playPattern(project, pattern, { loop = false } = {}) {
    await ensureReady();
    stop();

    const tempo = project.song.initial.tempo;
    const anchor = context.currentTime + 0.05;
    const cursor = createPatternScheduleCursor(pattern, tempo, { loop });

    playback = {
      anchor,
      cursor,
      loop: Boolean(loop),
      durationSeconds: cursor.durationSeconds,
      notesScheduled: 0,
      endAt: anchor + cursor.durationSeconds,
    };

    setState('playing');
    scheduleWindow();
    schedulerTimer = setInterval(scheduleWindow, SCHEDULER_WAKE_MS);

    return {
      anchor,
      durationSeconds: cursor.durationSeconds,
      notesScheduled: playback.notesScheduled,
      loop: playback.loop,
    };
  }

  function scheduleWindow() {
    if (!context || !playback || state !== 'playing') return;

    const now = context.currentTime;
    const horizon = now + SCHEDULE_AHEAD_SECONDS;
    const due = playback.cursor.drainUntil(playback.anchor, horizon);

    for (const event of due) {
      scheduleVoice({
        pitch: event.pitch,
        velocity: event.velocity,
        when: Math.max(event.when, now + 0.001),
        durationSeconds: event.durationSeconds,
      });
      playback.notesScheduled += 1;
    }

    if (!playback.loop && playback.cursor.isExhausted() && now >= playback.endAt) {
      clearScheduler();
      playback = null;
      setState('ready');
    }
  }

  function setLoop(enabled) {
    if (!playback) return false;
    playback.loop = Boolean(enabled);
    playback.cursor.setLoop(playback.loop);
    return true;
  }

  function stopSources() {
    for (const source of [...activeSources.keys()]) {
      try {
        source.stop();
      } catch {
        // Source yang sudah selesai bisa menolak stop kedua; state tetap aman dibersihkan.
      }
    }
    activeSources.clear();
  }

  function clearScheduler() {
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    onStateChange?.(state);
  }

  function stop() {
    clearScheduler();
    stopSources();
    playback = null;
    if (context) setState('ready');
  }

  function getState() {
    return {
      state,
      contextState: context?.state ?? 'none',
      sampleReady: Boolean(buffer),
      activeVoices: activeSources.size,
      loop: playback?.loop ?? false,
      schedulerActive: schedulerTimer !== null,
      anchor: playback?.anchor ?? null,
      durationSeconds: playback?.durationSeconds ?? null,
      notesScheduled: playback?.notesScheduled ?? 0,
    };
  }

  return { preload, preview, playPattern, stop, setLoop, getState };
}


function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
