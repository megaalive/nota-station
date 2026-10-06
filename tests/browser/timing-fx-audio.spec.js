import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Timing FX audio R3-S8B', () => {
  test('delay dan cut audible deterministik pada OfflineAudioContext', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const {
        cutEffectEventTemplates,
        patternEventTemplates,
      } = await import('./src/audio/scheduler.js');
      const { scheduleSourceCut } = await import('./src/audio/timing-effects.js');

      const pattern = {
        lengthTicks: 1920,
        notes: [{
          id: 'note-offline',
          trackId: 'track-offline',
          startTickLocal: 0,
          durationTicks: 960,
          pitch: 60,
          velocity: 100,
        }],
        effects: [
          {
            id: 'fx-delay-offline',
            trackId: 'track-offline',
            tickLocal: 0,
            type: 'delay',
            value: { ticks: 60 },
          },
          {
            id: 'fx-cut-offline',
            trackId: 'track-offline',
            tickLocal: 0,
            type: 'cut',
            value: { afterTicks: 180 },
          },
        ],
      };

      const [noteEvent] = patternEventTemplates(pattern, 120);
      const [cutEvent] = cutEffectEventTemplates(pattern, 120);
      const sampleRate = 48000;
      const context = new OfflineAudioContext(1, sampleRate, sampleRate);
      const buffer = context.createBuffer(1, sampleRate, sampleRate);
      buffer.getChannelData(0).fill(0.5);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(noteEvent.offsetSeconds);
      scheduleSourceCut(source, {
        when: cutEvent.offsetSeconds,
        currentTime: 0,
      });

      const rendered = await context.startRendering();
      const data = rendered.getChannelData(0);
      const rms = (startSeconds, endSeconds) => {
        const start = Math.floor(sampleRate * startSeconds);
        const end = Math.floor(sampleRate * endSeconds);
        let sum = 0;
        let count = 0;
        for (let i = start; i < end; i += 1) {
          sum += data[i] * data[i];
          count += 1;
        }
        return Math.sqrt(sum / Math.max(1, count));
      };

      return {
        delayTicks: noteEvent.delayTicks,
        noteOffset: noteEvent.offsetSeconds,
        cutTick: cutEvent.startTickLocal,
        cutOffset: cutEvent.offsetSeconds,
        before: rms(0.0, 0.04),
        sounding: rms(0.08, 0.15),
        after: rms(0.25, 0.35),
      };
    });

    expect(result.delayTicks).toBe(60);
    expect(result.cutTick).toBe(180);
    expect(result.noteOffset).toBeCloseTo(60 / 960, 6);
    expect(result.cutOffset).toBeCloseTo(180 / 960, 6);
    expect(result.before).toBeLessThan(0.001);
    expect(result.sounding).toBeGreaterThan(0.1);
    expect(result.after).toBeLessThan(0.001);
  });

  test('engine realtime menerapkan delay onset dan cut saat audio clock running', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'firefox',
      'Firefox headless GitHub Actions mempertahankan realtime AudioContext suspended; bukti audible lintas-browser ada pada OfflineAudioContext test.',
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
        durationTicks: 960,
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 0,
        type: 'delay',
        value: { ticks: 60 },
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 0,
        type: 'cut',
        value: { afterTicks: 180 },
      });
      return { patternId, trackId };
    });

    await page.getByRole('button', { name: 'Putar' }).click();

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.contextState),
      { timeout: 5000 },
    ).toBe('running');

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.notesScheduled),
      { timeout: 5000 },
    ).toBeGreaterThan(0);

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.cutEffectsScheduled),
      { timeout: 5000 },
    ).toBeGreaterThan(0);

    const audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.delayedNotesScheduled).toBeGreaterThan(0);
    expect(audio.cutStopsScheduled).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Berhenti' }).click();

    const canonical = await page.evaluate(({ patternId, trackId }) => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find((item) => item.id === patternId);
      const note = pattern.notes.find((item) => item.trackId === trackId);
      return {
        startTickLocal: note.startTickLocal,
        durationTicks: note.durationTicks,
      };
    }, setup);
    expect(canonical).toEqual({ startTickLocal: 0, durationTicks: 960 });
  });
});
