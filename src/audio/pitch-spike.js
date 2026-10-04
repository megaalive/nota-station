// Spike teknis R1 §7.4.
// Tujuan: membuktikan pitch slide, portamento, dan vibrato bisa dijadwalkan
// lewat AudioParam playbackRate tanpa mengunci model efek R3 terlalu dini.

export function semitoneRatio(semitones) {
  if (!Number.isFinite(semitones)) throw new TypeError('Semitone harus finite.');
  return 2 ** (semitones / 12);
}

export function schedulePitchSlide(
  param,
  { startTime, duration, fromSemitones = 0, toSemitones },
) {
  assertAudioParamLike(param);
  assertTime(startTime, duration);
  if (!Number.isFinite(fromSemitones) || !Number.isFinite(toSemitones)) {
    throw new TypeError('Pitch slide membutuhkan semitone finite.');
  }

  const from = semitoneRatio(fromSemitones);
  const to = semitoneRatio(toSemitones);
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(from, startTime);
  // playbackRate selalu positif, jadi exponential ramp aman dan lebih dekat
  // dengan persepsi pitch dibanding ramp linear pada rasio.
  param.exponentialRampToValueAtTime(to, startTime + duration);
  return { from, to, endTime: startTime + duration };
}

export function schedulePortamento(
  param,
  { startTime, duration, fromPitch, toPitch },
) {
  if (!Number.isFinite(fromPitch) || !Number.isFinite(toPitch)) {
    throw new TypeError('Portamento membutuhkan pitch finite.');
  }
  return schedulePitchSlide(param, {
    startTime,
    duration,
    fromSemitones: 0,
    toSemitones: toPitch - fromPitch,
  });
}

export function scheduleVibrato(
  param,
  {
    startTime,
    duration,
    baseSemitones = 0,
    depthSemitones = 0.5,
    frequencyHz = 5,
    samplesPerCycle = 32,
  },
) {
  assertAudioParamLike(param);
  assertTime(startTime, duration);
  if (!Number.isFinite(baseSemitones) || !Number.isFinite(depthSemitones) || depthSemitones < 0) {
    throw new TypeError('Vibrato membutuhkan base/depth semitone valid.');
  }
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new TypeError('Frekuensi vibrato harus > 0.');
  }
  if (!Number.isInteger(samplesPerCycle) || samplesPerCycle < 8 || samplesPerCycle > 256) {
    throw new RangeError('samplesPerCycle vibrato harus integer 8..256.');
  }

  const samples = Math.max(2, Math.ceil(duration * frequencyHz * samplesPerCycle) + 1);
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = i / (samples - 1);
    const semitones = baseSemitones + depthSemitones * Math.sin(t * duration * frequencyHz * Math.PI * 2);
    curve[i] = semitoneRatio(semitones);
  }

  param.cancelScheduledValues(startTime);
  param.setValueCurveAtTime(curve, startTime, duration);
  return { curve, endTime: startTime + duration };
}

function assertAudioParamLike(param) {
  const required = [
    'cancelScheduledValues',
    'setValueAtTime',
    'exponentialRampToValueAtTime',
    'setValueCurveAtTime',
  ];
  if (!param || required.some((name) => typeof param[name] !== 'function')) {
    throw new TypeError('AudioParam playbackRate tidak mendukung automation yang dibutuhkan.');
  }
}

function assertTime(startTime, duration) {
  if (!Number.isFinite(startTime) || startTime < 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new RangeError('Automation membutuhkan startTime >= 0 dan duration > 0.');
  }
}
