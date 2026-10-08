export function scheduleTrackMixEffect(bus, effect, {
  when,
  currentTime = 0,
} = {}) {
  if (!bus?.fxGain?.gain) {
    throw new TypeError('Track mix effect membutuhkan GainNode FX.');
  }
  if (!Number.isFinite(when) || !Number.isFinite(currentTime)) {
    throw new TypeError('Waktu track mix effect harus finite.');
  }

  const scheduledWhen = Math.max(when, currentTime);

  if (effect.type === 'volume') {
    const level = effect.value?.level;
    if (!Number.isInteger(level) || level < 0 || level > 127) {
      throw new TypeError('Volume FX harus integer 0..127.');
    }
    bus.fxGain.gain.setValueAtTime(level / 127, scheduledWhen);
    return { type: 'volume', when: scheduledWhen, value: level / 127 };
  }

  if (effect.type === 'pan') {
    const position = effect.value?.position;
    if (!Number.isInteger(position) || position < -64 || position > 64) {
      throw new TypeError('Pan FX harus integer -64..64.');
    }
    if (!bus.fxPanner?.pan) {
      return { type: 'pan', when: scheduledWhen, value: position / 64, applied: false };
    }
    bus.fxPanner.pan.setValueAtTime(position / 64, scheduledWhen);
    return { type: 'pan', when: scheduledWhen, value: position / 64, applied: true };
  }

  throw new TypeError(`Track mix effect tidak didukung: ${effect.type}`);
}

export function scheduleTrackMixReset(bus, {
  when,
  currentTime = 0,
} = {}) {
  if (!bus?.fxGain?.gain) {
    throw new TypeError('Track mix reset membutuhkan GainNode FX.');
  }
  if (!Number.isFinite(when) || !Number.isFinite(currentTime)) {
    throw new TypeError('Waktu track mix reset harus finite.');
  }

  const scheduledWhen = Math.max(when, currentTime);
  // Otomasi Pattern lama bisa masih antre setelah reset ini, jadi bersihkan dulu pada boundary.
  bus.fxGain.gain.cancelScheduledValues?.(scheduledWhen);
  bus.fxPanner?.pan?.cancelScheduledValues?.(scheduledWhen);
  bus.fxGain.gain.setValueAtTime(1, scheduledWhen);
  if (bus.fxPanner?.pan) bus.fxPanner.pan.setValueAtTime(0, scheduledWhen);
  return scheduledWhen;
}
