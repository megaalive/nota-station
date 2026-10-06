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
  if (state.kind !== 'slide') {
    throw new TypeError(`State pitch tidak dikenal: ${state.kind}`);
  }
  if (time <= state.startTime) return state.fromSemitones;
  if (time >= state.endTime) return state.toSemitones;

  const span = state.endTime - state.startTime;
  if (span <= 0) return state.toSemitones;
  const progress = (time - state.startTime) / span;
  return state.fromSemitones
    + (state.toSemitones - state.fromSemitones) * progress;
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
  assertAudioParamLike(param);
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
  if (!effect || !['pitchSlide', 'porta'].includes(effect.type)) {
    throw new TypeError('Finite pitch effect harus pitchSlide atau porta.');
  }
  if (voiceEndTime <= when) {
    return Object.freeze({
      applied: false,
      state: priorState,
      endTime: voiceEndTime,
      fromSemitones: pitchOffsetAtTime(priorState, when),
      toSemitones: pitchOffsetAtTime(priorState, when),
    });
  }

  const startTime = Math.max(when, currentTime);
  if (voiceEndTime <= startTime) {
    return Object.freeze({
      applied: false,
      state: priorState,
      endTime: voiceEndTime,
      fromSemitones: pitchOffsetAtTime(priorState, startTime),
      toSemitones: pitchOffsetAtTime(priorState, startTime),
    });
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

function assertAudioParamLike(param) {
  const required = [
    'cancelScheduledValues',
    'setValueAtTime',
    'exponentialRampToValueAtTime',
  ];
  if (!param || required.some((name) => typeof param[name] !== 'function')) {
    throw new TypeError('AudioParam pitch tidak mendukung automation finite.');
  }
}
