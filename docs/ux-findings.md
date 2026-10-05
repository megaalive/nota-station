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

Sesi uji tugas bermoderasi P1–P5 belum dijalankan.
