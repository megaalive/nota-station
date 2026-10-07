import { bindingsFor } from '../core/keymap.js';
import { el } from './dom.js';
import { Button, Dialog } from './kit.js';

export function createShortcutOverlay({
  registry,
  t,
  getPreset,
  getActiveView,
  onSelectPreset,
}) {
  const body = el('div', { class: 'shortcut-help', dataset: { action: 'shortcut-help' } });
  let dialog;

  const closeButton = Button({
    label: t('shortcut.close'),
    variant: 'default',
    onClick: () => dialog.close(),
  });

  dialog = Dialog({
    title: t('shortcut.title'),
    body,
    actions: [closeButton],
  });
  dialog.dataset.action = 'shortcut-dialog';

  function render() {
    const preset = getPreset();
    const activeView = getActiveView?.() ?? 'global';
    const context = activeView === 'pattern' ? 'pattern' : 'global';
    const commands = new Map(registry.listCommands().map((command) => [command.id, command]));

    const presetControls = el('div', {
      class: 'shortcut-help__presets',
      role: 'group',
      'aria-label': t('shortcut.keymap'),
    }, [
      presetButton('songwriter', t('welcome.keymapSongwriter')),
      presetButton('openmpt', t('welcome.keymapOpenMpt')),
    ]);

    const rows = bindingsFor(preset, { context }).map((binding) => {
      const command = commands.get(binding.commandId);
      const enabled = command?.enabled !== false;
      return el('div', {
        class: `shortcut-help__row${enabled ? '' : ' is-disabled'}`,
        dataset: { action: 'shortcut-row', entity: binding.commandId },
      }, [
        el('kbd', { class: 'shortcut-help__key', text: binding.display }),
        el('span', {
          class: 'shortcut-help__label',
          text: command ? t(command.labelKey) : binding.commandId,
        }),
        !enabled && command?.disabledReason
          ? el('span', { class: 'shortcut-help__reason', text: command.disabledReason })
          : null,
      ]);
    });

    body.replaceChildren(
      el('div', { class: 'shortcut-help__head' }, [
        el('span', { text: t('shortcut.keymap') }),
        presetControls,
      ]),
      preset === 'openmpt'
        ? el('p', { class: 'shortcut-help__note', text: t('shortcut.openMptVerified') })
        : el('p', { class: 'shortcut-help__note', text: t('shortcut.songwriterNote') }),
      el('div', {
        class: 'shortcut-help__context',
        text: t('shortcut.context', { view: t(`tab.${activeView}`) }),
      }),
      el('div', { class: 'shortcut-help__list' }, rows),
    );

    function presetButton(id, label) {
      const button = Button({
        label,
        variant: preset === id ? 'default' : 'ghost',
        onClick: () => {
          if (id === getPreset()) return;
          onSelectPreset(id);
          render();
        },
      });
      button.dataset.action = 'shortcut-keymap';
      button.dataset.entity = id;
      button.setAttribute('aria-pressed', preset === id ? 'true' : 'false');
      return button;
    }
  }

  function open(trigger = null) {
    render();
    dialog.open(trigger);
  }

  return {
    open,
    close: () => dialog.close(),
    isOpen: () => dialog.isOpen(),
  };
}
