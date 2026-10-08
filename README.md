# NotaStation

Web Tracker Songwriting Workstation — static site untuk GitHub Pages.
Seluruh aplikasi berdiri di atas satu model musik kanonik, lalu diproyeksikan ke beberapa
tampilan sekaligus (Pattern, Piano Roll, Lyrics, Guitar, Score).

Status implementasi: **R3 — Kematangan editing tracker + struktur lagu: ACTIVE**. Implementasi teknis R2 sudah COMPLETE; moderated manual UX UAT T3 masih pending. R0 sudah CLOSED; implementasi R1 juga sudah selesai dengan manual audio/UX UAT tersisa.

Saat ini NotaStation sudah memiliki Pattern editor 8 channel default yang dapat diperluas sampai 32 channel logis × 64 row, transport/loop/metronome, undo/redo, debug JSON, Sound workspace, impor WAV + IndexedDB, editor Sample/Instrument, picker + global WAV drop, satu Drum Track polifonik dengan choke hi-hat, serta fondasi Order/reuse/clone Pattern, Song Map/Order List dengan Section, occurrence focus Song → Pattern → transport, dialog Section Baru/Clone/Pakai ulang, dan guard Pattern bersama dengan pilihan Edit semua/Jadikan unik, plus seleksi blok Pattern dengan copy/paste, transpose, insert/delete row, interpolasi velocity keyboard, serta proyeksi event off-grid dengan marker/kolom DLY, selector LPB projection-only, pencarian resolusi yang cocok, dan kuantisasi timing eksplisit yang dapat di-Undo, serta EffectEvent typed v0.1 dengan validator/scheduler deterministik, efek audible note delay/note cut/volume/pan/retrigger/sample offset/pitch slide/portamento/vibrato/arpeggio, dan progressive Pattern FX | PARAM editor, generalisasi instrument track polifonik dengan voice lane, serta runtime keymap Songwriter/OpenMPT-like dan overlay shortcut kontekstual `?`.

## Contoh lagu untuk belajar

Buka **[Malam Kota — Lagu Contoh](https://megaalive.github.io/nota-station/?template=learning-song)**
atau pilih **Lagu lengkap — Malam Kota (8 instrumen)** di layar sambutan.

Contoh orisinal 112 BPM ini berisi **8 channel**, 7 Pattern unik, dan 9 posisi
Song Map: Intro → Verse → Chorus → Bridge → Chorus → Outro. Drum Kit, bass,
keys poly, pad, arpeggio, lead, countermelodi, dan fill menggunakan suara bawaan
tanpa WAV eksternal. Chorus dipakai ulang agar terlihat manfaat Pattern reuse.

Di tab **Song**, tekan **▶ Putar lagu dari awal** untuk mendengar seluruh aransemen,
atau buka panel **Pelajari lagu ini (8 channel)** untuk latihan Mute/Solo, chord
poly, dan edit Pattern bersama. [Panduan lengkap](./docs/contoh-lagu.md).

## Menjalankan

```bash
npm install
npm test           # unit test (node:test, tanpa dependency)
npm run check      # gate ringan: syntax, console.log sisa, path absolut, meta CSP
npm run build      # rakit dist/
npm run test:browser   # Playwright Chromium + Firefox, menguji dist/ di subpath
```

Untuk lihat hasilnya di browser:

```bash
npm run build && node tools/serve.mjs   # http://127.0.0.1:8080/nota-station/
```

`BASE_PATH` dan `PORT` bisa diubah lewat env.

Smoke test hanya jalan terhadap URL yang benar-benar hidup, jadi wajib diberi `PAGE_URL`:

```bash
PAGE_URL="https://<user>.github.io/nota-station/" EXPECT_SHA="$(git rev-parse HEAD)" npm run test:smoke
```

Deployment Pages tidak memakai GitHub Actions. Jalankan gate lokal yang relevan, lalu:

```bash
npm run deploy
```

Perintah itu selalu menjalankan build terlebih dahulu, kemudian force-push isi `dist/`
ke branch artifact `gh-pages`. Source tetap di `main`; `gh-pages` bukan history source.

## Aturan kerja

Baca [`AGENTS.md`](./AGENTS.md) — aturan kerja & coding, termasuk aturan komentar
kode berbahasa Indonesia.

Spesifikasi ada di [`rencana-web-tracker-songwriting-workstation-v2.md`](./rencana-web-tracker-songwriting-workstation-v2.md)
(disingkat **PLAN.md** di dokumen aturan).

## Lisensi

Source code: [MIT](./LICENSE).

Factory sample `Basic`: **CC0-1.0**, dibuat khusus untuk NotaStation dari gelombang
sintetis pendek; lihat [assets/factory/LICENSE.txt](./assets/factory/LICENSE.txt).