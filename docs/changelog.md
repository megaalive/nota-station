# Changelog

Format singkat: satu entri per slice/PR yang menutup bagian dari milestone.
Milestone ditutup hanya bila Exit criteria di PLAN.md terpenuhi semua.

## R3 — Kematangan editing tracker + struktur lagu (ACTIVE)

### R3-S11 — transport Song/Section lintas OrderEntry (CLOSED · PASS)

- `Space` tetap menjalankan Pattern; `Shift+Space` menjalankan `playback.playSectionStart` dari awal run Section kontigu occurrence fokus, lalu meneruskan playback melintasi Order dengan satu audio-clock anchor dan look-ahead scheduler.
- SongTimeline hanya proyeksi; tick song-global tidak masuk data tersimpan. Event runtime memiliki identitas occurrence, FX volume/pan kembali ke baseline di boundary, metronome memakai meter Pattern aktif, dan focus mengikuti occurrence tanpa menulis Project.
- Live edit menjadwalkan ulang semua occurrence future Pattern yang dipakai ulang setelah freeze window. Stop membersihkan source, scheduler, dan FX future. Pause Song menghentikan scheduler dengan state konsisten; resume Song-mode belum didukung.
- Gate lokal Windows: `npm ci` 0 vulnerability; unit **221/221 PASS**; check PASS; build **618,2 KiB**; targeted Chromium + Firefox **84 PASS + 4 skip lama**; full Chromium + Firefox **324 PASS + 4 skip lama** pada dua worker.
- Run penuh empat worker sempat memunculkan tiga timeout Firefox lama; keenam tes terkait lulus saat diisolasi dan run penuh dua worker lulus. Empat skip realtime AudioContext Firefox tetap sama.
- Gap teknis transport R3 tertutup. Milestone tetap **ACTIVE** sampai uji tugas moderator §8.20 T4/T5 terpenuhi; hasil manual belum tersedia.

### R3-S10G — 8-Pattern keyboard arrangement exit proof (CLOSED · PASS)

- Exit criterion R3 “lagu 8 Pattern dapat disusun tanpa mouse untuk operasi dasar” kini memiliki browser proof lintas-engine.
- Fixture memuat 8 Pattern/occurrence; setelah fixture siap, seluruh operasi arrangement dilakukan lewat keyboard: `Alt+1` membuka Song, panah memilih occurrence, `Alt+Arrow` reorder, `Ctrl+D` reuse, dan `Ctrl+Shift+D` membuat occurrence target unik.
- Test memverifikasi urutan Order, jumlah Pattern, focused OrderEntry, reuse semantics, make-unique semantics, dan label history tanpa mouse.
- Slice ini test-only; tidak ada perubahan runtime.
- Gate final GitHub run **37705402063**: 0 vulnerability, unit **207/207 PASS**, `npm run check` PASS, build **578,9 KiB**, targeted browser **2/2 PASS** (Chromium + Firefox).
- Milestone R3 tetap aktif hanya untuk gap keymap/transport Songwriter `Shift+Space = mulai dari awal section`; exit teknis lain yang tercantum di PLAN sudah memiliki bukti otomatis.

### R3-S10F — property proof reorder chord/tempo (CLOSED · PASS)

- Exit criterion R3 “reorder Order tidak menggeser chord/tempo” kini dikunci oleh property-style regression, bukan hanya satu contoh.
- Fixture membangun **8 Pattern/occurrence** dengan ChordEvent dan tempoEvents pattern-local yang berbeda, lalu menguji seluruh **64 pasangan** `fromIndex → toIndex`.
- Untuk setiap move, seluruh `song.patterns`, chord, tempoEvents, dan tick lokal wajib identik; hanya urutan OrderEntry yang boleh berubah. Input project juga wajib tetap immutable.
- Slice ini test-only; tidak ada perubahan runtime/model.
- Gate final GitHub run **37705080384**: 0 vulnerability, unit **207/207 PASS**, `npm run check` PASS, build **578,9 KiB**.
- Milestone R3 tetap aktif karena masih ada gap transport Song/Section untuk shortcut Songwriter `Shift+Space` dan perlu audit final operasi 8-pattern tanpa mouse.

### R3-S10E — pointer drag block selection (CLOSED · PASS)

- Drag mouse pada cell Pattern kini memilih blok row × channel; cursor berakhir pada cell terakhir tanpa mengubah model lagu.
- Drag/click pada background header channel memilih seluruh channel atau rentang channel. Kontrol interaktif header (instrument, M/S/P, fold, FX, warna, volume) tidak memulai block selection.
- Pointer selection hanya mengambil mouse/pen; touch sengaja dibiarkan untuk scrolling mobile. Keyboard selection S10D tetap menjadi padanan aksesibel utama.
- Implementasi memakai pointer capture dan hit-test `elementFromPoint` agar selection tetap stabil saat cursor bergerak antar-cell/header; single click cell tetap mempertahankan semantik cursor biasa.
- Gate final GitHub run **37704541477**: 0 vulnerability, unit **206/206 PASS**, `npm run check` PASS, build **578,9 KiB**, full browser Chromium + Firefox **306 PASS + 4 skip**.
- Acceptance pointer drag lulus di Chromium dan Firefox. Empat skip tetap limitation realtime `AudioContext` Firefox headless yang sudah ada. Milestone R3 tetap aktif.

### R3-S10D — seleksi bertahap Ctrl+A (CLOSED · PASS)

- `Ctrl+A` Pattern kini mengikuti kontrak §8.6 dalam tiga tingkat: event-cell aktif pada row/channel saat ini → seluruh channel aktif → seluruh Pattern.
- Penekanan berikutnya saat seluruh Pattern sudah terpilih bersifat idempotent. Model block tetap row×channel; tidak ada schema baru atau perubahan pada copy/paste/transpose.
- Cursor tetap menentukan row/channel tahap pertama, sehingga progression bekerja dari posisi editor aktual, bukan selalu dari channel 1 row 0.
- Gate final GitHub run **37702080797**: 0 vulnerability, unit **206/206 PASS**, `npm run check` PASS, build **573,1 KiB**, full browser Chromium + Firefox **300 PASS + 4 skip**.
- Acceptance progressive selection lulus di Chromium dan Firefox. Empat skip tetap limitation realtime `AudioContext` Firefox headless yang sudah ada.
- Audit lanjutan §8.6 menemukan pointer/drag selection pada header channel dan grid belum ada; itu tetap gap terpisah. Milestone R3 masih aktif.

### R3-S10C — header channel lengkap (CLOSED · PASS)

- Header Pattern kini memuat nama/nomor channel, picker instrument, **M/S/P**, fold voice lane untuk track poly, tombol **FX**, warna channel, mini-volume, dan meter tanpa memperlebar geometri channel.
- Mini-volume adalah **mixer runtime** pada gain dasar track bus. Nilainya tidak masuk Project/history dan tidak menulis EffectEvent; automation `volume` pattern-local tetap berada pada jalur FX terpisah. Mute/Solo mempertahankan nilai volume runtime.
- Warna memakai field kanonik `Track.color`, berubah lewat command/history, dapat Undo, memiliki fallback palet saat null, dan tervalidasi pada debug JSON. JSON schema-1 lama tanpa field `color` dinormalisasi ke `null`.
- Tombol FX di header memfokuskan channel terkait dan membuka disclosure `FX | PARAM` yang sudah ada; DLY/voice-lane semantics tidak berubah.
- Tinggi header bertambah hanya 8 px (92→100); lebar channel tetap sehingga budget/windowing 32 channel tidak dibebani oleh kontrol baru.
- Gate final GitHub run **37681596366**: 0 vulnerability, unit **206/206 PASS**, `npm run check` PASS, build **572,4 KiB**, full browser Chromium + Firefox **300 PASS + 4 skip**.
- Acceptance S10C lulus di Chromium dan Firefox: runtime volume tanpa mutasi project/history, mute mempertahankan volume, color+Undo, FX per-channel, dan coexistence dengan fold poly.
- Empat skip tetap limitation realtime `AudioContext` Firefox headless yang sudah ada; S10C tidak menambah skip. Milestone R3 tetap aktif.

### R3-S10B — proyeksi voice lane Pattern (CLOSED · PASS)

- Channel poly default tetap collapsed; tombol header dengan `aria-expanded` membuka NOTE/INST/VOL per lane nyata pada Pattern aktif, minimum lane 0. Fold tidak mengubah project atau history (§5.4, §8.6).
- Cursor menyimpan `voiceLane`; NOTE replacement, INST/VOL, dan Delete bekerja pada lane terpilih saat expanded. Collapsed mempertahankan ringkasan chord, Delete seluruh row, serta Shift+note first-free lane. Helper note/update menerima lane opsional default 0 tanpa schema bump.
- Geometri memakai prefix offset pixel/kolom per track untuk spacer, window horizontal, navigasi, serta ARIA. DLY/FX tetap track-level. Row/cell DOM dipakai ulang hanya bila identitas track dan geometri cocok; audisi EDIT dijadwalkan ke microtask setelah penulisan sel agar inisialisasi AudioContext tidak memblokir feedback keyboard.
- Regresi tambahan mencakup lane sparse, NOTE Undo/Redo, pergantian template, ARIA/windowing, FX setelah perubahan lebar, serta acceptance fold/edit per-lane.
- Gate lokal executor: unit **203/203 PASS**, check/build PASS, targeted Chromium + Firefox **60/60 PASS**; channel 32 **12,4 ms Chromium / 20 ms Firefox** pada full run, batas 50 ms tetap.
- Gate GitHub final run **37679632813**: 0 vulnerability, unit **203/203 PASS**, `npm run check` PASS, build Linux **565,7 KiB**, full browser Chromium + Firefox **292 PASS + 4 skip**.
- Empat skip tetap limitation realtime `AudioContext` Firefox headless yang sudah ada; S10B tidak menambah skip dan tidak melemahkan budget performa.
- Asumsi yang sengaja dipertahankan: fold tidak dipersistenkan; lane sparse hanya menampilkan lane nyata ditambah lane 0; block selection serta DLY/FX tetap track-level. Milestone R3 tetap aktif.

### R3-S10A — runtime keymap + shortcut overlay (CLOSED · PASS)

- Preset **Songwriter** dan **OpenMPT-like** kini menjadi binding runtime nyata berbasis `KeyboardEvent.code`, bukan sekadar preferensi onboarding. Pengguna dapat mengganti preset setelah first-run dari overlay bantuan.
- `?` membuka overlay shortcut kontekstual untuk view aktif dari registry command yang sama dengan Command Palette/agent. Command Palette juga menampilkan shortcut dinamis sesuai preset aktif.
- Songwriter mempertahankan `Space` untuk Play/Stop Pattern. Shortcut umum tetap mencakup `Ctrl+K` Palette, Undo/Redo, dan `Alt+1…7`; sesuai §8.14, shortcut tidak membajak input teks.
- Subset OpenMPT-like diverifikasi terhadap manual OpenMPT dan hanya memetakan aksi yang sudah memiliki padanan nyata: `F7` Play Pattern dari awal, `Ctrl+F7` dari kursor, `F10` mute channel aktif, `Ctrl+F10` solo, `Shift+F11` loop Pattern, `Ctrl+Space` EDIT/AUDISI, serta `Tab/Shift+Tab` pindah channel.
- Aksi OpenMPT yang belum memiliki semantik NotaStation tidak dipalsukan. Khusus Songwriter `Shift+Space = mulai dari awal section` **belum ditutup** karena transport masih Pattern-local; gap ini harus diselesaikan bersama Song/Section transport.
- Topbar menampilkan tombol bantuan `?` dan tooltip shortcut mengikuti preset aktif. Layout header M/S/P/meter juga dikoreksi menjadi empat slot yang benar.
- Workflow CI sementara S9B yang sempat tertinggal di `main` dihapus agar PR berikutnya tidak menjalankan full gate ganda.
- Gate source final run **37648007658** pada HEAD `68a7f98…`: 0 vulnerability, unit **201/201 PASS**, `npm run check` PASS, build **559,0 KiB**, full browser Chromium + Firefox **276 PASS + 4 skip**.
- Run tambahan **37648438288** juga PASS setelah audit kompatibilitas shortcut; source kemudian dikembalikan byte-identik ke kontrak §8.14 yang sudah digate pada `68a7f98…`.
- Empat skip tetap limitation realtime `AudioContext` Firefox headless dari slice audio sebelumnya; S10A tidak menambah skip.

### R3-S9B — polyphonic instrument tracks (CLOSED · PASS)

- Fondasi voice lane R2 digeneralisasi ke seluruh instrument track tanpa schema bump; Drum Track tetap wajib `poly`.
- Header Pattern menambah toggle **P** per channel. Instrument track dapat berpindah mono ↔ poly; kembali ke mono ditolak selama masih ada voice lane tambahan agar chord tidak hilang diam-diam.
- `Shift+note` pada track poly menambah note ke voice lane kosong pertama pada row yang sama. `Delete` membersihkan seluruh chord row; data tetap `NoteEvent` kanonik pattern-local.
- Scheduler membawa beberapa voice lane instrument pada tick yang sama tanpa source duplication palsu di model.
- Input regression chord memakai **Shift+C** sesuai posisi fisik keymap §8.14 dan memverifikasi pitch 60/64, lane 0/1, serta cursor row tetap.
- Gate final run **37645427242** pada HEAD `c13500f…`: unit **196/196 PASS**, `npm run check` PASS, build PASS, browser Chromium + Firefox **268 PASS + 4 skip**.
- Empat skip tetap limitation realtime `AudioContext` Firefox headless dari slice audio sebelumnya; S9B tidak menambah skip.
- Actions gate dikunci ke SHA resmi `actions/checkout` dan `actions/setup-node` sesuai kebijakan supply-chain §13.3.

### R3-S9A — kapasitas 32 channel logis (CLOSED · PASS)

- Project baru tetap ringkas dengan **8 channel default**, tetapi model/command kini dapat menambah channel sampai batas kanonik **32**; channel ke-33 ditolak fail-closed dengan `E_PROJECT_TRACK_LIMIT`.
- Tambah channel adalah satu transaksi history. Undo/Redo menyinkronkan ulang daftar track pada audio engine sehingga state mute/solo/meter tidak menyisakan track hantu.
- Pattern menyediakan kontrol **Tambah channel** yang aksesibel; header/grid mengikuti jumlah track aktual dan tombol otomatis disabled pada 32 channel.
- Jalur input Pattern dioptimalkan agar command dari UI tidak memicu refresh sinkron ganda dan header hanya dibangun ulang bila signature track/field berubah.
- Regression browser membuktikan channel 32 dapat dicapai murni lewat keyboard, note ditulis ke track ke-32, horizontal auto-scroll bekerja, dan row DOM tetap windowed.
- Budget PLAN §16.5 `tombol→sel < 50 ms` dijadikan assertion browser pada input channel ke-32 dan PASS di Chromium + Firefox.
- Gate final run **37639746724** pada HEAD `a0c96c1…`: 0 vulnerability, unit **192/192 PASS**, `npm run check` PASS, build **539,5 KiB**, full browser **264 PASS + 4 skip**.
- Empat skip tetap limitation realtime `AudioContext` Firefox headless yang sudah terdokumentasi dari slice audio sebelumnya; tidak ada skip baru dari S9A.
- Berikutnya: **R3-S9B generalisasi polyphonic voice-lane ke semua track instrument**, lalu keymap/help overlay dan exit-task R3.

### R3-S8F-B — audible vibrato + arpeggio (CLOSED · PASS)

- `vibrato` kini menjadi automation pitch cyclic pada `AudioBufferSourceNode.playbackRate`, dengan `depthSemitones` dan `rateHz` typed. Kurva dijadwalkan terhadap audio clock sampai voice selesai; tidak ada `setTimeout` atau timer musikal kedua.
- `arpeggio` mengulang `semitones[]` per `stepTicks` sebagai stepwise playback-rate automation yang diturunkan dari tick musik. Data kanonik EffectEvent tetap pattern-local dan `NoteEvent.pitch` tidak pernah dimutasi.
- Seluruh keluarga pitch sekarang berbagi state/cancel policy yang sama. Effect baru mengambil offset pitch aktual pada waktu event, membatalkan automation setelah titik itu, lalu menjadi pemilik automation berikutnya; slide/porta tidak me-reset vibrato/arpeggio kembali ke pitch note.
- Usia automation dibatasi oleh usia voice efektif. Note cut dan retrigger yang memotong source juga memotong automation; voice hasil retrigger hanya menerima pitch effect yang memang terjadi pada/ setelah voice restart tersebut.
- Seek/loop tetap memakai `createEffectScheduleCursor()`; live-edit tetap memakai freeze window **30 ms**. Tidak dibuat scheduler pitch terpisah dan tidak ada absolute song tick yang disimpan.
- Sampler/factory tetap memakai base playback rate yang sudah mencakup root note/tuning Sample/Zone. Pitch effect diterapkan relatif terhadap base rate itu. Jalur `demo.*` tetap fail-soft/terukur bila tidak memiliki `playbackRate` yang kompatibel.
- Bukti audible lintas-browser memakai `OfflineAudioContext`: vibrato menunjukkan modulasi frekuensi periodik nyata dan arpeggio menunjukkan lompatan frekuensi stepwise nyata. Realtime Chromium menguji chaining slide → porta → vibrato → arpeggio sekaligus interaksi retrigger tanpa mutasi NoteEvent.
- Gate final run **37622712378** pada HEAD `be29bdd…`: 0 vulnerability, unit **190/190 PASS**, `npm run check` PASS, build **534,6 KiB**, full browser **258 PASS + 4 skip**.
- Empat skip tetap hanya realtime `AudioContext` Firefox headless S8B/S8D/S8E/S8F; bukti audible `OfflineAudioContext` termasuk vibrato/arpeggio tetap berjalan pada Firefox.
- `npm run check` juga diperkeras untuk menjalankan `node --check` pada JS/MJS sehingga syntax error tertangkap sebelum browser gate.
- Dengan S8F-B, seluruh 10 EffectEvent v0.1 pada §7.4 sudah memiliki jalur audible/semantik runtime yang ditutup per-slice. Exit R3 berikutnya harus ditentukan dari PLAN/changelog aktual, bukan membuka keluarga DSP baru secara otomatis.

### R3-S8F-A — audible pitch slide + portamento (CLOSED · PASS)

- Spike R1 `pitch-spike.js` diproduksikan menjadi primitive `pitch-effects.js` untuk automation finite pada `AudioParam`.
- `pitchSlide` berjalan relatif dari pitch voice **saat EffectEvent mulai**, lalu menetap pada offset hasil slide.
- `porta` bergerak dari pitch voice saat ini menuju `targetPitch` MIDI absolut, sambil mempertahankan tuning dasar Sample/Zone.
- Chaining deterministic: EffectEvent berikutnya dapat memotong ramp yang sedang berlangsung; posisi semitone saat titik potong dihitung dari state automation sebelumnya, bukan di-reset ke pitch note.
- Automation dipotong pada note-off dan tidak pernah memperpanjang usia voice. Effect setelah source selesai tidak membuat scheduling palsu.
- Engine menyimpan `pitchParam`, base playback rate, note end, dan state automation hanya sebagai metadata runtime; `NoteEvent.pitch` tetap kanonik dan tidak dimutasi.
- Pitch cursor memakai freeze window live-edit 30 ms seperti timing/mix FX. Effect hanya diterapkan ke voice note aktif pada Track dan cycle yang sama.
- Sampler/factory memakai `AudioBufferSourceNode.playbackRate`. Instrument `demo.*` adalah fixture UAT khusus dengan pitch-envelope internal; automation pitch tidak dipaksakan ke jalur itu dan dihitung sebagai unsupported fail-soft bila memang ditarget.
- Bukti audible lintas-browser memakai `OfflineAudioContext` dan zero-crossing frequency estimate: bagian akhir ramp harus memiliki frekuensi nyata lebih tinggi daripada bagian awal. Integrasi realtime engine diverifikasi pada Chromium tanpa mengubah NoteEvent.
- Gate terarah awal run **37519436337**: unit/check/build PASS, audible offline PASS, tetapi realtime Chromium menemukan hanya satu voice automation karena fixture factory sudah selesai sebelum porta tick 480. Runtime tidak diubah.
- Fixture diperbaiki agar porta masuk di tick 120 saat source masih aktif, sekaligus menguji pemotongan ramp slide oleh porta.
- Gate terarah final run **37519683809** pada HEAD `3119b29…`: 0 vulnerability, unit **185/185 PASS**, check PASS, build **530,5 KiB**, browser pitch/audio regression **22 PASS + 4 skip**.
- Gate final run **37519923777** pada HEAD `84c1b9d…`: 0 vulnerability, unit **185/185 PASS**, check PASS, build **530,5 KiB**, full browser **256 PASS + 4 skip**.
- Empat skip adalah realtime AudioContext Firefox headless S8B/S8D/S8E/S8F-A; seluruh bukti audible OfflineAudioContext tetap berjalan di Firefox.
- Berikutnya: **R3-S8F-B vibrato + arpeggio** sebagai automation cyclic/stepwise setelah finite ramp stabil.

### R3-S8E — audible retrigger + sample offset (CLOSED · PASS)

- `retrigger.count` dikunci sebagai **jumlah pengulangan tambahan**; trigger note asli tetap trigger pertama. Contoh `count=2` menghasilkan trigger asli + dua restart.
- Retrigger memperluas `patternEventTemplates()`, bukan membuat scheduler terpisah. Karena itu seek, loop, tempo re-anchor, dan live-edit otomatis memakai cursor note yang sama.
- Setiap restart mempertahankan pitch, velocity, Instrument, Track, `voiceLane`, dan source NoteEvent. Durasi tiap restart memakai sisa tail NoteEvent, sehingga restart tidak memperpanjang note kanonik.
- Retrigger me-*restart* source note/cycle/lane yang sama dengan menjadwalkan cut pada source sebelumnya tepat di waktu retrigger; ia tidak menumpuk source identik sebagai overlap.
- `offset.frames` dibawa ke setiap trigger/retrigger dan dikonversi ke detik memakai sample rate buffer saat `AudioBufferSourceNode.start()`. NoteEvent dan Sample model tidak dimutasi.
- Offset tepat/lebih jauh dari akhir buffer menghasilkan trigger **silent fail-soft**, bukan exception audio. Jalur demo/synth non-sample tidak dipaksa memiliki semantik sample offset.
- Bila `delay` dan `retrigger` berada pada cell note yang sama, onset hasil delay menjadi anchor restart; interval retrigger tetap dalam tick. Offset yang sama diterapkan ulang pada setiap restart.
- Primitive `source-note-effects.js` mengunci expansion tick dan konversi frame→detik secara terpisah. Scheduler test membuktikan canonical NoteEvent tetap identik.
- Bukti audible lintas-browser memakai `OfflineAudioContext`: buffer uji memiliki leading silence, offset melompat ke bagian berbunyi, lalu retrigger mengulang onset tersebut pada interval deterministik. Integrasi realtime engine diverifikasi pada Chromium.
- Observability engine menambahkan `retriggerNotesScheduled`, `retriggerStopsScheduled`, `sampleOffsetNotesScheduled`, dan `sampleOffsetSilenced`.
- Gate terarah run **37494472397** pada HEAD `5340b07…`: 0 vulnerability, unit **176/176 PASS**, check PASS, build **522,5 KiB**, browser source/timing/mix/Pattern FX **17 PASS + 3 skip**. Tiga skip adalah realtime AudioContext Firefox headless dari S8B/S8D/S8E; seluruh bukti audible OfflineAudioContext tetap berjalan di Firefox.
- Gate final run **37494671344** pada HEAD `8034d94…`: 0 vulnerability, unit **176/176 PASS**, check PASS, build **522,5 KiB**, full browser **251 PASS + 3 skip**.
- Keluarga FX non-pitch v0.1 kini audible: volume, pan, retrigger, sample offset, note cut, dan note delay. Berikutnya: **R3-S8F pitch automation spike/implementation** untuk pitch slide, portamento, vibrato, dan arpeggio sesuai §7.4.

### R3-S8D — audible volume + pan EffectEvent (CLOSED · PASS)

- `volume` dan `pan` kini benar-benar memengaruhi audio sebagai **state Track yang persisten setelah tick EffectEvent**, bukan pengganti `NoteEvent.velocity` atau metadata note awal.
- Jalur bus Track dipisah menjadi `mute/solo gain → FX gain → FX pan → meter → destination`. Dengan begitu automation EffectEvent tidak mengubah state mixer mute/solo pengguna.
- `volume.level 0..127` diproyeksikan ke gain `0..1`; `pan.position -64..64` diproyeksikan ke stereo pan `-1..1`. Browser tanpa `StereoPannerNode` tetap fail-soft: volume berjalan, pan tidak membuat playback gagal.
- Scheduler memiliki cursor khusus mix FX. Bila Pattern memiliki volume/pan, synthetic reset pada tick 0 mengembalikan baseline gain 1 dan pan center sebelum event cycle baru diterapkan. Loop tidak mewarisi state cycle sebelumnya.
- Seek dan live-edit merekonstruksi state volume/pan terakhir **sebelum** tick tujuan, lalu cursor menangani effect yang tepat pada tick tujuan. Ini menjaga semantik yang sama untuk start dari tengah Pattern dan freeze-window live edit.
- Stop dan playback yang selesai alami mengembalikan FX bus ke baseline. Pause mempertahankan posisi; saat resume, `startPlayback` membangun ulang state dari tick resume.
- Automation mix hanya dijadwalkan sampai tepat sebelum freeze-window 30 ms, sehingga edit effect yang masih mutable tidak dibekukan lebih dini daripada kontrak live-edit R1/S8B.
- Primitive `track-mix-effects.js` diuji terpisah untuk mapping gain/pan, reset, clamp audio time, fallback panner, dan invalid input.
- Bukti audible lintas-browser memakai `OfflineAudioContext` stereo: level turun setelah volume FX dan energi berpindah ke channel kanan setelah hard-pan. Integrasi realtime engine diverifikasi pada Chromium tanpa memutasi NoteEvent kanonik.
- Gate terarah run **37443959974** pada HEAD `98432c9…`: 0 vulnerability, unit **171/171 PASS**, check PASS, build **516,7 KiB**, browser S8D+S8B+S8C **14 PASS + 2 skip**. Dua skip adalah realtime AudioContext Firefox headless yang sudah terdokumentasi; kedua bukti audible OfflineAudioContext tetap berjalan di Firefox.
- Gate final run **37444121563** pada HEAD `8be8d0d…`: 0 vulnerability, unit **171/171 PASS**, check PASS, build **516,7 KiB**, full browser **248 PASS + 2 skip**.
- Audit dependency memisahkan keluarga non-pitch: `volume/pan` adalah Track-state automation, sedangkan `retrigger/offset` membuat atau memulai ulang source note. Berikutnya: **R3-S8E retrigger + sample offset**, lalu keluarga pitch automation.

### R3-S8C — progressive FX | PARAM Pattern (CLOSED · PASS)

- Pattern kini memakai **progressive disclosure** untuk kolom `FX | PARAM`: Pattern tanpa EffectEvent tetap ringkas; tombol **FX** membuka kolom secara eksplisit, dan Pattern yang sudah memiliki EffectEvent membukanya otomatis agar data tidak pernah tersembunyi.
- Sepuluh EffectEvent v0.1 memiliki mnemonic UI stabil dan tetap typed: `VOL`, `PAN`, `SLD`, `PRT`, `VIB`, `RTR`, `OFF`, `CUT`, `DLY`, `ARP`. PARAM memakai representasi terbaca, bukan hex opaque.
- Helper `effect-display.js` mengunci format/parser typed untuk seluruh effect. Contoh: `SLD +2/120t`, `VIB 0.5/5Hz`, `RTR 60t×4`, `ARP 0,+4,+7/120t`.
- Beberapa effect pada Track/tick yang sama tidak disembunyikan: FX dan PARAM diringkas deterministik, sementara editor tetap memilih satu type spesifik untuk add/update/delete.
- Editor FX per-cell memakai command layer S8A, sehingga add/update/delete masing-masing satu transaksi history, ikut live-reschedule, dan tetap melewati shared-pattern guard S4. `Enter` dari cell FX/PARAM memindahkan fokus ke editor; `Delete` menghapus hanya type effect yang sedang dipilih.
- EffectEvent off-grid kini ikut memicu kolom **DLY** walaupun note semuanya aligned. FX off-grid tetap terlihat tetapi direct edit ditahan agar timing tidak berubah diam-diam.
- Grid geometry, `aria-colcount`, header, horizontal cursor, dan virtualized row mengikuti kolom dinamis FX/PARAM tanpa schema bump.
- i18n timing S7 yang sebelumnya salah menempatkan beberapa string English di blok Indonesia dikoreksi; S7/S8 kini memiliki label ID/EN yang benar dan browser acceptance English mencegah fallback silang bahasa.
- Gate terarah awal run **37441696366**: unit/check/build PASS tetapi browser **22/24 PASS**; dropdown PAN di-reset kembali ke VOL oleh auto-selection editor.
- Koreksi pertama run **37441949157** masih **22/24 PASS** karena bergantung `document.activeElement`, yang tidak stabil untuk synthetic `selectOption`. Mekanisme itu dibuang.
- Gate terarah final run **37442195658** pada HEAD `bf47942…`: 0 vulnerability, unit **163/163 PASS**, check PASS, build **508,4 KiB**, FX/EffectEvent/off-grid/shared-guard Chromium+Firefox **24/24 PASS**.
- Gate final run **37442431681** pada HEAD `2f812d7…`: 0 vulnerability, unit **163/163 PASS**, check PASS, build **508,4 KiB**, full browser **245 PASS + 1 skip**. Satu skip adalah limitation realtime AudioContext Firefox headless yang sudah didokumentasikan sejak S8B; bukan test S8C yang dilewati.
- Slice ini tidak menambah DSP baru. Berikutnya: **R3-S8D audible FX non-pitch** (volume, pan, retrigger, sample offset) sebelum masuk keluarga pitch automation yang lebih sensitif.

### R3-S8B — audible note delay + note cut (CLOSED · PASS)

- Dua timing FX pertama kini benar-benar terdengar: `delay` menggeser onset scheduler tanpa memutasi `NoteEvent.startTickLocal` atau `durationTicks`; `cut` menjadwalkan stop voice pada audio clock.
- `delay` diproyeksikan dari EffectEvent pada `trackId + tickLocal` yang sama dengan note. Data note kanonik tetap identik; hanya waktu playback efektif yang berubah.
- `cut` memakai cursor timing terpisah dengan tick efektif `effect.tickLocal + afterTicks`. Cut hanya menghentikan voice note pada Track target yang sudah mulai dan belum dipotong lebih awal.
- Validator timing menolak delay yang membuat onset keluar Pattern dan cut yang melewati akhir Pattern. Cut tepat pada batas akhir masih sah.
- Live edit membangun ulang note cursor dan cut cursor dari freeze tick yang sama. Cut baru hanya di-drain sampai horizon freeze **30 ms**, sehingga event jauh di depan belum dibekukan terlalu dini.
- Bukti audible lintas-browser dibuat deterministik memakai `OfflineAudioContext`: hasil render harus sunyi sebelum delay, berbunyi setelah onset, lalu sunyi setelah cut. Tes ini berjalan pada Chromium dan Firefox.
- Integrasi realtime engine tetap diuji pada Chromium. Pada GitHub Actions, Firefox headless mempertahankan realtime `AudioContext` dalam state `suspended` walaupun Play dipicu dari klik; satu case realtime tersebut di-skip secara eksplisit. Firefox tetap menjalankan seluruh tes transport biasa dan bukti audible OfflineAudioContext—limitation CI ini tidak disamarkan sebagai PASS realtime.
- Percobaan menunggu `resume()` di runtime dan mengubah autoplay prefs Playwright tidak menyelesaikan kondisi Firefox headless, sehingga keduanya **dikembalikan**; runtime produksi tidak diberi latency/workaround khusus runner.
- Gate terarah final run **37424666619** pada HEAD `ff76455…`: 0 vulnerability, unit **159/159 PASS**, check PASS, build **489,8 KiB**, browser timing/Pattern/transport **49 PASS + 1 skip** terdokumentasi.
- Gate final run **37424865027** pada HEAD `8ba9c32…`: 0 vulnerability, unit **159/159 PASS**, check PASS, build **489,8 KiB**, full browser **237 PASS + 1 skip** terdokumentasi.
- Slice ini sengaja hanya menutup audio timing FX. Berikutnya: **R3-S8C progressive FX projection/editing** — kolom `FX | PARAM` di Pattern, baru kemudian keluarga audible FX lain.

### R3-S8A — EffectEvent typed + scheduler contract (CLOSED · PASS)

- Dibuka model kanonik **EffectEvent** sesuai §5.7 dengan tepat lima field: `id, trackId, tickLocal, type, value`. Tidak ada hex opaque atau field tambahan liar.
- Sepuluh type v0.1 dikunci: `volume`, `pan`, `pitchSlide`, `porta`, `vibrato`, `retrigger`, `offset`, `cut`, `delay`, dan `arpeggio`.
- `value` divalidasi per type, bukan satu angka generik: volume/pan memakai range tracker yang eksplisit; pitch/porta/vibrato/retrigger/arpeggio memakai object parameter bertipe; offset/cut/delay punya unit yang jelas.
- Primitive immutable `addPatternEffect()`, `updatePatternEffect()`, dan `deletePatternEffect()` menegakkan reference/tick/range serta uniqueness per `trackId + tickLocal + type`; type berbeda boleh hidup pada tick yang sama.
- Debug JSON kini memvalidasi EffectEvent sepenuhnya: type/value/tick/track invalid, ID duplikat, dan duplicate effect cell ditolak fail-closed. Fixture lama yang masih memakai placeholder numeric dimigrasikan ke shape typed.
- Scheduler memperoleh `effectEventTemplates()` dan `createEffectScheduleCursor()`: sort/timing, seek, loop, dan clone value deterministic, tetapi **belum menerapkan DSP** ke audio node.
- Insert/delete row S6 kini ikut menggeser FX track-local. FX di rentang delete dibuang; FX yang terdorong dan tak lagi valid pada Pattern fixed-length dibuang utuh, bukan dibiarkan dengan timing invalid.
- Command registry mengekspos add/update/delete EffectEvent. Semua mutasi tetap melalui shared-pattern guard S4, history/session, dan live-reschedule path yang sama; browser test membuktikan satu transaksi Undo dan guard tidak dapat dilewati.
- Gate terarah awal run **37421543979** berhenti di unit karena expected cursor test salah: horizon 18,01 detik memang mencakup event cycle berikutnya pada detik 18. Runtime scheduler tidak diubah.
- Gate terarah koreksi run **37421641020** pada HEAD `0583798…`: 0 vulnerability, unit **156/156 PASS**, check PASS, build **485,6 KiB**, EffectEvent/row/shared-guard Chromium+Firefox **18/18 PASS**.
- Gate final run **37421782949** pada HEAD `312118e…`: 0 vulnerability, unit **156/156 PASS**, check PASS, build **485,6 KiB**, full browser Chromium+Firefox **234/234 PASS**.
- Belum ada kolom FX/PARAM atau efek audible pada slice ini. Berikutnya: **R3-S8B audible FX pertama + progressive FX projection**, dimulai dari efek yang tidak membutuhkan arsitektur voice baru.

### R3-S7B — LPB projection + explicit quantize (CLOSED · PASS)

- Pattern toolbar kini memiliki selector **LPB** sebagai **state proyeksi**, bukan mutasi Project. Mengganti LPB mempertahankan tick musik di bawah cursor dan tidak mengubah `NoteEvent.startTickLocal`.
- Helper timing mendukung LPB yang membagi PPQ 480 secara bulat dan mengubahnya ke `rowTicks`; pencarian **Cocokkan LPB** memilih resolusi yang dapat menyelaraskan semua event pada cell tanpa mengkuantisasi data.
- Saat LPB aktif berbeda dari `Pattern.rowTicks`, Pattern masuk **projection-only** untuk mutasi tracker biasa. Ini sengaja fail-safe: tampilan boleh berubah, tetapi NOTE/INST/VOL, block edit, row operation, dan edit langsung tidak boleh menghitung row dengan grid default lama secara diam-diam.
- Tombol **Kuantisasi** adalah satu-satunya perubahan timing pada slice ini: event pada cell dipindahkan ke grid terdekat sebagai satu transaksi Undo dan tetap melewati shared-pattern guard S4.
- Kuantisasi mempertahankan ID, pitch, velocity, Instrument, `voiceLane`, dan **durationTicks**. Bila target membuat collision atau sustain melewati akhir Pattern, seluruh operasi ditolak atomik; duration tidak pernah dipotong diam-diam.
- Pada Pattern shared, **Jadikan unik untuk tempat ini** tetap bekerja untuk quantize pending: occurrence sumber mempertahankan tick lama, clone occurrence fokus menerima timing hasil quantize.
- DLY tetap progressive disclosure: bila resolusi aktif membuat seluruh note aligned, kolom DLY hilang; kembali ke resolusi default mengembalikan DLY tanpa perubahan data.
- Full gate awal run **37418995846** pada HEAD `e014ba3…`: unit **143/143 PASS**, check PASS, build **468,6 KiB**, full browser **230/230 PASS**.
- Review setelah gate menemukan satu masalah semantik yang belum tertangkap test: quantize dekat akhir Pattern dapat memendekkan duration. Koreksi mengubahnya menjadi `E_PATTERN_QUANTIZE_DURATION` fail-closed dan menambah unit invariant.
- Full gate sesudah koreksi duration run **37419790185**: unit **144/144 PASS**, tetapi browser **229/230 PASS**. Satu failure Chromium berasal dari race pada test observability lama: test sudah melihat playhead tepat di row target, lalu menunggu scroll secara terpisah sementara playback terus maju hingga row +2.
- Test follow-playhead dikoreksi tanpa mengubah runtime: posisi dekat target dan `scrollTop > 0` diperiksa dalam satu kondisi atomik. Gate terarah run **37420218937**: unit **144/144 PASS**, check PASS, build **468,7 KiB**, LPB/off-grid/channel observability Chromium+Firefox **18/18 PASS**.
- Gate final run **37420368555** pada HEAD `d0981f4…`: 0 vulnerability, unit **144/144 PASS**, check PASS, build **468,7 KiB**, full browser Chromium+Firefox **230/230 PASS**.
- Direct arbitrary DLY editing belum dibuka. Perubahan timing selain explicit quantize tetap ditahan sampai semantik input DLY jelas.
- Berikutnya: **R3-S8 typed FX v0.1** atau **generalisasi polyphonic voice lane**, setelah audit dependency singkat terhadap model EffectEvent dan header channel.

### R3-S7A — proyeksi off-grid + kolom DLY (CLOSED · PASS)

- Ditambahkan helper proyeksi **tick-local → display row + DLY** tanpa mengubah `NoteEvent.startTickLocal`. Data kanonik tetap bebas grid; Pattern hanya memproyeksikannya.
- Kolom **DLY** muncul otomatis hanya bila Pattern memiliki note yang tidak sejajar dengan `rowTicks`; Pattern aligned tetap memakai tiga kolom `NOTE | INST | VOL`.
- Note off-grid diberi penanda `⌁`; DLY menampilkan offset tick seperti `+23t`. Bila beberapa event jatuh pada row tampilan yang sama, semuanya tetap dipertahankan dan diproyeksikan deterministik—tidak ada kuantisasi atau event yang dibuang diam-diam.
- Layout Pattern, lebar channel, `aria-colcount`, header, cursor horizontal, dan virtualized rows kini mengikuti daftar field aktif secara dinamis.
- S7A sengaja **visibility + safety**: direct per-cell NOTE/INST/VOL/Delete ditahan bila row berisi event off-grid agar ketikan tracker tidak membuat event aligned kedua atau mengubah timing secara implisit. Block operation tetap bekerja pada data tick kanonik.
- Tidak ada schema bump dan tidak ada perubahan audio scheduler; scheduler memang sudah memakai `startTickLocal` langsung.
- Gate terarah run **37417661473** pada HEAD `d4fed98…`: 0 vulnerability, unit **139/139 PASS**, check PASS, build **455,2 KiB**, DLY/Pattern/block/row Chromium+Firefox **52/52 PASS**.
- Gate final run **37417834138** pada HEAD `ee93107…`: 0 vulnerability, unit **139/139 PASS**, check PASS, build **455,2 KiB**, full browser Chromium+Firefox **222/222 PASS**.
- Audit dependency menempatkan DLY sebelum FX typed: proyeksi off-grid merupakan prasyarat langsung Piano Roll R5a, sementara EffectEvent typed masih perlu membuka model efek.
- Berikutnya: **R3-S7B LPB + explicit timing actions** — pemilih resolusi tampilan LPB, pencarian resolusi yang cocok, dan kuantisasi eksplisit/Undo; direct edit DLY baru dibuka bila semantiknya sudah jelas.

### R3-S6 — row operations + velocity interpolation (CLOSED · PASS)

- Pattern editor kini mendukung **Insert row** dan **Delete row** pada data channel terpilih tanpa mengubah panjang Pattern. Shortcut tracker: `Insert` menyisipkan row dan `Backspace` menghapus row pada NOTE/block selection; `Ctrl+Insert` / `Ctrl+Backspace` menjalankan operasi yang sama untuk seluruh channel.
- Semantik fixed-length dibuat eksplisit: event pada channel terpilih digeser; event yang terdorong melewati akhir Pattern dipotong dari Pattern. Channel di luar selection tetap identik.
- Note sustain yang melintasi titik insert diperpanjang sebanyak row yang disisipkan; saat delete, sustain yang melintasi rentang terhapus dipendekkan. Note yang mulai di dalam rentang delete dihapus sebagai event, bukan diubah menjadi tail tanpa note-on.
- Drum `voiceLane` dipertahankan oleh insert/delete; operasi row memakai primitive immutable yang sama untuk track mono/poly.
- `Ctrl+J` menjalankan **interpolasi velocity** pada block selection. Interpolasi linear hanya mengubah NoteEvent yang sudah ada, per `trackId + voiceLane`; blank row tidak dibuat menjadi note baru.
- Insert/delete/interpolate seluruhnya masuk command registry, melewati shared-pattern guard S4, melakukan reschedule audio bila perlu, dan masing-masing menjadi satu transaksi Undo.
- Full regression pertama run **37416428965**: unit **135/135 PASS**, check/build PASS, tetapi browser **214/216 PASS**. Dua failure identik menemukan konflik kontrak R1: Backspace pada kolom INST/VOL yang read-only ikut menjalankan delete-row.
- Koreksi mempertahankan kontrak lama: plain Backspace menjadi delete-row hanya ketika cursor berada di NOTE atau ada block selection; pada INST/VOL tetap no-op. `Ctrl+Backspace` tetap aksi row eksplisit seluruh channel.
- Gate final run **37416721250** pada HEAD `c659552…`: 0 vulnerability, unit **135/135 PASS**, check PASS, build **448,7 KiB**, full browser Chromium+Firefox **216/216 PASS**.
- Shortcut `Insert` / `Backspace` dan `Ctrl+J` dipilih agar pintu OpenMPT-like tetap familiar; implementasi NotaStation tetap mengikuti model kanoniknya sendiri, bukan menyalin format tracker.
- Berikutnya: **R3-S7 typed FX v0.1 + DLY/LPB** atau **generalisasi polyphonic voice lane** setelah audit dependency singkat; row helper S6 sengaja belum menggeser FX karena model FX typed belum dibuka.

### R3-S5 — block selection + copy/paste + transpose (CLOSED · PASS)

- Pattern editor kini memiliki seleksi blok **row × channel**. `Shift+Arrow` memperluas blok; `Esc` membatalkan seleksi.
- `Ctrl+A` bersifat bertahap: pertama memilih seluruh row pada channel aktif, kedua memilih seluruh Pattern, sesuai UX tracker tanpa memaksa satu mode seleksi baru.
- `Ctrl+C` menyimpan clipboard Pattern sebagai state UI non-Undo. Clipboard menyimpan offset tick asli, duration, Instrument, velocity, dan `voiceLane`, sehingga sustain serta event off-grid masa depan tidak dipaksa ke grid saat dicopy.
- `Ctrl+V` memetakan blok ke row/channel cursor, memberi ID note baru, mengganti collision pada lane yang sama, dan menolak overflow secara atomik.
- Clipboard membawa metadata jenis track. Paste **instrument ↔ drum** ditolak dengan `E_PATTERN_BLOCK_TRACK_KIND`; voice lane nonzero juga ditolak bila target bukan track polyphonic.
- `Ctrl+↑/↓` transpose ±1 semitone dan `Ctrl+Shift+↑/↓` transpose ±12 semitone. Drum Track dilewati; bila satu pitch keluar MIDI 0..127 seluruh operasi ditolak tanpa mutasi parsial.
- Copy tidak masuk history. Paste dan transpose masing-masing satu transaksi Undo dan tetap melewati shared-pattern guard S4, sehingga Pattern shared tidak dapat dimutasi lewat shortcut maupun command/agent tanpa keputusan sesi.
- Agent hook mengekspos ringkasan clipboard serta state cursor/selection Pattern, bukan raw mutable state.
- Gate terarah run **37405305724** pada HEAD `6a8a31c…`: 0 vulnerability, unit **130/130 PASS**, check PASS, build **438,0 KiB**, Pattern/block/shared-guard Chromium+Firefox **44/44 PASS**.
- Gate final run **37405446105** pada HEAD `61603dc…`: 0 vulnerability, unit **130/130 PASS**, check PASS, build **438,0 KiB**, full browser Chromium+Firefox **208/208 PASS**.
- Berikutnya: **R3-S6 row operations + velocity interpolation** — insert/delete row secara atomik, lalu interpolasi velocity pada selection yang sama sebelum membuka FX typed.

### R3-S4 — Section + shared-pattern guard (CLOSED · PASS)

- Model `Section` yang sejak awal tersedia di Project kini benar-benar dipakai: nama wajib **1..80 karakter setelah trim**, warna `#RRGGBB`, ID unik, dan `OrderEntry.sectionId` tervalidasi. Debug JSON menolak section yatim dengan `E_DEBUG_JSON_SECTION_REF`.
- Primitive arrangement baru bersifat immutable: `addSection()`, `assignOrderEntrySection()`, dan `createSectionOccurrence()`. Assignment tidak mengubah isi Pattern.
- Song Map menampilkan **section-run kontigu** sehingga batas Section terlihat tanpa pernah menyortir ulang `song.order[]`. Order List tetap urutan global yang sama dan menampilkan nama Section sebagai konteks.
- Dialog **Tambah section** menyediakan preset Intro/Verse/Chorus/Bridge/Outro dengan nama tetap editable, serta tiga strategi Pattern: **Baru**, **Clone dari…**, dan **Pakai ulang…**.
- Tambah Section + Pattern bila diperlukan + OrderEntry dilakukan sebagai **satu Project mutation / satu transaksi Undo**. Occurrence baru menjadi focus, tetapi tab tidak berpindah otomatis.
- Pattern yang dipakai >1 occurrence diberi badge shared. Mutasi Pattern ditahan di **command layer**, bukan hanya UI, sampai keputusan sesi tersedia; jadi agent/command langsung tidak dapat melewati guard.
- Edit pertama Pattern shared membuka popover non-modal: **Edit semua** atau **Jadikan unik untuk tempat ini**. Edit yang memicu warning disimpan sebagai pending operation dan baru diterapkan sesudah keputusan.
- **Edit semua** disimpan di `sessionStorage` per Pattern dan pulih setelah reload. **Jadikan unik** memakai occurrence focus dari S3, clone Pattern + event ID, mempertahankan remap lyric anchor S1, lalu menerapkan edit tertunda ke clone.
- Popover mendukung Escape/klik luar tanpa mutasi. Lifecycle dismiss diperbaiki agar listener dibersihkan; setelah keputusan fokus dikembalikan ke grid sehingga keyboard tracker langsung aktif lagi.
- Gate S4-A run **37396653599**: unit **112/112 PASS**, check PASS, build **395,7 KiB**, browser Section/JSON/shell Chromium+Firefox **66/66 PASS**.
- Gate S4-B run **37397136374**: unit **116/116 PASS**, check PASS, build **405,6 KiB**, browser dialog Section/focus/JSON **20/20 PASS**.
- Gate S4-C awal run **37398044320** menemukan **50/54 browser PASS / 4 FAIL**: setelah keputusan fokus keyboard tertinggal pada tombol popover tersembunyi, dan CSS tombol membuat badge beratribut `hidden` tetap dianggap visible. Kedua bug UX diperbaiki tanpa mengubah semantik guard.
- Gate S4-C koreksi run **37398301719** pada HEAD `b50bdb2…`: 0 vulnerability, unit **124/124 PASS**, check PASS, build **418,7 KiB**, targeted browser **54/54 PASS**.
- Gate final run **37398469005** pada HEAD `c8f8da8…`: 0 vulnerability, unit **124/124 PASS**, check PASS, build **418,7 KiB**, full browser Chromium+Firefox **204/204 PASS**.
- Catatan PLAN: keputusan shared sudah dapat dipilih dan dipersist selama sesi. **Kontrol Settings untuk mengubah/reset keputusan itu belum memiliki surface Settings saat ini** dan tetap backlog R3 sebelum exit milestone; tidak disamarkan sebagai fitur yang sudah ada.
- Berikutnya: lanjutkan editing R3—seleksi blok/copy-paste/transpose dan generalisasi track polifonik + voice lane—dengan slice kecil dan gate terarah seperti S4.

### R3-S3 — occurrence Focus Store lintas Song/Pattern/transport (CLOSED · PASS)

- Ditambahkan **Focus Store** untuk `orderEntryId` sebagai state UI terpisah dari Project. Memilih occurrence tidak memutasi lagu dan tidak menambah langkah Undo.
- Song view mengubah focus lewat command registry `focus.setOrderEntry`, sehingga aksi yang sama tetap discoverable untuk UI dan agent.
- Pattern editor menerima resolver Pattern aktif dari app; fallback lama tetap tersedia agar komponen/test yang belum occurrence-aware tetap kompatibel.
- Transport, seek, loop, metronom, live reschedule, note count, dan state `window.tracker` kini memakai Pattern milik occurrence focus yang sama.
- Bila focus berpindah ke **Pattern berbeda** ketika Pattern-scoped playback sedang berjalan, playback dihentikan dengan Toast; ini mencegah UI Pattern B sementara audio diam-diam masih memainkan Pattern A. SongTimeline continuous playback tetap scope R3 lanjutan.
- Focus disimpan ringan di `sessionStorage` hanya sebagai `orderEntryId`; snapshot invalid dibuang fail-closed. Reload memulihkan occurrence yang sama bila masih valid, sedangkan Undo/project replace merekonsiliasi fallback ke occurrence pertama bila target hilang.
- Browser acceptance membuktikan dua occurrence dengan Pattern berbeda: edit di Pattern hanya mengubah occurrence fokus, playback menjadwalkan Pattern itu, focus tidak menambah Undo, dan focus pulih setelah reload.
- Gate terarah run **37320396089** pada HEAD `70da4c9…`: 0 vulnerability, unit **109/109 PASS**, check PASS, build **390,4 KiB PASS**, focus/Song/Pattern/transport Chromium+Firefox **56/56 PASS**.
- Gate final run **37395979236** pada HEAD `fe565b0…`: 0 vulnerability, unit **109/109 PASS**, check PASS, build **390,4 KiB PASS**, full browser Chromium+Firefox **194/194 PASS**.
- Audit dependency mengoreksi urutan roadmap internal: shared-pattern guard belum aman sebelum editor/transport memiliki occurrence context. Karena itu Focus Store ditutup lebih dulu.
- Berikutnya: **R3-S4 Section + shared-pattern guard** — Section nyata pada Song Map, assign occurrence ke section, lalu warning non-modal yang dapat menjalankan **Jadikan unik untuk tempat ini** dengan occurrence context yang sudah tidak ambigu.

### R3-S2 — Song Map + Order List (CLOSED · PASS)

- Tab **Song** kini menampilkan Song Map dan Order List sebagai dua proyeksi dari `song.order[]` yang sama; mengganti view tidak membuat salinan state lain.
- Songwriter membuka **Song Map** secara default, sedangkan preset OpenMPT-like membuka **Order List**, sesuai dua pintu masuk §8.2 tanpa membuat model data berbeda.
- Occurrence dapat dipilih lewat klik/panah. `Ctrl+D` menambah occurrence reuse, `Ctrl+Shift+D` menjalankan **Jadikan unik**, dan `Alt+Arrow` memindahkan posisi; tersedia tombol mouse dengan aksi yang sama.
- Reuse/reorder/unique seluruhnya melalui command layer dan satu transaksi history; Undo untuk **Jadikan unik** mengembalikan definisi Pattern shared tanpa langkah tambahan.
- Lencana `⛓ ×N` membuat pattern shared terlihat langsung. Tombol **Jadikan unik** nonaktif bila Pattern hanya dipakai satu tempat.
- Gate terarah run **37318431492** pada HEAD `6c21c01…`: 0 vulnerability, unit **102/102 PASS**, check PASS, build **383,6 KiB PASS**, Song+shell Chromium/Firefox **58/58 PASS**.
- Gate final run **37318735675** pada HEAD `9631365…`: 0 vulnerability, unit **102/102 PASS**, check PASS, build **383,6 KiB PASS**, full browser Chromium+Firefox **192/192 PASS**.
- Section editor penuh, drag Song Map, dan peringatan edit pertama Pattern shared tetap slice lanjutan; S2 sengaja hanya menutup dua proyeksi Order + operasi dasar yang stabil.
- Berikutnya direvisi menjadi **R3-S3 occurrence Focus Store** setelah audit dependency menunjukkan shared-pattern guard membutuhkan occurrence context lintas Song/Pattern/transport terlebih dahulu.

### R3-S1 — fondasi Order + reuse/clone Pattern (CLOSED · PASS)

- Ditambahkan primitive arrangement murni: `insertOrderEntry()`, `moveOrderEntry()`, `patternUsageCount()`, dan `makeOrderEntryUnique()`.
- Reuse menambah occurrence baru tanpa menduplikasi definisi Pattern. Reorder hanya mengubah `song.order[]`; isi note/effect/chord/tempo Pattern tetap identik.
- **Jadikan unik** membuat definisi Pattern baru dan memberi ID baru pada note/effect/chord/tempo event lokal, lalu hanya occurrence target yang dipindahkan ke clone.
- Sesuai §5.9, anchor lirik pada occurrence yang dijadikan unik ikut diremap dari note ID sumber ke note ID clone; anchor occurrence lain tetap menunjuk sumber.
- Hasil reuse/clone lolos round-trip debug JSON/session tanpa schema bump; struktur `patterns[] + order[]` memang sudah menjadi kontrak V2.
- Full gate awal membuka drift tes lama R2: **174 browser PASS / 10 FAIL**. Failure bukan runtime R3: tes lama masih menganggap reload selalu kosong setelah S11 dan Pop 4/4 masih 18 note sebelum S10.
- Baseline test dikoreksi tanpa melemahkan acceptance: tes export/import menghapus snapshot hanya ketika memang mensimulasikan sesi baru; ekspektasi Pop disinkronkan ke **26 note**.
- Gate final run **37316756386** pada HEAD `81c97ff…`: 0 vulnerability, unit **102/102 PASS**, check PASS, build **368,4 KiB PASS**, full browser Chromium+Firefox **184/184 PASS**.
- Berikutnya: **R3-S2 Song workspace — Song Map + Order List sebagai dua proyeksi dari data Order yang sama, keyboard-first**.

## R2 — Sample + Instrument (IMPLEMENTATION COMPLETE · MANUAL UX UAT PENDING)

### R2-S11 — reload custom sample + exit closure (CLOSED · PASS)

- Project aktif kini memiliki snapshot sesi ringan di `sessionStorage` agar reload tab memulihkan model Project; bytes WAV **tidak** digandakan ke sana dan tetap berada di IndexedDB.
- Restore memakai parser/validator debug JSON yang sama. Snapshot invalid dibuang fail-closed; kegagalan read/write/quota snapshot tidak membatalkan edit Project.
- Browser gate mengimpor WAV kustom, memasang Instrument, menulis pitch **60 dan 67**, reload, lalu memverifikasi Project/Instrument/note pulih dan bytes WAV IndexedDB tetap identik.
- Playback sesudah reload memakai Instrument kustom yang dipulihkan. Stop→Play kedua mempertahankan `sampleDecodeCount = 1`, sehingga sample tidak didecode ulang dalam sesi.
- Factory Basic + Drum Kit berjumlah **57.330 byte raw**, jauh di bawah budget pack **12 MiB**. Regresi Drum UI tetap membuktikan modul bytes drum belum diminta sebelum Play dan baru di-load saat diperlukan.
- Gate awal run **37313250566**: unit/check/build PASS dan 10/12 browser PASS; dua kegagalan identik berasal dari typo harness `trackId`, bukan runtime. Harness dikoreksi tanpa mengubah runtime.
- Gate final run **37313557305** pada branch HEAD `39ed918…`: 0 vulnerability, unit **96/96 PASS**, check PASS, build **363,6 KiB PASS**, browser reload/custom playback/Sound/Drum Chromium+Firefox **12/12 PASS**.
- Exit teknis R2 telah terpenuhi oleh S1–S11. **R2 belum ditandai CLOSED** karena kriteria UX §8.20 **T3 ≤ 90 detik, ≥4/5 peserta tanpa bantuan** masih membutuhkan moderated manual UAT nyata.
- Persistence ini sengaja hanya recovery reload tab untuk membuktikan exit R2; autosave durable, project library, multi-tab lock, dan format portable tetap scope R4.

### R2-S10 — Drum Track user-facing + factory Drum Kit (CLOSED · PASS)

- Template Pop 4/4 kini memakai **satu** top-level `Drums` channel dengan voice lane kick/snare/hi-hat, bukan channel terpisah per piece.
- Pattern menampilkan ringkasan hit `K/S/C/O`; tombol 1–4 mengaudisi/toggle Kick, Snare, Closed HH, Open HH tanpa auto-advance sehingga beberapa piece dapat berada pada row yang sama.
- Delete pada Drum Track membersihkan seluruh row drum sebagai satu transaksi history.
- Ditambahkan Factory Drum Kit CC0 dengan empat WAV sintetis deterministik dan metadata SHA-256 yang diverifikasi byte-for-byte.
- Pack drum dimuat dengan dynamic import hanya saat storage key `drum.*` benar-benar dibutuhkan; sebelum Play modul bytes drum tidak diambil.
- Memilih Drum Kit pada channel kosong mengubah track menjadi `kind=drum`, `polyphony=poly`. Konversi track yang sudah berisi note ditolak `E_PROJECT_DRUM_TRACK_NOT_EMPTY` agar data lama tidak ditafsirkan ulang diam-diam.
- Drum Kit S9 tanpa marker `drumKit` tetap dikenali melalui bentuk multi-zone exact-note untuk kompatibilitas.
- Gate final run **37307629497** pada HEAD `9c0b354…`: 0 vulnerability, unit **91/91 PASS**, check PASS, build **359.7 KiB PASS**, browser Drum UI/factory/Pattern/Sound Chromium+Firefox **44/44 PASS**.
- Berikutnya: **R2-S11 exit closure — reload custom sample tetap playable, persistence session, dan audit factory/lazy budget**.

### R2-S9 — Drum Track voice lane + choke group (CLOSED · PASS)

- Satu top-level Drum Track kini dapat menyimpan beberapa `NoteEvent` pada tick yang sama melalui `voiceLane` 0..31; track biasa tetap mono dan kompatibel dengan data lama.
- Ditambahkan `configureDrumTrack()`, `enterVoiceNote()`, dan `notesAtCell()`; operasi Pattern lama tetap bekerja pada lane 0.
- Drum Kit memakai satu Instrument sampler multi-zone. Setiap zone dapat memiliki `chokeGroup` sendiri sehingga closed/open hi-hat berbagi choke tanpa memotong kick/snare.
- Scheduler membawa dan mengurutkan `voiceLane` secara deterministik. Debug JSON mempertahankan lane, menolak duplicate (track,tick,lane), lane invalid, dan lane nonzero pada track mono.
- Audio engine menjalankan choke terhadap voice aktif/scheduled dengan group sama dan mengekspos observability `chokeStops`, `lastChokeGroup`, serta `activeVoiceLanes`.
- Gate awal: Chromium PASS tetapi Firefox headless tidak menggerakkan audio clock cukup cepat sehingga closed-hat belum masuk look-ahead. Harness dibuat deterministik pada 300 BPM agar row berikutnya masuk batch scheduler awal; runtime tidak diubah.
- Gate final run **37305793396** pada HEAD `3b8228a…`: 0 vulnerability, unit **88/88 PASS**, check PASS, build **272.9 KiB PASS**, browser Drum Track/choke + regresi Chromium+Firefox **4/4 PASS**.
- Berikutnya: **R2-S10 Drum Track user-facing + factory drum kit**.

### R2-S8 — global WAV drop + picker Instrument channel (CLOSED · PASS)

- Pattern header kini memiliki picker Instrument per channel. ArrowUp/ArrowDown mengganti default Instrument secara transaksional dan langsung mengaudisi pilihan.
- Audio engine mendapat `previewInstrument()` data-driven, termasuk sample IndexedDB melalui cache yang sama dengan playback.
- Global drag-drop menerima tepat satu WAV dan memasangnya ke track aktif secara deterministik: track di bawah kursor Pattern, pilihan Track tujuan di Sound, atau fallback track pertama.
- Drop tidak memindahkan workspace otomatis; hasil terlihat lewat Toast + Undo.
- Default Instrument track menjadi transaksi core immutable dan dapat di-Undo/Redo.
- Gate run **37296194679** pada HEAD `220658d…`: 0 vulnerability, unit **84/84 PASS**, check PASS, build **264.3 KiB PASS**, browser drop/picker/Pattern/Sound/playback Chromium+Firefox **48/48 PASS**.
- Berikutnya: **R2-S9 Drum Track mapping + choke group + minimal polyphonic voice-lane**.

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
