# COVE — Phase 16 Implementation Evidence: Customer Billing Portal & Workflows

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Auditor:** Antigravity (Phase 16.5: Retrospective Subscription Audit & Recovery Gate)  
**Reference Specification:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 3.11, 8.2, 12.1, 12.2, 13.1) & PRD Section 28.1  
**Core Components:** `domains/subscription/proration.ts`, `domains/subscription/downgrade.ts`, `domains/subscription/workflow-service.ts`, `app/api/billing/*`, `app/(app)/billing/page.tsx`  

---

## 1. Matriks Audit Fitur & Halaman Customer Billing Portal

| Fitur / Halaman | Route / Component | Data Model | Server Auth / Guard | Error State | Empty State | Mobile Responsive | Test Pemetaan | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Subscription Overview** | `app/(app)/billing/page.tsx` | Aktual (Store) | Client context | Banner error | Skeleton loader | Flex-col / Grid | Suite 25 Test 2 | **COMPLETE** |
| **Current Plan & Status** | `app/(app)/billing/page.tsx` | Aktual (Store) | Client context | Fallback badge | Default core plan | Responsive card | Suite 25 Test 2 | **COMPLETE** |
| **Project Usage Bar** | `app/(app)/billing/page.tsx` | Aktual (Store) | Client context | Clamped 100% | 0/N projects | Full width bar | Suite 25 Test 2 | **COMPLETE** |
| **User Usage Bar** | `app/(app)/billing/page.tsx` | Aktual (Store) | Client context | Clamped 100% | 1/N seats | Full width bar | Suite 25 Test 2 | **COMPLETE** |
| **Billing Invoices Table** | `app/(app)/billing/page.tsx` | Aktual (Store) | Client context | Error toast | "Belum ada faktur" | Horizontal scroll | Suite 25 Test 2 | **COMPLETE** |
| **Invoice / Receipt PDF** | `app/(app)/billing/page.tsx` | Simulated PDF | Client-side action | Alert modal | N/A | Modal alert | Suite 25 Test 2 | **PARTIAL (Simulated)** |
| **Upgrade Plan** | `POST /api/billing/change-plan` | Aktual (Store) | Query/Body orgId *(GAP)* | HTTP 400 error | Validation modal | Modal dialog | Suite 25 Test 3 | **NEEDS_AUTH_GUARD** |
| **Proration Calculator** | `POST /api/billing/proration` | Aktual (Math) | Query/Body orgId *(GAP)* | HTTP 400 error | Live calculation | Modal breakdown | Suite 25 Test 1 | **NEEDS_AUTH_GUARD** |
| **Downgrade Impact Preview** | `POST /api/billing/proration` | Aktual (Store) | Query/Body orgId *(GAP)* | HTTP 400 error | Quota alert badge | Responsive alert | Suite 25 Test 4 | **NEEDS_AUTH_GUARD** |
| **Downgrade Project Selection**| `domains/subscription/downgrade.ts` | Aktual (Store) | Query/Body orgId *(GAP)* | Checkbox limit | Proyek tercentang | Checklist items | Suite 25 Test 4 | **COMPLETE** |
| **Cancel at Period End** | `POST /api/billing/cancel` | Aktual (Store) | Query/Body orgId *(GAP)* | Wajib isi alasan | Exit survey options | Modal dialog | Suite 25 Test 5 | **NEEDS_AUTH_GUARD** |
| **Reversible Reactivation** | `POST /api/billing/reactivate` | Aktual (Store) | Query/Body orgId *(GAP)* | HTTP 400 error | 1-Click action | Banner CTA | Suite 25 Test 5 | **NEEDS_AUTH_GUARD** |
| **Open Data Guarantee Export**| `app/(app)/billing/page.tsx` | Aktual (JSON) | Client context | Download error | JSON structure | Direct download | Suite 25 Test 6 | **COMPLETE** |
| **Navigation Sidebar** | `components/layout/Sidebar.tsx` | Static link | TenantProvider | N/A | N/A | Mobile drawer | Visual check | **COMPLETE** |

---

## 2. Pemeriksaan Logika & Ketahanan Alur Kerja

### 2.1 Proration Engine Matematis Presisi Harian
- **File:** `domains/subscription/proration.ts`
- **Rumus:**
  $$\text{cycleDays} = \frac{\text{periodEnd} - \text{periodStart}}{86.400.000}, \quad \text{remainingDays} = \frac{\text{periodEnd} - \text{now}}{86.400.000}$$
  $$\text{unusedCredit} = \left(\frac{\text{currentPrice}}{\text{cycleDays}}\right) \times \text{remainingDays}$$
  $$\text{proratedTargetCost} = \left(\frac{\text{targetPrice}}{\text{cycleDays}}\right) \times \text{remainingDays}$$
  $$\text{netPayable} = \max(0, \text{proratedTargetCost} - \text{unusedCredit})$$
- **Pengujian:** Suite 25 Test 1 memverifikasi upgrade di tengah bulan (hari ke-15 dari siklus 30 hari). Kredit sisa Rp 1.250.000 dikurangkan secara tepat dari biaya prorata baru Rp 2.500.000, menghasilkan tagihan bersih tepat Rp 1.250.000.

### 2.2 Downgrade Handling & Non-Destructive Archival
- **File:** `domains/subscription/downgrade.ts` & `lib/db/database-adapter.ts`
- **Aturan Bisnis:** Saat pelanggan menurunkan paket (misalnya dari Scale 5 proyek ke Core 1 proyek), sistem tidak menghapus proyek secara acak. Pelanggan wajib memilih proyek yang tetap aktif melalui antarmuka modal. Proyek di luar pilihan diarsipkan melalui `archiveProjectsExcept` dengan status `status = "archived"`.
- **Pengujian:** Suite 25 Test 4 membuktikan bahwa proyek non-terpilih beralih status menjadi `archived` dan seluruh data kontrak serta invoice di dalamnya tetap utuh 100%.

### 2.3 Cancel at Period End (Tanpa Pemutusan Akses Mendadak)
- **File:** `lib/db/database-adapter.ts` (`cancelSubscriptionAtPeriodEnd`)
- **Aturan Bisnis:** Pembatalan menetapkan `cancelAtPeriodEnd = true` dan status `CANCEL_AT_PERIOD_END`. Akses mutasi data proyek dan klaim tetap terbuka penuh sampai `currentPeriodEnd` tercapai.
- **Pengujian:** Suite 25 Test 5 membuktikan bahwa mutasi tetap diizinkan dan reaktivasi instan sebelum akhir periode berhasil memulihkan status `ACTIVE` tanpa kehilangan konfigurasi.

### 2.4 Open Data Guarantee Lintas Seluruh Status (PRD 28.1)
- **Pengujian:** Suite 25 Test 6 memverifikasi hak ekspor cadangan data organisasi (`canExport = true`) pada 4 status kritis: `ACTIVE`, `CANCEL_AT_PERIOD_END`, `PAST_DUE`, dan `FROZEN/SUSPENDED`. Tidak ada kondisi di mana data kontraktor disandera atau dihapus secara sepihak.

---

## 3. Analisis Kesenjangan Keamanan (Temuan Audit)

Meskipun logika bisnis, alur kerja, dan pengujian Suite 25 telah lulus 100%, audit retrospektif mendeteksi kelemahan arsitektur pada lapisan otorisasi server rute API billing (`app/api/billing/*`):

### Temuan HIGH-1: Ketiadaan Autentikasi Sesi Server & Pengecekan Hak Akses Multi-Tenant
- **Rute Terindikasi:**
  - `GET /api/billing/subscription`
  - `POST /api/billing/proration`
  - `POST /api/billing/change-plan`
  - `POST /api/billing/cancel`
  - `POST /api/billing/reactivate`
- **Mekanisme Aktual:** Seluruh rute di atas menerima `orgId` dari query string atau request body (contoh: `const orgId = searchParams.get("orgId") || "org-nusantara-01"`).
- **Celah:** Rute tidak memvalidasi session Supabase Auth pengguna pemanggil, tidak memeriksa apakah pengguna tersebut terdaftar pada organisasi tersebut, dan tidak memeriksa apakah perannya adalah `OWNER` atau `ADMIN`.
- **Dampak:** Pengguna dari Organisasi A yang mengetahui ID Organisasi B secara teoritis dapat mengirim permintaan HTTP untuk melihat data tagihan atau membatalkan langganan Organisasi B.
- **Rekomendasi Remediasi:** Bungkus seluruh endpoint billing dengan helper `requireOrgBillingAdmin(req)` yang memverifikasi session cookie, mencocokkan `user.orgId === orgId`, dan memvalidasi wewenang `OWNER` / `ADMIN`.
