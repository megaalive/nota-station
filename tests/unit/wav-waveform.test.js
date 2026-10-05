import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeWavWaveform } from '../../src/io/wav-waveform.js';

function makeWav({ bits = 16, format = 1, values = [-1, -0.5, 0, 0.5, 0.999] } = {}) {
  const bytesPerSample = bits / 8;
  const dataBytes = values.length * bytesPerSample;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  write(bytes, 0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  write(bytes, 8, 'WAVE');
  write(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000 * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, bits, true);
  write(bytes, 36, 'data');
  view.setUint32(40, dataBytes, true);

  values.forEach((value, index) => {
    const offset = 44 + index * bytesPerSample;
    if (format === 3) {
      view.setFloat32(offset, value, true);
    } else if (bits === 8) {
      view.setUint8(offset, Math.max(0, Math.min(255, Math.round(value * 128 + 128))));
    } else if (bits === 16) {
      view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(value * 32768))), true);
    } else if (bits === 24) {
      let raw = Math.max(-8388608, Math.min(8388607, Math.round(value * 8388608)));
      if (raw < 0) raw += 0x1000000;
      bytes[offset] = raw & 0xff;
      bytes[offset + 1] = (raw >> 8) & 0xff;
      bytes[offset + 2] = (raw >> 16) & 0xff;
    } else {
      view.setInt32(
        offset,
        Math.max(-2147483648, Math.min(2147483647, Math.round(value * 2147483648))),
        true,
      );
    }
  });
  return bytes;
}

function write(bytes, offset, text) {
  for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
}

test('waveform merangkum PCM/float tanpa decode AudioContext', () => {
  for (const config of [
    { bits: 8, format: 1 },
    { bits: 16, format: 1 },
    { bits: 24, format: 1 },
    { bits: 32, format: 1 },
    { bits: 32, format: 3 },
  ]) {
    const summary = summarizeWavWaveform(makeWav(config), { bins: 16 });
    assert.equal(summary.frameCount, 5);
    assert.equal(summary.bins, 5);
    assert.equal(summary.channels, 1);
    assert.ok(summary.peaks[0].min <= -0.98);
    assert.ok(summary.peaks.at(-1).max >= 0.98);
  }
});

test('waveform bin count bounded dan input invalid ditolak', () => {
  assert.throws(
    () => summarizeWavWaveform(makeWav(), { bins: 8 }),
    (error) => error.code === 'E_WAVEFORM_BINS',
  );
  assert.throws(
    () => summarizeWavWaveform('bukan bytes'),
    (error) => error.code === 'E_WAVEFORM_TYPE',
  );
});
