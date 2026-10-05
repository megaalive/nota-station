import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Drum Track voice lanes + choke R2-S9', () => {
  test('kick+snare+hat simultan pada satu track dan closed-hat choke open-hat', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await gotoApp(page);

    await page.evaluate(async () => {
      const {
        activePattern,
        configureDrumTrack,
        createBlankProject,
        enterVoiceNote,
      } = await import('./src/core/project.js');
      const {
        createDrumKitInstrument,
        createFactoryBasicSample,
      } = await import('./src/core/sound-model.js');
      const { createAudioEngine } = await import('./src/audio/engine.js');

      let seq = 0;
      let project = createBlankProject({
        idFactory: (prefix) => `${prefix}-drum-${++seq}`,
        now: () => '2026-10-05T11:10:00.000Z',
      });

      const base = createFactoryBasicSample();
      const drumSample = {
        ...base,
        id: 'factory.drum-sustain',
        name: 'Drum Sustain Fixture',
        loop: {
          enabled: true,
          startFrame: 100,
          endFrame: 1400,
          mode: 'forward',
        },
      };
      const kit = createDrumKitInstrument({
        id: 'instrument.drum-kit-browser',
        name: 'Browser Drum Kit',
        zones: [
          { note: 36, sampleId: drumSample.id, rootNote: 48, gain: 1.0 },
          { note: 38, sampleId: drumSample.id, rootNote: 60, gain: 0.8 },
          { note: 42, sampleId: drumSample.id, rootNote: 72, gain: 0.55, chokeGroup: 'hihat' },
          { note: 46, sampleId: drumSample.id, rootNote: 67, gain: 0.5, chokeGroup: 'hihat' },
        ],
      });

      project = {
        ...project,
        samples: [...project.samples, drumSample],
        instruments: [...project.instruments, kit],
      };

      const trackId = project.song.tracks[0].id;
      const patternId = project.song.patterns[0].id;
      const longNote = project.song.patterns[0].rowTicks * 8;
      project = configureDrumTrack(project, { trackId, instrumentId: kit.id });

      for (const [voiceLane, pitch] of [[0, 36], [1, 38], [2, 46]]) {
        project = enterVoiceNote(project, {
          patternId,
          trackId,
          row: 0,
          voiceLane,
          pitch,
          velocity: 100,
          durationTicks: longNote,
        });
      }
      project = enterVoiceNote(project, {
        patternId,
        trackId,
        row: 1,
        voiceLane: 2,
        pitch: 42,
        velocity: 90,
        durationTicks: longNote,
      });

      const engine = createAudioEngine();
      const button = document.createElement('button');
      button.id = 'drum-s9-play';
      button.textContent = 'play drum s9';
      button.addEventListener('click', async () => {
        await engine.playPattern(project, activePattern(project), { loop: false });
        window.__drumS9Started = true;
      });
      document.body.append(button);

      window.__drumS9Engine = engine;
      window.__drumS9Project = project;
      window.__drumS9TrackId = trackId;
    });

    await page.locator('#drum-s9-play').click();
    await expect.poll(
      () => page.evaluate(() => window.__drumS9Started ?? false),
      { timeout: 5000 },
    ).toBe(true);

    await expect.poll(
      () => page.evaluate(() => window.__drumS9Engine.getState().chokeStops),
      { timeout: 5000 },
    ).toBeGreaterThanOrEqual(1);

    const state = await page.evaluate(() => window.__drumS9Engine.getState());
    expect(state.lastChokeGroup).toBe('hihat');
    expect(state.notesScheduled).toBeGreaterThanOrEqual(4);
    expect(state.scheduledInstrumentIds).toContain('instrument.drum-kit-browser');

    const active = state.activeVoiceLanes
      .filter((voice) => voice.trackId === await page.evaluate(() => window.__drumS9TrackId));
    expect(active.some((voice) => voice.voiceLane === 0 && voice.pitch === 36)).toBe(true);
    expect(active.some((voice) => voice.voiceLane === 1 && voice.pitch === 38)).toBe(true);
    expect(active.some((voice) => voice.voiceLane === 2 && voice.pitch === 42)).toBe(true);
    expect(active.some((voice) => voice.voiceLane === 2 && voice.pitch === 46)).toBe(false);
    expect(errors).toEqual([]);

    await page.evaluate(() => window.__drumS9Engine.stop());
  });
});
