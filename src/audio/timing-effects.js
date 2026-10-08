export function scheduleSourceCut(source, {
  when,
  currentTime = 0,
} = {}) {
  if (!source || typeof source.stop !== 'function') {
    throw new TypeError('Source cut membutuhkan AudioScheduledSourceNode.');
  }
  if (!Number.isFinite(when) || !Number.isFinite(currentTime)) {
    throw new TypeError('Waktu source cut harus finite.');
  }

  const scheduledWhen = Math.max(when, currentTime);
  source.stop(scheduledWhen);
  return scheduledWhen;
}
