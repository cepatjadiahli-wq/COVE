# COVE — Subscription Test Baseline & 26 UAT Roadmap

**Document Version:** 2.0.0 (Post-Phase 16R Remediation)  
**Audit Date:** 4 September 2026  
**Reference Document:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 18) & `docs/COVE_TEST_BASELINE.md`  

---

## 1. Status Baseline Pengujian Saat Ini (26 Test Suites Aktif)

Seluruh 26 test suites yang terdaftar pada `tests/runner.js` telah dieksekusi dan berada dalam status **100% LULUS / PASS**:

| No | Test Suite | File Lokasi | Klasifikasi | Status Terkini |
| :-: | :--- | :--- | :--- | :---: |
| 1 | Value Gap Calculation | `tests/unit/gaps.test.js` | Pure Unit Test | **LULUS (100%)** |
| 2 | Cash-at-Risk Formula | `tests/unit/risk.test.js` | Pure Unit Test | **LULUS (100%)** |
| 3 | Invoices & Receipts | `tests/unit/invoices.test.js` | Pure Unit Test | **LULUS (100%)** |
| 4 | Evidence Readiness | `tests/unit/evidence.test.js` | Pure Unit Test | **LULUS (100%)** |
| 5 | Action Resolution | `tests/unit/actions.test.js` | Pure Unit Test | **LULUS (100%)** |
| 6 | Freshness Aging | `tests/unit/freshness.test.js` | Pure Unit Test | **LULUS (100%)** |
| 7 | Claim Transition State | `tests/integration/claim_transition.test.js` | Integration Test | **LULUS (100%)** |
| 8 | Critical Flow E2E | `tests/e2e/critical_flow.test.js` | Integration Test | **LULUS (100%)** |
| 9 | Multi-Tenant RLS Security | `tests/e2e/rls_security.test.js` | Security Penetration | **LULUS (100%)** |
| 10 | Real Browser E2E | `tests/e2e/browser_cove_journey.spec.js` | Browser & DB E2E | **LULUS (100%)** |
| 11 | Pilot Isolation | `tests/integration/pilot_isolation.test.js` | Pilot Outreach Test | **LULUS (100%)** |
| 12 | RBAC 9 Roles | `tests/unit/rbac_auth.test.js` | Security & Auth Unit | **LULUS (100%)** |
| 13 | Contract Rules v1.0 | `tests/unit/contract_rules.test.js` | Commercial Rules Unit | **LULUS (100%)** |
| 14 | Import Reconciliation Engine | `tests/unit/import_engine.test.js` | Ingestion Unit | **LULUS (100%)** |
| 15 | Value Gap Ledger Math | `tests/unit/value_gap_ledger.test.js` | Financial Ledger Unit | **LULUS (100%)** |
| 16 | Claim Readiness Gatekeeper | `tests/unit/readiness_gate.test.js` | Gatekeeper Unit | **LULUS (100%)** |
| 17 | Action & Escalation Queue | `tests/unit/actions_escalation.test.js` | Resolution Unit | **LULUS (100%)** |
| 18 | Portfolio ROI Ledger | `tests/unit/portfolio_roi.test.js` | Portfolio Unit | **LULUS (100%)** |
| 19 | Usability & ERP Bridge | `tests/unit/platform_usability.test.js` | Usability Unit | **LULUS (100%)** |
| 20 | Onboarding & Entitlement | `tests/unit/onboarding_entitlement.test.js` | Commercial Entitlement | **LULUS (100%)** |
| 21 | Master 18 UAT Scenarios | `tests/integration/uat_18_scenarios.test.js` | Master Integration | **LULUS (100%)** |
| 22 | MVP Definition of Done | `tests/unit/dod_release_readiness.test.js` | Release Readiness Unit | **LULUS (100%)** |
| 23 | Phase 14 Billing Data Model & Entitlement | `tests/unit/subscription_foundation.test.js` | Entitlement & Lifecycle Unit | **LULUS (100%)** |
| 24 | Phase 15 Payment Provider & Webhooks | `tests/unit/payment_provider_webhook.test.js` | Gateway & Webhook Unit | **LULUS (100%)** |
| 25 | Phase 16 Customer Billing Portal & Workflows | `tests/unit/customer_billing_portal.test.js` | Portal & Proration Unit | **LULUS (100%)** |
| 26 | Phase 16R Security & Authorization Remediation | `tests/unit/security_remediation.test.js` | Security & RBAC Unit | **LULUS (100%)** |

---

## 2. Status Penelusuran 26 Skenario UAT Subscription Minimum

Skenario pengujian UAT khusus subscription (Blueprint Bagian 18) telah mulai terverifikasi secara terstruktur pada unit/integration test Phase 14–16R, dengan pemaduan komprehensif master UAT dijadwalkan pada Phase 19:

| No | Kode UAT | Deskripsi Skenario UAT Subscription | Status Terkini | Bukti Verifikasi Eksisting |
| :-: | :--- | :--- | :---: | :--- |
| 1 | **SUB-UAT-01** | Pembayaran berhasil mengaktifkan tenant satu kali | **VERIFIED** | Suite 24 Test 5 (Atomic subscription & snapshot activation) |
| 2 | **SUB-UAT-02** | Redirect success tanpa webhook tidak membuka akses | **VERIFIED** | Suite 24 Test 6 (Eliminasi parameter bypass checkout) |
| 3 | **SUB-UAT-03** | Webhook duplikat tidak membuat subscription ganda | **VERIFIED** | Suite 24 Test 3 (Idempotency deduplication check) |
| 4 | **SUB-UAT-04** | Webhook signature salah ditolak | **VERIFIED** | Suite 24 Test 2 (HTTP 401 on invalid signature) |
| 5 | **SUB-UAT-05** | Nominal pembayaran tidak sesuai masuk exception | **PLANNED** | Scheduled Phase 17/18 (Exception reconciliation queue) |
| 6 | **SUB-UAT-06** | Subscription ACTIVE memberikan entitlement sesuai paket | **VERIFIED** | Suite 23 Test 1 & 2 (Catalog & entitlement evaluation) |
| 7 | **SUB-UAT-07** | Batas kuota proyek aktif ditolak server-side | **VERIFIED** | Suite 23 Test 3 & Suite 26 Test 16 |
| 8 | **SUB-UAT-08** | Batas jumlah pengguna ditolak server-side | **VERIFIED** | Suite 26 Test 23 (User seat quota guard) |
| 9 | **SUB-UAT-09** | Upgrade berhasil menambah entitlement seketika | **VERIFIED** | Suite 25 Test 3 (Proration invoice & quota expansion) |
| 10 | **SUB-UAT-10** | Upgrade gagal mempertahankan entitlement lama | **PLANNED** | Scheduled Phase 17 (Failed upgrade rollback flow) |
| 11 | **SUB-UAT-11** | Downgrade berlaku pada akhir periode berjalan | **VERIFIED** | Suite 25 Test 4 (Downgrade workflow & current period) |
| 12 | **SUB-UAT-12** | Usage berlebih saat downgrade memicu project selection | **VERIFIED** | Suite 25 Test 4 (Project selection & safe archiving) |
| 13 | **SUB-UAT-13** | Cancel at period end tidak memutus akses lebih awal | **VERIFIED** | Suite 25 Test 5 (Active until current period end) |
| 14 | **SUB-UAT-14** | Reactivation memulihkan subscription lama | **VERIFIED** | Suite 25 Test 5 (Reversible reactivation) |
| 15 | **SUB-UAT-15** | Pembayaran gagal memasuki status PAST_DUE | **PLANNED** | Scheduled Phase 17 (Dunning & payment failure handler) |
| 16 | **SUB-UAT-16** | Grace period berakhir memasuki READ_ONLY | **VERIFIED** | Suite 23 Test 2 & Suite 26 Tests 16–23 |
| 17 | **SUB-UAT-17** | READ_ONLY tetap dapat melihat dan mengekspor data | **VERIFIED** | Suite 23 Test 2, Suite 25 Test 6, Suite 26 Test 24 |
| 18 | **SUB-UAT-18** | SUSPENDED tidak dapat memutakhirkan data proyek | **VERIFIED** | Suite 26 Tests 16–23 (Enforced on 10 mutation methods) |
| 19 | **SUB-UAT-19** | Manual override berakhir otomatis saat expiry | **VERIFIED** | Suite 23 Test 5 (Time-bound override expiry) |
| 20 | **SUB-UAT-20** | User lintas tenant tidak dapat membaca metadata billing | **VERIFIED** | Suite 26 Tests 1–12 (Server-side 403 cross-tenant guard) |
| 21 | **SUB-UAT-21** | Anggota biasa (Member) tidak dapat mengubah billing | **VERIFIED** | Suite 26 Tests 3 & 5 (RBAC role verification) |
| 22 | **SUB-UAT-22** | Failed webhook dapat di-retry tanpa duplikasi | **PLANNED** | Scheduled Phase 18 (Admin replay queue) |
| 23 | **SUB-UAT-23** | Reconciliation sweep menemukan missing event | **PLANNED** | Scheduled Phase 18 (Reconciliation scheduler) |
| 24 | **SUB-UAT-24** | Refund tidak menghapus tenant atau data historis | **PLANNED** | Scheduled Phase 18 (Refund workflow) |
| 25 | **SUB-UAT-25** | Alasan pembatalan (*churn reason*) tercatat | **VERIFIED** | Suite 25 Test 5 (Audit log & churn reason captured) |
| 26 | **SUB-UAT-26** | Zero regression pada seluruh 31 fitur Phase 1–12 | **VERIFIED** | Suites 1–22 passed 100% in master runner |
