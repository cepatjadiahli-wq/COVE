# COVE Testing Strategy & QA Report

## 1. Test Architecture Overview

COVE employs a multi-tiered test suite:
- **Unit Tests**: Pure domain logic and calculations (`gaps`, `risk`, `invoices`, `evidence`, `actions`, `freshness`).
- **Integration Tests**: Stateful transitions (`claim_transition`, `cash_receipt_reconciliation`).
- **E2E Critical User Journey**: Simulates the complete 21-step product loop.
- **E2E RLS Security Tests**: Verifies tenant isolation and RBAC mutation enforcement.

---

## 2. Test Execution Command

Run all test suites locally:
```bash
npm test
# or: node tests/runner.js
```

---

## 3. Test Suites Catalog

| Test Suite | File | Focus Area |
| :--- | :--- | :--- |
| **Value Gap Engine** | `tests/unit/gaps.test.js` | 5 Gap formulas, negative clamping, large IDR values |
| **Cash-at-Risk Engine** | `tests/unit/risk.test.js` | Deterministic SLA signals, non-double-counting |
| **Invoice & Cash Reconciliation** | `tests/unit/invoices.test.js` | Net receivable, deductions, partial receipts, overdue |
| **Evidence Readiness** | `tests/unit/evidence.test.js` | 4 threshold bands, N/A exclusion |
| **Action Prioritization** | `tests/unit/actions.test.js` | Exposure & urgency scoring algorithms |
| **Data Freshness** | `tests/unit/freshness.test.js` | Source timestamp categorizations |
| **Claim Stage Transition** | `tests/integration/claim_transition.test.js` | Atomic transitions, duration, override justification |
| **Critical User Flow (E2E)** | `tests/e2e/critical_flow.test.js` | 21-step complete thesis validation |
| **Multi-Tenant RLS Security** | `tests/e2e/rls_security.test.js` | Cross-tenant isolation & Viewer mutation block |
