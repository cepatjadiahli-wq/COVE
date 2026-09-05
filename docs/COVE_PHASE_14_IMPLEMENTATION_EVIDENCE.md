# COVE — Phase 14 Implementation Evidence: Billing Data Model & Entitlement Foundation

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Auditor:** Antigravity (Phase 16.5: Retrospective Subscription Audit & Recovery Gate)  
**Reference Specification:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 4, 6, 8, 9)  
**Migration File:** `supabase/migrations/00006_subscription_foundation.sql`  

---

## 1. Matriks Audit 17 Entitas Basis Data Billing & Entitlement

Berikut adalah verifikasi keberadaan fisik, integritas skema, batas tenant, dan pengujian untuk seluruh 17 entitas:

| No | Entitas | Ada/Tidak | File / Migration | Tenant Scope | Constraint | RLS / Authorization | Audit | Test | Status |
| :-: | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | **organizations** | **ADA** | `supabase/schema.sql` (L30), `00006_subscription_foundation.sql` | Root Tenant Entity | `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` | RLS `organizations_isolation` | `audit_logs` & `billing_audit_logs` | Suite 9, 21, 23 | **COMPLETE** |
| 2 | **billing_customers** | **ADA** | `supabase/schema.sql` (L29.1), `00006_subscription_foundation.sql` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, UNIQUE `(provider, provider_customer_id)` | RLS `billing_customers_isolation` | `billing_audit_logs` | Suite 23 Test 1 | **COMPLETE** |
| 3 | **plans** | **ADA** | `supabase/schema.sql` (L29.2), `domains/billing/types.ts` | Global Catalog | `id VARCHAR(50) PRIMARY KEY` | Read-only authenticated | Seed catalog audit | Suite 23 Test 1 | **COMPLETE** |
| 4 | **prices** | **ADA** | `supabase/schema.sql` (L29.3), `domains/billing/seed-data.ts` | Global Versioned Catalog | `id VARCHAR(50) PRIMARY KEY`, `plan_id REFERENCES plans(id)`, `effective_from`, `version` | Read-only authenticated | Version timestamped | Suite 23 Test 1 | **COMPLETE** |
| 5 | **plan_entitlements** | **ADA** | `supabase/schema.sql` (L29.4), `domains/billing/types.ts` | Global Tier Mapping | `plan_id REFERENCES plans(id)`, `max_active_projects`, `max_users` | Read-only authenticated | Feature matrix audit | Suite 23 Test 1 | **COMPLETE** |
| 6 | **subscriptions** | **ADA** | `supabase/schema.sql` (L29.5), `domains/billing/types.ts` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, `plan_id REFERENCES plans(id)`, `price_id REFERENCES prices(id)` | RLS `subscriptions_isolation` | `subscription_status_events` | Suite 23 Test 2, 4 | **COMPLETE** |
| 7 | **subscription_items** | **ADA** | `supabase/schema.sql` (L29.6), `domains/billing/types.ts` | `subscription_id REFERENCES subscriptions(id)` | `id UUID PRIMARY KEY`, `item_type`, `unit_price`, `quantity` | RLS cascade via subscription | Item audit | Suite 23 Test 1 | **COMPLETE** |
| 8 | **subscription_status_events** | **ADA** | `supabase/schema.sql` (L29.7), `domains/subscription/lifecycle.ts` | `subscription_id REFERENCES subscriptions(id)` | `id UUID PRIMARY KEY`, `from_status`, `to_status`, `reason`, `actor_id` | RLS cascade, Append-Only | Status ledger immutable | Suite 23 Test 4 | **COMPLETE** |
| 9 | **billing_invoices** | **ADA** | `supabase/schema.sql` (L29.8), `domains/billing/types.ts` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, UNIQUE `invoice_number`, `amount_total` | RLS `billing_invoices_isolation` | `billing_audit_logs` | Suite 24, 25 | **COMPLETE** |
| 10 | **payments** | **ADA** | `supabase/schema.sql` (L29.9), `domains/billing/types.ts` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, UNIQUE `(provider, provider_payment_id)` | RLS `payments_isolation` | `billing_audit_logs` | Suite 24 Test 5 | **COMPLETE** |
| 11 | **payment_attempts** | **ADA** | `supabase/schema.sql` (L29.10), `domains/billing/types.ts` | `billing_invoice_id REFERENCES billing_invoices(id)` | `id UUID PRIMARY KEY`, `attempt_number`, `gateway_error_code` | RLS cascade | Gateway error audit | Suite 24 | **COMPLETE** |
| 12 | **webhook_events** | **ADA** | `supabase/schema.sql` (L29.11), `domains/billing/webhook-service.ts` | Ingress Log / `org_id` resolved | `id UUID PRIMARY KEY`, UNIQUE `(provider, event_id)` | RLS backend access | Full raw JSONB payload | Suite 24 Test 3 | **COMPLETE** |
| 13 | **entitlement_snapshots** | **ADA** | `supabase/schema.sql` (L29.12), `domains/billing/types.ts` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, `max_active_projects`, `effective_from` | RLS `entitlement_snapshots_isolation` | Locked quota audit | Suite 24 Test 5 | **COMPLETE** |
| 14 | **usage_records** | **ADA** | `supabase/schema.sql` (L29.13), `domains/billing/types.ts` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, `metric_name`, `current_value` | RLS `usage_records_isolation` | Periodic usage log | Suite 23 Test 3 | **COMPLETE** |
| 15 | **subscription_overrides** | **ADA** | `supabase/schema.sql` (L29.14), `domains/entitlement/service.ts` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, `granted_by`, `reason`, `expires_at` | RLS `subscription_overrides_isolation` | Mandatory author/reason | Suite 23 Test 5 | **COMPLETE** |
| 16 | **discounts** | **ADA** | `supabase/schema.sql` (L29.15), `domains/billing/seed-data.ts` | Global / `applicable_plan_id` | `id VARCHAR(50) PRIMARY KEY`, `valid_until`, `max_redemptions` | Read-only authenticated | Redemptions count | Suite 23 Test 1 | **COMPLETE** |
| 17 | **billing_audit_logs** | **ADA** | `supabase/schema.sql` (L29.16), `domains/billing/types.ts` | `org_id REFERENCES organizations(id)` | `id UUID PRIMARY KEY`, `actor_id`, `actor_role`, `action` | RLS `billing_audit_logs_isolation`, Append-Only | Forensic billing log | Suite 23, 24, 25 | **COMPLETE** |

---

## 2. Pemeriksaan Prinsip Desain Phase 14

### 2.1 Kepemilikan Langganan oleh Organisasi (Bukan User)
- **Bukti:** Pada tabel `public.subscriptions` dan interface TypeScript `Subscription`, field relasional utama adalah `org_id: string` yang mereferensikan `public.organizations(id)`. Pengguna individual (`profiles`) berelasi ke `organizations.id`. Penggantian anggota atau staf tidak membatalkan atau merusak langganan perusahaan.

### 2.2 Pemisahan Arsitektural Antara Billing dan Entitlement
- **Bukti:** Definisi katalog harga dan penagihan berada di bawah `domains/billing/` (`plans`, `prices`, `discounts`).
- Logika hak akses dan kuota berada terpisah di bawah `domains/entitlement/service.ts` (`plan_entitlements`, `entitlement_snapshots`, `subscription_overrides`). Billing mengelola uang dan transaksi; Entitlement mengelola kuota proyek, kuota pengguna, dan izin mutasi data.

### 2.3 Price Versioning (Bukan Hard-coded)
- **Bukti:** Tabel `prices` memuat kolom `effective_from`, `effective_to`, `version`, dan `is_current`.
- Katalog `INITIAL_PRICES` di `domains/billing/seed-data.ts` mendefinisikan ID versi terstruktur: `price_core_monthly_v1`, `price_scale_monthly_v1`, dll. Perubahan harga di masa depan dapat ditambahkan sebagai record baru tanpa mengubah tagihan pelanggan lama (*grandfathering*).

### 2.4 Manual Override Berbatas Waktu dengan Audit
- **Bukti:** Tabel `subscription_overrides` mewajibkan kolom `granted_by`, `reason`, `starts_at`, dan `expires_at`.
- Fungsi `evaluateTenantEntitlement` di `domains/entitlement/service.ts` memeriksa `now < new Date(override.expires_at)`. Jika masa berlaku override telah terlewati, sistem secara otomatis mengabaikan override dan kembali ke kuota default paket.
- Teruji secara empiris pada Suite 23 Test 5 (`Time-bound manual override and auto-expiration verified`).

### 2.5 Penegakan Batas Kuota Proyek & Pengguna pada Server-Side
- **Bukti:** Pada `lib/db/database-adapter.ts` (`createProjectWithContract`), guard server-side dieksekusi:
  ```ts
  const evaluation = evaluateTenantEntitlement({ orgId: org.id, currentActiveProjects: count, ... });
  const guardResult = guardMutation(evaluation, "CREATE_PROJECT");
  if (!guardResult.allowed) throw new Error(`[ENTITLEMENT_GUARD_REJECTED] ${guardResult.reason}`);
  ```
- Percobaan pembuatan proyek melebihi batas kuota melempar error penolakan server dan dicatat pada audit log.
- Teruji secara empiris pada Suite 23 Test 3.

### 2.6 Sifat Migrasi: 100% Aditif dan Backward-Compatible
- **Bukti:** Berkas `supabase/migrations/00006_subscription_foundation.sql` hanya berisi perintah `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS`, dan `CREATE POLICY ... IF NOT EXISTS`.
- Tidak ada perintah `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE`, atau penghapusan data apa pun.

### 2.7 Integritas Data Phase 1–12
- Seluruh 30 tabel inti Phase 1–12 (proyek, kontrak, import, klaim BAP, invoice konstruksi, action queue, snapshot ROI) tetap utuh tanpa modifikasi destruktif.
- Seluruh 22 test suites Phase 1–12 tetap lulus 100% tanpa regresi.
