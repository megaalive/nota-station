# UAT R1 — Tracker yang bisa dimainkan

Checklist ini menerjemahkan Exit criteria R1 di PLAN menjadi bukti yang dapat dicatat.
Jangan tandai PASS sebelum langkah benar-benar dijalankan pada build live yang sama.

## Identitas build

- main SHA:
- gh-pages deploy commit:
- build.json SHA:
- browser:
- tanggal:

## Skenario exit R1

- [ ] Buka halaman baru / first-run.
- [ ] Pilih template Pop 4/4.
- [ ] Bunyi pertama terdengar dalam **≤60 detik** (T1).
- [ ] Buat/aktifkan Pattern.
- [ ] Isi kick/snare/melodi minimal 16 row.
- [ ] Play.
- [ ] Ubah tempo saat playback; transport tetap bermain.
- [ ] Loop 100× tanpa drift progresif.
- [ ] Stop lalu Play dari awal.
- [ ] Edit note lalu Undo; state kembali benar.
- [ ] Export JSON debug.
- [ ] Reload halaman.
- [ ] Import JSON debug.
- [ ] Row, tempo, note, dan hasil bunyi sama secara semantik setelah import.

## Performa

Target R1:
- [ ] 8 channel aktif.
- [ ] 32 voice sintetis.
- [ ] 0 underrun selama 2 menit.
- [ ] first interactive tidak menunggu factory pack.
- [ ] app tanpa sample tetap di bawah budget 1,5 MiB transferred.

Catat mesin/browser referensi dan cara ukur; jangan memakai angka CI sebagai pengganti uji audio real-time manusia.

## Hasil

Belum dijalankan.
