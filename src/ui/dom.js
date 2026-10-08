// Helper DOM kecil yang dipakai seluruh UI kit. Sengaja tipis: kalau butuh
// virtual DOM atau framework, berarti lagi keliru (§3.2).

/**
 * Bikin elemen dengan atribut dalam satu panggilan, supaya view tetap enak dibaca.
 * `class`, `text`, `dataset`, `on` (event) punya jalan pintas masing-masing.
 */
export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
    else if (key === 'on') for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/** Selector fokus-able untuk focus trap (§8.19). */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Daftar elemen fokus-able di dalam root, urut dokumen. */
export function focusableWithin(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );
}

/**
 * Fokus terperangkap di dalam root sampai dilepas.
 *
 * Trap dibuat dengan sentinel di awal & akhir: saat Tab mencapai sentinel terakhir,
 * fokus diputar balik ke awal. Ini lebih andal daripada menahan Tab di setiap node,
 * yang rapuh kalau ada iframe atau elemen dinamis di tengah.
 */
export function trapFocus(root) {
  const start = el('span', { tabindex: '0', 'aria-hidden': 'true', class: 'focus-sentinel' });
  const end = el('span', { tabindex: '0', 'aria-hidden': 'true', class: 'focus-sentinel' });
  root.prepend(start);
  root.append(end);

  function onKeydown(event) {
    if (event.key !== 'Tab') return;
    if (event.target === end) {
      event.preventDefault();
      (focusableWithin(root)[0] ?? root).focus();
    } else if (event.target === start) {
      event.preventDefault();
      const items = focusableWithin(root);
      (items[items.length - 1] ?? root).focus();
    }
  }

  root.addEventListener('keydown', onKeydown);
  return () => {
    root.removeEventListener('keydown', onKeydown);
    start.remove();
    end.remove();
  };
}

/** Tutup saat klik di luar atau tekan Escape — perilaku dasar untuk popover/dialog. */
export function onDismiss(target, { onEscape = true, onOutside = true } = {}) {
  function onKey(event) {
    if (onEscape && event.key === 'Escape') target.dispatchEvent(new CustomEvent('request-close'));
  }
  function onPointer(event) {
    if (onOutside && !target.contains(event.target)) {
      target.dispatchEvent(new CustomEvent('request-close'));
    }
  }
  document.addEventListener('keydown', onKey);
  // Capture true: pointerdown jalan sebelum klik target ketutup, jadi popover
  // nggak flicker waktu mouse bergerak melintas.
  document.addEventListener('pointerdown', onPointer, true);
  return () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer, true);
  };
}