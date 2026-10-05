// Persistensi bytes Sample R2.
// Key store adalah SHA-256 hex sehingga deduplikasi ditegakkan oleh storage,
// bukan hanya oleh state Project di memory.

export const SAMPLE_DB_NAME = 'notastation';
export const SAMPLE_DB_VERSION = 1;
export const SAMPLE_STORE_NAME = 'samples';

export async function openSampleStore({
  indexedDB = globalThis.indexedDB,
  dbName = SAMPLE_DB_NAME,
  version = SAMPLE_DB_VERSION,
} = {}) {
  if (!indexedDB || typeof indexedDB.open !== 'function') {
    throw storeError('E_SAMPLE_STORE_UNAVAILABLE', 'IndexedDB tidak tersedia.');
  }
  if (typeof dbName !== 'string' || dbName.length === 0) {
    throw storeError('E_SAMPLE_STORE_NAME', 'Nama database sample tidak valid.');
  }

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = () => {
      const next = request.result;
      if (!next.objectStoreNames.contains(SAMPLE_STORE_NAME)) {
        const objectStore = next.createObjectStore(SAMPLE_STORE_NAME, { keyPath: 'key' });
        objectStore.createIndex('contentHash', 'contentHash', { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(mapIdbError(request.error, 'E_SAMPLE_STORE_OPEN'));
    request.onblocked = () => reject(
      storeError('E_SAMPLE_STORE_BLOCKED', 'Upgrade database sample diblokir tab lain.'),
    );
  });

  let closed = false;
  db.onversionchange = () => {
    db.close();
    closed = true;
  };

  const assertOpen = () => {
    if (closed) throw storeError('E_SAMPLE_STORE_CLOSED', 'Sample store sudah ditutup.');
  };

  return Object.freeze({
    dbName,

    async putIfAbsent({ key, contentHash, bytes, sourceFilename = null }) {
      assertOpen();
      validateRecordIdentity(key, contentHash);
      const data = exactArrayBuffer(bytes);

      return new Promise((resolve, reject) => {
        let settled = false;
        let inserted = false;
        let existing = null;
        const tx = db.transaction(SAMPLE_STORE_NAME, 'readwrite');
        const objectStore = tx.objectStore(SAMPLE_STORE_NAME);
        const getRequest = objectStore.get(key);

        getRequest.onsuccess = () => {
          existing = getRequest.result ?? null;
          if (existing) return;

          inserted = true;
          objectStore.add({
            key,
            contentHash,
            byteLength: data.byteLength,
            bytes: data,
            sourceFilename,
            createdAt: new Date().toISOString(),
          });
        };
        getRequest.onerror = () => {
          if (!settled) {
            settled = true;
            reject(mapIdbError(getRequest.error, 'E_SAMPLE_STORE_READ'));
          }
        };
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(Object.freeze({
            inserted,
            key,
            byteLength: inserted ? data.byteLength : existing.byteLength,
          }));
        };
        tx.onabort = () => {
          if (!settled) {
            settled = true;
            reject(mapIdbError(tx.error, 'E_SAMPLE_STORE_WRITE'));
          }
        };
        tx.onerror = () => {
          // onabort memetakan error transaksi; hindari reject ganda.
        };
      });
    },

    async getRecord(key) {
      assertOpen();
      validateKey(key);
      const tx = db.transaction(SAMPLE_STORE_NAME, 'readonly');
      const request = tx.objectStore(SAMPLE_STORE_NAME).get(key);
      const record = await requestResult(request, 'E_SAMPLE_STORE_READ');
      await transactionDone(tx, 'E_SAMPLE_STORE_READ');
      if (!record) return null;
      return {
        ...record,
        bytes: record.bytes.slice(0),
      };
    },

    async getBytes(key) {
      const record = await this.getRecord(key);
      return record ? new Uint8Array(record.bytes) : null;
    },

    async has(key) {
      assertOpen();
      validateKey(key);
      const tx = db.transaction(SAMPLE_STORE_NAME, 'readonly');
      const request = tx.objectStore(SAMPLE_STORE_NAME).count(key);
      const count = await requestResult(request, 'E_SAMPLE_STORE_READ');
      await transactionDone(tx, 'E_SAMPLE_STORE_READ');
      return count > 0;
    },

    async delete(key) {
      assertOpen();
      validateKey(key);
      const existed = await this.has(key);
      if (!existed) return false;

      const tx = db.transaction(SAMPLE_STORE_NAME, 'readwrite');
      tx.objectStore(SAMPLE_STORE_NAME).delete(key);
      await transactionDone(tx, 'E_SAMPLE_STORE_WRITE');
      return true;
    },

    async stats() {
      assertOpen();
      const tx = db.transaction(SAMPLE_STORE_NAME, 'readonly');
      const objectStore = tx.objectStore(SAMPLE_STORE_NAME);

      const result = await new Promise((resolve, reject) => {
        let count = 0;
        let bytes = 0;
        const request = objectStore.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve({ count, bytes });
            return;
          }
          count += 1;
          bytes += Number(cursor.value?.byteLength) || 0;
          cursor.continue();
        };
        request.onerror = () => reject(mapIdbError(request.error, 'E_SAMPLE_STORE_READ'));
      });

      await transactionDone(tx, 'E_SAMPLE_STORE_READ');
      return Object.freeze(result);
    },

    async clear() {
      assertOpen();
      const tx = db.transaction(SAMPLE_STORE_NAME, 'readwrite');
      tx.objectStore(SAMPLE_STORE_NAME).clear();
      await transactionDone(tx, 'E_SAMPLE_STORE_WRITE');
    },

    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  });
}

export async function deleteSampleDatabase({
  indexedDB = globalThis.indexedDB,
  dbName = SAMPLE_DB_NAME,
} = {}) {
  if (!indexedDB || typeof indexedDB.deleteDatabase !== 'function') {
    throw storeError('E_SAMPLE_STORE_UNAVAILABLE', 'IndexedDB tidak tersedia.');
  }

  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(mapIdbError(request.error, 'E_SAMPLE_STORE_DELETE_DB'));
    request.onblocked = () => reject(
      storeError('E_SAMPLE_STORE_BLOCKED', 'Penghapusan database sample diblokir tab lain.'),
    );
  });
}

export function sampleStorageKey(contentHash) {
  if (typeof contentHash !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(contentHash)) {
    throw storeError('E_SAMPLE_STORE_HASH', 'contentHash sample harus sha256:<64 hex>.');
  }
  return contentHash.slice('sha256:'.length);
}

function validateRecordIdentity(key, contentHash) {
  validateKey(key);
  const hashKey = sampleStorageKey(contentHash);
  if (hashKey !== key) {
    throw storeError('E_SAMPLE_STORE_HASH', 'Key IndexedDB tidak cocok dengan contentHash.');
  }
}

function validateKey(key) {
  if (typeof key !== 'string' || !/^[0-9a-f]{64}$/u.test(key)) {
    throw storeError('E_SAMPLE_STORE_KEY', 'Key sample harus 64 hex lowercase.');
  }
}

function exactArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input.slice(0);
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  throw storeError('E_SAMPLE_STORE_BYTES', 'Bytes sample harus ArrayBuffer atau typed array.');
}

function requestResult(request, fallbackCode) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(mapIdbError(request.error, fallbackCode));
  });
}

function transactionDone(tx, fallbackCode) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(mapIdbError(tx.error, fallbackCode));
    tx.onerror = () => {
      // onabort menjadi sumber error final.
    };
  });
}

function mapIdbError(error, fallbackCode) {
  if (error?.name === 'QuotaExceededError') {
    return storeError('E_SAMPLE_STORE_QUOTA', 'Quota IndexedDB tidak cukup untuk sample.');
  }
  if (error?.name === 'VersionError') {
    return storeError('E_SAMPLE_STORE_VERSION', 'Versi database sample tidak kompatibel.');
  }
  return storeError(fallbackCode, error?.message || 'Operasi IndexedDB sample gagal.');
}

function storeError(code, message) {
  const error = new Error(message);
  error.name = 'SampleStoreError';
  error.code = code;
  return error;
}
