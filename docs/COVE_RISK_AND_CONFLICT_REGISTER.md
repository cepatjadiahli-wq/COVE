# COVE — Risk and Conflict Register

**Document Version:** 1.0.0  
**Audit Date:** 3 September 2026  
**Purpose:** Mengidentifikasi secara transparan setiap benturan antara basis kode yang ada dengan spesifikasi `COVE_PRD_v1.0_Validation_Gated_MVP.md`, mengevaluasi risikonya, dan mengusulkan solusi penanganan tanpa melanggar Aturan Mutlak 3.1 (Jangan menghapus fitur lama).

---

## 1. Conflict Register: Aplikasi Eksisting vs PRD v1.0

### Konflik 1: Kalkulator Pajak Konstruksi (PP No. 9 Tahun 2022)
* **Kondisi Eksisting:** Berkas `lib/finance/construction-tax.ts` menghitung tarif PPh Final Jasa Konstruksi (1.75%, 2.65%, 3.50%, 4.00%) dan PPN (11%/12%) secara otomatis pada pembuatan BAP dan Kuitansi.
* **Ketentuan PRD v1.0:** 
  - Bagian 1.2: *"COVE tidak melakukan tax filing atau menerbitkan faktur pajak."*
  - Bagian 22.2: *"COVE MVP tidak menghitung atau menentukan pajak... DPP dan perlakuan PPN tidak boleh menjadi toggle sederhana... hasil berlabel draft dan perlu verifikasi petugas berwenang."*
* **Risiko:** 
  1. *Liabilitas Hukum & Fiskal:* Jika kontraktor atau kantor pajak menemukan kesalahan penafsiran klasifikasi SBU / PP 9/2022, COVE dapat dituntut sebagai penyedia saran pajak yang keliru.
  2. *Kompleksitas Kontrak:* Faktur pajak nyata sering memiliki perlakuan khusus (PPN WAPU, PPh dipotong pengguna jasa, pembebasan PPN proyek strategis).
* **Pilihan Solusi:**
  - *Opsi A:* Menghapus kalkulator pajak. *(DILARANG oleh Aturan 3.1)*
  - *Opsi B (Rekomendasi):* **Isolasi & Disclaimer Wajib.** Kode kalkulator tetap dipertahankan utuh. Pada antarmuka dokumen BAP/Kuitansi, tambahkan label tegas: *"SIMULASI OPERASIONAL DRAFT — Perhitungan PPh Final/PPN bersifat indikatif dan wajib diverifikasi oleh Bagian Pajak / Akuntan Perusahaan sebelum penerbitan Faktur Pajak Resmi."*
* **Rekomendasi Keputusan:** Terapkan Opsi B pada Phase 3 & 5.

---

### Konflik 2: Generator Surat Somasi & Korespondensi Hukum
* **Kondisi Eksisting:** Berkas `lib/documents/legal-letter-templates.ts` dan komponen `OfficialLetterDocument.tsx` menghasilkan 4 surat formal, termasuk Surat Peringatan Keterlambatan Pembayaran (Somasi Ringan) dengan kutipan denda dan klausul hukum.
* **Ketentuan PRD v1.0:**
  - Bagian 1.2: *"COVE tidak menentukan hak hukum atau wanprestasi."*
  - Bagian 7.3: *"Automatic legal advice / Somasi otonom masuk kategori Not Planned."*
  - Bagian 22.4: *"Jika correspondence template ditambahkan kemudian: hanya operational draft... tidak menyimpulkan wanprestasi/hak/denda... wajib human approval."*
* **Risiko:** Penyebutan kata "Somasi" atau penegasan wanprestasi sepihak dapat memicu eskalasi sengketa hukum di luar kendali kontraktor.
* **Pilihan Solusi:**
  - *Opsi A:* Menghapus modul surat resmi. *(DILARANG oleh Aturan 3.1)*
  - *Opsi B (Rekomendasi):* **Rebranding & Human Verification Gate.** Ubah judul template dari "Surat Somasi" menjadi *"Surat Pemberitahuan Jatuh Tempo / Rekonsiliasi Termin"*. Tambahkan watermark *"DRAFT OPERASIONAL KONTRAKTOR"* dan disclaimer bahwa surat tersebut bukan produk penasihat hukum (*legal advice*). Tombol kirim tidak mengirimkan surat secara otonom melainkan mencetak draf untuk ditandatangani manual oleh direktur.
* **Rekomendasi Keputusan:** Terapkan Opsi B pada Phase 7 & 9.

---

### Konflik 3: Kontrol Mandor & Subkon (Pay-When-Paid Lock)
* **Kondisi Eksisting:** Berkas `lib/finance/pay-when-paid.ts` dan rute `app/(app)/subcontractors/page.tsx` menyediakan status penguncian kas mandor (*LOCKED_WAITING_OWNER_BAP*) hingga kas Owner cair.
* **Ketentuan PRD v1.0:**
  - Bagian 1.2: *"COVE tidak mengunci pembayaran subkontraktor."*
  - Bagian 22.5: *"MVP tidak memiliki payment lock. Contract-specific visibility dapat ditambahkan setelah legal review dan workflow discovery."*
* **Risiko:** Penguncian pembayaran mandor dapat menimbulkan konflik tenaga kerja di lapangan jika sistem disalahpahami sebagai pengunci saldo rekening fisik mandor.
* **Pilihan Solusi:**
  - *Opsi A:* Menghapus halaman `/subcontractors`. *(DILARANG oleh Aturan 3.1)*
  - *Opsi B (Rekomendasi):* **Modul Visibilitas Kontraktual.** Halaman `/subcontractors` dipertahankan sebagai alat bantu visibilitas keselarasan termin (*back-to-back claim tracking*) tanpa klaim bahwa sistem melakukan penguncian pembayaran otomatis di bank. Sediakan feature flag untuk menyembunyikannya dari navigasi utama pilot MEP jika pelanggan menginginkan workflow murni Progress-to-Invoice.
* **Rekomendasi Keputusan:** Terapkan Opsi B pada Phase 5.

---

### Konflik 4: Contractor Health C-Score (0–100)
* **Kondisi Eksisting:** Berkas `lib/finance/c-score.ts` dan komponen `components/dashboard/CScoreCard.tsx` menghitung skor 0–100 dengan bobot statis (Speed-to-Cash 30%, SLA 25%, BAP Gap 25%, Subcon 20%) dan grade A/B/C.
* **Ketentuan PRD v1.0:**
  - Bagian 1.2: *"COVE tidak menilai kesehatan perusahaan dengan skor yang belum tervalidasi."*
  - Bagian 11.2 (`LED-015`): *"Cash-at-risk score belum dihitung otomatis. Produk memakai exposure + age + controllability, bukan pseudo-score."*
  - Bagian 14.3: *"Hanya lima kartu eksekutif wajib... Tidak ada C-Score atau vanity metric pada MVP."*
* **Risiko:** Direksi atau auditor keuangan meragukan kredibilitas sistem jika skor 0-100 dihasilkan dari formula bobot arbitrer yang belum terkalibrasi secara empiris di industri konstruksi.
* **Pilihan Solusi:**
  - *Opsi A:* Menghapus kode C-Score. *(DILARANG oleh Aturan 3.1)*
  - *Opsi B (Rekomendasi):* **Feature-Flagged & Experimental Badge.** Jangan tampilkan C-Score pada tampilan default Command Center pilot MEP. Pindahkan atau bungkus dengan feature flag `c_score_enabled: false` untuk tenant pilot. Jika diaktifkan oleh pengguna, beri label jelas: *"Indeks Eksperimental / Internal Heuristic"*. Tampilkan 5 kartu wajib PRD sebagai metrik utama.
* **Rekomendasi Keputusan:** Terapkan Opsi B pada Phase 5 & 8.

---

### Konflik 5: Skema Harga Lifetime 799k vs B2B Pilot Subscription
* **Kondisi Eksisting:** Berkas `lib/subscription/tiers.ts`, `app/pricing/page.tsx`, dan `app/page.tsx` menawarkan 3 paket komersial (Bulanan 129rb, Tahunan 499rb, dan Lifetime 799rb) terhubung ke checkout Mayar.
* **Ketentuan PRD v1.0:**
  - Bagian 7.3 & 28.1: *"Tidak ada lifetime plan."*
  - Bagian 28: *"Pricing B2B: Paid Pilot Rp7,5–12,5 juta / 45 hari; Core Rp2,5 juta/bulan (annual min Rp30 juta); Scale Rp5 juta/bulan; Enterprise."*
  - Bagian 35: *"Lifetime plan ditolak."*
* **Risiko:** Menjual lisensi seumur hidup senilai Rp799.000 menghancurkan model bisnis SaaS B2B, membebani biaya server jangka panjang tanpa pendapatan berulang (*negative unit economics*), dan menurunkan positioning produk enterprise.
* **Pilihan Solusi:**
  - *Opsi A:* Menghapus kode pricing dan rute `/pricing`. *(DILARANG oleh Aturan 3.1)*
  - *Opsi B (Rekomendasi):* **Dual-Track Packaging.** Rute publik `/pricing` yang lama tetap dipertahankan utuh di codebase. Namun, pada alur onboarding dan pilot B2B (Modul 10), terapkan paket B2B sesuai PRD (`Paid Pilot`, `Core`, `Scale`). Tidak ada transaksi gateway otomatis yang diaktifkan tanpa perintah tertulis pengguna.
* **Rekomendasi Keputusan:** Terapkan Opsi B pada Phase 10.

---

### Konflik 6: Simulator Arus Kas 12 Minggu (Cash Stress-Testing)
* **Kondisi Eksisting:** Berkas `lib/finance/cash-stress-test.ts` dan komponen `CashStressSimulatorModal.tsx` memproyeksikan saldo kas 12 minggu ke depan dengan slider keterlambatan 0-90 hari.
* **Ketentuan PRD v1.0:**
  - Bagian 7.3: *"Forecast 12 minggu masuk kategori Later."*
  - Bagian 14.2 (`PRT-012`): *"Tidak ada forecast tanggal pasti tanpa confidence level. MVP memakai expected date + assumption label."*
* **Risiko:** Pengguna menganggap proyeksi runway kas sebagai kepastian realisasi kas di rekening bank.
* **Pilihan Solusi:**
  - *Opsi A:* Menghapus simulator kas. *(DILARANG oleh Aturan 3.1)*
  - *Opsi B (Rekomendasi):* **Label Asumsi Simulasi.** Pertahankan komponen modal, tetapi sematkan label *"Simulasi Skenario Pengujian Stres — Proyeksi ini menggunakan parameter asumsi statis pengguna dan bukan jaminan tanggal realisasi kas."*
* **Rekomendasi Keputusan:** Terapkan Opsi B pada Phase 8.

---

### Konflik 7: Model 17 Stage vs 6 Core Stages PRD
* **Kondisi Eksisting:** Basis kode menggunakan enum 17 stage: `WORK_RECORDED`, `MEASUREMENT`, `CLAIM_PREPARATION`, `CLAIM_READY`, `SUBMITTED`, `UNDER_REVIEW`, `CERTIFIED`, `INVOICE_READY`, `INVOICE_ISSUED`, `INVOICE_ACCEPTED`, `DUE`, `PARTIALLY_PAID`, `PAID`, `ON_HOLD`, `DISPUTED`, `REJECTED`, `CANCELLED`.
* **Ketentuan PRD v1.0:** PRD Bagian 9.1 menetapkan 6 core stages:
  - `S0 Imported`
  - `S1 Measured`
  - `S2 Claim-ready`
  - `S3 Submitted`
  - `S4 Certified`
  - `S5 Invoiced`
  - `S6 Collected` (sebagai outcome rekonsiliasi kas)
* **Risiko:** Kerancuan data jika transisi status lama merusak perhitungan aging atau eksposur di core stages PRD.
* **Pilihan Solusi:**
  - *Opsi A:* Mengubah skema database secara destruktif mengganti enum 17 stage. *(DILARANG oleh Aturan 3.1 & 3.4)*
  - *Opsi B (Rekomendasi):* **Stage Mapping Adapter.** Gunakan adapter dua arah: 17 sub-stage operasional yang ada dipetakan secara matematis ke 6 Core Stages PRD v1.0:
    - `WORK_RECORDED` / `MEASUREMENT` $\rightarrow$ **S1 Measured**
    - `CLAIM_PREPARATION` / `CLAIM_READY` $\rightarrow$ **S2 Claim-ready**
    - `SUBMITTED` / `UNDER_REVIEW` $\rightarrow$ **S3 Submitted**
    - `CERTIFIED` / `INVOICE_READY` $\rightarrow$ **S4 Certified**
    - `INVOICE_ISSUED` / `INVOICE_ACCEPTED` / `DUE` / `PARTIALLY_PAID` $\rightarrow$ **S5 Invoiced**
    - `PAID` $\rightarrow$ **S6 Collected**
    - Pengecualian (`ON_HOLD`, `DISPUTED`, `REJECTED`, `CANCELLED`) dipertahankan sebagai status blocker / exception tag.
* **Rekomendasi Keputusan:** Terapkan Opsi B pada Phase 5.

---

## 2. Register Risiko Teknis & Operasional

| ID Risiko | Kategori | Deskripsi Risiko | Kemungkinan | Dampak | Rencana Mitigasi |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **RSK-01** | **Scope Creep** | Mengembangkan fitur tambahan di luar 5 modul inti PRD sebelum vertical slice selesai. | Tinggi | Sangat Tinggi | Disiplin mutlak pada 12 Phase; berhenti setelah setiap phase dan menunggu perintah resmi. |
| **RSK-02** | **Data Integrity** | Terjadinya penghitungan ganda (double-counting) nilai eksposur lintas stage saat import versi baru. | Sedang | Sangat Tinggi | Penegakan invariant single-stage per value item (`LED-001`, `LED-010`) dan unit test matematis assertion. |
| **RSK-03** | **Backward Breakage** | Perubahan skema data untuk PRD merusak halaman atau rute lama yang sudah berjalan. | Sedang | Tinggi | Menggunakan additive schema changes (hanya menambahkan kolom nullable atau tabel baru, tidak pernah menghapus kolom lama). |
| **RSK-04** | **Tenant Leakage** | Bypass RLS yang memungkinkan data proyek antar perusahaan kontraktor saling terlihat. | Rendah | Bencana (Critical) | Automated negative security test (`tests/e2e/rls_security.test.js`) dijalankan pada setiap phase yang menyentuh query database. |
| **RSK-05** | **Environment Execution** | Eksekusi script shell Windows otomatis terhambat oleh path resolver workstation. | Sedang | Rendah | Menstandarisasi runner test independen berbasis Node.js langsung (`node tests/runner.js`) tanpa dependensi sub-shell. |

---

## 3. Kesimpulan

Seluruh konflik antara PRD v1.0 dan basis kode eksisting **memiliki solusi yang aman dan kompatibel tanpa menghapus fitur lama**. Semua fitur ekstra akan diproteksi menggunakan adapter, feature flags, dan disclaimer resmi, memastikan COVE v1.0 dapat berkembang memenuhi PRD baru secara tertib dan terkendali.
