import { patternUsageCount } from './arrangement.js';

export function createSharedPatternGuard(initial = {}) {
  let allowedPatternIds = new Set(normalizePatternIds(initial.allowedPatternIds));

  function getState() {
    return Object.freeze({
      allowedPatternIds: [...allowedPatternIds],
    });
  }

  function inspect(project, patternId) {
    const pattern = project.song.patterns.find((item) => item.id === patternId);
    const usage = patternUsageCount(project, patternId);
    return Object.freeze({
      required: Boolean(pattern && usage > 1 && !allowedPatternIds.has(patternId)),
      patternId,
      patternName: pattern?.name ?? patternId,
      usage,
    });
  }

  function allowEditAll(patternId) {
    if (typeof patternId !== 'string' || patternId.length === 0) {
      throw sharedPatternError(
        'E_SHARED_PATTERN_ID',
        'Pattern ID untuk shared edit harus string non-kosong.',
      );
    }
    allowedPatternIds.add(patternId);
    return getState();
  }

  function reconcile(project) {
    const known = new Set(project.song.patterns.map((pattern) => pattern.id));
    allowedPatternIds = new Set(
      [...allowedPatternIds].filter((patternId) => known.has(patternId)),
    );
    return getState();
  }

  return Object.freeze({
    getState,
    inspect,
    allowEditAll,
    reconcile,
  });
}

function normalizePatternIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

function sharedPatternError(code, message) {
  const error = new Error(message);
  error.name = 'SharedPatternError';
  error.code = code;
  return error;
}
