import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Pitch slide + porta audio R3-S8F-A', () => {
  test('pitch slide dan porta mengubah frekuensi audible pada OfflineAudioContext', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const { scheduleFinitePitchEffect } = await import('./src/audio/pitch-effects.js');

      async function render(effect) {
        const sampleRate = 48000;
        const context = new OfflineAudioContext(1, sampleRate, sampleRate);
        const buffer = context.createBuffer(1, sampleRate, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i += 1) {
          data[i] = Math.sin(2 * Math.PI * 220 * i / sampleRate) * 0.5;
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(1, 0);
        source.connect(context.destination);

        scheduleFinitePitchEffect(source.playbackRate, effect, {
          when: 0,
          currentTime: 0,
          baseRate: 1,
          basePitch: 60,
          voiceEndTime: 0.8,
          tickSeconds: 1 / 960,
        });

        source.start(0);
        source.stop(0.8);
        const rendered = await context.startRendering();
        const output = rendered.getChannelData(0);

        const crossings = (startSeconds, endSeconds) => {
          const start = Math.floor(startSeconds * sampleRate);
          const end = Math.floor(endSeconds * sampleRate);
          let count = 0;
          for (let i = start + 1; i < end; i += 1) {
            if (output[i - 1] <= 0 && output[i] > 0) count += 1;
          }
          return count / Math.max(0.001, endSeconds - startSeconds);
        };

        return {
          earlyHz: crossings(0.03, 0.09),
          lateHz: crossings(0.34, 0.40),
        };
      }

      return {
        slide: await render({
          type: 'pitchSlide',
          value: { semitones: 12, durationTicks: 384 },
        }),
        porta: await render({
          type: 'porta',
          value: { targetPitch: 72, durationTicks: 384 },
        }),
      };
    });

    for (const value of Object.values(result)) {
      expect(value.earlyHz).toBeGreaterThan(180);
      expect(value.lateHz).toBeGreaterThan(value.earlyHz * 1.45);
    }
  });

  test('engine realtime menerapkan slide lalu porta tanpa memutasi NoteEvent', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'firefox',
      'Firefox headless GitHub Actions mempertahankan realtime AudioContext suspended; audible proof tetap berjalan di OfflineAudioContext.',
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
        durationTicks: 1440,
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 0,
        type: 'pitchSlide',
        value: { semitones: 7, durationTicks: 240 },
      });
      window.tracker.commands.execute('pattern.addEffect', {
        patternId,
        trackId,
        tickLocal: 480,
        type: 'porta',
        value: { targetPitch: 55, durationTicks: 240 },
      });

      return { patternId, trackId };
    });

    await page.getByRole('button', { name: 'Putar' }).click();

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.contextState),
      { timeout: 5000 },
    ).toBe('running');
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.pitchSlideEffectsScheduled),
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(1);
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.portaEffectsScheduled),
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(1);

    const audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.pitchEffectsScheduled).toBeGreaterThanOrEqual(2);
    expect(audio.pitchVoicesAutomated).toBeGreaterThanOrEqual(2);
    expect(audio.pitchUnsupportedVoices).toBe(0);

    await page.getByRole('button', { name: 'Berhenti' }).click();

    const canonical = await page.evaluate(({ patternId, trackId }) => {
      const project = window.tracker.getProject();
      const pattern = project.song.patterns.find((item) => item.id === patternId);
      const note = pattern.notes.find((item) => item.trackId === trackId);
      return {
        pitch: note.pitch,
        startTickLocal: note.startTickLocal,
        durationTicks: note.durationTicks,
        effects: pattern.effects.map((effect) => ({
          type: effect.type,
          tickLocal: effect.tickLocal,
          value: effect.value,
        })),
      };
    }, setup);

    expect(canonical).toEqual({
      pitch: 60,
      startTickLocal: 0,
      durationTicks: 1440,
      effects: [
        {
          type: 'pitchSlide',
          tickLocal: 0,
          value: { semitones: 7, durationTicks: 240 },
        },
        {
          type: 'porta',
          tickLocal: 480,
          value: { targetPitch: 55, durationTicks: 240 },
        },
      ],
    });
  });
});
