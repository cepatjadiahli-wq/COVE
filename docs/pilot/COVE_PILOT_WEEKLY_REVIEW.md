# COVE — Pilot 4-Week Review Cadence & Meeting Guide

> **Meeting Format**: 15–20 Minutes Weekly Synchronous Review (Zoom or In-Person)  
> **Attendees**: Contractor Commercial Manager / Lead QS, Finance Manager, and COVE Founder

---

## 1. Overview of the 4-Week Review Cycle

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 4-WEEK PILOT AGENDA                                    │
├─────────────────┬──────────────────┬─────────────────┬─────────────────────────────────┤
│ WEEK 1          │ WEEK 2           │ WEEK 3          │ WEEK 4                          │
│ Data & Workflow │ Risk Accuracy &  │ Repeat Behavior │ Economic Outcome &              │
│ Fit             │ Action Execution │ & Autonomy      │ Willingness-to-Pay (WTP)        │
└─────────────────┴──────────────────┴─────────────────┴─────────────────────────────────┘
```

---

## 2. Week 1: Data Continuity & Workflow Fit

### Core Objective: Real Project Inside COVE with Trusted Numbers
* **Key Questions to Ask the Customer**:
  1. *"Apakah data klaim dan nilai opname yang masuk ke COVE sudah 100% mencerminkan kondisi lapangan?"*
  2. *"Kolom mana pada rekap Excel Anda yang paling sulit dipetakan ke COVE?"*
  3. *"Apakah istilah-istilah di aplikasi (Opname, BAP, Net Piutang, Blocker) sudah sesuai dengan kebiasaan tim Anda?"*
* **Operational Checks**:
  - [ ] Validasi seluruh nilai Money Pipeline (Work $\rightarrow$ Opname $\rightarrow$ Claimed $\rightarrow$ Certified).
  - [ ] Pastikan tidak ada selisih floating-point atau pembulatan salah.
* **Exit Gate Week 1**: Tim kontraktor menyatakan angka di COVE dapat dipercaya.

---

## 3. Week 2: Risk Accuracy & Action Execution

### Core Objective: Confirm Cash-at-Risk & Review Assigned Actions
* **Key Questions to Ask the Customer**:
  1. *"Dari nilai Cash-at-Risk yang dideteksi sistem minggu ini, mana yang benar-benar kendala riil (Confirmed Real) dan mana yang hanya keterlambatan update (False Positive)?"*
  2. *"Apakah PIC yang ditugaskan untuk Action minggu lalu sudah mengetahui apa yang harus dilakukan?"*
  3. *"Apakah rapat klarifikasi teknis dengan konsultan MK / Klien sudah dijadwalkan?"*
* **Operational Checks**:
  - [ ] Klasifikasikan setiap eksposur: `confirmed_real` vs `false_positive`.
  - [ ] Periksa apakah ada blocker baru di lapangan yang perlu dicatat.
* **Exit Gate Week 2**: Minimal 1 Action sedang aktif dikerjakan oleh tim kontraktor.

---

## 4. Week 3: Repeat Usage & Customer Autonomy

### Core Objective: Validate Independent Customer Usage without Founder Assistance
* **Key Questions to Ask the Customer**:
  1. *"Apakah tim QS atau Keuangan membuka COVE minggu ini sebelum rapat progres proyek?"*
  2. *"Apakah ada data klaim baru (MC berikutnya) yang dimasukkan secara mandiri?"*
  3. *"Pekerjaan apa terkait klaim yang minggu ini masih terpaksa dikerjakan di Excel manual atau grup WhatsApp?"*
* **Operational Checks (Founder Secret Audit)**:
  - [ ] Cek log `/internal/pilots`: hitung jumlah `customer_self_update` vs `founder_assisted_update`.
  - [ ] Periksa apakah ada feedback baru yang disubmit via tombol *Need Help?*.
* **Exit Gate Week 3**: Terbukti ada minimal 1 aktivitas mandiri yang dilakukan pelanggan tanpa panduan founder.

---

## 5. Week 4: Economic Outcome & Commercial Continuation (WTP)

### Core Objective: Review Verified Outcomes and Present Commercial Subscription
* **Key Questions to Ask the Customer**:
  1. *"Selama 30 hari pemantauan, apakah ada BAP yang berhasil disahkan atau invoice yang berhasil ditagihkan?"*
  2. *"Berapa nilai Rupiah eksposur yang berhasil diselamatkan/dipercepat prosesnya?"*
  3. *"Jika akses COVE berakhir besok, bagian mana dari sistem ini yang paling dirindukan oleh tim Anda?"*
  4. *"Apakah perusahaan bersedia melanjutkan penggunaan COVE untuk 3–5 proyek aktif lainnya dengan biaya langganan bulanan?"*
* **Operational Deliverable**:
  - [ ] Sajikan dokumen **COVE Pilot Value Summary**.
  - [ ] Catat keputusan akhir: `continue_paid`, `extend_pilot`, `pause`, atau `churn`.
