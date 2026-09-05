# COVE PHASE 18R — FINANCIAL INTEGRITY & CONCURRENCY MATRIX

**System Target:** Next.js 16.3.3 LTS | PostgreSQL 15+ (Supabase) | TypeScript 5.0+  
**Audit Standard:** Strict Double-Entry Ledger Protection & Acid Compliance  

---

## 1. Financial Operations & Transaction Boundaries

The following matrix documents the transaction boundaries, concurrency controls, idempotency mechanisms, invariants, and failure policies for all administrative billing operations in COVE:

| Financial Operation | Transaction Boundary & DB Engine | Row Locking (`FOR UPDATE`) | Idempotency Mechanism | Critical Invariants Enforced | Error Recovery & Audit Logging |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Partial / Multi-Payment Processing** | Single atomic PL/pgSQL function: `process_partial_payment_atomic` | Locked on target `billing_invoices` row | `provider_payment_id` unique constraint | Cumulative payments $\ge$ invoice total marks invoice `PAID`; excess quarantined as `OVERPAYMENT` | Automatic rollback on constraint error; overpayment recorded in `reconciliation_queue` |
| **Manual Payment Reconciliation** | Single atomic PL/pgSQL function: `reconcile_payment_atomic` | Locked on both `reconciliation_queue` and `billing_invoices` rows | Handled via row status check; second caller gets 409 Conflict | `applied_amount <= unapplied_amount`; item cannot be re-applied if `RESOLVED` | Concurrent collisions return 409 Conflict; creates immutable audit log |
| **Payment Unapply / Rollback** | Single atomic PL/pgSQL function: `unapply_payment_atomic` | Locked on `reconciliation_queue` row | State verification: requires `applied_amount > 0` | Invoice total recalculated; if balance deficit, invoice reverts `PAID` $\rightarrow$ `PENDING` | Never produces negative balances; records before/after state in audit log |
| **Full Refund** | Domain Service + Multi-table Transaction | Locked on `payments` and `billing_invoices` | `provider_refund_id` and idempotency key | $\sum \text{Refunds} \le \text{Settled Payment Amount}$; invoice becomes `REFUNDED`; subscription `CANCELLED` | If provider fails, DB updates do not commit; creates `admin_audit_logs` record |
| **Partial Refund** | Domain Service + Multi-table Transaction | Locked on `payments` and `billing_invoices` | `provider_refund_id` and idempotency key | $\sum \text{Refunds} \le \text{Settled Payment Amount}$; invoice remains `PAID` if threshold met | Excess refund throws HTTP 400; maintains non-negative net revenue |
| **Chargeback / Dispute Opened** | Domain Service + Multi-table Transaction | Locked on `payments` row | Dispute ID / Webhook Event ID | Puts subscription in `READ_ONLY` mode to protect data while halting entitlement leaks | Anomaly quarantined to `reconciliation_queue` with status `CHARGEBACK` |
| **Dispute Won** | Domain Service + Multi-table Transaction | Locked on `payments` and `billing_invoices` | Gateway Resolution ID | Reverts invoice to `PAID`, restores revenue impact, restores subscription to `ACTIVE` | Re-checks payment balances; logs before/after state in audit log |
| **Dispute Lost / Reversal** | Domain Service + Multi-table Transaction | Locked on `payments` and `billing_invoices` | Gateway Resolution ID | Permanently marks invoice `REFUNDED` and cancels subscription (`CANCELLED`) | Invariant checks prevent duplicate debit; logged to audit trail |
| **Manual Subscription Override** | Single atomic SQL statement with partial unique index | Guarded by partial unique index `uq_active_manual_override_per_type` | Enforced at DB level by index | `expires_at > NOW()`; reason length $\ge 5$; only 1 active override per type | Duplicate active override rejected by Postgres unique constraint; audit logged |
| **Override Revocation** | Update statement with timestamp | Target override row locked | Idempotent flag `is_revoked = true` | Immediate effect on `evaluateTenantEntitlement` without cache lag | Tenant access immediately falls back to base plan; audit logged |
| **Webhook Reprocessing** | Admin API Endpoint | Row lock on `webhook_events` | Webhook ID deduplication | Reprocess allowed **ONLY** for `FAILED` or `RETRYABLE` events | `PROCESSED` events strictly rejected with HTTP 400; audit logged |
| **SaaS Metrics Snapshot** | Upsert procedure with ON CONFLICT | Managed by PostgreSQL unique constraint | `UNIQUE (period_type, snapshot_date, formula_version, currency)` | GRR bounded $\le 100\%$; deterministic zero-denominator handling; MRR bridge balanced | Subsequent runs on same date are idempotent; locked snapshots reject overwrite |

---

## 2. Invariant Verification Formal Equations

### Invariant 1: Non-Negative Balances
$$\forall \text{ item} \in \text{reconciliation\_queue}: \text{unapplied\_amount} \ge 0 \land \text{applied\_amount} \ge 0$$
$$\text{applied\_amount} + \text{unapplied\_amount} = \text{total\_amount}$$

### Invariant 2: Cumulative Refund Limit
$$\sum_{i=1}^{n} \text{RefundAmount}_i \le \text{PaymentSettledAmount}$$
Any transaction requesting $\text{RefundAmount}_{n+1}$ such that:
$$\sum_{i=1}^{n+1} \text{RefundAmount}_i > \text{PaymentSettledAmount}$$
is aborted with exception `CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT` (SQLSTATE `P0006` or HTTP 400).

### Invariant 3: Overpayment Isolation
When $\text{CumulativePaid} > \text{InvoiceAmountDue}$:
$$\text{AppliedAmount} = \text{InvoiceAmountDue}$$
$$\text{QuarantinedExcess} = \text{CumulativePaid} - \text{InvoiceAmountDue}$$
Excess is inserted into `reconciliation_queue` with status `OVERPAYMENT` and is **never** used to artificially extend subscription period boundaries.

### Invariant 4: SaaS MRR Bridge Balance
$$\text{Ending MRR} = \text{Beginning MRR} + \text{New MRR} + \text{Expansion MRR} + \text{Reactivation MRR} - \text{Contraction MRR} - \text{Churned MRR}$$

### Invariant 5: Gross Revenue Retention Upper Bound
$$\text{GRR} = \min\left(1.0, \max\left(0.0, \frac{\text{Beginning MRR} - \text{Contraction MRR} - \text{Churned MRR}}{\text{Beginning MRR}}\right)\right)$$
If $\text{Beginning MRR} = 0$, $\text{GRR} = 1.0$ (deterministic, no `NaN` or `Infinity`).

---

## 3. Immutability & Security Boundary Specifications

1. **Trigger Enforcement on Audit Trail:**
   `public.admin_audit_logs` is protected by database trigger `trg_admin_audit_logs_immutable`.
   - `UPDATE` statements raise exception `P0001`.
   - `DELETE` statements raise exception `P0001`.
   - Table permissions are restricted: `REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC, anon;`.

2. **Search Path Hardening on Definer Procedures:**
   All Phase 18R procedures specify `SET search_path = ''` to prevent search path injection and privilege escalation. Schema entities are referenced via explicit `public.` or `pg_catalog.` qualification.

3. **Key Isolation in Client Bundles:**
   Zero references to `SUPABASE_SERVICE_ROLE_KEY` or `CRON_SECRET` in client JavaScript artifacts or components, enforced by automated static bundle scanner `scripts/scan-client-bundle-secrets.js`.
