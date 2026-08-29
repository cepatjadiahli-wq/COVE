# COVE Database Specification & Schema

## 1. Monetary Precision Standards

All financial columns use PostgreSQL:
```sql
NUMERIC(20,2)
```
Floating point (`float`, `double`, `real`) is strictly prohibited to prevent decimal rounding discrepancies in multi-billion IDR contract valuations.

---

## 2. Table Catalog (24+ Core Tables)

1. `organizations`: Tenant root record (subscription status, currency IDR, timezone Asia/Jakarta).
2. `profiles`: User application profiles connected with Supabase Auth.
3. `organization_members`: RBAC mappings across 9 defined roles (`OWNER`, `ADMIN`, `COMMERCIAL_MANAGER`, `QS`, `FINANCE_MANAGER`, `PROJECT_MANAGER`, `PROJECT_CONTROL`, `PROCUREMENT`, `VIEWER`).
4. `project_members`: Scoped project assignments for project-restricted roles.
5. `clients`: Developer / employer master records.
6. `projects`: Construction project master records.
7. `contracts`: Commercial contract agreements, retention %, advance payments.
8. `claims`: Core progress claim economic units (Work Performed, Measured, Claimed, Certified).
9. `claim_stage_history`: Historical log of all stage transitions and duration hours.
10. `evidence_requirements`: Master template of 11 default evidence requirements.
11. `claim_evidence`: Progress claim evidence checklist items and verification status.
12. `documents`: Uploaded files and external document links.
13. `blockers`: Commercial and technical blockers with exposure and controllability.
14. `invoices`: Progress billing invoices with net receivable deductions.
15. `cash_receipts`: Reconciled bank payments and partial collections.
16. `retentions`: Retention holding and release schedule records.
17. `stage_sla_rules`: Configurable stage duration SLA thresholds.
18. `actions`: Financial actions linked to economic risk and blockers.
19. `notifications`: In-app notification queue.
20. `imports`: File import tracking.
21. `import_rows`: Row-level staging and error diagnosis for XLSX/CSV imports.
22. `feedback`: Customer feedback and problem submissions.
23. `feature_requests`: Product learning backlog items.
24. `audit_logs`: Immutable audit trail of critical financial and stage changes.
25. `product_events`: Telemetry event log.

---

## 3. Row Level Security (RLS) Policy Pattern

Every query implicitly joins with `organization_members` for the authenticated user:
```sql
CREATE POLICY "Tenant members can access claims"
ON claims FOR ALL
USING (
    organization_id IN (
        SELECT organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id 
        WHERE p.auth_user_id = auth.uid() 
          AND om.status = 'active'
    )
);
```
