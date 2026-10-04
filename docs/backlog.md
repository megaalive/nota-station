# Backlog — di luar scope milestone saat ini

Dikumpulkan di sini, **tidak dikerjakan** sampai dijadwalkan di PLAN.md.

## Dari temuan selama S1 (R0)

- Panel Inspector bisa disembunyikan penuh (hanya ikon) — belum ada di §8.3,
  tapi berguna untuk layar kecil.
- Status bar collapsible untuk layar pendek (< 600 px tinggi).
- Shortcut toggle tema (terang/gelap/kontras tinggi) belum ada di §8.14.

## Dari §20.1 (sudah ditunda di PLAN.md, dicatat ulang biar tidak hilang)

- Nama final produk · ekspor XM/IT · bahasa DSP kustom · WebGPU · model LLM in-browser
  · kolaborasi · PWA installability · cloud sync · editor multisample lanjutan · MPE
  · lane automasi sembarang · arsitektur plugin publik · editing di Score
  · editing penuh di ponsel · rekaman mikrofon ke sample.

## Keputusan checkpoint §20.2 yang sudah dikunci (2026-10-04)

| Item | Keputusan |
|---|---|
| Lisensi source | MIT |
| Bahasa UI default | **Indonesia**, English tersedia (diubah dari English ke Indonesian saat audit penutup R0) |
| Preset keymap | OpenMPT-like (verifikasi terhadap OpenMPT saat R3) |
| Channel UI baseline | 8 channel, batas model 32 track |
| PPQ | 480 |
| Ekstensi | `.webtrack` |
| Aturan emas, voice lane, hapus `repeatCount`, LPB + kolom DLY, mode EDIT default, istilah "Channel", urutan R5a→R5d, template awal, batas parser §10.5 | disetujui semua sesuai usulan default |

## Butir §13.4 yang belum bisa diuji smoke (menunggu milestone)

- Audio dapat diinisialisasi setelah gestur tepercaya → R1
- Proyek baru dapat dibuat → R1
- Minimal satu pattern dapat dimainkan → R1
- Manifest factory sample dapat di-fetch → R2

Keempatnya sengaja tidak diimplementasikan lebih awal demi membuat smoke test hijau —
itu persis yang dilarang brief Anda.