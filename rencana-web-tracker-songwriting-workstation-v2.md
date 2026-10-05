# Rencana Eksekusi V2 — Web Tracker Songwriting Workstation

> **Versi:** 2.0 (hasil audit V1 + perombakan UI/UX)
> **Status:** rencana implementasi yang dapat dieksekusi
> **Target hosting:** GitHub Pages (static site)
> **Baseline runtime:** HTML + CSS + JavaScript ES Modules + Web Audio API
> **Inspirasi UX:** OpenMPT / ModPlug Tracker (kecepatan keyboard, pattern + order, sample/instrument)
> **Prinsip:** *playable* lebih dulu, *mudah dipakai* sejak menit pertama, kompatibilitas dan AI menyusul

---

## 0. Tentang dokumen ini

### 0.1 Apa yang berubah dari V1

V1 kuat di fondasi teknis (model kanonik berbasis tick, command layer, theory engine sebelum LLM, WASM hanya dengan bukti). Audit menemukan **35 temuan (7 Tinggi, 19 Sedang, 9 Rendah)** (rinciannya di *Lampiran A*). Yang paling berdampak dan sudah diperbaiki di V2:

| # | Perubahan utama | Alasan singkat | Bagian |
|---|---|---|---|
| 1 | **Bab UI/UX ditulis ulang total** (workspace, fokus bersama, split view, lyric lane, command palette, onboarding, status/feedback, ukuran keberhasilan UX) | Layout V1 mencampur 4 hal di panel bawah, tanpa model fokus, tanpa onboarding | §8 |
| 2 | **Data musikal tidak lagi memakai absolute tick** (event di-anchor ke Pattern atau occurrence sesuai semantik; timeline absolut hanya hasil proyeksi) | Mengubah urutan pattern merusak chord/tempo di V1 | §5 |
| 3 | **Keputusan polifoni**: track punya *voice lane* | Channel tracker monofonik vs Piano Roll/gitar polifonik belum diputuskan | §5.4 |
| 4 | **Event off-grid punya proyeksi di Pattern** (resolusi tampilan + kolom DLY) | Note dari Piano Roll tidak boleh hilang/ter-kuantisasi diam-diam | §5.2, §8.6 |
| 5 | **`repeatCount` dihapus** dari OrderEntry | Membuat "occurrence" lirik ambigu | §5.5 |
| 6 | **Rilis dipecah ulang**: v0.1 = R0–R4 (tracker yang bisa dipakai & disimpan); R5 dipecah jadi R5a–R5d | v0.1 V1 mensyaratkan semua view sekaligus, terlalu jauh dari rilis pertama | §15, §18 |
| 7 | **Export WAV & MIDI sederhana dimajukan ke R4** | Murah, berguna untuk berbagi demo, dan jadi oracle tes | §15 |
| 8 | **Workflow CI diperbaiki** (build sekali, uji artefak yang sama, deploy hanya dari `main`) | YAML V1 build 2×, tidak menguji artefak yang dideploy | §13 |
| 9 | **Batas keamanan diberi angka**, strategi multi-tab & eviction storage | "bounded" tanpa angka tidak bisa diuji | §10 |
| 10 | **Kriteria UX terukur** (time-to-first-sound, uji tugas 5 orang) | V1 hanya punya kriteria fungsional | §8.20 |

### 0.2 Cara membaca

- Bagian yang **tidak berubah secara substansi** (theory engine, LLM, versioning) dipadatkan, bukan dihapus.
- Setiap keputusan baru memuat alasannya. Jika ada keputusan yang tidak Anda setujui, ubah di checklist §20 *sebelum* schema pertama dibuat.

---

## 1. Ringkasan keputusan

Proyek ini bukan DAW umum dan bukan clone OpenMPT di browser. Sasarannya adalah **tracker untuk songwriting**: tetap akrab bagi pengguna OpenMPT, tetapi juga **ramah bagi penulis lagu dan gitaris yang belum pernah memakai tracker**.

Satu model musik kanonik diproyeksikan ke **lima tampilan** yang selalu sinkron:

1. **Pattern / Tracker** — input cepat dan sequencing.
2. **Piano Roll** — pitch dan durasi secara geometris.
3. **Guitar** — TAB dan fretboard.
4. **Score** — notasi balok (hanya-baca pada awalnya).
5. **Lyrics** — layer sinkron terhadap note dan playback, bukan textarea terpisah.

Ditambah satu ruang kerja pendukung: **Sound** (sample & instrument), dan satu ruang ringkasan: **Song** (struktur lagu).

Tiga janji produk:

1. **Suara dalam ≤ 60 detik** sejak halaman dibuka (lewat template).
2. **Dua pintu masuk**: mode *Songwriter* (Piano Roll, Lyrics, Song Map) dan mode *Tracker* (Pattern, Order, keymap ala OpenMPT). Data sama, cara pandang beda.
3. **Tidak ada yang hilang diam-diam**: kuantisasi, pembulatan, atau pemotongan selalu terlihat dan bisa di-undo.

Sample dan instrument adalah inti. Baseline **tidak membutuhkan WebGPU atau WebAssembly**; `AudioWorklet` dan WASM hanya masuk berdasarkan bukti benchmark (§7.5–7.6).

Aplikasi harus dapat dibangun, diuji, dan dideploy sebagai static site ke GitHub Pages tanpa backend, database server, Node runtime di production, secret server-side, atau layanan wajib lain.

---

## 2. Definisi produk

### 2.1 Pengguna sasaran

| Persona | Ciri | Yang paling dibutuhkan |
|---|---|---|
| **P1 Veteran tracker** | Terbiasa OpenMPT/FT2, bekerja tanpa mouse | Kecepatan, keymap familiar, pattern + order, kolom FX |
| **P2 Penulis lagu / gitaris** | Berpikir dalam chord, lirik, posisi fret; tidak paham tracker | Piano Roll, lirik di atas melodi, TAB/fretboard, Song Map |
| **P3 Pendatang / pelajar** | Mencoba-coba | Template, tur singkat, istilah yang dijelaskan |

### 2.2 Masalah yang diselesaikan

Tracker tradisional cepat, tetapi lemah untuk: lirik yang terikat ke note/suku kata; membaca hasil sebagai notasi balok; berpikir dalam posisi gitar; mengedit durasi secara visual; generasi musik yang sadar aturan; dan interaksi stabil dengan browser agent/LLM. Proyek ini mempertahankan kecepatan tracker dan menambahkan model musik eksplisit di bawahnya.

### 2.3 Skenario inti (jobs-to-be-done)

| ID | Skenario | Persona | Dipenuhi mulai |
|---|---|---|---|
| S1 | Menangkap ide musik dalam 5 menit (drum + bass + melodi) | P1, P2, P3 | v0.1 |
| S2 | Menyusun struktur lagu (Intro–Verse–Chorus) dan memainkannya | P2 | v0.1 |
| S3 | Memakai sample sendiri sebagai instrument | P1, P2 | v0.1 |
| S4 | Menyimpan, memindahkan, dan membuka ulang proyek; membagikan demo audio | semua | v0.1 |
| S5 | Mengedit melodi secara visual | P2 | v0.2 |
| S6 | Menulis lirik di atas melodi, beda per bait | P2 | v0.2 |
| S7 | Mengecek posisi nada di gitar | P2 | v0.3 |
| S8 | Membaca hasil sebagai partitur | P2 | v0.3 |
| S9 | Meminta kandidat bass/chord/drum lalu memilih | semua | v0.4 |

### 2.4 Sasaran keberhasilan per versi

Didefinisikan di §18 (bukan satu daftar raksasa seperti V1). Sasaran V1 butir 11–12 (generator) kini jelas berada di v0.4, bukan v0.1.

### 2.5 Bukan sasaran awal

Full multitrack recording, VST/AU hosting, mastering suite, audio clip warping, collaboration/cloud account, realistic vocal synthesis, stem separation, polyphonic audio transcription, "one click song", kompatibilitas sempurna MOD/XM/S3M/IT, WebGPU visual engine, WASM DSP hanya karena dianggap lebih cepat, **editing langsung di Score** (Score hanya-baca di v0.3), **editing penuh di perangkat sentuh/ponsel** (§8.18).

---

## 3. Kontrak teknis yang tidak boleh dilanggar

### 3.1 Production runtime

```text
GitHub Pages
  └── index.html
      ├── CSS
      ├── JavaScript ES Modules
      ├── vendored library yang benar-benar diperlukan
      ├── factory samples (lazy-loaded)
      └── static assets
```

Tidak ada API server wajib, SSR, atau runtime Node di production.

### 3.2 Dependency policy

- Vanilla JavaScript adalah baseline. Tanpa React/Vue/Svelte/Electron.
- Dependency runtime baru harus menjawab kebutuhan nyata yang sudah ada.
- Library notation atau ZIP boleh dipakai bila: lisensi kompatibel, versi di-pin, di-vendor/dibundle, **tidak bergantung CDN saat runtime**.
- Dev dependency (Playwright, dsb.) boleh di CI.
- **Mini UI kit internal** (Button, Menu, Dialog+focus trap, Popover, Toast, Tabs, Splitter, Tooltip) dibangun di R0 agar UI konsisten tanpa framework (§8.3).

### 3.3 Path policy GitHub Pages

Semua path runtime aman pada `https://<user>.github.io/<repo>/`:

- jangan mengasumsikan `/` adalah root; jangan hardcode `/assets/...`;
- pakai relative URL atau base URL dari build;
- tanpa History API routing; bila perlu routing, pakai hash route atau state tunggal;
- dynamic import memakai URL relatif yang valid pada subpath.

### 3.4 Security policy

- Tidak ada API key LLM di repository/bundle.
- Sample dan project user tidak meninggalkan browser tanpa aksi eksplisit.
- Import project/sample = *untrusted input*; parser **bounded dan fail-closed dengan batas bernilai** (§10.5).
- **Content-Security-Policy via `<meta http-equiv>`** (GitHub Pages tidak mengizinkan header kustom). Baseline: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'`. Pelonggaran `connect-src` untuk provider LLM diputuskan di R8 (§12.3).
- Tidak ada telemetri/analytics secara default.

---

## 4. Arsitektur produk

```text
                      Canonical Project Model
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
  Arrangement              Patterns                  Theory
 Sections / Order    Notes / Effects / Chords     Key / Scale
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               │
                        Command Layer  ◄── Undo/Redo (transaksi)
                               │
        ┌──────────┬───────────┼───────────┬──────────┐
     Pattern   Piano Roll   Guitar      Score      Lyrics
        └──────────┴───────────┼───────────┴──────────┘
                               │
              Focus Store (kursor, seleksi, playhead)   ← state UI, bukan data lagu
                               │
                          Playback
                  Scheduler → Instrument → Web Audio
                  (+ OfflineAudioContext untuk export)

       Generator / LLM proposal → Validator + Scorer → Command Layer
```

Aturan:

1. **Tidak ada view yang menulis data lagu secara langsung.** Semua mutasi lewat command layer.
2. **Focus Store** (kursor, seleksi, playhead, mode follow) adalah state UI bersama. Ia tidak masuk undo, tetapi serializable untuk agent dan untuk memulihkan sesi (§8.5).
3. **SongTimeline** (timeline absolut: tick, bar, menit:detik) adalah *hasil turunan* dari Order + Pattern, di-cache, dan dibatalkan setiap command. Dipakai Score, MIDI export, seek, dan tampilan posisi.

---

## 5. Model data kanonik

### 5.1 Prinsip

1. Pattern UI boleh terlihat seperti tracker klasik, tetapi model kanonik **bukan** array teks seperti `C-4 01 40 A03`.
2. Setiap event harus dapat dipahami oleh Pattern, Piano Roll, Score, Guitar, Lyrics, playback, theory engine, dan validator LLM.
3. **Aturan emas V2: tidak ada data musikal yang disimpan dengan absolute song tick.** Event disimpan relatif terhadap **Pattern** atau **OrderEntry/occurrence** sesuai semantiknya; absolute tick hanya ada di SongTimeline turunan. Event yang memang bagian dari definisi pattern (note, effect, chord/tempo yang harus ikut setiap reuse) tetap pattern-lokal. Perbedaan yang sengaja hanya berlaku pada satu occurrence boleh memakai overlay bertipe di OrderEntry. Menyusun ulang Order tidak boleh menggeser atau memutus makna event.

### 5.2 Timing

```text
PPQ = 480
```

- `rowTicks` adalah *resolusi grid default pattern*. Event kanonik tetap memakai tick, dan **boleh tidak jatuh di grid**.
- Resolusi tampilan dinyatakan sebagai **LPB (lines per beat)**. Hanya nilai yang membagi 480 secara bulat: 1, 2, 3, 4, 5, 6, 8, 12 (LPB 4 = 120 tick = 1/16; LPB 3 = 160 tick = triplet 1/8; LPB 6 = 80 tick = triplet 1/16).
- Event yang tidak selaras dengan resolusi tampilan **tidak dihilangkan dan tidak dikuantisasi diam-diam** (lihat §8.6, kolom DLY).

### 5.3 Struktur project minimum

```text
Project
├── schemaVersion, id, title, createdAt, modifiedAt
├── song
│   ├── initial        // tempo, meter, key awal
│   ├── sections[]     // {id, name, color}
│   ├── tracks[]
│   ├── patterns[]
│   ├── order[]        // OrderEntry
│   └── lyrics         // LyricBlock[]
├── instruments[]
├── samples[]
└── settings           // tuning, keymap preset, bahasa, tema
```

### 5.4 Track, channel, dan voice lane (keputusan baru)

Masalah V1: channel tracker bersifat monofonik, sedangkan Piano Roll dan gitar menulis chord (polifonik).

Keputusan:

```text
Track
├── id, name, color
├── kind               // instrument | drum
├── defaultInstrumentId
├── polyphony          // "mono" | "poly"   (default: mono untuk kind=instrument bass/lead, poly untuk chord/guitar)
└── (lane dihitung otomatis dari overlap)
```

- **1 Track = 1 header channel** di Pattern (batas baseline 32 track).
- Track `mono`: note baru memotong note sebelumnya (semantik tracker).
- Track `poly`: note yang overlap dialokasikan otomatis ke **voice lane** 1..n. Di Pattern, track tampil sebagai sub-kolom (`Lane 1`, `Lane 2`, …) yang dapat dilipat; di Piano Roll semua lane tampil sebagai satu track.
- **Drum kit tetap satu Track/header utama**, bukan satu track per piece. Kick, snare, closed/open hat, ride, crash, tom, dan percussion dipilih lewat pitch → zone/sample mapping (§6.3).
- Drum track polifonik secara default. Hit simultan pada tick yang sama dialokasikan ke **voice lane internal**; lane dapat dilipat agar 8–12 piece drum tidak menghabiskan 8–12 channel utama.
- Mute/Solo/meter di Pattern berlaku di level Drum Track. Kontrol per-piece (mute/solo/level/pan/choke) berada di Sound/Drum Kit UI; bukan dengan menambah top-level track untuk setiap piece.
- **Dependensi milestone:** minimal polyphony/voice-lane yang dibutuhkan Drum Track masuk R2 bersama Drum Kit. R3 menggeneralisasikan voice-lane ke semua track polifonik dan menambah UI editing/32 channel penuh.

### 5.5 Pattern, Order, Section

```text
Pattern
├── id, name
├── lengthTicks            // kelipatan bar kecuali "free length"
├── meter                  // {num, den} pattern-lokal
├── rowTicks               // resolusi tampilan default
├── notes[]                // NoteEvent (tick lokal)
├── effects[]              // EffectEvent (tick lokal)
├── chords[]               // ChordEvent (tick lokal)  ← pindah dari song-level
└── tempoEvents[]          // perubahan tempo pattern-lokal

OrderEntry
├── id, patternId
├── sectionId?             // referensi ke Section
├── keyOverride?           // konteks tonal untuk occurrence ini
└── overlays?              // opsional; hanya bila occurrence memang berbeda
    ├── chords[]?
    ├── tempoEvents[]?
    └── automation[]?
```

- **`repeatCount` dihapus.** "Ulangi ×N" di UI = membuat N OrderEntry (opsional dikelompokkan). Dengan begitu setiap *occurrence* punya `orderEntryId` unik dan lirik tidak ambigu.
- Memakai ulang pattern mengikuti semantik tracker: mengedit event pattern-lokal mengubah semua occurrence. UI wajib memperingatkan (§8.12).
- Overlay occurrence hanya mengubah OrderEntry itu. Contoh: Verse 1 dan Verse 2 memakai melodi Pattern 03 yang sama, sementara Verse 3 dapat mengganti chord atau tempo tanpa meng-clone seluruh pattern.
- `overlays` **bukan scope implementasi R1**. Ia dicatat sekarang supaya schema awal tidak mengunci asumsi "semua event harus pattern-lokal"; UI/editor overlay baru dikerjakan ketika kebutuhan arrangement-nya masuk milestone.
- Perubahan key antar-section lewat `Section`/`OrderEntry.keyOverride`, bukan `keyMap` absolut.

### 5.6 Note event

```text
NoteEvent
├── id, trackId
├── startTickLocal
├── durationTicks         // KANONIK, tidak ditebak dari row berikutnya
├── pitch                 // MIDI 0..127
├── instrumentId
├── velocity              // 0..127; kolom VOL di Pattern = field ini
├── pan?                  // opsional
├── tiedToNext?           // true bila berlanjut ke occurrence/bar berikutnya
├── fingeringHint?        // {string, fret}; metadata non-kanonik untuk Guitar
├── source                // user | generated | imported
├── locked
└── expression?           // data performa opsional, dibatasi
```

Aturan:

- `startTickLocal + durationTicks` **tidak boleh melewati akhir pattern**; validator memotong dan menandai. Untuk not panjang lintas pattern, pakai `tiedToNext` (dipakai Score dan scheduler).
- **Tidak ada duplikasi volume/pan**: kolom VOL = `velocity`; efek volume/pan (EffectEvent) adalah *perubahan setelah note on*, bukan nilai awal.

### 5.7 Effect event

```text
EffectEvent { id, trackId, tickLocal, type, value }
// type: volume, pan, pitchSlide, porta, vibrato, retrigger, offset, cut, delay, arpeggio
```

Disimpan sebagai data bertipe, bukan hex opaque. Kode ala tracker (mis. `A03`) hanyalah proyeksi UI/kompatibilitas.

### 5.8 Chord layer

```text
ChordEvent { id, tickLocal, durationTicks, rootPitchClass, quality, extensions, bassPitchClass?, source, locked }
```

Pattern-lokal. Boleh ada di pattern tanpa note (mis. pattern "Harmoni Verse" khusus chord). Basis theory engine, chord symbol di Score, akomodasi generator, dan konteks LLM.

### 5.9 Lyrics

```text
Lyrics
└── blocks[]                      // satu per bait/frasa panjang
    ├── id, label                 // "Verse 1"
    ├── rawText
    └── syllables[]
        ├── id, text
        ├── joinNext              // true bila lanjut dalam kata yang sama ("ke-" + "ka-" + "sih")
        ├── phraseBreakAfter
        └── anchors[]             // {orderEntryId, noteId}
```

- `anchors.length`: 0 = belum dipetakan; 1 = normal; ≥2 = melisma.
- Anchor mengacu ke **occurrence** (`orderEntryId`) + `noteId`. Pattern melodi yang sama di Verse 1 dan Verse 2 punya lirik berbeda tanpa saling menimpa.
- Bila note dihapus: anchor dilepas, suku kata **tidak dihapus** — kembali ke status "belum dipetakan" dan muncul di daftar *Lirik bermasalah* (§8.8).
- Bila pattern di-clone untuk satu occurrence ("Jadikan unik"), anchor occurrence itu dipindahkan ke note hasil clone (ID dipetakan).

---

## 6. Sample dan Instrument

### 6.1 Sample

Import resmi baseline: **WAV** (PCM 8/16/24/32-bit int, 32-bit float; mono/stereo). Format lain yang dapat didecode browser boleh menyusul, tetapi project portable harus deterministik: sample ditanam sebagai WAV.

```text
Sample { id, name, sourceFilename, contentHash, channels, sampleRate, frameCount,
         rootNote, fineTuneCents, gain, loop{enabled,startFrame,endFrame,mode}, storageRef }
```

### 6.2 Instrument

Rilis awal: single-sample sampler. Model sudah mendukung multisample, UI-nya belum.

```text
Instrument { id, name, type="sampler", zones[{sampleId,keyLow,keyHigh,rootNote,tuneCents,gain}],
             ampEnvelope, defaultPan, chokeGroup? }
```

### 6.3 Drum instrument

Mapping note → zone + choke group opsional. Contoh: `C2 Kick, D2 Snare, F#2 Closed HH, A#2 Open HH, C#3 Crash, D#3 Ride`. Closed/Open HH berbagi choke group.

### 6.4 Factory samples

Kecil dan lazy-loaded: acoustic kit, electronic kit, piano/EP ringan, bass, clean guitar/pluck, lead/pad sederhana, metronome. Budget: app tanpa sample < 1,5 MiB transferred; pack total ≤ 12 MiB; tidak preload semua; ambil saat dibutuhkan. Setiap sample punya catatan lisensi di manifest.

### 6.5 Template project (baru)

Dibangun dari fixture golden (§16.4), dikirim sebagai data kecil: *Kosong*, *Pop 4/4 120 BPM* (drum+bass+melodi), *Balada 6/8*, *Demo lagu* (lengkap dengan lirik). Dipakai onboarding (§8.15) dan tes.

---

## 7. Audio engine

### 7.1 Baseline

```text
AudioContext
  ├── track bus ×N: AudioBufferSourceNode/voice → GainNode → StereoPannerNode
  └── master GainNode → (meter) → destination
```

Sample didecode sekali menjadi `AudioBuffer`, di-cache selama sesi, dan dilepas bila tidak dipakai (budget memori decoded ditampilkan di Sound workspace).

### 7.2 Scheduler

- Jam musik = audio clock, bukan `setTimeout`.
- Look-ahead ±100–150 ms, wake interval ±20–30 ms (final dari benchmark).
- Waktu event dihitung dari anchor audio clock; loop tanpa akumulasi rounding; perubahan tempo me-*re-anchor* di tick saat ini.
- **Live edit (baru):** command yang mengubah event saat playback membatalkan jadwal event yang belum "dibekukan". Event dengan waktu mulai `< now + 30 ms` dianggap beku (tidak diubah). Wajib diuji: tambah/hapus note saat loop berjalan tanpa glitch/duplikat.
- **Kompensasi latensi output (baru):** playhead visual, sorot lirik, dan sorot Score memakai `AudioContext.currentTime` dikurangi `outputLatency` (fallback `baseLatency`), bukan `performance.now()`.

### 7.3 Voice handling

Note on/off, retrigger, sample loop, pitch dari `playbackRate`/`detune`, volume, pan, ADSR/release sederhana, choke group.

### 7.4 Efek subset pertama (v0.1)

1 volume · 2 pan · 3 pitch slide · 4 portamento · 5 vibrato · 6 retrigger · 7 sample offset · 8 note cut · 9 note delay · 10 arpeggio.

Tiap efek: representasi kanonik bertipe, perilaku scheduler deterministik, unit test, dan minimal satu tes integrasi audible. **Spike teknis di R1 (maks. 1 hari):** buktikan portamento/vibrato/pitch slide bisa dilakukan dengan automation `AudioParam` pada `AudioBufferSourceNode` sebelum R3 menjanjikannya; bila tidak, pindahkan efek itu ke R9 dan perbarui rencana.

### 7.5 Transport songwriter (baru)

Metronome (factory sample, bisa dimatikan), count-in 1–2 bar, loop region (pattern / seleksi / section / lagu), play dari kursor, play seleksi. Semua dari scheduler yang sama.

### 7.6 Offline render (baru)

Scheduler inti diparameterkan agar dapat berjalan di `OfflineAudioContext` → dipakai untuk **Export WAV** (R4) dan sebagai tes deterministik (hash/RMS terhadap golden dengan toleransi).

### 7.7 Kapan AudioWorklet masuk

Hanya jika benchmark membuktikan: timing target tak tercapai dengan node standar; efek butuh pemrosesan per-sample; resampler/filter kustom diperlukan; target voice gagal konsisten; DSP tak bersih direpresentasikan dengan node standar. GitHub Pages memakai HTTPS sehingga syarat secure context terpenuhi.

### 7.8 Kapan WASM masuk

Hanya jika: port library native lebih masuk akal daripada rewrite; DSP Worklet JS terbukti bottleneck; butuh libopenmpt untuk kompatibilitas; atau ada benchmark yang membuktikan manfaat. WASM tidak boleh mengubah kontrak data/command.

### 7.9 Input perangkat (opsional)

Web MIDI untuk keyboard MIDI (step-entry & audisi) sebagai *progressive enhancement* setelah R3; bukan syarat rilis.

---

## 8. UI/UX — dirombak total

### 8.1 Prinsip UX

| # | Prinsip | Artinya dalam praktik |
|---|---|---|
| U1 | **Suara dulu** | Buka → pilih template → Play. Target ≤ 60 detik, tanpa konfigurasi. |
| U2 | **Dua pintu, satu data** | Preset workspace *Songwriter* dan *Tracker* menampilkan model yang sama dengan susunan berbeda. |
| U3 | **Satu tugas, satu jalur utama** | Tiap tugas punya satu cara utama yang jelas; cara lain hanyalah pintasan. |
| U4 | **Progressive disclosure** | Kolom FX, zona multisample, envelope, tuning kustom tersembunyi sampai diminta. |
| U5 | **Fokus bersama** | Satu kursor dan satu seleksi berlaku di semua view (§8.5). |
| U6 | **Status selalu terlihat** | Mode edit, oktaf, step, instrumen aktif, status simpan, status audio — selalu di status bar. |
| U7 | **Tidak ada kejutan destruktif** | Utamakan *undo* daripada dialog konfirmasi; generator, kuantisasi, dan impor selalu bisa dibatalkan. |
| U8 | **Dapat ditemukan** | Semua command ada di menu **dan** Command Palette dengan shortcut tertera. |
| U9 | **Keyboard-first, bukan keyboard-only** | Setiap gestur mouse punya padanan keyboard; setiap aksi keyboard punya jejak visual. |
| U10 | **Jangan sembunyikan data** | Event off-grid, note yatim, dan pattern bersama selalu ditandai, tidak dibulatkan diam-diam. |

### 8.2 Peta informasi: workspace

V1 menaruh empat view di satu panel tengah dan memadatkan Lyrics/Chord/Inspector/Generator di satu tab bawah. V2 memakai **tab workspace tingkat atas** (mirip tab *General / Pattern / Samples / Instruments* di OpenMPT) agar orang selalu tahu "saya sedang di mana":

| Tab | Isi utama | Persona utama |
|---|---|---|
| **Song** | Song Map (blok section), daftar Order, ringkasan track, tempo/meter/key | P2, P3 |
| **Pattern** | Grid tracker | P1 |
| **Piano Roll** | Piano roll + lane chord + lane lirik + lane velocity | P2 |
| **Lyrics** | Editor lirik teks + piano roll mini di bawahnya | P2 |
| **Guitar** | TAB timeline + fretboard | P2 |
| **Score** | Partitur hanya-baca | P2 |
| **Sound** | Browser sample/instrument, waveform, properti | P1, P2 |

Aturan: **tidak pernah berpindah tab otomatis.** Berpindah hanya lewat klik, `Alt+1…7`, atau aksi eksplisit "Tampilkan di …" (§8.5).

**Preset workspace** (menu *Tampilan*): *Songwriter* (Song Map kiri + Piano Roll tengah + Inspector kanan), *Tracker* (Order List kiri + Pattern tengah + Inspector kanan), *Gitar* (Guitar + Pattern kecil), *Partitur* (Score + Lyrics). Preset hanya memilih tab aktif, split, dan panel yang terbuka; bukan mode berbeda.

### 8.3 Layout desktop

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☰  Lagu Saya  ● Tersimpan 10:32 │ ⏮ ▶ ⏹  🔁 Pattern │ ♩120 4/4 Am │ 🔊 ▂▃▅ │ ⌘K │  ← Top bar
├──────────────────────────────────────────────────────────────────────────────┤
│ Song | Pattern | Piano Roll | Lyrics | Guitar | Score | Sound     [Split ▾]   │  ← Tab workspace
├───────────────┬──────────────────────────────────────────────┬───────────────┤
│ SONG MAP      │                                              │ INSPECTOR     │
│ ┌Intro──────┐ │                                              │ (kontekstual) │
│ │ Verse 1   │ │          AREA KERJA (1 view atau 2 view)     │ Note ▸ pitch, │
│ │ Chorus    │ │                                              │ durasi, vel…  │
│ │ Verse 2   │ │                                              │ Channel ▸     │
│ └Chorus─────┘ │                                              │ instrumen, …  │
│ [+ Section]   │                                              │ Suku kata ▸   │
├───────────────┴──────────────────────────────────────────────┴───────────────┤
│ DOCK (lipat): ⌨ Keyboard layar │ ✨ Generator (v0.4) │ ⚠ Masalah │ Console   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ● EDIT │ Oktaf 4 │ Step 1 │ 02 Bass │ Bar 5 · Beat 2 │ 00:12.4 │ Audio ✔     │  ← Status bar
└──────────────────────────────────────────────────────────────────────────────┘
```

Perbedaan penting terhadap V1:

- **Kiri = struktur lagu** (Song Map / Order), bukan sekadar daftar pattern.
- **Kanan = Inspector kontekstual** (properti apa pun yang sedang dipilih), bukan panel Instrument permanen. Instrument/Sample punya tab **Sound** sendiri.
- **Dock bawah dilipat secara default** dan hanya berisi alat bantu (keyboard layar, generator, daftar masalah, console). **Lyrics dan Chord tidak lagi di dock**: keduanya menjadi *lane* yang menempel pada sumbu waktu view (§8.8).
- **Status bar** selalu tampil (U6).
- Kiri dan kanan dapat dilipat; Splitter dapat diseret; ukuran tersimpan di `localStorage`.

**Split view:** satu klik pada `[Split ▾]` membagi area kerja jadi dua view yang berbagi fokus. Pasangan yang didukung: Pattern + Piano Roll (kiri-kanan), Piano Roll + Score (atas-bawah), Guitar + Pattern, Lyrics + Score.

### 8.4 Terminologi (glosarium UI)

Label memakai istilah tracker yang dikenal P1, dengan tooltip penjelas bahasa awam untuk P2/P3:

| Label UI | Tooltip | Catatan |
|---|---|---|
| Pattern | "Potongan musik yang bisa dipakai ulang" | Ikon rantai bila dipakai >1 tempat |
| Order | "Urutan pattern dalam lagu" | Tampil juga sebagai Song Map |
| Section | "Bagian lagu: Intro, Verse, Chorus…" | Berwarna |
| Channel | "Satu jalur instrumen" | Di model data disebut `Track`; di **seluruh UI** selalu "Channel" agar konsisten |
| Instrument | "Suara yang dimainkan" | |
| Sample | "Rekaman audio mentah (WAV)" | |
| Occurrence | — | **Tidak muncul di UI**; ditampilkan sebagai "Verse 2 · Pattern 03" |

### 8.5 Model fokus bersama (kunci "sinkron" yang terasa)

```text
Focus {
  cursor:    { orderEntryId, tickLocal, channelId }       // satu kursor global
  selection: { kind: notes | range | syllables | chords, ids | range }
  playhead:  { orderEntryId, tickLocal }
  follow:    off | halaman | halus
  activeView: <tab/split yang menerima keyboard>
}
```

Aturan perilaku:

1. Memilih note di view mana pun menyorot note yang sama di semua view yang terlihat (warna sorot sama).
2. View yang terlihat **menggulir ke seleksi hanya bila `follow` aktif** atau lewat aksi *Tampilkan di …* (menu konteks atau `Alt+angka`). Tidak ada pindah tab diam-diam.
3. Hanya satu `activeView` yang menerima shortcut keyboard; ia ditandai garis fokus yang jelas (bukan hanya warna). `Esc` keluar dari input teks kembali ke grid terakhir.
4. Warna track konsisten di semua view (palet aman buta-warna, §8.19).
5. Perubahan Focus tidak masuk undo; tetapi disimpan di sesi agar *reload* mengembalikan posisi.

### 8.6 Pattern editor (workspace utama P1)

**Header channel** (tetap terlihat saat menggulir): `[nomor] nama` · chip instrumen (klik → picker, §8.11) · tombol **M**ute / **S**olo · slider volume mini · warna · tombol lipat · tombol `FX`.

**Kolom per channel — progressive disclosure:**

```text
Default :  NOTE | INST | VOL
+ tombol FX di header menambah :  FX | PARAM
+ otomatis muncul bila ada event off-grid :  DLY
Channel polifonik :  sub-kolom Lane 1 · Lane 2 · … (bisa dilipat)
```

**Kolom lagu (opsional, pinned di kiri):** `CHORD` dan `LYRIC` — sehingga chord dan suku kata terlihat sejajar dengan baris, tanpa membuka view lain.

**Sumbu waktu:** nomor baris + penanda `bar.beat`; garis tebal tiap beat, lebih tebal tiap bar. Dropdown **Resolusi** (LPB: 2/3/4/6/8/12) mengubah proyeksi baris tanpa mengubah data.

**Event off-grid (menjawab temuan B3):** note dari Piano Roll yang tidak jatuh di grid tampil di baris terdekat dengan penanda `⌁` dan nilai offset di kolom `DLY` (mis. `+23t`). Tombol pada penanda: *Tampilkan di resolusi yang cocok* (otomatis memilih LPB yang pas bila ada) atau *Kuantisasi ke grid* (aksi eksplisit, bisa di-undo).

**Mode edit — eksplisit dan terlihat:**

| Mode | Perilaku tombol nada | Penanda |
|---|---|---|
| **EDIT** | Mengisi sel di kursor, memainkan nada (audisi), maju sebesar *step* | Kursor **merah**, badge `● EDIT` di status bar |
| **AUDISI** | Hanya memainkan nada, tidak menulis | Kursor **biru**, badge `○ AUDISI` |

Peralihan: `Ctrl+E` atau klik badge. **Mode awal mengikuti pintu masuk/workflow, bukan satu default global:** preset **Tracker/OpenMPT-like → EDIT** supaya veteran tracker bisa langsung mengetik; preset **Songwriter → AUDISI** supaya klik/tombol nada aman untuk eksplorasi. Bila belum ada preset yang terselesaikan, gunakan default produk Songwriter → AUDISI. Pergantian mode tidak mengubah model lagu, hanya perilaku input Pattern.

**Seleksi bertahap:** `Ctrl+A` berulang → sel/kolom → channel → pattern. Seret di header channel memilih seluruh channel. Shift+panah / seret mouse memilih blok.

**Empty state sel pertama:** petunjuk mengikuti mode. EDIT: "Ketik **Z** untuk C". AUDISI: "**Z** mengaudisi C · **Ctrl+E** untuk EDIT". Petunjuk hilang setelah note pertama ditulis.

**Operasi minimum:** note entry, oktaf, step, navigasi, follow playback, blok seleksi, salin/tempel, hapus, transpose (±1/±12), interpolasi volume, sisip/hapus baris, duplikat pattern, **clone vs reuse**, undo/redo.

**Rendering:** DOM *windowed* (hanya baris terlihat). `role="grid"` dengan `aria-rowindex/colindex` agar tetap benar saat virtualisasi (§8.19).

### 8.7 Piano Roll (workspace utama P2)

- Alat: **Pilih** (`V`), **Gambar** (`B`), **Hapus** (`X`). Klik dua kali di area kosong = buat note dengan durasi sesuai snap.
- Sumbu kiri: keyboard piano yang dapat diklik untuk audisi. Baris diwarnai **menurut key** (nada dalam skala terang, di luar skala redup) dan nada chord aktif diberi tanda.
- **Ghost notes** dari track lain (opsional) sebagai konteks; filter track.
- Lane di bawah: **velocity**; lane di atas: **chord** dan **lirik** (§8.8).
- Snap (1/4, 1/8, 1/16, triplet, **bebas**), zoom H/V (`Ctrl+scroll`), minimap, playhead follow.
- Status note: warna menurut track; tepi bergaris = `locked`; ikon kecil = `generated`.
- **Padanan keyboard untuk setiap gestur:** panah = geser, `Shift+←/→` = ubah durasi, `Shift+↑/↓` = oktaf, `Ctrl+D` = duplikat, `Del` = hapus. (Memenuhi aksesibilitas §8.19 dan P1.)
- Audisi: nada berbunyi saat note diseret/ditaruh.

### 8.8 Lyrics — entry di atas melodi

Penyebab V1 lambat: textarea terpisah lalu pemetaan manual. V2 menyediakan **tiga cara** yang saling melengkapi, semuanya pada data `LyricBlock` yang sama:

**Cara 1 — Ketik di atas melodi (utama, "karaoke entry")**

1. Klik note pertama di Piano Roll / Pattern / Score (atau tab Lyrics) lalu tekan `L` atau klik **Lirik**.
2. Ketik suku kata. `Spasi` = maju ke note berikutnya (kata baru). `-` = maju dengan menyambung kata (`ke-` `ka-` `sih`). `Enter` = akhir frasa. `~` = melisma (note berikutnya ikut suku kata ini). `Backspace` pada input kosong = mundur satu note. `Esc` = selesai.
3. Suku kata muncul di **lyric lane** tepat di bawah note, ikut zoom/scroll view.

**Cara 2 — Tulis bebas lalu sebar**

Panel teks di tab *Lyrics*. Pemecah suku kata manual dengan tanda `-` (pratinjau langsung). Pilih rentang note → tombol **Sebar berurutan** → *pratinjau diff* (garis penghubung teks→note) → Terima/Batal.

**Cara 3 — Bantuan suku kata Indonesia (opsional, boleh ditunda)**

Aturan fonotaktik sederhana (V, KV, VK, KVK; digraf *ng, ny, sy, kh*) hanya sebagai *saran* yang diterima/ditolak pengguna. Tidak ada auto-syllabification lintas bahasa pada baseline.

**Status per suku kata (tidak hanya warna):**

| Status | Tampilan |
|---|---|
| Belum dipetakan | Garis putus-putus, ikon ○ |
| Terpetakan | Teks biasa di bawah note |
| Melisma | Garis memanjang ke note berikutnya |
| Yatim (note dihapus) | Tanda ⚠ + masuk panel **Masalah** dengan tombol *Loncat ke* |

**Per-occurrence tanpa membingungkan:** lane lirik selalu diberi label occurrence, mis. `Lirik: Verse 2 · Pattern 03`. Saat pattern dipakai di beberapa tempat, banner halus: "Melodi ini dipakai di 2 tempat — lirik disimpan terpisah per tempat." Tombol **Salin pemetaan ke…** menyalin pemetaan ke occurrence lain bila note-nya sama.

**Sorot saat playback:** suku kata aktif disorot (kompensasi latensi §7.2); `follow` menjaga baris aktif terlihat.

### 8.9 Guitar

- Dua mode: **TAB timeline** dan **Fretboard**; keduanya berbagi fokus.
- Input: klik fret = audisi + (bila mode EDIT) menulis note; mengetik digit di sel TAB; panah untuk berpindah senar.
- **Fingering**: sistem mengusulkan posisi dengan perpindahan tangan minimum; pengguna dapat menimpa per note (`fingeringHint`). Penimpaan ditandai ikon pin.
- Opsi: tuning (standar default; Drop D, DADGAD, ukulele menyusul), **capo**, **mode kidal** (cermin), zona posisi preferensi.
- Nada di luar jangkauan tuning ditandai `⚠` dengan saran "geser oktaf".
- Chord yang ditulis bersamaan tampil sebagai tumpukan vertikal (strum). Diagram chord dari chord layer menyusul setelah v0.4.

### 8.10 Score

- **Hanya-baca** pada v0.3 (editing di Score ditunda; keputusan disengaja karena biaya tinggi).
- Treble clef, ritme/rest, tanda birama & key, chord symbol, lirik, sorot playback; klik note → memilih (berbagi fokus).
- **Kuantisasi tampilan** (`1/16`, `1/8`, triplet, otomatis) — hanya memengaruhi gambar, tidak data. Bila ada pembulatan, banner: "Beberapa note ditampilkan dibulatkan (tampilan saja)".
- `tiedToNext` digambar sebagai ikatan nada; ekspor SVG / cetak lewat stylesheet cetak.
- Opsi: bar per baris, tampilkan/sembunyikan chord & lirik.

### 8.11 Sound — instrument dan sample

Menjawab temuan D8: menambahkan suara tidak boleh butuh banyak langkah.

- **Seret & lepas WAV di mana saja pada jendela** → impor sebagai sample, buat instrument, pasang ke channel terpilih → toast "Bass_01 dipasang ke Channel 02 — **Urungkan**".
- **Picker instrumen** dari chip di header channel: daftar *Terbaru* + pencarian + kategori; `↑/↓` mengaudisi instrumen langsung; `Enter` memilih.
- Tab **Sound**: kiri browser (Factory / Proyek / Sample) dengan audisi sekali-klik; tengah waveform (root note, trim, loop marker); kanan properti.
- **Mode Sederhana (default)**: nama, root note, fine tune, volume, loop on/off. **Mode Lanjutan**: envelope, zona, choke group, pan.
- Preset **Drum kit** mengisi pemetaan otomatis dengan sample factory.
- Pesan galat WAV rusak spesifik dan menawarkan tindakan ("Header WAV tidak valid. [Pilih file lain]"); tidak merusak proyek.
- Layar tampil: ukuran memori decoded dan jumlah sample (peringatan lembut mendekati batas §10.5).

### 8.12 Song Map dan Order

- **Song Map**: blok horizontal/vertikal berwarna per section; isi = urutan pattern. Seret = pindah; `Alt`+seret = duplikat; klik = pilih; klik dua kali = buka pattern di Pattern/Piano Roll.
- **Order List** (vertikal, gaya OpenMPT) adalah pandangan alternatif dari **data yang sama** (toggle di panel kiri). P1 memilih ini.
- **Tambah section** → dialog kecil: nama (preset Intro/Verse/Chorus/Bridge/Outro), pattern: *Baru / Clone dari… / Pakai ulang…*.
- Lencana pattern: `⛓ ×3` = dipakai 3 tempat.
- **Jebakan pattern bersama (temuan D6):** pada edit pertama sebuah pattern yang dipakai >1 tempat, tampil popover non-modal: *"Pattern 03 dipakai di 3 tempat. [Edit semua] [Jadikan unik untuk tempat ini]"*. Pilihan diingat selama sesi; bisa diubah di pengaturan. "Jadikan unik" meng-clone pattern dan memindahkan anchor lirik occurrence itu (§5.9).
- Aksi massal: ulangi ×N, ganti pattern, ubah key occurrence.

### 8.13 Transport dan status

- Top bar: Play/Pause, Stop, Rekam-edit (alias mode EDIT), Loop (dropdown: Pattern / Seleksi / Section / Lagu), metronome, count-in, tempo (klik dua kali untuk mengetik; **Tap tempo**), meter, key, master + meter level.
- Status bar: mode (EDIT/AUDISI), oktaf, step, instrumen aktif, posisi (`bar·beat` dan `mm:ss.d`), status audio, status simpan.
- **Banner audio terkunci**: bila `AudioContext` belum aktif (kebijakan autoplay) — "Klik di sini untuk mengaktifkan audio" — muncul pada gestur pertama yang relevan, bukan galat di console.

### 8.14 Command Palette dan keymap

**Command Palette** (`Ctrl/Cmd+K`): daftar semua command dari registry yang sama dengan command layer/agent (§9); menampilkan shortcut, status aktif/nonaktif, dan alasan nonaktif. Karena command layer sudah ada, biayanya rendah, manfaatnya besar untuk discoverability. `?` membuka overlay shortcut kontekstual untuk view aktif.

**Keymap — dua preset dipilih saat first-run, dapat diubah:**

- **Songwriter (default)**: `Space` Play/Stop dari kursor · `Shift+Space` mulai dari awal section.
- **OpenMPT-like**: disusun dan **diverifikasi terhadap OpenMPT saat R3** (jangan menyalin dari ingatan); termasuk perilaku Space/Enter/F-keys.

Aturan bersama:

1. Pemetaan menggunakan **`KeyboardEvent.code` (posisi fisik)**, bukan karakter, agar tetap benar di AZERTY/Dvorak/QWERTZ.
2. Tata letak nada dua baris klasik tracker: baris bawah `Z S X D C V G B H N J M` = C…B; baris atas `Q 2 W 3 E R 5 T 6 Y 7 U` = C…B oktaf berikutnya.
3. Shortcut tidak aktif saat fokus di input teks. Letak huruf nada vs shortcut tidak boleh bentrok: shortcut bermodifier (`Ctrl/Alt`) kecuali tombol transport.
4. Usulan awal (final di R3 setelah uji pengguna): `-` / `=` oktaf −/+, `1` note-off, `Ctrl+E` mode EDIT/AUDISI, `Ctrl+Z / Ctrl+Y` undo/redo, `Ctrl+K` palette, `Alt+1…7` ganti tab, `L` lirik, `V/B/X` alat Piano Roll.
5. Konflik shortcut dengan browser/OS dicatat di tabel dan diuji di Chromium & Firefox.
6. Keyboard layar (dock) untuk pengguna tanpa tata letak yang nyaman dan untuk sentuh.

### 8.15 Onboarding dan first-run

1. **Layar sambutan** (sekali): bahasa (Indonesia/English), preset keymap, pilih **template** (Kosong · Pop 4/4 · Balada 6/8 · Demo lagu). Tombol "Lewati" selalu ada.
2. Proyek langsung termuat; **Play** dapat ditekan pada detik ke-10.
3. **Tur interaktif 5 langkah** (bisa dilewati, bisa diulang dari menu Bantuan): ① tekan Play ② ketik satu nada ③ buka Piano Roll ④ seret WAV ke jendela ⑤ simpan proyek.
4. **Empty state** bermakna di setiap view kosong (satu kalimat + satu tombol aksi).
5. Tooltip menampilkan nama + shortcut; tidak ada fitur yang hanya bisa ditemukan lewat dokumentasi.

### 8.16 Umpan balik, status, dan galat

| Situasi | Perilaku |
|---|---|
| Aksi berhasil tetapi tak terlihat (impor, clone, kuantisasi, generate) | Toast 5 detik dengan **Urungkan** |
| Autosave | Chip di top bar: `● Tersimpan lokal 10:32` / `◌ Menyimpan…` / `⚠ Gagal menyimpan` |
| Belum pernah diekspor | Setelah 10 menit perubahan: banner halus "Belum diekspor — simpan `.webtrack` agar aman" (storage browser dapat dihapus, mis. kebijakan Safari) |
| Proyek terbuka di tab lain | Banner: "Proyek ini terbuka di tab lain — tab ini baca-saja. [Ambil alih]" (§10.4) |
| Audio belum aktif | Banner di §8.13 |
| Sample sedang dimuat | Progress per instrumen di picker & status bar; playback tetap bisa jalan untuk yang siap |
| Galat parser/file | Pesan spesifik + tindakan; proyek tak berubah (fail-closed) |
| Konfirmasi modal | Hanya untuk yang tidak bisa di-undo: hapus proyek dari browser, timpa saat impor |

### 8.17 Undo/redo — spesifikasi

- **Transaksi:** satu gestur = satu langkah (menyeret note di Piano Roll, mengetik satu frasa lirik, menempel blok).
- **Cakupan global** (satu tumpukan untuk seluruh proyek) agar perilaku sama di semua view. Fokus dipulihkan ke tempat perubahan.
- Tersedia untuk impor sample, clone, kuantisasi, terima kandidat generator.
- Batas riwayat (mis. 500 langkah) dan estimasi memori ditampilkan di console.
- Tidak berlaku untuk: perubahan Focus, preferensi UI.

### 8.18 Responsif dan sentuh — cakupan yang jujur

| Lebar | Perilaku |
|---|---|
| ≥ 1280 px | Layout penuh §8.3 |
| 1024–1279 px | Song Map & Inspector menjadi *drawer* |
| 768–1023 px (tablet) | Song, Piano Roll, Guitar, Score, Sound dapat dipakai dengan sentuh; Pattern memerlukan keyboard fisik atau keyboard layar |
| < 768 px (ponsel) | **Putar & lihat saja**, dengan pesan jelas; editing penuh bukan target v0.x |

Target sentuh ≥ 40 px untuk kontrol utama. Gestur Piano Roll (pinch zoom, seret) ada padanan tombol.

### 8.19 Aksesibilitas

- Roving tabindex untuk grid; `role="grid"` + `aria-rowcount/aria-rowindex`; pengumuman posisi kursor lewat live region (di-*throttle*, dapat dimatikan).
- Fokus terlihat jelas; dialog dengan focus trap benar; shortcut tidak membajak input teks.
- Warna **bukan** satu-satunya penanda: mode EDIT/AUDISI punya teks; status lirik punya ikon; note `locked`/`generated` punya pola/ikon.
- Palet track aman buta-warna; tema terang, gelap, dan **kontras tinggi**; skala font 80–150%.
- `prefers-reduced-motion` mematikan follow halus dan animasi.
- Alternatif keyboard untuk semua gestur Piano Roll/Guitar.
- Hook agent (`data-action`, `data-entity`) tidak bergantung kelas CSS visual.

### 8.20 Kriteria keberhasilan UX (terukur)

Selain tes Playwright, setiap rilis divalidasi dengan **uji tugas bermoderasi, 5 orang** (minimal 1 veteran tracker, 2 penulis lagu/gitaris non-tracker), tanpa telemetri otomatis. Ambang awal berikut dikalibrasi setelah uji pertama dan **tidak diturunkan diam-diam** (perubahan dicatat di changelog):

| ID | Tugas | Ambang awal | Rilis |
|---|---|---|---|
| T1 | Dari halaman terbuka sampai mendengar suara (template) | ≤ 60 dtk | v0.1 |
| T2 | Memasukkan melodi 8 nada (Pattern **atau** Piano Roll) | ≤ 2 mnt, pertama kali | v0.1/v0.2 |
| T3 | Mengimpor WAV sendiri dan memakainya di sebuah channel | ≤ 90 dtk | v0.1 |
| T4 | Menemukan sebuah command lewat Command Palette | ≤ 20 dtk | v0.1 |
| T5 | Menyusun Verse–Chorus–Verse di Song Map | ≤ 3 mnt | v0.1 |
| T6 | Memetakan 4 baris lirik ke melodi | ≤ 5 mnt | v0.2 |
| T7 | Menyebutkan posisi fret sebuah nada | ≤ 30 dtk | v0.3 |
| T8 | Memilih satu kandidat generator dan menerapkannya | ≤ 2 mnt | v0.4 |

Lulus bila ≥ 4 dari 5 peserta menyelesaikan tugas **tanpa bantuan**. Hasil dan temuan masuk ke `docs/ux-findings.md` dan memengaruhi rencana rilis berikutnya.

Heuristik tetap (diperiksa tiap PR UI): tidak ada jalan buntu; undo selalu tersedia; setiap status penting terlihat; tidak ada tindakan destruktif tanpa jalan kembali.

---

## 9. Command layer dan agentability

Semua fitur utama tersedia lewat command API yang **sama** dengan UI, Command Palette, dan agent.

```text
Proyek  : getProject getState newProject loadTemplate
Struktur: addSection addPattern clonePattern makePatternUnique setOrder repeatEntry
Musik   : addNote updateNote deleteNote addEffect setChord setTempoEvent quantize
Suara   : importSample createInstrument setInstrument assignInstrumentToTrack
Lirik   : setLyrics splitSyllables assignSyllable spreadSyllables clearSyllable
Playback: play pause stop seek setLoop setTempo setMetronome
Riwayat : undo redo beginTransaction endTransaction
Fokus   : setCursor setSelection setFollow showIn
Ekspor  : exportProject exportWav exportMidi
Generator: generatePatternCandidates acceptCandidate rejectCandidate
Meta    : listCommands (+ status aktif/nonaktif + alasan)
```

Aturan:

- return value serializable; error memakai kode stabil; snapshot state detached;
- tidak meng-expose `AudioContext`, raw storage, atau secret;
- entity punya ID stabil; aksi penting punya `data-action`/`data-entity`;
- **`listCommands` adalah satu-satunya registry** untuk menu, Command Palette, overlay shortcut, dan agent (sumber tunggal discoverability, §8.14);
- perintah berkelompok (`beginTransaction`/`endTransaction`) menentukan granularitas undo (§8.17).

```js
window.tracker.getState()
window.tracker.commands.addNote({ trackId, orderEntryId, startTickLocal, durationTicks, pitch })
```

---

## 10. Persistence dan project file

### 10.1 Browser storage

`IndexedDB` untuk project dan blob sample; `localStorage` hanya untuk preferensi kecil (tema, ukuran panel, keymap). Autosave di-*debounce* dan tidak mengganggu playback.

### 10.2 Format portable `.webtrack`

```text
project.webtrack  (ZIP)
├── manifest.json        // schemaVersion, project data
├── samples/<hash>.wav
└── optional/preview.json
```

ZIP library kecil, pinned, vendored. Bila belum dipilih, milestone portabilitas tidak boleh dianggap selesai. Ekspor debug `.webtrack.json` (tanpa sample) untuk fixture/test.

### 10.3 Save/Open

`<input type="file">` + drag-drop untuk buka; Blob download untuk simpan. File System Access API hanya *progressive enhancement*. **Export WAV** (via `OfflineAudioContext`, §7.6) dan **Export MIDI sederhana** tersedia dari R4.

### 10.4 Ketahanan penyimpanan (baru)

- **Multi-tab:** gunakan Web Locks + `BroadcastChannel`. Tab kedua membuka proyek yang sama → baca-saja dengan opsi *Ambil alih* (cegah autosave saling timpa).
- Panggil `navigator.storage.persist()` setelah penyimpanan pertama; tampilkan kuota terpakai di Sound/Pengaturan.
- Browser dapat menghapus storage (mis. kebijakan ITP Safari untuk situs yang lama tak dikunjungi) → banner "belum diekspor" (§8.16) adalah mitigasi utama.
- Pemulihan sesi minimal: draft autosave terakhir + Focus.

### 10.5 Batas parser (angka awal, tidak diturunkan diam-diam)

| Hal | Batas awal |
|---|---|
| Ukuran `.webtrack` (terkompresi) | 200 MiB |
| Ukuran total setelah dekompresi | 512 MiB |
| Rasio dekompresi maksimum | 100 : 1 (tolak bila lewat) |
| Jumlah entri ZIP | 2.000 |
| Satu WAV | 100 MiB, ≤ 2 channel, ≤ 192 kHz |
| `manifest.json` | 10 MiB, kedalaman JSON ≤ 64 |
| Nama entri | tanpa `..`, tanpa path absolut |
| Memori sample decoded (peringatan lunak / batas keras) | 512 MiB / 1 GiB |

Pelanggaran → galat spesifik, tidak ada perubahan pada proyek aktif (fail-closed). Tes fuzz/malformed untuk ZIP dan WAV wajib di R2/R4.

### 10.6 Share URL

Hanya untuk proyek yang direkonstruksi tanpa sample kustom: data lagu terkompresi, sample factory direferensikan lewat ID stabil, envelope berversi, batas ukuran keras (lewat batas → minta ekspor `.webtrack`), membuka tidak menimpa autosave, payload didekode bounded.

---

## 11. Theory engine sebelum LLM

LLM bukan satu-satunya sumber "musikalitas". Theory engine deterministik menyediakan:

- **Konteks tonal:** tonic, mayor/minor, derajat skala, chord diatonik, chord tone vs non-chord tone.
- **Fungsi harmoni:** Tonic / Predominant / Dominant, dengan *transition scoring* (bukan aturan absolut).
- **Circle of Fifths:** strategi progresi, skor root-motion, bantuan modulasi kemudian — bukan generator tunggal.
- **Kadens:** authentic, half, plagal, deceptive sederhana.
- **Melody scoring:** scale fit, chord-tone di posisi kuat, ukuran interval, resolusi lompatan, kontur, range, repetisi, kemiripan motif, kerapatan ritme, pendaratan frasa.
- **Bass:** root, root/fifth, passing approach, octave; walking variant kemudian.
- **Drum:** berbasis grid/aturan — Straight, Pop, Rock, Ballad, 6/8, Blues Shuffle, Jazz Swing, Waltz; masing-masing memiliki kompatibilitas meter dan rentang kerapatan eksplisit.
- **Determinisme:** semua generator menerima *seed*; input + seed + `engineVersion` sama → kandidat sama.
- **Kandidat selalu jamak** (≥ 3) dengan *breakdown skor* yang faktual; bisa diaudisi; **tidak pernah** menimpa event `locked`.

**UX generator (v0.4):** panel *Generator* di dock; pilih rentang (default: seleksi) → *Buat kandidat* → daftar kartu kandidat (mini piano roll + skor + tombol ▶ Audisi) → **Terapkan** menempatkan note sebagai `source: generated` dalam satu transaksi undo; **Tolak** membuang. Tidak ada hasil opaque tunggal.

---

## 12. LLM architecture

### 12.1 Peran

LLM = **planner/proposer** yang menghasilkan *typed proposal* (JSON terstruktur). Theory engine menghasilkan note; validator memeriksa sebelum pengguna dapat *Accept*. Contoh proposal:

```json
{ "operation": "generate-bass-pattern",
  "range": { "orderEntryId": "oe_12", "startTickLocal": 0, "endTickLocal": 7680 },
  "constraints": { "minPitch": 36, "maxPitch": 60, "style": "root-fifth", "ending": "dominant-approach" } }
```

(Berbeda dari V1: rentang dinyatakan **pattern-lokal**, konsisten dengan §5.1.)

### 12.2 LLM tidak boleh

menulis langsung ke IndexedDB; mengubah note/chord `locked`; mengeksekusi JavaScript sembarang; mengirim sample/audio ke provider tanpa aksi eksplisit; menghasilkan blob opaque yang tak tervalidasi; menerima secret yang dibundle.

### 12.3 Hosting statis dan API key

Mode yang diizinkan (urut prioritas): ① **manual structured proposal** (salin prompt, tempel JSON) — default; ② **endpoint browser-safe** (HTTPS+CORS, kredensial dari user per sesi); ③ **companion bridge** lokal opsional; ④ model in-browser bila realistis kelak (tanpa mewajibkan WebGPU).

Catatan CSP: mode ② memerlukan pelonggaran `connect-src`. Karena CSP meta statis, putuskan di R8: (a) tetap tanpa mode ② dan hanya mode ①, atau (b) build varian dengan daftar endpoint yang diizinkan pengguna. Tidak ada kunci yang disimpan permanen secara default.

---

## 13. Deployment GitHub Pages

### 13.1 Model saat ini

Source tetap di `main`. GitHub Pages menyajikan branch `gh-pages` dari root, dan branch itu
diperlakukan sebagai **artifact branch**, bukan source history.

Alur operasional:

```text
gate lokal
→ npm run deploy
  ↳ npm run build
  ↳ dist/
→ temporary repository
→ commit artefak
→ force-push gh-pages
→ Pages
→ smoke live manual
```

Tidak ada GitHub Actions yang menjadi jalur deploy saat ini. Keputusan ini diambil setelah full
Playwright Chromium+Firefox berulang kali hang sangat lama pada GitHub-hosted runner, sementara
build dan instalasi browser sendiri cepat. Masalah runner itu dipisahkan dari jalur deploy agar
tidak menahan publikasi artefak yang sudah diverifikasi lokal.

### 13.2 Output build

`npm run build` membuat `dist/` (bukan bundler wajib): bersihkan `dist/`, salin runtime
statis, cap SHA/versi, salin vendor ter-pin bila ada, **validasi import relatif**, dan buat
`.nojekyll`. CSP tetap berasal dari `index.html`.

`npm run deploy` **wajib membangun ulang terlebih dahulu** sebelum
`tools/deploy-pages.mjs` menyalin `dist/` ke repository sementara. Dengan demikian artefak
lama tidak boleh ter-push hanya karena folder `dist/` kebetulan masih ada.

### 13.3 Gate dan browser regression

Sebelum deploy, jalankan gate yang relevan terhadap perubahan:

```text
npm test
npm run check
npm run build
npm run test:browser
```

Full browser regression tetap menargetkan Chromium + Firefox (§16.3), tetapi tidak dijalankan
otomatis sebagai blocking deploy pada GitHub-hosted runner selama root cause hang belum ditemukan.
Ia dapat dijalankan lokal; eksperimen CI berikutnya harus bounded dan tidak boleh otomatis
mengembalikan suite penuh sebagai blocking gate setiap push.

Jika CI ringan dikembalikan kelak, bentuk yang diinginkan adalah unit/check/build + smoke Chromium
singkat untuk jalur cepat. Full regression dapat dijalankan pada PR tertentu, manual, atau
non-blocking/nightly setelah runner terbukti stabil.

### 13.4 Smoke setelah deploy

Setelah Pages mempropagasi artefak, jalankan:

```bash
PAGE_URL="https://<user>.github.io/<repo>/" EXPECT_SHA="$(git rev-parse HEAD)" npm run test:smoke
```

Cakupan R0: `index.html` HTTP 200 · build metadata cocok dengan commit · JS entry termuat dari
subpath · tidak ada galat console · CSP tidak memblokir aset sendiri · refresh tidak 404. Butir
yang membutuhkan audio, factory sample, atau project playable baru ditambahkan saat milestone
pemilik fiturnya sudah ada.

---
## 14. Layout repository

```text
/
├── index.html  .nojekyll  package.json  README.md  PLAN.md  LICENSE
├── src/
│   ├── app.js
│   ├── core/ {model, commands, history, snapshot, focus, timeline}
│   ├── pattern/  arrangement/  piano-roll/  guitar/  notation/  lyrics/
│   ├── audio/ {scheduler, sampler, effects, offline}
│   ├── instruments/  samples/  theory/  generation/  storage/  io/ {webtrack, wav, midi}
│   ├── ui/ {kit, workspace, palette, onboarding, inspector}
│   ├── automation/  i18n/
├── styles/  assets/factory/  assets/templates/  vendor/  tools/  docs/
├── tests/ {unit, integration, browser, fixtures, golden}
└── .github/workflows/
```

Tambahan V2: `core/focus`, `core/timeline` (SongTimeline), `audio/offline`, `ui/kit|workspace|palette|onboarding|inspector`, `assets/templates`, `docs/` (catatan temuan UX, ADR). Jangan memecah modul hanya untuk terlihat "arsitektural"; pecah bila tanggung jawabnya sudah nyata.

---

## 15. Release plan

Urutan dependensi nyata (jangan paralelkan terlalu dini):

```text
R0 Fondasi + Pages + UI shell
 ↓
R1 Tracker yang bisa dimainkan
 ↓
R2 Sample + Instrument
 ↓
R3 Kematangan editing tracker + Song Map/Order
 ↓
R4 Proyek portabel + Export WAV/MIDI   ══► v0.1
 ↓
R5a Piano Roll + Fokus bersama + Split view
R5b Lyrics                              ══► v0.2
 ↓
R5c Guitar
R5d Score (hanya-baca)                  ══► v0.3
 ↓
R6 Theory + generator deterministik
R7 MIDI import                          ══► v0.4
 ↓
R8 LLM opsional                         ══► v0.5
 ↓
R9 Worklet/WASM hanya bila metrik menuntut
 ↓
R10 Impor format tracker lama bila masih bernilai
```

Setiap milestone memuat **Deliverable UX** di samping deliverable teknis.

### R0 — Fondasi statis + bukti Pages + UI shell — **CLOSED**

**Teknis:** app shell, infrastruktur Indonesia/English, design token & tema (terang/gelap/kontras tinggi), skeleton command layer + `listCommands`, tipe galat stabil, metadata build, `npm test/check/build`, Playwright Chromium+Firefox, deployment artifact branch §13, smoke pasca-deploy, CSP meta.
**UX:** **mini UI kit** (Button, Menu, Dialog+focus trap, Popover, Toast, Tabs, Splitter, Tooltip); tata letak §8.3 (top bar, tab, panel kiri/kanan, dock, status bar) dengan konten placeholder; Command Palette kosong tapi fungsional; penyimpanan ukuran panel.
**Tidak masuk:** editing pattern nyata, sample, notasi, LLM.
**Exit:** Pages live dari build `main`; branch `gh-pages` hanya berisi artefak dengan SHA build yang cocok; semua aset resolve di `/<repo>/`; refresh tidak 404; tanpa galat console; SHA/build id terbaca; deployment manual hanya dilakukan setelah gate lokal yang relevan PASS; shell lulus uji keyboard (Tab/Esc/focus trap).

### R1 — Tracker yang bisa dimainkan — **IMPLEMENTATION COMPLETE · MANUAL UAT PENDING**

**Teknis:** model Project/Pattern/Track/Order minimum; Pattern editor 8 channel × 64 baris; note entry keyboard (`KeyboardEvent.code`); oktaf + step; satu factory sample; scheduler Web Audio; Play/Pause/Stop/Seek; tempo; loop pattern; metronome; undo/redo (transaksi); JSON debug export/import; **spike efek pitch (§7.4)**; **live edit saat playback (§7.2)**.
**UX:** mode EDIT/AUDISI dengan badge & warna kursor; status bar; banner audio terkunci; **template Kosong + Pop 4/4** dan layar sambutan sederhana; empty state sel pertama; tooltip shortcut.
**Exit (UAT):** buat pattern → isi kick/snare/melodi ≥ 16 baris → Play → ubah tempo saat playback → loop 100× tanpa drift progresif → Stop/Play dari awal → undo edit note → ekspor JSON → reload → impor, hasil bunyi/baris sama. **T1 ≤ 60 dtk** (tes manual).
**Performa:** 8 channel aktif, 32 voice sintetis, 0 underrun selama 2 menit.

### R2 — Sample + Instrument

**Teknis:** impor WAV; preview waveform; root note, fine tune, volume/pan, loop; instrument single-sample; model multisample tanpa editor kompleks; **drum kit mapping + choke group + minimal polyphonic voice-lane untuk Drum Track** (satu track/header dapat memainkan beberapa piece simultan); persistensi IndexedDB; factory pack lazy; deduplikasi hash.
**UX:** tab **Sound** (mode Sederhana/Lanjutan); **seret-lepas WAV di mana saja → instrument terpasang + toast Urungkan**; picker instrumen di header channel dengan audisi ↑/↓; progress pemuatan; pesan galat WAV spesifik.
**Exit:** impor WAV user → instrument → mainkan kromatis → reload tetap bisa; satu Drum Track dapat memainkan minimal kick+snare+hi-hat secara simultan tanpa memakai tiga top-level channel; choke hi-hat; sample tak didecode berulang; WAV rusak gagal jelas tanpa merusak proyek; fuzz WAV lulus (§10.5). **T3 ≤ 90 dtk.**

### R3 — Kematangan editing tracker + struktur lagu

**Teknis:** 32 channel logis; Order List; reuse & clone pattern; seleksi blok; salin/tempel; transpose; sisip/hapus baris; interpolasi volume; kolom instrumen/volume/FX bertipe; efek v0.1; follow playback; mute/solo/volume channel; **generalisasi track polifonik + voice lane dari fondasi Drum Track R2 ke semua track**; resolusi LPB + kolom DLY.
**UX:** **Song Map + Order List (dua pandangan, data sama)**; peringatan *pattern bersama* + "Jadikan unik"; **Command Palette penuh + overlay `?`**; **dua preset keymap** (Songwriter, OpenMPT-like — diverifikasi terhadap OpenMPT); seleksi bertahap `Ctrl+A`; header channel lengkap; progressive disclosure FX.
**Exit:** lagu 8 pattern dapat disusun tanpa mouse untuk operasi dasar; pattern reuse berubah serentak, clone menghasilkan definisi baru; efek v0.1 punya tes deterministik; 32 channel tetap responsif; reorder Order tidak menggeser chord/tempo (tes properti terhadap §5.1). **T4 ≤ 20 dtk, T5 ≤ 3 mnt.**

### R4 — Proyek portabel + ekspor

**Teknis:** `.webtrack` ZIP; `manifest.json` berversi; sample by hash; migration framework; save/open; library proyek; autosave draft; pemulihan sesi minimal; multi-tab lock (§10.4); batas parser (§10.5); **Export WAV (OfflineAudioContext)**; **Export MIDI sederhana** (tempo, meter, note, velocity).
**UX:** chip status simpan; banner "belum diekspor"; dialog Buka/Simpan dengan drag-drop; template *Balada 6/8* dan *Demo lagu*; tur interaktif 5 langkah; Export dengan indikator progres.
**Exit:** proyek dengan sample kustom diekspor → storage browser dihapus → file dibuka kembali → identik secara event/pemilihan sample; serialize→deserialize→serialize stabil secara semantik; fixture satu schema sebelumnya masih terbuka; WAV hasil ekspor cocok golden dalam toleransi; MIDI terbuka benar di ≥ 1 aplikasi pihak ketiga. **T2 ≤ 2 mnt (Pattern).**

### R5a — Piano Roll + fokus bersama

**Teknis:** Piano Roll memakai note kanonik yang sama (tambah/pilih/geser/ubah durasi/multi-select/snap/zoom/follow); lane velocity; ghost notes; overlay chord & skala; **Focus Store**; **Split view**.
**UX:** alat V/B/X; padanan keyboard semua gestur; sorotan seleksi lintas view; `Alt+angka` & *Tampilkan di …*; Inspector kontekstual untuk note.
**Exit:** edit pitch di Pattern → Piano Roll bergerak; edit di Piano Roll → Pattern menampilkan (termasuk DLY untuk off-grid); undo menjaga fokus; 100% gestur punya padanan keyboard. **T2 ≤ 2 mnt (Piano Roll).**

### R5b — Lyrics

**Teknis:** `LyricBlock` & syllable berbasis occurrence; melisma; status yatim + panel Masalah; lyric lane (Piano Roll & kolom LYRIC di Pattern); sorot saat playback dengan kompensasi latensi.
**UX:** entry di atas melodi (`L`, Spasi, `-`, `~`, Enter); tulis bebas + **Sebar berurutan** dengan pratinjau diff; label occurrence; banner "dipakai di N tempat"; salin pemetaan; (opsional) saran suku kata Indonesia.
**Exit:** pattern melodi yang sama dipakai dua kali dengan lirik berbeda tanpa saling menimpa; hapus note → suku kata menjadi yatim (tidak hilang); "Jadikan unik" memindahkan anchor dengan benar; sorot suku kata tepat saat playback. **T6 ≤ 5 mnt.**

### R5c — Guitar

**Teknis:** tuning standar (model mendukung tuning lain); TAB + fretboard; kandidat fingering; `fingeringHint` non-kanonik; capo; mode kidal.
**UX:** klik fret = audisi/tulis; ketik digit di TAB; penanda pin untuk override; peringatan di luar jangkauan.
**Exit:** edit pitch → TAB/fretboard berubah; override fingering bertahan setelah reload; tidak ada note duplikat. **T7 ≤ 30 dtk.**

### R5d — Score (hanya-baca)

**Teknis:** treble staff; birama/rest/tie; tanda birama & key; chord symbol; lirik; sorot playback; kuantisasi tampilan; library notasi dipilih/di-vendor (atau implementasi sendiri bila lebih rasional).
**UX:** banner "dibulatkan (tampilan saja)"; opsi bar/baris; ekspor SVG/cetak.
**Exit (sinkronisasi penuh):** pilih note di Pattern → ubah pitch → Piano Roll bergerak → TAB/fretboard berubah → Score berubah → lirik terpetakan tetap pada occurrence yang benar → playback memakai pitch baru; golden render untuk 4/4 dan 6/8.

### R6 — Theory dan generator deterministik

**Teknis:** konteks key/skala; chord layer/editor; kandidat triad diatonik; skor harmoni fungsional; strategi Circle of Fifths; skor kadens; skor melodi sadar chord; generator bass, akomodasi chord, drum preset; kandidat ber-seed; audisi/terima/tolak; perlindungan `locked`.
**UX:** panel Generator di dock (§11); kartu kandidat dengan skor faktual; satu transaksi undo per Terima.
**Exit:** tidak pernah mengubah event `locked`; seed deterministik; kandidat tidak valid ditolak validator; pengguna selalu melihat kandidat sebelum commit; bass menghormati range; drum menolak meter tak kompatibel atau memetakan secara terdokumentasi. **T8 ≤ 2 mnt.**

### R7 — MIDI import

Impor note on/off, tempo, meter, channel→track. Tidak masuk: SysEx, automation DAW, round-trip sempurna. **Exit:** ekspor → impor kembali mempertahankan start/durasi/pitch dalam toleransi yang ditetapkan; ekspor terbuka benar di ≥ 2 aplikasi.

### R8 — LLM copilot (opsional, terbatas)

Prompt/context builder, intent & proposal schema bertipe, validator proposal, adapter JSON manual, (opsional) adapter provider browser-safe, pratinjau diff, Accept/Reject, jejak audit sederhana. **Exit:** aplikasi penuh bekerja tanpa LLM; respons malformed tidak mengubah lagu; respons yang menyentuh `locked` atau di luar rentang ditolak; tidak ada secret di repo/build; note hasil membawa `source` yang jelas.

### R9 — Gerbang AudioWorklet/WASM (bukan fitur wajib)

Hanya dibuka bila benchmark R1–R8 menunjukkan masalah nyata (mixer/worklet kustom, resampling lebih baik, filter/efek, WASM DSP, pembaca libopenmpt). Wajib ada benchmark *sebelum/sesudah*. Tidak boleh merge hanya karena WASM "lebih keren".

### R10 — Kompatibilitas format tracker (opsional)

Urutan realistis: MOD → XM → S3M → IT; ekspor hanya bila pemetaan semantik cukup aman. Bila libopenmpt/WASM dipakai, ia berada di batas impor/playback; format native tetap `.webtrack`.

---

## 16. Quality gate, pengujian, dan performa

### 16.1 Gate per PR

`npm test` · `npm run check` · `npm run build` · `npm run test:browser` · `git diff --check` bersih. Tambahan menurut area: audio → tes scheduler/integrasi audio; serialisasi → fixture/migrasi; **UI → keyboard + aksesibilitas + visual smoke + checklist heuristik §8.20**; generator → golden deterministik; Pages/build → validasi path relatif. Tidak boleh merge TODO yang menjadi syarat acceptance milestone.

### 16.2 Unit & integrasi

Unit: konversi timing, proyeksi occurrence, invarian durasi, validasi metadata sample, resolusi zona instrument, semantik efek, pemetaan lirik per occurrence, fungsi chord/teori, determinisme generator, migrasi schema, **properti: reorder Order tidak mengubah isi pattern/chord/tempo**, **properti: kuantisasi/proyeksi LPB tidak menghilangkan event**.
Integrasi: command → state kanonik; state → view; event → scheduler; simpan/muat dengan blob sample; proposal → validator → commit; **Focus Store lintas view**.

### 16.3 Browser (Playwright)

Chromium + Firefox desktop. WebKit/Safari ditambahkan sebelum klaim "stabil lintas browser". Skenario: note entry keyboard (termasuk tata letak non-US via `code`), gestur pengguna untuk audio, pattern follow, impor file, reload IndexedDB, seleksi lirik, sinkronisasi view, split view, Command Palette, onboarding.

### 16.4 Fixture golden

Proyek kecil dan legal: rock 4/4, balada 6/8, pattern berulang + lirik berbeda, WAV kustom, sample loop, subset efek, progresi chord, kandidat generator, **proyek dengan event off-grid dan track polifonik**, **proyek yang urutannya diubah**. Dipakai juga sebagai template (§6.5).

### 16.5 Budget performa (gate, bukan klaim pemasaran)

| Area | Budget |
|---|---|
| Muat awal (JS/CSS/vendor tanpa sample) | ≤ 1,5 MiB transferred; first interactive tidak menunggu factory pack; tanpa fetch pihak ketiga |
| Pattern editor | 32 channel; render hanya viewport; umpan balik tombol→sel < 50 ms; scroll tidak memicu re-render penuh |
| Piano Roll | 5.000 note: pan/zoom ≥ 50 fps pada desktop referensi |
| Audio | 32 voice aktif (R1/R2) → 64 setelah profiler; underrun = 0 pada lagu uji 2 menit |
| Waktu ke bunyi pertama (T1) | ≤ 60 dtk (manusia), ≤ 3 dtk dari load ke Play siap (mesin) |

Angka boleh naik, tidak turun diam-diam; perubahan dicatat di changelog.

---

## 17. Versioning dan disiplin delivery

**Versi terpisah:** `appVersion`, `schemaVersion`, `shareVersion`, `engineVersion`. Migrasi hanya maju; file lama terbaca selama migrasi tersedia; `engineVersion` dicatat bila hasil deterministik perlu direproduksi; payload share berversi independen; field opsional tak dikenal diabaikan bila aman; fitur wajib tak dikenal → galat inkompatibilitas eksplisit.

**Disiplin delivery (diringkas dari V1):** `main` selalu deployable; branch pendek; satu milestone bisa banyak PR vertikal; tidak ada branch "mega rewrite"; perubahan format data punya fixture sebelum merge. Milestone ditutup bila: kode merged · CI pada SHA yang sama PASS · build live di Pages · UAT browser + **uji tugas UX milestone (§8.20)** PASS · worktree bersih · rencana diperbarui sesuai fakta. Pencatatan baseline/final SHA per PR bersifat **opsional untuk pengembang tunggal**, wajib bila banyak kontributor/agent.

---

## 18. Definition of version

### v0.1 — "Tracker yang bisa dipakai dan disimpan" (R0–R4)

1. Buka Pages di browser baru → layar sambutan → pilih template *Pop 4/4* → **Play** (T1).
2. Ubah beat drum di Pattern dengan keyboard.
3. Buat channel bass, **seret WAV sendiri** ke jendela → langsung terpasang.
4. Isi bassline dan melodi; buat polifonik (chord) pada satu channel.
5. Susun ≥ 4 pattern di Song Map / Order dengan section berlabel.
6. Edit pattern bersama → muncul peringatan → "Jadikan unik".
7. Play, loop, ubah tempo saat playback; metronome & count-in.
8. Temukan sebuah command lewat Command Palette.
9. Simpan `.webtrack`; hapus data browser; buka kembali; semua sample/pattern/order identik.
10. Export WAV dan MIDI.
11. Smoke Pages build yang sama lulus di Chromium dan Firefox.
12. Uji tugas T1–T5 lulus (5 peserta).

**LLM dan generator bukan syarat v0.1.**

### v0.2 — "Menulis lagu" (R5a–R5b)

Edit melodi di Piano Roll, sinkron dengan Pattern (termasuk off-grid); split view; lirik diketik di atas melodi; Verse 1 dan Verse 2 berbagi pattern melodi tetapi liriknya berbeda; sorot suku kata tepat saat playback; T2 (Piano Roll) dan T6 lulus.

### v0.3 — "Gitar dan partitur" (R5c–R5d)

TAB/fretboard dan Score sinkron penuh dengan satu edit (uji sinkronisasi R5d); T7 lulus.

### v0.4 — "Asisten komposisi" (R6–R7)

Dari melodi + konteks chord, pengguna mendapat beberapa **kandidat pattern** yang bisa diaudisi dan dipilih, bukan satu hasil opaque; MIDI import; T8 lulus.

### v0.5 — "Copilot opsional" (R8)

Proposal LLM terstruktur melalui validator; app penuh tetap berfungsi tanpa LLM.

---

## 19. Risiko utama dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Model kanonik terlalu mirip tracker klasik | Score/Lyrics/Guitar penuh heuristik | Simpan durasi, pitch, chord, mapping lirik, efek bertipe (§5) |
| Model terlalu abstrak → tracker terasa lambat | P1 kehilangan muscle memory | Pattern & keymap first-class; model kaya tidak tampil sebagai form rumit |
| **Scope R5 terlalu besar** (V1) | Rilis fitur utama tak kunjung terjadi | R5 dipecah a–d; Score hanya-baca; Piano Roll & Lyrics duluan |
| **Polifoni vs channel monofonik** | Chord tak bisa ditulis konsisten | Voice lane (§5.4) |
| **Event off-grid tersembunyi/terkuantisasi** | Data hilang diam-diam | Resolusi LPB + kolom DLY + kuantisasi eksplisit |
| **Absolute tick pada chord/tempo** | Reorder merusak data | Anchor Pattern/occurrence tanpa absolute tick; tes properti reorder |
| **Pattern bersama mengejutkan pengguna** | Edit tak sengaja ke occurrence lain | Popover + "Jadikan unik" (§8.12) |
| Sample membuat proyek terlalu besar | Lambat/penuh | Dedup hash, lazy decode, embed hanya di bundle, batas §10.5 |
| AudioWorklet/WASM overengineering | Kompleksitas tanpa manfaat | Gerbang benchmark (R9) |
| Efek pitch tak feasible di node standar | Rencana R3 meleset | Spike di R1 (§7.4) |
| LLM menghasilkan musik "acak tapi terdengar pintar" | Kualitas tak teruji | Hanya proposal bertipe; theory engine + validator menentukan legalitas |
| API key bocor di Pages | Kebocoran kredensial | Tidak ada secret; LLM opsional & disuplai user |
| Pages jalan lokal tapi gagal di subpath | Deploy rusak | Validasi path build-time + uji artefak di subpath + smoke live |
| Durasi berbeda antara Score dan tracker | Notasi salah | `durationTicks` kanonik, `tiedToNext` |
| Lirik dan pattern berulang konflik | Lirik saling menimpa | Anchor per occurrence; tanpa `repeatCount` |
| **Storage browser terhapus** | Kehilangan karya | persist(), banner belum-diekspor, autosave + ekspor mudah |
| **Dua tab menimpa autosave** | Kehilangan data | Web Locks + mode baca-saja |
| **Keymap bentrok/berbeda tata letak** | Input salah | `KeyboardEvent.code`, dua preset, tabel konflik |
| **UI terlalu rumit bagi pendatang** | Pengguna keluar | Template, tur, progressive disclosure, uji tugas §8.20 |
| **Entry lirik terlalu lambat** | Fitur pembeda tak dipakai | Entry di atas melodi, diuji T6 |

---

## 20. Keputusan yang sengaja ditunda dan checklist sebelum coding

### 20.1 Ditunda

ekspor XM/IT · bahasa DSP kustom · WebGPU · model LLM in-browser · kolaborasi · PWA installability · cloud sync · editor multisample lanjutan · MPE · lane automasi sembarang · arsitektur plugin publik · **editing di Score** · **editing penuh di ponsel** · **rekaman mikrofon ke sample** (kandidat ringan setelah v0.2).

### 20.2 Checklist sebelum R0

**Dari V1 (tetap):**
- [x] nama produk/repo = NotaStation / `nota-station` · [x] lisensi source = MIT
- [x] bahasa UI default = Indonesia; English tersedia · [x] browser baseline = Chromium + Firefox
- [x] PPQ = 480 · [x] ekstensi native = `.webtrack`
- [x] jumlah channel awal UI R1 = 8
- [x] factory sample = asset buatan proyek sendiri; lisensi CC0-1.0 dan dicatat bersama asset
- [x] library notasi eksplisit ditunda ke R5d
- [x] Pages source = branch `gh-pages` sebagai artifact; deploy manual lewat `npm run deploy` (§13)

**Baru di V2 (keputusan model/UX yang mahal bila diubah belakangan):**
- [x] **Aturan emas**: tidak ada absolute song tick; event di-anchor ke Pattern atau OrderEntry/occurrence sesuai semantik (§5.1, §5.5)
- [x] **Voice lane** untuk track polifonik (§5.4)
- [x] `repeatCount` **dihapus** (§5.5)
- [x] Resolusi LPB + kolom DLY untuk event off-grid (§5.2, §8.6)
- [x] Mode awal Pattern mengikuti workflow: Tracker/OpenMPT-like = EDIT; Songwriter/default = AUDISI (§8.6)
- [x] Preset keymap: Songwriter (default) + OpenMPT-like; preset OpenMPT-like diverifikasi saat R3 (§8.14)
- [x] Istilah UI: "Channel" untuk lane tracker; "Track" tetap nama model data (§8.4)
- [x] Urutan rilis: Piano Roll → Lyrics → Guitar → Score (§15)
- [x] Template dikirim bertahap: Kosong + Pop 4/4 di R1; Balada 6/8 + Demo lagu di R4 (§6.5, §15)
- [ ] Peserta uji tugas UX (5 orang, campuran persona) dan tempat mencatat temuan (`docs/ux-findings.md`)
- [x] Batas parser awal (§10.5)

Nama produk final tidak diperlukan untuk memulai R0.

---

## 21. Referensi teknis (verifikasi ulang saat R0)

- GitHub Pages mendukung workflow GitHub Actions khusus untuk menyiapkan, meng-upload, dan men-deploy artefak statis.
- Web Audio API tersedia luas dan cocok sebagai baseline graph/scheduler audio; `OfflineAudioContext` untuk render offline.
- AudioWorklet berjalan di secure context; GitHub Pages memakai HTTPS. Worklet dapat menjalankan JS maupun WebAssembly sehingga WASM bisa ditambahkan belakangan tanpa menjadi dependensi baseline.
- `KeyboardEvent.code`, Web Locks, `BroadcastChannel`, dan `navigator.storage.persist()` dipakai pada §8.14 dan §10.4 — **periksa dukungan tiap browser target** di dokumentasi sebelum R3/R4.

Dokumen: docs.github.com (Pages custom workflows), developer.mozilla.org (Web Audio API, AudioWorklet, KeyboardEvent.code, Web Locks API, StorageManager.persist).

---

## 22. Kesimpulan eksekusi

Lima keputusan terpenting V2:

1. **Pattern adalah UI utama, bukan bentuk tunggal data** — dan **tidak ada event tersimpan dengan absolute song tick**. Event di-anchor ke Pattern atau OrderEntry/occurrence sesuai semantik; inilah yang menjaga reorder, reuse, lirik, chord, dan variasi occurrence tetap benar.
2. **UI dibangun di sekitar dua pintu masuk (Songwriter/Tracker) dengan satu model fokus bersama.** Tab workspace jelas, split view, lyric & chord sebagai lane, Inspector kontekstual, Command Palette, onboarding berbasis template.
3. **Rilis pertama (v0.1) = tracker yang benar-benar bisa dipakai dan disimpan**, lengkap dengan ekspor WAV/MIDI; view songwriting menyusul bertahap (Piano Roll → Lyrics → Guitar → Score).
4. **Web Audio dulu; AudioWorklet/WASM hanya berdasarkan bukti.**
5. **Theory engine dulu, LLM setelah validator matang** — dan kandidat selalu jamak, dapat diaudisi, dapat di-undo.

R0–R4 sudah menghasilkan produk yang berguna tanpa satu baris pun Score, Guitar, atau LLM. Itu disengaja: UX yang baik dibuktikan dengan pengguna yang benar-benar mendengar suara dan menyimpan karyanya, bukan dengan banyaknya fitur.

---

## Lampiran A — Temuan audit V1 dan penyelesaiannya di V2

Keparahan: **T** = Tinggi (merusak data/arah rilis/UX inti) · **S** = Sedang · **R** = Rendah.

### A.1 Yang sudah kuat di V1 (dipertahankan)

Model kanonik berbasis tick dengan durasi eksplisit · command layer tunggal · tidak ada view yang menulis state langsung · theory engine sebelum LLM, LLM sebagai proposer · WASM/AudioWorklet berbasis bukti · kontrak static-site & path subpath · kebijakan keamanan tanpa secret · lirik terikat occurrence (ide benar, detail diperbaiki) · gate kualitas & fixture golden · "tidak ada LLM di v0.1".

### A.2 Struktur dan arah rilis

| ID | Sev | Temuan | Perbaikan V2 |
|---|---|---|---|
| A1 | R | Ringkasan menyebut "empat representasi" tetapi mendaftar lima | Diperbaiki; Sound/Song ditambahkan sebagai ruang pendukung (§1) |
| A2 | S | Sasaran 2.2 (butir 11–12: generator) tidak selaras dengan DoD v0.1 yang mengecualikannya | Sasaran dipecah per versi (§2.3, §18) |
| A3 | T | v0.1 mensyaratkan semua view (R0–R5) → rilis pertama terlalu jauh; R5 menggabungkan 4 view berbeda biaya | v0.1 = R0–R4; R5 → a–d; Score hanya-baca (§15, §18) |
| A4 | S | Tidak ada ekspor audio; MIDI baru di R7 | Export WAV & MIDI sederhana dimajukan ke R4 (§7.6, R4) |

### A.3 Model data

| ID | Sev | Temuan | Perbaikan V2 |
|---|---|---|---|
| B1 | T | Chord/tempo/key memakai absolute tick, sedangkan note pattern-lokal dan Order dapat disusun ulang → data bergeser | Tidak ada absolute song tick; event di-anchor ke Pattern atau occurrence sesuai semantik; SongTimeline turunan; tes properti reorder (§4, §5.1, §5.5, §16.2) |
| B2 | T | Channel tracker monofonik vs Piano Roll/gitar polifonik tak diputuskan | Track `mono/poly` + voice lane (§5.4) |
| B3 | T | Note off-grid (Piano Roll bebas, triplet) tak punya proyeksi di Pattern → tersembunyi atau dikuantisasi diam-diam | LPB + kolom DLY + kuantisasi eksplisit (§5.2, §8.6) |
| B4 | S | `repeatCount` membuat "occurrence" lirik ambigu | Dihapus; ulangi = N OrderEntry (§5.5) |
| B5 | S | Durasi melewati batas pattern / tie tak terdefinisi | Clip oleh validator + `tiedToNext` (§5.6) |
| B6 | R | Duplikasi volume/pan antara NoteEvent dan EffectEvent | VOL = velocity; efek = perubahan setelah note on (§5.6) |
| B7 | R | Syllable tak mencatat penyambungan kata, orphan handling, dan perilaku saat pattern di-clone | `joinNext`, `phraseBreakAfter`, aturan yatim & pemindahan anchor (§5.9) |

### A.4 Audio

| ID | Sev | Temuan | Perbaikan V2 |
|---|---|---|---|
| C1 | S | Edit saat playback (live edit) tidak didefinisikan | Jendela beku 30 ms + tes (§7.2) |
| C2 | S | Playhead/sorot lirik tanpa kompensasi latensi output | Pakai `outputLatency` (§7.2) |
| C3 | S | Metronome/count-in/loop region tidak ada sebagai fitur | Transport songwriter (§7.5, §8.13) |
| C4 | R | Efek pitch pada `AudioBufferSourceNode` belum terbukti feasible | Spike R1; fallback ke R9 (§7.4) |

### A.5 UI/UX

| ID | Sev | Temuan | Perbaikan V2 |
|---|---|---|---|
| D1 | T | Satu panel tengah toggle 4 view; dock bawah mencampur Lyrics/Chord/Inspector/Generator; tidak ada split → "sinkron" sulit terlihat | Tab workspace, split view, Inspector kontekstual, lane lirik/chord (§8.2–8.3) |
| D2 | T | Tidak ada model fokus/seleksi bersama | Focus Store + aturan perilaku (§8.5) |
| D3 | T | Tidak ada onboarding, template, empty state; time-to-first-sound tak terukur | Layar sambutan, template, tur, T1 (§8.15, §8.20) |
| D4 | S | Command layer ada tetapi tak ada Command Palette/bantuan shortcut → fitur sulit ditemukan | Command Palette + overlay `?` + `listCommands` (§8.14, §9) |
| D5 | S | "Mode edit/select eksplisit" tanpa default, indikator, atau umpan balik | EDIT/AUDISI, warna kursor, badge status (§8.6) |
| D6 | S | Jebakan pattern bersama: edit memengaruhi occurrence lain tanpa peringatan | Popover + "Jadikan unik" (§8.12) |
| D7 | S | Alur lirik = textarea + pemetaan terpisah → lambat | Entry di atas melodi, Sebar berurutan, lane lirik (§8.8) |
| D8 | S | Menambah suara butuh banyak langkah; panel Instrument permanen memakan ruang | Seret-lepas WAV, picker dengan audisi, tab Sound, mode Sederhana/Lanjutan (§8.11) |
| D9 | S | Tata letak keyboard non-US dan satu keymap; bentrok huruf vs shortcut | `KeyboardEvent.code`, dua preset, aturan modifier, keyboard layar (§8.14) |
| D10 | R | Istilah campur tracker/songwriter | Glosarium + tooltip + "Channel" seragam (§8.4) |
| D11 | S | Hanya kriteria fungsional, tak ada ukuran UX | Uji tugas T1–T8, 5 peserta (§8.20) |
| D12 | R | Responsif/sentuh tak dibahas | Cakupan jujur per lebar layar (§8.18) |
| D13 | S | Status simpan/audio/galat tidak dispesifikasikan | Tabel umpan balik (§8.16) |
| D14 | S | Undo/redo hanya disebut, tanpa granularitas/cakupan | Spesifikasi transaksi & cakupan global (§8.17) |

### A.6 Keamanan, penyimpanan, deploy, proses

| ID | Sev | Temuan | Perbaikan V2 |
|---|---|---|---|
| E1 | S | Parser "bounded" tanpa angka; risiko ZIP bomb | Tabel batas + fuzz (§10.5) |
| E2 | S | IndexedDB: multi-tab, kuota/eviction, `persist()` tak dibahas | §10.4, banner belum-diekspor (§8.16) |
| E3 | S | YAML: build dua kali; tes tidak menguji artefak yang dideploy; deploy bisa jalan dari `workflow_dispatch` non-main; smoke pasca-deploy tidak ada di YAML; versi action perlu diverifikasi | §13.3 |
| E4 | R | CSP lewat meta tak disebut; dampaknya ke adapter LLM | §3.4, §12.3 |
| E5 | R | Ritual SHA/worktree terlalu berat untuk pengembang tunggal | Diringkas, bagian opsional (§17) |
| E6 | R | Input keyboard MIDI (Web MIDI) tidak dipertimbangkan | Progressive enhancement (§7.9) |

**Total: 35 temuan (7 Tinggi, 19 Sedang, 9 Rendah).** Ketujuh temuan Tinggi (A3, B1, B2, B3, D1, D2, D3) menyangkut model data, arah rilis, dan UX inti; keputusannya harus dikunci sebelum schema pertama (checklist §20.2).
