# COVE — Subscription Entitlement Matrix

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Reference Document:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 4, 8) & `COVE_PRD_v1.0_Validation_Gated_MVP.md` (Bagian 28)  

---

## 1. Prinsip Penegakan Hak Akses (Entitlement Principles)

1. **Server-Side Enforcement Mutlak:** Seluruh batas kuota dan modul fitur diperiksa di sisi server (API Routes, Server Actions, dan Database Constraints), bukan sekadar menyembunyikan tombol di UI frontend.
2. **Metrik Penagihan B2B Konstruksi:** Menggunakan prinsip *Company Base + Active Projects* (bukan lisensi per-kursi karyawan). Proyek yang telah selesai dan dialihkan ke status `ARCHIVED` tidak dihitung dalam kuota proyek aktif.
3. **Open Data Guarantee (PRD 28.1):** Hak akses unduh data (Ekspor JSON/CSV) tidak pernah diblokir atau disandera, bahkan jika langganan telah berstatus `READ_ONLY`, `CANCELLED`, atau `EXPIRED`.
4. **Isolasi Add-on Terverifikasi:** Kuota proyek tambahan (*Project Add-on*) hanya bertambah setelah bukti pembayaran atau pesanan resmi tercatat valid pada tabel `subscription_items`.

---

## 2. Matriks Komparasi Hak Akses & Fitur Antar Paket

| Dimensi Entitlement | Paid Pilot (45 Hari) | COVE Core | COVE Scale | COVE Enterprise | Project Add-on |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Target Kontraktor** | Evaluasi & Pembuktian ROI | Kontraktor Proyek Tunggal | Kontraktor Multi-Proyek | BUMN / Kontraktor Skala Besar | Ekspansi Fleksibel |
| **Harga Indikatif** | Rp 10.000.000 (sekali bayar) | Rp 2.500.000 / bulan | Rp 5.000.000 / bulan | Mulai Rp 15.000.000 / bulan | Rp 750.000 / proyek / bulan |
| **Komitmen Minimum** | 45 Hari Kalender | 12 Bulan (Rp 30 Juta/thn) | 12 Bulan (Rp 60 Juta/thn) | Kontrak Tahunan Custom | Mengikuti paket induk |
| **Batas Proyek Aktif** | **1 Proyek Aktif** | **1 Proyek Aktif** | **Hingga 5 Proyek Aktif** | **15+ Proyek Aktif (Custom)** | **+1 Proyek Aktif per unit** |
| **Batas Pengguna (Users)** | Maksimal 10 Pengguna | Maksimal 10 Pengguna | Maksimal 25 Pengguna | Tidak Terbatas (*Contractual*) | Tidak menambah pengguna |
| **Impor Data Opname (Excel/CSV)** | Ya (Pendampingan teknis) | Ya (Mandiri / Template) | Ya (Mandiri / Multi-Sheet) | Ya (Otomatisasi API/FTP) | Mengikuti kuota proyek |
| **Rekonsiliasi & Silsilah Data** | Ya (100% presisi 2 desimal) | Ya (100% presisi 2 desimal) | Ya (100% presisi 2 desimal) | Ya (Dedicated Data Engineer) | Ya |
| **Value Gap Ledger (G1 s/d G5)** | Ya (5 Gap Sekuensial) | Ya (5 Gap Sekuensial) | Ya (5 Gap Sekuensial) | Ya (Custom Gap Formula) | Ya |
| **Claim Readiness Gatekeeper** | Ya (Checklist BAP Standar) | Ya (Checklist BAP Standar) | Ya (Checklist Dinamis per MK) | Ya (Integrasi Dokumen Kustom) | Ya |
| **Action & Escalation Queue** | Ya (SLA Breach & WA Dispatch) | Ya (SLA Breach & WA Dispatch) | Ya (SLA Breach & WA Dispatch) | Ya (Integrasi Webhook ERP) | Ya |
| **Portfolio Review Level** | Review 1 Proyek Pilot | Review Tunggal + Baseline | Komparasi Multi-Proyek Penuh | Multi-Divisi / Multi-Regional | Termasuk dalam komparasi |
| **5-Column ROI Ledger** | Ya (Pilot Scorecard 8.5x ROI) | Ya (Pelacakan Level A) | Ya (Pelacakan Level A) | Ya (Executive ROI Dashboard) | Ya |
| **Weekly Review Snapshot Lock** | Ya (4x Review Bersama) | Ya (Mandiri $\le 10$ menit/prj) | Ya (Mandiri $\le 10$ menit/prj) | Ya (Executive Committee Pack) | Ya |
| **Level Jejak Audit (Audit Trail)** | Standar PP 71/2019 (1 Tahun) | Standar PP 71/2019 (1 Tahun) | Lengkap PP 71/2019 (3 Tahun) | Forensik Enterprise (7 Tahun) | Mengikuti paket induk |
| **Format Ekspor Data Historis** | CSV, Excel, PDF, JSON | CSV, Excel, PDF, JSON | CSV, Excel, PDF, JSON | CSV, Excel, PDF, JSON, Parquet | Ya |
| **Jembatan CSV ERP (ERP Bridge)** | Ya (Template SAP/Accurate) | Ya (Template SAP/Accurate) | Ya (Template SAP/Accurate) | Direct API / Custom Webhook | Ya |
| **Akses REST API Terbuka** | Tidak Tersedia | Tidak Tersedia | Read-Only API (Rate-Limited) | Full CRUD API (Custom SLA) | Tidak |
| **Integrasi SSO (SAML/Okta)** | Tidak Tersedia | Tidak Tersedia | Tidak Tersedia | Ya (SAML 2.0, Okta, Azure AD) | Tidak |
| **Batas Penyimpanan Bukti BAP** | 5 GB per Organisasi | 15 GB per Organisasi | 50 GB per Organisasi | 250 GB+ (Dapat ditambah) | +5 GB per proyek add-on |
| **Dukungan Pelanggan (Support)** | Concierge Implementation (16h) | Email & WhatsApp (Jam Kerja) | Prioritas SLA 4 Jam Kerja | Dedicated CSM & 24/7 Hotline | Mengikuti paket induk |

---

## 3. Detail Pembatasan Fungsional per Modul

### 3.1 Modul Proyek & Pengguna
* **Validasi Pembuatan Proyek Baru:**
  - Fungsi `validateProjectEntitlement(tierId, currentActiveCount)` memeriksa kuota sebelum insert ke basis data.
  - Proyek berstatus `ARCHIVED` atau `COMPLETED` tidak dihitung dalam kuota `currentActiveCount`.
  - Jika `currentActiveCount >= maxAllowed`, sistem menolak transaksi dengan kode `402 Payment Required` dan pesan:
    > *"Batas proyek aktif untuk paket Anda telah tercapai. Tambahkan Project Add-on (Rp750rb/bln) atau arsipkan proyek selesai."*
* **Validasi Undangan Pengguna Baru:**
  - Jumlah akun berstatus `ACTIVE` dalam tabel `profiles` tidak boleh melebihi `maxUsers`.
  - Penambahan pengguna di atas kuota diblokir di endpoint `POST /api/users/invite`.

### 3.2 Modul Impor Data (Data Ingestion Engine)
* **Pada Status `ACTIVE` / `PILOT_ACTIVE`:** Seluruh fungsionalitas impor XLSX/CSV, validasi baris gagal, pemetaan kolom, dan pencegahan duplikasi SHA-256 berjalan penuh tanpa batasan.
* **Pada Status `READ_ONLY` / `PAST_DUE` (setelah grace):**
  - Tombol unggah dinonaktifkan di UI.
  - Endpoint `POST /api/imports/commit` menolak request dengan HTTP 402.
  - Riwayat file impor terdahulu dan file diagnosa error tetap dapat diunduh (*downloadable*).

### 3.3 Modul Klaim & Gatekeeper Kesiapan
* **Pada Status `ACTIVE`:** Transisi stage klaim, unggah tautan bukti dokumen, dan override persetujuan direktur diizinkan sesuai peran RBAC.
* **Pada Status `READ_ONLY`:**
  - Status klaim dan dokumen BAP dapat ditinjau dan dibaca lengkap.
  - Penambahan klaim baru, perubahan nominal, dan approval override diblokir.

### 3.4 Modul Portfolio & ROI Ledger
* **Paket Paid Pilot & Core:** Dashboard portofolio menampilkan metrik terfokus pada 1 proyek aktif. Fitur penguncian snapshot mingguan (*Lock Snapshot*) aktif untuk 1 proyek tersebut.
* **Paket Scale & Enterprise:** Dashboard portofolio menyajikan matriks perbandingan performa antar-proyek (*Comparative Cross-Project Ranking*), pemisahan keterlambatan *Controllable* vs *External* portofolio, dan konsolidasi pemulihan kas Level A seluruh divisi kontraktor.

---

## 4. Penanganan Skenario Downgrade & Kelebihan Penggunaan (*Over-Limit*)

Bila terjadi penurunan paket (*downgrade*), misalnya dari **Scale (5 proyek)** ke **Core (1 proyek)**:
1. **Tidak Ada Penghapusan Data Otomatis:** Sistem COVE **DILARANG MENGHAPUS** proyek atau riwayat finansial apa pun.
2. **Layar Pemilihan Proyek Aktif (*Project Selection Flow*):**
   - Pengguna dengan peran `OWNER` atau `ADMIN` diarahkan ke layar pemilihan proyek.
   - Owner memilih 1 proyek yang tetap berstatus `ACTIVE`.
   - 4 proyek lainnya secara otomatis diubah menjadi `READ_ONLY_ARCHIVED`.
3. **Status Proyek Diarsipkan:**
   - Seluruh data historis, BAP, invoice, audit trail, dan log klaim pada proyek yang diarsipkan tetap tersimpan utuh dan dapat dilihat/diekspor kapan saja.
   - Proyek yang diarsipkan dapat diaktifkan kembali seketika jika kontraktor membeli Project Add-on atau kembali upgrade ke paket Scale.
