# COVE — Customer Pilot #1 Onboarding Runbook (45–60 Mins)

> **Session Format**: Live Guided Video Call (Zoom) or In-Person Work Session  
> **Attendees**: Contractor Managing Director, Commercial Manager / Lead QS, Finance Manager, and COVE Founder  
> **Absolute Goal**: Reach **FIRST REAL ACTION CREATED** from real project economic exposure before ending the call.

---

## 1. Onboarding Timeline Breakdown

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ONBOARDING SESSION FLOW                                   │
├───────────────┬────────────────────────────────────────────────────────────────────────┤
│ 0:00 – 5:00   │ Phase A: Context, Goals & Privacy Alignment                            │
│ 5:00 – 15:00  │ Phase B: Organization, User & Project Contract Setup                   │
│ 15:00 – 30:00 │ Phase C: Progress Claims & Invoicing Data Import                       │
│ 30:00 – 40:00 │ Phase D: Money Pipeline & Gap Validation (The Truth Check)             │
│ 40:00 – 50:00 │ Phase E: Cash-at-Risk Diagnosis & Commercial Verification              │
│ 50:00 – 60:00 │ Phase F: First Blocker & Action Assignment (First-Value Moment ★)      │
└───────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Facilitation Script

### Phase A: Welcome & Alignment [0:00 – 5:00]
* **Founder Facilitation**:
  > *"Selamat pagi/siang rekan-rekan [Nama Kontraktor]. Terima kasih sudah meluangkan waktu 1 jam hari ini.  
  > Sesuai komitmen kita, hari ini kita akan memasukkan data 1 proyek aktif pilihan Anda ke COVE.  
  > Target kita sangat jelas: di akhir sesi ini, kita sudah melihat peta **Money Pipeline** proyek Anda, mengetahui apakah ada nilai yang tertahan, dan menugaskan 1 tindakan nyata kepada PIC yang hadir di sini."*

---

### Phase B: Organization & Project Setup [5:00 – 15:00]
* **Action**: Buka `https://cove-staging.vercel.app/onboarding`.
* **Step 1 (Company)**: Masukkan Nama PT, Kota, dan Bidang Kontraktor.
* **Step 2 (Team)**: Masukkan email Direktur, Commercial Manager, QS, dan Keuangan.
* **Step 3 (Project & Contract)**:
  - Masukkan Kode Proyek & Nama Proyek.
  - Masukkan Nilai Kontrak Utama (misal: Rp 38.500.000.000).
  - Masukkan Retensi 5% dan Termin 30 Hari.

---

### Phase C: Data Import & Claim Entry [15:00 – 30:00]
* **Action**: Masuk ke **Step 4 Wizard**.
* **Method 1 (File Upload)**: Jika kontraktor sudah menyiapkan CSV/Excel, klik upload file.
* **Method 2 (Guided Entry)**: Jika data diinput manual, masukkan baris klaim (MC-001 s/d MC-005) sesuai data intake sheet.
* **Verify**: Pastikan nilai Work Performed, Opname, Claimed, dan Certified terisi dengan benar.

---

### Phase D: Money Pipeline Validation [30:00 – 40:00]
* **Visual**: Buka **Step 5 Wizard** atau navigasi ke `/progress-to-cash`.
* **The Truth Check Prompt**:
  > *"Pak [Nama Commercial Mgr] dan Bu [Nama Finance Mgr], mari kita periksa angka ini bersama:  
  > 1. Pekerjaan fisik terpasang: Rp [Amount]  
  > 2. Hasil opname yang disepakati: Rp [Amount]  
  > 3. Pengajuan klaim resmi: Rp [Amount]  
  > 4. BAP yang disetujui MK: Rp [Amount]  
  > Apakah angka-angka ini sudah 100% cocok dengan Berita Acara dan BAP fisik di kantor Bapak/Ibu?"*

---

### Phase E: Exposure & Cash-at-Risk Diagnosis [40:00 – 50:00]
* **Action**: Buka **Command Center** $\rightarrow$ Periksa **Cash-at-Risk KPI Card**.
* **Founder Prompt**:
  > *"Sistem mendeteksi ada **Rp [Amount] Uncertified Gap** pada klaim MC-005 yang sudah 16 hari berada di tahap evaluasi konsultan MK.  
  > Boleh saya konfirmasi ke Pak [Commercial Manager]: apakah selisih nilai ini memang benar sedang tertahan karena perbedaan volume opname di lapangan?"*
* **Classification Options**:
  - `[x] confirmed_real`: Kontraktor mengonfirmasi bahwa kendala ini memang nyata dan sedang membebani kas proyek.
  - `[ ] partially_correct`: Nilainya benar tapi tanggalnya sedikit berbeda.
  - `[ ] false_positive`: Hanya keterlambatan input administrasi internal.

---

### Phase F: First Blocker & Action Assignment [50:00 – 60:00] ★
* **Action**: Buka drawer klaim $\rightarrow$ Klik **Add Blocker** $\rightarrow$ Klik **Create Action**.
* **Execute**:
  1. Masukkan Judul Blocker: *"Perbedaan perhitungan volume fasade pending persetujuan MK"*.
  2. Tentukan Kontrolabilitas: `Joint` (Perlu rapat klarifikasi bersama MK).
  3. Masukkan Judul Action: *"Jadwalkan rapat klarifikasi teknis bersama Lead QS MK untuk pengesahan BAP"*.
  4. Tetapkan PIC: *Commercial Manager* atau *Project QS*.
  5. Tetapkan Batas Waktu (*Due Date*): [Tanggal, misal: 3 hari ke depan].
* **Founder Close**:
  > *"Selamat! Proyek pilot Anda sekarang resmi aktif. Action pertama sudah ditugaskan kepada Pak [Nama PIC] dengan batas waktu [Tanggal].  
  > Kita akan bertemu kembali di sesi review mingguan 15 menit pada hari [Hari Review] jam [Waktu] untuk melihat hasil rapat klarifikasi tersebut."*

---

## 3. Post-Session Time-to-First-Value Audit

Record in `/internal/pilots`:
- `pilot_started_at`: [Timestamp]
- `first_action_created_at`: [Timestamp]
- `ttfv_minutes`: [XX Minutes] ($<30\text{ mins target}$)
- `first_exposure_confirmed`: `confirmed_real` (Rp [Amount])
