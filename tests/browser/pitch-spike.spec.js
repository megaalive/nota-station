import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Spike pitch AudioParam R1-S8', () => {
  test('playbackRate menerima slide, portamento, dan vibrato di AudioContext browser nyata', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const {
        schedulePitchSlide,
        schedulePortamento,
        scheduleVibrato,
      } = await import('./src/audio/pitch-spike.js');

      async function probe(kind) {
        const context = new OfflineAudioContext(1, 48000, 48000);
        const buffer = context.createBuffer(1, 48000, 48000);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = Math.sin(2 * Math.PI * 220 * i / 48000) * 0.1;
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);

        if (kind === 'slide') {
          schedulePitchSlide(source.playbackRate, {
            startTime: 0,
            duration: 0.5,
            fromSemitones: 0,
            toSemitones: 7,
          });
        } else if (kind === 'portamento') {
          schedulePortamento(source.playbackRate, {
            startTime: 0,
            duration: 0.5,
            fromPitch: 60,
            toPitch: 67,
          });
        } else {
          scheduleVibrato(source.playbackRate, {
            startTime: 0,
            duration: 0.8,
            depthSemitones: 0.5,
            frequencyHz: 5,
          });
        }

        source.start(0);
        const rendered = await context.startRendering();
        const output = rendered.getChannelData(0);
        let energy = 0;
        for (let i = 0; i < output.length; i += 256) energy += Math.abs(output[i]);
        return {
          automationRate: source.playbackRate.automationRate ?? null,
          energy,
        };
      }

      return {
        slide: await probe('slide'),
        portamento: await probe('portamento'),
        vibrato: await probe('vibrato'),
      };
    });

    for (const value of Object.values(result)) {
      expect(value.energy).toBeGreaterThan(0);
      if (value.automationRate !== null) expect(['a-rate', 'k-rate']).toContain(value.automationRate);
    }
  });
});
