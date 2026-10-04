// History transaksi minimum R1-S2.
// State project bersifat immutable, jadi undo/redo cukup menyimpan referensi snapshot;
// tidak ada JSON clone yang mahal di setiap keystroke.

export function createHistory(initialState, { limit = 100 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError('History limit harus integer >= 1.');
  }

  let current = initialState;
  const undoStack = [];
  const redoStack = [];

  function commit(nextState, label = 'edit') {
    if (nextState === current) return current;

    undoStack.push({ state: current, label });
    if (undoStack.length > limit) undoStack.shift();

    current = nextState;
    redoStack.length = 0;
    return current;
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return null;

    redoStack.push({ state: current, label: entry.label });
    current = entry.state;
    return current;
  }

  function redo() {
    const entry = redoStack.pop();
    if (!entry) return null;

    undoStack.push({ state: current, label: entry.label });
    current = entry.state;
    return current;
  }

  function getState() {
    return {
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoLabel: undoStack.at(-1)?.label ?? null,
      redoLabel: redoStack.at(-1)?.label ?? null,
      undoDepth: undoStack.length,
      redoDepth: redoStack.length,
    };
  }

  return {
    current: () => current,
    commit,
    undo,
    redo,
    getState,
  };
}
