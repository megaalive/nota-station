// Audio slice R1-S1. Clock tetap AudioContext.currentTime (§7.2); belum ada
// look-ahead scheduler di slice ini, jadi satu pattern kecil dijadwalkan dari satu anchor.

import { PPQ } from '../core/project.js';

const ROOT_PITCH = 60;
const PREVIEW_SECONDS = 0.18;

export function createAudioEngine({
  sampleUrl = new URL('../../assets/factory/basic.wav', import.meta.url),
} = {}) {
  let context = null;
  let sampleBytesPromise = null;
  let buffer = null;
  let state = 'locked';
  const activeSources = new Set();

  function preload() {
    if (!sampleBytesPromise) {
      sampleBytesPromise = fetch(sampleUrl).then(async (response) => {
        if (!response.ok) throw new Error(`Factory sample gagal dimuat: HTTP ${response.status}`);
        return response.arrayBuffer();
      });
    }
    return sampleBytesPromise;
  }

  async function ensureReady() {
    if (!context) context = new AudioContext({ latencyHint: 'interactive' });

    // resume dipanggil langsung dari click/keydown tepercaya sebelum pekerjaan async lain.
    if (context.state === 'suspended') await context.resume();

    if (!buffer) {
      const bytes = await preload();
      buffer = await context.decodeAudioData(bytes.slice(0));
    }
    state = 'ready';
    return context;
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
      sampleReady: Boolean(buffer),
      activeVoices: activeSources.size,
    };
  }

  return { preload, preview, playPattern, stop, getState };
}
