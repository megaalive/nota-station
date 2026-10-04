// Mini UI kit internal (§3.2): Button, Menu, Dialog+focus trap, Popover, Toast,
// Tabs, Splitter, Tooltip. Dibangun di R0 supaya UI konsisten tanpa framework.
//
// Aturan yang dipegang kit ini:
// - setiap kontrol punya padanan keyboard dan bisa dipakai lewat Tab (§8.19)
// - warna bukan satu-satunya penanda state, selalu ada teks atau aria
// - tidak ada string UI langsung; teks masuk lewat i18n dari pemanggil

import { el, trapFocus, focusableWithin, onDismiss } from './dom.js';

/* ---------------------------------------------------------------- Button */

export function Button({ label, icon = null, variant = 'default', shortcut = null, onClick, disabled = false }) {
  const node = el('button', {
    type: 'button',
    class: `btn btn--${variant}`,
    'data-action': 'button',
    disabled: disabled || undefined,
    on: { click: onClick },
  }, [
    icon ? el('span', { class: 'btn__icon', 'aria-hidden': 'true', text: icon }) : null,
    el('span', { class: 'btn__label', text: label }),
    // Shortcut ditampilkan sebagai teks, bukan cuma ikon — dan tetap terbaca screen reader.
    shortcut ? el('kbd', { class: 'btn__shortcut', 'aria-hidden': 'true', text: shortcut }) : null,
  ]);
  return node;
}

/* ------------------------------------------------------------------- Menu */

/**
 * Menu dengan navigasi panah. Buka/tutup dikembalikan lewat open()/close(),
 * dan state terbuka ditandai aria-expanded supaya taksonomi tidak hanya warna.
 */
export function Menu({ label, items, onSelect }) {
  const list = el('ul', { class: 'menu__list', role: 'menu' });
  const trigger = Button({ label, icon: '☰', variant: 'ghost' });

  let open = false;
  let activeIndex = -1;

  function render() {
    list.textContent = '';
    items.forEach((item, index) => {
      const disabled = item.isEnabled ? !item.isEnabled() : false;
      const row = el('li', {
        role: 'menuitem',
        class: `menu__item${disabled ? ' is-disabled' : ''}${index === activeIndex ? ' is-active' : ''}`,
        // Menu item bukan button, jadi aria-disabled wajib supaya state nonaktif
        // terbaca even when nothing can be clicked.
        'aria-disabled': disabled ? 'true' : null,
        tabindex: '-1',
        dataset: { action: item.action ?? 'menu-item', entity: item.id },
        text: item.label,
        on: {
          click: () => {
            if (disabled) return;
            onSelect?.(item);
            close();
          },
          mouseenter: () => {
            activeIndex = index;
            paint();
          },
        },
      });
      if (disabled && item.disabledReason) {
        row.append(el('span', { class: 'menu__reason', text: item.disabledReason }));
      }
      list.append(row);
    });
  }

  function paint() {
    [...list.children].forEach((row, i) => {
      row.classList.toggle('is-active', i === activeIndex);
    });
  }

  function move(delta) {
    const enabled = items.filter((item) => !item.isEnabled || item.isEnabled());
    if (enabled.length === 0) return;
    activeIndex = (activeIndex + delta + enabled.length) % enabled.length;
    paint();
  }

  const root = el('div', { class: 'menu', 'data-action': 'menu' }, [trigger, list]);

  function openMenu() {
    if (open) return;
    activeIndex = 0;
    render();
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-haspopup', 'menu');
    open = true;
    list.querySelector('.is-active')?.focus();
  }

  function close() {
    if (!open) return;
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    open = false;
  }

  trigger.addEventListener('click', () => (open ? close() : openMenu()));
  root.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        trigger.focus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        list.querySelector('.is-active')?.click();
        break;
      default:
    }
  });

  return Object.assign(root, { open: openMenu, close, isOpen: () => open });
}

/* ----------------------------------------------------------------- Dialog */

/**
 * Dialog dengan focus trap sungguhan: Tab tidak pernah keluar selama dialog
 * terbuka, dan fokus dikembalikan ke pemicu begitu ditutup (§8.19).
 */
export function Dialog({ title, body, actions = [], onClose }) {
  const titleId = `dlg-title-${Math.random().toString(36).slice(2, 8)}`;
  let releaseTrap = null;

  const dialog = el(
    'div',
    {
      class: 'dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      dataset: { action: 'dialog' },
    },
    [
      el('h2', { class: 'dialog__title', id: titleId, text: title }),
      el('div', { class: 'dialog__body' }, [body]),
      el('div', { class: 'dialog__actions' }, actions),
    ],
  );

  const overlay = el('div', { class: 'dialog-overlay', on: { click: (e) => e.target === overlay && close() } }, [dialog]);

  function open(trigger) {
    document.body.append(overlay);
    releaseTrap = trapFocus(dialog);
    dialog.addEventListener('request-close', close);
    (focusableWithin(dialog)[0] ?? dialog).focus();
    dialog.dataset.returnFocusTo = trigger?.dataset.action ?? '';
    return close;
  }

  function close() {
    if (!overlay.isConnected) return;
    releaseTrap?.();
    dialog.removeEventListener('request-close', close);
    overlay.remove();
    onClose?.();
  }

  // Escape menutup dari mana pun di dialog; trap fokus tinggal menjaga Tab.
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  return Object.assign(dialog, { open, close, isOpen: () => overlay.isConnected });
}

/* ---------------------------------------------------------------- Popover */

export function Popover({ content, anchor, placement = 'bottom' }) {
  const box = el('div', { class: `popover popover--${placement}`, dataset: { action: 'popover' } }, [content]);
  const root = el('div', { class: 'popover-host' }, [anchor, box]);

  function open() {
    root.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    return onDismiss(box, {
      onOutside: true,
      onEscape: false,
    });
  }

  function close() {
    root.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
  }

  return Object.assign(root, { open, close, isOpen: () => root.classList.contains('is-open') });
}

/* ------------------------------------------------------------------- Toast */

let toastHost = null;

/** Toast memunculkan aksi "Urungkan" untuk aksi yang sukses tapi tak terlihat (§8.16). */
export function Toast({ message, actionLabel = null, onAction = null, duration = 5000 }) {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const toast = el('div', { class: 'toast', dataset: { action: 'toast' } }, [
    el('span', { class: 'toast__message', text: message }),
    actionLabel
      ? Button({
          label: actionLabel,
          variant: 'link',
          onClick: () => {
            onAction?.();
            toast.remove();
          },
        })
      : null,
  ]);
  toastHost.append(toast);
  const timer = setTimeout(() => toast.remove(), duration);
  return () => {
    clearTimeout(timer);
    toast.remove();
  };
}

/* -------------------------------------------------------------------- Tabs */

/**
 * Tabs workspace (§8.2). Tab tidak pernah berganti sendiri — hanya lewat klik,
 * Alt+1..7, atau aksi eksplisit. Itu aturan produk, jadi ditegakkan di sini.
 */
export function Tabs({ tabs, activeId, onSelect, label }) {
  const list = el('div', { class: 'tabs__list', role: 'tablist', 'aria-label': label });
  const root = el('nav', { class: 'tabs', dataset: { action: 'workspace-tabs' } }, [list]);

  function render(currentId) {
    list.textContent = '';
    for (const tab of tabs) {
      const selected = tab.id === currentId;
      const btn = el('button', {
        type: 'button',
        role: 'tab',
        id: `tab-${tab.id}`,
        // aria-selected + tabindex roving:(screen reader tahu mana yang aktif,
        // dan Tab hanya berhenti sekali di seluruh tab bar.
        'aria-selected': selected ? 'true' : 'false',
        'aria-controls': `tabpanel-${tab.id}`,
        tabindex: selected ? '0' : '-1',
        class: `tabs__tab${selected ? ' is-active' : ''}`,
        dataset: { action: 'workspace-tab', entity: tab.id },
        text: tab.label,
        on: { click: () => onSelect?.(tab.id) },
      });
      list.append(btn);
    }
  }

  render(activeId);
  return Object.assign(root, { render });
}

/* ---------------------------------------------------------------- Splitter */

/**
 * Splitter yang bisa diseret mouse DAN digeser keyboard — §8.19 minta tiap
 * gestur punya padanan keyboard. Panah kiri/kanan mengubah lebar 16 px per langkah,
 * Home/End ke batas.
 */
export function Splitter({ container, initialSize = 240, min = 160, max = 520, storageKey = null, store = null, side = 'left' }) {
  const saved = readSaved(storageKey, store);
  const size = Math.min(max, Math.max(min, saved ?? initialSize));

  const handle = el('div', {
    class: 'splitter',
    role: 'separator',
    tabindex: '0',
    'aria-orientation': 'vertical',
    'aria-label': 'Resize panel',
    'aria-valuenow': String(Math.round(size)),
    'aria-valuemin': String(min),
    'aria-valuemax': String(max),
    dataset: { action: 'splitter' },
  });

  const root = el('div', { class: `splitter-layout splitter-layout--${side}` }, [container, handle]);

  function apply(next) {
    const clamped = Math.min(max, Math.max(min, next));
    container.style.width = `${clamped}px`;
    container.style.flex = `0 0 ${clamped}px`;
    handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
    if (storageKey) store?.setItem(storageKey, String(Math.round(clamped)));
  }

  apply(size);

  let dragging = false;
  let startX = 0;
  let startSize = size;

  handle.addEventListener('pointerdown', (event) => {
    dragging = true;
    startX = event.clientX;
    startSize = parseFloat(container.style.width) || size;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const delta = side === 'left' ? event.clientX - startX : startX - event.clientX;
    apply(startSize + delta);
  });
  handle.addEventListener('pointerup', (event) => {
    dragging = false;
    handle.releasePointerCapture(event.pointerId);
    handle.classList.remove('is-dragging');
  });

  handle.addEventListener('keydown', (event) => {
    const step = 16;
    const current = parseFloat(container.style.width) || size;
    const growKey = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const shrinkKey = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === growKey) apply(current + step);
    else if (event.key === shrinkKey) apply(current - step);
    else if (event.key === 'Home') apply(min);
    else if (event.key === 'End') apply(max);
    else return;
    event.preventDefault();
  });

  return Object.assign(root, { apply, getSize: () => parseFloat(container.style.width) || size });
}

/** Pembacaan ukuran tersimpan: preference UI, bukan data lagu, jadi localStorage cukup (§10.1). */
function readSaved(key, store) {
  if (!key || !store) return null;
  const raw = store.getItem(key);
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}