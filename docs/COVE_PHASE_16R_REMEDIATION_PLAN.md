# COVE — Phase 16R Remediation Plan: Subscription Security & Type Hardening

**Document Version:** 1.0.0  
**Creation Date:** 4 September 2026  
**Auditor:** Antigravity (Phase 16.5: Retrospective Subscription Audit & Recovery Gate)  
**Status:** **DRAFT PLAN — MENUNGGU PERINTAH EKSEKUSI PENGGUNA ("LANJUT PHASE 16R")**  
**Prinsip Kerja:** *Strict Remediation Only — Tidak Menambah Fitur Baru, Menyelesaikan 2 Temuan HIGH dan 2 Temuan MEDIUM, Menjamin Zero Regression.*

---

## 1. Latar Belakang & Ruang Lingkup

Audit retrospektif Phase 16.5 menetapkan keputusan **REPAIR REQUIRED** karena ditemukannya celah otorisasi multi-tenant pada rute API billing mandiri ([SEC-HIGH-01]) dan cakupan penegakan *mutation guard* yang belum menyeluruh pada operasi selain pembuatan proyek ([SEC-HIGH-02]), serta beberapa ketidaksesuaian tipe TypeScript statis ([MED-01]).

Phase 16R dirancang sebagai fase perbaikan terisolasi untuk mengeraskan keamanan dan integritas kode sebelum sistem melangkah ke otomatisasi penagihan dan dunning di Phase 17.

---

## 2. Rincian Rencana Perbaikan (4 Task Utama)

### Task 16R.1: Otorisasi Sesi Server & Isolasi Multi-Tenant Rute API Billing ([SEC-HIGH-01])
- **Masalah:** Rute `app/api/billing/*` menerima `orgId` tanpa memvalidasi sesi cookie pengguna dan tanpa memeriksa wewenang peran `OWNER` / `ADMIN`.
- **Langkah Perbaikan:**
  1. Buat helper otorisasi server terpusat pada `lib/auth/server-guard.ts`:
     ```ts
     export async function requireBillingAdmin(req: Request, targetOrgId: string): Promise<{
       authorized: boolean;
       user?: { id: string; orgId: string; role: string };
       error?: string;
       statusCode: number;
     }>
     ```
  2. Helper akan:
     - Membaca sesi dari cookie menggunakan `createClient` dari `@/lib/supabase/server`.
     - Mengambil profil pengguna dari basis data / store.
     - Jika pengguna tidak memiliki sesi login: kembalikan `401 Unauthorized`.
     - Jika `user.orgId !== targetOrgId` dan pengguna bukan `SUPER_ADMIN`: kembalikan `403 Forbidden` (mencegah kebocoran data lintas tenant).
     - Jika peran pengguna bukan `OWNER` atau `ADMIN`: kembalikan `403 Forbidden` (pengguna biasa tidak boleh mengubah paket atau membatalkan langganan).
     - Menyediakan mode bypass aman khusus untuk pengujian otomatis jika flag `x-cove-test-auth` terpasang pada lingkungan `NODE_ENV === "test"`.
  3. Integrasikan `requireBillingAdmin` pada 5 rute:
     - `app/api/billing/subscription/route.ts`
     - `app/api/billing/proration/route.ts`
     - `app/api/billing/change-plan/route.ts`
     - `app/api/billing/cancel/route.ts`
     - `app/api/billing/reactivate/route.ts`
     - Serta verifikasi pada `app/api/payment/checkout/route.ts`.

---

### Task 16R.2: Penegakan Menyeluruh Server Entitlement Guard ([SEC-HIGH-02])
- **Masalah:** Fungsi `guardMutation` baru diterapkan pada pembuatan proyek. Pengguna akun `READ_ONLY` atau `SUSPENDED` masih dapat mengimpor lembar progress atau menyelesaikan action blocker.
- **Langkah Perbaikan:**
  1. Pada `lib/db/database-adapter.ts`, tambahkan pemeriksaan hak mutasi organisasi sebelum mengeksekusi operasi tulis inti:
     - `commitImportBatch`: Periksa `canMutate`. Tolak jika `READ_ONLY` atau `SUSPENDED` dengan error `[ENTITLEMENT_LOCKED] Akun berstatus read-only. Impor data baru dinonaktifkan.`
     - `createAction` & `resolveAction`: Periksa `canMutate`. Tolak pembuatan atau perubahan status tiket tindakan jika akun terkunci.
     - `transitionClaimStage`: Tolak transisi klaim progres fisik baru jika akun terkunci.
     - `inviteUser`: Periksa kuota kursi pengguna (`maxUsers`) terhadap jumlah anggota aktif sebelum mengirim undangan.
  2. Pastikan `canExport = true` tetap diizinkan 100% (*Open Data Guarantee* PRD 28.1).

---

### Task 16R.3: Perbaikan Ketidaksesuaian Tipe TypeScript Statis ([MED-01])
- **Masalah:** `npx tsc --noEmit` menghasilkan error tipe karena duplikasi fungsi dan ketidakcocokan nama properti.
- **Langkah Perbaikan:**
  1. Bersihkan duplikasi fungsi proksi pada `domains/store/persistent-store.ts` (baris 502–512 dan 598–608).
  2. Sesuaikan pemetaan properti `DemoProject` pada `domains/subscription/workflow-service.ts`:
     Gunakan `project.projectName || (project as any).name`, `project.projectCode || (project as any).code`, `project.contractAmount || (project as any).contractValue`.
  3. Sesuaikan tipe `BillingAuditLog` pada `lib/db/database-adapter.ts` agar tidak menyisipkan properti `details` yang tidak didefinisikan pada interface.
  4. Perbaiki pemanggilan `cookies()` pada `lib/supabase/server.ts` agar kompatibel dengan tipe `Promise` Next.js 15/16.
  5. Verifikasi hingga `npx tsc --noEmit` menghasilkan **Exit Code 0 (Zero Type Errors)**.

---

### Task 16R.4: Konfigurasi Linter Next.js ([MED-02])
- **Masalah:** Perintah `npm run lint` menghasilkan `Invalid project directory provided: C:\Users\rasya\COVE\lint`.
- **Langkah Perbaikan:**
  1. Perbaiki entri script pada `package.json` dari `"lint": "next lint"` menjadi konfigurasi yang valid atau buat berkas `.eslintrc.json`.
  2. Verifikasi hingga `npm run lint` dapat dieksekusi secara bersih.

---

## 3. Rencana Pengujian & Verifikasi Phase 16R

1. **Unit & Security Tests Tambahan:**
   - Uji penolakan HTTP 401 saat memanggil endpoint billing tanpa session.
   - Uji penolakan HTTP 403 saat user Organisasi A memanggil endpoint Organisasi B.
   - Uji penolakan HTTP 403 saat user dengan peran `QS` / `PM` mencoba membatalkan langganan.
   - Uji penolakan mutasi impor dan tiket tindakan saat status organisasi `READ_ONLY`.
2. **Regression Check:**
   - Jalankan `node tests/runner.js` dan pastikan seluruh 25 Test Suites tetap lulus 100%.
3. **Type & Build Check:**
   - Jalankan `npx tsc --noEmit` $\rightarrow$ Target: 0 errors.
   - Jalankan `npm run build` $\rightarrow$ Target: 27 routes compiled successfully.

---

## 4. Batasan & Syarat Eksekusi

> **PERINGATAN TATA KELOLA:** Sesuai instruksi pengguna pada Phase 16.5, rencana perbaikan ini **TIDAK AKAN DIJALANKAN SECARA OTOMATIS**. Kode aplikasi, skema basis data, dan rute API tidak akan diubah sampai pengguna memberikan perintah eksplisit:
>
> **`LANJUT PHASE 16R`**
