import { parseWav } from './wav-import.js';

export function summarizeWavWaveform(input, { bins = 128 } = {}) {
  if (!Number.isInteger(bins) || bins < 16 || bins > 512) {
    throw waveformError('E_WAVEFORM_BINS', 'Jumlah bin waveform harus 16..512.');
  }

  const bytes = toBytes(input);
  const wav = parseWav(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = Math.max(1, Math.min(bins, wav.frameCount));
  const minima = new Float32Array(count);
  const maxima = new Float32Array(count);
  minima.fill(1);
  maxima.fill(-1);

  for (let frame = 0; frame < wav.frameCount; frame += 1) {
    const bin = Math.min(count - 1, Math.floor(frame * count / wav.frameCount));
    const frameOffset = wav.dataOffset + frame * wav.blockAlign;

    for (let channel = 0; channel < wav.channels; channel += 1) {
      const offset = frameOffset + channel * (wav.bitsPerSample / 8);
      const value = readNormalizedSample(view, offset, wav);
      if (value < minima[bin]) minima[bin] = value;
      if (value > maxima[bin]) maxima[bin] = value;
    }
  }

  const peaks = Array.from({ length: count }, (_, index) => ({
    min: minima[index] === 1 && maxima[index] === -1 ? 0 : minima[index],
    max: minima[index] === 1 && maxima[index] === -1 ? 0 : maxima[index],
  }));

  return Object.freeze({
    bins: count,
    frameCount: wav.frameCount,
    durationSeconds: wav.durationSeconds,
    channels: wav.channels,
    sampleRate: wav.sampleRate,
    peaks: Object.freeze(peaks.map((item) => Object.freeze(item))),
  });
}

function readNormalizedSample(view, offset, wav) {
  let value;

  if (wav.format === 'float') {
    value = view.getFloat32(offset, true);
    return Number.isFinite(value) ? clamp(value) : 0;
  }

  switch (wav.bitsPerSample) {
    case 8:
      value = (view.getUint8(offset) - 128) / 128;
      break;
    case 16:
      value = view.getInt16(offset, true) / 32768;
      break;
    case 24: {
      const raw = view.getUint8(offset)
        | (view.getUint8(offset + 1) << 8)
        | (view.getUint8(offset + 2) << 16);
      const signed = raw & 0x800000 ? raw | 0xff000000 : raw;
      value = signed / 8388608;
      break;
    }
    case 32:
      value = view.getInt32(offset, true) / 2147483648;
      break;
    default:
      throw waveformError('E_WAVEFORM_BITS', 'Bit depth waveform tidak didukung.');
  }

  return clamp(value);
}

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw waveformError('E_WAVEFORM_TYPE', 'Input waveform harus ArrayBuffer atau typed array.');
}

function waveformError(code, message) {
  const error = new Error(message);
  error.name = 'WaveformError';
  error.code = code;
  return error;
}
