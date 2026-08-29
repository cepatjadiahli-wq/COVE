# COVE — Customer Pilot #1 Data Intake Sheet

> **Instructions for Contractor**: Please fill in this intake sheet with data from **one active project**. You may use anonymized client/project names if required by contract NDAs.

---

## 1. Organization & Pilot Project Profile

```text
[SECTION A: PROFIL ORGANISASI]
Nama Perusahaan (Display):   [e.g. PT Cipta Graha Konstruksindo]
Nama Legal PT / CV:          [e.g. PT Cipta Graha Konstruksindo Perkasa]
Kota & Provinsi Domisili:    [e.g. Jakarta Selatan, DKI Jakarta]
Mata Uang & Timezone:        IDR (Rupiah) & Asia/Jakarta (WIB)

[SECTION B: PROYEK PILOT & KONTRAK UTAMA]
Kode & Nama Proyek:          [PRJ-CGK-01] [e.g. Proyek Pembangunan Office Sudirman]
Nama Klien / Pemberi Tugas:  [e.g. PT Metropolitan Properti Sejahtera]
Nomor Kontrak Utama:         [e.g. CTR-CGK-SDR-2025-001]
Nilai Kontrak Utama (IDR):   Rp [e.g. 38.500.000.000]
Tanggal Mulai & Selesai:     [2025-08-01] s/d [2026-11-30]
Metode Pembayaran:           [Progress Billing / Termin Bulanan]
Potongan Retensi (%):        [5.0 %]
Jatuh Tempo Pembayaran:      [30 Hari setelah Faktur Diterima Klien]
```

---

## 2. Historical & Active Progress Claims (3 to 10 Claims)

| # | Nomor Klaim (MC) | Periode Progres (Tgl - Tgl) | Work Performed (IDR) | Measured Opname (IDR) | Claimed Value (IDR) | Certified BAP (IDR) | Status / Tahap Terkini | Target Kas Cair |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `MC-001` | 2026-03-01 s/d 2026-03-31 | Rp 2.500.000.000 | Rp 2.500.000.000 | Rp 2.500.000.000 | Rp 2.500.000.000 | `PAID` (Lunas) | 2026-05-15 |
| **2** | `MC-002` | 2026-04-01 s/d 2026-04-30 | Rp 3.100.000.000 | Rp 3.100.000.000 | Rp 3.100.000.000 | Rp 3.100.000.000 | `PAID` (Lunas) | 2026-06-15 |
| **3** | `MC-003` | 2026-05-01 s/d 2026-05-31 | Rp 2.800.000.000 | Rp 2.800.000.000 | Rp 2.800.000.000 | Rp 2.800.000.000 | `PAID` (Lunas) | 2026-07-20 |
| **4** | `MC-004` | 2026-06-01 s/d 2026-06-30 | Rp 3.400.000.000 | Rp 3.400.000.000 | Rp 3.400.000.000 | Rp 3.400.000.000 | `INVOICED` (Tertagih) | 2026-08-30 |
| **5** | `MC-005` | 2026-07-01 s/d 2026-07-31 | Rp 3.200.000.000 | Rp 3.000.000.000 | Rp 2.750.000.000 | Rp 2.100.000.000 | `UNDER_REVIEW` (Evaluasi MK) | 2026-09-30 |

---

## 3. Invoices & Billing Reconciliation

| # | Nomor Faktur / Invoice | Terkait Klaim | Tgl Terbit | Tgl Jatuh Tempo | Nilai Gross (IDR) | Potongan Retensi (5%) | Net Piutang (IDR) | Kas Diterima (IDR) | Sisa Piutang (IDR) |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `INV-2026-001` | `MC-001` | 2026-04-10 | 2026-05-10 | Rp 2.500.000.000 | Rp 125.000.000 | Rp 2.375.000.000 | Rp 2.375.000.000 | Rp 0 |
| **2** | `INV-2026-002` | `MC-002` | 2026-05-12 | 2026-06-12 | Rp 3.100.000.000 | Rp 155.000.000 | Rp 2.945.000.000 | Rp 2.945.000.000 | Rp 0 |
| **3** | `INV-2026-003` | `MC-003` | 2026-06-15 | 2026-07-15 | Rp 2.800.000.000 | Rp 140.000.000 | Rp 2.660.000.000 | Rp 2.660.000.000 | Rp 0 |
| **4** | `INV-2026-004` | `MC-004` | 2026-07-20 | 2026-08-20 | Rp 3.400.000.000 | Rp 170.000.000 | Rp 3.230.000.000 | Rp 1.500.000.000 | Rp 1.730.000.000 |

---

## 4. Known Active Commercial Blockers

| # | Terkait Klaim/Invoice | Judul Kendala / Blocker | Kategori Kendala | Estimasi Nilai Eksposur | Kontrolabilitas | PIC Ditugaskan |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `MC-005` | Selisih volume fasade Lt 14-16 pending MK | `consultant_review` | Rp 650.000.000 | `joint` (Bersama MK) | Commercial Mgr |
| **2** | `INV-2026-004` | Sisa termin 2 menunggu pencairan kredit klien | `owner_cash_constraint` | Rp 1.730.000.000 | `external` (Klien) | Finance Mgr |
