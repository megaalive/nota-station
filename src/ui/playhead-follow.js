export function playheadFollowScrollTop({
  row,
  rowCount,
  rowHeight,
  headerHeight,
  clientHeight,
}) {
  for (const [name, value] of Object.entries({
    row,
    rowCount,
    rowHeight,
    headerHeight,
    clientHeight,
  })) {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${name} harus finite.`);
    }
  }
  if (!Number.isInteger(row) || !Number.isInteger(rowCount)) {
    throw new TypeError('row dan rowCount harus integer.');
  }
  if (rowCount <= 0 || row < 0 || row >= rowCount) {
    throw new RangeError('row playhead di luar Pattern.');
  }
  if (rowHeight <= 0 || headerHeight < 0 || clientHeight <= 0) {
    throw new RangeError('Geometri viewport playhead tidak valid.');
  }

  const viewportHeight = Math.max(rowHeight, clientHeight - headerHeight);
  const contentHeight = rowCount * rowHeight;
  const maxScrollTop = Math.max(0, contentHeight - viewportHeight);
  const rowCenter = row * rowHeight + rowHeight / 2;
  const viewportCenter = viewportHeight / 2;
  const centered = rowCenter - viewportCenter;

  return Math.max(0, Math.min(maxScrollTop, Math.round(centered)));
}
