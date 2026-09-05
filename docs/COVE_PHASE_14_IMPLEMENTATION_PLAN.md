# COVE — Phase 14 Detailed Implementation Plan

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Target Scope:** **Billing Data Model dan Entitlement Foundation**  
**Strict Rule:** Dilarang memasukkan integrasi gateway, checkout UI, atau webhook provider ke dalam Phase 14. Phase 14 khusus membangun fondasi data model, lifecycle state machine, dan server-side entitlement guards.

---

## 1. Ikhtisar Rencana Phase 14

Phase 14 meletakkan fondasi teknis dan basis data penagihan modern yang memisahkan urusan finansial (*billing*) dari urusan hak akses fungsional (*entitlement*). Dengan menyelesaikan Phase 14, sistem COVE akan memiliki kemampuan untuk:
1. Menyimpan dan mengelola siklus langganan perusahaan secara persisten di basis data.
2. Memblokir pelanggaran kuota proyek aktif secara mutlak di sisi server (*server-side mutation guard*).
3. Mengunci mutasi data secara otomatis saat akun berada dalam status `READ_ONLY`, `SUSPENDED`, atau `EXPIRED`.
4. Menyediakan audit trail forensik penagihan (*billing audit logs*) yang siap menghadapi audit keuangan.

---

## 2. Rincian Task Implementasi Phase 14

### Task 14.1: Database Migration — 16 Tabel Billing & Entitlement Aditif
* **Tujuan:** Membuat 16 tabel baru penagihan dan menambahkan kolom foreign key `active_subscription_id` pada tabel `organizations`.
* **File yang Berubah/Dibuat:**
  - `supabase/migrations/20260904_subscription_foundation.sql` (NEW)
  - `supabase/schema.sql` (MODIFIED — update snapshot skema utama)
  - `lib/db/database-adapter.ts` (MODIFIED — registrasi struktur data baru)
* **Tabel yang Dibuat/Diubah:**
  - Diubah: `organizations` (+ `active_subscription_id`, `billing_email`, `billing_phone`, `npwp_number`).
  - Dibuat (16 tabel): `billing_customers`, `plans`, `prices`, `plan_entitlements`, `subscriptions`, `subscription_items`, `subscription_status_events`, `billing_invoices`, `payments`, `payment_attempts`, `webhook_events`, `entitlement_snapshots`, `usage_records`, `subscription_overrides`, `discounts`, `billing_audit_logs`.
* **Business Rule:**
  - Seluruh relasi foreign key berelasi ke `organizations(id)` dengan `ON DELETE CASCADE`.
  - Constraint keunikan diterapkan pada `(org_id, provider)` di `billing_customers` dan `(provider, event_id)` di `webhook_events`.
* **Authorization & Security:** Policy RLS aktif pada seluruh tabel dengan aturan `org_id = current_user_org_id()`.
* **Audit:** Setiap pembuatan tabel dan migrasi dicatat pada log migrasi database.
* **Acceptance Criteria:**
  - File SQL lolos sintaks PostgreSQL tanpa error.
  - Tabel lama Phase 1–12 tetap utuh dan fungsional 100%.
* **Rollback:** Eksekusi skrip DROP TABLE untuk 16 tabel baru dalam urutan pembalikan dependency.

---

### Task 14.2: Data Seed & Price Versioning Foundation
* **Tujuan:** Menginisialisasi katalog paket B2B (`plans`), harga bertanggal (`prices`), dan konfigurasi entitlement default (`plan_entitlements`).
* **File yang Berubah/Dibuat:**
  - `domains/billing/seed-data.ts` (NEW)
  - `lib/db/database-adapter.ts` (MODIFIED — load seed billing)
* **Tabel yang Dilibatkan:** `plans`, `prices`, `plan_entitlements`.
* **Business Rule:**
  - Menginisialisasi 4 paket B2B: `b2b_pilot` (Rp10Jt/45hr), `b2b_core` (Rp2.5Jt/bln, min Rp30Jt/thn), `b2b_scale` (Rp5Jt/bln, min Rp60Jt/thn), `b2b_enterprise` (Rp15Jt/bln).
  - Menginisialisasi Project Add-on (`b2b_addon_project`: Rp750rb/bln).
  - Menginisialisasi 1 paket legacy (`lifetime_799k` dengan `is_public = false`).
* **Authorization:** Hanya sistem / DB admin yang berhak memodifikasi harga.
* **Audit:** Pencatatan versi harga awal dengan timestamp efektif 4 September 2026.
* **Acceptance Criteria:** Query pada tabel `plans` dan `prices` mengembalikan 5 paket terdefinisi lengkap dengan rincian entitlement numerik.
* **Rollback:** `DELETE FROM plans WHERE id IN ('b2b_pilot', 'b2b_core', 'b2b_scale', 'b2b_enterprise', 'lifetime_799k');`

---

### Task 14.3: Server-Side Entitlement Guard Engine
* **Tujuan:** Membangun modul evaluasi hak akses terpusat di server yang memeriksa status langganan dan batas kuota sebelum aksi dijalankan.
* **File yang Berubah/Dibuat:**
  - `domains/entitlement/service.ts` (NEW)
  - `domains/entitlement/types.ts` (NEW)
* **Tabel yang Dilibatkan:** `subscriptions`, `plan_entitlements`, `entitlement_snapshots`, `subscription_overrides`.
* **Business Rule:**
  - Fungsi utama: `evaluateTenantEntitlement(orgId: string, requiredFeature?: string): EntitlementEvaluationResult`.
  - Jika status subscription = `READ_ONLY`, `PAST_DUE` (setelah grace), `SUSPENDED`, `CANCELLED`, atau `EXPIRED`:
    - Hak baca dan ekspor (`CAN_VIEW`, `CAN_EXPORT`) = `true`.
    - Hak mutasi (`CAN_MUTATE`) = `false`.
  - Jika manual override aktif dan belum expired, gunakan nilai override.
* **Authorization:** Dijalankan secara internal di backend pada setiap pemanggilan mutasi.
* **Audit:** Percobaan akses yang ditolak dicatat pada `billing_audit_logs` dengan aksi `ACCESS_DENIED_ENTITLEMENT`.
* **Acceptance Criteria:**
  - Unit test memvalidasi bahwa status non-aktif mengembalikan `canMutate = false`.
  - Fungsi mengembalikan alasan eksplisit mengapa mutasi ditolak.
* **Rollback:** Hapus file `domains/entitlement/service.ts`.

---

### Task 14.4: Mutation Guard Integration pada Modul Proyek & Impor
* **Tujuan:** Menghubungkan Entitlement Guard ke fungsi pembuatan proyek dan impor tracker untuk mencegah bypass kuota dan mutasi saat read-only.
* **File yang Berubah/Dibuat:**
  - `lib/db/database-adapter.ts` (MODIFIED — tambahkan guard pada `createProjectWithContract`)
  - `domains/imports/service.ts` (MODIFIED — tambahkan guard pada commit impor)
  - `domains/actions/service.ts` (MODIFIED — tambahkan guard pada pembuatan tiket tindakan)
  - `components/projects/CreateProjectModal.tsx` (MODIFIED — tangani error 402 kuota penuh dengan dialog ramah)
* **Tabel yang Dilibatkan:** `projects`, `subscriptions`, `source_imports`.
* **Business Rule:**
  - Sebelum proyek baru dimasukkan: hitung `currentActiveProjects`. Jika $\ge `maxActiveProjects`, lempar `EntitlementLimitError`.
  - Jika organisasi berstatus `READ_ONLY`, lempar `ReadOnlyAccountError`.
* **Authorization:** Memeriksa `OWNER` / `ADMIN` + `canMutate = true`.
* **Audit:** Setiap pemblokiran mutasi menghasilkan jejak audit.
* **Acceptance Criteria:**
  - Kontraktor paket Core (maks 1 proyek) berhasil membuat proyek ke-1, tetapi GAGAL saat mencoba membuat proyek ke-2 dengan pesan yang jelas.
  - Akun read-only tidak dapat mengunggah file impor data baru.
* **Rollback:** Kembalikan method `createProjectWithContract` dan service imports ke versi baseline Phase 12.

---

### Task 14.5: Subscription Lifecycle State Machine Domain Engine
* **Tujuan:** Membangun domain service yang mengelola 11 status transisi siklus hidup langganan di memori dan persistensi.
* **File yang Berubah/Dibuat:**
  - `domains/subscription/lifecycle.ts` (NEW)
  - `domains/subscription/types.ts` (NEW)
* **Tabel yang Dilibatkan:** `subscriptions`, `subscription_status_events`, `subscription_items`.
* **Business Rule:**
  - Memvalidasi seluruh transisi sesuai spesifikasi dokumen `COVE_SUBSCRIPTION_STATE_MACHINE.md`.
  - Transisi ilegal (misal: dari `DRAFT` langsung ke `READ_ONLY`) wajib ditolak dengan `InvalidStateTransitionError`.
  - Setiap transisi wajib menyertakan `reason`, `source`, dan `actorId`.
* **Authorization:** Hanya internal worker atau authorized admin yang berhak memanggil fungsi transisi.
* **Audit:** Menulis record baru ke tabel `subscription_status_events` secara otomatis pada setiap transisi.
* **Acceptance Criteria:**
  - State machine berhasil mensimulasikan alur: `DRAFT` $\rightarrow$ `PENDING_PAYMENT` $\rightarrow$ `ACTIVE` $\rightarrow$ `PAST_DUE` $\rightarrow$ `READ_ONLY` $\rightarrow$ `SUSPENDED`.
  - Percobaan transisi ilegal ditolak 100%.
* **Rollback:** Hapus file `domains/subscription/lifecycle.ts`.

---

### Task 14.6: Automated Test Suite 23 — Billing Data Model & Entitlement Foundation
* **Tujuan:** Membuat automated test suite komprehensif khusus untuk memverifikasi seluruh komponen data model dan guard Phase 14.
* **File yang Berubah/Dibuat:**
  - `tests/unit/subscription_foundation.test.js` (NEW — Test Suite 23)
  - `tests/runner.js` (MODIFIED — daftarkan Suite 23)
  - `docs/COVE_TEST_BASELINE.md` (MODIFIED — katalog test menjadi 23 suites)
* **Cakupan Pengujian:**
  1. Verifikasi integritas 16 entitas data model dan constraint relasional.
  2. Pengujian batas kuota proyek aktif (B2B Core limit = 1, Scale limit = 5).
  3. Pengujian pemblokiran mutasi data pada status `READ_ONLY`.
  4. Pengujian validitas transisi 11 status lifecycle state machine.
  5. Pengujian masa berlaku manual override dan rollback otomatis saat expired.
  6. Pengujian jaminan ekspor data terbuka (*Open Data Guarantee*).
* **Acceptance Criteria:**
  - Seluruh pengujian dalam Suite 23 lulus 100% tanpa error.
  - Pengujian 22 suite Phase 1–12 tetap lulus 100% tanpa regresi (*zero regression*).
* **Rollback:** Hapus file test dan unregister dari `tests/runner.js`.
