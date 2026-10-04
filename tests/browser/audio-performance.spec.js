import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('audio readiness R1-S10', () => {
  test('gestur tepercaya dapat mengaktifkan audio dan menjadwalkan 32 voice aktif', async ({ page }) => {
    await gotoApp(page);

    await page.evaluate(async () => {
      const { createAudioEngine } = await import('./src/audio/engine.js');
      const engine = createAudioEngine();
      const button = document.createElement('button');
      button.id = 'audio-32-voice-probe';
      button.textContent = 'probe';
      button.addEventListener('click', async () => {
        await engine.activate();
        await Promise.all(Array.from({ length: 32 }, (_, index) =>
          engine.preview(48 + (index % 24), 80)));
        window.__audioVoiceProbe = engine.getState();
        engine.stop();
      }, { once: true });
      document.body.append(button);
    });

    await page.locator('#audio-32-voice-probe').click();
    await expect.poll(() => page.evaluate(() => window.__audioVoiceProbe ?? null), {
      timeout: 5000,
    }).not.toBeNull();

    const state = await page.evaluate(() => window.__audioVoiceProbe);
    expect(state.sampleReady).toBe(true);
    expect(state.state).toBe('ready');
    expect(state.activeVoices).toBe(32);
    expect(['running', 'suspended']).toContain(state.contextState);
  });
});
