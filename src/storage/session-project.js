import {
  parseDebugProject,
  serializeDebugProject,
} from '../io/debug-json.js';

export const SESSION_PROJECT_KEY = 'notastation.r2.sessionProject';

export function saveSessionProject(
  project,
  { storage = globalThis.sessionStorage } = {},
) {
  if (!storage || typeof storage.setItem !== 'function') {
    return Object.freeze({ saved: false, reason: 'unavailable', bytes: 0 });
  }

  const text = serializeDebugProject(project);
  try {
    storage.setItem(SESSION_PROJECT_KEY, text);
  } catch (error) {
    throw sessionError(
      error?.name === 'QuotaExceededError'
        ? 'E_SESSION_PROJECT_QUOTA'
        : 'E_SESSION_PROJECT_WRITE',
      error?.message || 'Snapshot session project gagal ditulis.',
    );
  }

  return Object.freeze({
    saved: true,
    reason: null,
    bytes: new TextEncoder().encode(text).byteLength,
  });
}

export function restoreSessionProject({
  storage = globalThis.sessionStorage,
} = {}) {
  if (!storage || typeof storage.getItem !== 'function') return null;

  let text;
  try {
    text = storage.getItem(SESSION_PROJECT_KEY);
  } catch (error) {
    throw sessionError(
      'E_SESSION_PROJECT_READ',
      error?.message || 'Snapshot session project gagal dibaca.',
    );
  }
  if (!text) return null;

  try {
    return parseDebugProject(text);
  } catch (error) {
    try {
      storage.removeItem?.(SESSION_PROJECT_KEY);
    } catch {
      // Snapshot invalid sudah dianggap hilang walau storage menolak cleanup.
    }
    throw sessionError(
      'E_SESSION_PROJECT_INVALID',
      error?.message || 'Snapshot session project tidak valid.',
    );
  }
}

export function clearSessionProject({
  storage = globalThis.sessionStorage,
} = {}) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    const existed = storage.getItem?.(SESSION_PROJECT_KEY) !== null;
    storage.removeItem(SESSION_PROJECT_KEY);
    return existed;
  } catch (error) {
    throw sessionError(
      'E_SESSION_PROJECT_CLEAR',
      error?.message || 'Snapshot session project gagal dibersihkan.',
    );
  }
}

function sessionError(code, message) {
  const error = new Error(message);
  error.name = 'SessionProjectError';
  error.code = code;
  return error;
}
