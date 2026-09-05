# COVE — Phase 17 Implementation Evidence & Verification Report
## Renewal, Dunning & Billing Recovery Engine

**Document Version:** 1.0.0  
**Verification Date:** 4 September 2026  
**Author:** Antigravity (Phase 17 Execution)  
**Governance Standard:** Master Recovery Gate, PRD Section 28 (Open Data Guarantee) & Phase 17 Directives  
**Status:** **PHASE 17 COMPLETE — ALL 22 REQUIREMENTS VERIFIED**  

---

## 1. Executive Summary

Phase 17 berhasil mengimplementasikan mesin siklus hidup langganan (*subscription lifecycle*), otomasi penagihan jatuh tempo (*dunning engine*), serta pemulihan billing otomatis (*billing recovery*) berbasis peristiwa pembayaran terverifikasi.

Seluruh 22 skenario pengujian unit, integrasi, dan basis data (pgTAP 42/42 skenario) lulus 100% tanpa regresi terhadap 26 test suite warisan sebelumnya.

---

## 2. Fitur Phase 17 yang Dibangun

1. **Preflight Non-Blocking & Database Security Hardening:**
   - Verifikasi constraint `UNIQUE` pada `profiles.auth_user_id` (`profiles_auth_user_id_key`).
   - Pengetatan direct `SELECT subscriptions` hanya untuk peran billing reader (`OWNER`, `ADMIN`, `COMMERCIAL_MANAGER`, `FINANCE_MANAGER`, `FINANCE`) dan platform admin.
   - Penghapusan tuntas fungsi publik usang di skema `public` (`public.is_active_org_member`, `public.is_org_billing_admin`, `public.is_platform_super_admin`). Seluruh otorisasi internal kini bertumpu di skema `private`.
2. **Mesin Penjadwalan Dunning Deterministik (`domains/subscription/dunning-engine.ts`):**
   - Perhitungan jadwal dunning relatif terhadap `billing_due_at` (H-7, H-1, Hari H, H+1, H+3, H+7, H+21).
   - Timestamp tersimpan dalam format UTC ISO-8601; tampilan waktu diformat ke `Asia/Jakarta` (WIB).
   - Dukungan *fake clock* (`asOfDate`) untuk evaluasi berbasis waktu historis atau akselerasi uji.
   - Pengecualian mutlak paket warisan `lifetime_799k` dari proses dunning dan renewal.
3. **Mesin Faktur Perpanjangan Berkala (`domains/subscription/renewal-service.ts`):**
   - Harga faktur renewal diambil mutlak dari versi harga yang terkunci pada subscription (`subscription.price_id`), bukan dari payload peramban.
   - Penomoran faktur unik `INV-COVE-YYYY-MM-XXXX` terpisah dari faktur klaim konstruksi.
   - Jaminan satu faktur renewal aktif per periode langganan (idempotent replay).
4. **Provider Capability Detection & Payment Link Generation (`domains/billing/provider-adapter.ts`):**
   - Deteksi 5 kapabilitas gateway: `supportsRecurringCharge`, `supportsSavedPaymentMethod`, `supportsAutomaticRetry`, `supportsHostedCheckout`, `supportsPaymentLink`.
   - Gateway tanpa kapabilitas recurring (seperti Mayar) secara otomatis menghasilkan checkout session / payment link baru.
   - Gateway dengan kapabilitas recurring (seperti Xendit) tidak melakukan charge tanpa consent eksplisit.
5. **Generator Notifikasi Multi-Kanal Humanis (`domains/billing/notification-service.ts`):**
   - Template notifikasi untuk in-app, email, dan WhatsApp link.
   - Memuat nama organisasi, paket, nilai tagihan (IDR), jatuh tempo (WIB), link bayar resmi, dan kontak bantuan.
   - Menegakkan larangan intimidasi atau ancaman palsu; secara eksplisit menjamin data proyek tidak akan pernah dihapus.
6. **Pemulihan Langganan Otomatis via Webhook (`domains/billing/webhook-service.ts`):**
   - Pembayaran terverifikasi saat status `PAST_DUE`, `READ_ONLY`, atau `SUSPENDED` memulihkan status akun seketika ke `ACTIVE`.
   - Memperpanjang periode langganan, membersihkan `grace_period_end`, dan mencatat riwayat transisi status.
7. **Endpoint Cron Internal yang Aman (`app/api/internal/cron/dunning`, `/renewal`):**
   - Proteksi otentikasi Bearer token `CRON_SECRET` waktu konstan (`crypto.timingSafeEqual`).
   - Penolakan parameter kredensial pada URL query string (HTTP 400).
   - Pembatasan batch dan mitigasi race condition.
8. **Banner Notifikasi Antarmuka Pengguna (`components/subscription/SubscriptionAlertBanner.tsx`):**
   - Menampilkan countdown sisa hari masa tenggang pada `PAST_DUE`.
   - Menginfokan pembekuan mutasi pada `READ_ONLY` dengan jaminan pembacaan dan ekspor data tetap aktif.
   - Menyediakan tombol pemulihan dan tombol "Ekspor Data Tenant" (Open Data Guarantee PRD 28.1).

---

## 3. Matriks Transisi Status Resmi

| Status Asal | Status Tujuan | Pemicu (Trigger) | Konsekuensi Fungsional |
| :--- | :--- | :--- | :--- |
| `ACTIVE` | `PAST_DUE` | Hari H jatuh tempo (cron) | Masa tenggang 7 hari aktif, seluruh fitur tetap berjalan normal |
| `PAST_DUE` | `READ_ONLY` | H+7 grace period habis (cron) | Mutasi dibekukan (`canMutate: false`), baca/billing/ekspor tetap aktif |
| `READ_ONLY` | `SUSPENDED` | H+21 tanpa pembayaran (cron) | Akses operasional dibatasi, portal billing & ekspor data tetap aktif |
| `PAST_DUE` | `ACTIVE` | Webhook pembayaran lunas | Status dipulihkan, masa tenggang dihapus, mutasi normal |
| `READ_ONLY` | `ACTIVE` | Webhook pembayaran lunas | Status dipulihkan, mutasi dibuka kembali penuh |
| `SUSPENDED` | `ACTIVE` | Webhook pembayaran lunas | Status dipulihkan seketika ke aktif |
| `ACTIVE` | `CANCEL_AT_PERIOD_END` | Permintaan pembatalan user | Fitur tetap aktif hingga akhir periode |
| `CANCEL_AT_PERIOD_END` | `CANCELLED` | Akhir periode tercapai | Akun ditutup, ekspor data tetap dapat diakses |
| `CANCEL_AT_PERIOD_END` | `ACTIVE` | Reaktivasi sebelum periode habis | Pembatalan dicabut, langganan aktif normal kembali |

---

## 4. Matriks Jadwal Dunning Resmi (Titik Acuan: `billing_due_at`)

| Waktu | Tahap (Stage) | Target Status | Tindakan & Notifikasi |
| :--- | :--- | :---: | :--- |
| H-7 | `H_MINUS_7` | `ACTIVE` | Notifikasi pengingat perpanjangan awal (in-app, email) |
| H-1 | `H_MINUS_1` | `ACTIVE` | Notifikasi pengingat tagihan jatuh tempo besok |
| Hari H | `DUE_DATE` | `PAST_DUE` | Transisi status ke `PAST_DUE`, inisiasi masa tenggang 7 hari |
| H+1 | `H_PLUS_1` | `PAST_DUE` | Notifikasi pengingat pertama masa tenggang |
| H+3 | `H_PLUS_3` | `PAST_DUE` | Notifikasi eskalasi sisa 4 hari masa tenggang |
| H+7 | `H_PLUS_7` | `READ_ONLY` | Transisi status ke `READ_ONLY`, mutasi data dibekukan |
| H+21 | `H_PLUS_21` | `SUSPENDED` | Transisi status ke `SUSPENDED`, penangguhan operasional |

---

## 5. Matriks Kapabilitas Payment Provider

| Provider Adapter | `supportsRecurringCharge` | `supportsSavedPaymentMethod` | `supportsAutomaticRetry` | `supportsHostedCheckout` | `supportsPaymentLink` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **XenditAdapter** | ✅ TRUE | ✅ TRUE | ✅ TRUE | ✅ TRUE | ✅ TRUE |
| **MayarAdapter** | ❌ FALSE | ❌ FALSE | ❌ FALSE | ✅ TRUE | ✅ TRUE |
| **MockPaymentAdapter** | ❌ FALSE | ❌ FALSE | ❌ FALSE | ✅ TRUE | ✅ TRUE |

---

## 6. Skema Database & Migrasi 00009

Migrasi `00009_phase17_dunning_and_recovery.sql` menambahkan:
- Constraint `profiles_auth_user_id_key` (`UNIQUE` on `profiles.auth_user_id`).
- Kebijakan RLS `rls_subscriptions_select` yang dibatasi pada role billing reader (`is_org_billing_reader`).
- Penghapusan fungsi publik usang (`public.is_active_org_member`, `is_org_billing_admin`, `is_platform_super_admin`).
- 5 Tabel Dunning Baru:
  1. `public.dunning_cycles` (id, org_id, subscription_id, billing_invoice_id, status, stage, scheduled_at, processed_at, attempt_count, idempotency_key UNIQUE, ...)
  2. `public.dunning_events` (id, org_id, subscription_id, billing_invoice_id, dunning_cycle_id, stage, action_type, status, scheduled_at, processed_at, attempt_count, idempotency_key UNIQUE, metadata, ...)
  3. `public.billing_notifications` (id, org_id, subscription_id, billing_invoice_id, stage, channel, recipient, subject, body_text, action_url, status, scheduled_at, idempotency_key UNIQUE, ...)
  4. `public.renewal_jobs` (id, org_id, subscription_id, billing_invoice_id, stage, status, scheduled_at, processed_at, idempotency_key UNIQUE, ...)
  5. `public.payment_retry_attempts` (id, org_id, subscription_id, billing_invoice_id, stage, status, scheduled_at, processed_at, attempt_count, idempotency_key UNIQUE, ...)
- Kebijakan RLS penuh pada seluruh 5 tabel (SELECT untuk billing reader/super admin, mutasi hanya untuk `service_role`).
- Prosedur atomik `private.process_dunning_stage_transition` dengan row lock `FOR UPDATE`.

---

## 7. Bukti Idempotency & Concurrency

- **Idempotency Key Format:** `dunning_${subscriptionId}_${invoiceId}_${stage}_${scheduledAtIsoDate}`
- **Uji Coba Replay Cron:** Percobaan sweep ganda pada waktu yang sama menghasilkan skip idempotent.
- **Uji Coba Replay Webhook:** Webhook `PAYMENT_SUCCEEDED` yang dikirim dua kali dengan ID event yang sama ditandai sebagai `idempotentReplay: true` tanpa mutasi status berulang.
- **Uji Coba Paralel Cron:** Dua eksekusi cron simultan dengan kunci job yang sama diserialisasi; tepat 1 yang dieksekusi.

---

## 8. Hasil Perintah Verifikasi Wajib

| Perintah | Deskripsi | Exit Code | Hasil Empiris |
| :--- | :--- | :---: | :--- |
| `npx supabase db reset` | Reset & migrasi database lokal | `0` | **9 Migrasi Diaplikasikan Bersih** (termasuk 00009) |
| `npx supabase test db` | Test Suite pgTAP PostgreSQL | `0` | **42/42 Skenario Lulus (Result: PASS)** |
| `node tests/runner.js` | Master Test Runner (27 Suites) | `0` | **27 Passed, 0 Failed (100% PASS)** |
| `npx tsc --noEmit` | Pemeriksaan Tipe TypeScript | `0` | **Zero Type Errors** |
| `npm run lint` | Linter ESLint Flat Config | `0` | **0 Errors, 486 Warnings (Baseline Terpelihara)** |
| `npm run build` | Next.js Production Build | `0` | **30/30 Rute Terkompilasi Bersih** |

---

## 9. Status Tata Kelola & Gerbang Phase 18

Phase 18, deployment produksi, integrasi gateway live, dan transaksi live **TIDAK** dimulai.

```
STATUS: PASS — READY FOR USER AUDIT BEFORE PHASE 18
```
