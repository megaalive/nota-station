export function createFocusStore(initial = {}) {
  let state = Object.freeze({
    orderEntryId: normalizeOrderEntryId(initial.orderEntryId),
  });

  function getState() {
    return state;
  }

  function reconcile(project) {
    const current = state.orderEntryId;
    if (current && project.song.order.some((entry) => entry.id === current)) {
      return state;
    }

    state = Object.freeze({
      orderEntryId: project.song.order[0]?.id ?? null,
    });
    return state;
  }

  function setOrderEntry(project, orderEntryId) {
    if (!project.song.order.some((entry) => entry.id === orderEntryId)) {
      throw focusError(
        'E_FOCUS_ORDER_MISSING',
        `OrderEntry focus tidak ditemukan: ${orderEntryId}`,
      );
    }
    if (state.orderEntryId === orderEntryId) return state;

    state = Object.freeze({ orderEntryId });
    return state;
  }

  return Object.freeze({
    getState,
    reconcile,
    setOrderEntry,
  });
}

export function patternForFocus(project, focusState) {
  const orderEntryId = normalizeOrderEntryId(focusState?.orderEntryId);
  const entry = (
    project.song.order.find((item) => item.id === orderEntryId)
    ?? project.song.order[0]
  );
  if (!entry) {
    throw focusError('E_FOCUS_ORDER_EMPTY', 'Project tidak punya OrderEntry untuk focus.');
  }

  const pattern = project.song.patterns.find((item) => item.id === entry.patternId);
  if (!pattern) {
    throw focusError(
      'E_FOCUS_PATTERN_MISSING',
      `Pattern focus tidak ditemukan: ${entry.patternId}`,
    );
  }
  return pattern;
}

function normalizeOrderEntryId(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function focusError(code, message) {
  const error = new Error(message);
  error.name = 'FocusError';
  error.code = code;
  return error;
}
