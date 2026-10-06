import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Retrigger + sample offset audio R3-S8E', () => {
  test('offset dan retrigger terdengar deterministik pada OfflineAudioContext', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const { patternEventTemplates } = await import('./src/audio/scheduler.js');
      const { sampleOffsetSeconds } = await import('./src/audio/source-note-effects.js');
      const { scheduleSourceCut } = await import('./src/audio/timing-effects.js');

      const pattern = {
        lengthTicks: 960,
        notes: [{
          id: 'note-offline-source',
          trackId: 'track-source',
          startTickLocal: 0,
          durationTicks: 288,
          pitch: 60,
          velocity: 100,
        }],
        effects: [
          {
            id: 'fx-rtr-offline',
            trackId: 'track-source',
            tickLocal: 0,
            type: 'retrigger',
            value: { intervalTicks: 96, count: 2 },
          },
          {
            id: 'fx-off-offline',
            trackId: 'track-source',
            tickLocal: 0,
            type: 'offset',
            value: { frames: 4800 },
          },
        ],
      };

      const events = patternEventTemplates(pattern, 120);
      const sampleRate = 48000;
      const context = new OfflineAudioContext(1, Math.floor(sampleRate * 0.4), sampleRate);
      const buffer = context.createBuffer(1, Math.floor(sampleRate * 0.5), sampleRate);
      const data = buffer.getChannelData(0);
      data.fill(0);
      data.fill(0.5, 4800, 7200);

      let previous = null;
      for (const event of events) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        const when = event.offsetSeconds;

        if (previous) {
          scheduleSourceCut(previous, { when, currentTime: 0 });
        }

        const offsetSeconds = sampleOffsetSeconds(
          event.sampleOffsetFrames,
          buffer.sampleRate,
          buffer.duration,
        );
        source.start(when, offsetSeconds);
        source.stop(when + event.durationSeconds);
        previous = source;
      }

      const rendered = await context.startRendering();
      const output = rendered.getChannelData(0);
      const rms = (startSeconds, endSeconds) => {
        const start = Math.floor(sampleRate * startSeconds);
        const end = Math.floor(sampleRate * endSeconds);
        let sum = 0;
        let count = 0;
        for (let index = start; index < end; index += 1) {
          sum += output[index] * output[index];
          count += 1;
        }
        return Math.sqrt(sum / Math.max(1, count));
      };

      return {
        starts: events.map((event) => event.offsetSeconds),
        retriggers: events.map((event) => event.retriggerIndex),
        offsets: events.map((event) => event.sampleOffsetFrames),
        firstHit: rms(0.01, 0.04),
        firstTail: rms(0.07, 0.095),
        secondHit: rms(0.11, 0.14),
        thirdHit: rms(0.21, 0.24),
      };
    });

    expect(result.starts[0]).toBeCloseTo(0, 6);
    expect(result.starts[1]).toBeCloseTo(0.1, 6);
    expect(result.starts[2]).toBeCloseTo(0.2, 6);
    expect(result.retriggers).toEqual([0, 1, 2]);
    expect(result.offsets).toEqual([4800, 4800, 4800]);
    expect(result.firstHit).toBeGreaterThan(0.1);
    expect(result.firstTail).toBeLessThan(0.001);
    expect(result.secondHit).toBeGreaterThan(0.1);
    expect(result.thirdHit).toBeGreaterThan(0.1);
  });

  test('engine realtime me-restart source dan memakai offset tanpa memutasi NoteEvent', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'firefox',
      'Firefox headless GitHub Actions mempertahankan realtime AudioContext suspended; retrigger/offset audible tetap diuji lintas-browser lewat OfflineAudioContext.',
    );
    await gotoApp(page);

    const setup = await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
      const project = window.tracker.getProject();
      const patternId = project.song.order[0].patternId;
      const trackId = project.song.tracks[0].id;

      window.tracker.commands.execute('pattern.enterNote', {
        patternId,
        trackId,
        row: 0,
        pitch: 60,
        velocity: 100,
        durationTicks: 240,
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 0,
        type: 'retrigger',
        value: { intervalTicks: 30, count: 2 },
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 0,
        type: 'offset',
        value: { frames: 10 },
      });

      return { patternId, trackId };
    });

    await page.getByRole('button', { name: 'Putar' }).click();

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.contextState),
      { timeout: 5000 },
    ).toBe('running');
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.retriggerNotesScheduled),
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(2);
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.sampleOffsetNotesScheduled),
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(3);

    const audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.retriggerStopsScheduled).toBeGreaterThanOrEqual(2);
    expect(audio.sampleOffsetSilenced).toBe(0);

    await page.getByRole('button', { name: 'Berhenti' }).click();

    const canonical = await page.evaluate(({ patternId, trackId }) => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find((item) => item.id === patternId);
      const note = pattern.notes.find((item) => item.trackId === trackId);
      return {
        startTickLocal: note.startTickLocal,
        durationTicks: note.durationTicks,
        velocity: note.velocity,
        effects: pattern.effects.map((effect) => ({
          type: effect.type,
          tickLocal: effect.tickLocal,
          value: effect.value,
        })),
      };
    }, setup);

    expect(canonical.startTickLocal).toBe(0);
    expect(canonical.durationTicks).toBe(240);
    expect(canonical.velocity).toBe(100);
    expect(canonical.effects).toEqual([
      { type: 'retrigger', tickLocal: 0, value: { intervalTicks: 30, count: 2 } },
      { type: 'offset', tickLocal: 0, value: { frames: 10 } },
    ]);
  });
});
