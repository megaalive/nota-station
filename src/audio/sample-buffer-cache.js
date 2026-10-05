// Cache decoded sample R2.
// Identity cache = contentHash, bukan Sample.id, agar dedup storage juga berlaku
// pada decode AudioBuffer. Failure tidak dipertahankan supaya retry tetap mungkin.

import { FACTORY_BASIC_WAV_BASE64 } from './factory-sample.js';

export function createSampleBufferCache({
  loadBytes,
  decodeBytes,
} = {}) {
  if (typeof loadBytes !== 'function') {
    throw cacheError('E_SAMPLE_CACHE_LOADER', 'loadBytes wajib function.');
  }
  if (typeof decodeBytes !== 'function') {
    throw cacheError('E_SAMPLE_CACHE_DECODER', 'decodeBytes wajib function.');
  }

  const decoded = new Map();
  const pending = new Map();
  let loadCount = 0;
  let decodeCount = 0;

  async function get(sample) {
    const hash = validateSampleIdentity(sample);
    if (decoded.has(hash)) return decoded.get(hash);
    if (pending.has(hash)) return pending.get(hash);

    const task = (async () => {
      loadCount += 1;
      const raw = await loadBytes(sample);
      const bytes = exactArrayBuffer(raw);
      if (bytes.byteLength === 0) {
        throw cacheError('E_SAMPLE_CACHE_EMPTY', `Bytes sample kosong: ${sample.id}`);
      }

      decodeCount += 1;
      const buffer = await decodeBytes(bytes, sample);
      if (!buffer) {
        throw cacheError('E_SAMPLE_CACHE_DECODE', `Decode sample gagal: ${sample.id}`);
      }
      decoded.set(hash, buffer);
      return buffer;
    })();

    pending.set(hash, task);
    try {
      return await task;
    } catch (error) {
      decoded.delete(hash);
      throw normalizeCacheError(error);
    } finally {
      pending.delete(hash);
    }
  }

  function prime(sample, buffer) {
    const hash = validateSampleIdentity(sample);
    if (!buffer) {
      throw cacheError('E_SAMPLE_CACHE_DECODE', `Decoded buffer tidak valid: ${sample.id}`);
    }
    decoded.set(hash, buffer);
    pending.delete(hash);
    return buffer;
  }

  function peek(sampleOrHash) {
    const hash = typeof sampleOrHash === 'string'
      ? normalizeHash(sampleOrHash)
      : validateSampleIdentity(sampleOrHash);
    return decoded.get(hash) ?? null;
  }

  function evict(sampleOrHash) {
    const hash = typeof sampleOrHash === 'string'
      ? normalizeHash(sampleOrHash)
      : validateSampleIdentity(sampleOrHash);
    const existed = decoded.delete(hash);
    pending.delete(hash);
    return existed;
  }

  function clear() {
    const count = decoded.size;
    decoded.clear();
    pending.clear();
    return count;
  }

  function getState() {
    return Object.freeze({
      decoded: decoded.size,
      pending: pending.size,
      loadCount,
      decodeCount,
      hashes: [...decoded.keys()].sort(),
    });
  }

  return Object.freeze({
    get,
    prime,
    peek,
    evict,
    clear,
    getState,
  });
}

export function createProjectSampleBytesLoader({
  sampleStore = null,
} = {}) {
  const factoryBytes = new Map();
  let drumPackPromise = null;

  async function loadFactoryBytes(key) {
    if (factoryBytes.has(key)) return factoryBytes.get(key).slice(0);

    let encoded = null;
    if (key === 'basic') {
      encoded = FACTORY_BASIC_WAV_BASE64;
    } else if (key.startsWith('drum.')) {
      if (!drumPackPromise) {
        drumPackPromise = import('./factory-drum-samples.js');
      }
      const drumPack = await drumPackPromise;
      encoded = drumPack.FACTORY_DRUM_WAV_BASE64[key] ?? null;
    }

    if (!encoded) {
      throw cacheError(
        'E_SAMPLE_CACHE_FACTORY_KEY',
        `Factory sample tidak dikenal: ${key}`,
      );
    }

    const bytes = decodeBase64(encoded);
    factoryBytes.set(key, bytes);
    return bytes.slice(0);
  }

  return async function loadProjectSampleBytes(sample) {
    if (!sample?.storageRef) {
      throw cacheError('E_SAMPLE_CACHE_STORAGE_REF', 'Sample tidak memiliki storageRef.');
    }

    if (sample.storageRef.kind === 'factory') {
      return loadFactoryBytes(sample.storageRef.key);
    }

    if (sample.storageRef.kind === 'indexeddb') {
      if (!sampleStore || typeof sampleStore.getBytes !== 'function') {
        throw cacheError(
          'E_SAMPLE_CACHE_STORE',
          'Sample store diperlukan untuk storageRef IndexedDB.',
        );
      }
      const bytes = await sampleStore.getBytes(sample.storageRef.key);
      if (!bytes) {
        throw cacheError(
          'E_SAMPLE_CACHE_MISSING',
          `Bytes sample tidak ditemukan: ${sample.storageRef.key}`,
        );
      }
      return exactArrayBuffer(bytes);
    }

    throw cacheError(
      'E_SAMPLE_CACHE_STORAGE_REF',
      `storageRef.kind tidak didukung: ${sample.storageRef.kind}`,
    );
  };
}

function validateSampleIdentity(sample) {
  if (!sample || typeof sample !== 'object') {
    throw cacheError('E_SAMPLE_CACHE_SAMPLE', 'Sample tidak valid.');
  }
  return normalizeHash(sample.contentHash);
}

function normalizeHash(value) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw cacheError('E_SAMPLE_CACHE_HASH', 'contentHash sample tidak valid.');
  }
  return value;
}

function exactArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input.slice(0);
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  throw cacheError(
    'E_SAMPLE_CACHE_BYTES',
    'Loader sample harus mengembalikan ArrayBuffer atau typed array.',
  );
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function normalizeCacheError(error) {
  if (error?.name === 'SampleBufferCacheError') return error;
  return cacheError(
    'E_SAMPLE_CACHE_LOAD',
    error?.message || 'Load/decode sample gagal.',
  );
}

function cacheError(code, message) {
  const error = new Error(message);
  error.name = 'SampleBufferCacheError';
  error.code = code;
  return error;
}
