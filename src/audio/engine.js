// Transport R1-S5. AudioContext.currentTime adalah jam musik; timer hanya
// membangunkan look-ahead scheduler (§7.2).

import {
  FACTORY_BASIC_ROOT_PITCH,
  FACTORY_BASIC_WAV_BASE64,
} from './factory-sample.js';
import { isDemoInstrument, scheduleDemoVoice } from './demo-voices.js';
import {
  createProjectSampleBytesLoader,
  createSampleBufferCache,
} from './sample-buffer-cache.js';
import {
  resolveSamplerVoice,
  voiceProfileKey,
} from './instrument-resolver.js';
import { createFactoryBasicSample } from '../core/sound-model.js';
import {
  LIVE_EDIT_FREEZE_SECONDS,
  SCHEDULE_AHEAD_SECONDS,
  SCHEDULER_WAKE_MS,
  createCutScheduleCursor,
  createEffectScheduleCursor,
  createMetronomeScheduleCursor,
  createMixEffectScheduleCursor,
  createPatternScheduleCursor,
  isLiveEditMutable,
  liveEditFreezeTime,
  mixEffectStateBeforeTick,
  secondsPerTick,
  transportTickAtAudioTime,
} from './scheduler.js';
import {
  scheduleFinitePitchEffect,
  scheduleRepeatingPitchEffect,
} from './pitch-effects.js';
import { sampleOffsetSeconds } from './source-note-effects.js';
import { scheduleSourceCut } from './timing-effects.js';
import {
  scheduleTrackMixEffect,
  scheduleTrackMixReset,
} from './track-mix-effects.js';

const ROOT_PITCH = FACTORY_BASIC_ROOT_PITCH;
const PREVIEW_SECONDS = 0.18;

export function createAudioEngine({
  onStateChange = null,
  onPositionChange = null,
  getSampleStore = null,
} = {}) {
  let context = null;
  let sampleBytesPromise = null;
  let buffer = null;
  let sampleStore = null;
  let indexedDbLoader = null;
  let sampleCache = null;
  let lastPreparedVoiceProfiles = 0;
  let chokeStops = 0;
  let lastChokeGroup = null;
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
  const trackMix = new Map();
  const trackBuses = new Map();

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
    ensureSampleCache();
    if (state === 'locked') setState('ready');
    return context;
  }

  function ensureSampleCache() {
    if (sampleCache) return sampleCache;

    const factoryLoader = createProjectSampleBytesLoader();
    sampleCache = createSampleBufferCache({
      loadBytes: async (sample) => {
        if (sample.storageRef?.kind !== 'indexeddb') return factoryLoader(sample);
        if (!sampleStore) {
          if (typeof getSampleStore !== 'function') {
            throw audioError(
              'E_AUDIO_SAMPLE_STORE',
              'Sample kustom membutuhkan provider IndexedDB.',
            );
          }
          sampleStore = await getSampleStore();
          indexedDbLoader = createProjectSampleBytesLoader({ sampleStore });
        }
        return indexedDbLoader(sample);
      },
      decodeBytes: (bytes) => context.decodeAudioData(bytes.slice(0)),
    });

    if (buffer) sampleCache.prime(createFactoryBasicSample(), buffer);
    return sampleCache;
  }

  async function prepareVoiceProfiles(project, pattern) {
    const cache = ensureSampleCache();
    const tracks = new Map(project.song.tracks.map((track) => [track.id, track]));
    const requests = new Map();

    for (const note of pattern.notes) {
      const instrumentId = note.instrumentId
        ?? tracks.get(note.trackId)?.defaultInstrumentId
        ?? null;
      if (!instrumentId || isDemoInstrument(instrumentId)) continue;

      const key = voiceProfileKey(instrumentId, note.pitch);
      if (requests.has(key)) continue;
      requests.set(key, resolveSamplerVoice(project, { instrumentId, pitch: note.pitch }));
    }

    const profiles = new Map();
    await Promise.all([...requests.entries()].map(async ([key, resolved]) => {
      const decodedBuffer = await cache.get(resolved.sample);
      profiles.set(key, Object.freeze({ ...resolved, buffer: decodedBuffer }));
    }));
    lastPreparedVoiceProfiles = profiles.size;
    return profiles;
  }

  function extendVoiceProfilesFromLoaded(project, pattern, profiles) {
    if (!sampleCache) return false;
    const tracks = new Map(project.song.tracks.map((track) => [track.id, track]));

    for (const note of pattern.notes) {
      const instrumentId = note.instrumentId
        ?? tracks.get(note.trackId)?.defaultInstrumentId
        ?? null;
      if (!instrumentId || isDemoInstrument(instrumentId)) continue;

      const key = voiceProfileKey(instrumentId, note.pitch);
      if (profiles.has(key)) continue;
      const resolved = resolveSamplerVoice(project, { instrumentId, pitch: note.pitch });
      const decodedBuffer = sampleCache.peek(resolved.sample);
      if (!decodedBuffer) return false;
      profiles.set(key, Object.freeze({ ...resolved, buffer: decodedBuffer }));
    }
    lastPreparedVoiceProfiles = profiles.size;
    return true;
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

  function scheduleTrackCut(trackId, when) {
    let stopped = 0;
    for (const [source, scheduled] of activeSources) {
      if (scheduled.kind !== 'note' || scheduled.trackId !== trackId) continue;
      if (scheduled.when > when) continue;
      if (Number.isFinite(scheduled.cutAt) && scheduled.cutAt <= when) continue;

      try {
        const cutAt = scheduleSourceCut(source, {
          when,
          currentTime: context.currentTime,
        });
        scheduled.cutAt = cutAt;
        stopped += 1;
      } catch {
        // Source dapat selesai tepat sebelum note-cut dijadwalkan.
      }
    }
    return stopped;
  }

  function scheduleRetriggerCut({
    sourceNoteId,
    trackId,
    voiceLane,
    cycle,
    when,
  }) {
    let stopped = 0;
    for (const [source, scheduled] of activeSources) {
      if (scheduled.kind !== 'note') continue;
      if (scheduled.sourceNoteId !== sourceNoteId) continue;
      if (scheduled.trackId !== trackId) continue;
      if ((scheduled.voiceLane ?? 0) !== voiceLane) continue;
      if (scheduled.cycle !== cycle) continue;
      if (scheduled.when >= when) continue;
      if (Number.isFinite(scheduled.cutAt) && scheduled.cutAt <= when) continue;

      try {
        const cutAt = scheduleSourceCut(source, {
          when,
          currentTime: context.currentTime,
        });
        scheduled.cutAt = cutAt;
        stopped += 1;
      } catch {
        // Source dapat selesai tepat sebelum retrigger berikutnya.
      }
    }
    return stopped;
  }

  function scheduleTrackPitchEffect(effect, when) {
    if (!playback || !context) return { applied: 0, unsupported: 0 };

    let applied = 0;
    let unsupported = 0;
    const tickSeconds = secondsPerTick(playback.tempo);

    for (const [, scheduled] of activeSources) {
      if (scheduled.kind !== 'note') continue;
      if (scheduled.trackId !== effect.trackId) continue;
      if (scheduled.cycle !== effect.cycle) continue;
      if (scheduled.when > when) continue;
      const voiceEndTime = Number.isFinite(scheduled.cutAt)
        ? Math.min(scheduled.noteEndAt, scheduled.cutAt)
        : scheduled.noteEndAt;
      if (!Number.isFinite(voiceEndTime) || voiceEndTime <= when) continue;

      if (
        !scheduled.pitchParam
        || !Number.isFinite(scheduled.pitchBaseRate)
        || !Number.isFinite(scheduled.pitch)
      ) {
        unsupported += 1;
        continue;
      }

      const schedulePitch = ['pitchSlide', 'porta'].includes(effect.type)
        ? scheduleFinitePitchEffect
        : scheduleRepeatingPitchEffect;
      const result = schedulePitch(
        scheduled.pitchParam,
        effect,
        {
          when,
          currentTime: context.currentTime,
          baseRate: scheduled.pitchBaseRate,
          basePitch: scheduled.pitch,
          voiceEndTime,
          tickSeconds,
          priorState: scheduled.pitchAutomation ?? null,
        },
      );
      if (!result.applied) continue;

      scheduled.pitchAutomation = result.state;
      applied += 1;
    }

    return { applied, unsupported };
  }

  function chokeActiveGroup(chokeGroup, when) {
    if (!chokeGroup) return 0;

    let stopped = 0;
    for (const [source, scheduled] of [...activeSources]) {
      if (scheduled.chokeGroup !== chokeGroup) continue;
      if (!['note', 'preview'].includes(scheduled.kind)) continue;
      if (scheduled.when > when) continue;

      try {
        source.stop(Math.max(when, context.currentTime));
      } catch {
        // Source dapat selesai tepat sebelum choke dijadwalkan.
      }
      activeSources.delete(source);
      stopped += 1;
    }

    if (stopped > 0) {
      chokeStops += stopped;
      lastChokeGroup = chokeGroup;
    }
    return stopped;
  }

  function ensureTrackMix(trackId) {
    if (!trackId) return { mute: false, solo: false, volume: 1 };
    if (!trackMix.has(trackId)) trackMix.set(trackId, { mute: false, solo: false, volume: 1 });
    return trackMix.get(trackId);
  }

  function ensureTrackBus(trackId) {
    if (!trackId || !context) return null;
    ensureTrackMix(trackId);
    let bus = trackBuses.get(trackId);
    if (bus) return bus;

    const input = context.createGain();
    const fxGain = context.createGain();
    const fxPanner = typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null;
    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.55;

    input.connect(fxGain);
    if (fxPanner) {
      fxGain.connect(fxPanner);
      fxPanner.connect(analyser);
    } else {
      fxGain.connect(analyser);
    }
    analyser.connect(context.destination);

    bus = {
      input,
      fxGain,
      fxPanner,
      analyser,
      samples: new Float32Array(analyser.fftSize),
    };
    trackBuses.set(trackId, bus);
    syncTrackGains();
    return bus;
  }

  function setTracks(tracks) {
    const ids = new Set((tracks ?? []).map((track) => track.id));

    for (const trackId of [...trackMix.keys()]) {
      if (!ids.has(trackId)) trackMix.delete(trackId);
    }
    for (const [trackId, bus] of [...trackBuses]) {
      if (ids.has(trackId)) continue;
      try {
        bus.input.disconnect();
        bus.fxGain.disconnect();
        bus.fxPanner?.disconnect();
        bus.analyser.disconnect();
      } catch {
        // Node yang sudah putus aman diabaikan saat ganti project.
      }
      trackBuses.delete(trackId);
    }
    for (const trackId of ids) ensureTrackMix(trackId);
    syncTrackGains();
  }

  function trackAudible(trackId) {
    const mix = ensureTrackMix(trackId);
    const anySolo = [...trackMix.values()].some((item) => item.solo);
    return !mix.mute && (!anySolo || mix.solo);
  }

  function syncTrackGains() {
    if (!context) return;
    const now = context.currentTime;
    for (const [trackId, bus] of trackBuses) {
      const target = trackAudible(trackId) ? ensureTrackMix(trackId).volume : 0;
      const gain = bus.input.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(target, now, 0.005);
    }
  }

  function toggleTrackMute(trackId) {
    const mix = ensureTrackMix(trackId);
    mix.mute = !mix.mute;
    syncTrackGains();
    return { trackId, mute: mix.mute, solo: mix.solo, volume: mix.volume, audible: trackAudible(trackId) };
  }

  function toggleTrackSolo(trackId) {
    const mix = ensureTrackMix(trackId);
    mix.solo = !mix.solo;
    syncTrackGains();
    return { trackId, mute: mix.mute, solo: mix.solo, volume: mix.volume, audible: trackAudible(trackId) };
  }

  function setTrackVolume(trackId, volume) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw audioError('E_AUDIO_TRACK_VOLUME', `Volume track harus 0..1: ${volume}`);
    }
    const mix = ensureTrackMix(trackId);
    if (mix.volume === volume) {
      return { trackId, mute: mix.mute, solo: mix.solo, volume: mix.volume, audible: trackAudible(trackId) };
    }
    mix.volume = volume;
    syncTrackGains();
    return { trackId, mute: mix.mute, solo: mix.solo, volume: mix.volume, audible: trackAudible(trackId) };
  }

  function readTrackLevel(trackId) {
    const bus = trackBuses.get(trackId);
    if (!bus || !context || context.state !== 'running') return 0;
    bus.analyser.getFloatTimeDomainData(bus.samples);
    let sum = 0;
    for (const sample of bus.samples) sum += sample * sample;
    const rms = Math.sqrt(sum / bus.samples.length);
    return Math.max(0, Math.min(1, rms * 3.5));
  }

  function mixEffectTrackIds(pattern) {
    return [...new Set(
      (pattern.effects ?? [])
        .filter((effect) => effect.type === 'volume' || effect.type === 'pan')
        .map((effect) => effect.trackId),
    )];
  }

  function resetTrackMixEffects(trackIds, when) {
    if (!context) return 0;
    let count = 0;
    for (const trackId of trackIds) {
      const bus = ensureTrackBus(trackId);
      if (!bus) continue;
      scheduleTrackMixReset(bus, {
        when,
        currentTime: context.currentTime,
      });
      count += 1;
    }
    return count;
  }

  function applyTrackMixStateBeforeTick(pattern, tickLocal, when) {
    if (!context) return 0;
    let count = 0;
    for (const state of mixEffectStateBeforeTick(pattern, tickLocal)) {
      const bus = ensureTrackBus(state.trackId);
      if (!bus) continue;
      scheduleTrackMixEffect(bus, {
        type: 'volume',
        value: { level: state.volume },
      }, {
        when,
        currentTime: context.currentTime,
      });
      scheduleTrackMixEffect(bus, {
        type: 'pan',
        value: { position: state.pan },
      }, {
        when,
        currentTime: context.currentTime,
      });
      count += 1;
    }
    return count;
  }

  function trackMeterState() {
    return [...trackMix.keys()].map((trackId) => {
      const mix = ensureTrackMix(trackId);
      return {
        trackId,
        mute: mix.mute,
        solo: mix.solo,
        volume: mix.volume,
        audible: trackAudible(trackId),
        level: readTrackLevel(trackId),
      };
    });
  }

  function scheduleVoice({
    pitch,
    velocity = 100,
    when,
    durationSeconds,
    kind = 'note',
    noteId = null,
    cycle = null,
    instrumentId = null,
    trackId = null,
    voiceProfile = null,
    voiceLane = 0,
    sourceNoteId = noteId,
    retriggerIndex = 0,
    sampleOffsetFrames = 0,
  }) {
    const trackBus = trackId ? ensureTrackBus(trackId) : null;
    const output = trackBus?.input ?? context.destination;

    if (isDemoInstrument(instrumentId)) {
      const source = scheduleDemoVoice(context, {
        instrumentId,
        pitch,
        velocity,
        when,
        durationSeconds,
        output,
      });
      trackSource(source, when, kind, {
        noteId,
        cycle,
        instrumentId,
        trackId,
        velocity,
        voiceLane,
        pitch,
        sourceNoteId,
        retriggerIndex,
        sampleOffsetFrames,
        noteEndAt: when + Math.max(0.01, durationSeconds),
        pitchParam: null,
        pitchBaseRate: null,
        pitchAutomation: null,
      });
      return true;
    }

    if (voiceProfile) {
      return scheduleSamplerVoice({
        voiceProfile,
        velocity,
        when,
        durationSeconds,
        output,
        kind,
        noteId,
        cycle,
        instrumentId,
        trackId,
        voiceLane,
        pitch,
        sourceNoteId,
        retriggerIndex,
        sampleOffsetFrames,
      });
    }

    // Preview R1 tanpa instrument eksplisit tetap memakai factory sample.
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    const pitchBaseRate = 2 ** ((pitch - ROOT_PITCH) / 12);
    source.playbackRate.setValueAtTime(pitchBaseRate, when);

    const level = Math.max(0.0001, Math.min(1, velocity / 127) * 0.75);
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.03, durationSeconds));

    source.connect(gain);
    gain.connect(output);
    trackSource(source, when, kind, {
      noteId,
      cycle,
      instrumentId,
      trackId,
      velocity,
      voiceLane,
      pitch,
      sourceNoteId,
      retriggerIndex,
      sampleOffsetFrames,
      noteEndAt: when + Math.max(0.01, durationSeconds),
      pitchParam: source.playbackRate,
      pitchBaseRate,
      pitchAutomation: null,
    });
    const offsetSeconds = sampleOffsetSeconds(
      sampleOffsetFrames,
      buffer.sampleRate,
      buffer.duration,
    );
    if (offsetSeconds === null) {
      activeSources.delete(source);
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // Node yang belum mulai aman dilepas.
      }
      return false;
    }
    source.start(when, offsetSeconds);
    source.stop(when + Math.max(0.04, durationSeconds));
    return true;
  }

  function scheduleSamplerVoice({
    voiceProfile,
    velocity,
    when,
    durationSeconds,
    output,
    kind,
    noteId,
    cycle,
    instrumentId,
    trackId,
    voiceLane,
    pitch,
    sourceNoteId,
    retriggerIndex,
    sampleOffsetFrames,
  }) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    chokeActiveGroup(voiceProfile.chokeGroup, when);
    source.buffer = voiceProfile.buffer;
    source.playbackRate.setValueAtTime(voiceProfile.playbackRate, when);

    if (voiceProfile.loop.enabled) {
      source.loop = true;
      source.loopStart = voiceProfile.loop.startSeconds;
      source.loopEnd = voiceProfile.loop.endSeconds;
    }

    const peak = Math.max(
      0.0001,
      Math.min(1, velocity / 127) * Math.max(0, voiceProfile.gain) * 0.75,
    );
    const envelope = voiceProfile.envelope;
    const noteOff = when + Math.max(0.01, durationSeconds);
    const attackEnd = Math.min(noteOff, when + Math.max(0, envelope.attackSeconds));
    const decayEnd = Math.min(noteOff, attackEnd + Math.max(0, envelope.decaySeconds));
    const sustain = Math.max(0.0001, peak * Math.max(0, Math.min(1, envelope.sustainLevel)));
    const releaseEnd = noteOff + Math.max(0.005, envelope.releaseSeconds);

    gain.gain.setValueAtTime(envelope.attackSeconds > 0 ? 0.0001 : peak, when);
    if (attackEnd > when) gain.gain.linearRampToValueAtTime(peak, attackEnd);
    if (decayEnd > attackEnd) gain.gain.linearRampToValueAtTime(sustain, decayEnd);
    if (noteOff > decayEnd) gain.gain.setValueAtTime(sustain, noteOff);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

    source.connect(gain);
    if (typeof context.createStereoPanner === 'function') {
      const panner = context.createStereoPanner();
      panner.pan.setValueAtTime(
        Math.max(-1, Math.min(1, voiceProfile.pan)),
        when,
      );
      gain.connect(panner);
      panner.connect(output);
    } else {
      gain.connect(output);
    }

    trackSource(source, when, kind, {
      noteId,
      cycle,
      instrumentId,
      trackId,
      velocity,
      sampleId: voiceProfile.sampleId,
      voiceLane,
      pitch,
      chokeGroup: voiceProfile.chokeGroup,
      sourceNoteId,
      retriggerIndex,
      sampleOffsetFrames,
      noteEndAt: noteOff,
      pitchParam: source.playbackRate,
      pitchBaseRate: voiceProfile.playbackRate,
      pitchAutomation: null,
    });
    const offsetSeconds = sampleOffsetSeconds(
      sampleOffsetFrames,
      voiceProfile.buffer.sampleRate,
      voiceProfile.buffer.duration,
    );
    if (offsetSeconds === null) {
      activeSources.delete(source);
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // Node yang belum mulai aman dilepas.
      }
      return false;
    }
    source.start(when, offsetSeconds);
    source.stop(releaseEnd + 0.01);
    return true;
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

  async function previewInstrument(project, instrumentId, pitch = 60, velocity = 100) {
    await ensureReady();
    let voiceProfile = null;

    if (!isDemoInstrument(instrumentId)) {
      const resolved = resolveSamplerVoice(project, { instrumentId, pitch });
      const decodedBuffer = await ensureSampleCache().get(resolved.sample);
      voiceProfile = Object.freeze({ ...resolved, buffer: decodedBuffer });
    }

    const when = context.currentTime + 0.005;
    scheduleVoice({
      pitch,
      velocity,
      when,
      durationSeconds: PREVIEW_SECONDS,
      kind: 'preview',
      instrumentId,
      voiceProfile,
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

  function startPlayback(project, pattern, startTick, voiceProfiles = null) {
    const preparedProfiles = voiceProfiles ?? playback?.voiceProfiles ?? new Map();
    clearScheduler();
    stopSources();
    setTracks(project.song.tracks);
    for (const track of project.song.tracks) ensureTrackBus(track.id);

    const tempo = project.song.initial.tempo;
    lastTempo = tempo;
    const normalizedTick = loopEnabled && startTick === pattern.lengthTicks ? 0 : startTick;
    const anchor = context.currentTime + 0.05;

    const affectedMixTracks = new Set([
      ...mixEffectTrackIds(playback?.pattern ?? pattern),
      ...mixEffectTrackIds(pattern),
    ]);
    resetTrackMixEffects(affectedMixTracks, context.currentTime);
    applyTrackMixStateBeforeTick(pattern, normalizedTick, anchor);

    playback = {
      project,
      pattern,
      tempo,
      voiceProfiles: preparedProfiles,
      anchor,
      startTick: normalizedTick,
      loop: loopEnabled,
      noteAnchor: anchor,
      noteCursor: createPatternScheduleCursor(pattern, tempo, {
        loop: loopEnabled,
        startTick: normalizedTick,
      }),
      cutAnchor: anchor,
      cutCursor: createCutScheduleCursor(pattern, tempo, {
        loop: loopEnabled,
        startTick: normalizedTick,
      }),
      mixAnchor: anchor,
      mixCursor: createMixEffectScheduleCursor(pattern, tempo, {
        loop: loopEnabled,
        startTick: normalizedTick,
      }),
      pitchAnchor: anchor,
      pitchCursor: createEffectScheduleCursor(pattern, tempo, {
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
      delayedNotesScheduled: 0,
      cutEffectsScheduled: 0,
      cutStopsScheduled: 0,
      mixEffectsScheduled: 0,
      volumeEffectsScheduled: 0,
      panEffectsScheduled: 0,
      mixResetsScheduled: 0,
      retriggerNotesScheduled: 0,
      retriggerStopsScheduled: 0,
      sampleOffsetNotesScheduled: 0,
      sampleOffsetSilenced: 0,
      pitchEffectsScheduled: 0,
      pitchSlideEffectsScheduled: 0,
      portaEffectsScheduled: 0,
      vibratoEffectsScheduled: 0,
      arpeggioEffectsScheduled: 0,
      pitchVoicesAutomated: 0,
      pitchUnsupportedVoices: 0,
      clicksScheduled: 0,
      instrumentIdsScheduled: new Set(),
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

    const voiceProfiles = await prepareVoiceProfiles(project, pattern);
    loopEnabled = Boolean(loop);
    metronomeEnabled = Boolean(metronome);
    let nextTick = startTick ?? positionTick;
    if (nextTick >= pattern.lengthTicks && !loopEnabled) nextTick = 0;
    startPlayback(project, pattern, nextTick, voiceProfiles);
    return getState();
  }

  function scheduleWindow() {
    if (!context || !playback || state !== 'playing') return;

    const now = context.currentTime;
    const horizon = now + SCHEDULE_AHEAD_SECONDS;

    const trackDefaults = new Map(
      playback.project.song.tracks.map((track) => [track.id, track.defaultInstrumentId]),
    );

    for (const event of playback.noteCursor.drainUntil(playback.noteAnchor, horizon)) {
      const instrumentId = event.instrumentId ?? trackDefaults.get(event.trackId) ?? null;
      const voiceProfile = instrumentId && !isDemoInstrument(instrumentId)
        ? playback.voiceProfiles.get(voiceProfileKey(instrumentId, event.pitch)) ?? null
        : null;

      if (instrumentId && !isDemoInstrument(instrumentId) && !voiceProfile) {
        throw audioError(
          'E_AUDIO_PROFILE_MISSING',
          `Voice profile belum siap: ${instrumentId} pitch ${event.pitch}`,
        );
      }

      const when = Math.max(event.when, now + 0.001);
      if (event.retriggerIndex > 0) {
        playback.retriggerStopsScheduled += scheduleRetriggerCut({
          sourceNoteId: event.sourceNoteId,
          trackId: event.trackId,
          voiceLane: event.voiceLane,
          cycle: event.cycle,
          when,
        });
      }

      const scheduled = scheduleVoice({
        pitch: event.pitch,
        velocity: event.velocity,
        when,
        durationSeconds: event.durationSeconds,
        noteId: event.id,
        sourceNoteId: event.sourceNoteId,
        retriggerIndex: event.retriggerIndex,
        sampleOffsetFrames: event.sampleOffsetFrames,
        cycle: event.cycle,
        instrumentId,
        trackId: event.trackId,
        voiceProfile,
        voiceLane: event.voiceLane,
      });
      if (scheduled === false) {
        playback.sampleOffsetSilenced += 1;
        continue;
      }
      if (instrumentId) playback.instrumentIdsScheduled.add(instrumentId);
      playback.notesScheduled += 1;
      if (event.delayTicks > 0) playback.delayedNotesScheduled += 1;
      if (event.retriggerIndex > 0) playback.retriggerNotesScheduled += 1;
      if (event.sampleOffsetFrames > 0) playback.sampleOffsetNotesScheduled += 1;
    }

    const cutHorizon = now + LIVE_EDIT_FREEZE_SECONDS;
    for (const cut of playback.cutCursor.drainUntil(playback.cutAnchor, cutHorizon)) {
      const when = Math.max(cut.when, now + 0.001);
      playback.cutEffectsScheduled += 1;
      playback.cutStopsScheduled += scheduleTrackCut(cut.trackId, when);
    }

    const mixHorizon = now + Math.max(0, LIVE_EDIT_FREEZE_SECONDS - 0.000001);
    for (const mixEvent of playback.mixCursor.drainUntil(playback.mixAnchor, mixHorizon)) {
      const when = Math.max(mixEvent.when, now + 0.001);
      if (mixEvent.kind === 'mix-reset') {
        playback.mixResetsScheduled += resetTrackMixEffects(mixEvent.trackIds, when);
        continue;
      }

      const bus = ensureTrackBus(mixEvent.trackId);
      if (!bus) continue;
      scheduleTrackMixEffect(bus, mixEvent, {
        when,
        currentTime: now,
      });
      playback.mixEffectsScheduled += 1;
      if (mixEvent.type === 'volume') playback.volumeEffectsScheduled += 1;
      if (mixEvent.type === 'pan') playback.panEffectsScheduled += 1;
    }

    const pitchHorizon = now + Math.max(0, LIVE_EDIT_FREEZE_SECONDS - 0.000001);
    for (const pitchEvent of playback.pitchCursor.drainUntil(playback.pitchAnchor, pitchHorizon)) {
      if (!['pitchSlide', 'porta', 'vibrato', 'arpeggio'].includes(pitchEvent.type)) continue;

      const when = Math.max(pitchEvent.when, now + 0.001);
      const result = scheduleTrackPitchEffect(pitchEvent, when);
      playback.pitchEffectsScheduled += 1;
      playback.pitchVoicesAutomated += result.applied;
      playback.pitchUnsupportedVoices += result.unsupported;
      if (pitchEvent.type === 'pitchSlide') playback.pitchSlideEffectsScheduled += 1;
      if (pitchEvent.type === 'porta') playback.portaEffectsScheduled += 1;
      if (pitchEvent.type === 'vibrato') playback.vibratoEffectsScheduled += 1;
      if (pitchEvent.type === 'arpeggio') playback.arpeggioEffectsScheduled += 1;
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
      const affectedMixTracks = mixEffectTrackIds(playback.pattern);
      clearScheduler();
      stopSources();
      resetTrackMixEffects(affectedMixTracks, context.currentTime);
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

    if (!extendVoiceProfilesFromLoaded(project, pattern, playback.voiceProfiles)) {
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

    const affectedMixTracks = new Set([
      ...mixEffectTrackIds(playback.pattern),
      ...mixEffectTrackIds(pattern),
    ]);
    resetTrackMixEffects(affectedMixTracks, rebuildAudioTime);
    applyTrackMixStateBeforeTick(pattern, freezeTick, rebuildAudioTime);

    playback.pattern = pattern;
    playback.noteAnchor = rebuildAudioTime;
    playback.noteCursor = createPatternScheduleCursor(pattern, playback.tempo, {
      loop: playback.loop,
      startTick: freezeTick,
    });
    playback.cutAnchor = rebuildAudioTime;
    playback.cutCursor = createCutScheduleCursor(pattern, playback.tempo, {
      loop: playback.loop,
      startTick: freezeTick,
    });
    playback.mixAnchor = rebuildAudioTime;
    playback.mixCursor = createMixEffectScheduleCursor(pattern, playback.tempo, {
      loop: playback.loop,
      startTick: freezeTick,
    });
    playback.pitchAnchor = rebuildAudioTime;
    playback.pitchCursor = createEffectScheduleCursor(pattern, playback.tempo, {
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
    const affectedMixTracks = playback ? mixEffectTrackIds(playback.pattern) : [];
    clearScheduler();
    stopSources();
    if (context) resetTrackMixEffects(affectedMixTracks, context.currentTime);
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
      delayedNotesScheduled: playback?.delayedNotesScheduled ?? 0,
      cutEffectsScheduled: playback?.cutEffectsScheduled ?? 0,
      cutStopsScheduled: playback?.cutStopsScheduled ?? 0,
      mixEffectsScheduled: playback?.mixEffectsScheduled ?? 0,
      volumeEffectsScheduled: playback?.volumeEffectsScheduled ?? 0,
      panEffectsScheduled: playback?.panEffectsScheduled ?? 0,
      mixResetsScheduled: playback?.mixResetsScheduled ?? 0,
      retriggerNotesScheduled: playback?.retriggerNotesScheduled ?? 0,
      retriggerStopsScheduled: playback?.retriggerStopsScheduled ?? 0,
      sampleOffsetNotesScheduled: playback?.sampleOffsetNotesScheduled ?? 0,
      sampleOffsetSilenced: playback?.sampleOffsetSilenced ?? 0,
      pitchEffectsScheduled: playback?.pitchEffectsScheduled ?? 0,
      pitchSlideEffectsScheduled: playback?.pitchSlideEffectsScheduled ?? 0,
      portaEffectsScheduled: playback?.portaEffectsScheduled ?? 0,
      vibratoEffectsScheduled: playback?.vibratoEffectsScheduled ?? 0,
      arpeggioEffectsScheduled: playback?.arpeggioEffectsScheduled ?? 0,
      pitchVoicesAutomated: playback?.pitchVoicesAutomated ?? 0,
      pitchUnsupportedVoices: playback?.pitchUnsupportedVoices ?? 0,
      clicksScheduled: playback?.clicksScheduled ?? 0,
      scheduledInstrumentIds: playback
        ? [...playback.instrumentIdsScheduled].sort()
        : [],
      trackMeters: trackMeterState(),
      sampleCacheDecoded: sampleCache?.getState().decoded ?? 0,
      sampleDecodeCount: sampleCache?.getState().decodeCount ?? 0,
      sampleLoadCount: sampleCache?.getState().loadCount ?? 0,
      preparedVoiceProfiles: playback?.voiceProfiles.size ?? lastPreparedVoiceProfiles,
      chokeStops,
      lastChokeGroup,
      activeVoiceLanes: sources
        .filter((item) => item.kind === 'note')
        .map((item) => ({
          trackId: item.trackId ?? null,
          voiceLane: Number.isInteger(item.voiceLane) ? item.voiceLane : 0,
          pitch: item.pitch ?? null,
          chokeGroup: item.chokeGroup ?? null,
        })),
    };
  }

  return {
    preload,
    activate,
    preview,
    previewInstrument,
    playPattern,
    pause,
    stop,
    seek,
    setTempo,
    setLoop,
    setMetronome,
    setTracks,
    toggleTrackMute,
    toggleTrackSolo,
    setTrackVolume,
    reschedulePattern,
    getState,
  };
}

function audioError(code, message) {
  const error = new Error(message);
  error.name = 'AudioEngineError';
  error.code = code;
  return error;
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
