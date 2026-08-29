# COVE — Minimum Viable Pilot Data Request

> **Document Type**: Data Preparation Sheet for Onboarding  
> **Audience**: Contractor Commercial Manager, Project QS, and Finance Manager  
> **Estimated Prep Time**: 15–30 Minutes

---

## 1. Data Minimization & Privacy Guarantee

COVE only requests the **operational minimum data** required to construct the Progress-to-Cash pipeline for 1 project:

- **Anonymization Option**: If your client contracts contain non-disclosure clauses, you may anonymize the client name (e.g. *"Client Alpha PT"*) and project name (e.g. *"Proyek Gedung Komersial Jakarta"*).
- **Zero Confidential Credentials**: COVE will **NEVER** request bank passwords, token keys, tax portal credentials, or proprietary supplier unit price breakdowns.
- **Tenant Isolation**: Your data is isolated using PostgreSQL Row Level Security (RLS) and is never accessible to other contractors or shared publicly.

---

## 2. Checklist of Required Information

### Section A: Company Information
- [ ] Nama Resmi Perusahaan (PT / CV)
- [ ] Kota & Provinsi Domisili
- [ ] Email & Kontak PIC Utama

### Section B: 1 Active Pilot Project & Contract Details
- [ ] Nama Proyek & Kode Proyek Singkat
- [ ] Nama Klien / Pemberi Tugas
- [ ] Nomor Kontrak Utama
- [ ] Nilai Kontrak Awal / Berjalan (IDR)
- [ ] Tanggal Mulai & Target Selesai Kontrak
- [ ] Ketentuan Pembayaran (Termin Bulanan / Milestone)
- [ ] Persentase Potongan Retensi (Standar: 5%)
- [ ] Masa Jatuh Tempo Pembayaran / Payment Terms (Standar: 30 Hari)

### Section C: 3 to 10 Recent Progress Claims (Monthly Certificates / MC)
Untuk setiap pengajuan klaim termin (misal: MC-001 s/d MC-005):
- [ ] Nomor Sertifikat Klaim (contoh: `MC-001`, `MC-002`, `Termin-3`)
- [ ] Periode Progres (Tanggal Awal s/d Tanggal Akhir)
- [ ] Nilai Pekerjaan Fisik di Lapangan (*Work Performed* / IDR)
- [ ] Nilai Opname yang Disepakati (*Measured Value* / IDR)
- [ ] Nilai Klaim yang Diajukan Kontraktor (*Claimed Value* / IDR)
- [ ] Nilai BAP yang Disetujui Konsultan MK (*Certified Value* / IDR)
- [ ] Tanggal Pengajuan Klaim & Tanggal Sertifikasi BAP
- [ ] Target Tanggal Kas Diterima (*Expected Cash Date*)

### Section D: Invoicing & Payment History (Finance)
- [ ] Nomor Faktur Tagihan / Invoice (contoh: `INV-2026-001`)
- [ ] Tanggal Terbit Faktur & Tanggal Jatuh Tempo
- [ ] Nilai Net Piutang (Setelah potongan retensi & uang muka)
- [ ] Nilai Kas yang Sudah Diterima & Tanggal Masuk Rekening Bank
- [ ] Sisa Piutang yang Belum Terbayar (*Outstanding*)

### Section E: Kendala Finansial yang Sedang Dihadapi (Optional)
Sebutkan jika ada kendala aktif saat ini pada proyek tersebut:
- [ ] Selisih perhitungan volume opname dengan konsultan MK
- [ ] Dokumen pendukung (laporan tes QC / foto progres) belum lengkap
- [ ] Klien terlambat melakukan proses verifikasi administrasi
- [ ] Invoice telah melewati jatuh tempo (>14 hari)

---

## 3. Data Delivery Options

1. **Option 1 (Fastest — 15 Mins)**: Isi template Excel COVE ([Download Template CSV](file:///c:/Users/rasya/COVE/app/(app)/data/page.tsx)) dan kirim via WhatsApp / Email kepada tim COVE.
2. **Option 2 (Guided Onboarding — 20 Mins)**: Input langsung bersama tim COVE saat sesi Zoom Onboarding menggunakan 7-Step Onboarding Wizard.
