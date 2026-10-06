import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Volume + pan FX audio R3-S8D', () => {
  test('volume dan pan terdengar deterministik pada OfflineAudioContext', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const {
        scheduleTrackMixEffect,
        scheduleTrackMixReset,
      } = await import('./src/audio/track-mix-effects.js');

      const sampleRate = 48000;
      const context = new OfflineAudioContext(2, sampleRate, sampleRate);
      const sourceBuffer = context.createBuffer(1, sampleRate, sampleRate);
      sourceBuffer.getChannelData(0).fill(0.5);

      const source = context.createBufferSource();
      const fxGain = context.createGain();
      const fxPanner = context.createStereoPanner();
      const bus = { fxGain, fxPanner };

      source.buffer = sourceBuffer;
      source.connect(fxGain);
      fxGain.connect(fxPanner);
      fxPanner.connect(context.destination);

      scheduleTrackMixReset(bus, { when: 0, currentTime: 0 });
      scheduleTrackMixEffect(bus, {
        type: 'volume',
        value: { level: 32 },
      }, {
        when: 0.2,
        currentTime: 0,
      });
      scheduleTrackMixEffect(bus, {
        type: 'pan',
        value: { position: 64 },
      }, {
        when: 0.4,
        currentTime: 0,
      });

      source.start(0);
      source.stop(0.8);

      const rendered = await context.startRendering();
      const left = rendered.getChannelData(0);
      const right = rendered.getChannelData(1);
      const rms = (data, startSeconds, endSeconds) => {
        const start = Math.floor(sampleRate * startSeconds);
        const end = Math.floor(sampleRate * endSeconds);
        let sum = 0;
        let count = 0;
        for (let index = start; index < end; index += 1) {
          sum += data[index] * data[index];
          count += 1;
        }
        return Math.sqrt(sum / Math.max(1, count));
      };

      return {
        centerLeft: rms(left, 0.08, 0.15),
        centerRight: rms(right, 0.08, 0.15),
        quietLeft: rms(left, 0.25, 0.35),
        quietRight: rms(right, 0.25, 0.35),
        hardRightLeft: rms(left, 0.5, 0.65),
        hardRightRight: rms(right, 0.5, 0.65),
      };
    });

    expect(Math.abs(result.centerLeft - result.centerRight)).toBeLessThan(0.01);
    expect(result.quietLeft).toBeLessThan(result.centerLeft * 0.4);
    expect(result.quietRight).toBeLessThan(result.centerRight * 0.4);
    expect(result.hardRightLeft).toBeLessThan(0.001);
    expect(result.hardRightRight).toBeGreaterThan(0.05);
  });

  test('engine realtime menjadwalkan volume dan pan tanpa memutasi NoteEvent', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'firefox',
      'Firefox headless GitHub Actions mempertahankan realtime AudioContext suspended; audible volume/pan tetap diuji lintas-browser lewat OfflineAudioContext.',
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
        durationTicks: 1920,
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 120,
        type: 'volume',
        value: { level: 32 },
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 240,
        type: 'pan',
        value: { position: 64 },
      });
      return { patternId, trackId };
    });

    await page.getByRole('button', { name: 'Putar' }).click();

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.contextState),
      { timeout: 5000 },
    ).toBe('running');
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.volumeEffectsScheduled),
      { timeout: 5000 },
    ).toBeGreaterThan(0);
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.panEffectsScheduled),
      { timeout: 5000 },
    ).toBeGreaterThan(0);

    const audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.mixEffectsScheduled).toBeGreaterThanOrEqual(2);
    expect(audio.mixResetsScheduled).toBeGreaterThan(0);

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
    expect(canonical.durationTicks).toBe(1920);
    expect(canonical.velocity).toBe(100);
    expect(canonical.effects).toEqual([
      { type: 'volume', tickLocal: 120, value: { level: 32 } },
      { type: 'pan', tickLocal: 240, value: { position: 64 } },
    ]);
  });
});
