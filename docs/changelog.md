# Changelog

Format singkat: satu entri per slice/PR yang menutup bagian dari milestone.
Milestone ditutup hanya bila Exit criteria di PLAN.md terpenuhi semua.

## R2 — Sample + Instrument (ACTIVE)

### R2-S7 — editor Sample/Instrument + waveform (CLOSED · PASS)

- Sound workspace kini memiliki pemilihan Instrument, mode **Sederhana/Lanjutan**, waveform preview, dan editor root note, fine tune, volume, pan, loop, ADSR, serta loop frame.
- Perubahan parameter menggunakan model kanonik Sample/Instrument dan satu transaksi history; Undo hanya membatalkan edit Sound yang sesuai.
- Waveform diringkas langsung dari PCM/float WAV tanpa `decodeAudioData`, sehingga preview tidak menambah decode audio kedua.
- Ditambahkan parser waveform bounded untuk PCM 8/16/24/32-bit dan float32.
- Factory WAV lama ditemukan tidak memiliki RIFF pad byte untuk data ganjil 1543 byte. Fixture internal diperbaiki menjadi RIFF-valid tanpa mengubah PCM; content hash factory diperbarui ke `1239a698…`.
- Nilai loop/ADSR invalid ditolak fail-closed tanpa mutasi Project.
- Gate final run **37294978888** pada HEAD `d85ffff…`: 0 vulnerability, unit **83/83 PASS**, check PASS, build **255.8 KiB PASS**, browser Sound editor/import/playback Chromium+Firefox **16/16 PASS**.
- Berikutnya: **R2-S8 drag-drop WAV global + picker Instrument di header channel dengan audisi keyboard**.

### R2-S6 — Sound workspace + Import WAV UI (CLOSED · PASS)

- Tab **Sound** kini menjadi workspace nyata untuk memilih track tujuan, mengimpor WAV, melihat daftar Sample/Instrument, dan status proses/galat.
- Import UI memakai pipeline R2 yang sama dengan core: parse/hash → persist IndexedDB → commit Project → pasang Instrument ke track.
- Import dapat di-Undo dari toast melalui history. Undo hanya berjalan bila top history masih `io.importWav`, sehingga tidak dapat membatalkan edit lain yang terjadi sesudah import.
- Undo memulihkan Project/track assignment, sedangkan bytes sample tetap tersimpan di IndexedDB untuk dedup dan tidak dihapus destruktif.
- WAV rusak menampilkan error code spesifik tanpa mengubah Project.
- Gate final run **37293657677** pada HEAD `8750980…`: 0 vulnerability, unit **78/78 PASS**, check PASS, build **236.0 KiB PASS**, browser Sound/import/shell/storage Chromium+Firefox **62/62 PASS**.
- Berikutnya: **R2-S7 editor Sample/Instrument + waveform + mode Sederhana/Lanjutan**.

### R2-S5 — custom sample playback melalui model Instrument (CLOSED · PASS)

- Audio engine kini resolve Instrument → Zone → Sample secara data-driven; tuning, gain, pan, ADSR, dan loop dibaca dari model R2.
- Sample kustom dari IndexedDB dipreload/decode sebelum transport mulai, sehingga scheduler tetap sinkron dan tidak melakukan await di schedule window.
- Decoded buffer menggunakan cache contentHash S4; Stop→Play kedua tidak decode ulang.
- Factory preview R1 tetap kompatibel, sementara playback note sampler memakai voice profile kanonik.
- Live edit dapat memperluas profile untuk pitch baru bila sample sudah ada di cache; instrument baru yang belum dipreload tidak dipaksakan saat playback.
- App menyediakan Sample Store secara lazy hanya ketika sample IndexedDB benar-benar dibutuhkan.
- Gate awal merah karena tombol probe tertutup welcome dialog; runtime belum dieksekusi. Test harness dikoreksi memakai `gotoApp()`.
- Gate final run **37284888566**: 0 vulnerability, unit **78/78 PASS**, check PASS, build **222.4 KiB PASS**, browser custom playback/audio/import Chromium+Firefox **10/10 PASS**.
- Berikutnya: **R2-S6 Sound workspace + Import WAV UI**.

### R2-S4 — import transaction + decode cache boundary (CLOSED · PASS)

- Ditambahkan commit Project murni setelah persistence sukses: Sample/Instrument masuk secara atomik dan track tujuan menunjuk instrument baru.
- Candidate stale tetap dedup berdasarkan contentHash dan zone diremap ke Sample existing; collision track/instrument ditolak tanpa mutasi Project.
- Ditambahkan decoded sample cache keyed contentHash; concurrent request untuk hash identik coalesce menjadi satu load + satu decode, termasuk alias Sample dengan ID berbeda.
- Failure decode tidak meracuni cache; retry berikutnya tetap dapat berhasil.
- Loader bytes memahami factory sample lazy dan storageRef IndexedDB.
- Gate run **37283388036**: 0 vulnerability, unit **75/75 PASS**, check PASS, build **212.0 KiB PASS**, browser import/cache/storage Chromium+Firefox **8/8 PASS**.
- Berikutnya: **R2-S5 custom sample playback melalui Instrument/Zone/ADSR/pan model R2**.

### R2-S3 — persistensi sample + dedup IndexedDB (CLOSED · PASS)

- Ditambahkan sample store IndexedDB hash-addressed; key berasal dari SHA-256 sehingga dedup ditegakkan oleh storage, bukan hanya state Project.
- `putIfAbsent` berjalan atomik pada readwrite transaction; concurrent import bytes identik menghasilkan tepat satu record.
- Bytes sample dapat diambil kembali identik setelah page reload; tersedia lookup, delete, stats, clear, dan penutupan database.
- Adapter S2 → S3 memverifikasi bytes masih cocok dengan SHA-256 hasil prepare sebelum persistence; perubahan bytes setelah prepare ditolak `E_WAV_HASH_MISMATCH`.
- Error IndexedDB dipetakan ke code spesifik termasuk quota/version/blocked/unavailable.
- Gate run **37282736463**: 0 vulnerability, unit **68/68 PASS**, check PASS, build **203.8 KiB PASS**, browser storage/import Chromium+Firefox **6/6 PASS**.
- Berikutnya: **R2-S4 import transaction Project + sample decode/cache boundary**.

### R2-S2 — parser dan fondasi import WAV (CLOSED · PASS)

- Ditambahkan parser RIFF/WAVE bounded/fail-closed dengan batas resmi §10.5: satu WAV ≤100 MiB, mono/stereo, sample rate ≤192 kHz.
- Format baseline yang didukung: PCM integer 8/16/24/32-bit, IEEE float32, serta WAVE_FORMAT_EXTENSIBLE untuk PCM/float modern.
- Parser menangani unknown chunk + padding, memvalidasi fmt/data, blockAlign, byteRate, frameCount, dan memberi error code `E_WAV_*` spesifik untuk input malformed/unsupported.
- Fondasi import menghitung SHA-256, membentuk candidate Sample + Instrument tanpa memutasi Project, dan melakukan dedup candidate berdasarkan content hash.
- Ditambahkan fuzz malformed WAV deterministik dan browser regression untuk parse + SHA-256 + candidate import pada Chromium/Firefox.
- Gate run **37273674544**: 0 vulnerability, unit **66/66 PASS**, check PASS, build **194.3 KiB PASS**, browser WAV import **2/2 PASS**.
- Berikutnya: **R2-S3 persistensi sample + dedup IndexedDB**.

### R2-S1 — model Sample + Instrument kanonik (CLOSED · PASS)

- Ditambahkan kontrak kanonik `Sample` dan `Instrument` sesuai §6: metadata WAV, SHA-256, root note, fine tune, gain, loop, storageRef, sampler zones, ADSR, default pan, dan choke group.
- Factory sample R1 kini memiliki metadata WAV nyata: mono, 11.025 Hz, 1.543 frame, SHA-256 `78a8007e…`.
- Nilai gain/pan/envelope menjadi data instrument, bukan konstanta UI/fixture.
- Debug JSON R1 lama tetap dapat dibuka melalui normalisasi bentuk legacy `{sampleId, rootPitch}` ke model R2.
- Validator mengunci Track → Instrument dan Instrument Zone → Sample reference.
- Gate run **37272287512**: 0 vulnerability, unit **59/59 PASS**, check PASS, build **184.5 KiB PASS**, Playwright Chromium+Firefox **154/154 PASS**.
- Berikutnya: **R2-S2 WAV parser/import foundation**.

## R1 — Tracker yang bisa dimainkan (ACTIVE)

### UAT correction — rebalance sustain vs percussion (PASS)

- Setelah sustain nyata ditambahkan, re-test pendengaran menemukan Lead terlalu dominan dan menutupi channel lain; perkusi menjadi terlalu lemah.
- Mix fixture dikoreksi: Lead/Harmony/Bass sedikit diturunkan, kick/snare/hi-hat dinaikkan moderat. Sustain tetap dipertahankan.
- Gate run **37258776104**: 0 vulnerability, unit **53/53 PASS**, check/build PASS (**175.3 KiB**), browser demo/audio Chromium+Firefox **10/10 PASS**.
- Status pendengaran: **FIX DEPLOY PENDING / perlu user re-test**.

### UAT correction — sustain note nyata pada demo stabilitas (PASS)

- Re-test UAT menemukan semua instrument memang bersuara, tetapi hampir seluruh note masih pendek satu row sehingga belum ada beban sustain yang representatif.
- `enterNote()` kini boleh menerima `durationTicks` eksplisit dengan validasi ketat; default tetap satu row sehingga perilaku editor R1 lama tidak berubah.
- Fixture **Malam Kota** kini memakai duration musikal nyata: Bass **4 row**, Lead **8 row (~1,03 dtk)**, Harmony **16 row / satu bar (~2,07 dtk)**. Arpeggio dan perkusi tetap pendek sebagai kontras.
- Voice tonal demo memakai envelope attack/hold/release; sustain tidak lagi sekadar decay pendek.
- Track mono Bass/Lead/Harmony tidak overlap dengan note berikutnya; duration tetap pattern-local dan tidak memperkenalkan `absoluteTick`.
- Gate run **37257507901**: 0 vulnerability, unit **53/53 PASS**, check/build PASS (**175.3 KiB**), browser sustain/demo Chromium+Firefox **10/10 PASS**.
- Status UAT: **FIX DEPLOY PENDING / perlu user re-test sustain melalui Solo channel 7**.

### UAT correction — observability channel + follow Pattern (PASS)

- Re-test pendengaran menunjukkan channel 6–8 sulit dibuktikan karena UI belum punya
  **meter, Mute, Solo**, dan Pattern tidak mengikuti playback.
- Audio engine kini punya bus per channel. Setiap bus memiliki gain + `AnalyserNode`,
  sehingga Mute/Solo bekerja pada audio yang sudah terjadwal dan meter membaca RMS
  output pasca M/S.
- Header Pattern menampilkan tombol **M/S** dan meter untuk semua 8 channel.
  Solo membuat channel lain benar-benar inaudible; Mute bekerja independen dari Solo.
- Pattern kini menampilkan row playhead dan auto-scroll mengikuti `positionTick` transport.
  Follow memakai clock audio yang sama dengan scheduler, bukan timer UI baru.
- Gate runtime run **37255524367**: 0 vulnerability, unit **52/52 PASS**,
  check/build PASS (**174.4 KiB**), browser audio/pattern Chromium+Firefox
  **46/46 PASS**. Chromium membuktikan meter RMS channel 6–8 benar-benar bergerak;
  Firefox headless tetap membuktikan M/S dan follow-scroll.
- Dua commit test setelah gate hanya menstabilkan assertion timing/headless; runtime
  tidak berubah dari head yang sudah PASS.
- Status UAT: **FIX DEPLOY PENDING / perlu user re-test channel 6–8 dan follow scroll**.

### UAT correction — balance tonal demo stabilitas (PASS)

- Re-test pendengaran setelah pemisahan timbre menemukan masalah kedua: perkusi sudah
  berbeda, tetapi **bass/arp/lead/harmony tertutup oleh kick/snare/hat** sehingga secara
  subjektif yang terdengar hampir hanya perkusi.
- Mix fixture dikoreksi tanpa mengubah engine project normal: gain kick/snare/hat/fill
  diturunkan, bass/lead/harmony dinaikkan, low-pass tonal dilonggarkan, dan envelope
  instrumen tonal diperpanjang agar tidak terdengar seperti klik bernada.
- Velocity pattern juga diseimbangkan: perkusi turun; bass, arpeggio, harmony, dan lead naik.
- Gate final run **37254342676**: 0 vulnerability, unit **52/52 PASS**,
  check/build PASS (**163.6 KiB**), browser demo/audio Chromium+Firefox **8/8 PASS**;
  demo berjalan >2 loop pada kedua browser.
- Status pendengaran: **FIX DEPLOY PENDING / perlu user re-test**.

### UAT correction — timbre demo benar-benar terpisah (PASS)

- UAT manual menemukan cacat pada fixture **Malam Kota**: delapan channel diberi label
  Kick/Snare/Hi-Hat/Bass/Arpeggio/Lead/Harmony/Fill, tetapi semuanya masih memakai
  `factory.basic`, sehingga secara pendengaran terdengar seperti satu instrumen.
- Scheduler kini meneruskan `trackId` + `instrumentId` ke engine. Project normal R1 tetap
  memakai jalur sample `factory.basic`; hanya instrument `demo.*` yang memakai voice UAT.
- Delapan timbre demo sekarang benar-benar berbeda: kick sine pitch-drop, snare noise
  band-pass, hi-hat noise high-pass, triangle bass, square arpeggio, saw lead,
  sine harmony, dan pitch-drop tom/fill. Stereo pan ringan membantu pemisahan.
- Observability `scheduledInstrumentIds` membuktikan scheduler dispatch instrument yang
  benar. Chromium dengan AudioContext `running` harus mencapai semua 8 instrument;
  Firefox headless yang menahan context `suspended` diverifikasi pada horizon awalnya.
- Full suite sebelum koreksi assertion menghasilkan **147/148 PASS**; satu-satunya failure
  adalah asumsi Firefox headless harus menggerakkan audio clock. Delta gate final run
  **37253227646**: 0 vulnerability, unit **52/52 PASS**, check/build PASS
  (**163.6 KiB**), browser audio/demo Chromium+Firefox **42/42 PASS**.
- Status pendengaran: **FIX DEPLOY PENDING / perlu user re-test**.

### UAT fixture — Malam Kota Stability Loop (PASS)

- Ditambahkan demo langsung `?demo=stability` tanpa memperluas daftar template R1.
- Lagu uji **Malam Kota — Stability Loop**: 116 BPM, A minor, 4 bar, 8 channel,
  dan **151 note**. Progression Am → F → C → G dengan pulse kick/snare/hi-hat,
  bass root/fifth, arpeggio, lead, harmony, dan fill.
- Query demo melewati welcome tetapi tidak menulis status first-run ke localStorage,
  sehingga fixture dapat dipakai berulang tanpa mengotori onboarding normal.
- Regression playback membiarkan demo berjalan **18 detik (>2 putaran)** pada
  Chromium dan Firefox; scheduler tetap aktif, loop tetap aktif, schedule revision
  tidak berubah, dan tidak ada page error.
- Gate run **37251979274**: `npm ci` 0 vulnerability, unit **52/52 PASS**,
  `npm run check` PASS, build **156.1 KiB PASS**, Playwright Chromium+Firefox
  **146/146 PASS** (1,4 mnt).

### S12 — Automated exit R1 (PASS)

- Ditambahkan skenario browser end-to-end yang mengikuti jalur exit R1: first-run
  Pop 4/4 → Play → buat Pattern 16 note → ubah tempo saat playback → Stop →
  hapus note + Undo → export JSON debug → reload → import → state semantik sama →
  Play kembali.
- T1 mesin dari load hingga playback siap berada jauh di bawah budget 3 detik:
  **572 ms Chromium** dan **918 ms Firefox** pada gate final.
- Drift loop 100× tetap dibuktikan oleh unit scheduler deterministik yang menghitung
  event dari anchor + cycle × duration, bukan dari akumulasi timer.
- Gate final run **37246931905** pada clean stack R1: `npm ci` 0 vulnerability,
  unit **50/50 PASS**, `npm run check` PASS, build **151.1 KiB PASS**,
  Playwright Chromium+Firefox **142/142 PASS** (1,1 mnt).
- Implementasi otomatis R1 dinyatakan lengkap. Milestone **belum CLOSED** sampai build
  live lulus smoke, T1 manual/uji tugas UX selesai, dan uji audio real-time 2 menit
  membuktikan 0 underrun pada mesin referensi.

### S13 — Empty state sel pertama Pattern (PASS)

- Pattern kosong kini memberi cue langsung pada sel NOTE pertama: `Z=C`, dengan
  keterangan aksesibel "Mulai di sini: tekan Z untuk C; Ctrl+E untuk EDIT."
- Cue hanya muncul ketika Pattern benar-benar belum punya note; setelah note ditulis ia
  berubah ke pitch normal, dan kembali bila note terakhir dihapus.
- Regression lama diperbarui karena kontrak blank-cell memang berubah dari `···` ke cue
  onboarding yang eksplisit.
- Gate final run **37243711069** di atas main yang sudah memuat S14: `npm ci` 0 vulnerability,
  unit **50/50 PASS**, `npm run check` PASS, build **151.1 KiB PASS**,
  Playwright Chromium+Firefox **138/138 PASS** (46,2 dtk).

### S14 — Tooltip shortcut R1 (PASS)

- Tooltip untuk kontrol yang memang punya shortcut kini menampilkan shortcut nyata:
  Play/Stop = `Space`, mode EDIT/AUDISI = `Ctrl+E`, oktaf turun/naik = `-` / `=`,
  dan Command Palette tetap `Ctrl+K`.
- Tidak ada shortcut baru atau pemetaan palsu; slice ini hanya membuat affordance keyboard
  yang sudah aktif menjadi terlihat sesuai UX R1.
- Gate final run **37243473096**: `npm ci` 0 vulnerability, unit **50/50 PASS**,
  `npm run check` PASS, build **150.5 KiB PASS**, Playwright Chromium+Firefox
  **136/136 PASS** (47,1 dtk).

### S11 — Banner aktivasi audio (PASS)

- Saat Web Audio masih terkunci, shell menampilkan banner eksplisit dengan aksi
  **Aktifkan audio**; status ini tidak hanya diwakili warna atau pesan console.
- Tombol banner memakai command `playback.activateAudio` dan primitive
  `audio.activate()`; jalur yang sama tetap dipakai Play/audition sehingga tidak ada
  AudioContext kedua atau state paralel.
- Aktivasi dari gestur tepercaya menyiapkan factory sample dan mengubah status
  `locked → ready`; Play dari gestur pengguna juga otomatis menghilangkan banner.
- String banner/aksi parity Indonesia-English telah diaudit; regresi browser menguji
  aktivasi eksplisit dan aktivasi lewat Play tanpa page error.
- Gate final run **37243045844** di atas stack S9+S10: `npm ci` 0 vulnerability,
  unit **50/50 PASS**, `npm run check` PASS, build **150.2 KiB PASS**,
  Playwright Chromium+Firefox **134/134 PASS** (1,1 mnt).
- **Belum menutup R1**: automated exit final + publish live + UAT manusia dan
  uji audio real-time 2 menit masih tersisa.

### S10 — Kesiapan audio + proof 32 voice (PASS)

- Audio engine menambah primitive `activate()` yang memakai jalur `ensureReady()` yang sama
  dengan Play/audition, sehingga UI dapat membuka audio dari gestur tepercaya tanpa
  mengekspos `AudioContext`.
- Browser probe mengaktifkan engine dari klik pengguna, memuat factory sample sekali, lalu
  menjadwalkan **32 preview voice aktif** dalam satu jendela waktu.
- Proof dijalankan pada Chromium + Firefox; `activeVoices === 32`, sample siap, dan
  context berada pada state browser-valid (`running` atau `suspended` saat policy browser
  masih menyelesaikan resume).
- Gate final run **37242834683** di atas main yang sudah memuat S9: `npm ci` 0 vulnerability,
  unit **50/50 PASS**, `npm run check` PASS, build **148.7 KiB PASS**,
  Playwright Chromium+Firefox **130/130 PASS** (1,1 mnt).
- **Belum dianggap membuktikan 0 underrun 2 menit**: Web Audio tidak menyediakan counter
  underrun portabel; syarat itu tetap UAT audio real-time/manual R1.

### S9 — Template R1 + first-run welcome (PASS)

- R1 mengirim dua template sesuai roadmap: **Kosong** dan **Pop 4/4**. Pop 4/4 memakai
  factory sound R1 yang sama tetapi sudah berisi guide kick/snare/bass/melodi agar pengguna
  dapat langsung menekan Play dan mengedit pola.
- First-run welcome tampil sekali dan menyediakan bahasa Indonesia/English, preset keymap,
  template, serta aksi **Lewati**. Default template adalah Pop 4/4 untuk memperpendek T1.
- Pilihan keymap tidak kosmetik: Songwriter membuka Pattern dalam **AUDISI**; OpenMPT-like
  membuka Pattern dalam **EDIT**. Shortcut OpenMPT-like lengkap tetap milestone R3.
- Jalur UI dan agent memakai command yang sama, `project.loadTemplate`; mengganti template
  mereset history dan membangun ulang Pattern view dengan preference project baru.
- Locale dan keymap first-run disimpan sebagai preference sesi/browser. Reload tidak
  memunculkan welcome lagi setelah pengguna menyelesaikan atau melewatinya.
- Ditambahkan scaffold `docs/ux-findings.md` dan `docs/r1-uat.md`; hasil manusia belum
  diisi dan tidak dianggap PASS sebelum sesi nyata dilakukan.
- Gate final run **37242568013**: `npm ci` 0 vulnerability, unit **50/50 PASS**,
  `npm run check` PASS, build **148.6 KiB PASS**, Playwright Chromium+Firefox
  **128/128 PASS** (58,1 dtk).
- **Belum menutup R1**: banner audio terkunci, proof 32 voice, publish live, UAT manusia,
  dan uji underrun audio real-time 2 menit.

### S7 — JSON debug export/import (PASS)

- Tambah format debug `.webtrack.json` untuk fixture/test dan round-trip proyek R1
  tanpa sample binary. Ini **bukan** format portable final `.webtrack` ZIP milik R4.
- Export memakai serialisasi deterministik `JSON.stringify(..., 2)` + newline akhir dan
  nama file aman dari judul project.
- Import bersifat **fail-closed**: parse + validasi selesai sebelum audio/history/project
  disentuh. JSON rusak, schema asing, reference putus, duplicate cell/id, nilai note
  invalid, `absoluteTick`, kedalaman >64, dan ukuran >10 MiB ditolak.
- Import sukses menghentikan playback, mengganti project, dan mereset history sehingga
  state hasil import menjadi baseline baru, bukan satu langkah Undo yang ambigu.
- Command Palette dan hook agent memakai command yang sama: `io.exportDebugJson` dan
  `io.importDebugJson`; UI mendukung download dan file picker.
- Regression membuktikan export → reload → import mempertahankan note row + tempo,
  invalid import tidak mengubah project aktif, dan download memakai ekstensi
  `.webtrack.json`.
- Gate final run **37234663403**: `npm ci` 0 vulnerability, unit **43/43 PASS**,
  `npm run check` PASS, build **136.6 KiB PASS**, Playwright Chromium+Firefox
  **118/118 PASS** (54,2 dtk).
- **Belum menutup R1**: template/welcome, final UAT/performa, dan publish closure R1.

### S8 — Spike pitch AudioParam (PASS)

- Spike §7.4 membuktikan **pitch slide, portamento, dan vibrato** dapat dijadwalkan
  pada `AudioBufferSourceNode.playbackRate` tanpa AudioWorklet/WASM.
- Pitch slide/portamento memakai rasio equal temperament + automation
  `setValueAtTime` / `exponentialRampToValueAtTime`; vibrato memakai
  `setValueCurveAtTime` dengan kurva rasio positif.
- Implementasi ini tetap spike teknis: belum mengunci schema efek atau UI R3 dan belum
  dipasang ke engine produksi.
- Browser probe memakai `OfflineAudioContext` nyata dan berhasil merender output non-zero
  untuk ketiga jenis automation pada Chromium + Firefox.
- Gate final run **37234278990**: `npm ci` 0 vulnerability, unit **43/43 PASS**,
  `npm run check` PASS, build **130.4 KiB PASS**, Playwright Chromium+Firefox
  **114/114 PASS** (54,8 dtk).
- Keputusan: efek pitch tetap feasible untuk R3; **tidak perlu dipindahkan ke R9**.

### S6 — Live-edit scheduler + freeze window 30 ms (PASS)

- Edit note saat playback kini tidak me-restart transport. `pattern.enterNote`,
  `pattern.deleteNote`, `pattern.updateNote`, serta Undo/Redo note membangun ulang
  hanya jadwal note masa depan melalui `reschedulePattern()`.
- Freeze window dikunci ke **30 ms**: event dengan waktu mulai `< now + 30 ms` dianggap
  beku dan tidak disentuh; event pada atau setelah batas tersebut boleh dibatalkan dan
  dijadwalkan ulang.
- Source audio dibedakan menjadi `note`, `preview`, dan `metronome`. Live edit hanya
  membatalkan scheduled note yang mutable; preview audition dan click metronom tidak ikut
  tersapu.
- Phase transport tetap memakai anchor playback lama. Scheduler note boleh memiliki
  `noteAnchor` sendiri setelah live edit, sehingga perubahan Pattern tidak menaikkan
  `scheduleRevision` dan tidak menggeser posisi transport.
- Observability S6 menambah `liveEditRevision`, `liveEditCanceledNotes`,
  `lastLiveEditCanceledNotes`, `lastLiveEditFreezeTick`,
  `liveEditFreezeSeconds`, dan `scheduledNoteSources`.
- Regression membuktikan batas freeze tepat 30 ms, add/delete saat loop berjalan,
  cancellation note masa depan tanpa duplicate, serta Undo note saat playback tanpa
  re-anchor transport. Harness browser dibuat deterministik tanpa menunggu wall-clock
  atau kemajuan `AudioContext.currentTime` headless.
- Gate final run **37233148891** pada runtime HEAD `42dcb9d4…`: `npm ci` PASS,
  unit **40/40 PASS**, `npm run check` PASS, build PASS, dan Playwright
  Chromium+Firefox **112/112 PASS** (40,2 dtk).
- **Belum menutup R1**: JSON debug export/import, spike teknis pitch effect / AudioParam,
  template/welcome project, serta final UAT/performance dan pemeriksaan Exit criteria R1.


### S5 — Pause/seek/metronom + tempo live re-anchor (PASS)

- Transport Pattern kini lengkap untuk pekerjaan dasar: **Play, Pause/Resume, Stop, Seek**,
  loop Pattern, tempo, dan metronom. Posisi transport diturunkan dari
  `AudioContext.currentTime`; timer hanya membangunkan look-ahead scheduler.
- Pause menangkap tick saat ini dan resume melanjutkan dari tick tersebut. Seek dapat dilakukan
  saat diam maupun playback; Stop mengembalikan posisi ke awal Pattern.
- Metronom mengikuti meter Pattern, memberi accent pada awal bar, dan dijadwalkan lewat audio
  clock yang sama dengan note. Toggle loop/metronom adalah state sesi dan tidak mengotori
  history project.
- Perubahan tempo saat playback tidak lagi menghentikan transport: scheduler di-*re-anchor*
  pada tick kini dengan tempo baru. `scheduleRevision` dipakai sebagai observability
  deterministik agar regresi lintas-browser tidak bergantung pada perilaku clock headless.
- Scheduler mendukung `startTick`, seek, metronom, dan uji **100 loop tanpa drift progresif**.
  Kontrak S4 `durationSeconds` tetap dipertahankan untuk kompatibilitas.
- Topbar tetap compact: aksi universal memakai ikon `▶ ⏸ ■ ↻ ♩`, sedangkan tempo, meter,
  dan seek memakai kontrol yang lebih jelas; semuanya tetap punya accessible name/tooltip.
- Gate final setelah koreksi regresi: `npm ci` **0 vulnerability**, unit **39/39 PASS**,
  `npm run check` PASS, build **123.6 KiB PASS**, Playwright Chromium+Firefox
  **108/108 PASS** (42,8 dtk).
- **Belum menutup R1**: live-edit add/delete dengan cancel/freeze window scheduler,
  JSON debug import/export, spike efek pitch, template/welcome, serta UAT/performance exit.


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