import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPatternScheduleCursor,
  patternDurationSeconds,
  patternEventTemplates,
  secondsPerTick,
} from '../../src/audio/scheduler.js';

function patternFixture() {
  return {
    lengthTicks: 7680,
    notes: [
      {
        id: 'n2',
        trackId: 't1',
        startTickLocal: 480,
        durationTicks: 120,
        pitch: 64,
        velocity: 90,
      },
      {
        id: 'n1',
        trackId: 't1',
        startTickLocal: 0,
        durationTicks: 240,
        pitch: 60,
        velocity: 100,
      },
    ],
  };
}

test('tempo 120 BPM dengan PPQ 480 menghasilkan timing Pattern deterministik', () => {
  const pattern = patternFixture();
  assert.equal(secondsPerTick(120), 1 / 960);
  assert.equal(patternDurationSeconds(pattern, 120), 8);

  const events = patternEventTemplates(pattern, 120);
  assert.deepEqual(events.map((event) => event.id), ['n1', 'n2']);
  assert.equal(events[0].offsetSeconds, 0);
  assert.equal(events[0].durationSeconds, 0.25);
  assert.equal(events[1].offsetSeconds, 0.5);
  assert.equal(events[1].durationSeconds, 0.125);
});

test('cursor hanya mengeluarkan event sampai horizon dan tidak menduplikasi', () => {
  const cursor = createPatternScheduleCursor(patternFixture(), 120);
  const anchor = 10;

  assert.deepEqual(cursor.drainUntil(anchor, 10.1).map((event) => event.id), ['n1']);
  assert.deepEqual(cursor.drainUntil(anchor, 10.6).map((event) => event.id), ['n2']);
  assert.deepEqual(cursor.drainUntil(anchor, 20), []);
  assert.equal(cursor.isExhausted(), true);
});

test('loop dihitung dari anchor + cycle * durasi tanpa drift akumulatif', () => {
  const pattern = {
    lengthTicks: 7680,
    notes: [{
      id: 'n1',
      trackId: 't1',
      startTickLocal: 0,
      durationTicks: 120,
      pitch: 60,
      velocity: 100,
    }],
  };
  const cursor = createPatternScheduleCursor(pattern, 120, { loop: true });
  const anchor = 3.25;
  const due = cursor.drainUntil(anchor, anchor + 16.01);

  assert.deepEqual(due.map((event) => event.cycle), [0, 1, 2]);
  assert.deepEqual(due.map((event) => event.when), [3.25, 11.25, 19.25]);
});

test('loop dapat dimatikan sebelum cycle berikutnya dijadwalkan', () => {
  const pattern = {
    lengthTicks: 7680,
    notes: [{
      id: 'n1',
      trackId: 't1',
      startTickLocal: 0,
      durationTicks: 120,
      pitch: 60,
      velocity: 100,
    }],
  };
  const cursor = createPatternScheduleCursor(pattern, 120, { loop: true });
  const anchor = 1;

  assert.equal(cursor.drainUntil(anchor, 1.1).length, 1);
  cursor.setLoop(false);
  assert.deepEqual(cursor.drainUntil(anchor, 20), []);
  assert.equal(cursor.isExhausted(), true);
});
