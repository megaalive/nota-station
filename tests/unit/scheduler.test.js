import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_EDIT_FREEZE_SECONDS,
  createEffectScheduleCursor,
  createMetronomeScheduleCursor,
  createPatternScheduleCursor,
  effectEventTemplates,
  isLiveEditMutable,
  liveEditFreezeTime,
  metronomeEventTemplates,
  patternDurationSeconds,
  patternEventTemplates,
  secondsPerTick,
  transportTickAtAudioTime,
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


test('seek memulai cursor dari tick lokal tanpa mengulang event sebelumnya', () => {
  const cursor = createPatternScheduleCursor(patternFixture(), 120, { startTick: 480 });
  const due = cursor.drainUntil(10, 10.01);
  assert.deepEqual(due.map((event) => event.id), ['n2']);
  assert.equal(due[0].when, 10);
});

test('posisi transport berasal dari audio clock dan wrap saat loop', () => {
  const common = { anchorAudioTime: 5, anchorTick: 480, tempo: 120, patternLengthTicks: 7680 };
  assert.equal(transportTickAtAudioTime({ ...common, nowAudioTime: 5.5 }), 960);
  assert.equal(transportTickAtAudioTime({ ...common, nowAudioTime: 13.5, loop: true }), 960);
  assert.equal(transportTickAtAudioTime({ ...common, nowAudioTime: 30, loop: false }), 7680);
});

test('EffectEvent timeline deterministik berdasarkan tick track type id', () => {
  const pattern = {
    ...patternFixture(),
    effects: [
      {
        id: 'fx-pan',
        trackId: 't2',
        tickLocal: 240,
        type: 'pan',
        value: { position: -32 },
      },
      {
        id: 'fx-volume',
        trackId: 't1',
        tickLocal: 120,
        type: 'volume',
        value: { level: 80 },
      },
      {
        id: 'fx-vibrato',
        trackId: 't1',
        tickLocal: 240,
        type: 'vibrato',
        value: { depthSemitones: 0.5, rateHz: 5 },
      },
    ],
  };

  const events = effectEventTemplates(pattern, 120);
  assert.deepEqual(
    events.map((event) => [event.id, event.startTickLocal, event.offsetSeconds]),
    [
      ['fx-volume', 120, 0.125],
      ['fx-vibrato', 240, 0.25],
      ['fx-pan', 240, 0.25],
    ],
  );
  assert.deepEqual(events[0].value, { level: 80 });
  assert.notEqual(events[0].value, pattern.effects[1].value);
});

test('EffectEvent cursor mendukung seek dan loop tanpa duplikasi', () => {
  const pattern = {
    ...patternFixture(),
    effects: [
      {
        id: 'fx-1',
        trackId: 't1',
        tickLocal: 120,
        type: 'volume',
        value: { level: 100 },
      },
      {
        id: 'fx-2',
        trackId: 't1',
        tickLocal: 480,
        type: 'pan',
        value: { position: 32 },
      },
    ],
  };
  const cursor = createEffectScheduleCursor(pattern, 120, {
    loop: true,
    startTick: 480,
  });

  assert.equal(cursor.eventCount, 2);
  const due = cursor.drainUntil(10, 18.01);
  assert.deepEqual(
    due.map((event) => [event.id, event.cycle, event.when]),
    [
      ['fx-2', 0, 10],
      ['fx-1', 1, 17.625],
    ],
  );
});

test('metronome mengikuti meter Pattern dan accent pada awal bar', () => {
  const pattern = { ...patternFixture(), meter: { num: 4, den: 4 } };
  const events = metronomeEventTemplates(pattern);
  assert.equal(events.length, 16);
  assert.deepEqual(
    events.filter((event) => event.accent).map((event) => event.startTickLocal),
    [0, 1920, 3840, 5760],
  );

  const cursor = createMetronomeScheduleCursor(pattern, 120, { startTick: 1920 });
  const due = cursor.drainUntil(3, 3.01);
  assert.equal(due[0].startTickLocal, 1920);
  assert.equal(due[0].accent, true);
});

test('100 loop tetap dihitung dari anchor tanpa drift progresif', () => {
  const pattern = {
    lengthTicks: 7680,
    notes: [{ id: 'n1', trackId: 't1', startTickLocal: 0, durationTicks: 120, pitch: 60, velocity: 100 }],
  };
  const cursor = createPatternScheduleCursor(pattern, 120, { loop: true });
  const anchor = 2.125;
  const due = cursor.drainUntil(anchor, anchor + 800.01);
  assert.equal(due.at(-1).cycle, 100);
  assert.equal(due.at(-1).when, anchor + 800);
});


test('live-edit freeze window tepat 30 ms: di bawahnya beku, batasnya mutable', () => {
  const now = 10;
  assert.equal(LIVE_EDIT_FREEZE_SECONDS, 0.03);
  assert.equal(liveEditFreezeTime(now), 10.03);
  assert.equal(isLiveEditMutable(10.029999, now), false);
  assert.equal(isLiveEditMutable(10.03, now), true);
  assert.equal(isLiveEditMutable(10.12, now), true);
});
