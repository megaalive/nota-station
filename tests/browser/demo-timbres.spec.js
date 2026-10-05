import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('demo timbre UAT', () => {
  test('delapan instrument demo merender fingerprint audio yang berbeda', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const { scheduleDemoVoice } = await import('./src/audio/demo-voices.js');
      const ids = [
        'demo.kick', 'demo.snare', 'demo.hat', 'demo.bass',
        'demo.arp', 'demo.lead', 'demo.harmony', 'demo.fill',
      ];

      async function fingerprint(instrumentId) {
        const rate = 24000;
        const context = new OfflineAudioContext(2, rate, rate / 2);
        scheduleDemoVoice(context, {
          instrumentId,
          pitch: 60,
          velocity: 100,
          when: 0.01,
          durationSeconds: 0.13,
        });
        const rendered = await context.startRendering();
        const left = rendered.getChannelData(0);
        const right = rendered.getChannelData(1);

        let energy = 0;
        let diff = 0;
        let stereo = 0;
        for (let i = 1; i < left.length; i += 16) {
          energy += Math.abs(left[i]) + Math.abs(right[i]);
          diff += Math.abs(left[i] - left[i - 1]);
          stereo += Math.abs(left[i] - right[i]);
        }
        return [
          Number(energy.toFixed(4)),
          Number(diff.toFixed(4)),
          Number(stereo.toFixed(4)),
        ];
      }

      const entries = [];
      for (const id of ids) entries.push([id, await fingerprint(id)]);
      return entries;
    });

    expect(result).toHaveLength(8);
    for (const [, fingerprint] of result) expect(fingerprint[0]).toBeGreaterThan(0);

    // Fingerprint kasar energy/transient/stereo cukup untuk menangkap kasus semua
    // instrument tak sengaja kembali memakai factory.basic yang identik.
    const unique = new Set(result.map(([, fp]) => fp.join('|')));
    expect(unique.size).toBe(8);
  });
});
