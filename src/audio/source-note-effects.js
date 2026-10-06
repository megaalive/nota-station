export function expandRetriggerTicks({
  startTick,
  durationTicks,
  patternLengthTicks,
  intervalTicks = null,
  count = 0,
}) {
  if (![startTick, durationTicks, patternLengthTicks].every(Number.isInteger)) {
    throw new TypeError('Retrigger tick membutuhkan integer.');
  }
  if (startTick < 0 || durationTicks <= 0 || patternLengthTicks <= 0) {
    throw new RangeError('Retrigger tick di luar rentang.');
  }

  const ticks = [startTick];
  if (intervalTicks === null || count === 0) return ticks;
  if (!Number.isInteger(intervalTicks) || intervalTicks <= 0) {
    throw new RangeError('retrigger.intervalTicks harus integer > 0.');
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('retrigger.count harus integer >= 0.');
  }

  for (let index = 1; index <= count; index += 1) {
    const delta = index * intervalTicks;
    if (delta >= durationTicks) break;
    const tick = startTick + delta;
    if (tick >= patternLengthTicks) break;
    ticks.push(tick);
  }
  return ticks;
}

export function sampleOffsetSeconds(frames, sampleRate, bufferDuration) {
  if (!Number.isInteger(frames) || frames < 0) {
    throw new RangeError('Sample offset frames harus integer >= 0.');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('Sample rate harus angka > 0.');
  }
  if (!Number.isFinite(bufferDuration) || bufferDuration < 0) {
    throw new RangeError('Buffer duration harus angka >= 0.');
  }

  const seconds = frames / sampleRate;
  return seconds >= bufferDuration ? null : seconds;
}
