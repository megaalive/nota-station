// Preset keymap R3 (§8.14). Binding memakai KeyboardEvent.code agar posisi fisik
// tetap stabil lintas layout. OpenMPT-like hanya memuat aksi yang benar-benar
// memiliki padanan fitur di NotaStation; jangan memalsukan shortcut yang belum didukung.

export const KEYMAP_PRESETS = Object.freeze(['songwriter', 'openmpt']);

const COMMON = Object.freeze([
  binding('ui.openPalette', 'KeyK', 'Ctrl+K', { ctrl: true }),
  binding('ui.showShortcuts', 'Slash', '?', { shift: true }),
]);

const PRESETS = Object.freeze({
  songwriter: Object.freeze([
    binding('playback.togglePlayStop', 'Space', 'Space'),
  ]),
  openmpt: Object.freeze([
    binding('playback.playPatternStart', 'F7', 'F7', { context: 'pattern' }),
    binding('playback.playPatternCursor', 'F7', 'Ctrl+F7', { ctrl: true, context: 'pattern' }),
    binding('audio.toggleActiveTrackMute', 'F10', 'F10', { context: 'pattern' }),
    binding('audio.toggleActiveTrackSolo', 'F10', 'Ctrl+F10', { ctrl: true, context: 'pattern' }),
    binding('playback.toggleLoop', 'F11', 'Shift+F11', { shift: true, context: 'pattern' }),
    binding('pattern.toggleEditMode', 'Space', 'Ctrl+Space', { ctrl: true, context: 'pattern' }),
  ]),
});

function binding(commandId, code, display, {
  ctrl = false,
  shift = false,
  alt = false,
  meta = false,
  context = 'global',
} = {}) {
  return Object.freeze({ commandId, code, display, ctrl, shift, alt, meta, context });
}

export function bindingsFor(preset, { context = 'global', includeCommon = true } = {}) {
  const resolved = KEYMAP_PRESETS.includes(preset) ? preset : 'songwriter';
  const items = [
    ...(includeCommon ? COMMON : []),
    ...PRESETS[resolved],
  ];
  return items.filter((item) => item.context === 'global' || item.context === context);
}

export function shortcutFor(commandId, preset, { context = 'pattern' } = {}) {
  return bindingsFor(preset, { context }).find((item) => item.commandId === commandId)?.display ?? null;
}

export function matchKeyBinding(event, preset, { context = 'global' } = {}) {
  return bindingsFor(preset, { context }).find((item) => (
    item.code === event.code
    && item.ctrl === Boolean(event.ctrlKey)
    && item.shift === Boolean(event.shiftKey)
    && item.alt === Boolean(event.altKey)
    && item.meta === Boolean(event.metaKey)
  )) ?? null;
}
