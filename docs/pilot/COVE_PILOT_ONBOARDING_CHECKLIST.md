# COVE — Pilot Onboarding 12-Step Checklist

> **Target**: Guide Customer from Zero to **First-Value Moment** (First valid Action created from real project economic exposure) within **30 minutes**.

---

## 1. The 12-Step Operational Checklist

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ONBOARDING CHECKLIST & MILESTONES                               │
├────┬──────────────────────────────────────────┬──────────────────────┬─────────────────┤
│ #  │ Operational Step                         │ Responsible PIC      │ Status          │
├────┼──────────────────────────────────────────┼──────────────────────┼─────────────────┤
│ 01 │ Buat Akun Organisasi Perusahaan          │ Founder & Owner      │ [ ] In Progress │
│ 02 │ Undang Tim Inti (Direktur, QS, Keuangan) │ Founder & Admin      │ [ ] In Progress │
│ 03 │ Buat Profil Proyek Pilot Pertama         │ Founder & Lead QS    │ [ ] In Progress │
│ 04 │ Masukkan Nilai & Ketentuan Kontrak       │ Commercial Manager   │ [ ] In Progress │
│ 05 │ Import / Input 3–10 Data Klaim Progres   │ Senior Project QS    │ [ ] In Progress │
│ 06 │ Validasi Money Pipeline Bersama Tim      │ Commercial & Finance │ [ ] In Progress │
│ 07 │ Identifikasi Paparan Finansial Terbesar  │ Founder & Lead QS    │ [ ] In Progress │
│ 08 │ Konfirmasi Apakah Risiko Valid (Real)    │ Commercial Manager   │ [ ] In Progress │
│ 09 │ Catat Kendala (Blocker) & Kontrolabilitas│ Commercial Manager   │ [ ] In Progress │
│ 10 │ Tentukan Penanggung Jawab (PIC)          │ Managing Director    │ [ ] In Progress │
│ 11 │ Terbitkan Tindakan Pertama (Action) ★    │ Assigned PIC         │ [ ] In Progress │
│ 12 │ Jadwalkan Sesi Review Mingguan 1         │ Founder & Owner      │ [ ] In Progress │
└────┴──────────────────────────────────────────┴──────────────────────┴─────────────────┘
```

> ★ **Milestone Success Gate**: Onboarding dianggap **SELESAI & SUKSES** hanya jika Langkah 11 telah dicapai (Action nyata telah dibuat dari eksposur riil proyek pelanggan).

---

## 2. Time-to-First-Value (TTFV) Measurement

Record the exact timestamps in the `/internal/pilots` record:

| Milestone Metric | Timestamp Variable | Target SLA |
| :--- | :--- | :--- |
| **Pilot Onboarding Started** | `pilot_started_at` | Day 1, 00:00 |
| **First Project Created** | `first_project_created_at` | + 5 Mins |
| **Claims Data Imported** | `first_claim_imported_at` | + 15 Mins |
| **First Risk Detected** | `first_risk_detected_at` | + 18 Mins |
| **First Action Assigned (TTFV)** | `first_action_created_at` | **< 30 Mins** |

$$\text{TTFV} = \text{first\_action\_created\_at} - \text{pilot\_started\_at}$$

---

## 3. Step-by-Step Execution Guidelines

### Steps 1–4: Setup via 7-Step Wizard (`/onboarding`)
1. Buka URL: `https://cove-staging.vercel.app/onboarding`.
2. Masukkan data legalitas PT/CV, kota, dan email tim.
3. Masukkan data proyek pilot: Nama proyek, nilai kontrak, persentase retensi 5%.

### Steps 5–8: Data Import & Validation
4. Di Langkah 4 Wizard, upload berkas CSV/Excel atau gunakan data entri manual.
5. Periksa diagram **Money Pipeline**:
   - Apakah nilai *Work Performed* sesuai dengan laporan fisik lapangan?
   - Apakah nilai *Certified* sesuai dengan BAP fisik yang sudah ditandatangani?
6. Buka kartu **Cash-at-Risk**: Minta Commercial Manager mengonfirmasi:  
   *"Apakah selisih Rp X ini memang benar sedang tertahan di konsultan MK?"*
   - Jika Ya: Tandai sebagai `confirmed_real`.
   - Jika Tidak (hanya salah input tanggal): Koreksi nilai data.

### Steps 9–12: First Action & Weekly Alignment
7. Klik **Create Blocker**: Masukkan deskripsi kendala dan tingkat kontrolabilitas (*Internal*, *Joint*, *External*).
8. Klik **Create Action**: Tentukan PIC (misal: *Andi Wijaya*) dan target batas waktu (*Due Date*).
9. Sepakati jadwal review mingguan tetap (contoh: Setiap hari Selasa jam 14:00 WIB via Zoom).
