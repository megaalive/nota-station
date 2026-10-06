import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Timing FX audio R3-S8B', () => {
  test('scheduleSourceCut benar-benar memotong sumber pada OfflineAudioContext', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const { scheduleSourceCut } = await import('./src/audio/timing-effects.js');
      const sampleRate = 48000;
      const context = new OfflineAudioContext(1, sampleRate, sampleRate);
      const buffer = context.createBuffer(1, sampleRate, sampleRate);
      buffer.getChannelData(0).fill(0.5);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
      scheduleSourceCut(source, {
        when: 0.1,
        currentTime: 0,
      });

      const rendered = await context.startRendering();
      const data = rendered.getChannelData(0);
      const rms = (start, end) => {
        let sum = 0;
        let count = 0;
        for (let i = start; i < end; i += 1) {
          sum += data[i] * data[i];
          count += 1;
        }
        return Math.sqrt(sum / Math.max(1, count));
      };

      return {
        before: rms(0, Math.floor(sampleRate * 0.08)),
        after: rms(Math.floor(sampleRate * 0.2), Math.floor(sampleRate * 0.4)),
      };
    });

    expect(result.before).toBeGreaterThan(0.1);
    expect(result.after).toBeLessThan(0.001);
  });

  test('engine menerapkan delay onset dan cut pada playback nyata', async ({ page }) => {
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
