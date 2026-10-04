# Changelog

Format singkat: satu entri per slice/PR yang menutup bagian dari milestone.
Milestone ditutup hanya bila Exit criteria di PLAN.md terpenuhi semua.

## R1 — Tracker yang bisa dimainkan (ACTIVE)

### S4 — Scheduler look-ahead + tempo + loop Pattern (PASS)

- Playback Pattern dipindahkan dari "jadwalkan semua sekali" ke scheduler look-ahead
  berbasis `AudioContext.currentTime`: horizon 120 ms, wake 25 ms. `setInterval`
  hanya membangunkan scheduler; waktu musikal tetap dihitung dari audio clock.
- Cursor scheduler murni menghitung event dari `anchor + cycle × duration`, sehingga
  loop tidak mengakumulasi rounding. Mematikan loop di batas Pattern tidak membocorkan
  event cycle berikutnya.
- Tempo awal menjadi data project yang editable (20–300 BPM), immutable, satu transaksi
  history, dan ikut Undo/Redo. Mengubah tempo saat playback menghentikan playback pada
  S4; re-anchor live disisakan untuk slice live-edit scheduler.
- Topbar tidak lagi menampilkan placeholder key palsu. Ia menampilkan meter project nyata,
  input tempo ringkas, dan loop Pattern sebagai ikon `↻` dengan `aria-pressed` + tooltip.
- Audio state mengekspos anchor, duration, scheduler aktif, dan jumlah event terjadwal
  untuk regression/agent tanpa mengekspos `AudioContext`.
- Gate final: `npm ci` **0 vulnerability**, unit **35/35 PASS**, `npm run check` PASS,
  build **114.1 KiB PASS**, Playwright Chromium+Firefox **96/96 PASS** (47,1 dtk).
- **Belum menutup R1**: metronome, pause/seek, JSON debug import/export, live-edit
  re-anchor/cancel scheduler, pitch-effect spike, template, serta UAT/performance exit.

### S3 — Field editing + input ergonomics (PASS)

- `VOL` sekarang editable sebagai dua digit hex `00–7F`. Nibble pertama hanya
  preview UI (`5_`); transaksi project/history baru dibuat setelah digit kedua sehingga
  satu perubahan volume = satu Undo.
- `INST` memakai jalur input dua digit yang sama dan divalidasi terhadap daftar instrument.
  R1 masih punya satu instrument, jadi `01` adalah no-op yang benar dan index lain ditolak;
  tidak dibuat preset palsu hanya untuk mendemokan kolom.
- Model menambah `updateNoteAtCell` immutable dengan kode galat stabil untuk note,
  instrument, dan velocity invalid. Mutasi UI tetap melalui command `pattern.updateNote`.
- INST/VOL pada row kosong meminta NOTE lebih dulu; input setengah jadi dibuang saat
  cursor/mode/history berubah. Delete pada INST/VOL tetap tidak menghapus seluruh NoteEvent.
- Toolbar Pattern mendapat stepper ringkas `−/+` untuk oktaf dan step dengan accessible
  name + tooltip; tombol mengembalikan fokus ke grid. Step mendukung 0–16.
- Gate final: `npm ci` **0 vulnerability**, unit **30/30 PASS**, `npm run check` PASS,
  build **105.3 KiB PASS**, Playwright Chromium+Firefox **88/88 PASS** (35,8 dtk).
- Publish `8f5f7ba9…` ke Pages berhasil dan live smoke S3 **10/10 PASS**.
- **Belum menutup R1**: transport tempo/loop/metronome/pause/seek, JSON debug
  import/export, live-edit scheduler penuh, pitch-effect spike, template, serta
  UAT/performance exit R1 tetap slice berikutnya.

### S2 — Editing Pattern + history transaksi (PASS)

- Grid Pattern diperluas menjadi 8 channel × `NOTE | INST | VOL` × 64 row tanpa
  membuang DOM windowing. Cursor bergerak per-field dan auto-scroll horizontal/vertikal;
  gutter serta header tetap frozen, sementara scroll terjadi di grid, bukan halaman.
- Mutasi note tetap melalui command layer. `Delete/Backspace` pada NOTE menjadi transaksi;
  Undo/Redo memakai snapshot immutable dengan redo branch yang benar, dan no-op tidak
  membuat history palsu.
- Command yang membutuhkan konteks editor tetap tampil di Command Palette tetapi tidak
  dieksekusi tanpa argumen sel/pitch.
- Safety review menutup kecelakaan penting: saat INST/VOL masih read-only pada S2,
  Delete/Backspace di field tersebut tidak boleh menghapus seluruh NoteEvent.
- Gate final setelah koreksi safety: `npm ci` **0 vulnerability**, unit **28/28 PASS**,
  `npm run check` PASS, build **97.1 KiB PASS**, Playwright Chromium+Firefox
  **80/80 PASS** (32,6 dtk).
- Publish `ac536262…` ke Pages berhasil dan live smoke R1-S2 **9/9 PASS**.
- **Belum menutup R1**: editing nilai INST/VOL, transport tempo/loop/metronome/pause/seek,
  JSON debug import/export, live-edit scheduler penuh, pitch-effect spike, template,
  serta UAT/performance exit R1 tetap pekerjaan slice berikutnya.

### S1 — Vertical slice Pattern → NoteEvent → Web Audio (PASS)

- Model minimum dibuat sesuai PLAN V2: PPQ 480, 8 `Track`, Pattern 64 row
  (LPB 4 / 120 tick per row), satu `OrderEntry`, dan `NoteEvent` pattern-local.
  Schema `Track` dikunci ke `color`, `kind`, `defaultInstrumentId`, dan
  `polyphony`; nama sementara `voiceMode` dibuang sebelum masuk `main`.
- Pattern editor pertama memakai DOM windowing, header 8 channel, kursor keyboard,
  mapping note berbasis `KeyboardEvent.code`, oktaf, step, serta mode awal
  **AUDISI** untuk workflow Songwriter. `Ctrl+E` masuk EDIT; note ditulis hanya
  melalui command `pattern.enterNote`.
- Factory sound `Basic` dibuat oleh proyek sendiri dan dilisensikan CC0-1.0.
  Audio engine memakai `AudioContext.currentTime`; Play menjadwalkan NoteEvent dari
  satu anchor audio clock, Stop membersihkan voice aktif.
- Firefox headless menemukan kasus `AudioContext.resume()` yang promise-nya dapat
  tetap pending. Engine tetap meminta resume pada gestur tepercaya, tetapi scheduler
  tidak lagi diblokir oleh penyelesaian promise itu; node audio boleh dijadwalkan
  selama context menunggu transisi ke `running`.
- Gate final slice: `npm ci` **0 vulnerability**, unit **22/22 PASS**,
  `npm run check` PASS, build **85.4 KiB PASS**, Playwright Chromium+Firefox
  **68/68 PASS** (27,0 dtk).
- Live smoke diperluas setelah publish: boot/subpath/CSP/build metadata + project baru,
  input NoteEvent, serta Play/Stop factory sound dari gestur pengguna — **9/9 PASS**.
- Workflow verifikasi hanya sementara dan dihapus kembali sebelum merge.
- **Belum menutup R1**: NOTE/INST/VOL lengkap, loop/metronome, seek/pause, undo/redo,
  JSON debug import/export, live-edit scheduler penuh, pitch-effect spike, template,
  dan UAT exit R1 tetap pekerjaan slice berikutnya.

## Review arsitektur sebelum R1 — anchor event + mode Pattern

- Aturan model dipersempit ke hal yang benar-benar wajib: **tidak ada absolute song tick**.
  Event di-anchor ke Pattern atau OrderEntry/occurrence sesuai semantik.
- `OrderEntry.overlays` bertipe dicadangkan untuk variasi occurrence seperti chord/tempo
  yang tidak seharusnya memaksa clone seluruh pattern. Overlay belum menjadi scope R1.
- Mode awal Pattern mengikuti workflow: Tracker/OpenMPT-like → EDIT; Songwriter/default
  → AUDISI. `Ctrl+E` dan badge tetap menjadi perpindahan eksplisit.
- `AGENTS.md` diselaraskan agar implementasi R1 tidak dipaksa kembali ke asumsi
  "semua event pattern-lokal".


## R0 — Fondasi statis + UI shell

### Closure audit — PASS (2026-10-04)

- Gap shell yang ditemukan saat audit ditutup: aktivasi tema terang/gelap/kontras tinggi,
  panel kiri/kanan dapat dilipat + persist, geometri wrapper Splitter, i18n yang benar-benar
  merender ulang shell, serta primitive Tooltip yang sebelumnya hanya disebut di kontrak.
- Toolbar atas dipadatkan: Play, Stop, dan Command Palette memakai ikon universal dengan
  accessible name + tooltip; tab workspace tetap memakai teks karena ikonnya lebih ambigu.
- Root cause hang GitHub runner: `@playwright/test 1.49.1` pada Node 24.21.0 hang sebelum
  suite browser mulai. Setelah dipin ke `1.63.0`, runner yang sama menyelesaikan suite normal.
- Gate final: `npm ci` PASS (0 vulnerability), unit **17/17 PASS**, `npm run check` PASS,
  build **58.1 KiB PASS**, Playwright Chromium+Firefox **56/56 PASS** (2 worker, 15.4 dtk).
- Workflow verifikasi hanya sementara dan dihapus kembali. Jalur deploy aktif tetap manual
  `main → npm run deploy → gh-pages` sesuai §13.
- R0 dinyatakan **CLOSED** setelah build closure ini dipublish dan smoke live cocok dengan SHA.


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