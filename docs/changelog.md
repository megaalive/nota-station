# Changelog

Format singkat: satu entri per slice/PR yang menutup bagian dari milestone.
Milestone ditutup hanya bila Exit criteria di PLAN.md terpenuhi semua.

## R0 — Fondasi statis + UI shell

### S1 — Infra build/test + app shell statis boot (selesai)

- Infra: `package.json` (gate `test`/`check`/`build`/`test:browser`/`test:smoke`),
  `tools/build.mjs` (build statis + validasi import relatif + `build.json` + `.nojekyll`),
  `tools/check.mjs` (gate ringan tanpa dependency), `tools/serve.mjs` (static server
  untuk tes di subpath), LICENSE MIT, `.gitignore`, README.
- Runtime: `index.html` (CSP meta, semua path relatif), `src/app.js` (boot, hook
  `window.tracker`), `src/i18n/index.js` (English default + Indonesia),
  `src/core/commands.js` (registry + `listCommands` + kode galat stabil),
  `styles/tokens.css` (tema terang/gelap/kontras tinggi + skala font),
  `styles/app.css`.
- Tes: 16 unit test (command layer, i18n, validasi import relatif) + 10 tes browser
  Playwright (Chromium + Firefox) untuk boot di subpath `/notastation/`.
- Keputusan checkpoint §20.2 dicatat di `docs/backlog.md`.
- § terpenuhi: §3.2, §3.3, §3.4, §8.4, §9, §13.2, §16.1, §16.3.
- Belum dikerjakan (sesuai rencana R0): mini UI kit, layout §8.3, Command Palette,
  workflow Pages, smoke pasca-deploy — 각각 S2, S3, S4.