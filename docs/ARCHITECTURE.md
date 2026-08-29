# COVE System Architecture Document

## 1. Executive Summary

**COVE (Construction Operations Value Engine)** is a multi-tenant economic control operating system designed specifically for Indonesian construction contractors. 

Unlike generic project management software that revolves around tasks, schedules, and Gantt charts, COVE centers on the **Progress-to-Cash** economic lifecycle:

```
PROJECT EVENT → ECONOMIC STATE → FINANCIAL EXPOSURE → RESPONSIBLE OWNER → ACTION → VERIFIED OUTCOME
```

---

## 2. Architectural Paradigm: Modular Monolith

COVE V1 is architected as a **Modular Monolith** using Next.js App Router, React 18, TypeScript, and Supabase (PostgreSQL with Row Level Security, Auth, and Storage).

```
                     ┌──────────────────────────────────────┐
                     │            Next.js 14 App            │
                     │          (React / TypeScript)        │
                     └───────────────────┬──────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
      ┌──────────▼──────────┐ ┌──────────▼──────────┐ ┌──────────▼──────────┐
      │   Command Center    │ │   Progress-to-Cash  │ │   Economic Actions  │
      │  Dashboard & Gaps   │ │  Portfolio & Drawer │ │   Priorities/Outcome│
      └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         │
                     ┌───────────────────▼──────────────────┐
                     │       Domain Services Layer          │
                     │  - calculateClaimGaps()              │
                     │  - evaluateClaimRisk()               │
                     │  - transitionClaimStage()            │
                     │  - calculateInvoiceFinancials()      │
                     │  - calculateEvidenceReadiness()      │
                     └───────────────────┬──────────────────┘
                                         │
                     ┌───────────────────▼──────────────────┐
                     │       Supabase / PostgreSQL          │
                     │   Row Level Security (Tenant RLS)    │
                     │       Numeric(20,2) Precision        │
                     └──────────────────────────────────────┘
```

---

## 3. Core Domain Boundaries

1. **`domains/claims/`**: 17 Claim stages, atomic stage transitions, history duration calculations, financial progress tracking.
2. **`domains/gaps/`**: Pure domain math calculating Unmeasured, Unclaimed, Uncertified, Certified Not Invoiced, and Invoiced Not Collected gaps.
3. **`domains/risks/`**: Deterministic Cash-at-Risk categorization (`UNMEASURED_AT_RISK` to `RETENTION_AT_RISK`) with strict non-double-counting.
4. **`domains/actions/`**: Priority scoring algorithm, task assignment, and mandatory financial outcome verification.
5. **`domains/invoices/`**: Gross deductions (Retention 5%, Advance Recovery, Tax), partial payments, and overdue tracking.
6. **`domains/evidence/`**: 11 default evidence requirements and operational readiness percentage scoring.
7. **`domains/freshness/`**: Source metadata classification (`FRESH`, `NEEDS_UPDATE`, `STALE`, `UNKNOWN`).

---

## 4. Multi-Tenant Model

- Every tenant business record contains `organization_id`.
- Project entities also contain `project_id`.
- Access is strictly governed by PostgreSQL Row Level Security (RLS) policies evaluated from authenticated `organization_members`.
