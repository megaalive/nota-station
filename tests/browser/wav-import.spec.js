import { test, expect } from '@playwright/test';

import { waitForApp } from './helpers.js';

test.describe('WAV import foundation R2', () => {
  test('browser parse + SHA-256 + candidate import berjalan tanpa memutasi project', async ({ page }) => {
    await page.goto('./');
    await waitForApp(page);

    const result = await page.evaluate(async () => {
      const { parseWav, prepareWavImport } = await import('./src/io/wav-import.js');
      const project = window.tracker.getProject();
      const before = JSON.stringify(project);

      const channels = 1;
      const bits = 16;
      const sampleRate = 44100;
      const frames = 16;
      const blockAlign = channels * (bits / 8);
      const dataBytes = frames * blockAlign;
      const bytes = new Uint8Array(44 + dataBytes);
      const view = new DataView(bytes.buffer);

      const ascii = (offset, text) => {
        for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
      };

      ascii(0, 'RIFF');
      view.setUint32(4, bytes.length - 8, true);
      ascii(8, 'WAVE');
      ascii(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, channels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bits, true);
      ascii(36, 'data');
      view.setUint32(40, dataBytes, true);
      for (let i = 44; i < bytes.length; i += 1) bytes[i] = (i * 11) & 0xff;

      const wav = parseWav(bytes);
      let seq = 0;
      const prepared = await prepareWavImport(project, {
        bytes,
        sourceFilename: 'Browser_Test.wav',
        idFactory: (prefix) => `${prefix}-browser-${++seq}`,
      });

      return {
        wav,
        contentHash: prepared.contentHash,
        sample: prepared.sample,
        instrument: prepared.instrument,
        projectUnchanged: before === JSON.stringify(project),
      };
    });

    expect(result.wav.format).toBe('pcm');
    expect(result.wav.channels).toBe(1);
    expect(result.wav.sampleRate).toBe(44100);
    expect(result.wav.frameCount).toBe(16);
    expect(result.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.sample.storageRef.kind).toBe('indexeddb');
    expect(result.instrument.zones[0].sampleId).toBe(result.sample.id);
    expect(result.projectUnchanged).toBe(true);
  });
});
