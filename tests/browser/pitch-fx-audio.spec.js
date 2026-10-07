import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Pitch FX audio R3-S8F', () => {
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

  test('vibrato dan arpeggio menghasilkan perubahan pitch audible berulang', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const { scheduleRepeatingPitchEffect } = await import('./src/audio/pitch-effects.js');

      async function render(effect, windows) {
        const sampleRate = 48000;
        const duration = 0.5;
        const context = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);
        const buffer = context.createBuffer(1, sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = Math.sin(2 * Math.PI * 220 * i / sampleRate) * 0.5;
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(1, 0);
        source.connect(context.destination);

        scheduleRepeatingPitchEffect(source.playbackRate, effect, {
          when: 0,
          currentTime: 0,
          baseRate: 1,
          basePitch: 60,
          voiceEndTime: duration,
          tickSeconds: 1 / 960,
        });

        source.start(0);
        source.stop(duration);
        const rendered = await context.startRendering();
        const output = rendered.getChannelData(0);

        const crossings = ([startSeconds, endSeconds]) => {
          const start = Math.floor(startSeconds * sampleRate);
          const end = Math.floor(endSeconds * sampleRate);
          let count = 0;
          for (let i = start + 1; i < end; i += 1) {
            if (output[i - 1] <= 0 && output[i] > 0) count += 1;
          }
          return count / Math.max(0.001, endSeconds - startSeconds);
        };

        return windows.map(crossings);
      }

      return {
        vibrato: await render(
          { type: 'vibrato', value: { depthSemitones: 3, rateHz: 5 } },
          [[0.04, 0.06], [0.14, 0.16]],
        ),
        arpeggio: await render(
          { type: 'arpeggio', value: { semitones: [0, 12], stepTicks: 120 } },
          [[0.04, 0.09], [0.17, 0.22]],
        ),
      };
    });

    expect(result.vibrato[0]).toBeGreaterThan(result.vibrato[1] * 1.25);
    expect(result.arpeggio[1]).toBeGreaterThan(result.arpeggio[0] * 1.7);
  });

  test('engine realtime merantai slide, porta, vibrato, dan arpeggio tanpa mutasi NoteEvent', async ({ page }, testInfo) => {
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
      const effects = [
        ['pitchSlide', 0, { semitones: 7, durationTicks: 240 }],
        ['retrigger', 0, { intervalTicks: 360, count: 1 }],
        ['porta', 120, { targetPitch: 55, durationTicks: 240 }],
        ['vibrato', 360, { depthSemitones: 1.5, rateHz: 5 }],
        ['arpeggio', 600, { semitones: [0, 4, 7], stepTicks: 120 }],
      ];
      for (const [type, tickLocal, value] of effects) {
        window.tracker.commands.execute('pattern.addEffect', {
          patternId,
          trackId,
          tickLocal,
          type,
          value,
        });
      }

      return { patternId, trackId };
    });

    await page.getByRole('button', { name: 'Putar' }).click();

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.contextState),
      { timeout: 5000 },
    ).toBe('running');
    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.arpeggioEffectsScheduled),
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(1);

    const audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.pitchSlideEffectsScheduled).toBeGreaterThanOrEqual(1);
    expect(audio.portaEffectsScheduled).toBeGreaterThanOrEqual(1);
    expect(audio.vibratoEffectsScheduled).toBeGreaterThanOrEqual(1);
    expect(audio.arpeggioEffectsScheduled).toBeGreaterThanOrEqual(1);
    expect(audio.retriggerNotesScheduled).toBeGreaterThanOrEqual(1);
    expect(audio.pitchEffectsScheduled).toBeGreaterThanOrEqual(4);
    expect(audio.pitchVoicesAutomated).toBeGreaterThanOrEqual(4);
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
        { type: 'pitchSlide', tickLocal: 0, value: { semitones: 7, durationTicks: 240 } },
        { type: 'retrigger', tickLocal: 0, value: { intervalTicks: 360, count: 1 } },
        { type: 'porta', tickLocal: 120, value: { targetPitch: 55, durationTicks: 240 } },
        { type: 'vibrato', tickLocal: 360, value: { depthSemitones: 1.5, rateHz: 5 } },
        { type: 'arpeggio', tickLocal: 600, value: { semitones: [0, 4, 7], stepTicks: 120 } },
      ],
    });
  });
});
