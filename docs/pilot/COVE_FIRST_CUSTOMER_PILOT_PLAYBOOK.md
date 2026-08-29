# COVE — First Customer Pilot Playbook

> **Operational Field Manual for COVE Founder & Pilot Ops**  
> **Goal**: Onboard 3–5 Indonesian construction contractors, pilot **one active project** per contractor for **30 days**, and generate undeniable behavioral and financial evidence on whether the **Progress-to-Cash** wedge is a viable commercial SaaS business.

---

## 1. Core Pilot Philosophy

1. **Focus on Real Behavior, Not Compliments**: A contractor saying *"Aplikasi Anda bagus sekali"* is **NOT** product validation. Product validation is a contractor logging in without reminder, confirming a Rp 650M Uncertified Gap, creating an Action, and assigning their QS to resolve it before the weekly project meeting.
2. **One Company, One Active Project**: Never attempt company-wide data migration during a 30-day pilot. Limit scope strictly to:
   - 1 Contractor Organization
   - 1 Active Project (Ongoing with active monthly progress claims)
   - 2 to 5 Users (Owner/Director, Commercial Manager, Project QS, Finance Manager, Project Manager)
   - 3 to 10 Historical & Current Claims
3. **The Core Loop**:
   $$\text{PROJECT DATA} \longrightarrow \text{MONEY PIPELINE} \longrightarrow \text{EXPOSURE} \longrightarrow \text{BLOCKER} \longrightarrow \text{ACTION} \longrightarrow \text{OUTCOME}$$
4. **No Feature Expansion During Pilot**: Never promise or code custom ERP modules, WhatsApp bots, AI estimators, or BIM integrations for Pilot Customer #1. If they hit a bug or UX friction, log it in the Feedback Backlog.

---

## 2. 30-Day Pilot Lifecycle Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               30-DAY PILOT TIMELINE                                   │
├─────────────────┬─────────────────┬──────────────────┬────────────────┬────────────────┤
│ WEEK 0          │ WEEK 1          │ WEEK 2           │ WEEK 3         │ WEEK 4         │
│ Screening &     │ Onboarding &    │ Exposure &       │ Repeat Usage & │ Outcome Review │
│ Outreach        │ Claims Import   │ Action Creation  │ Self-Service   │ & WTP Decision │
├─────────────────┼─────────────────┼──────────────────┼────────────────┼────────────────┤
│ • ICP Scoring   │ • 7-Step Wizard │ • Cash-at-Risk   │ • Track Self-  │ • Value Summary│
│ • Outreach Msg  │ • Import 3-10   │   Confirmation   │   Updates      │ • 20-Q Interview│
│ • 15-min Demo   │   Claims        │ • Assign Action  │ • Audit Meeting│ • WTP Proposal │
│ • Data Request  │ • Pipeline Sign │ • Weekly Sync #1 │   Usage        │ • Pilot Verdict│
└─────────────────┴─────────────────┴──────────────────┴────────────────┴────────────────┘
```

---

## 3. Outreach Messaging Templates

### Template A: WhatsApp Direct Message (To Owner / Managing Director)
```text
Selamat pagi/siang Pak [Nama Owner],

Perkenalkan saya [Nama Founder], founder dari COVE. 

Kami sedang mengembangkan sistem kontrol nilai proyek khusus untuk kontraktor konstruksi di Indonesia. Fokus kami bukan mengganti software accounting atau ERP yang sudah ada, melainkan membantu direksi dan tim komersial memetakan perjalanan nilai pekerjaan fisik di lapangan hingga benar-benar cair menjadi kas di rekening bank.

Saat ini kami membuka program Controlled Early Access Pilot (30 hari) untuk 3–5 kontraktor terpilih dengan memonitor 1 proyek aktif yang sedang berjalan.

Tujuannya adalah membuktikan apakah sistem ini bisa langsung mendeteksi di mana nilai klaim/termin tertahan (misal: opname belum disepakati, BAP menggantung di MK, atau invoice jatuh tempo), siapa penanggung jawabnya, dan tindakan apa yang perlu diambil minggu ini.

Jika Bapak ada waktu 15 menit minggu ini, saya ingin mendemokan simulasi alur uang proyek ini secara singkat. Apakah hari [Hari] atau [Hari] jam [Waktu] memungkinkan untuk online meeting singkat?

Terima kasih banyak, Pak.
[Nama Founder] — COVE
```

### Template B: Formal Email Outreach
```text
Subject: Permohonan Diskusi Singkat: Pilot Kontrol Progress-to-Cash Proyek [Nama Kontraktor]

Yth. Bapak/Ibu [Nama Direktur / Commercial Director],
[Nama Perusahaan Kontraktor]

Semoga Bapak/Ibu senantiasa dalam keadaan sehat dan sukses.

Dalam industri konstruksi, salah satu tantangan terbesar manajemen kontraktor adalah jeda waktu dan selisih nilai antara pekerjaan fisik yang telah selesai di lapangan dengan penerimaan kas nyata (Progress-to-Cash Gap)—mulai dari volume opname yang belum diakui, persetujuan BAP konsultan MK yang tertahan, hingga faktur termin yang melewati jatuh tempo.

Kami di COVE (cove.id) membangun operating system ekonomi proyek yang dirancang khusus untuk memetakan alur nilai tersebut secara real-time.

Kami mengundang [Nama Perusahaan Kontraktor] untuk menjadi mitra dalam program "COVE Controlled Early Access Pilot":
1. Durasi: 30 Hari kalender.
2. Lingkup: 1 Proyek aktif pilihan Anda (2–5 user: Direksi, QS, Keuangan).
3. Output: Visibilitas penuh terhadap Cash-at-Risk, identifikasi kendala (blocker), penugasan tindakan mingguan, dan laporan rekapitulasi nilai proyek.

Kami tidak meminta komitmen migrasi sistem perusahaan dan proses onboarding hanya membutuhkan waktu kurang dari 30 menit.

Apakah kami dapat menjadwalkan sesi demonstrasi 15 menit pada minggu ini untuk menunjukkan bagaimana COVE bekerja?

Hormat kami,
[Nama Founder]
Founder & CEO, COVE
[Nomor WhatsApp / Kontak]
```

### Template C: LinkedIn / Professional DM
```text
Halo Pak [Nama], salam kenal. Saya melihat perkembangan proyek [Nama Perusahaan Kontraktor] yang sangat impresif. 

Saat ini saya bersama tim sedang membangun COVE, platform kontrol finansial proyek untuk kontraktor Indonesia yang berfokus mendeteksi nilai klaim termin yang tertahan antara opname fisik, sertifikasi BAP konsultan, dan pencairan kas.

Kami sedang membuka akses pilot terbatas 30 hari untuk 1 proyek aktif. Apakah terbuka untuk diskusi santai 15 menit via Zoom minggu ini? Terima kasih, Pak!
```

---

## 4. Key Operating Principles for the Founder

1. **Never Blame the Customer**: If they cannot figure out how to import an Excel file, the import UI is confusing. Do not explain how the code works; note down the exact friction in the Feedback log.
2. **Causality Integrity**: If a customer collects Rp 1.5B during the pilot, never claim *"COVE generated Rp 1.5B"*. Claim *"Rp 1.5B collected during the COVE monitoring period"*, and only claim COVE acceleration if the customer explicitly confirms: *"Tanpa reminder action COVE, kami tidak akan menekan konsultan MK untuk rapat klarifikasi volume minggu itu."*
3. **Differentiate Self-Service from Founder-Assisted Usage**:
   - `founder_assisted_update`: Founder sits next to customer or enters data on Zoom.
   - `customer_self_update`: Contractor QS or Finance logs in independently and updates MC status.
   - Only `customer_self_update` counts toward true product adoption.
