# Temuan UX

Dokumen ini adalah tempat pencatatan uji tugas bermoderasi §8.20.
Hasil tidak boleh diisi dari asumsi atau tes otomatis; setiap baris peserta harus berasal dari sesi nyata.

## Kriteria R1 / v0.1

Target lulus: minimal **4 dari 5 peserta** menyelesaikan tugas tanpa bantuan.

Persona minimum:
- minimal 1 veteran tracker;
- minimal 2 penulis lagu/gitaris non-tracker;
- peserta lain bebas selama belum terbiasa dengan NotaStation.

| Peserta | Persona | T1 Bunyi pertama ≤60 dtk | T2 Melodi 8 nada ≤2 mnt | T4 Temukan command ≤20 dtk | Bantuan? | Catatan |
|---|---|---:|---:|---:|---|---|
| P1 | belum diisi | — | — | — | — | — |
| P2 | belum diisi | — | — | — | — | — |
| P3 | belum diisi | — | — | — | — | — |
| P4 | belum diisi | — | — | — | — | — |
| P5 | belum diisi | — | — | — | — | — |

## Simulated human UAT — Luna 6 · build f63dd68 (bukan peserta manusia nyata)

**Metode:** Luna 6 memakai browser interaction dalam 10 sesi terpisah (5 persona × T4/T5),
tanpa DevTools, source, selector, JavaScript injection, Playwright, README, atau PLAN selama tugas.
Waktu adalah elapsed time simulasi dan **bukan** pengukuran performa manusia nyata.

### T4 — menemukan command lewat Command Palette

| Persona simulasi | Waktu | Hasil | Jalur |
|---|---:|---|---|
| Tracker veteran | 8 dtk | PASS | Ctrl+K → Putar dari awal Section |
| Songwriter/gitaris | 11 dtk | PASS | Tombol Palet perintah |
| Songwriter pemula DAW | 33 dtk | FAIL | `?` → overlay Shortcut → Palet perintah |
| Pengguna komputer umum | 14 dtk | PASS | Tombol Palet perintah |
| Power user teknis | 9 dtk | PASS | Ctrl+K |

**Hasil simulasi:** 4/5 ≤20 dtk · median 11 dtk · worst 33 dtk → **PASS** terhadap
ambang numerik T4, tetapi bukan pengganti UAT manusia nyata.

### T5 — menyusun Verse–Chorus–Verse di Song Map

| Persona simulasi | Waktu | Hasil | Observasi |
|---|---:|---|---|
| Tracker veteran | 173 dtk | PASS | satu dead-end pada command Atur section |
| Songwriter/gitaris | 104 dtk | PASS | preset sempat bergeser lalu dikoreksi |
| Songwriter pemula DAW | 70 dtk | PASS | reuse; tidak membuat Pattern baru |
| Pengguna komputer umum | 52 dtk | PASS | mengikuti kontrol berlabel |
| Power user teknis | 57 dtk | PASS | reuse; tanpa Ctrl+D |

**Hasil simulasi:** 5/5 ≤180 dtk · median 70 dtk · worst 173 dtk → **PASS** terhadap
ambang numerik T5.

**Temuan utama:** kelima persona menghasilkan empat tempat:
`Tanpa section → Verse → Chorus → Verse`. Tombol **Tambah section** selalu membuat occurrence
baru sehingga occurrence awal tidak pernah menjadi Verse pertama. Ini diklasifikasikan
**MEDIUM** karena tugas selesai tetapi struktur awal terasa sebagai sisa artefak.

**Koreksi R3-S12:** bila occurrence terpilih belum punya Section, dialog **Tambah section**
sekarang menetapkan Section baru ke occurrence tersebut tanpa menambah tempat. Field Pattern
disembunyikan pada mode ini karena tidak relevan. Setelah occurrence sudah punya Section,
dialog kembali ke perilaku append seperti semula. Command Palette juga membedakan command
Section teknis dan memberi arahan Song Map yang spesifik agar tidak muncul duplikasi label/
pesan konteks generik.

**Status provenance:** automated regression = akan dicatat di changelog S12 · simulated human
UAT = PASS pada build f63dd68 sebelum koreksi · real moderated human UAT = **NOT RUN**.
Simulasi harus diulang pada build koreksi dengan sesi/persona baru sebelum dipakai sebagai
pre-UAT terbaru.
## Heuristik per PR UI

- [ ] Tidak ada jalan buntu.
- [ ] Undo tersedia untuk perubahan yang dapat dibalik.
- [ ] Status penting terlihat, tidak hanya melalui warna.
- [ ] Tindakan destruktif punya jalan kembali atau konfirmasi yang sesuai.
- [ ] Semua kontrol utama dapat dijangkau keyboard.
- [ ] Fokus terlihat dan kembali ke tempat yang masuk akal setelah dialog ditutup.
- [ ] UI Indonesia/English tetap parity.

## Temuan

### UAT ad-hoc — demo stabilitas terdengar seperti satu instrumen

- **Observasi:** saat `?demo=stability` didengarkan, delapan channel tidak dapat dibedakan;
  secara subjektif hanya terdengar satu instrumen.
- **Root cause:** seluruh note demo masih menggunakan `factory.basic`; nama channel berbeda
  tidak berarti timbre berbeda.
- **Koreksi:** instrument `demo.*` kini memiliki delapan voice synth UAT berbeda dan
  scheduler meneruskan `instrumentId` sampai engine.
- **Status:** koreksi otomatis PASS; **menunggu re-test pendengaran user pada build live baru**.

### UAT ad-hoc — perkusi dominan, bagian tonal nyaris tidak terdengar

- **Observasi:** setelah timbre dipisahkan, user menyatakan hasil "lebih baik" tetapi yang
  terdengar hampir hanya perkusi.
- **Root cause:** gain kick jauh lebih tinggi daripada lead/arp/harmony, sementara envelope
  note tonal terlalu pendek untuk terbaca sebagai bass/melodi.
- **Koreksi:** turunkan mix perkusi, naikkan bass/lead/harmony, dan panjangkan envelope tonal.
- **Status:** koreksi otomatis PASS; **menunggu re-test pendengaran user pada build live baru**.

### UAT ad-hoc — tidak ada meter/Mute/Solo dan Pattern tidak mengikuti playback

- **Observasi:** user tidak dapat memastikan channel 6–8 bersuara karena tidak ada meter,
  Mute, atau Solo; Pattern juga diam di posisi awal saat playback.
- **Root cause:** engine belum memiliki bus per-track/observability dan Pattern view belum
  mengonsumsi posisi transport untuk playhead/follow.
- **Koreksi:** bus per-channel + RMS meter + Mute/Solo + playhead + auto-follow scroll.
- **Status:** koreksi otomatis PASS; **menunggu re-test user pada build live baru**.

### UAT ad-hoc — semua note terdengar pendek, tidak ada sustain

- **Observasi:** setelah semua channel dapat dipastikan bersuara, user mencatat seluruh instrument masih berupa note pendek dan tidak ada sustain yang jelas.
- **Root cause:** `enterNote()` selalu menulis `durationTicks = rowTicks`; voice tonal demo juga masih membatasi envelope maksimum sekitar 0,4 detik.
- **Koreksi:** dukungan duration eksplisit yang backward-compatible + Bass 4 row, Lead 8 row, Harmony 16 row, dengan envelope hold/release.
- **Status:** koreksi otomatis PASS; **menunggu re-test pendengaran user pada build live baru**.

### UAT ad-hoc — Lead menutupi perkusi setelah sustain

- **Observasi:** setelah sustain nyata ditambahkan, Lead menjadi terlalu dominan dan channel perkusi hampir tidak terdengar.
- **Koreksi:** turunkan gain/sustain Lead/Harmony/Bass secukupnya dan naikkan kick/snare/hi-hat secara moderat tanpa menghapus sustain.
- **Status:** gate otomatis PASS; **menunggu re-test pendengaran user pada build live baru**.

Sesi uji tugas bermoderasi manusia nyata P1–P5 belum dijalankan.
