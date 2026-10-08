export function buildSongTimeline(project) {
  const patterns = new Map((project?.song?.patterns ?? []).map((pattern) => [pattern.id, pattern]));
  const entries = [];
  let cursor = 0;

  for (let orderIndex = 0; orderIndex < (project?.song?.order ?? []).length; orderIndex += 1) {
    const orderEntry = project.song.order[orderIndex];
    if (!orderEntry?.id) {
      throw timelineError('E_SONG_TIMELINE_ORDER_MISSING', 'OrderEntry tidak memiliki ID.');
    }
    const pattern = patterns.get(orderEntry.patternId);
    if (!pattern) {
      throw timelineError(
        'E_SONG_TIMELINE_PATTERN_MISSING',
        `Pattern tidak ditemukan untuk OrderEntry ${orderEntry.id}.`,
      );
    }
    if (!Number.isSafeInteger(pattern.lengthTicks) || pattern.lengthTicks <= 0) {
      throw timelineError(
        'E_SONG_TIMELINE_PATTERN_LENGTH',
        `Panjang Pattern tidak valid untuk OrderEntry ${orderEntry.id}.`,
      );
    }

    const startTickSong = cursor;
    cursor += pattern.lengthTicks;
    if (!Number.isSafeInteger(cursor)) {
      throw timelineError('E_SONG_TIMELINE_OVERFLOW', 'Panjang Song melewati batas tick aman.');
    }
    entries.push({
      orderEntryId: orderEntry.id,
      patternId: pattern.id,
      sectionId: orderEntry.sectionId ?? null,
      orderIndex,
      startTickSong,
      endTickSong: cursor,
      lengthTicks: pattern.lengthTicks,
    });
  }

  return { entries, totalTicks: cursor };
}

export function sectionRunStartIndex(project, orderEntryId) {
  const order = project?.song?.order ?? [];
  const index = order.findIndex((entry) => entry.id === orderEntryId);
  if (index < 0) {
    throw timelineError(
      'E_SONG_TIMELINE_ORDER_MISSING',
      `OrderEntry tidak ditemukan: ${orderEntryId}`,
    );
  }
  const sectionId = order[index].sectionId ?? null;
  if (sectionId === null) return index;

  let start = index;
  while (start > 0 && order[start - 1].sectionId === sectionId) start -= 1;
  return start;
}

export function songTickForOrderEntry(project, orderEntryId, tickLocal) {
  if (!Number.isFinite(tickLocal) || tickLocal < 0) {
    throw timelineError('E_SONG_TIMELINE_TICK_RANGE', 'Tick Pattern lokal di luar batas.');
  }
  const { entries } = buildSongTimeline(project);
  const entry = entries.find((item) => item.orderEntryId === orderEntryId);
  if (!entry) {
    throw timelineError(
      'E_SONG_TIMELINE_ORDER_MISSING',
      `OrderEntry tidak ditemukan: ${orderEntryId}`,
    );
  }
  if (tickLocal > entry.lengthTicks) {
    throw timelineError('E_SONG_TIMELINE_TICK_RANGE', 'Tick Pattern lokal di luar batas.');
  }
  return entry.startTickSong + tickLocal;
}

function timelineError(code, message) {
  const error = new Error(message);
  error.name = 'SongTimelineError';
  error.code = code;
  return error;
}
