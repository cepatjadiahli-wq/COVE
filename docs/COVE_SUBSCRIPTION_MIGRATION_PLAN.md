# COVE — Subscription Database Architecture & Migration Plan

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Reference Document:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 9, 16)  
**Execution Target:** Dirancang pada Phase 13 $\rightarrow$ Dijalankan pada Phase 14  

---

## 1. Prinsip Migrasi Non-Destruktif (Additive Migration Rules)

Sesuai Aturan Mutlak Phase 13 dan Blueprint Bagian 9, perancangan skema database langganan wajib mematuhi ketentuan berikut:
1. **Additive Only:** Seluruh tabel dan kolom baru bersifat aditif (hanya menambahkan entitas baru). Dilarang menghapus atau mengubah tipe data kolom pada 30 tabel Phase 1–12.
2. **Zero Downtime & Zero Regression:** Tidak boleh merusak relasi foreign key eksisting pada proyek, klaim, kontrak, invoice, atau audit log.
3. **Pemisahan Billing vs Progress-to-Invoice:** Tabel `billing_invoices` (tagihan langganan SaaS dari COVE ke kontraktor) terpisah 100% dari tabel `invoices` (faktur klaim progres fisik dari kontraktor ke pemilik proyek/MK).
4. **Idempotency & Auditability:** Seluruh transaksi webhook dan pembayaran wajib memiliki constraint keunikan (*unique constraint*) untuk menjamin pemrosesan idempotent.
5. **Multi-Tenant Isolation (RLS):** Seluruh tabel baru yang menyimpan data spesifik organisasi wajib menerapkan Row Level Security (RLS) dengan policy berbasis `org_id`.

---

## 2. Klasifikasi Entitas Database (17 Entitas Blueprint)

### 2.1 Tabel Eksisting yang Digunakan Kembali & Diperluas
* **`public.organizations` (Digunakan Kembali):**
  - Kolom eksisting (`id`, `name`, `legal_name`, `subscription_tier`, `subscription_status`, `subscription_expires_at`) tetap dipertahankan untuk menjamin kompatibilitas mundur (*backward compatibility*).
  - Kolom aditif baru yang disiapkan pada Phase 14:
    - `active_subscription_id UUID` (Foreign key ke tabel `subscriptions`, NULLable).
    - `billing_email VARCHAR(255)` (Email kontak khusus penagihan keuangan/direksi).
    - `billing_phone VARCHAR(50)` (Nomor telepon/WhatsApp resmi bagian finance).
    - `npwp_number VARCHAR(50)` (Nomor Pokok Wajib Pajak untuk faktur pajak resmi).
    - `tax_invoice_address TEXT` (Alamat wajib pajak).
* **`public.audit_logs` (Digunakan Kembali):** Tetap menjadi sumber kebenaran umum histori operasional konstruksi.

---

### 2.2 16 Tabel Baru yang Akan Dibangun pada Phase 14

Berikut adalah rancangan DDL 16 entitas penagihan & hak akses:

```sql
-- 1. BILLING CUSTOMERS (Pemetaan Relasi Gateway)
CREATE TABLE IF NOT EXISTS public.billing_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'XENDIT', 'MAYAR', 'MOCK'
    provider_customer_id VARCHAR(150) NOT NULL,
    default_payment_method VARCHAR(50), -- 'VIRTUAL_ACCOUNT', 'CREDIT_CARD', 'DIRECT_DEBIT', 'QRIS'
    payment_method_masked VARCHAR(50), -- misal: 'Mastercard **** 4242'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_billing_customer_provider UNIQUE (org_id, provider)
);

-- 2. PLANS (Katalog Paket)
CREATE TABLE IF NOT EXISTS public.plans (
    id VARCHAR(50) PRIMARY KEY, -- 'b2b_pilot', 'b2b_core', 'b2b_scale', 'b2b_enterprise'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tier_level INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRICES (Versi Harga Bertanggal)
CREATE TABLE IF NOT EXISTS public.prices (
    id VARCHAR(50) PRIMARY KEY, -- misal: 'price_core_monthly_v1', 'price_core_annual_v1'
    plan_id VARCHAR(50) NOT NULL REFERENCES public.plans(id),
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    amount NUMERIC(18, 2) NOT NULL,
    billing_interval VARCHAR(20) NOT NULL, -- 'MONTHLY', 'ANNUAL', 'ONEOFF_45_DAYS'
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ, -- NULL berarti harga saat ini berlaku
    is_current BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PLAN ENTITLEMENTS (Batas Kuota & Fitur Paket)
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id VARCHAR(50) NOT NULL REFERENCES public.plans(id),
    max_active_projects INT NOT NULL DEFAULT 1, -- -1 untuk unlimited
    max_users INT NOT NULL DEFAULT 10, -- -1 untuk unlimited
    import_enabled BOOLEAN NOT NULL DEFAULT true,
    value_gap_ledger_enabled BOOLEAN NOT NULL DEFAULT true,
    claim_readiness_enabled BOOLEAN NOT NULL DEFAULT true,
    action_queue_enabled BOOLEAN NOT NULL DEFAULT true,
    portfolio_review_level VARCHAR(50) NOT NULL DEFAULT 'SINGLE', -- 'SINGLE', 'MULTI_RANKING', 'ENTERPRISE'
    roi_ledger_enabled BOOLEAN NOT NULL DEFAULT true,
    audit_level VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    email_digest_enabled BOOLEAN NOT NULL DEFAULT true,
    export_enabled BOOLEAN NOT NULL DEFAULT true,
    api_enabled BOOLEAN NOT NULL DEFAULT false,
    sso_enabled BOOLEAN NOT NULL DEFAULT false,
    storage_limit_mb INT NOT NULL DEFAULT 15360, -- 15 GB
    support_tier VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SUBSCRIPTIONS (Lifecycle Langganan Perusahaan)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL REFERENCES public.plans(id),
    price_id VARCHAR(50) NOT NULL REFERENCES public.prices(id),
    provider VARCHAR(50) NOT NULL DEFAULT 'XENDIT',
    provider_subscription_id VARCHAR(150),
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING_PAYMENT', 'PILOT_ACTIVE', 'ACTIVE', 'CANCEL_AT_PERIOD_END', 'PAST_DUE', 'READ_ONLY', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'MANUAL_GRANT'
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    churn_reason TEXT,
    grace_period_end TIMESTAMPTZ,
    next_billing_date TIMESTAMPTZ,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SUBSCRIPTION ITEMS (Base Plan + Add-on Proyek)
CREATE TABLE IF NOT EXISTS public.subscription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'BASE_PLAN', 'ACTIVE_PROJECT_ADDON'
    unit_price NUMERIC(18, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SUBSCRIPTION STATUS EVENTS (Histori Transisi Status)
CREATE TABLE IF NOT EXISTS public.subscription_status_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'WEBHOOK', 'CRON', 'ADMIN_OVERRIDE', 'MIGRATION'
    actor_id VARCHAR(100),
    correlation_id VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BILLING INVOICES (Faktur Tagihan SaaS COVE)
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) UNIQUE NOT NULL, -- misal: 'INV-COVE-2026-09-001'
    amount_subtotal NUMERIC(18, 2) NOT NULL,
    discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0, -- PPN 11% / 12%
    amount_total NUMERIC(18, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'DRAFT', 'PENDING', 'PAID', 'VOID', 'FAILED'
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PAYMENTS (Pembayaran Terverifikasi)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id),
    provider VARCHAR(50) NOT NULL,
    provider_payment_id VARCHAR(150) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(18, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCEEDED', -- 'SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'
    paid_at TIMESTAMPTZ NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_payment_provider_id UNIQUE (provider, provider_payment_id)
);

-- 10. PAYMENT ATTEMPTS (Percobaan Penagihan Berhasil/Gagal)
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED', 'PENDING'
    gateway_error_code VARCHAR(100),
    gateway_error_message TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. WEBHOOK EVENTS (Log Event Webhook Idempotent)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(150) NOT NULL, -- ID unik dari gateway
    event_type VARCHAR(100) NOT NULL,
    raw_payload JSONB NOT NULL,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED', 'IGNORED'
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);

-- 12. ENTITLEMENT SNAPSHOTS (Hak Akses Efektif Terkunci)
CREATE TABLE IF NOT EXISTS public.entitlement_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    max_active_projects INT NOT NULL,
    max_users INT NOT NULL,
    features JSONB NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. USAGE RECORDS (Metrik Pemakaian Nyata)
CREATE TABLE IF NOT EXISTS public.usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL, -- 'ACTIVE_PROJECTS', 'ACTIVE_USERS', 'STORAGE_BYTES'
    current_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. SUBSCRIPTION OVERRIDES (Pemberian Akses Manual Terotorisasi)
CREATE TABLE IF NOT EXISTS public.subscription_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    granted_by VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    override_max_projects INT,
    override_features JSONB,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. DISCOUNTS (Aturan Kupon & Diskon Terbatas)
CREATE TABLE IF NOT EXISTS public.discounts (
    id VARCHAR(50) PRIMARY KEY, -- misal: 'EARLY_MEP_2026'
    name VARCHAR(100) NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'PERCENTAGE', 'FIXED_AMOUNT'
    discount_value NUMERIC(18, 2) NOT NULL,
    applicable_plan_id VARCHAR(50) REFERENCES public.plans(id),
    max_redemptions INT,
    current_redemptions INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. BILLING AUDIT LOGS (Histori Forensik Penagihan)
CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    actor_id VARCHAR(100) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id VARCHAR(150) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Rencana Migrasi Data & Backfill Pelanggan Lama (*Data Backfill Plan*)

Untuk organisasi yang sudah ada di basis data (misal: PT Nusantara Buildindo Tbk dan 20 prospek riset pasar riil):
1. **Pendaftaran Paket Default:**
   - Seed data memasukkan 4 entitas `plans` (`b2b_pilot`, `b2b_core`, `b2b_scale`, `b2b_enterprise`) dan 1 paket legacy (`lifetime_799k` untuk backward-compatibility).
2. **Backfill Record Langganan:**
   - Setiap organisasi yang ada di-generate-kan satu record pada tabel `subscriptions`:
     - Jika `customer_stage = 'pilot'` $\rightarrow$ status `PILOT_ACTIVE`, `plan_id = 'b2b_pilot'`.
     - Jika `customer_stage = 'active_customer'` $\rightarrow$ status `ACTIVE`, `plan_id = 'b2b_core'`.
   - Menghubungkan `organizations.active_subscription_id` ke record subscription baru tersebut.
3. **Pencatatan Item Langganan Awal:**
   - Menghitung jumlah proyek aktif riil setiap organisasi dan membuat record `subscription_items` yang sesuai.

---

## 4. Strategi Rollback (Rollback Plan)

Jika pada pengujian Phase 14 ditemukan kendala atau kegagalan skema:
1. Skema ini bersifat aditif murni sehingga **data 30 tabel Phase 1–12 sama sekali tidak tersentuh**.
2. Rollback script cukup melakukan drop pada 16 tabel baru dengan urutan pembalikan foreign key (*reverse topological order*):
   ```sql
   DROP TABLE IF EXISTS public.billing_audit_logs;
   DROP TABLE IF EXISTS public.discounts;
   DROP TABLE IF EXISTS public.subscription_overrides;
   DROP TABLE IF EXISTS public.usage_records;
   DROP TABLE IF EXISTS public.entitlement_snapshots;
   DROP TABLE IF EXISTS public.webhook_events;
   DROP TABLE IF EXISTS public.payment_attempts;
   DROP TABLE IF EXISTS public.payments;
   DROP TABLE IF EXISTS public.billing_invoices;
   DROP TABLE IF EXISTS public.subscription_status_events;
   DROP TABLE IF EXISTS public.subscription_items;
   DROP TABLE IF EXISTS public.subscriptions;
   DROP TABLE IF EXISTS public.plan_entitlements;
   DROP TABLE IF EXISTS public.prices;
   DROP TABLE IF EXISTS public.plans;
   DROP TABLE IF EXISTS public.billing_customers;
   ```
3. Menghapus kolom tambahan pada tabel `organizations` tanpa menghapus baris data organisasi.
