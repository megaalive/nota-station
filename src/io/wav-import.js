// Parser/import foundation WAV R2 (§6.1, §10.5).
// Input adalah untrusted bytes: bounded, fail-closed, dan tidak mengubah Project.

import {
  createSamplerInstrument,
  validateInstrumentModel,
  validateSampleModel,
} from '../core/sound-model.js';

export const MAX_WAV_BYTES = 100 * 1024 * 1024;
export const MAX_WAV_CHANNELS = 2;
export const MAX_WAV_SAMPLE_RATE = 192000;
export const MAX_WAV_CHUNKS = 4096;

const PCM_FORMAT = 0x0001;
const FLOAT_FORMAT = 0x0003;
const EXTENSIBLE_FORMAT = 0xfffe;
const EXTENSIBLE_GUID_TAIL = Object.freeze([
  0x00, 0x00, 0x00, 0x00,
  0x10, 0x00,
  0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
]);

export function parseWav(input) {
  const bytes = toBytes(input);
  if (bytes.byteLength < 12) {
    throw wavError('E_WAV_TRUNCATED', 'WAV terlalu pendek untuk header RIFF.');
  }
  if (bytes.byteLength > MAX_WAV_BYTES) {
    throw wavError('E_WAV_SIZE', 'WAV melebihi batas 100 MiB.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (fourCC(bytes, 0) !== 'RIFF') {
    throw wavError('E_WAV_RIFF', 'Header RIFF WAV tidak valid.');
  }
  if (fourCC(bytes, 8) !== 'WAVE') {
    throw wavError('E_WAV_WAVE', 'Container RIFF bukan WAVE.');
  }

  const riffSize = view.getUint32(4, true);
  const riffEnd = 8 + riffSize;
  if (riffEnd < 12 || riffEnd > bytes.byteLength) {
    throw wavError('E_WAV_TRUNCATED', 'Ukuran RIFF melebihi bytes yang tersedia.');
  }

  let fmt = null;
  let data = null;
  let offset = 12;
  let chunkCount = 0;

  while (offset < riffEnd) {
    if (++chunkCount > MAX_WAV_CHUNKS) {
      throw wavError('E_WAV_CHUNK_LIMIT', 'Jumlah chunk WAV melebihi batas.');
    }
    if (offset + 8 > riffEnd) {
      throw wavError('E_WAV_TRUNCATED', 'Header chunk WAV terpotong.');
    }

    const id = fourCC(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;
    const payloadEnd = payloadOffset + size;

    if (!Number.isSafeInteger(payloadEnd) || payloadEnd > riffEnd) {
      throw wavError('E_WAV_TRUNCATED', `Chunk ${id} melebihi batas RIFF.`);
    }

    if (id === 'fmt ') {
      if (fmt) throw wavError('E_WAV_DUPLICATE_FMT', 'WAV memiliki lebih dari satu chunk fmt.');
      fmt = parseFmtChunk(bytes, view, payloadOffset, size);
    } else if (id === 'data') {
      if (data) throw wavError('E_WAV_DUPLICATE_DATA', 'WAV memiliki lebih dari satu chunk data.');
      data = { offset: payloadOffset, bytes: size };
    }

    const next = payloadEnd + (size & 1);
    if (next > riffEnd) {
      throw wavError('E_WAV_TRUNCATED', `Padding chunk ${id} terpotong.`);
    }
    offset = next;
  }

  if (!fmt) throw wavError('E_WAV_FMT_MISSING', 'Chunk fmt WAV tidak ditemukan.');
  if (!data) throw wavError('E_WAV_DATA_MISSING', 'Chunk data WAV tidak ditemukan.');
  if (data.bytes === 0) throw wavError('E_WAV_DATA_EMPTY', 'Chunk data WAV kosong.');
  if (data.bytes % fmt.blockAlign !== 0) {
    throw wavError('E_WAV_DATA_ALIGN', 'Ukuran data WAV tidak sejajar dengan blockAlign.');
  }

  const frameCount = data.bytes / fmt.blockAlign;
  if (!Number.isSafeInteger(frameCount) || frameCount < 1) {
    throw wavError('E_WAV_FRAME_COUNT', 'Jumlah frame WAV tidak valid.');
  }

  return Object.freeze({
    container: 'WAVE',
    format: fmt.audioFormat === PCM_FORMAT ? 'pcm' : 'float',
    audioFormat: fmt.audioFormat,
    extensible: fmt.extensible,
    channels: fmt.channels,
    sampleRate: fmt.sampleRate,
    bitsPerSample: fmt.bitsPerSample,
    validBitsPerSample: fmt.validBitsPerSample,
    blockAlign: fmt.blockAlign,
    byteRate: fmt.byteRate,
    channelMask: fmt.channelMask,
    frameCount,
    dataOffset: data.offset,
    dataBytes: data.bytes,
    durationSeconds: frameCount / fmt.sampleRate,
    riffBytes: riffEnd,
  });
}

export async function prepareWavImport(
  project,
  {
    bytes,
    sourceFilename,
    name = null,
    idFactory = defaultIdFactory,
  },
) {
  if (!project || typeof project !== 'object' || !Array.isArray(project.samples)) {
    throw wavError('E_WAV_PROJECT', 'Project import WAV tidak valid.');
  }
  if (typeof sourceFilename !== 'string' || sourceFilename.trim().length === 0) {
    throw wavError('E_WAV_FILENAME', 'Nama file WAV harus non-kosong.');
  }

  const wav = parseWav(bytes);
  const hashHex = await sha256Hex(toBytes(bytes));
  const contentHash = `sha256:${hashHex}`;
  const duplicate = project.samples.find((sample) => sample.contentHash === contentHash) ?? null;
  const displayName = normalizeSampleName(name ?? sourceFilename);

  const sample = duplicate ?? {
    id: idFactory('sample'),
    name: displayName,
    sourceFilename: sourceFilename.trim().slice(0, 255),
    contentHash,
    channels: wav.channels,
    sampleRate: wav.sampleRate,
    frameCount: wav.frameCount,
    rootNote: 60,
    fineTuneCents: 0,
    gain: 1,
    loop: {
      enabled: false,
      startFrame: 0,
      endFrame: wav.frameCount,
      mode: 'forward',
    },
    storageRef: {
      kind: 'indexeddb',
      key: hashHex,
    },
  };
  validateSampleModel(sample);

  const instrument = createSamplerInstrument({
    id: idFactory('instrument'),
    name: displayName,
    sampleId: sample.id,
    rootNote: sample.rootNote,
  });
  const sampleIds = new Set(project.samples.map((item) => item.id));
  sampleIds.add(sample.id);
  validateInstrumentModel(instrument, sampleIds);

  return Object.freeze({
    wav,
    contentHash,
    duplicateSampleId: duplicate?.id ?? null,
    shouldPersistSample: duplicate === null,
    sample,
    instrument,
  });
}

export async function sha256Hex(input) {
  const bytes = toBytes(input);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw wavError('E_WAV_CRYPTO', 'SHA-256 tidak tersedia pada runtime ini.');
  }
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function parseFmtChunk(bytes, view, offset, size) {
  if (size < 16) throw wavError('E_WAV_FMT_SIZE', 'Chunk fmt WAV lebih kecil dari 16 byte.');

  const rawFormat = view.getUint16(offset, true);
  const channels = view.getUint16(offset + 2, true);
  const sampleRate = view.getUint32(offset + 4, true);
  const byteRate = view.getUint32(offset + 8, true);
  const blockAlign = view.getUint16(offset + 12, true);
  const bitsPerSample = view.getUint16(offset + 14, true);

  let audioFormat = rawFormat;
  let extensible = false;
  let validBitsPerSample = bitsPerSample;
  let channelMask = null;

  if (rawFormat === EXTENSIBLE_FORMAT) {
    extensible = true;
    if (size < 40) {
      throw wavError('E_WAV_FMT_EXTENSIBLE', 'WAVE_FORMAT_EXTENSIBLE memerlukan fmt minimal 40 byte.');
    }
    const cbSize = view.getUint16(offset + 16, true);
    if (cbSize < 22 || 18 + cbSize > size) {
      throw wavError('E_WAV_FMT_EXTENSIBLE', 'Ukuran extension fmt WAV tidak valid.');
    }
    validBitsPerSample = view.getUint16(offset + 18, true);
    channelMask = view.getUint32(offset + 20, true);
    audioFormat = view.getUint16(offset + 24, true);

    for (let index = 0; index < EXTENSIBLE_GUID_TAIL.length; index += 1) {
      if (bytes[offset + 26 + index] !== EXTENSIBLE_GUID_TAIL[index]) {
        throw wavError('E_WAV_FMT_EXTENSIBLE', 'SubFormat GUID WAV extensible tidak dikenal.');
      }
    }
    if (validBitsPerSample !== bitsPerSample) {
      throw wavError(
        'E_WAV_VALID_BITS',
        'R2 belum menerima validBitsPerSample yang berbeda dari container bits.',
      );
    }
  }

  if (![PCM_FORMAT, FLOAT_FORMAT].includes(audioFormat)) {
    throw wavError('E_WAV_FORMAT', `Format WAV tidak didukung: 0x${audioFormat.toString(16)}.`);
  }
  if (!Number.isInteger(channels) || channels < 1 || channels > MAX_WAV_CHANNELS) {
    throw wavError('E_WAV_CHANNELS', 'WAV harus mono atau stereo.');
  }
  if (sampleRate < 4000 || sampleRate > MAX_WAV_SAMPLE_RATE) {
    throw wavError('E_WAV_SAMPLE_RATE', 'Sample rate WAV harus 4 kHz..192 kHz.');
  }

  const allowedBits = audioFormat === PCM_FORMAT
    ? [8, 16, 24, 32]
    : [32];
  if (!allowedBits.includes(bitsPerSample)) {
    throw wavError(
      'E_WAV_BITS',
      audioFormat === PCM_FORMAT
        ? 'PCM WAV harus 8/16/24/32-bit integer.'
        : 'IEEE float WAV harus 32-bit.',
    );
  }

  const expectedBlockAlign = channels * (bitsPerSample / 8);
  if (blockAlign !== expectedBlockAlign) {
    throw wavError('E_WAV_BLOCK_ALIGN', 'blockAlign WAV tidak sesuai channel/bit depth.');
  }
  const expectedByteRate = sampleRate * blockAlign;
  if (byteRate !== expectedByteRate) {
    throw wavError('E_WAV_BYTE_RATE', 'byteRate WAV tidak sesuai sampleRate/blockAlign.');
  }

  return {
    audioFormat,
    extensible,
    channels,
    sampleRate,
    bitsPerSample,
    validBitsPerSample,
    blockAlign,
    byteRate,
    channelMask,
  };
}

function normalizeSampleName(value) {
  const raw = String(value ?? '').trim();
  const withoutPath = raw.split(/[\\/]/u).pop() ?? raw;
  const withoutExtension = withoutPath.replace(/\.wav$/iu, '').trim();
  return (withoutExtension || 'Sample').slice(0, 120);
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw wavError('E_WAV_TYPE', 'Input WAV harus ArrayBuffer atau typed array.');
}

function fourCC(bytes, offset) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function defaultIdFactory(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw wavError('E_WAV_CRYPTO', 'randomUUID tidak tersedia pada runtime ini.');
  return `${prefix}-${uuid}`;
}

function wavError(code, message) {
  const error = new Error(message);
  error.name = 'WavImportError';
  error.code = code;
  return error;
}
