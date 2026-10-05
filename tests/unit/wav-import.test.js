import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { createBlankProject } from '../../src/core/project.js';
import {
  MAX_WAV_BYTES,
  parseWav,
  prepareWavImport,
  sha256Hex,
} from '../../src/io/wav-import.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function fixture() {
  let seq = 0;
  return {
    project: createBlankProject({
      idFactory: (prefix) => `${prefix}-${++seq}`,
      now: () => '2026-10-05T07:00:00.000Z',
    }),
    idFactory: (prefix) => `${prefix}-import-${++seq}`,
  };
}

function makeWav({
  format = 1,
  channels = 1,
  sampleRate = 44100,
  bits = 16,
  frames = 8,
  extensible = false,
  extraChunks = [],
} = {}) {
  const blockAlign = channels * (bits / 8);
  const dataBytes = frames * blockAlign;
  const fmtSize = extensible ? 40 : 16;
  const chunks = [
    { id: 'fmt ', size: fmtSize, kind: 'fmt' },
    ...extraChunks,
    { id: 'data', size: dataBytes, kind: 'data' },
  ];
  const riffPayload = 4 + chunks.reduce((sum, chunk) => sum + 8 + chunk.size + (chunk.size & 1), 0);
  const bytes = new Uint8Array(8 + riffPayload);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, riffPayload, true);
  writeAscii(bytes, 8, 'WAVE');

  let offset = 12;
  for (const chunk of chunks) {
    writeAscii(bytes, offset, chunk.id);
    view.setUint32(offset + 4, chunk.size, true);
    const payload = offset + 8;

    if (chunk.kind === 'fmt') {
      view.setUint16(payload, extensible ? 0xfffe : format, true);
      view.setUint16(payload + 2, channels, true);
      view.setUint32(payload + 4, sampleRate, true);
      view.setUint32(payload + 8, sampleRate * blockAlign, true);
      view.setUint16(payload + 12, blockAlign, true);
      view.setUint16(payload + 14, bits, true);
      if (extensible) {
        view.setUint16(payload + 16, 22, true);
        view.setUint16(payload + 18, bits, true);
        view.setUint32(payload + 20, channels === 1 ? 0x4 : 0x3, true);
        view.setUint16(payload + 24, format, true);
        const tail = [
          0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
          0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
        ];
        bytes.set(tail, payload + 26);
      }
    } else if (chunk.kind === 'data') {
      for (let i = 0; i < chunk.size; i += 1) bytes[payload + i] = (i * 17) & 0xff;
    } else {
      for (let i = 0; i < chunk.size; i += 1) bytes[payload + i] = i & 0xff;
    }

    offset = payload + chunk.size + (chunk.size & 1);
  }
  return bytes;
}

function writeAscii(bytes, offset, text) {
  for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
}

test('parser menerima PCM 8/16/24/32-bit dan float32 mono/stereo', () => {
  const cases = [
    { format: 1, bits: 8, channels: 1 },
    { format: 1, bits: 16, channels: 2 },
    { format: 1, bits: 24, channels: 1 },
    { format: 1, bits: 32, channels: 2 },
    { format: 3, bits: 32, channels: 1 },
    { format: 3, bits: 32, channels: 2 },
  ];

  for (const item of cases) {
    const wav = parseWav(makeWav({ ...item, sampleRate: 48000, frames: 12 }));
    assert.equal(wav.format, item.format === 1 ? 'pcm' : 'float');
    assert.equal(wav.bitsPerSample, item.bits);
    assert.equal(wav.channels, item.channels);
    assert.equal(wav.sampleRate, 48000);
    assert.equal(wav.frameCount, 12);
  }
});

test('parser menerima unknown chunk + padding dan WAVE_FORMAT_EXTENSIBLE', () => {
  const wav = parseWav(makeWav({
    format: 1,
    bits: 24,
    channels: 2,
    sampleRate: 96000,
    frames: 17,
    extensible: true,
    extraChunks: [{ id: 'JUNK', size: 5, kind: 'junk' }],
  }));

  assert.equal(wav.extensible, true);
  assert.equal(wav.format, 'pcm');
  assert.equal(wav.bitsPerSample, 24);
  assert.equal(wav.frameCount, 17);
  assert.equal(wav.channelMask, 0x3);
});

test('parser memberi error spesifik untuk WAV malformed/unsupported', () => {
  assert.throws(() => parseWav(new Uint8Array(4)), (e) => e.code === 'E_WAV_TRUNCATED');

  const notRiff = makeWav();
  notRiff[0] = 0;
  assert.throws(() => parseWav(notRiff), (e) => e.code === 'E_WAV_RIFF');

  assert.throws(
    () => parseWav(makeWav({ channels: 3 })),
    (e) => e.code === 'E_WAV_CHANNELS',
  );
  assert.throws(
    () => parseWav(makeWav({ format: 3, bits: 64 })),
    (e) => e.code === 'E_WAV_BITS',
  );
  assert.throws(
    () => parseWav(makeWav({ sampleRate: 192001 })),
    (e) => e.code === 'E_WAV_SAMPLE_RATE',
  );

  const truncated = makeWav();
  const shorter = truncated.subarray(0, truncated.length - 1);
  assert.throws(() => parseWav(shorter), (e) => e.code === 'E_WAV_TRUNCATED');
});

test('batas 100 MiB ditolak sebelum parser menelusuri chunk', () => {
  const oversized = new Uint8Array(MAX_WAV_BYTES + 1);
  assert.throws(() => parseWav(oversized), (e) => e.code === 'E_WAV_SIZE');
});

test('prepare import membuat Sample+Instrument candidate dan dedup berdasarkan SHA-256', async () => {
  const { project, idFactory } = fixture();
  const bytes = makeWav({ bits: 24, channels: 2, sampleRate: 48000, frames: 32 });

  const first = await prepareWavImport(project, {
    bytes,
    sourceFilename: 'folder/Bass_01.WAV',
    idFactory,
  });

  assert.equal(first.shouldPersistSample, true);
  assert.equal(first.duplicateSampleId, null);
  assert.equal(first.sample.name, 'Bass_01');
  assert.equal(first.sample.channels, 2);
  assert.equal(first.sample.sampleRate, 48000);
  assert.equal(first.sample.frameCount, 32);
  assert.equal(first.sample.storageRef.kind, 'indexeddb');
  assert.equal(first.instrument.zones[0].sampleId, first.sample.id);
  assert.equal(first.instrument.name, 'Bass_01');

  const withSample = { ...project, samples: [...project.samples, first.sample] };
  const second = await prepareWavImport(withSample, {
    bytes,
    sourceFilename: 'copy.wav',
    idFactory,
  });

  assert.equal(second.shouldPersistSample, false);
  assert.equal(second.duplicateSampleId, first.sample.id);
  assert.equal(second.sample, first.sample);
  assert.equal(second.instrument.zones[0].sampleId, first.sample.id);
});

test('SHA-256 stabil untuk bytes identik dan berubah bila payload berubah', async () => {
  const a = makeWav({ frames: 4 });
  const b = a.slice();
  const c = a.slice();
  c[c.length - 1] ^= 1;

  assert.equal(await sha256Hex(a), await sha256Hex(b));
  assert.notEqual(await sha256Hex(a), await sha256Hex(c));
});

test('fuzz malformed WAV selalu fail-closed dengan WavImportError atau metadata valid', () => {
  let state = 0x6d2b79f5;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };

  for (let round = 0; round < 256; round += 1) {
    const length = random() % 384;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = random() & 0xff;

    try {
      const wav = parseWav(bytes);
      assert.ok(wav.channels >= 1 && wav.channels <= 2);
      assert.ok(wav.sampleRate >= 4000 && wav.sampleRate <= 192000);
      assert.ok(wav.frameCount >= 1);
    } catch (error) {
      assert.equal(error.name, 'WavImportError');
      assert.match(error.code, /^E_WAV_/);
    }
  }
});
