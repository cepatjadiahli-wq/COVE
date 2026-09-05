# COVE PHASE 18R.1 — USER ACCEPTANCE TEST (UAT) VERIFICATION REPORT

**Execution Timestamp:** 2026-09-05T04:42:00+07:00  
**Status:** **PASS (20/20 Scenarios Verified — 100% Success)**  
**Execution Target:** Local PostgreSQL 15+ Engine (Supabase at `127.0.0.1:54321`)  
**Test Suite File:** `tests/integration/phase18r1_serverless_safety.test.js`  
**Master Test Suite Registration:** Suite 31 of 31 in `tests/runner.js`  

---

## 1. Executive Summary & 20 UAT Scenarios Matrix

Phase 18R.1 enforces serverless and financial safety remediation following the Phase 18R audit. All 20 scenarios passed synchronously and deterministically against the local PostgreSQL test engine.

| # | Scenario Objective | Target Domain / Component | Safety & Concurrency Mechanism | Result |
| :-: | :--- | :--- | :--- | :-: |
| **UAT 1** | Persistent PostgreSQL Idempotency | `admin_idempotency_keys` & Route | Atomic claim/complete stored procedures; replays return cached payload with `isIdempotent: true` | **PASS** |
| **UAT 2** | Idempotency Payload Conflict | `claim_admin_idempotency_key` | Same key + altered payload raises SQLSTATE `P0010` mapped to HTTP 409 Conflict | **PASS** |
| **UAT 3** | Concurrent Refunds Serialization | `payment_refunds` & Trigger | DB trigger row locks payment `FOR UPDATE`; 2x 1.5M on 2.5M payment serializes to 1 PASS, 1 REJECT | **PASS** |
| **UAT 4** | Partial Refund Non-Terminal Status | `refund-service.ts` | Non-exhaustive partial refund retains invoice status as `PAID` | **PASS** |
| **UAT 5** | Cumulative Refund Exhaustion | `refund-service.ts` | Cumulative partial refunds reaching 100% transitions invoice to `REFUNDED` | **PASS** |
| **UAT 6** | Excess Refund Atomic Rejection | Trigger `trg_payment_refunds_limit_check` | Single or cumulative refund exceeding settled payment rejected with HTTP 400 | **PASS** |
| **UAT 7** | Active Period Full Refund | `refund-service.ts` | Full refund of current period invoice sets subscription to `CANCELLED` and writes audit log | **PASS** |
| **UAT 8** | Historical Invoice Refund Entitlement | `refund-service.ts` | Full refund of past cycle invoice preserves current subscription as `ACTIVE` | **PASS** |
| **UAT 9** | Pending/Failed Refund Invariant | `refund-service.ts` | Failed refund rollback leaves revenue, invoice status, and entitlement completely unaltered | **PASS** |
| **UAT 10** | RPC Hardening — Negative Privileges | PostgreSQL Schema (`public`) | Unprivileged roles (`anon`, `authenticated`) denied execution on all financial RPCs | **PASS** |
| **UAT 11** | RPC Hardening — Positive Privileges | PostgreSQL Schema (`public`) | Elevated `service_role` possesses explicit `EXECUTE` privileges on financial RPCs | **PASS** |
| **UAT 12** | Legacy Override Stored Migration | `migrate_legacy_subscription_overrides()` | Stored procedure maps legacy records to canonical schema with structured audit counters | **PASS** |
| **UAT 13** | Legacy Table Read-Only Guard | `trg_subscription_overrides_readonly` | DB trigger intercepts INSERT/UPDATE/DELETE on deprecated table with SQLSTATE `P0009` | **PASS** |
| **UAT 14** | Entitlement Post-Migration Resolution | `evaluateTenantEntitlement` | Migrated canonical overrides resolve correctly during tenant entitlement evaluation | **PASS** |
| **UAT 15** | SaaS Metrics Zero-Denominator Safety | `saas-metrics-engine.ts` | Zero beginning MRR explicitly returns `null` with status `"NOT_APPLICABLE"` | **PASS** |
| **UAT 16** | Mathematical GRR Upper Bound | `saas-metrics-engine.ts` | Expansion MRR excluded from GRR; GRR strictly bounded $\le 1.0$ ($100\%$) | **PASS** |
| **UAT 17** | Multi-Movement MRR Bridge Balance | `simulateMrrMovementBridge` | Exact balancing across all 5 movements (Beginning, New, Expansion, Contraction, Reactivation, Churn) | **PASS** |
| **UAT 18** | Scoped SaaS Metrics Snapshots | `saas_metrics_snapshots` | Persists `scope_type` and `scope_id` enforced by composite unique constraint | **PASS** |
| **UAT 19** | Server-Configured CSRF Defense | Admin Actions API Route | Rejects spoofed Host/Origin with HTTP 403; verifies against server canonical URL | **PASS** |
| **UAT 20** | Client Bundle Secret Scanner | `scan-client-bundle-secrets.js` | Scans literal secrets, audits `NEXT_PUBLIC_*`, distinguishes verified vs unavailable | **PASS** |

---

## 2. Detailed Scenario Execution Breakdown

### UAT 1: Persistent PostgreSQL Idempotency Replay
- **Context & Objective:** Eliminate in-memory deduplication in favor of durable PostgreSQL transaction ledger.
- **Input / Action:** Admin action `CORRECT_BILLING_CONTACT` with `x-idempotency-key: idem_safe_<runId>_1`.
- **Observed Behavior:** First request executed and stored record in `admin_idempotency_keys` with status `SUCCEEDED`. Second identical request returned cached payload with `isIdempotent: true` and HTTP 200 without executing side-effects.
- **Verdict:** PASS.

### UAT 2: Idempotency Payload Conflict Rejection
- **Context & Objective:** Prevent parameter tampering or replay attacks reusing a previous idempotency key.
- **Input / Action:** Same `x-idempotency-key` from UAT 1 submitted with altered body (`newContactEmail: attacker@cove.com`).
- **Observed Behavior:** Database atomic procedure `claim_admin_idempotency_key` detected SHA-256 fingerprint divergence and raised SQLSTATE `P0010`. Route translated error to HTTP 409 Conflict with message `IDEMPOTENCY_PAYLOAD_CONFLICT`.
- **Verdict:** PASS.

### UAT 3: Concurrent Refunds Serialization & Row-Level Lock
- **Context & Objective:** Prevent race condition over-refunds in distributed or multi-instance environments.
- **Preconditions:** Settled payment of Rp 2,500,000.
- **Input / Action:** Two simultaneous async calls to `processRefundOrDispute` for Rp 1,500,000 each ($1.5\text{M} + 1.5\text{M} = 3.0\text{M} > 2.5\text{M}$).
- **Observed Behavior:** Database trigger `trg_payment_refunds_limit_check` acquired row lock `SELECT ... FOR UPDATE` on parent `payments` row. Exactly one refund succeeded (Rp 1,500,000). The second parallel refund was rejected with HTTP 400 (`CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT`). Total refunded in DB: exactly Rp 1,500,000.
- **Verdict:** PASS.

### UAT 4: Partial Refund Leaves Invoice Non-REFUNDED
- **Context & Objective:** Ensure invoices remain `PAID` after non-exhaustive partial refunds.
- **Observed Behavior:** Following the Rp 1,500,000 partial refund on the Rp 2,500,000 invoice, invoice status queried in PostgreSQL remained `PAID`.
- **Verdict:** PASS.

### UAT 5: Cumulative Refund Reaching 100% Settled Amount
- **Context & Objective:** Invoice transitions to `REFUNDED` only when cumulative refunds exhaust the settled payment.
- **Input / Action:** Second partial refund of Rp 1,000,000 applied to the payment from UAT 3 ($1.5\text{M} + 1.0\text{M} = 2.5\text{M}$).
- **Observed Behavior:** Payment balance exhausted; invoice status transitioned to `REFUNDED`.
- **Verdict:** PASS.

### UAT 6: Refund Exceeding Settled Payment Rejected
- **Context & Objective:** Guard against over-refunding when payment balance is zero.
- **Input / Action:** Attempted Rp 100,000 refund on exhausted payment.
- **Observed Behavior:** Database trigger aborted transaction with `CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT` and HTTP 400.
- **Verdict:** PASS.

### UAT 7: Active Period Full Refund Cascades Cancellation
- **Context & Objective:** Refunding the invoice funding the current active cycle cancels tenant access.
- **Preconditions:** Active subscription with current invoice of Rp 2,500,000.
- **Input / Action:** Full refund of Rp 2,500,000 on the current cycle invoice.
- **Observed Behavior:** Invoice marked `REFUNDED`, subscription transitioned to `CANCELLED` with `canceled_at` and `churn_reason` set. `REFUND_ENTITLEMENT_DECISION` audit log captured before/after state.
- **Verdict:** PASS.

### UAT 8: Historical Invoice Refund Preserves Active Subscription
- **Context & Objective:** Refunding a historical past-cycle invoice must not cancel an active subscription when a newer paid invoice funds the current period.
- **Preconditions:** Subscription active with two invoices: Old invoice (60 days ago) and Current invoice (10 days ago, due in 20 days).
- **Input / Action:** Full refund of Rp 2,500,000 on the historical old invoice.
- **Observed Behavior:** Historical invoice marked `REFUNDED`. Subscription status remained `ACTIVE` in PostgreSQL. Audit log confirmed `SUBSCRIPTION_PRESERVED` decision.
- **Verdict:** PASS.

### UAT 9: Pending / Failed Refund Invariant
- **Context & Objective:** Validation failures during refund processing must roll back cleanly.
- **Input / Action:** Attempted refund with invalid empty reason string.
- **Observed Behavior:** Rejected with validation error; zero records added to `payment_refunds`; invoice and subscription untouched.
- **Verdict:** PASS.

### UAT 10: Financial RPC Privilege Revocation (Negative Check)
- **Context & Objective:** Prevent unprivileged API clients from executing financial stored procedures directly.
- **Input / Action:** Invoked `reconcile_payment_atomic` using `anon` Supabase client key.
- **Observed Behavior:** PostgreSQL rejected call with `permission denied for function reconcile_payment_atomic`.
- **Verdict:** PASS.

### UAT 11: Financial RPC Elevated Execution (Positive Check)
- **Context & Objective:** Verify backend service role retains explicit execute privileges.
- **Input / Action:** Invoked `unapply_payment_atomic` using `service_role` key.
- **Observed Behavior:** Call permitted and processed by database engine without permission denial.
- **Verdict:** PASS.

### UAT 12: Legacy Override Stored Procedure Migration
- **Context & Objective:** Migrate legacy `subscription_overrides` to `manual_subscription_overrides`.
- **Input / Action:** Invoked `migrate_legacy_subscription_overrides()`.
- **Observed Behavior:** Returned structured JSON report containing `total_legacy_records`, `migrated`, `duplicate`, `expired`, `invalid`, `failed`, and `migration_timestamp`.
- **Verdict:** PASS.

### UAT 13: Legacy Table Read-Only Enforcement (P0009)
- **Context & Objective:** Ensure no new writes occur on deprecated `subscription_overrides` table.
- **Input / Action:** Direct SQL `INSERT` into `public.subscription_overrides`.
- **Observed Behavior:** Trigger `trg_subscription_overrides_readonly` raised SQLSTATE `P0009` (`SUBSCRIPTION_OVERRIDES_DEPRECATED`).
- **Verdict:** PASS.

### UAT 14: Tenant Entitlement Post-Migration Resolution
- **Context & Objective:** Validate entitlement engine correctly parses migrated overrides.
- **Input / Action:** Invoked `evaluateTenantEntitlement` with migrated `ENTITLEMENT_BOOST` record.
- **Observed Behavior:** Entitlement evaluation returned `allowed: true` with boost limits applied.
- **Verdict:** PASS.

### UAT 15: SaaS Metrics Zero-Denominator Safety
- **Context & Objective:** Avoid reporting deceptive 100% or 1.0 retention rates when opening cohort is zero.
- **Input / Action:** `simulateMrrMovementBridge` with `beginningMrr: 0`.
- **Observed Behavior:** `grossRevenueRetention: null`, `grossRevenueRetentionStatus: "NOT_APPLICABLE"`, `netRevenueRetention: null`, `netRevenueRetentionStatus: "NOT_APPLICABLE"`.
- **Verdict:** PASS.

### UAT 16: Mathematical GRR Upper Bound
- **Context & Objective:** Enforce strict Gross Revenue Retention definition excluding expansion.
- **Input / Action:** Beginning MRR Rp 10M, Expansion MRR Rp 8M (80% expansion), 0 contraction, 0 churn.
- **Observed Behavior:** `grossRevenueRetention = 1.0` (100%), bounded to 1.0; `netRevenueRetention = 1.8` (180%).
- **Verdict:** PASS.

### UAT 17: Multi-Movement MRR Bridge
- **Context & Objective:** Guarantee exact reconciliation across all five SaaS MRR movement categories.
- **Input / Action:** Beginning 100M, New 25M, Expansion 15M, Contraction 5M, Reactivation 5M, Churn 10M.
- **Observed Behavior:** Ending MRR computed to exactly 130,000,000 IDR; `isBalanced = true`, `delta = 0`.
- **Verdict:** PASS.

### UAT 18: Scoped Metrics Snapshots
- **Context & Objective:** Prevent snapshot collisions between platform-wide and tenant/cohort scoped calculations.
- **Input / Action:** Created snapshot specifying `scope_type: "PLATFORM"` and `scope_id: "GLOBAL"`.
- **Observed Behavior:** Persisted in `saas_metrics_snapshots` with composite unique constraint enforced.
- **Verdict:** PASS.

### UAT 19: Server-Configured CSRF Defense
- **Context & Objective:** Protect admin mutation routes against origin spoofing and header tampering.
- **Input / Action:** Tested: (a) Malicious origin `https://evil-attacker.com` -> rejected HTTP 403; (b) Missing origin under enforcement -> rejected HTTP 403; (c) Valid origin matching `APP_CANONICAL_URL` -> accepted HTTP 200.
- **Verdict:** PASS.

### UAT 20: Client Bundle Secret Scanner Integrity
- **Context & Objective:** Comprehensive static audit of client JavaScript and source files.
- **Input / Action:** Executed `scan-client-bundle-secrets.js`.
- **Observed Behavior:** 105 files scanned. 0 forbidden environment variables in client files. Secrets categorized accurately as `SECRET_VALUE_SCANNED_AND_NOT_FOUND` or `SECRET_ENV_NOT_AVAILABLE`.
- **Verdict:** PASS.

---

## 3. Test Runner & Quality Gate Verification

### 3.1 Suite 31 Execution Output
```
Command: node tests/integration/phase18r1_serverless_safety.test.js
Result: 20/20 Scenarios Passed (100% Success)
Exit Code: 0
```

### 3.2 Master Test Runner (All 31 Suites)
```
Command: node tests/runner.js
Summary: 31 Passed, 0 Failed out of 31 Suites
Status: PASS — ALL QUALITY GATES VERIFIED
```

### 3.3 Database Unit Tests (pgTAP)
```
Command: npx supabase test db
Files: 5 (01, 02, 03, 04, 05)
Total Tests: 97
Result: ok (100% PASS)
```

---

## 4. Conclusion & Handover Recommendation

All 20 UAT scenarios in Phase 18R.1 have been executed against the local PostgreSQL test engine and verified. No financial leakage, concurrency race conditions, privilege bypasses, or telemetry distortions were observed.

$$\mathbf{PHASE\;18R.1\;UAT\;VERDICT:\;PASS\;(20/20)}$$
