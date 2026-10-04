// Audio slice R1-S1. Clock tetap AudioContext.currentTime (§7.2); belum ada
// look-ahead scheduler di slice ini, jadi satu pattern kecil dijadwalkan dari satu anchor.

import { PPQ } from '../core/project.js';
import {
  FACTORY_BASIC_ROOT_PITCH,
  FACTORY_BASIC_WAV_BASE64,
} from './factory-sample.js';

const ROOT_PITCH = FACTORY_BASIC_ROOT_PITCH;
const PREVIEW_SECONDS = 0.18;

export function createAudioEngine() {
  let context = null;
  let sampleBytesPromise = null;
  let buffer = null;
  let state = 'locked';
  const activeSources = new Set();

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
    activeSources.add(source);
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

  async function playPattern(project, pattern) {
    await ensureReady();
    stopSources();
    const tempo = project.song.initial.tempo;
    const secondsPerTick = 60 / tempo / PPQ;
    const anchor = context.currentTime + 0.05;

    for (const note of pattern.notes) {
      scheduleVoice({
        pitch: note.pitch,
        velocity: note.velocity,
        when: anchor + note.startTickLocal * secondsPerTick,
        durationSeconds: note.durationTicks * secondsPerTick,
      });
    }

    state = 'playing';
    return {
      anchor,
      durationSeconds: pattern.lengthTicks * secondsPerTick,
      notesScheduled: pattern.notes.length,
    };
  }

  function stopSources() {
    for (const source of [...activeSources]) {
      try {
        source.stop();
      } catch {
        // Source yang sudah selesai bisa menolak stop kedua; state tetap aman dibersihkan.
      }
    }
    activeSources.clear();
  }

  function stop() {
    stopSources();
    if (context) state = 'ready';
  }

  function getState() {
    return {
      state,
      contextState: context?.state ?? 'none',
      sampleReady: Boolean(buffer),
      activeVoices: activeSources.size,
    };
  }

  return { preload, preview, playPattern, stop, getState };
}


function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
