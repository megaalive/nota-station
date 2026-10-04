// Transport R1-S5. AudioContext.currentTime adalah jam musik; timer hanya
// membangunkan look-ahead scheduler (§7.2).

import {
  FACTORY_BASIC_ROOT_PITCH,
  FACTORY_BASIC_WAV_BASE64,
} from './factory-sample.js';
import {
  LIVE_EDIT_FREEZE_SECONDS,
  SCHEDULE_AHEAD_SECONDS,
  SCHEDULER_WAKE_MS,
  createMetronomeScheduleCursor,
  createPatternScheduleCursor,
  isLiveEditMutable,
  liveEditFreezeTime,
  secondsPerTick,
  transportTickAtAudioTime,
} from './scheduler.js';

const ROOT_PITCH = FACTORY_BASIC_ROOT_PITCH;
const PREVIEW_SECONDS = 0.18;

export function createAudioEngine({ onStateChange = null, onPositionChange = null } = {}) {
  let context = null;
  let sampleBytesPromise = null;
  let buffer = null;
  let state = 'locked';
  let schedulerTimer = null;
  let playback = null;
  let positionTick = 0;
  let loopEnabled = true;
  let metronomeEnabled = false;
  let lastTempo = 120;
  let scheduleRevision = 0;
  let liveEditRevision = 0;
  let liveEditCanceledNotes = 0;
  let lastLiveEditCanceledNotes = 0;
  let lastLiveEditFreezeTick = null;
  const activeSources = new Map();

  function preload() {
    if (!sampleBytesPromise) {
      sampleBytesPromise = Promise.resolve(decodeBase64(FACTORY_BASIC_WAV_BASE64));
    }
    return sampleBytesPromise;
  }

  async function ensureReady() {
    if (!context) context = new AudioContext({ latencyHint: 'interactive' });
    requestResume();

    if (!buffer) {
      const bytes = await preload();
      buffer = await context.decodeAudioData(bytes.slice(0));
    }
    if (state === 'locked') setState('ready');
    return context;
  }

  function requestResume() {
    if (!context || context.state !== 'suspended') return;
    try {
      const pending = context.resume();
      if (pending && typeof pending.catch === 'function') void pending.catch(() => {});
    } catch {
      // Browser boleh menunda unlock; scheduler tetap dapat menyiapkan node.
    }
  }

  function trackSource(source, when, kind, metadata = {}) {
    activeSources.set(source, { when, kind, ...metadata });
    source.onended = () => activeSources.delete(source);
  }

  function scheduleVoice({
    pitch,
    velocity = 100,
    when,
    durationSeconds,
    kind = 'note',
    noteId = null,
    cycle = null,
  }) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(2 ** ((pitch - ROOT_PITCH) / 12), when);

    const level = Math.max(0.0001, Math.min(1, velocity / 127) * 0.75);
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.03, durationSeconds));

    source.connect(gain);
    gain.connect(context.destination);
    trackSource(source, when, kind, { noteId, cycle });
    source.start(when);
    source.stop(when + Math.max(0.04, durationSeconds));
  }

  function scheduleClick({ when, accent }) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(accent ? 1760 : 1320, when);
    gain.gain.setValueAtTime(accent ? 0.16 : 0.09, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    oscillator.connect(gain);
    gain.connect(context.destination);
    trackSource(oscillator, when, 'metronome');
    oscillator.start(when);
    oscillator.stop(when + 0.04);
  }

  async function activate() {
    await ensureReady();
    return getState();
  }

  async function preview(pitch, velocity = 100) {
    await ensureReady();
    const when = context.currentTime + 0.005;
    scheduleVoice({
      pitch,
      velocity,
      when,
      durationSeconds: PREVIEW_SECONDS,
      kind: 'preview',
    });
    return when;
  }

  function currentTick() {
    if (!playback || state !== 'playing' || !context) return positionTick;
    return transportTickAtAudioTime({
      anchorAudioTime: playback.anchor,
      anchorTick: playback.startTick,
      nowAudioTime: context.currentTime,
      tempo: playback.tempo,
      patternLengthTicks: playback.pattern.lengthTicks,
      loop: playback.loop,
    });
  }

  function startPlayback(project, pattern, startTick) {
    clearScheduler();
    stopSources();

    const tempo = project.song.initial.tempo;
    lastTempo = tempo;
    const normalizedTick = loopEnabled && startTick === pattern.lengthTicks ? 0 : startTick;
    const anchor = context.currentTime + 0.05;

    playback = {
      pattern,
      tempo,
      anchor,
      startTick: normalizedTick,
      loop: loopEnabled,
      noteAnchor: anchor,
      noteCursor: createPatternScheduleCursor(pattern, tempo, {
        loop: loopEnabled,
        startTick: normalizedTick,
      }),
      metronomeCursor: metronomeEnabled
        ? createMetronomeScheduleCursor(pattern, tempo, {
          loop: loopEnabled,
          startTick: normalizedTick,
        })
        : null,
      durationSeconds: pattern.lengthTicks * secondsPerTick(tempo),
      endAt: anchor + Math.max(0, pattern.lengthTicks - normalizedTick) * secondsPerTick(tempo),
      revision: ++scheduleRevision,
      notesScheduled: 0,
      clicksScheduled: 0,
    };

    positionTick = normalizedTick;
    setState('playing');
    scheduleWindow();
    schedulerTimer = setInterval(scheduleWindow, SCHEDULER_WAKE_MS);
    notifyPosition();
  }

  async function playPattern(project, pattern, {
    startTick = null,
    loop = loopEnabled,
    metronome = metronomeEnabled,
  } = {}) {
    await ensureReady();
    if (state === 'playing') return getState();

    loopEnabled = Boolean(loop);
    metronomeEnabled = Boolean(metronome);
    let nextTick = startTick ?? positionTick;
    if (nextTick >= pattern.lengthTicks && !loopEnabled) nextTick = 0;
    startPlayback(project, pattern, nextTick);
    return getState();
  }

  function scheduleWindow() {
    if (!context || !playback || state !== 'playing') return;

    const now = context.currentTime;
    const horizon = now + SCHEDULE_AHEAD_SECONDS;

    for (const event of playback.noteCursor.drainUntil(playback.noteAnchor, horizon)) {
      scheduleVoice({
        pitch: event.pitch,
        velocity: event.velocity,
        when: Math.max(event.when, now + 0.001),
        durationSeconds: event.durationSeconds,
        noteId: event.id,
        cycle: event.cycle,
      });
      playback.notesScheduled += 1;
    }

    if (playback.metronomeCursor) {
      for (const click of playback.metronomeCursor.drainUntil(playback.anchor, horizon)) {
        scheduleClick({
          when: Math.max(click.when, now + 0.001),
          accent: click.accent,
        });
        playback.clicksScheduled += 1;
      }
    }

    positionTick = currentTick();
    notifyPosition();

    if (!playback.loop && playback.noteCursor.isExhausted() && now >= playback.endAt) {
      clearScheduler();
      stopSources();
      playback = null;
      positionTick = 0;
      setState('ready');
      notifyPosition();
    }
  }

  function reschedulePattern(project, pattern) {
    if (!context || !playback || state !== 'playing') {
      return { changed: false, canceledNotes: 0, freezeTick: null };
    }

    const now = context.currentTime;
    const freezeTime = liveEditFreezeTime(now);
    // Sebelum playback anchor, tick 0 tetap harus menempel pada anchor asli.
    // Mengikat tick 0 ke freezeTime akan menggeser phase Pattern beberapa ms.
    const rebuildAudioTime = Math.max(freezeTime, playback.anchor);
    const freezeTick = transportTickAtAudioTime({
      anchorAudioTime: playback.anchor,
      anchorTick: playback.startTick,
      nowAudioTime: rebuildAudioTime,
      tempo: playback.tempo,
      patternLengthTicks: playback.pattern.lengthTicks,
      loop: playback.loop,
    });

    let canceledNotes = 0;
    for (const [source, scheduled] of [...activeSources]) {
      if (scheduled.kind !== 'note' || !isLiveEditMutable(scheduled.when, now)) continue;
      try {
        source.stop();
      } catch {
        // Source bisa selesai tepat saat iterasi. Map tetap dibersihkan deterministik.
      }
      activeSources.delete(source);
      canceledNotes += 1;
    }

    playback.pattern = pattern;
    playback.noteAnchor = rebuildAudioTime;
    playback.noteCursor = createPatternScheduleCursor(pattern, playback.tempo, {
      loop: playback.loop,
      startTick: freezeTick,
    });

    liveEditRevision += 1;
    liveEditCanceledNotes += canceledNotes;
    lastLiveEditCanceledNotes = canceledNotes;
    lastLiveEditFreezeTick = freezeTick;

    // Isi lagi horizon sekarang juga. Event beku tidak ikut cursor baru karena cursor
    // dimulai di freezeTick; event mutable yang dibatalkan dapat dijadwalkan ulang.
    scheduleWindow();
    return { changed: true, canceledNotes, freezeTick };
  }

  function pause() {
    if (!playback || state !== 'playing') return false;
    positionTick = currentTick();
    clearScheduler();
    stopSources();
    playback = null;
    setState('paused');
    notifyPosition();
    return true;
  }

  function seek(project, pattern, tick) {
    if (!Number.isFinite(tick) || tick < 0 || tick > pattern.lengthTicks) {
      throw new RangeError(`Seek tick di luar Pattern: ${tick}`);
    }

    const wasPlaying = state === 'playing';
    positionTick = Math.round(tick);
    if (wasPlaying) startPlayback(project, pattern, positionTick);
    else notifyPosition();
    return positionTick;
  }

  function setTempo(project, pattern) {
    lastTempo = project.song.initial.tempo;
    if (state === 'playing' && playback) {
      const tick = currentTick();
      positionTick = tick;
      startPlayback(project, pattern, tick);
    } else {
      notifyPosition();
    }
    return lastTempo;
  }

  function setLoop(project, pattern, enabled) {
    loopEnabled = Boolean(enabled);
    if (state === 'playing' && playback) {
      const tick = currentTick();
      positionTick = tick;
      startPlayback(project, pattern, tick);
    } else {
      notifyPosition();
    }
    return loopEnabled;
  }

  function setMetronome(project, pattern, enabled) {
    metronomeEnabled = Boolean(enabled);
    if (state === 'playing' && playback) {
      const tick = currentTick();
      positionTick = tick;
      startPlayback(project, pattern, tick);
    } else {
      notifyPosition();
    }
    return metronomeEnabled;
  }

  function stopSources() {
    for (const source of [...activeSources.keys()]) {
      try {
        source.stop();
      } catch {
        // Source yang sudah selesai boleh menolak stop kedua.
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

  function notifyPosition() {
    onPositionChange?.(currentTick());
  }

  function stop() {
    clearScheduler();
    stopSources();
    playback = null;
    positionTick = 0;
    if (context) setState('ready');
    notifyPosition();
  }

  function getState() {
    const sources = [...activeSources.values()];
    return {
      state,
      contextState: context?.state ?? 'none',
      sampleReady: Boolean(buffer),
      activeVoices: sources.filter((item) => item.kind === 'note' || item.kind === 'preview').length,
      scheduledNoteSources: sources.filter((item) => item.kind === 'note').length,
      activeClicks: sources.filter((item) => item.kind === 'metronome').length,
      loop: loopEnabled,
      metronome: metronomeEnabled,
      schedulerActive: schedulerTimer !== null,
      anchor: playback?.anchor ?? null,
      durationSeconds: playback?.durationSeconds ?? null,
      scheduleRevision,
      liveEditRevision,
      liveEditCanceledNotes,
      lastLiveEditCanceledNotes,
      lastLiveEditFreezeTick,
      liveEditFreezeSeconds: LIVE_EDIT_FREEZE_SECONDS,
      tempo: playback?.tempo ?? lastTempo,
      positionTick: currentTick(),
      notesScheduled: playback?.notesScheduled ?? 0,
      clicksScheduled: playback?.clicksScheduled ?? 0,
    };
  }

  return {
    preload,
    activate,
    preview,
    playPattern,
    pause,
    stop,
    seek,
    setTempo,
    setLoop,
    setMetronome,
    reschedulePattern,
    getState,
  };
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
