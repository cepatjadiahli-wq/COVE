# COVE V1 — USER GUIDE KONTRAKTOR MEP (PANDUAN PENGGUNA)
**Panduan Praktis Alur Kerja Harian Penyelamatan Arus Kas Proyek Konstruksi & MEP**  
*Untuk: Tim Lapangan & Kantor (QS, Commercial Manager, PM, Finance, Direktur)*  
*Versi:* 1.0 (Release-Ready) • *Tanggal:* 4 September 2026

---

## 1. Panduan Quantity Surveyor (QS) — Pengolahan Opname & Kesiapan Klaim

### 1.1 Mengimpor Berkas Tracker Opname Excel / CSV (UAT-01 s/d UAT-04)
1. Masuk ke halaman **Impor Data &amp; Riwayat**.
2. Pilih proyek yang sedang aktif (misal: *Grand Meridian MEP*).
3. Seret dan lepas (*drag & drop*) berkas Excel (`.xlsx`, `.xls`) atau CSV tracker Anda.
4. Periksa **Pratinjau Pemetaan Kolom (Column Mapping)**:
   - Kolom Kode Item / WBS
   - Kolom Deskripsi Pekerjaan
   - Kolom Nilai Pekerjaan Selesai (Cumulative)
   - Kolom Periode Opname
5. Sistem akan menjalankan validasi otomatis:
   - Nilai tanggal salah atau angka format teks tidak valid akan ditandai pada tabel *Baris Ditolak* lengkap dengan nomor baris dan alasan (UAT-02).
   - Bila berkas persis sama diunggah ulang, sistem memblokir duplikasi via checksum SHA-256 (UAT-03).
   - Pada berkas revisi, sistem menampilkan pratinjau perubahan baris (*Added, Changed, Removed*) (UAT-04).
6. Klik **Konfirmasi &amp; Rekonsiliasi 100%** untuk membukukan data ke dalam ledger keuangan proyek.

### 1.2 Melengkapi Checklist Dokumen Kesiapan Klaim (UAT-06 & UAT-07)
1. Buka menu **Claim Readiness Gate**.
2. Pilih klaim berjalan (misal: *MC-006 Grand Meridian*).
3. Periksa daftar dokumen pendukung wajib (*REQUIRED*):
   - *BAP Opname Lapangan Tripartite (Kontraktor, MK, Owner)*
   - *Foto Dokumentasi Progres Fisik 100%*
   - *Laporan Pengujian & Komisioning (Testing & Commissioning)*
   - *As-Built Drawing & Surat Pengantar Resmi*
4. Masukkan tautan berkas pendukung (Google Drive / SharePoint / DMS) pada kolom URL.
5. Bila seluruh item *REQUIRED* telah terverifikasi, tombol **Tandai Kesiapan Klaim (READY)** akan aktif.
6. Bila ada dokumen tertahan tetapi harus mengejar cut-off MK hari ini, koordinasikan dengan Direktur untuk meminta *Approved Override* (UAT-07).

---

## 2. Panduan Commercial Manager — Pengendalian Aturan Kontrak & Eksekusi Tindakan

### 2.1 Konfigurasi Aturan Kontrak v1.0 (Phase 3)
1. Buka menu **Setup Proyek &amp; Aturan Kontrak**.
2. Masukkan parameter batas waktu kontraktual:
   - Batas Waktu Pemeriksaan Opname oleh MK (misal: 7 hari kerja).
   - Batas Waktu Penerbitan Sertifikat Pembayaran / BAP (misal: 14 hari kerja).
   - Batas Waktu Pembayaran Invoice sejak Faktur Diterima (misal: 30 hari kalender).
   - Persentase Retensi (misal: 5%) dan Uang Muka (DP).
3. Klik **Ajukan Usulan Aturan Kontrak**. Usulan akan berstatus `PENDING_APPROVAL` hingga disetujui Direktur.

### 2.2 Menugaskan Tiket Tindakan (Action Queue) (UAT-08 & UAT-09)
1. Buka menu **Action &amp; Escalation Queue**.
2. Setiap hambatan bernilai besar pada Value Gap Ledger akan otomatis muncul sebagai potensi tindakan.
3. Klik **Buat Tindakan Baru (Create Action)**:
   - Pilih PIC Internal yang bertanggung jawab (Wajib, UAT-08).
   - Tentukan Batas Waktu (*Due Date*) penyelesaian (Wajib, UAT-08).
   - Masukkan Pihak Eksternal Terkait (Konsultan MK, QS Owner, atau PM Pemberi Tugas).
   - Tuliskan Langkah Tindakan Berikutnya (*Actionable Next Step*).
4. Gunakan tombol **Kirim Pengingat WhatsApp** untuk membuka WhatsApp Web langsung ke nomor PIC eksternal dengan format pesan operasional profesional.
5. Saat tindakan selesai, masukkan tautan bukti penyelesaian (misal link scan BAP disetujui) untuk menutup tiket (UAT-09).

---

## 3. Panduan Project Manager (PM) — Resolusi Blocker Lapangan
1. Buka menu **Executive Command Center**.
2. Fokus pada kartu **Top Controllable Blockers** (Hambatan internal yang dapat diselesaikan oleh tim proyek):
   - BAP Tertahan di Meja MK.
   - Dokumen Commissioning MEP belum ditandatangani.
   - Perbedaan perhitungan opname volume kabel tray.
3. Koordinasikan tim Site Engineer untuk melengkapi data teknis dan perbarui status tindakan menjadi *IN_PROGRESS* atau *RESOLVED*.

---

## 4. Panduan Finance & Billing — Penagihan & Rekonsiliasi Kas Masuk

### 4.1 Antrean Certified-Not-Invoiced (G4)
1. Buka menu **Progress to Cash (Pipeline Nilai)** &gt; Tab **Certified-Not-Invoiced**.
2. Setiap klaim yang BAP-nya telah terbit dari MK akan langsung masuk antrean ini.
3. Segera terbitkan Faktur Pajak dan Invoice komersial sebelum batas waktu SLA habis untuk mencegah pembengkakan waktu pra-invoice.
4. Klik **Tandai Telah Diterbitkan Invoice** dan catat nomor invoice serta tanggal jatuh tempo.

### 4.2 Pencatatan Penerimaan Kas Parsial (UAT-12)
1. Saat pembayaran dari Owner masuk ke rekening giro kontraktor, buka menu **Rekonsiliasi Kas**.
2. Masukkan nominal uang yang masuk.
3. Bila pembayaran dilakukan parsial (misal tagihan Rp 100 Juta dibayar Rp 60 Juta):
   - Sistem secara otomatis mengalokasikan pembayaran ke nomor invoice terkait.
   - Sisa piutang sebesar Rp 40 Juta tetap tercatat rapi pada tahap G5 (*Invoiced Not Collected*).

---

## 5. Panduan Direktur / Owner — Pengambilan Keputusan Strategis & Evaluasi Pilot

### 5.1 Weekly Review Mingguan (PRD 23.4)
1. Buka menu **Portfolio &amp; ROI Review**.
2. Gunakan ringkasan proyek untuk meninjau:
   - Total Eksposur Berisiko (*Cash-at-Risk*).
   - Peringkat proyek berdasarkan nilai risiko material.
   - Pemisahan hambatan internal (*Controllable*) vs likuiditas Owner (*External*).
3. Lakukan rapat koordinasi mingguan maksimal **10 menit per proyek**.
4. Klik **Kunci Snapshot Mingguan (Lock Weekly Review Snapshot)** untuk membekukan data minggu tersebut sebagai arsip evaluasi rapat direksi (UAT-15).

### 5.2 Meninjau Pilot Scorecard Hari ke-45 (PRD 23.2 & 24.5)
1. Buka menu **Onboarding &gt; Pilot Scorecard Hari ke-45**.
2. Tinjau hasil evaluasi pilot 45 hari:
   - Penurunan Eksposur Kas: Baseline vs Akhir Periode.
   - Pemotongan Siklus Penagihan: Penghematan hari kerja kalender.
   - Nilai Tindakan Level A yang Berhasil Dicairkan.
   - Pembuktian **ROI Multiplier Pilot** (e.g. 8.5x nilai biaya pilot).
3. Lanjutkan transisi ke paket langganan tahunan resmi *Core B2B* atau *Scale B2B* untuk mencakup seluruh portofolio proyek kontraktor.
