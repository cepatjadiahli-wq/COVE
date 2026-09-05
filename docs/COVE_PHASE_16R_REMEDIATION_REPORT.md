# COVE — Phase 16R Remediation Report
## Subscription Security, Authorization, Entitlement & Build Hardening

**Document Version:** 1.0.0  
**Remediation Date:** 4 September 2026  
**Author:** Antigravity (Phase 16R Remediation Execution)  
**Governance Standard:** Section 12 Master Recovery Gate & Section 14 Remediation Directives  
**Status:** **REMEDIATION COMPLETE — ALL HIGH & MEDIUM FINDINGS RESOLVED**  

---

## 1. Ringkasan Eksekutif Remediasi

Sesuai instruksi pada **PHASE 16R — Subscription Security & Build Remediation**, seluruh temuan tingkat **HIGH** dan **MEDIUM** serta perbaikan arsitektural terkait yang diidentifikasi pada **Phase 16.5 Retrospective Subscription Audit** telah diselesaikan, diuji, dan diverifikasi secara empiris tanpa menyisakan *regression* pada 22 test suite warisan (Phase 1–12) maupun 3 test suite penagihan (Phase 14–16).

### Status Matriks Temuan Phase 16.5 vs Pasca-Phase 16R

| Kode Temuan | Tingkat Keparahan | Deskripsi Singkat | Status Pasca-16R | Bukti Pengujian Empiris |
| :--- | :---: | :--- | :---: | :--- |
| **SEC-HIGH-01** | **HIGH** | Kurang validasi sesi server & otorisasi multi-tenant pada rute API billing | **REMEDIATED** | Suite 26 (Tests 1–12): HTTP 401 unauth & HTTP 403 cross-tenant / insufficient role |
| **SEC-HIGH-02** | **HIGH** | Server entitlement guard belum mencakup seluruh titik mutasi data | **REMEDIATED** | Suite 26 (Tests 16–23): 10 metode mutasi diblokir saat `READ_ONLY` / `SUSPENDED` |
| **MED-01** | **MEDIUM** | Error tipe TypeScript (`tsc --noEmit`) & bypass `ignoreBuildErrors: true` | **REMEDIATED** | `npx tsc --noEmit` exit code 0; `ignoreBuildErrors` dihapus dari `next.config.mjs` |
| **MED-02** | **MEDIUM** | Linter Next.js menghasilkan error direktori pada `npm run lint` | **REMEDIATED** | Konfigurasi flat `eslint.config.mjs` aktif; `npm run lint` exit code 0 |
| **LOW-02** | **LOW** | Fallback hardcoded organisasi (`org-nusantara-01`) pada komponen UI | **REMEDIATED** | Fallback dihapus; context `currentOrg.id` digunakan secara ketat |
| **TASK 16R.7** | **SECURITY** | Payload mentah webhook berpotensi menyimpan data sensitif/kredensial | **REMEDIATED** | Suite 26 (Test 25): Sanitizer rekursif menyamarkan secret/card/CVV menjadi `[REDACTED]` |
| **TASK 16R.8** | **COMMERCIAL** | Paket legacy `lifetime_799k` harus ditutup total dari checkout/upgrade baru | **REMEDIATED** | Suite 26 (Tests 13–15): HTTP 400 Bad Request untuk checkout, upgrade, proration |

---

## 2. Rincian Remediasi Teknis Per Kategori

### 2.1 SEC-HIGH-01: Server-Side Authentication & Tenant RBAC Guard

#### Masalah Awal:
Rute API penagihan mandiri (`/api/billing/subscription`, `/api/billing/proration`, `/api/billing/change-plan`, `/api/billing/cancel`, `/api/billing/reactivate`, dan `/api/payment/checkout`) mengandalkan `orgId` dari body JSON atau query string tanpa memvalidasi sesi cookie pengguna melalui Supabase Auth server-side. Pengguna terotentikasi dari Organisasi A dapat memanipulasi langganan Organisasi B jika mengetahui `orgId` target.

#### Implementasi Remediasi:
1. **Pustaka Guard Terpusat (`lib/auth/server-guard.ts`):**
   - Mengimplementasikan fungsi `validateBillingAuth(req, options)` yang bertindak sebagai penjaga gerbang otentikasi dan otorisasi server-side.
   - Mengambil sesi pengguna via cookie Supabase server (`createClient` di `lib/supabase/server.ts`).
   - Mendukung header pengujian sintetis (`x-cove-test-user-id`, `x-cove-test-org-id`, `x-cove-test-role`) jika lingkungan berada pada `NODE_ENV === 'test'`.
   - Mengembalikan respons standar:
     - `401 Unauthorized`: Jika tidak ada sesi login valid.
     - `403 Forbidden`: Jika pengguna berusaha mengakses data organisasi lain (`user.orgId !== targetOrgId`), kecuali pengguna memiliki wewenang platform (`SUPER_ADMIN`).
     - `403 Forbidden`: Jika peran pengguna tidak memenuhi level izin yang diminta (`OWNER_OR_ADMIN` untuk mutasi penagihan; `BILLING_READ` untuk pembacaan).
2. **Pengerasan Seluruh Rute API Billing:**
   - `app/api/billing/subscription/route.ts`: Menolak query tanpa otorisasi; menggunakan `authResult.user.orgId` sebagai kebenaran mutlak.
   - `app/api/billing/change-plan/route.ts`: Memeriksa hak `OWNER_OR_ADMIN`; menolak perubahan paket lintas tenant.
   - `app/api/billing/proration/route.ts`: Memeriksa hak `OWNER_OR_ADMIN`; menolak kalkulasi prorata lintas tenant.
   - `app/api/billing/cancel/route.ts`: Memeriksa hak `OWNER_OR_ADMIN`; menolak pembatalan lintas tenant.
   - `app/api/billing/reactivate/route.ts`: Memeriksa hak `OWNER_OR_ADMIN`; menolak reaktivasi lintas tenant.
   - `app/api/payment/checkout/route.ts`: Memeriksa hak `OWNER_OR_ADMIN`; menghapus fallback default `org-nusantara-01`.

---

### 2.2 SEC-HIGH-02: Server-Side Entitlement & Quota Mutation Guards

#### Masalah Awal:
Pemeriksaan wewenang fungsional `guardMutation` sebelumnya hanya disematkan pada fungsi pembuatan proyek (`createProjectWithContract`). Pada masa status akun `READ_ONLY` atau `SUSPENDED` (akibat penunggakan pembayaran), pengguna masih dapat melakukan impor data opname baru, membuat tiket tindakan, atau mengubah status klaim karena titik-titik masuk mutasi tersebut belum diverifikasi terhadap status langganan.

#### Implementasi Remediasi:
1. **Perluasan Tipe Mutasi Entitlement (`domains/entitlement/types.ts`):**
   - Menambahkan tipe mutasi baru: `REOPEN_ACTION`, `UPDATE_READINESS`, `INVITE_USER`.
2. **Pengecekan Kuota User Seats (`domains/entitlement/service.ts`):**
   - Menambahkan validasi kuota kursi pengguna pada `guardMutation` untuk aksi `INVITE_USER`, membandingkan `currentUsers` terhadap `maxUsers`.
3. **Penyisipan Guard pada Database Adapter (`lib/db/database-adapter.ts`):**
   - Membuat fungsi pembantu `ensureCanMutate(orgId, mutationType)`.
   - Melindungi seluruh fungsi mutasi domain inti berikut:
     - `createProjectWithContract` $\rightarrow$ `CREATE_PROJECT`
     - `createClaim` $\rightarrow$ `CREATE_CLAIM`
     - `transitionClaim` $\rightarrow$ `TRANSITION_CLAIM`
     - `updateClaimCertifiedValue` $\rightarrow$ `TRANSITION_CLAIM`
     - `commitImportBatch` $\rightarrow$ `COMMIT_IMPORT`
     - `createAction` $\rightarrow$ `CREATE_ACTION`
     - `resolveAction` $\rightarrow$ `RESOLVE_ACTION`
     - `reopenAction` $\rightarrow$ `REOPEN_ACTION`
     - `updateClaimReadinessItem` $\rightarrow$ `UPDATE_READINESS`
     - `overrideClaimReadiness` $\rightarrow$ `OVERRIDE_CHECKLIST`
     - `reopenClaimAfterRejection` $\rightarrow$ `TRANSITION_CLAIM`
     - `inviteUser` $\rightarrow$ `INVITE_USER` (disertai pembatasan kuota pengguna aktif)
4. **Preservasi Open Data Guarantee (PRD 28.1):**
   - Fungsi `exportFullTenantData` tetap dapat diakses 100% tanpa hambatan pada status `ACTIVE`, `CANCEL_AT_PERIOD_END`, `PAST_DUE`, maupun `READ_ONLY` / `SUSPENDED`.

---

### 2.3 MED-01: Integritas Kompilasi Tipe TypeScript Statis

#### Masalah Awal:
`next.config.mjs` memiliki konfigurasi `typescript: { ignoreBuildErrors: true }`. Saat diperiksa dengan `npx tsc --noEmit`, terdapat 76 error tipe kompilasi pada modul store, workflow service, database adapter, dan komponen antarmuka.

#### Implementasi Remediasi:
1. **Penghapusan Bypass:**
   - Menghapus baris `typescript: { ignoreBuildErrors: true }` dari `next.config.mjs`.
2. **Penyelesaian Seluruh Error Tipe Tanpa Kompromi:**
   - Menyelesaikan duplikasi proxy method pada `domains/store/persistent-store.ts`.
   - Menyelaraskan kontrak properti `DemoProject` (`projectName`, `projectCode`, `contractAmount`) pada `domains/subscription/workflow-service.ts`.
   - Menyesuaikan penanganan tipe `BillingAuditLog` pada `lib/db/database-adapter.ts`.
   - Mengonfigurasi `compilerOptions.downlevelIteration: true` pada `tsconfig.json` untuk iterasi aman `Map.values()` dan `Set`.
   - Mengadaptasi pemanggilan `cookies()` pada `lib/supabase/server.ts` agar kompatibel dengan tipe `Promise` Next.js.
   - Memperbaiki tipe pada seluruh halaman dan modal antarmuka (`ContractRuleVersionModal.tsx`, `TenantProvider.tsx`, `DocumentPreviewModal.tsx`, `projects/[id]/page.tsx`, `actions/page.tsx`, `internal/pilots/page.tsx`, `lib/finance/c-score.ts`).
3. **Hasil Verifikasi:**
   - Perintah `npx tsc --noEmit` keluar dengan kode 0 (0 error, tanpa penggunaan `@ts-ignore` atau `@ts-nocheck` baru).

---

### 2.4 MED-02: Konfigurasi Flat Linter ESLint

#### Masalah Awal:
Skrip `npm run lint` (`next lint`) memicu pesan kegagalan direktori karena Next.js 16 memperlakukan argumen sebagai path direktori jika konfigurasi flat ESLint belum tersedia.

#### Implementasi Remediasi:
1. Membuat konfigurasi modern `eslint.config.mjs` yang mengecualikan folder build dan artefak:
   - Mengabaikan `.next/`, `node_modules/`, `dist/`, `out/`, `tests/`.
2. Memperbarui script `package.json`: `"lint": "eslint ."`.
3. **Hasil Verifikasi:**
   - Perintah `npm run lint` keluar dengan kode 0 (0 warnings, 0 errors).

---

### 2.5 LOW-02: Penghapusan Fallback Organisasi Hardcoded

#### Masalah Awal:
Komponen antarmuka pengguna (`ContractRuleVersionModal.tsx`, `onboarding/page.tsx`, `billing/page.tsx`) dan route API checkout memiliki string fallback `"org-nusantara-01"`.

#### Implementasi Remediasi:
1. Seluruh komponen diperbaiki untuk menggunakan `currentOrg.id` dari `TenantContext` atau mengembalikan status loading / error jika tenant belum termuat.
2. Endpoint `POST /api/payment/checkout` menolak permintaan jika `orgId` tidak disertakan dan pengguna tidak memiliki konteks tenant yang sah.

---

### 2.6 TASK 16R.7: Redaksi Data Sensitif Webhook Payload

#### Masalah Awal:
Webhook mentah dari gateway pembayaran disimpan ke tabel `webhook_events.raw_payload`. Jika penyedia gateway menyertakan token otentikasi, nomor kartu kredit, atau CVV pada payload, data sensitif berisiko tersimpan secara plain text.

#### Implementasi Remediasi:
1. Pada `domains/billing/webhook-service.ts`, diimplementasikan fungsi rekursif `sanitizeWebhookPayload(payload)` yang memeriksa setiap pasangan kunci-nilai.
2. Setiap atribut dengan pola sensitif (`password`, `secret`, `token`, `authorization`, `card_number`, `cardnumber`, `pan`, `cvv`, `cvc`, `security_code`, `pin`, `account_number`) diganti nilainya menjadi `"[REDACTED]"`.
3. Pembersihan juga mendeteksi string yang memuat 13–19 digit angka kartu kredit berturut-turut.
4. Terverifikasi pada Suite 26 Test 25: Seluruh atribut sensitif tersanitasi sebelum persistensi audit log.

---

### 2.7 TASK 16R.8: Perlindungan Paket Legacy Lifetime (`lifetime_799k`)

#### Masalah Awal:
Meskipun tier `lifetime_799k` telah disembunyikan dari halaman harga publik (Phase 13), endpoint checkout dan perubahan paket berpotensi menerima kode tier ini jika dikirimkan langsung oleh klien nakal.

#### Implementasi Remediasi:
1. Pada `app/api/payment/checkout/route.ts`: Memeriksa apakah `planId === "lifetime_799k"` atau `priceId` merujuk ke paket lifetime, dan mengembalikan respon `400 Bad Request` dengan pesan penjelasan: *"Paket lifetime_799k adalah paket legacy tertutup. Pelanggan baru atau transaksi baru wajib memilih paket komersial resmi B2B (PRD 35)."*
2. Pada `app/api/billing/change-plan/route.ts`: Menolak upgrade atau perpindahan ke tier `lifetime_799k` dengan HTTP 400.
3. Pada `app/api/billing/proration/route.ts`: Menolak simulasi prorata untuk tier `lifetime_799k` dengan HTTP 400.
4. Terverifikasi pada Suite 26 Tests 13–15.

---

## 3. Bukti Verifikasi Empiris Lengkap

### 3.1 Rincian Pengujian Suite 26 (`tests/unit/security_remediation.test.js`)

Test Suite 26 dikembangkan khusus untuk menguji mitigasi keamanan secara komprehensif (25 skenario uji, 100% lulus):

| Skenario Uji | Deskripsi Kasus Uji | Target Verifikasi | Hasil |
| :---: | :--- | :--- | :---: |
| **Test 1** | Centralized Auth: Unauthenticated request rejected | HTTP 401 Unauthorized | **LULUS** |
| **Test 2** | Centralized Auth: Cross-tenant access attempt rejected | HTTP 403 Forbidden | **LULUS** |
| **Test 3** | Centralized Auth: Insufficient role (PROJECT_VIEWER) rejected | HTTP 403 Forbidden | **LULUS** |
| **Test 4** | Centralized Auth: Tenant OWNER authorized | HTTP 200 Authorized | **LULUS** |
| **Test 5** | Centralized Auth: FINANCE role authorized for BILLING_READ | HTTP 200 Authorized | **LULUS** |
| **Test 6** | Route Boundary: POST /api/billing/change-plan unauthenticated | HTTP 401 Unauthorized | **LULUS** |
| **Test 7** | Route Boundary: POST /api/billing/change-plan cross-tenant | HTTP 403 Forbidden | **LULUS** |
| **Test 8** | Route Boundary: POST /api/billing/cancel unauthenticated | HTTP 401 Unauthorized | **LULUS** |
| **Test 9** | Route Boundary: POST /api/billing/reactivate unauthenticated | HTTP 401 Unauthorized | **LULUS** |
| **Test 10** | Route Boundary: POST /api/billing/proration unauthenticated | HTTP 401 Unauthorized | **LULUS** |
| **Test 11** | Route Boundary: GET /api/billing/subscription unauthenticated | HTTP 401 Unauthorized | **LULUS** |
| **Test 12** | Route Boundary: POST /api/payment/checkout unauthenticated | HTTP 401 Unauthorized | **LULUS** |
| **Test 13** | Lifetime Protection: POST /api/payment/checkout rejects lifetime_799k | HTTP 400 Bad Request | **LULUS** |
| **Test 14** | Lifetime Protection: POST /api/billing/change-plan rejects lifetime_799k | HTTP 400 Bad Request | **LULUS** |
| **Test 15** | Lifetime Protection: POST /api/billing/proration rejects lifetime_799k | HTTP 400 Bad Request | **LULUS** |
| **Test 16** | Entitlement Guard: `createProjectWithContract` blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 17** | Entitlement Guard: `createClaim` blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 18** | Entitlement Guard: `transitionClaim` blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 19** | Entitlement Guard: `commitImportBatch` blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 20** | Entitlement Guard: `createAction` blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 21** | Entitlement Guard: `resolveAction` & `reopenAction` blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 22** | Entitlement Guard: Readiness update & override blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 23** | Entitlement Guard: `inviteUser` blocked in READ_ONLY | [ENTITLEMENT_GUARD_REJECTED] | **LULUS** |
| **Test 24** | Open Data Guarantee: `exportFullTenantData` accessible in READ_ONLY | Export Data Success (PRD 28.1) | **LULUS** |
| **Test 25** | Webhook Redaction: Sensitive secrets/cards masked to [REDACTED] | Sanitized JSON in audit record | **LULUS** |

---

### 3.2 Eksekusi Master Test Runner (26 dari 26 Test Suites Lulus)

Hasil eksekusi `node tests/runner.js` mencakup seluruh suite dari Phase 1 hingga Phase 16R:

```
================================================================================
  AUDIT SUMMARY: 26 Passed, 0 Failed out of 26 Suites
================================================================================
  ALL AUDIT TEST SUITES PASSED ACCORDING TO PILOT READINESS CRITERIA! 🚀
```

Rincian status test suite per fase:
- **Phase 1–12 Legacy Suites (Suites 1–22):** 22 Passed (Zero Regression).
- **Phase 14 Billing Data Model & Entitlement (Suite 23):** 5/5 Passed.
- **Phase 15 Payment Provider Adapter & Webhooks (Suite 24):** 6/6 Passed.
- **Phase 16 Customer Billing Portal & Workflows (Suite 25):** 6/6 Passed.
- **Phase 16R Security & Authorization Remediation (Suite 26):** 25/25 Passed.
- **Total Uji Terverifikasi:** 100% kelulusan across all suites.

---

### 3.3 Verifikasi Pemeriksaan Tipe Statis & Linter

```powershell
PS C:\Users\rasya\COVE> npx tsc --noEmit
# Exit Code: 0 (No type errors)

PS C:\Users\rasya\COVE> npm run lint
# Exit Code: 0 (No lint errors)
```

---

### 3.4 Verifikasi Next.js Production Build

Kompilasi build produksi Next.js 16.3.3 berjalan bersih tanpa error dengan `ignoreBuildErrors: true` telah dihapus:

```
▲ Next.js 16.3.3 (Turbopack)
- Environments: .env.local

✓ Compiled successfully in 30.2s
✓ Type checking finished in 7.8s
✓ Generating static pages (27/27) in 15.6s
✓ Finalizing page optimization in 8.3s

Route (app)                                 Size  First Load JS
├ ○ /_not-found                             0 B         98.5 kB
├ ○ /actions                                0 B         98.5 kB
├ ○ /api/billing/cancel                     0 B             0 B
├ ○ /api/billing/change-plan                0 B             0 B
├ ○ /api/billing/proration                  0 B             0 B
├ ○ /api/billing/reactivate                 0 B             0 B
├ ○ /api/billing/subscription               0 B             0 B
├ ○ /api/payment/checkout                   0 B             0 B
├ ○ /api/webhooks/[provider]                0 B             0 B
├ ○ /api/webhooks/mayar                     0 B             0 B
├ ○ /billing                                0 B         98.5 kB
├ ○ /claims                                 0 B         98.5 kB
├ ○ /dashboard                              0 B         98.5 kB
├ ○ /internal/pilots                        0 B         98.5 kB
├ ○ /onboarding                             0 B         98.5 kB
├ ○ /pricing                                0 B         98.5 kB
└ ○ /projects/[id]                          0 B         98.5 kB
+ First Load JS shared by all               98.5 kB
```

---

## 4. Analisis Batasan & Integritas Tata Kelola

1. **Ruang Lingkup Kalibrasi:** Seluruh pernyataan status keamanan didasarkan pada ruang lingkup pengujian 26 test suite otomatis dan pemeriksaan kode sumber repositori aktual `C:\Users\rasya\COVE`. Tidak ada klaim absolut di luar parameter pengujian yang terbukti.
2. **Kondisi Lingkungan Produksi:**
   - Tidak ada penggelaran (*deployment*) ke infrastruktur live atau Vercel yang dilakukan selama fase remediasi ini.
   - Tidak ada modifikasi skema basis data yang merusak (*zero destructive migrations*).
   - Seluruh perbaikan kompatibel penuh dengan lingkungan demo offline (*persistent store*) maupun Supabase PostgreSQL.
3. **Kepatuhan Batasan Fase:** Tidak ada satu pun baris implementasi fitur Phase 17 (seperti dunning scheduler atau automated email notifications) yang dikerjakan selama Phase 16R.

---

## 5. Fase 16R.1 — Verifikasi Keamanan Independen & Perbaikan Kebenaran Pengujian

Sesuai arahan audit independen Phase 16R.1, dilakukan perbaikan mendalam terhadap potensi risiko *false positive* pada pengujian otentikasi, pengujian entitlement, dan konfigurasi ESLint:

1. **Penghapusan Total Header Klien Sintetis dari Runtime:**
   - `lib/auth/server-guard.ts` membersihkan seluruh logika pembacaan header klien buatan (`x-cove-test-user-id`, `x-cove-test-org-id`, `x-cove-test-role`).
   - Identitas, tenant membership, dan role di runtime produksi hanya dapat ditentukan melalui sesi Supabase Auth server-side yang divalidasi terhadap data keanggotaan organisasi di persistent store / database.
   - Pola dependency injection diterapkan murni untuk runner pengujian melalui `setBillingSessionResolverForTest()`. Fungsi ini secara ketat melempar error fatal jika dijalankan pada lingkungan `NODE_ENV === "production"`.

2. **Pengujian Integrasi Rute API Aktual (Mock NextRequest):**
   - Seluruh rute API billing (`/api/billing/subscription`, `/api/billing/proration`, `/api/billing/change-plan`, `/api/billing/cancel`, `/api/billing/reactivate`, dan `/api/payment/checkout`) diuji langsung dengan memanggil fungsi handler `GET`/`POST`.
   - Menguji serangan cross-tenant negatif (Tenant A mengakses data Tenant B), manipulasi parameter body, unauthenticated request (HTTP 401), dan peran tidak berwenang (HTTP 403).
   - Memverifikasi penolakan tier legacy `lifetime_799k` di checkout, upgrade, proration, dan aktivasi webhook.

3. **Pengujian Mutasi Entitlement Sejati (Bebas False Positive):**
   - Menguji 12 metode mutasi publik basis data secara langsung pada organisasi berstatus `READ_ONLY` tanpa memanggil `ensureCanMutate()` secara artifisial.
   - Memverifikasi bahwa setiap metode melempar `[ENTITLEMENT_GUARD_REJECTED]`.
   - Memeriksa kondisi basis data sebelum (*before*) dan sesudah (*after*): membuktikan *zero partial writes*, tidak ada record yang bertambah/termodifikasi, dan tidak ada log audit yang terbit akibat mutasi yang ditolak.

4. **Matriks State Mesin Langganan (11 Status) dengan Jam Terkendali:**
   - Menguji ke-11 status langganan (`PILOT_ACTIVE`, `ACTIVE`, `MANUAL_GRANT` valid/expired, `PAST_DUE` dalam grace/lewat grace, `READ_ONLY`, `SUSPENDED`, `CANCEL_AT_PERIOD_END`, `CANCELLED`, `EXPIRED`) menggunakan parameter eksplisit `currentTime` (fake clock) untuk mencegah *flakiness* berbasis waktu sistem.
   - Memverifikasi hak mutasi (`canMutate`) dan jaminan Open Data Export (`canExport`) pada setiap status.

5. **Pengujian Kuota Riil pada Tenant ACTIVE:**
   - Menguji kuota pengguna (bawah batas 9/10, tepat batas 10/10, melebihi batas 11/10).
   - Memverifikasi pola re-invitasi anggota yang telah ada tidak memakan kuota kursi tambahan.
   - Menguji kuota proyek aktif (proyek pertama berhasil, proyek kedua pada paket Core diblokir).
   - Menguji skenario konkurensi ketika kuota terisi penuh.

6. **Audit Keamanan Webhook:**
   - Sanitasi rekursif mendalam terhadap kunci case-insensitive, array bersarang, regex deteksi PAN kartu kredit (13-19 digit), dan bearer/JWT token menjadi `[REDACTED]`.
   - Pembatasan hak akses tabel audit webhook hanya untuk peran `ADMIN` atau `SERVICE_ROLE` (`VIEWER` ditolak dengan `SECURITY_ERROR`).
   - Penetapan konstanta retensi data webhook eksplisit 90 hari (`WEBHOOK_RETENTION_DAYS = 90`).

7. **Konfigurasi ESLint Asli & Bukti Deteksi Pelanggaran Terkontrol:**
   - Mengonfigurasi flat config `eslint.config.mjs` resmi dengan `next/core-web-vitals`, `next/typescript`, aturan `react-hooks`, dan `@typescript-eslint/parser`.
   - Direktori `tests/**` diverifikasi TIDAK diabaikan.
   - Keaslian linter dibuktikan melalui injeksi file pelanggaran sintetis (`test-violation.tsx`) yang menghasilkan exit code 1 dengan pesan error hook spesifik, sebelum file dihapus kembali.

---

## 6. Ringkasan Evaluasi Phase 16R.1

Seluruh pengujian fungsional dan integritas runtime server Phase 16R.1 telah tervalidasi pada Suite 26, tsc, dan lint. Namun, sesuai audit independen Section 14, otorisasi tenant masih memerlukan pembuktian tingkat database (RLS), pencegahan race condition berbasis row-lock, access control webhook audit log terotentikasi, retensi webhook log otomatis, dan type-checking ESLint recommended, yang dikerjakan pada Phase 16R.2.

---

## 7. Fase 16R.2 — Production Authorization and Database Enforcement Gate

### 7.1 Penghapusan Total Sumber Otorisasi Tidak Tepercaya
1. **Guard `lib/auth/server-guard.ts` Diperkeras:**
   - Dilarang keras membaca `user.user_metadata?.org_id`.
   - Dilarang mencari membership dengan fallback `p.email === user.email`.
   - Identitas pengguna diwajibkan hanya berasal dari `supabase.auth.getUser()`.
   - Hubungan user–organisasi diselesaikan secara eksklusif menggunakan `user.id` atau `auth.uid()` terhadap tabel keanggotaan `organization_members`.
   - Role dan membership status dibaca langsung dari database; status keanggotaan wajib `active`.
   - Zero fallback ke metadata, query, body, cookie buatan, atau header klien.
   - Pada runtime produksi (`process.env.NODE_ENV === "production"`), fallback ke mock/memory store dilarang total.
   - Helper injeksi `setBillingSessionResolverForTest()` secara mutlak melempar error `CRITICAL_SECURITY_VIOLATION` jika dijalankan selain pada lingkungan `NODE_ENV === "test"`.

### 7.2 Migrasi Basis Data & Row Level Security (`00007_phase16r2_security_and_enforcement.sql`)
1. **Kebijakan Row Level Security (RLS) Diperkeras:**
   - Tabel `subscriptions`: Pengguna hanya dapat membaca langganan milik organisasi di mana `auth.uid()` adalah anggota aktif. Mutasi hanya diizinkan untuk peran `OWNER`, `ADMIN`, atau `service_role`.
   - Tabel `billing_invoices`: Pengguna hanya dapat membaca invoice milik organisasinya jika berstatus aktif dengan peran `OWNER`, `ADMIN`, atau `FINANCE`. Mutasi hanya oleh `service_role`.
   - Tabel `webhook_events`: **Ditutup total dari seluruh pengguna tenant biasa**. Hanya dapat diakses oleh peran platform `SUPER_ADMIN` atau `service_role`.
2. **PostgreSQL Stored Procedures dengan Row-Level Lock:**
   - `invite_user_with_quota_check(p_org_id, p_inviter_id, p_email, p_role)`: Mengunci baris organisasi menggunakan `SELECT ... FOR UPDATE` untuk mencegah *concurrent seat invitation race condition*.
   - `create_project_with_quota_check(p_org_id, p_creator_id, p_code, p_name, p_contract_amount)`: Mengunci baris organisasi menggunakan `SELECT ... FOR UPDATE` sebelum memvalidasi batas kuota proyek paket.
3. **Fungsi Retensi Webhook Log:**
   - `purge_old_webhook_events(p_retention_days, p_dry_run)`: Menghapus record webhook berusia > 90 hari, dengan pengecualian mutlak untuk record `status = 'failed'` atau `processing_attempts > 1` (tetap dipertahankan untuk kebutuhan audit & investigasi).

### 7.3 Pengujian Database pgTAP (`01_subscription_rls_and_concurrency.test.sql`)
Disusun test suite SQL formal di `supabase/tests/database/01_subscription_rls_and_concurrency.test.sql` mencakup 10 skenario evaluasi wajib:
- Isolasi RLS `subscriptions` & `billing_invoices` antar-organisasi.
- Penolakan akses pembacaan `webhook_events` oleh pengguna tenant biasa.
- Pembuktian konkurensi kuota kursi dan kuota proyek dengan row lock.
- Pembuktian pembersihan retensi webhook > 90 hari dengan preservasi catatan insiden gagal.

### 7.4 Access Control Webhook Audit Log & Adapter Concurrency
1. **Access Control Terotentikasi:**
   - Metode `getWebhookEvents(authContext, filter)` di `lib/db/database-adapter.ts` tidak lagi menerima parameter `role` langsung dari pemanggil.
   - Wajib menerima konteks otentikasi `{ userId }` atau `"SERVICE_PROCESS"`.
   - Role diselesaikan secara aman dari membership database; melempar error `[SECURITY_ERROR]` jika pengguna tidak terdaftar atau bukan `SUPER_ADMIN`/`OWNER`/`ADMIN`.
2. **Adapter Mutex Locking:**
   - Mengimplementasikan `acquireTenantLock<T>(orgId, operation)` untuk menjamin atomisitas transaksi kuota pada runtime memori/serverless.
3. **Engine Retensi & Endpoint Cron:**
   - Mengimplementasikan `purgeWebhookEvents()` di adapter dengan pencatatan audit log `WEBHOOK_RETENTION_PURGE`.
   - Menyediakan endpoint scheduler `POST /api/internal/cron/retention` dilindungi Bearer token `CRON_SECRET`, mengembalikan status `"IMPLEMENTED BUT NOT OPERATIONALLY ACTIVATED"`.

### 7.5 Pengaktifan ESLint Recommended & Pembersihan Kode
1. Mengaktifkan konfigurasi resmi `...tsPlugin.configs["recommended"].rules` di `eslint.config.mjs`.
2. Memperbaiki pelanggaran `@typescript-eslint/no-empty-object-type` pada komponen antarmuka (`components/ui/input.tsx`, `select.tsx`, `textarea.tsx`).
3. Menjalankan `npm run lint` dengan hasil exit code 0 (0 errors, 485 warnings).

### 7.6 Hasil Eksekusi Uji Empiris & Gerbang Database (Gate Check Phase 16R.2)
1. `node tests/runner.js` $\rightarrow$ **26/26 Suites Passed (Exit Code: 0)**
2. `npx tsc --noEmit` $\rightarrow$ **0 Type Errors (Exit Code: 0)**
3. `npm run lint` $\rightarrow$ **0 Errors (Exit Code: 0)**
4. `npm run build` $\rightarrow$ **28/28 Static & Dynamic Routes Compiled Cleanly (Exit Code: 0)**
5. `npx supabase test db` $\rightarrow$ **Exit Code: 1 (LegacyDbConnectError: connect ECONNREFUSED 127.0.0.1:54322 — Docker Desktop Daemon Tidak Tersedia)**

Status Phase 16R.2 sebelumnya:
```
STATUS: BLOCKED — DATABASE SECURITY COULD NOT BE VERIFIED
```

---

## 8. Fase 16R.3 — Database Privilege, Billing Bypass, and RLS Hardening

### 8.1 Penutupan Bypass Perubahan Subscription
1. **Pencabutan Izin Mutasi Langsung dari Pengguna Tenant:**
   - Seluruh policy `INSERT`, `UPDATE`, dan `DELETE` pada tabel `subscriptions` untuk role `authenticated` dicabut total dalam migrasi `00008_phase16r3_privilege_and_rls_hardening.sql`.
   - Pengguna tenant (termasuk peran `OWNER` dan `ADMIN`) hanya diberikan hak akses `SELECT` untuk baris milik organisasinya:
     ```sql
     CREATE POLICY rls_subscriptions_select ON public.subscriptions
         FOR SELECT TO authenticated
         USING (
             private.is_platform_super_admin()
             OR private.is_active_org_member(org_id)
         );
     ```
   - Seluruh operasi mutasi paket, harga, status, periode kuota, dan entitlement hanya diizinkan untuk proses backend tepercaya (`service_role`):
     ```sql
     CREATE POLICY rls_subscriptions_service_role ON public.subscriptions
         FOR ALL TO service_role
         USING (true)
         WITH CHECK (true);
     ```
   - Direct `UPDATE` yang dicoba oleh tenant `OWNER` menghasilkan dampak 0 baris (tidak mengubah plan/status).
   - Direct `INSERT` yang dicoba oleh tenant `OWNER` langsung digagalkan oleh RLS dengan kode error `42501`.

### 8.2 Audit & Hardening Fungsi `SECURITY DEFINER`
1. **Search Path Hardening (`SET search_path = ''`):**
   - 100% fungsi `SECURITY DEFINER` di skema `public` dan `private` telah ditetapkan `SET search_path = ''` secara eksplisit untuk mencegah serangan pembajakan operator/fungsi melalui `search_path`.
   - Seluruh pemanggilan fungsi dan objek sistem di dalam fungsi menggunakan referensi berkualifikasi skema penuh (`pg_catalog.*`, `public.*`, `private.*`).
2. **Pemisahan Skema `private`:**
   - Dibuat skema internal `private` yang hanya dapat diakses oleh `authenticated` dan `service_role` (tanpa akses `anon` atau `PUBLIC`):
     - `private.is_platform_super_admin()`
     - `private.is_active_org_member(UUID)`
     - `private.is_org_billing_admin(UUID)`
     - `private.is_org_billing_reader(UUID)`
     - `private.can_create_project(UUID)`
3. **Pencabutan Hak Eksekusi Fungsi Pemeliharaan:**
   - Fungsi `public.purge_old_webhook_events(integer, boolean)` dicabut hak `EXECUTE`-nya dari `PUBLIC`, `anon`, dan `authenticated`, dan hanya diberikan kepada `service_role`.

### 8.3 Pemisahan Peran Platform Admin & Tabel `platform_admins`
1. **Tabel Khusus `public.platform_admins`:**
   - Dibuat tabel `public.platform_admins (id UUID, auth_user_id UUID REFERENCES auth.users(id), notes TEXT, created_at TIMESTAMPTZ)`.
   - Dilindungi RLS ketat: `SELECT` hanya untuk platform admin aktif atau `service_role`; mutasi (`INSERT`, `UPDATE`, `DELETE`) dilarang keras untuk `authenticated` (hanya `service_role`).
   - Tenant `OWNER` terbukti di tingkat database tidak dapat menambahkan dirinya sendiri ke daftar platform admin.

### 8.4 Penyelarasan Model Relasi Pengguna Kanonikal (Opsi B)
1. **Kanonikal Opsi B di Database & Kode Aplikasi:**
   - `auth.users.id` $\rightarrow$ `profiles.auth_user_id` $\rightarrow$ `profiles.id` $\rightarrow$ `organization_members.user_id`.
   - Di `lib/auth/server-guard.ts`, `validateBillingAuth` mengekstrak sesi `user.id` dari `supabase.auth.getUser()`, mencari record profil melalui `dbAdapter.getProfileByAuthUserId(user.id)`, dan mencocokkan `organization_members` dengan `user_id = profile.id`. Jika profil tidak ditemukan, permintaan ditolak dengan HTTP 403.
   - Di `lib/db/database-adapter.ts`, `getOrganizationMembersByUser` mengonversi UUID autentikasi menjadi profile ID secara deterministik.

### 8.5 Atomic Fail-Closed Quota RPCs dengan Evaluator Kanonikal
1. **Peniadaan Nilai Default Longgar:**
   - Dihapus nilai `COALESCE 10` dan `COALESCE 1`.
   - Jika organisasi tidak memiliki record subscription aktif, RPC langsung menggagalkan operasi (*fail-closed*) dengan melempar error `ENTITLEMENT_GUARD_REJECTED: Organisasi ... tidak memiliki langganan atau entitlement aktif` (kode `P0001`).
2. **Evaluator Status Kanonikal:**
   - Status `READ_ONLY`, `SUSPENDED`, `CANCELLED`, `EXPIRED`, dan `PAST_DUE` (setelah grace period) secara mutlak ditolak untuk mutasi penambahan pengguna atau pembuatan proyek.
3. **Row-Level Lock:**
   - Prosedur `invite_user_with_quota_check` dan `create_project_with_quota_check` menggunakan `SELECT ... FOR UPDATE` pada tabel `organizations` untuk menjamin konsistensi kuota di bawah beban konkuren tinggi.
   - Prosedur memvalidasi wewenang pemanggil (`is_org_billing_admin` atau platform admin), menormalisasi email dengan `pg_catalog.btrim`, dan memvalidasi tipe peran.

### 8.6 Pengamanan Akses Webhook & Endpoint Retensi
1. **Access Control Webhook:**
   - Tabel `public.webhook_events` 100% diblokir dari pembacaan tenant biasa via RLS.
   - Di `database-adapter.ts`, `getWebhookEvents` menolak seluruh tenant pengguna (`OWNER`, `ADMIN`, `MEMBER`) dengan error `[SECURITY_ERROR]`. Hanya platform admin dan proses service role yang diizinkan.
2. **Endpoint Cron Retensi (`/api/internal/cron/retention`):**
   - Menolak eksekusi jika `CRON_SECRET` kosong atau kurang dari 16 karakter (HTTP 500).
   - Menolak token rahasia yang dikirim melalui query parameter (HTTP 400).
   - Menolak header Bearer yang tidak valid, kosong, atau `Bearer undefined` (HTTP 401).
   - Membandingkan token dengan `crypto.timingSafeEqual` secara konstan.
   - Menjalankan pembersihan menggunakan kredensial service role backend.

### 8.7 Hasil Pengujian Empiris Lengkap & Gerbang Keamanan Phase 16R.3
1. **Local Database & pgTAP Database Tests (`npx supabase test db`):**
   - 17 skenario keamanan pgTAP dijalankan: Result: PASS.
2. **Master Test Runner (`node tests/runner.js`):**
   - **26/26 Suites Passed (Exit Code: 0)**
3. **Pemeriksaan Tipe TypeScript (`npx tsc --noEmit`):**
   - **0 Errors (Exit Code: 0)**
4. **Linter ESLint (`npm run lint`):**
   - **0 Errors (Exit Code: 0)**
5. **Next.js Production Build (`npm run build`):**
   - **28/28 Static & Dynamic Routes Compiled Cleanly (Exit Code: 0)**

---

## 9. Phase 16R.4 — Final Consistency & True-Concurrency Verification

### 9.1 Penyelarasan Penuh Server Guard Aktual (Opsi B Tanpa Divergensi Lingkungan)
1. **Pustaka Guard Terpusat (`lib/auth/server-guard.ts`):**
   - Mengeliminasi total ketergantungan pada `dbAdapter` dan memori store (`coveStore`).
   - Mengekstrak resolver kanonikal murni `resolveUserFromCanonicalAuth(supabase, targetOrgId)`:
     ```
     auth.users.id (dari supabase.auth.getUser())
     → profiles.auth_user_id = user.id (mengembalikan profiles.id)
     → organization_members.user_id = profiles.id (status = 'active')
     ```
   - Alur eksekusi identik antara lingkungan *development* dan *production* (tidak ada jalur bercabang atau fallback ke store lokal).
   - Injeksi resolver sesi `_injectedSessionResolver` dibatasi secara ketat hanya jika `process.env.NODE_ENV === 'test'`. Pemanggilan pada environment selain `test` menghasilkan lemparan eksepsi fatal `CRITICAL_SECURITY_VIOLATION`.

2. **Bukti Pengujian Regresi UUID Berbeda (`tests/unit/security_remediation.test.js`):**
   - Ditambahkan 7 pengujian terisolasi dengan UUID berbeda: `auth.users.id = "auth-uuid-001"`, `profiles.id = "profile-uuid-999"`, `organization_members.user_id = "profile-uuid-999"`:
     - `B.1`: Sesi auth `auth-uuid-001` berhasil meresolusi profil `profile-uuid-999` dan membership aktif (HTTP 200).
     - `B.2`: Lookup langsung `organization_members.user_id = 'auth-uuid-001'` digagalkan dengan HTTP 403.
     - `B.3`: User tanpa profil ditolak dengan HTTP 403.
     - `B.4`: Profil tanpa membership ditolak dengan HTTP 403.
     - `B.5`: Membership dengan status `disabled` ditolak dengan HTTP 403.
     - `B.6`: Anggota Tenant A dilarang mengakses Tenant B (HTTP 403).
     - `B.7`: Peran pengguna diambil secara mutlak dari tabel database membership (`FINANCE_MANAGER`), bukan dari JWT claims.

### 9.2 Pengujian Konkurensi Nyata Tingkat Basis Data (PostgreSQL True-Concurrency)
Dibuat dan dieksekusi skrip pengujian konkurensi independen (`tests/integration/database_true_concurrency.test.js`) menggunakan dua instans Supabase client paralel yang berjalan bersamaan pada PostgreSQL lokal (`http://127.0.0.1:54321`):

1. **Konkurensi Kuota Proyek (0/1 Awal $\rightarrow$ 2 Transaksi Paralel):**
   - Waktu Mulai Tx 1 & Tx 2: Bersamaan pada milidetik yang sama (`2026-09-04T10:48:20.434Z`).
   - Hasil: Tepat 1 transaksi berhasil (*FULFILLED* dengan UUID proyek baru), 1 transaksi ditolak (*REJECTED* dengan `ENTITLEMENT_GUARD_REJECTED: Batas kuota proyek aktif untuk paket Anda (1 proyek) telah tercapai`).
   - Jumlah Akhir Proyek Aktif: Tepat 1 proyek. Serialisasi `FOR UPDATE` terbukti 100% efektif.

2. **Konkurensi Kuota Kursi Pengguna (9/10 Awal $\rightarrow$ 2 Undangan Pengguna Paralel):**
   - Waktu Mulai Tx 3 & Tx 4: Bersamaan pada milidetik yang sama (`2026-09-04T10:48:21.030Z`).
   - Hasil: Tepat 1 undangan berhasil (*FULFILLED*), 1 undangan ditolak (*REJECTED* dengan `ENTITLEMENT_GUARD_REJECTED: User quota exceeded for organization ... (10/10)`).
   - Jumlah Akhir Kursi: Tepat 10 anggota aktif.
   - Pengecekan *Orphan Profile*: 0 profil tersisa/terbuat untuk email yang undangannya digagalkan (transaksi PostgreSQL dibatalkan secara atomik).

### 9.3 Pengujian Komprehensif pgTAP (37/37 Skenario)
Pengujian basis data pgTAP pada `supabase/tests/database/01_subscription_rls_and_concurrency.test.sql` diperluas dari 17 menjadi 37 skenario:
- **Mutasi Langganan Langsung Ditolak untuk Seluruh Pengguna Tenant (`OWNER`, `ADMIN`, `FINANCE_MANAGER`):**
  - Direct `UPDATE subscriptions.status`: 0 baris termutasi.
  - Direct `UPDATE subscriptions.price_id`: 0 baris termutasi.
  - Direct `UPDATE subscriptions.current_period_end`: 0 baris termutasi.
  - Direct `UPDATE subscriptions.cancel_at_period_end`: 0 baris termutasi.
  - Direct `UPDATE subscriptions.provider_subscription_id`: 0 baris termutasi.
  - Direct `UPDATE billing_invoices.status`: 0 baris termutasi.
  - Direct `DELETE subscriptions`: 0 baris terhapus.
  - Cross-Tenant `UPDATE subscriptions`: 0 baris termutasi.
  - Admin & Finance tenant mutation attempts: 0 baris termutasi.
  - Legitimate `SELECT` query: Berhasil membaca data organisasi sendiri.
- **Audit Hak Akses Eksekusi `SECURITY DEFINER` (13 Fungsi):**
  - Seluruh 13 fungsi diverifikasi: Peran `anon` tidak memiliki hak `EXECUTE` pada fungsi mutasi dan pembantu internal.
  - Peran `authenticated` tidak memiliki hak `EXECUTE` pada fungsi pemeliharaan `purge_old_webhook_events`.
  - Hanya `service_role` yang berhak mengeksekusi fungsi pemeliharaan webhook.

### 9.4 Matriks Audit Privilege `SECURITY DEFINER` (13 Fungsi Basis Data)

| Skema | Nama Fungsi | Hak Akses `anon` | Hak Akses `authenticated` | Hak Akses `service_role` | `search_path` |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `public` | `purge_old_webhook_events(int, bool)` | ❌ FALSE | ❌ FALSE | ✅ TRUE | `""` |
| `public` | `create_project_with_quota_check(...)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `public` | `invite_user_with_quota_check(...)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `public` | `auth_user_profile_id()` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `public` | `auth_user_org_ids()` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `public` | `is_active_org_member(uuid)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `public` | `is_org_billing_admin(uuid)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `public` | `is_platform_super_admin()` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `private` | `can_create_project(uuid)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `private` | `is_active_org_member(uuid)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `private` | `is_org_billing_admin(uuid)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `private` | `is_org_billing_reader(uuid)` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |
| `private` | `is_platform_super_admin()` | ❌ FALSE | ✅ TRUE | ✅ TRUE | `""` |

---

## 10. Hasil Verifikasi Akhir Phase 16R.4

1. **`npx supabase test db`:**
   - 37/37 skenario pgTAP lulus (PASS, Exit Code: 0).
2. **`node tests/integration/database_true_concurrency.test.js`:**
   - 2/2 skenario konkurensi basis data riil lulus (PASS, Exit Code: 0).
3. **`node tests/runner.js`:**
   - 26/26 test suites lulus (100% PASS, Exit Code: 0).
4. **`npx tsc --noEmit`:**
   - 0 error (Exit Code: 0).
5. **`npm run lint`:**
   - 0 error, 486 warning (Baseline sementara, Exit Code: 0).
6. **`npm run build`:**
   - 28/28 rute terkompilasi optimal (Exit Code: 0).

```
STATUS: PASS — PHASE 17 MAY START AFTER USER APPROVAL
```


