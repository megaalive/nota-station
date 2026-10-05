import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('demo timbre UAT', () => {
  test('delapan instrument demo memakai profile timbre yang berbeda', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(async () => {
      const {
        DEMO_TIMBRE_SIGNATURES,
        isDemoInstrument,
      } = await import('./src/audio/demo-voices.js');

      return {
        entries: Object.entries(DEMO_TIMBRE_SIGNATURES),
        factoryIsDemo: isDemoInstrument('factory.basic'),
      };
    });

    expect(result.entries).toHaveLength(8);
    expect(new Set(result.entries.map(([, signature]) => signature)).size).toBe(8);
    expect(result.entries.some(([, signature]) => signature.startsWith('noise:'))).toBe(true);
    expect(result.entries.some(([, signature]) => signature.includes('sawtooth'))).toBe(true);
    expect(result.entries.some(([, signature]) => signature.includes('square'))).toBe(true);
    expect(result.factoryIsDemo).toBe(false);
  });
});
