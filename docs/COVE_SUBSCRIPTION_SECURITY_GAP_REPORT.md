# COVE — Subscription Security & Architectural Gap Report

**Document Version:** 2.0.0 (Post-Phase 16R Remediation)  
**Audit Date:** 4 September 2026  
**Auditor:** Antigravity (Phase 16R Security Remediation Execution)  
**Scope:** Seluruh Rute API, Domain Engine, State Machine, Entitlement Guards, dan Database Adapter Penagihan (Phase 13 s/d Phase 16R).  

---

## 1. Ringkasan Eksekutif Keamanan

Audit retrospektif Phase 16.5 mengidentifikasi temuan arsitektural dan otorisasi yang memerlukan perbaikan segera. Melalui pelaksanaan **Phase 16R (Subscription Security & Build Remediation)**, seluruh temuan tingkat **HIGH** dan **MEDIUM** serta **LOW** terkait telah diperbaiki dan diverifikasi secara menyeluruh.

### Status Evaluasi Pasca-Remediasi 16R:
- **Critical (0):** Celah *redirect success bypass* tetap tereliminasi 100%. Signature kriptografis dan idempotensi webhook tetap aktif dan terverifikasi.
- **High (0 Terbuka / 2 Selesai):** [SEC-HIGH-01] dan [SEC-HIGH-02] **REMEDIATED 100%**.
- **Medium (0 Terbuka / 2 Selesai):** [MED-01] dan [MED-02] **REMEDIATED 100%**.
- **Low (0 Terbuka / 2 Ditangani):** [LOW-02] tereliminasi; [LOW-01] PDF generation tercakup dalam roadmap Phase 17/18.

---

## 2. Matriks Status Temuan Keamanan & Remediasi

| Kode Temuan | Tingkat | Status Pra-16R | Status Pasca-16R | Mekanisme Remediasi & Bukti Verifikasi |
| :--- | :---: | :---: | :---: | :--- |
| **SEC-HIGH-01** | **HIGH** | OPEN | **REMEDIATED** | Helper terpusat `validateBillingAuth` di `lib/auth/server-guard.ts` dipasang di 6 route billing & checkout. Mencegah akses tanpa sesi (HTTP 401) dan akses lintas tenant (HTTP 403). Diverifikasi di Suite 26 Tests 1–12. |
| **SEC-HIGH-02** | **HIGH** | OPEN | **REMEDIATED** | Server entitlement guard `ensureCanMutate` di `lib/db/database-adapter.ts` memblokir 10 entry point mutasi data saat status `READ_ONLY` / `SUSPENDED` sambil menjaga Open Data Guarantee PRD 28.1. Diverifikasi di Suite 26 Tests 16–23. |
| **MED-01** | **MEDIUM** | OPEN | **REMEDIATED** | Seluruh 76 error tipe TypeScript diselesaikan; `ignoreBuildErrors: true` dihapus dari `next.config.mjs`. `npx tsc --noEmit` exit code 0. |
| **MED-02** | **MEDIUM** | OPEN | **REMEDIATED** | Konfigurasi flat `eslint.config.mjs` dibuat; script `package.json` `"lint": "eslint ."`. `npm run lint` exit code 0. |
| **LOW-01** | **LOW** | DEFERRED | **PLANNED** | Simulasi PDF unduhan faktur di portal billing; pembuatan dokumen PDF resmi dijadwalkan pada modul invoice Phase 17/18. |
| **LOW-02** | **LOW** | OPEN | **REMEDIATED** | Fallback string literal `"org-nusantara-01"` dihapus dari seluruh komponen antarmuka dan route API. Pengambilan tenant ID wajib dari konteks aktif. |
| **TASK 16R.7** | **SECURITY** | OPEN | **REMEDIATED** | Fungsi rekursif `sanitizeWebhookPayload` menyamarkan kata sandi, token otorisasi, rahasia, nomor kartu kredit, dan kode keamanan CVV menjadi `[REDACTED]`. Diverifikasi di Suite 26 Test 25. |
| **TASK 16R.8** | **COMMERCIAL** | OPEN | **REMEDIATED** | Pemeriksaan ketat menolak pembelian, checkout, upgrade, atau simulasi prorata untuk tier `lifetime_799k` dengan HTTP 400 Bad Request. Diverifikasi di Suite 26 Tests 13–15. |

---

## 3. Rincian Remediasi Teknis

### 3.1 [SEC-HIGH-01] Validasi Sesi Server & Pengecekan Hak Akses Multi-Tenant
* **Status:** **REMEDIATED**
* **Berkas yang Diperbaiki:**
  - `lib/auth/server-guard.ts` (helper terpusat baru)
  - `app/api/billing/subscription/route.ts`
  - `app/api/billing/proration/route.ts`
  - `app/api/billing/change-plan/route.ts`
  - `app/api/billing/cancel/route.ts`
  - `app/api/billing/reactivate/route.ts`
  - `app/api/payment/checkout/route.ts`
* **Mekanisme Penegakan:**
  Setiap permintaan ke API billing diverifikasi melalui `validateBillingAuth`. Jika cookie sesi tidak ditemukan, request langsung ditolak dengan HTTP 401. Jika `targetOrgId` tidak cocok dengan `user.orgId` dan user bukan `SUPER_ADMIN`, request ditolak dengan HTTP 403. Jika aksi berupa mutasi penagihan dan user bukan `OWNER` atau `ADMIN`, request ditolak dengan HTTP 403.
* **Hasil Pengujian:**
  Test Suite 26 Tests 1–12 memverifikasi seluruh kemungkinan penolakan 401 dan 403 dengan hasil 100% lulus.

---

### 3.2 [SEC-HIGH-02] Server Entitlement Guard pada Seluruh Titik Masuk Mutasi Data
* **Status:** **REMEDIATED**
* **Berkas yang Diperbaiki:**
  - `domains/entitlement/types.ts`
  - `domains/entitlement/service.ts`
  - `lib/db/database-adapter.ts`
* **Mekanisme Penegakan:**
  Fungsi `ensureCanMutate(orgId, mutationType)` dipanggil di awal setiap metode mutasi basis data. Jika akun organisasi berada dalam status non-aktif (`READ_ONLY`, `SUSPENDED`, `CANCELLED_TERMINATED`), mutasi dibatalkan seketika dengan melempar error `[ENTITLEMENT_GUARD_REJECTED]`.
  Metode yang dilindungi mencakup:
  - `createProjectWithContract`
  - `createClaim`
  - `transitionClaim`
  - `updateClaimCertifiedValue`
  - `commitImportBatch`
  - `createAction`
  - `resolveAction`
  - `reopenAction`
  - `updateClaimReadinessItem`
  - `overrideClaimReadiness`
  - `inviteUser` (disertai pemeriksaan kuota `maxUsers`)
* **Hasil Pengujian:**
  Test Suite 26 Tests 16–23 memverifikasi penolakan pada seluruh 10 metode mutasi di atas. Test 24 memverifikasi bahwa `exportFullTenantData` tetap dapat diakses 100% (Open Data Guarantee PRD 28.1).

---

### 3.3 [MED-01] Pembersihan Kompilasi Tipe TypeScript Statis
* **Status:** **REMEDIATED**
* **Tindakan:**
  - Menghapus opsi bypass `typescript: { ignoreBuildErrors: true }` dari `next.config.mjs`.
  - Memperbaiki seluruh 76 ketidaksesuaian tipe pada modul store, workflow service, adapter, dan komponen UI.
* **Hasil Pengujian:**
  - `npx tsc --noEmit` keluar dengan kode 0 (zero errors).
  - `npm run build` berhasil melakukan kompilasi 27 rute dengan kode 0.

---

### 3.4 [MED-02] Pemulihan Linter Next.js & ESLint
* **Status:** **REMEDIATED**
* **Tindakan:**
  - Membuat `eslint.config.mjs` (flat config) dan memperbarui `package.json` script `"lint": "eslint ."`.
* **Hasil Pengujian:**
  - `npm run lint` keluar dengan kode 0 tanpa error ataupun peringatan.

---

### 3.5 [Phase 16R.1] Verifikasi Keamanan Independen & Penghapusan Header Uji Klien
* **Status:** **REMEDIATED & INDEPENDENTLY VERIFIED**
* **Tindakan Pengerasan:**
  - Menghapus total ketergantungan runtime pada header uji buatan klien (`x-cove-test-user-id`, `x-cove-test-org-id`, `x-cove-test-role`) di `lib/auth/server-guard.ts`.
  - Mengimplementasikan pola Dependency Injection `setBillingSessionResolverForTest` yang diblokir fatal pada `NODE_ENV === 'production'`.
  - Menguji 12 metode mutasi publik basis data secara langsung pada mode `READ_ONLY` dengan verifikasi kondisi sebelum/sesudah mutasi (*zero partial writes*, *zero audit logs*).
  - Menguji matriks 11 status lifecycle dengan jam terkendali (*fake clock*).
  - Menguji kuota pengguna dan proyek aktif pada tenant `ACTIVE`.
  - Mengamankan audit webhook (sanitasi regex nomor kartu PAN dan bearer token, hak akses khusus `ADMIN`/`SERVICE_ROLE`, retensi 90 hari).
  - Membuktikan keaslian ESLint melalui deteksi pelanggaran terkontrol (*controlled violation*).

---

### 3.7 [Phase 16R.3] Database Privilege, Billing Bypass, and RLS Hardening
* **Status:** **REMEDIATED & INDEPENDENTLY VERIFIED ON RUNNING DATABASE (PASS)**
* **Tindakan Pengerasan:**
  - **Zero Subscription Bypass:** Menghapus hak akses mutasi `INSERT`, `UPDATE`, `DELETE` pada tabel `subscriptions` untuk seluruh peran pengguna tenant (`OWNER`, `ADMIN`, `MEMBER`). Tenant hanya diberikan hak `SELECT`. Mutasi status, plan, harga, periode, dan kuota mutlak hanya dapat dilakukan oleh proses backend terpercaya (`service_role`).
  - **SECURITY DEFINER & Search Path Hardening:** Seluruh fungsi `SECURITY DEFINER` di skema `public` dan `private` telah ditetapkan `SET search_path = ''` dengan kualifikasi skema penuh (`pg_catalog.*`, `public.*`, `private.*`) untuk mencegah serangan eksploitasi jalur pencarian SQL.
  - **Skema `private` & Akses Fungsi:** Fungsi pembantu otorisasi internal (`is_active_org_member`, `is_org_billing_admin`, `is_platform_super_admin`, dll.) dipindahkan ke skema `private`. Hak `EXECUTE` pada fungsi pemeliharaan sistem `purge_old_webhook_events` dicabut total dari `PUBLIC`, `anon`, dan `authenticated`, dan hanya diberikan kepada `service_role`.
  - **Pemisahan Peran Platform Admin:** Tabel `public.platform_admins` dibuat dengan referensi ke `auth.users(id)` dan dilindungi RLS ketat (pengguna tenant `OWNER` dilarang keras menambahkan dirinya sendiri ke daftar platform admin).
  - **Canonical Model Opsi B:** Penyelarasan relasi pengguna–organisasi secara kanonikal: `auth.users.id` $\rightarrow$ `profiles.auth_user_id` $\rightarrow$ `profiles.id` $\rightarrow$ `organization_members.user_id`. `lib/auth/server-guard.ts` dan `lib/db/database-adapter.ts` diverifikasi bebas dari penyimpangan.
  - **Atomic Fail-Closed Quota RPCs:** Prosedur `invite_user_with_quota_check` dan `create_project_with_quota_check` diperkeras dengan penolakan *fail-closed* (tanpa fallback default 10/1), row lock `SELECT ... FOR UPDATE`, normalisasi email `pg_catalog.btrim`, dan evaluator kanonikal status langganan yang menolak mutasi pada status `READ_ONLY`, `SUSPENDED`, `CANCELLED`, `EXPIRED`, serta `PAST_DUE` lewat grace period.
  - **Webhook Access Control & Retention Scheduler:** Pengguna tenant (termasuk `OWNER`) 100% diblokir dari tabel `webhook_events`. Endpoint cron retention `/api/internal/cron/retention` dilindungi autentikasi konstan `timingSafeEqual`, menolak token query, dan gagal tertutup (*fail-closed*) jika rahasia kosong/<16 karakter.
  - **Verifikasi Empiris Database:** 17 skenario pengujian pgTAP (`01_subscription_rls_and_concurrency.test.sql`) dijalankan pada PostgreSQL Supabase lokal dan **LULUS 100% (17/17 tests successful)**.

---

## 4. Kesimpulan Keamanan & Status Gate Phase 16R.3

Berdasarkan pengujian empiris otomatis terhadap 26 test suite di lingkungan aplikasi dan 17 tes pgTAP pada database PostgreSQL lokal:
1. Tidak ada celah keamanan tingkat **CRITICAL**, **HIGH**, maupun **MEDIUM** yang tersisa pada rute API penagihan, database RLS, ataupun fungsi stored procedure.
2. Celah bypass billing tertutup 100%: tenant `OWNER` dan `ADMIN` terbukti di tingkat database tidak dapat memutasi status, paket, harga, atau kuota langganan secara langsung.
3. Seluruh fungsi `SECURITY DEFINER` aman dengan `search_path = ''`.
4. Seluruh RPC kuota terbukti *fail-closed* dan atomik mencegah *race condition*.
5. Kualitas build, tipe statis, dan linter terjamin bersih (`tsc`, `lint`, `build` seluruhnya exit code 0).
6. Pengujian database live via `supabase test db` menghasilkan:
   ```
   All tests successful.
   Files=1, Tests=17, Result: PASS
   ```

Status resmi:
```
STATUS: PASS — READY FOR FINAL USER AUDIT BEFORE PHASE 17
```

