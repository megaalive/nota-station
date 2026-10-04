# Changelog

Format singkat: satu entri per slice/PR yang menutup bagian dari milestone.
Milestone ditutup hanya bila Exit criteria di PLAN.md terpenuhi semua.

## R0 — Fondasi statis + UI shell

### Audit deployment setelah R0 — artifact branch (2026-10-04)

- Workflow Pages dan workflow browser GitHub Actions dihapus setelah full Playwright pada
  GitHub-hosted runner berulang kali hang sangat lama; masalah runner belum dinyatakan selesai.
- Deployment aktif sekarang: `main` = source, `gh-pages` = artifact. `npm run deploy`
  membangun `dist/` terbaru lalu `tools/deploy-pages.mjs` force-push artefak ke
  `gh-pages`.
- Smoke live tetap tersedia lewat `npm run test:smoke` dengan `PAGE_URL` dan
  `EXPECT_SHA`; ia tidak lagi dijalankan otomatis oleh workflow.
- Entri S2–S4 di bawah dipertahankan sebagai sejarah implementasi awal. Bagian workflow di
  sana **bukan lagi state aktif repository**.
- Penutupan R0 diaudit ulang terhadap state aktual sebelum R1 dimulai; keberadaan tes tidak
  dianggap bukti bahwa tes tersebut baru saja dijalankan.


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
- Tes: 16 unit test + 10 tes browser Playwright untuk boot di subpath.
- § terpenuhi: §3.2, §3.3, §3.4, §8.4, §9, §13.2, §16.1, §16.3.

### S2–S4 — Tutup R0: UI kit, shell §8.3, palette, Pages, smoke (selesai)

Empat temuan audit ditutup, plus Exit criteria R0.

**Temuan audit yang diselesaikan**

1. `.github/workflows/pages.yml` dibuat sesuai §13.3: build sekali di job `build`,
   job `browser` menguji artefak `dist` yang sama di subpath, job `deploy` hanya bila
   `github.ref == 'refs/heads/main'` **dan** bukan PR, job `smoke` menembak URL live
   dengan `EXPECT_SHA`. Semua action di-pin ke SHA yang diverifikasi dari tag remote
   GitHub (lihat tabel di bawah). Node 24 = LTS "Krypton"; 26 masih Current.
   PLAN.md §13.3 menyebut `checkout@v6` dan `setup-node@v4` — keduanya usang, jadi
   tidak ditiru (§13.3 melarang menyalin dari PLAN.md).

   | Action | Tag | SHA |
   |---|---|---|
   | actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
   | actions/setup-node | v7 | `820762786026740c76f36085b0efc47a31fe5020` |
   | actions/upload-artifact | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
   | actions/download-artifact | v8.0.1 | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` |
   | actions/configure-pages | v6 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
   | actions/upload-pages-artifact | v5 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
   | actions/deploy-pages | v5.0.1 | `368f82528645a54fb793d4d04e342629a3f51346` |

2. `playwright.smoke.config.js` + `tests/smoke/live.spec.js` dibuat (sebelumnya
   `package.json` memanggil file yang tidak ada). Smoke menolak jalan tanpa `PAGE_URL`,
   jadi tidak mungkin diam-diam menguji server lokal dan dianggap lulus.

3. `BASE_PATH` lokal diganti dari `/notastation/` ke `/nota-station/` (nama repo
   sebenarnya). Di CI tetap diturunkan dari `github.event.repository.name`, jadi rename
   repo tidak diam-diam menguji subpath yang salah. `tools/serve.mjs` ikut disamakan.

4. `lang` di `<html>` sekarang ditulis dari satu fungsi (`syncHtmlLang`) yang mengikuti
   i18n, dan **default diubah ke Indonesian** sesuai temuan audit.
   `role="application"` dipindahkan dari wrapper halaman — role itu hanya untuk elemen
   grid (§8.19); memakainya di level `<body>` membuat screen reader berhenti membaca
   struktur.

**Mini UI kit (§3.2, R0 wajib)** — `src/ui/dom.js` (helper + focus trap) dan
`src/ui/kit.js`: Button, Menu, Dialog + focus trap, Popover, Toast, Tabs, Splitter,
Tooltip. Splitter bisa diseret mouse **dan** digeser keyboard (§8.19).

**Shell §8.3** — `src/ui/shell.js`: top bar, tab workspace, panel kiri, area kerja,
panel kanan, dock terlipat, status bar. Ukuran panel disimpan di `localStorage` dan
dipulihkan saat reload.

**Command Palette** — `src/ui/palette.js`, sumber data tunggal `listCommands()`. Menampilkan
shortcut, status aktif/nonaktif, dan alasan nonaktif. Perintah nonaktif yang ditekan Enter
tidak menutup palette, supaya alasannya bisa dibaca.

**Perubahan lain**

- `src/i18n/index.js` → `src/i18n/messages.js`, dengan `translate()` yang bisa diuji
  terpisah dan tes penjaga bahwa kedua locale punya key yang sama.
- Tes: 17 unit + 48 browser (Chromium + Firefox) + 7 smoke.
- Bug nyata yang tertangkap dan diperbaiki: `page.waitForFunction()` diblokir CSP
  `script-src 'self'` di Firefox (diganti menunggu lewat locator, tanpa eval),
  `tools/serve.mjs` masih default `/`, smoke test memaksa `https://` sehingga tidak bisa
  diverifikasi lokal, smoke test membaca meta CSP sebelum navigasi, dan smoke test masih
  mencari `<h1>` yang sudah tidak ada setelah shell diganti.
- Timeout Playwright dinaikkan ke 60 detik dan worker dibatasi 4 — kegagalan reload di
  Firefox adalah tabrakan worker, bukan bug; assertion tidak dilonggarkan.

**§ terpenuhi**: §3.2, §3.3, §3.4, §8.2, §8.3, §8.5, §8.8, §8.13, §8.14, §8.15,
§8.16, §8.19, §9, §10.1, §13.1–§13.4, §16.1, §16.3.

**Yang belum dikerjakan ( disengaja)**: pattern editor, audio, sample — semuanya R1+.
Smoke test §13.4 yang menyebut audio, manifest factory sample, dan proyek baru tidak
diuji sekarang karena mengujinya berarti membangun fitur R1/R2 di luar jadwalnya.