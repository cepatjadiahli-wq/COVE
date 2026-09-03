# COVE — Current State Repository & System Audit

**Audit Timestamp:** 3 September 2026  
**Document Version:** 1.0.0  
**Auditor:** Antigravity Engineering Agent  
**Context:** Pre-Phase 1 Discovery & Technical Due Diligence  
**Repository Path:** `C:\Users\rasya\COVE`  
**Target Product Definition:** `COVE_PRD_v1.0_Validation_Gated_MVP.md`

---

## 1. Executive Summary

Aplikasi **COVE (Construction Operations Value Engine)** saat ini berada pada tahap prototipe tingkat lanjut (*Advanced Functional Prototype / Sellable MVP v1.0 candidate*). 

Aplikasi telah memiliki fondasi arsitektur **Modular Monolith** berbasis **Next.js (App Router)** dan skema database relasional **PostgreSQL (Supabase)** dengan Row-Level Security (RLS) serta mock/persistent store di sisi aplikasi.

Namun, terjadi pergeseran fokus produk (*Strategic Product Realignment*) antara basis kode yang ada (yang mengimplementasikan PRD/Blueprint awal yang sangat luas: 17 stage, kalkulator pajak, generator somasi/surat resmi, kontrol mandor pay-when-paid, simulator ketahanan kas, C-Score, dan lifetime plan Mayar) dengan **`COVE_PRD_v1.0_Validation_Gated_MVP.md`** yang membatasi produk secara tajam sebagai:
> **Progress-to-Invoice Control System untuk kontraktor spesialis MEP menengah pada proyek swasta.**  
> *Workflow inti:* **Measured → Claim-ready → Submitted → Certified → Invoiced**  
> *Vertical slice:* **Import tracker → Reconciliation → Value Gap Ledger → Claim Readiness → Action Queue → Stage Event → Resolved Exposure**

Audit ini mencatat kondisi aktual repository secara non-destruktif tanpa mengubah kode apa pun, mengidentifikasi seluruh dependensi, dan menyiapkan baseline untuk stabilisasi pada Phase 1.

---

## 2. Technology Stack Identification

Berdasarkan pemeriksaan langsung pada `package.json`, konfigurasi proyek, dan direktori kode:

| Komponen | Spesifikasi Aktual Repository | Status & Catatan |
| :--- | :--- | :--- |
| **Framework Web** | Next.js `16.3.3` (App Router) | Menggunakan React Server Components, Client Components, dan Server Actions/API Route Handlers. |
| **UI Library / Runtime** | React `19.0.0` / React DOM `19.0.0` | React 19 LTS runtime. |
| **Bahasa Pemrograman** | TypeScript `5.7.3` | Konfigurasi strict mode di `tsconfig.json`. |
| **Styling & Design System** | Tailwind CSS `3.4.17` + `shadcn/ui` (CVA `0.7.1`, Tailwind Merge `3.0.1`, clsx `2.1.1`) | Styling dark-navy/slate enterprise dengan aksen semantic green/amber/red. |
| **Ikonografi** | Lucide React `0.475.0` | Set ikon SVG lengkap. |
| **Date & Parsing Library** | `date-fns` `4.1.0` | Formatting tanggal ISO dan manipulasi kalender. |
| **Excel / Spreadsheet** | `xlsx` (SheetJS) `0.18.5` | Digunakan untuk membaca dan menulis berkas spreadsheet. |
| **Validation Library** | `zod` `3.24.2` | Schema validation untuk runtime data integrity. |
| **Database & Auth** | Supabase (`@supabase/supabase-js` `2.48.1`, `@supabase/ssr` `0.5.2`) | PostgreSQL 15+ dengan Row-Level Security (RLS) di `supabase/schema.sql`. |
| **Payment Gateway** | Mayar.id SDK / Client custom di `lib/mayar/client.ts` | Integrasi QRIS, Virtual Account, dan E-Wallet via Webhook listener. |
| **Hosting & Deployment** | Vercel Serverless Platform (`vercel.json`) | Terhubung ke GitHub repository `cepatjadiahli-wq/COVE`. |
| **Test Runner** | Node.js Test Runner custom (`tests/runner.js`) | Menggunakan 11 test suites berbasis modul Node.js assert. |

---

## 3. Directory Structure & Code Organization

```text
c:\Users\rasya\COVE\
├── app/                              # Next.js App Router
│   ├── (app)/                        # Authenticated internal application shell
│   │   ├── actions/page.tsx          # Action Ledger & Prioritization
│   │   ├── dashboard/page.tsx        # Executive Command Center
│   │   ├── data/page.tsx             # Data Center (Import/Export UI)
│   │   ├── feedback/page.tsx         # User Feedback capture
│   │   ├── internal/pilots/page.tsx  # Internal Pilot Onboarding Management
│   │   ├── onboarding/page.tsx       # Interactive Onboarding Walkthrough
│   │   ├── progress-to-cash/page.tsx # Core Progress-to-Cash Ledger & Drawer
│   │   ├── projects/page.tsx         # Project Portfolio Grid
│   │   ├── projects/[id]/page.tsx    # Project Detail (Overview, Gaps, Actions, VO, Letters)
│   │   ├── reports/page.tsx          # 8 Standard Financial Reports
│   │   ├── settings/page.tsx         # Tenant, SLA, WhatsApp Gateway Settings
│   │   └── subcontractors/page.tsx   # Subcontractor Pay-When-Paid Control Ledger
│   ├── (auth)/                       # Authentication screens (Login, Signup, Reset)
│   ├── api/                          # Route handlers (Mayar checkout & webhooks)
│   ├── pricing/page.tsx              # Commercial Pricing & Paywall Gate
│   └── page.tsx                      # Commercial Landing Page
├── components/                       # UI Component Library
│   ├── blockers/                     # AddBlockerModal
│   ├── claims/                       # ClaimDetailDrawer, CreateClaimModal, RecertifyModal
│   ├── dashboard/                    # MoneyPipeline, KpiCard, CScoreCard, TopActionsCard
│   ├── documents/                    # BAPDocument, ReceiptDocument, OfficialLetterDocument
│   ├── evidence/                     # GeotagPhotoUploader, SmartDocumentViewer
│   ├── finance/                      # CashStressSimulatorModal
│   ├── invoices/                     # IssueInvoiceModal, RecordReceiptModal
│   ├── layout/                       # Sidebar, TopBar, TenantProvider
│   ├── notifications/                # WhatsAppDispatchModal
│   ├── projects/                     # CreateProjectModal, VariationOrderModal
│   ├── shared/                       # RiskBadge, StageBadge
│   ├── subscription/                 # SubscriptionGateModal
│   └── ui/                           # Primitive components (button, dialog, input, tabs, etc.)
├── domains/                          # Pure Domain Services & Business Rules
│   ├── actions/service.ts            # Action priority & outcome resolution
│   ├── claims/stage-engine.ts        # 17-Stage transitions & duration math
│   ├── demo/                         # Demo fixtures & mock state
│   ├── evidence/service.ts           # Evidence checklist scoring (4 bands)
│   ├── freshness/service.ts          # Freshness classification (FRESH/NEEDS_UPDATE/STALE)
│   ├── gaps/service.ts               # 5-gap mathematical formulas
│   ├── invoices/service.ts           # Net receivable & reconciliation
│   ├── risks/service.ts              # Deterministic cash-at-risk & non-double-counting
│   └── store/persistent-store.ts     # In-memory & local storage state manager
├── lib/                              # Shared Utilities, Database & Integrations
│   ├── constants.ts                  # Enums, roles, stage definitions
│   ├── documents/                    # Legal letter generator templates
│   ├── finance/                      # Tax engine (PP 9/2022), C-Score, Cash stress test, PWP
│   ├── i18n/                         # ID/EN translations & context
│   ├── mayar/                        # Mayar API client
│   ├── notifications/                # WhatsApp link formatter
│   ├── subscription/                 # Pricing tier entitlements
│   ├── supabase/                     # Supabase clients & middleware
│   └── utils.ts                      # IDR currency formatting, date utilities
├── supabase/
│   └── schema.sql                    # 15 tables with PostgreSQL RLS & constraints
├── tests/                            # Test Suites
│   ├── unit/                         # 6 Unit tests (gaps, risk, invoices, evidence, actions, freshness)
│   ├── integration/                  # 2 Integration tests (claim_transition, pilot_isolation)
│   ├── e2e/                          # 3 E2E test suites (critical_flow, rls_security, browser_cove)
│   └── runner.js                     # Unified test execution runner
└── docs/                             # Existing system & pilot documentation
```

---

## 4. Database & Persistence Layer Audit

Database didefinisikan dalam `supabase/schema.sql` (402 baris SQL).

### 4.1 Tabel Database Aktual
1. `public.organizations`: Multi-tenant boundary dengan `subscription_tier`, `subscription_status`.
2. `public.profiles`: Pengguna dan peran (`role` enum: OWNER, DIRECTOR, PROJECT_MANAGER, COMMERCIAL_MANAGER, PROJECT_QS, FINANCE_MANAGER, PROJECT_CONTROL, PROCUREMENT_LEAD, ADMIN, VIEWER).
3. `public.clients`: Klien / Pemberi Tugas.
4. `public.projects`: Proyek dengan kode unik per organisasi (`unique_project_code_per_org`).
5. `public.contracts`: Kontrak utama dengan retensi, DP, dan nilai kontrak (`numeric(18,2)`).
6. `public.claims`: Pengajuan termin dengan 6 nilai progres moneter dan `current_stage`.
7. `public.claim_stage_history`: Append-only history transisi stage klaim dengan `duration_hours`.
8. `public.blockers`: Kendala lapangan dengan `financial_exposure`, `severity`, `controllability`.
9. `public.actions`: Tindakan penanganan risiko dengan `priority`, `outcome_type`, `outcome_value`.
10. `public.invoices`: Faktur dengan potongan retensi, pajak, dan outstanding amount.
11. `public.cash_receipts`: Bukti penerimaan kas masuk per faktur.
12. `public.retentions`: Pelacakan retensi pemeliharaan.
13. `public.evidence_requirements`: Master checklist bukti klaim.
14. `public.claim_evidence`: Status pemenuhan bukti per klaim.
15. `public.audit_logs`: Audit trail untuk perubahan finansial dan akses.
16. `public.mayar_transactions`: Log pembayaran gateway Mayar.

### 4.2 Row-Level Security (RLS)
- Seluruh 15 tabel operasional telah dilengkapi perintah `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
- Helper function `public.get_user_org_id()` mengekstrak `org_id` dari `profiles` berdasarkan `auth.uid()`.
- Kebijakan RLS membatasi `SELECT`, `INSERT`, `UPDATE`, `DELETE` hanya pada baris dengan `org_id = get_user_org_id()`.
- Role `VIEWER` dibatasi hanya untuk operasi `SELECT`.

### 4.3 Data Layer di Sisi Frontend
- Saat ini antarmuka pengguna (`app/`) utamanya berkomunikasi melalui `domains/store/persistent-store.ts` (`coveStore`).
- `coveStore` menginisialisasi state dari seed data (`domains/demo/seed-data.ts`) dan menyimpannya secara persisten ke browser `localStorage` dengan audit logging otomatis.
- Terdapat adapter database di `lib/db/database-adapter.ts` yang menjembatani panggilan Supabase bila env variable Supabase aktif.

---

## 5. Security, Secrets, and Authentication Audit

1. **Authentication:**
   - Menggunakan Supabase Auth di `lib/supabase/client.ts`, `server.ts`, dan `middleware.ts`.
   - Halaman login, signup, forgot password, dan reset password telah dibangun di `app/(auth)/`.
   - Tersedia persona switcher di UI untuk pengujian role tanpa logout.
2. **Secrets & Environment Variables:**
   - Berkas `.env.example` mencantumkan:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `MAYAR_API_KEY`
   - Berkas `.gitignore` melindungi `.env`, `.env.local`, `node_modules/`, dan `.next/`.
   - Tidak ditemukan secret produksi yang hard-coded di repository publik.

---

## 6. Build, Type-Check, and Test Status

### 6.1 Status Eksekusi Lingkungan
Pada sesi audit non-destruktif di workstation Windows ini, pemanggilan sub-proses shell (`powershell`) melalui runner otomatis mengalami limitasi environment (`exec: powershell not found in PATH` akibat resolusi direktori lokal). Namun, inspeksi kode statis (*Static Code Analysis*) dilakukan secara teliti:

1. **TypeScript Compilation:**
   - Semua modul diekspor dan diimpor dengan type definition lengkap.
   - Tag JSX pada `app/(app)/projects/[id]/page.tsx` telah ditutup rapi.
   - Properti klien (`client.name`) telah diselaraskan dengan interface `DemoClient`.
2. **Test Suite Catalog (11 Suites di `tests/runner.js`):**
   - Unit tests: `tests/unit/gaps.test.js`, `risk.test.js`, `invoices.test.js`, `evidence.test.js`, `actions.test.js`, `freshness.test.js`.
   - Integration tests: `tests/integration/claim_transition.test.js`, `pilot_isolation.test.js`.
   - E2E tests: `tests/e2e/critical_flow.test.js`, `rls_security.test.js`, `browser_cove_journey.spec.js`.
   - **Status pengujian aktual:** `BELUM DIUJI` secara automated runner pada sesi ini karena limitasi eksekusi shell; akan diverifikasi pada Phase 1.

---

## 7. Kesimpulan Temuan Audit

1. **Fondasi Arsitektur Sangat Kuat:**
   Struktur Modular Monolith, isolasi domain services murni (`domains/`), pemisahan perhitungan finansial dari UI komponen, dan skema Supabase RLS sudah sepenuhnya selaras dengan standar arsitektur tingkat tinggi.
2. **Kesenjangan Fungsional Utama Terhadap PRD v1.0:**
   - Modul 1 (Excel Import & Reconciliation): Saat ini halaman `app/(app)/data/page.tsx` masih menggunakan sample mock rows dan download CSV statis. Fitur dynamic sheet parser, column mapper, preview delta versioning, dan lineage persistence belum terhubung penuh.
   - Modul 3 (Claim Readiness Gate): Perlu diselaraskan dari checklist 11 item statis menjadi checklist template berbasis kontrak dengan status Present vs Verified dan operational readiness disclaimer.
   - Modul 5 (Portfolio & ROI Ledger): Perlu membersihkan ketergantungan metrik vanity (C-Score) dari ringkasan eksekutif inti dan memisahkan secara tegas Found, Controllable, Resolved, Invoiced, dan Collected.
3. **Fitur Ekstensi Berisiko (Risk & Conflict Register):**
   Fitur yang dibangun di luar PRD MVP (Kalkulator pajak PP 9/2022, Generator somasi hukum, Kontrol mandor Pay-When-Paid, Simulator ketahanan kas 12 minggu, C-Score, Paket Lifetime 799k) **tidak boleh dihapus**, melainkan harus diisolasi dengan feature flag dan disclaimer resmi agar tidak menimbulkan liability hukum atau mengaburkan fokus MVP.
