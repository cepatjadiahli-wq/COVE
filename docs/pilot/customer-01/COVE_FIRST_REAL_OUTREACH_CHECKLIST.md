# COVE — Founder First Real Outreach Checklist

> **Purpose**: Standard operating protocol to follow before, during, and after sending real outreach messages to candidate contractor prospects.  
> **Golden Principle**: The goal of the first message is **PERMISSION TO TALK (20–30 MINS)**, not closing a software sale.

---

## 1. Pre-Send Quality Gate (Check Before Hitting Send)

- [ ] **Company Identity Verified**: Nama perusahaan dan lokasi kantor pusat sudah dipastikan eksis melalui website resmi / direktori proyek.
- [ ] **Decision Maker Profile**: Nama kontak dan peran (Direktur, Commercial Manager, Project Director) terverifikasi dari sumber publik / jaringan founder.
- [ ] **Facts vs Inferences Reviewed**: Memahami portofolio proyek yang dikerjakan tanpa berasumsi bahwa perusahaan sedang mengalami krisis keuangan.
- [ ] **Zero False Pain Claims**: Pesan tidak menuduh *"Saya dengar proyek Bapak sedang bermasalah"*, melainkan *"Kami membantu kontraktor memetakan kontrol alur nilai dari opname sampai kas"*.
- [ ] **Message Personalization**: Menyebutkan konteks spesifik perusahaan (misal: proyek gedung komersial, pabrik, atau kedekatan geografis di Bandung/Jakarta).
- [ ] **Low-Friction Call to Action (CTA)**: Mengajak diskusi santai 15–20 menit via Zoom atau tatap muka.

---

## 2. Dispatch Execution Protocol

1. **Pilih Channel yang Tepat**:
   - Jika kontak adalah jaringan pribadi / nomor WA terverifikasi: Gunakan **Warm WhatsApp**.
   - Jika kontak dari direktori resmi / nomor kantor: Gunakan **Cold WhatsApp / Telepon Perkenalan**.
   - Jika kontak eksekutif formal (CEO/CFO): Gunakan **Email Resmi Perusahaan**.
   - Jika kontak melalui profil profesional: Gunakan **LinkedIn InMail / DM**.
2. **Kirim Pesan Manual**: Founder mengirimkan pesan secara langsung dari perangkat pribadi/kantor resmi (bukan bot otomatis).
3. **Catat Waktu Pengiriman**: Simpan timestamp pengiriman.

---

## 3. Post-Send Logging & Tracking Protocol

Segera setelah pesan terkirim, buka `/internal/pilots`:
1. Klik **Log Outreach** pada baris prospek terkait.
2. Masukkan:
   - Channel: `WHATSAPP` / `EMAIL` / `LINKEDIN` / `REFERRAL`
   - Varian Pesan: `WARM_WA` / `COLD_WA` / `EMAIL` / `LINKEDIN`
   - Pengirim: *Nama Founder*
   - Status: `NO_RESPONSE` (Secara jujur mencatat status awal)
   - Tindakan Selanjutnya: *Kirim Follow-Up 1 jika belum ada balasan*
   - Tanggal Follow-Up: *Tanggal hari ini + 3 hari kerja*
3. **Peringatan Integritas**: Jangan pernah mengubah status menjadi `REPLIED` atau `DISCOVERY_BOOKED` sebelum balasan riil benar-benar diterima.

---

## 4. Protocol for Handling Prospect Responses

```text
┌───────────────────────────┬────────────────────────────────────────────────────────┐
│ Respon yang Diterima      │ Tindakan Operasional Founder                           │
├───────────────────────────┼────────────────────────────────────────────────────────┤
│ A. POSITIF / MENYETUJUI   │ 1. Segera tawarkan 2 opsi jadwal meeting (Zoom).       │
│    "Boleh, kapan bisa?"   │ 2. Ubah status prospek menjadi DISCOVERY_BOOKED.       │
│                           │ 3. Siapkan lembar COVE_DISCOVERY_CALL_SCRIPT.md.       │
├───────────────────────────┼────────────────────────────────────────────────────────┤
│ B. MINTA INFO / PROFIL    │ 1. Kirimkan 1-page overview alur Money Pipeline COVE.  │
│    "Kirim profilnya dulu" │ 2. Tetap ajak call singkat: "Setelah membaca, boleh    │
│                           │    saya hubungi kembali hari Kamis untuk tanya jawab?" │
│                           │ 3. Ubah status menjadi REQUEST_INFO.                   │
├───────────────────────────┼────────────────────────────────────────────────────────┤
│ C. TIDAK MERESPON         │ 1. Tunggu 3 hari kerja penuh.                          │
│    (Read / Unread)        │ 2. Kirim Follow-Up 1 (The Soft Check-in).              │
├───────────────────────────┼────────────────────────────────────────────────────────┤
│ D. MENOLAK                │ 1. Balas dengan sopan dan ucapkan terima kasih.        │
│    "Belum butuh saat ini" │ 2. Ubah status menjadi DECLINED / DEFERRED.            │
│                           │ 3. Catat alasan penolakan di Customer Evidence Ledger. │
└───────────────────────────┴────────────────────────────────────────────────────────┘
```
