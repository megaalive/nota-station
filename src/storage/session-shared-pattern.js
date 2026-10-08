export const SHARED_PATTERN_SESSION_KEY = 'notastation.r3.shared-pattern';

export function saveSessionSharedPatternGuard(
  state,
  { storage = globalThis.sessionStorage } = {},
) {
  if (!storage || typeof storage.setItem !== 'function') {
    return Object.freeze({ saved: false, reason: 'unavailable' });
  }

  const allowedPatternIds = validatePatternIds(state?.allowedPatternIds);
  const payload = {
    version: 1,
    allowedPatternIds,
  };

  try {
    storage.setItem(SHARED_PATTERN_SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    throw sharedPatternSessionError(
      error?.name === 'QuotaExceededError'
        ? 'E_SESSION_SHARED_PATTERN_QUOTA'
        : 'E_SESSION_SHARED_PATTERN_WRITE',
      error?.message || 'Keputusan shared-pattern gagal disimpan.',
    );
  }

  return Object.freeze({ saved: true, reason: null });
}

export function restoreSessionSharedPatternGuard({
  storage = globalThis.sessionStorage,
} = {}) {
  if (!storage || typeof storage.getItem !== 'function') return null;

  let text;
  try {
    text = storage.getItem(SHARED_PATTERN_SESSION_KEY);
  } catch (error) {
    throw sharedPatternSessionError(
      'E_SESSION_SHARED_PATTERN_READ',
      error?.message || 'Keputusan shared-pattern gagal dibaca.',
    );
  }
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.version !== 1) throw new Error('shape');
    return Object.freeze({
      allowedPatternIds: validatePatternIds(parsed.allowedPatternIds),
    });
  } catch (error) {
    try {
      storage.removeItem?.(SHARED_PATTERN_SESSION_KEY);
    } catch {
      // Payload invalid dianggap hilang walau cleanup ditolak browser.
    }
    if (error?.code === 'E_SESSION_SHARED_PATTERN_INVALID') throw error;
    throw sharedPatternSessionError(
      'E_SESSION_SHARED_PATTERN_INVALID',
      'Snapshot keputusan shared-pattern tidak valid.',
    );
  }
}

function validatePatternIds(value) {
  if (!Array.isArray(value) || value.length > 128) {
    throw sharedPatternSessionError(
      'E_SESSION_SHARED_PATTERN_INVALID',
      'Daftar shared-pattern sesi tidak valid.',
    );
  }

  const ids = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || item.length < 1 || item.length > 160) {
      throw sharedPatternSessionError(
        'E_SESSION_SHARED_PATTERN_INVALID',
        'Pattern ID shared-pattern sesi tidak valid.',
      );
    }
    if (seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function sharedPatternSessionError(code, message) {
  const error = new Error(message);
  error.name = 'SharedPatternSessionError';
  error.code = code;
  return error;
}
