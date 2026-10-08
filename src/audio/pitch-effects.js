const VIBRATO_SAMPLES_PER_CYCLE = 24;

export function semitoneRatio(semitones) {
  if (!Number.isFinite(semitones)) {
    throw new TypeError('Semitone harus angka finite.');
  }
  return 2 ** (semitones / 12);
}

export function pitchOffsetAtTime(state, time) {
  if (!Number.isFinite(time)) throw new TypeError('Waktu pitch harus finite.');
  if (!state) return 0;

  if (state.kind === 'static') return state.offsetSemitones;

  if (state.kind === 'slide') {
    if (time <= state.startTime) return state.fromSemitones;
    if (time >= state.endTime) return state.toSemitones;

    const span = state.endTime - state.startTime;
    if (span <= 0) return state.toSemitones;
    const progress = (time - state.startTime) / span;
    return state.fromSemitones
      + (state.toSemitones - state.fromSemitones) * progress;
  }

  if (state.kind === 'vibrato') {
    if (time <= state.startTime) return state.baseSemitones;
    const elapsed = Math.min(time, state.endTime) - state.startTime;
    return state.baseSemitones
      + state.depthSemitones * Math.sin(elapsed * state.rateHz * Math.PI * 2);
  }

  if (state.kind === 'arpeggio') {
    if (state.semitones.length === 0) return state.baseSemitones;
    const elapsed = Math.max(0, Math.min(time, state.endTime) - state.startTime);
    const index = Math.floor(elapsed / state.stepSeconds) % state.semitones.length;
    return state.baseSemitones + state.semitones[index];
  }

  throw new TypeError(`State pitch tidak dikenal: ${state.kind}`);
}

export function scheduleFinitePitchEffect(
  param,
  effect,
  {
    when,
    currentTime,
    baseRate,
    basePitch,
    voiceEndTime,
    tickSeconds,
    priorState = null,
  },
) {
  assertAudioParamLike(param, [
    'cancelScheduledValues',
    'setValueAtTime',
    'exponentialRampToValueAtTime',
  ]);
  assertPitchContext({ when, currentTime, baseRate, basePitch, voiceEndTime, tickSeconds });
  if (!effect || !['pitchSlide', 'porta'].includes(effect.type)) {
    throw new TypeError('Finite pitch effect harus pitchSlide atau porta.');
  }
  if (voiceEndTime <= when) {
    return inactiveResult(priorState, when, voiceEndTime);
  }

  const startTime = Math.max(when, currentTime);
  if (voiceEndTime <= startTime) {
    return inactiveResult(priorState, startTime, voiceEndTime);
  }

  const fromSemitones = pitchOffsetAtTime(priorState, startTime);
  const requestedDuration = effect.value.durationTicks * tickSeconds;
  const requestedTarget = effect.type === 'pitchSlide'
    ? fromSemitones + effect.value.semitones
    : effect.value.targetPitch - basePitch;
  const requestedEndTime = startTime + requestedDuration;
  const endTime = Math.min(requestedEndTime, voiceEndTime);
  const progress = requestedDuration > 0
    ? Math.max(0, Math.min(1, (endTime - startTime) / requestedDuration))
    : 1;
  const toSemitones = fromSemitones
    + (requestedTarget - fromSemitones) * progress;

  const fromRate = baseRate * semitoneRatio(fromSemitones);
  const toRate = baseRate * semitoneRatio(toSemitones);

  param.cancelScheduledValues(startTime);
  param.setValueAtTime(fromRate, startTime);
  if (endTime > startTime) {
    param.exponentialRampToValueAtTime(
      Math.max(Number.MIN_VALUE, toRate),
      endTime,
    );
  }

  const state = Object.freeze({
    kind: 'slide',
    type: effect.type,
    startTime,
    endTime,
    fromSemitones,
    toSemitones,
  });

  return Object.freeze({
    applied: true,
    state,
    startTime,
    endTime,
    fromSemitones,
    toSemitones,
    fromRate,
    toRate,
    truncated: endTime < requestedEndTime,
  });
}

export function scheduleRepeatingPitchEffect(
  param,
  effect,
  {
    when,
    currentTime,
    baseRate,
    basePitch,
    voiceEndTime,
    tickSeconds,
    priorState = null,
  },
) {
  assertPitchContext({ when, currentTime, baseRate, basePitch, voiceEndTime, tickSeconds });
  if (!effect || !['vibrato', 'arpeggio'].includes(effect.type)) {
    throw new TypeError('Repeating pitch effect harus vibrato atau arpeggio.');
  }
  if (voiceEndTime <= when) {
    return inactiveResult(priorState, when, voiceEndTime);
  }

  const startTime = Math.max(when, currentTime);
  if (voiceEndTime <= startTime) {
    return inactiveResult(priorState, startTime, voiceEndTime);
  }

  const baseSemitones = pitchOffsetAtTime(priorState, startTime);
  param.cancelScheduledValues(startTime);

  if (effect.type === 'vibrato') {
    assertAudioParamLike(param, ['setValueAtTime', 'linearRampToValueAtTime']);
    const { depthSemitones, rateHz } = effect.value;
    const state = Object.freeze({
      kind: 'vibrato',
      type: effect.type,
      startTime,
      endTime: voiceEndTime,
      baseSemitones,
      depthSemitones,
      rateHz,
    });
    const duration = voiceEndTime - startTime;
    const sampleCount = Math.max(
      1,
      Math.ceil(duration * rateHz * VIBRATO_SAMPLES_PER_CYCLE),
    );

    param.setValueAtTime(baseRate * semitoneRatio(baseSemitones), startTime);
    for (let index = 1; index <= sampleCount; index += 1) {
      const time = startTime + duration * (index / sampleCount);
      const offset = pitchOffsetAtTime(state, time);
      param.linearRampToValueAtTime(baseRate * semitoneRatio(offset), time);
    }

    return Object.freeze({
      applied: true,
      state,
      startTime,
      endTime: voiceEndTime,
      fromSemitones: baseSemitones,
      scheduledPoints: sampleCount + 1,
    });
  }

  assertAudioParamLike(param, ['setValueAtTime']);
  const stepSeconds = effect.value.stepTicks * tickSeconds;
  const state = Object.freeze({
    kind: 'arpeggio',
    type: effect.type,
    startTime,
    endTime: voiceEndTime,
    baseSemitones,
    semitones: Object.freeze([...effect.value.semitones]),
    stepSeconds,
  });

  let scheduledSteps = 0;
  for (
    let time = startTime, step = 0;
    time < voiceEndTime;
    step += 1, time = startTime + step * stepSeconds
  ) {
    const interval = state.semitones[step % state.semitones.length];
    param.setValueAtTime(
      baseRate * semitoneRatio(baseSemitones + interval),
      time,
    );
    scheduledSteps += 1;
  }

  return Object.freeze({
    applied: true,
    state,
    startTime,
    endTime: voiceEndTime,
    fromSemitones: baseSemitones,
    scheduledSteps,
  });
}

function inactiveResult(priorState, time, voiceEndTime) {
  const offset = pitchOffsetAtTime(priorState, time);
  return Object.freeze({
    applied: false,
    state: priorState,
    endTime: voiceEndTime,
    fromSemitones: offset,
    toSemitones: offset,
  });
}

function assertPitchContext({
  when,
  currentTime,
  baseRate,
  basePitch,
  voiceEndTime,
  tickSeconds,
}) {
  for (const [name, value] of Object.entries({
    when,
    currentTime,
    baseRate,
    basePitch,
    voiceEndTime,
    tickSeconds,
  })) {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${name} harus finite.`);
    }
  }
  if (baseRate <= 0 || tickSeconds <= 0) {
    throw new RangeError('baseRate dan tickSeconds harus > 0.');
  }
}

function assertAudioParamLike(param, required) {
  if (!param || required.some((name) => typeof param[name] !== 'function')) {
    throw new TypeError('AudioParam pitch tidak mendukung automation yang dibutuhkan.');
  }
}
