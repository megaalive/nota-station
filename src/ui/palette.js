// Command Palette (§8.14). Daftar perintahnya dibaca dari listCommands() — registry
// yang sama dengan menu dan hook agent, jadi tidak ada daftar kedua yang bisa basi.
//
// Menampilkan shortcut, status aktif/nonaktif, dan alasan nonaktif: kalau user
// mengetik-nama perintah yang nggak bisa dipakai, jawabannya harus kelihatan,
// bukan sekadar nggak ada.

import { el, focusableWithin } from './dom.js';
import { Button } from './kit.js';

/**
 * @param {object} options
 * @param {ReturnType<import('../core/commands.js').createCommandRegistry>} options.registry
 * @param {(key: string) => string} options.t fungsi i18n
 * @param {(id: string, args?: any) => any} [options.onRun]
 */
export function createPalette({ registry, t, onRun }) {
  let overlay = null;
  let input = null;
  let list = null;
  let activeIndex = 0;
  let entries = [];

  function matches(command, query) {
    if (!query) return true;
    const haystack = `${command.id} ${t(command.labelKey)} ${command.group}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function render() {
    const query = input.value.trim();
    entries = registry.listCommands().filter((c) => matches(c, query));
    // Command nonaktif tetap ditampilkan (dengan alasan), tidak disembunyikan —
    // "kalau tidak bisa dipakai" lebih membantu daripada perintah yang hilang (§8.14).
    if (entries.length > 0 && !entries.some((c) => c.id === entries[activeIndex]?.id)) {
      activeIndex = 0;
    }

    list.textContent = '';
    entries.forEach((command, index) => {
      const paletteEnabled = command.enabled && !command.requiresArgs;
      const paletteReason = !command.enabled
        ? command.disabledReason
        : (command.requiresArgs
          ? (command.requiresArgsReason ?? t('palette.requiresContext'))
          : null);
      const row = el(
        'div',
        {
          role: 'option',
          id: `palette-option-${index}`,
          'aria-selected': index === activeIndex ? 'true' : 'false',
          class: `palette__row${index === activeIndex ? ' is-active' : ''}${paletteEnabled ? '' : ' is-disabled'}`,
          'aria-disabled': paletteEnabled ? 'false' : 'true',
          dataset: { action: 'palette-item', entity: command.id },
          on: {
            click: () => run(index),
            mouseenter: () => {
              activeIndex = index;
              paint();
            },
          },
        },
        [
          el('span', { class: 'palette__label', text: t(command.labelKey) }),
          command.shortcut ? el('kbd', { class: 'palette__shortcut', text: command.shortcut }) : null,
          paletteEnabled ? null : el('span', { class: 'palette__reason', text: paletteReason ?? '' }),
        ],
      );
      list.append(row);
    });

    if (entries.length === 0) {
      list.append(el('div', { class: 'palette__empty', text: t('palette.noResults') }));
    }
    input.setAttribute('aria-activedescendant', entries.length ? `palette-option-${activeIndex}` : '');
  }

  function paint() {
    [...list.children].forEach((row, index) => {
      const isOption = row.getAttribute('role') === 'option';
      row.classList.toggle('is-active', isOption && index === activeIndex);
      row.setAttribute('aria-selected', isOption && index === activeIndex ? 'true' : 'false');
    });
    input.setAttribute('aria-activedescendant', entries.length ? `palette-option-${activeIndex}` : '');
    list.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }

  function run(index) {
    const command = entries[index];
    if (!command) return;
    if (!command.enabled || command.requiresArgs) {
      // Command kontekstual tetap discoverable, tetapi palette tidak menebak argumen
      // seperti pitch/sel. Jangan tutup supaya alasannya tetap terbaca.
      input.focus();
      return;
    }
    onRun?.(command);
    try {
      registry.execute(command.id);
    } catch (err) {
      // Galat dikembalikan ke user sebagai status, tidak dilempar ke console (§8.16).
      const reason = el('div', { class: 'palette__error', role: 'alert', text: `${command.id}: ${err.code ?? err.message}` });
      list.prepend(reason);
    }
    close();
  }

  function open() {
    if (overlay) return;
    input = el('input', {
      type: 'text',
      class: 'palette__input',
      placeholder: t('palette.placeholder'),
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': 'palette-list',
      'aria-autocomplete': 'list',
      autocomplete: 'off',
      dataset: { action: 'palette-input' },
      on: {
        input: () => {
          activeIndex = 0;
          render();
        },
      },
    });
    list = el('div', { class: 'palette__list', id: 'palette-list', role: 'listbox' });

    const box = el('div', { class: 'palette', dataset: { action: 'palette' } }, [
      el('div', { class: 'palette__search' }, [
        input,
        Button({ label: t('palette.close'), variant: 'ghost', shortcut: 'Esc', onClick: () => close() }),
      ]),
      list,
    ]);

    overlay = el('div', { class: 'palette-overlay', on: { click: (e) => e.target === overlay && close() } }, [box]);
    document.body.append(overlay);

    activeIndex = 0;
    render();

    box.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          activeIndex = (activeIndex + 1) % Math.max(entries.length, 1);
          paint();
          break;
        case 'ArrowUp':
          event.preventDefault();
          activeIndex = (activeIndex - 1 + entries.length) % Math.max(entries.length, 1);
          paint();
          break;
        case 'Enter':
          event.preventDefault();
          run(activeIndex);
          break;
        case 'Escape':
          event.preventDefault();
          close();
          break;
        case 'Tab':
          // Trap sederhana: Tab di dalam palette memutar fokus antar kontrol palette,
          // tidak pernah bocor ke halaman di belakang.
          event.preventDefault();
          const items = focusableWithin(box);
          const idx = items.indexOf(document.activeElement);
          items[(idx + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
          break;
        default:
      }
    });

    input.focus();
  }

  function close() {
    overlay?.remove();
    overlay = null;
    input = null;
    list = null;
    entries = [];
  }

  return { open, close, isOpen: () => Boolean(overlay) };
}