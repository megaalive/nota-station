export const FOCUS_SESSION_KEY = 'notastation.r3.focus';

export function saveSessionFocus(
  focusState,
  { storage = globalThis.sessionStorage } = {},
) {
  if (!storage || typeof storage.setItem !== 'function') {
    return Object.freeze({ saved: false, reason: 'unavailable' });
  }

  const payload = {
    version: 1,
    orderEntryId: normalizeOrderEntryId(focusState?.orderEntryId),
  };

  try {
    storage.setItem(FOCUS_SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    throw sessionFocusError(
      error?.name === 'QuotaExceededError'
        ? 'E_SESSION_FOCUS_QUOTA'
        : 'E_SESSION_FOCUS_WRITE',
      error?.message || 'Focus sesi gagal disimpan.',
    );
  }
  return Object.freeze({ saved: true, reason: null });
}

export function restoreSessionFocus({
  storage = globalThis.sessionStorage,
} = {}) {
  if (!storage || typeof storage.getItem !== 'function') return null;

  let text;
  try {
    text = storage.getItem(FOCUS_SESSION_KEY);
  } catch (error) {
    throw sessionFocusError(
      'E_SESSION_FOCUS_READ',
      error?.message || 'Focus sesi gagal dibaca.',
    );
  }
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (
      !parsed
      || parsed.version !== 1
      || !Object.hasOwn(parsed, 'orderEntryId')
      || (
        parsed.orderEntryId !== null
        && (typeof parsed.orderEntryId !== 'string' || parsed.orderEntryId.length === 0)
      )
    ) {
      throw new Error('shape');
    }
    return Object.freeze({
      orderEntryId: normalizeOrderEntryId(parsed.orderEntryId),
    });
  } catch (error) {
    try {
      storage.removeItem?.(FOCUS_SESSION_KEY);
    } catch {
      // Snapshot focus yang rusak dianggap hilang walau cleanup storage ditolak browser.
    }
    throw sessionFocusError(
      'E_SESSION_FOCUS_INVALID',
      error?.message === 'shape'
        ? 'Snapshot focus sesi tidak valid.'
        : error?.message || 'Snapshot focus sesi tidak valid.',
    );
  }
}

function normalizeOrderEntryId(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function sessionFocusError(code, message) {
  const error = new Error(message);
  error.name = 'SessionFocusError';
  error.code = code;
  return error;
}
