// Skeleton command layer (§9). Registry ini nanti jadi sumber tunggal buat menu,
// Command Palette, sama hook agent — jadi mulai sekarang, biar R1 tinggal nambah isi.

/**
 * @typedef {Object} CommandDef
 * @property {string} id
 * @property {string} group
 * @property {string} labelKey   // key i18n, bukan teks langsung
 * @property {string|(() => string|null)} [shortcut] // display; boleh dinamis mengikuti preset keymap
 * @property {boolean} [requiresArgs] // tetap discoverable, tetapi palette tidak mengeksekusi tanpa konteks
 * @property {string|(() => string)} [requiresArgsReason] // alasan spesifik bila palette butuh konteks
 * @property {() => boolean} [isEnabled]
 * @property {() => string} [disabledReason]
 * @property {(args?: any) => any} run
 */

/**
 * Registry command dengan kode galat stabil.
 * View tidak boleh menulis state langsung — semua mutasi lewat `run` di sini (§4 aturan 1).
 */
export function createCommandRegistry(initialCommands = []) {
  /** @type {Map<string, CommandDef>} */
  const commands = new Map();

  function register(def) {
    if (!def || typeof def.id !== 'string' || def.id === '') {
      throw commandError('E_CMD_INVALID', `Command tanpa id: ${JSON.stringify(def)}`);
    }
    if (typeof def.run !== 'function') {
      throw commandError('E_CMD_INVALID', `Command "${def.id}" tidak punya run()`);
    }
    if (def.requiresArgs !== undefined && typeof def.requiresArgs !== 'boolean') {
      throw commandError('E_CMD_INVALID', `Command "${def.id}" punya requiresArgs yang tidak valid`);
    }
    // labelKey wajib karena listCommands jadi sumber tunggal buat palette, menu,
    // sama overlay shortcut — command tanpa label nggak bisa ditemukan user.
    if (typeof def.labelKey !== 'string' || def.labelKey === '') {
      throw commandError('E_CMD_INVALID', `Command "${def.id}" tidak punya labelKey`);
    }
    if (commands.has(def.id)) {
      throw commandError('E_CMD_DUPLICATE', `Command "${def.id}" sudah terdaftar`);
    }
    commands.set(def.id, def);
    return def.id;
  }

  function registerAll(defs) {
    for (const def of defs) register(def);
  }

  /**
   * Sumber tunggal discoverability (§9): menu, palette, overlay shortcut, dan agent
   * semua baca dari sini. Hasilnya Serializable biar aman dipindah ke agent.
   */
  function listCommands() {
    return [...commands.values()].map((def) => {
      const enabled = def.isEnabled ? def.isEnabled() : true;
      const descriptor = {
        id: def.id,
        group: def.group,
        labelKey: def.labelKey,
        shortcut: typeof def.shortcut === 'function'
          ? (def.shortcut() ?? null)
          : (def.shortcut ?? null),
        requiresArgs: def.requiresArgs ?? false,
        enabled,
        disabledReason: enabled ? null : (def.disabledReason?.() ?? null),
      };
      const requiresArgsReason = typeof def.requiresArgsReason === 'function'
        ? def.requiresArgsReason()
        : (def.requiresArgsReason ?? null);
      if (requiresArgsReason) descriptor.requiresArgsReason = requiresArgsReason;
      return descriptor;
    });
  }

  function has(id) {
    return commands.has(id);
  }

  function get(id) {
    const def = commands.get(id);
    if (!def) throw commandError('E_CMD_NOT_FOUND', `Command tidak dikenal: ${id}`);
    return def;
  }

  function canRun(id) {
    const def = commands.get(id);
    if (!def) return false;
    return def.isEnabled ? def.isEnabled() : true;
  }

  function execute(id, args) {
    const def = get(id);
    if (!canRun(id)) {
      throw commandError('E_CMD_DISABLED', def.disabledReason?.() ?? `Command "${id}" sedang nonaktif`);
    }
    return def.run(args);
  }

  return { register, registerAll, listCommands, has, get, canRun, execute };
}

/** Galat dengan kode stabil supaya UI bisa bereaksi tanpa parsing pesan (§9, §8.16). */
export function commandError(code, message) {
  const err = new Error(message);
  err.name = 'CommandError';
  err.code = code;
  return err;
}