# COVE — Subscription Current State Audit

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Auditor:** Antigravity (Phase 13: Subscription Product Audit)  
**References:**  
- `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md`  
- `COVE_PRD_v1.0_Validation_Gated_MVP.md`  
- Repository Source Code (`C:\Users\rasya\COVE`)  

---

## 1. Executive Summary

Audit ini dilakukan sebagai langkah awal Phase 13 untuk membedah seluruh aspek arsitektur, basis data, autentikasi, kontrol akses, penagihan (*billing*), dan modul pembayaran yang ada saat ini di COVE V1.

Tujuan utama audit adalah memastikan bahwa perancangan sistem langganan B2B (*B2B Construction SaaS Subscription*) dengan pengalaman seperti Netflix memiliki fondasi teknis yang kokoh, tidak merusak 12 Phase pengembangan yang telah diselesaikan, dan mematuhi 20 aturan mutlak yang ditetapkan dalam master directive.

---

## 2. Audit 19 Dimensi Aplikasi Aktual

### 2.1 Framework dan Versi
* **Framework:** Next.js `16.3.3` (App Router, Turbopack enabled).
* **Library Utama:** React `19.0.0`, React DOM `19.0.0`.
* **Database & Auth SDK:** `@supabase/supabase-js` `^2.48.1`, `@supabase/ssr` `^0.5.2`.
* **Type System & Validation:** TypeScript `5.7.3`, Zod `3.24.2`.
* **Styling & Icons:** Tailwind CSS `3.4.17`, Lucide React `0.475.0`.
* **Parsing & File Engine:** SheetJS (`xlsx`) `0.18.5`.
* **Runtime Node:** Node.js `v25.8.0`, npm `11.11.0`.

### 2.2 Struktur Aplikasi
* `app/(app)/`: Rute terproteksi aplikasi inti:
  - `/dashboard`: Executive Command Center & Money Pipeline.
  - `/progress-to-cash`: Value Gap Ledger & 5 Gap Stages ($G_1$ s/d $G_5$).
  - `/readiness`: Claim Readiness Gatekeeper (Checklist BAP/Dokumen).
  - `/actions`: Action & Escalation Queue (SLA & Resolusi Blocker).
  - `/portfolio`: Portfolio Review, 5-Column ROI Ledger, & Weekly Snapshot Locking.
  - `/data`: Excel/CSV Ingestion & Multi-Sheet Reconciliation Engine.
  - `/onboarding`: Onboarding Wizard, 8 Data Acceptance Items, Day 45 Pilot Scorecard, & B2B Entitlement.
  - `/projects`: Daftar proyek aktif dan manajemen penugasan tim.
  - `/reports`: Executive reports & audit exports.
  - `/settings`: Pengaturan profil, organisasi, dan integrasi.
* `app/(auth)/`: Halaman autentikasi (`/login`, `/signup`, `/forgot-password`, `/reset-password`).
* `app/pricing/`: Halaman etalase paket komersial publik.
* `app/api/`:
  - `/api/payment/checkout`: Endpoint inisiasi pembayaran (legacy Mayar link).
  - `/api/webhooks/mayar`: Endpoint penerima callback webhook Mayar.
* `domains/`: Domain engine modular independen (`actions`, `demo`, `gaps`, `imports`, `invoices`, `ledger`, `onboarding`, `platform`, `portfolio`, `readiness`, `risks`, `store`).
* `lib/`: Utilitas bersama (`auth/rbac.ts`, `db/database-adapter.ts`, `mayar/client.ts`, `subscription/tiers.ts`, `supabase/`).
* `docs/`: Dokumentasi tata kelola, runbook, admin guide, user guide MEP, baseline test, dan PRD traceability matrix.
* `tests/`: 22 test suites (Unit, Integration, E2E, Security, UAT).

### 2.3 Authentication Model
* **Mekanisme:** Supabase Auth (Cookie-based session via `@supabase/ssr`) dengan fallback lokal mock auth (`TenantProvider.tsx`) saat `NEXT_PUBLIC_ENABLE_DEMO_MODE="true"`.
* **Session Handling:** Dilakukan pada `lib/supabase/middleware.ts` melalui pemanggilan `supabase.auth.getUser()`.
* **Identitas Akun:** Tabel `public.profiles` menyimpan UUID pengguna, referensi `org_id`, peran awal (`role`), dan nama lengkap.

### 2.4 Tenant / Organization Model
* **Tabel Basis Data:** `public.organizations`.
* **Karakteristik:** Multi-tenant berbasis organisasi. Setiap pengguna terhubung ke tepat satu organisasi (`profiles.org_id REFERENCES organizations.id`).
* **Metadata Organisasi Eksisting:**
  - `id` (UUID PRIMARY KEY)
  - `name`, `legal_name`, `business_type`, `city`, `province`
  - `data_classification` (`REAL`, `DEMO`, `SYNTHETIC`)
  - `customer_stage` (`pilot`, `active_customer`, `paused`, `churned`)
  - `subscription_tier` (Default `'pilot_free'`)
  - `subscription_status` (Default `'active'`)
  - `subscription_expires_at` (TIMESTAMPTZ)
  - `mayar_customer_id` (VARCHAR(100))

### 2.5 Row Level Security (RLS) & Tenant Isolation
* **Status RLS:** Aktif pada seluruh tabel di `supabase/schema.sql` (30 tabel).
* **Metode Isolasi:** Policy PostgreSQL memeriksa `org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())`.
* **Temuan Audit:** Isolasi data proyek, klaim, invoice, dan audit log antar-tenant terbukti 100% aman (terverifikasi pada Suite 9: `tests/e2e/rls_security.test.js` dan Suite 21: `tests/integration/uat_18_scenarios.test.js`).

### 2.6 Roles dan Permissions (RBAC)
* **Matriks Peran:** 9 Peran resmi pada `lib/auth/rbac.ts`:
  1. `OWNER`: Pemilik tenant, billing, policy, seluruh data.
  2. `ADMIN`: Kelola pengguna, wewenang akses proyek, template mapping.
  3. `COMMERCIAL_MANAGER`: Aturan kontrak v1.0, gap ledger, tiket tindakan.
  4. `QS` (Quantity Surveyor): Impor data opname, checklist BAP, kesiapan klaim.
  5. `PROJECT_MANAGER`: Progres fisik lapangan, bukti foto geotag, blocker.
  6. `FINANCE_MANAGER`: Antrean CNI, penerbitan invoice, penerimaan kas.
  7. `EXECUTIVE_VIEWER`: Portofolio read-only, ringkasan eksekutif.
  8. `AUDITOR`: Silsilah data (source lineage), jejak audit, compliance PP 71.
  9. `COVE_IMPLEMENTATION`: Akses pendampingan berbatas waktu (Assisted Access PRD 18.3).
* **Evaluator:** `evaluateRolePermission(role, action)`.
* **Batasan Temuan:** RBAC hanya mengevaluasi hak akses peran user, **belum mengevaluasi apakah organisasi memiliki subscription aktif atau dalam status READ_ONLY/SUSPENDED**.

### 2.7 Project Access Control
* **Model:** Berbasis tabel `public.project_members` (PRD Bagian 18.1 & 21.1).
* **Aturan:**
  - Owner, Admin, dan Executive Viewer memiliki visibilitas global seluruh proyek dalam organisasi.
  - Peran operasional (QS, PM, CM, Finance) dibatasi hanya pada proyek di mana mereka terdaftar di `project_members`.
* **Fungsi Pemeriksa:** `hasProjectAccess(user, projectId, projectMembers)` di `lib/auth/rbac.ts`. Terverifikasi pada UAT-13.

### 2.8 Audit Trail
* **Tabel Basis Data:** `public.audit_logs`.
* **Karakteristik:** Append-only immutability. Dilarang UPDATE atau DELETE melalui policy RLS (`FOR INSERT WITH CHECK`).
* **Bidang yang Dicatat:** `org_id`, `actor_id`, `actor_email`, `action`, `resource_type`, `resource_id`, `before_state`, `after_state`, `ip_address`, `user_agent`, `created_at`.
* **Kepatuhan:** Sesuai PP 71/2019 Pasal 15 ayat (1) dan UU ITE Pasal 16.

### 2.9 Pricing yang Sudah Ada
* **File Lokasi:** `lib/subscription/tiers.ts` dan `domains/onboarding/service.ts`.
* **Paket B2B Resmi (PRD Bagian 28):**
  1. `b2b_pilot`: Rp 10.000.000 (sekali bayar / 45 hari), 1 proyek aktif, maks 10 pengguna.
  2. `b2b_core`: Rp 2.500.000 / bulan (min. tahunan Rp 30.000.000), 1 proyek aktif, maks 10 pengguna, ekspansi Rp 750.000/proyek/bulan.
  3. `b2b_scale`: Rp 5.000.000 / bulan (min. tahunan Rp 60.000.000), 5 proyek aktif, maks 25 pengguna.
  4. `b2b_enterprise`: Rp 15.000.000 / bulan (proposal tahunan), proyek & pengguna tidak terbatas, SSO, dedicated engineer.
* **Paket Legacy (Kompatibilitas Mundur):**
  - `monthly_129k`: Rp 129.000 / bulan.
  - `annual_499k`: Rp 499.000 / tahun.
  - `lifetime_799k`: Rp 799.000 (Ditolak untuk pelanggan baru sesuai PRD 35; dipertahankan sebagai legacy adapter).

### 2.10 Billing yang Sudah Ada
* **Kondisi:** Sangat sederhana dan belum mencerminkan siklus langganan SaaS sejati (*recurring subscription*).
* **Alur Saat Ini:**
  - Halaman `app/pricing/page.tsx` memanggil `POST /api/payment/checkout`.
  - Backend membuat tautan pembayaran satu kali (*one-time payment link*) melalui Mayar API.
  - Tidak ada pencatatan siklus penagihan berkala (*billing cycle*), proration, add-on, dunning, atau grace period.

### 2.11 Tabel Pembayaran (Payment Tables)
* **Tabel Eksisting:**
  1. `public.cash_receipts`: Khusus pembayaran termin proyek konstruksi dari pemilik proyek (*Client/Owner*) kepada kontraktor. Bukan tabel pembayaran langganan SaaS!
  2. `public.mayar_transactions`: Tabel log mentah webhook Mayar yang mencatat `event_id`, `amount`, `fee`, `payment_method`, dan `raw_payload`.
* **Temuan Kritis:** **TIDAK ADA tabel `payments` atau `payment_attempts` resmi untuk melacak transaksi langganan B2B secara terstruktur.**

### 2.12 Tabel Subscription
* **Kondisi Saat Ini:** **TIDAK ADA tabel `subscriptions` di basis data.**
* Status langganan saat ini hanya disimpan sebagai kolom teks pada tabel organisasi:
  - `organizations.subscription_tier`
  - `organizations.subscription_status`
  - `organizations.subscription_expires_at`
* **Dampak:** Tidak ada histori pembaruan (*renewal*), tidak ada pemisahan base plan dan add-on item, tidak ada pelacakan status transisi, dan tidak ada pencatatan cancellation at period end.

### 2.13 Entitlement Enforcement
* **File Lokasi:** `domains/onboarding/service.ts` (`validateProjectEntitlement`, `validateExportEntitlement`) dan `lib/subscription/tiers.ts` (`hasFeatureAccess`).
* **Temuan Kritis:**
  - `validateProjectEntitlement` saat ini hanya dipanggil pada tampilan UI `app/(app)/onboarding/page.tsx` dan unit test.
  - **Pembuatan proyek di `CreateProjectModal.tsx` dan `database-adapter.ts` (`createProjectWithContract`) TIDAK memvalidasi kuota aktif proyek!**
  - Fungsi `hasFeatureAccess` memiliki fallback berbahaya: bila `tierId` tidak dikenali, ia memberikan default `'monthly_129k'` yang mengizinkan akses operasional.

### 2.14 Checkout Flow
* **File Lokasi:** `app/api/payment/checkout/route.ts`.
* **Kelemahan Kritis:**
  - Hardcoded normalization hanya mengenali tier legacy (`monthly`, `annual`, `lifetime`). Paket B2B baru dinormalisasi salah menjadi `lifetime_799k`!
  - Mode simulasi mengembalikan URL sukses:
    `checkoutUrl: `${appUrl}/dashboard?payment_success=true&tier=${normalizedTierId}``
    Hal ini melanggar Aturan Mutlak 14: *"Jangan membuka akses berdasarkan halaman payment success."*
  - Payload checkout hanya menerima `customerEmail`, tidak mengaitkan `organization_id`.

### 2.15 Webhook Endpoint
* **File Lokasi:** `app/api/webhooks/mayar/route.ts`.
* **Kelemahan Kritis:**
  - Verifikasi signature diabaikan jika env var tidak diatur:
    `if (!secretEnv) { return true; }` (Risiko keamanan tinggi).
  - Idempotency key di-generate acak:
    `event_id: `${event}_${data.id}_${Date.now()}``
    Penggunaan `Date.now()` membuat setiap percobaan retry oleh gateway dianggap event baru, memicu risiko proses ganda (*double activation*).
  - Pemutakhiran organisasi dilakukan dengan mencocokkan nama legal (`legal_name = data.customer?.name`), bukan foreign key `org_id`.

### 2.16 Payment Provider
* **Provider Saat Ini:** Mayar.id (`lib/mayar/client.ts`).
* **Jenis Integrasi:** One-time invoice checkout link (`/hl/v1/payment/create`).
* **Evaluasi:** Tidak mendukung fitur auto-recurring headless yang diperlukan untuk pengalaman seperti Netflix pada penagihan kartu/direct debit.

### 2.17 Environment Variables Terkait Billing
* Berdasarkan `.env.example`:
  - `MAYAR_API_KEY`: API Key Mayar (Server secret).
  - `MAYAR_WEBHOOK_SECRET`: Secret token validasi webhook Mayar.
  - `MAYAR_API_URL`: URL API Mayar (default `https://api.mayar.id/hl/v1/payment/create`).
  - `NEXT_PUBLIC_ENABLE_DEMO_MODE`: Pengendali mode demonstrasi (`true`/`false`).
* **Temuan:** Belum ada konfigurasi untuk Xendit, Midtrans, atau cron secret.

### 2.18 Admin Access
* **Kondisi Saat Ini:**
  - Peran `OWNER` dan `ADMIN` dapat mengelola pengguna dan proyek di tenant masing-masing.
  - Akses `COVE_IMPLEMENTATION` (PRD 18.3) menyediakan bantuan operasional yang disetujui pelanggan.
  - **TIDAK ADA halaman COVE Admin Billing global** (Customer directory, failed webhook replay, manual override console, MRR/ARR analytics).

### 2.19 Scheduled Jobs / Workers
* **Kondisi Saat Ini:** **TIDAK DITEMUKAN cron job, worker background, atau queue runner** di aplikasi untuk menangani:
  - Pemeriksaan kedaluwarsa langganan harian.
  - Transisi otomatis dari ACTIVE ke PAST_DUE saat pembayaran gagal.
  - Transisi dari PAST_DUE ke READ_ONLY setelah grace period (H+7).
  - Transisi ke SUSPENDED (H+21).
  - Pengiriman email pengingat dunning H-7 dan H-1.

### 2.20 Test Terkait Akses dan Pembayaran
* **Test Suites Eksisting:**
  - `tests/unit/rbac_auth.test.js` (Suite 12): Menguji 9 peran RBAC dan isolasi proyek.
  - `tests/unit/onboarding_entitlement.test.js` (Suite 20): Menguji batas kuota proyek paket B2B dan penolakan lifetime plan.
  - `tests/e2e/rls_security.test.js` (Suite 9): Menguji kebocoran data lintas tenant pada tabel Supabase.
* **Ketiadaan Test (BELUM DIUJI):**
  - Belum ada pengujian siklus transisi state machine subscription (DRAFT $\rightarrow$ ACTIVE $\rightarrow$ PAST_DUE $\rightarrow$ READ_ONLY $\rightarrow$ SUSPENDED).
  - Belum ada pengujian idempotensi webhook terhadap payload duplikat.
  - Belum ada pengujian pemblokiran mutasi data pada status READ_ONLY di level API / Database.

---

## 3. Kesimpulan Kondisi Awal

Sistem COVE V1 saat ini memiliki fondasi multi-tenant, RBAC, dan audit trail yang sangat solid untuk domain konstruksi (*Progress-to-Invoice*). Namun, sistem langganan komersialnya saat ini masih berada pada tahap **primitif (one-time checkout manual)** dan **membutuhkan perombakan total pada arsitektur data model, lifecycle state machine, serta server-side entitlement guard** pada Phase 14–20.
