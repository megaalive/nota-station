# Lagu belajar NotaStation — Malam Kota

Contoh orisinal instrumental dengan **7 Pattern unik, 9 occurrence dan 8 channel**.
Semua audio memakai voice synth dan Drum Kit bawaan NotaStation (tidak butuh login,
WAV eksternal, atau network sample). Suara Keys/Lead/Gitar adalah suara sintetis,
bukan emulasi instrumen akustik sungguhan.

**Buka langsung:** https://megaalive.github.io/nota-station/?template=learning-song

## Cara memulai

1. Pilih **Lagu lengkap — Malam Kota (8 instrumen)** di layar awal, atau buka tautan di atas.
   Jika sudah pernah membuka NotaStation, masuk tab **Song** lalu pilih **Buka lagu contoh**
   dan setujui konfirmasi penggantian proyek setelah menyimpan pekerjaan lama.
2. Di workspace **Song**, tekan **▶ Putar lagu dari awal**. Tombol Play biasa di topbar
   sengaja tetap memutar **Pattern** aktif, bukan seluruh Song.
3. Lihat struktur **Intro → Verse A/B → Chorus A/B → Bridge → Chorus A/B → Outro**.
   Chorus A/B diulang dengan **Pattern reuse** (simbol rantai ×2).
4. Pilih setiap occurrence, pindah ke **Pattern**, lalu tekan **Solo** pada channel
   tertentu untuk mendengar instrumennya, atau **Mute** untuk membandingkan aransemen.
5. Perhatikan chord tiga nada pada **Keys Pluck** dan **Pad Harmoni**. Buka voice
   lane poly untuk mengedit nada dan bandingkan durasi pendek vs sustain.
6. Coba ubah satu note Chorus, lalu buka occurrence Chorus pengulangan. Perubahan
   muncul pada keduanya karena Pattern sama. Gunakan **Jadikan unik** bila ingin
   membuat variasi chorus terakhir tanpa mengubah chorus pertama.

## Isi delapan channel

| Channel | Sound bawaan | Pelajaran |
|---|---|---|
| Drum Kit | Factory Drum Kit (Kick, Snare, Closed/Open Hi-Hat) | Drum poly dalam satu channel |
| Bass Triangle | Triangle synth | Root/fifth sesuai progresi chord |
| Keys Pluck | Factory Basic sampler | Chord staccato dan voice lane |
| Pad Harmoni | Sine synth | Tiga nada chord panjang/sustain |
| Arpeggio Square | Square synth | Pecahan nada chord per 1/8 |
| Lead Saw | Saw synth | Melodi bertema/variasi Section |
| Countermelodi | Saw synth pelan | Jawaban melodi di Chorus/Bridge |
| Tom Fill Synth | Pitch-drop synth | Fill menuju perubahan bagian |

Progressi di tonalitas **A minor**: Am–F–C–G (Intro/Verse), variasi E mayor
menjelang Chorus, F–C–G–Am (Chorus), Dm–F–E–Am (Bridge),
dan penutup pada Am. Tempo **112 BPM, 4/4**.

## Model dan kompatibilitas

- Note/Event tersimpan Pattern-local: **tidak ada absolute song tick** dalam Project.
- Semua data memakai schemaVersion 1 yang ada, tanpa perubahan schema.
- Project dapat diedit seperti template normal. Tidak ada auto-import file luar.
- Tautan `?template=learning-song` selalu memuat salinan contoh baru saat dibuka;
  simpan pekerjaan Anda terlebih dahulu sebelum membuka tautan contoh lagi.
- Uji manual utama: audio song lintas-Order, keseimbangan mix, UI mobile,
  dan interaksi Mute/Solo; tes otomatis menutup data, timeline, dan browser UI.
