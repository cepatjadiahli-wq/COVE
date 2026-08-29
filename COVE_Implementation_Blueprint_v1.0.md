# COVE
## Construction Operations Value Engine
### Implementation Blueprint v1.0

**Status:** Build Specification  
**Target Release:** First Sellable Experimental MVP  
**Primary Workflow:** Progress-to-Cash  
**Core Loop:** MONEY → RISK → ACTION → OUTCOME  
**Default Timezone:** Asia/Jakarta  
**Default Currency:** IDR  
**Architecture:** Multi-Tenant Modular Monolith

---

# 1. Purpose

Dokumen ini menerjemahkan PRD COVE menjadi spesifikasi implementasi untuk pembangunan menggunakan Antigravity.

COVE v1 harus mampu menjalankan dua alur yang saling terhubung:

```text
ORGANIZATION
→ PROJECT
→ CONTRACT
→ CLAIM
→ MEASUREMENT
→ SUBMISSION
→ CERTIFICATION
→ INVOICE
→ CASH RECEIPT
```

serta:

```text
ECONOMIC EXPOSURE
→ BLOCKER
→ RESPONSIBLE OWNER
→ ACTION
→ RESOLUTION
→ FINANCIAL OUTCOME
```

---

# 2. V1 Product Boundary

## Foundation

- Authentication
- Organization
- Membership
- Role & Permission
- Client
- Project
- Contract

## Progress-to-Cash

- Claim
- Claim Stage
- Stage History
- Evidence
- Blocker
- Invoice
- Cash Receipt
- Retention

## Economic Control

- Value Gap
- Stage Aging
- Cash-at-Risk
- Risk Reason
- Risk Level
- Action Engine
- Action Outcome

## Management

- Command Center
- Project Economic Overview
- Progress-to-Cash Portfolio
- Reports

## Adoption

- CSV/XLSX Import
- CSV/XLSX Export
- In-App Notification
- Email Notification
- Feedback
- Audit Trail
- Product Analytics
- Data Freshness

---

# 3. Outside V1

Do not implement production-grade versions of:

- 13-week Project Cash
- Commitment-at-Risk
- Change-at-Risk
- Margin-at-Risk
- full procurement workflow
- ERP integrations
- accounting integrations
- WhatsApp integration
- AI
- predictive analytics

Architecture may reserve clean future module boundaries, but these features must not delay V1.

---

# 4. Technical Architecture

## Frontend

- Next.js
- React
- TypeScript
- Next.js App Router
- Tailwind CSS
- shadcn/ui

## Backend

Use Next.js server-side application layer.

Recommended:

- Server Components for server-first reads;
- Server Actions for controlled authenticated mutations;
- Route Handlers for bulk imports, exports, integrations, future webhooks, and explicit API surfaces.

## Database

PostgreSQL through Supabase.

## Authentication

Supabase Auth.

V1:

- Email
- Password
- Forgot/reset password

## Authorization

Use both:

1. application-level authorization; and
2. PostgreSQL Row Level Security.

Never rely only on hidden buttons or frontend checks.

## Storage

Supabase Storage.

## Hosting

Vercel.

## Architectural Style

# MODULAR MONOLITH

Do not use microservices in V1.

---

# 5. Suggested Domain Structure

```text
src/
  app/
  components/
  domains/
    auth/
    organizations/
    members/
    clients/
    projects/
    contracts/
    claims/
    evidence/
    blockers/
    invoices/
    collections/
    retentions/
    risks/
    actions/
    reports/
    imports/
    notifications/
    feedback/
    analytics/
    audit/
    settings/
  lib/
  types/
```

Future domains:

```text
cash/
commitments/
changes/
margin/
intelligence/
integrations/
```

Business logic must live in domains/services, not directly inside UI components.

---

# 6. Multi-Tenancy

Primary tenant:

`organization`

Every tenant business row must contain:

`organization_id`

Every project-level record must additionally contain:

`project_id`

Tenant identity must be derived and validated server-side from authenticated membership.

Never trust an arbitrary `organization_id` submitted by the client.

---

# 7. Identifier Strategy

Use UUID as database primary key.

Examples:

```text
organization_id UUID
project_id UUID
claim_id UUID
invoice_id UUID
action_id UUID
```

Create separate human-readable identifiers:

```text
PRJ-001
CLM-2026-006
INV-2026-018
ACT-0045
```

UUID is canonical key.

Human-readable code is presentation/business reference.

---

# 8. Financial Data Rules

All monetary columns use PostgreSQL:

```text
numeric(20,2)
```

Do not use floating-point types for money.

Store currency code with financial records where applicable.

Default:

`IDR`

Financial calculations must be implemented in domain services/functions and tested independently.

---

# 9. Standard Audit Fields

Most business entities should include:

```text
id
organization_id
created_at
created_by
updated_at
updated_by
deleted_at
```

Project entities additionally:

`project_id`

Use soft deletion for critical financial/control records.

---

# 10. Table: organizations

```text
id uuid pk
name text not null
legal_name text
business_type text
email text
phone text
website text
address text
city text
province text
country text default 'Indonesia'
default_currency text default 'IDR'
timezone text default 'Asia/Jakarta'
logo_url text
subscription_status text
created_at timestamptz
updated_at timestamptz
```

Subscription status:

```text
trial
active
suspended
cancelled
```

---

# 11. Table: profiles

Supabase Auth remains identity source.

Application profile:

```text
id uuid pk
auth_user_id uuid unique not null
full_name text
email text
phone text
avatar_url text
created_at timestamptz
updated_at timestamptz
```

Never store or duplicate password hashes manually.

---

# 12. Table: organization_members

```text
id uuid pk
organization_id uuid fk
user_id uuid fk
role text
job_title text
status text
invited_at timestamptz
joined_at timestamptz
created_at timestamptz
updated_at timestamptz
```

Status:

```text
invited
active
disabled
```

---

# 13. Role Enum

```text
OWNER
ADMIN
COMMERCIAL_MANAGER
QS
FINANCE_MANAGER
PROJECT_MANAGER
PROJECT_CONTROL
PROCUREMENT
VIEWER
```

Role labels shown to UI can be localized.

Do not make display labels part of business logic.

---

# 14. Table: project_members

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
user_id uuid fk
project_role text
access_level text
created_at timestamptz
```

Access level:

```text
read
edit
manage
```

Owner/Admin may have organization-wide access.

Other roles may be project restricted.

---

# 15. Permission Matrix

## OWNER

Can:

- view all authorized portfolio projects;
- view economic exposure;
- view reports;
- view/create actions;
- view management summaries.

Cannot by default:

- change technical security configuration.

## ADMIN

Can:

- manage organization;
- manage members;
- manage project access;
- manage master settings;
- perform imports/exports.

## COMMERCIAL_MANAGER

Can:

- create/edit claims;
- transition claims;
- manage evidence;
- manage blockers;
- manage actions;
- read invoice/collection data;
- access commercial reports.

## QS

Can:

- create/edit assigned project claims;
- edit measurements/valuations;
- manage claim evidence;
- create blockers;
- manage assigned actions;
- read related invoices.

## FINANCE_MANAGER

Can:

- read claims;
- create/edit invoices;
- record cash receipts;
- update expected payment dates;
- manage finance blockers/actions;
- access finance reports.

## PROJECT_MANAGER

Can:

- read project financial state;
- view claims/invoices;
- manage project blockers/actions where permitted.

## PROJECT_CONTROL

Can:

- view economic analytics;
- view claims and project reports;
- manage actions where permitted.

## PROCUREMENT

V1:

- project read access.

Reserved for P1 commitment permissions.

## VIEWER

Read-only.

---

# 16. Table: clients

```text
id uuid pk
organization_id uuid fk
client_code text
name text not null
legal_name text
client_type text
email text
phone text
address text
notes text
created_at timestamptz
updated_at timestamptz
```

---

# 17. Table: projects

```text
id uuid pk
organization_id uuid fk
client_id uuid fk
project_code text
project_name text not null
description text
project_type text
location text
city text
province text
contract_start_date date
contract_finish_date date
forecast_finish_date date
currency_code text default 'IDR'
status text
project_manager_id uuid
commercial_manager_id uuid
finance_owner_id uuid
project_controller_id uuid
created_at timestamptz
created_by uuid
updated_at timestamptz
updated_by uuid
deleted_at timestamptz
```

Status:

```text
draft
active
on_hold
completed
closed
cancelled
```

Recommended unique constraint:

`organization_id + project_code`

---

# 18. Table: contracts

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
contract_number text
contract_title text
original_contract_value numeric(20,2)
current_contract_value numeric(20,2)
payment_method text
payment_term_days integer
retention_percent numeric(8,4)
advance_payment_amount numeric(20,2)
advance_recovery_amount numeric(20,2)
currency_code text default 'IDR'
effective_date date
start_date date
completion_date date
status text
notes text
created_at timestamptz
updated_at timestamptz
```

Status:

```text
draft
active
completed
terminated
cancelled
```

---

# 19. Table: claims

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
contract_id uuid fk
claim_number text
period_start date
period_end date
description text
current_stage text
risk_level text

work_performed_value numeric(20,2) default 0
measured_value numeric(20,2) default 0
claimed_value numeric(20,2) default 0
certified_value numeric(20,2) default 0
expected_net_collectible numeric(20,2) default 0
cash_received_value numeric(20,2) default 0

expected_cash_date date
current_stage_entered_at timestamptz
responsible_owner_id uuid

source_type text
source_reference text
source_updated_at timestamptz

created_at timestamptz
created_by uuid
updated_at timestamptz
updated_by uuid
deleted_at timestamptz
```

Recommended unique constraint:

`organization_id + project_id + claim_number`

---

# 20. Claim Stage Enum

```text
WORK_RECORDED
MEASUREMENT
CLAIM_PREPARATION
CLAIM_READY
SUBMITTED
UNDER_REVIEW
CERTIFIED
INVOICE_READY
INVOICE_ISSUED
INVOICE_ACCEPTED
DUE
PARTIALLY_PAID
PAID
ON_HOLD
DISPUTED
REJECTED
CANCELLED
```

Normal stage order:

```text
WORK_RECORDED        1
MEASUREMENT          2
CLAIM_PREPARATION    3
CLAIM_READY          4
SUBMITTED            5
UNDER_REVIEW         6
CERTIFIED            7
INVOICE_READY        8
INVOICE_ISSUED       9
INVOICE_ACCEPTED    10
DUE                 11
PARTIALLY_PAID      12
PAID                13
```

Exceptions:

```text
ON_HOLD
DISPUTED
REJECTED
CANCELLED
```

---

# 21. Table: claim_stage_history

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
claim_id uuid fk
from_stage text
to_stage text
entered_at timestamptz
exited_at timestamptz
duration_hours numeric
changed_by uuid
change_reason text
created_at timestamptz
```

Whenever claim stage changes, transaction must:

1. validate transition;
2. close previous stage-history row;
3. calculate previous duration;
4. create new stage-history row;
5. update claim.current_stage;
6. update claim.current_stage_entered_at;
7. re-evaluate risk;
8. generate required notifications;
9. create audit log.

These steps must be atomic.

---

# 22. Claim Financial Validation

Values cannot be negative.

Normally:

```text
measured_value <= work_performed_value
claimed_value <= measured_value
certified_value <= claimed_value
```

However real project corrections can violate this temporarily.

Therefore:

- show validation warning;
- require override reason;
- record audit event;
- allow authorized user to continue.

Do not silently normalize financial data.

---

# 23. Domain Service: calculateClaimGaps()

Formula:

```text
unmeasured_value = MAX(work_performed - measured, 0)
unclaimed_value = MAX(measured - claimed, 0)
uncertified_value = MAX(claimed - certified, 0)
certified_not_invoiced = MAX(certified - invoice_gross_allocated, 0)
invoiced_not_collected = SUM(invoice_outstanding)
```

Return all components separately.

Do not collapse them into one opaque number.

---

# 24. Open Value vs Cash-at-Risk

Open economic value:

```text
unmeasured
+ unclaimed
+ uncertified
+ certified_not_invoiced
+ invoiced_not_collected
```

Open value is not automatically risk.

Cash-at-Risk requires at least one risk condition.

---

# 25. Table: evidence_requirements

```text
id uuid pk
organization_id uuid fk
project_id uuid nullable
name text
description text
required_by_default boolean
stage_requirement text
active boolean
sort_order integer
```

Default seed requirements:

- Progress Report
- Measurement
- Opname
- Progress Photo
- Supporting Calculation
- QC Document
- Minutes / BA
- Consultant Approval
- Client Approval
- Invoice Supporting Document
- Tax Document

---

# 26. Table: claim_evidence

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
claim_id uuid fk
requirement_id uuid fk
required boolean
status text
owner_id uuid
due_date date
verified_by uuid
verified_at timestamptz
document_id uuid
notes text
created_at timestamptz
updated_at timestamptz
```

Status:

```text
missing
in_progress
uploaded
verified
not_applicable
```

---

# 27. Domain Service: calculateEvidenceReadiness()

Exclude `not_applicable` from denominator.

Recommended calculation:

```text
verified_required_items / total_applicable_required_items * 100
```

Presentation:

```text
0-49   Incomplete
50-79  Needs Attention
80-99  Nearly Ready
100    Ready
```

Evidence readiness is an operational indicator, not a legal statement of contractual validity.

---

# 28. Table: documents

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
entity_type text
entity_id uuid
document_type text
name text
storage_path text
external_url text
mime_type text
file_size bigint
version text
uploaded_by uuid
uploaded_at timestamptz
notes text
```

At least one must exist:

- `storage_path`
- `external_url`

Storage path should follow tenant/project boundary.

---

# 29. Table: blockers

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
entity_type text
entity_id uuid
category text
title text
description text
financial_exposure numeric(20,2)
severity text
controllability text
owner_id uuid
raised_date date
target_resolve_date date
resolved_date date
status text
resolution text
created_by uuid
created_at timestamptz
updated_at timestamptz
```

Blocker status:

```text
open
in_progress
waiting_external
resolved
cancelled
```

Severity:

```text
low
medium
high
critical
```

Controllability:

```text
internal
joint
external
not_software_addressable
```

---

# 30. Default Blocker Categories

```text
measurement_incomplete
supporting_document_incomplete
internal_preparation
consultant_review
client_review
technical_approval
commercial_dispute
quantity_dispute
price_dispute
invoice_administration
tax_administration
payment_scheduling
owner_cash_constraint
external_approval
other
```

Display labels should be human-readable.

---

# 31. Table: invoices

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
claim_id uuid fk
invoice_number text
issue_date date
accepted_date date
due_date date

gross_amount numeric(20,2)
retention_amount numeric(20,2)
advance_recovery_amount numeric(20,2)
tax_amount numeric(20,2)
other_deduction_amount numeric(20,2)
net_receivable_amount numeric(20,2)

cash_received_amount numeric(20,2)
outstanding_amount numeric(20,2)

expected_payment_date date
status text
finance_owner_id uuid

created_at timestamptz
created_by uuid
updated_at timestamptz
updated_by uuid
deleted_at timestamptz
```

Status:

```text
draft
issued
accepted
due
overdue
partially_paid
paid
disputed
cancelled
```

---

# 32. Invoice Calculation

Default net receivable:

```text
net_receivable =
gross_amount
- retention_amount
- advance_recovery_amount
- tax_amount
- other_deduction_amount
```

Do not hard-code Indonesian tax/business deductions beyond configurable/default fields.

Customer contract rules may differ.

---

# 33. Table: cash_receipts

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
invoice_id uuid fk
receipt_number text
payment_date date
amount numeric(20,2)
bank_reference text
notes text
recorded_by uuid
created_at timestamptz
updated_at timestamptz
```

---

# 34. Domain Service: calculateInvoiceOutstanding()

```text
cash_received_amount = SUM(cash_receipts.amount)
outstanding_amount = MAX(net_receivable_amount - cash_received_amount, 0)
```

Automatic payment state:

```text
if outstanding_amount == 0 → paid
if 0 < outstanding_amount < net_receivable_amount → partially_paid
```

Overdue:

```text
if today > due_date
and outstanding_amount > 0
and status not in (disputed, cancelled)
→ overdue
```

---

# 35. Table: retentions

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
claim_id uuid fk
invoice_id uuid fk
amount numeric(20,2)
release_condition text
expected_release_date date
actual_release_date date
status text
notes text
created_at timestamptz
updated_at timestamptz
```

Status:

```text
held
due_soon
due
released
disputed
```

---

# 36. Table: stage_sla_rules

```text
id uuid pk
organization_id uuid fk
stage text
warning_after_days integer
risk_after_days integer
critical_after_days integer
active boolean
```

Example seed values may be provided but must remain configurable.

Stage aging:

`today/current timestamp - current_stage_entered_at`

V1 display in calendar days.

---

# 37. Risk Signals

Domain risk evaluator checks:

```text
stage_sla_breached
active_blocker
evidence_incomplete
invoice_overdue
expected_cash_missed
action_overdue
disputed
on_hold
```

No AI in V1 risk truth.

---

# 38. Cash-at-Risk Definition

Cash-at-Risk is the value located at a specific economic stage that has at least one active risk condition.

Risk categories:

```text
UNMEASURED_AT_RISK
UNCLAIMED_AT_RISK
UNCERTIFIED_AT_RISK
CERTIFIED_NOT_INVOICED_AT_RISK
RECEIVABLE_AT_RISK
RETENTION_AT_RISK
```

The same economic value must never be double counted across risk categories.

---

# 39. Domain Service: evaluateClaimRisk()

Input:

- claim;
- claim stage;
- stage aging;
- SLA rules;
- active blockers;
- evidence readiness;
- invoices;
- expected cash date;
- related open actions.

Output:

```text
risk_level
risk_reasons[]
risk_components[]
total_cash_at_risk
controllable_cash_at_risk
recommended_priority
```

Recommended levels:

```text
HEALTHY
WATCH
AT_RISK
CRITICAL
```

---

# 40. Optional Table: risk_snapshots

Use only as derived/audit/performance representation if useful.

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
entity_type text
entity_id uuid
risk_type text
exposure_amount numeric(20,2)
risk_level text
reasons_json jsonb
calculated_at timestamptz
```

Do not make snapshot canonical financial source.

---

# 41. Table: actions

```text
id uuid pk
organization_id uuid fk
project_id uuid fk
entity_type text
entity_id uuid
risk_type text
financial_exposure numeric(20,2)
title text
description text
owner_id uuid
priority text
status text
created_at timestamptz
created_by uuid
due_date date
resolved_at timestamptz
resolution text
outcome_type text
outcome_value numeric(20,2)
updated_at timestamptz
```

Priority:

```text
low
medium
high
critical
```

Status:

```text
open
in_progress
waiting_external
blocked
resolved
cancelled
```

Outcome type:

```text
cash_released
exposure_reduced
claim_recovered
margin_protected
cost_avoided
risk_accepted
no_financial_outcome
unknown
```

---

# 42. Action Resolution Rule

When action is changed to `resolved`:

Require:

- resolution;
- outcome_type.

Allow optional `outcome_value` for financial outcome.

Never automatically claim causality.

Outcome must be verified/entered by user.

---

# 43. Action Priority Engine

Initial deterministic priority should consider:

- financial exposure;
- related risk severity;
- aging;
- due-date urgency;
- overdue status.

User may override priority if authorized.

Override requires audit reason.

---

# 44. Core Domain Services

Mandatory service/function boundaries:

```text
calculateClaimGaps()
calculateEvidenceReadiness()
calculateInvoiceOutstanding()
evaluateFreshness()
evaluateClaimRisk()
calculateCashAtRisk()
transitionClaimStage()
recordCashReceipt()
resolveAction()
```

Do not calculate financial truth directly inside React components.

---

# 45. Single Source of Truth Rules

Do not maintain manually editable duplicates of:

- invoice outstanding;
- cash received totals;
- stage aging;
- evidence readiness percentage;
- derived Cash-at-Risk.

Derived values must come from one authoritative calculation path.

---

# 46. Transaction Requirements

Use atomic database transactions for:

## Claim Stage Transition

- stage validation;
- old history closure;
- new history creation;
- claim stage update;
- risk refresh;
- audit event.

## Cash Receipt

- create receipt;
- recalculate received amount;
- recalculate outstanding;
- update invoice status;
- refresh risk;
- audit event.

## Action Resolution

- action update;
- outcome record;
- audit event;
- risk refresh if relevant.

## Import Commit

- validate rows;
- create/update selected valid rows;
- preserve error records;
- import summary.

---

# 47. Command Center Route

`/dashboard`

## Header

- Organization name
- Portfolio/project filter
- Data freshness indicator
- Add Claim CTA
- Import Data CTA

## KPI Cards

- Cash at Risk
- Pre-Invoice Exposure
- Overdue Receivables
- Expected Collection 30 Days

Each KPI must provide:

- value;
- affected-record count;
- freshness;
- click-through filter.

## Money Pipeline

```text
Work Performed
→ Measured
→ Claimed
→ Certified
→ Invoiced
→ Collected
```

Each stage displays aggregate Rupiah.

Each gap is visible.

## Top Actions Today

Columns:

- Priority
- Project
- Issue
- Exposure
- Owner
- Due
- Status

Sort:

1. Critical
2. Financial exposure
3. Due urgency

## Projects Requiring Attention

Columns:

- Project
- Cash-at-Risk
- Largest Exposure
- Largest Blocker
- Open Actions
- Expected Collection
- Freshness
- Risk

## Expected Collection

- Next 7 Days
- Next 30 Days
- Next 60 Days
- Next 90 Days

P0 uses stored expected payment date, not ML.

---

# 48. Projects Route

`/projects`

Filters:

- search;
- client;
- status;
- project manager;
- risk.

Columns:

- Project Code
- Project Name
- Client
- Contract Value
- Cash-at-Risk
- Outstanding
- Expected Collection
- Open Actions
- Risk
- Freshness

CTA:

`New Project`

---

# 49. Project Detail Route

`/projects/[id]`

Header:

- Project Name
- Project Code
- Client
- Status

KPI:

- Contract Value
- Certified
- Invoiced
- Collected
- Outstanding
- Cash-at-Risk

Sections:

- Money Pipeline
- Top Blockers
- Open Actions
- Claim Aging
- Recent Activity

V1 tabs:

- Overview
- Progress-to-Cash
- Actions
- Documents
- Activity

---

# 50. Progress-to-Cash Route

`/progress-to-cash`

Columns:

- Project
- Claim
- Period
- Current Stage
- Stage Aging
- Work Value
- Measured Value
- Claimed Value
- Certified Value
- Outstanding Exposure
- Evidence %
- Blocker
- Owner
- Expected Cash
- Risk

Filters:

- Project
- Client
- Stage
- Risk
- Owner
- Aging
- Evidence readiness
- Expected cash date

---

# 51. Claim Detail UI

May use page or wide detail drawer depending UX.

Required sections:

## Summary

- claim number;
- project;
- period;
- stage;
- stage aging;
- risk;
- owner;
- expected cash.

## Economic Pipeline

- Work
- Measured
- Claimed
- Certified
- Invoiced
- Collected

## Timeline

Full claim stage history.

## Evidence

Checklist + documents.

## Blockers

Open and resolved blockers.

## Invoice

Related invoices.

## Actions

Related actions.

## Activity

Audit/activity stream.

Primary CTAs:

- Change Stage
- Add Evidence
- Add Blocker
- Create Action
- Create Invoice

---

# 52. Create Claim UX

Recommended wizard:

## Step 1 — Context

- Project
- Contract
- Claim Number
- Period
- Description

## Step 2 — Economic Values

- Work Performed
- Measured
- Claimed
- Certified

## Step 3 — Status

- Current Stage
- Stage Date
- Expected Cash Date

## Step 4 — Evidence

Apply default evidence template.

## Step 5 — Ownership

- Responsible Owner
- Notes

Do not require every optional field before first save.

---

# 53. Add Blocker UX

From Claim/Invoice:

`Add Blocker`

Fields:

- Category
- Title
- Description
- Financial Exposure
- Controllability
- Severity
- Owner
- Target Resolve Date

After save, offer CTA:

`Create Action`

---

# 54. Actions Route

`/actions`

Views:

- My Actions
- All Actions
- Overdue
- Critical
- Resolved

Columns:

- Priority
- Action
- Project
- Source
- Financial Exposure
- Owner
- Due
- Status
- Outcome

COVE must not become a generic task-management platform.

---

# 55. Reports Route

`/reports`

P0 reports:

- Cash-at-Risk
- Claim Aging
- Certification Aging
- Invoice Aging
- Receivable Aging
- Expected Collection
- Action Aging
- Project Economic Summary

Required report functions:

- filters;
- export;
- generated timestamp;
- data freshness indicator.

---

# 56. Data / Import Route

`/data`

Tabs:

- Imports
- Exports
- Sources

P0 import entities:

- Projects
- Contracts
- Claims
- Invoices
- Cash Receipts

Flow:

```text
Choose Entity
→ Upload XLSX/CSV
→ Map Columns
→ Validate
→ Preview
→ Confirm
→ Import
→ Summary
```

Example result:

```text
120 rows
112 imported
8 failed
```

User must be able to download error rows.

---

# 57. Import Idempotency

Support optional external key:

`source_reference`

If matching source reference already exists, user can choose:

- Update Existing
- Skip
- Create New

Prevent silent duplicate creation.

---

# 58. Data Freshness

Source type enum:

```text
manual
csv_import
xlsx_import
api
integration
system
```

Every source-controlled entity stores:

```text
source_type
source_reference
source_updated_at
```

Freshness:

```text
FRESH         <= 24h
NEEDS_UPDATE  >24h and <=7d
STALE         >7d
UNKNOWN       no valid source timestamp
```

Display source and last update near critical financial KPIs.

---

# 59. Table: notifications

```text
id uuid pk
organization_id uuid fk
user_id uuid fk
type text
entity_type text
entity_id uuid
title text
message text
priority text
read_at timestamptz
created_at timestamptz
```

P0 triggers:

- claim warning SLA;
- claim risk SLA;
- evidence incomplete near submission;
- invoice due soon;
- invoice overdue;
- expected cash missed;
- action due tomorrow;
- action overdue;
- critical blocker.

Avoid duplicate/spam notifications.

---

# 60. Email Notifications

Initially send important/critical alerts only.

Email content must contain:

- Project
- Exposure amount
- Issue
- Owner
- Due date
- Direct application link

---

# 61. Feedback Route

`/feedback`

Also provide global `Send Feedback` shortcut.

Fields:

- Feedback Type
- Current Page
- Project optional
- Description
- Attachment optional

Types:

- Missing Feature
- Workflow Problem
- Bug
- Report Request
- Integration
- Improvement
- Other

Automatically capture:

- user;
- organization;
- current route;
- timestamp;
- app version if available.

---

# 62. Table: audit_logs

```text
id uuid pk
organization_id uuid fk
user_id uuid
entity_type text
entity_id uuid
event_type text
old_values_json jsonb
new_values_json jsonb
source text
created_at timestamptz
```

Audit at minimum:

- financial-value changes;
- stage transitions;
- invoice changes;
- cash receipt changes;
- blocker updates;
- action resolution;
- membership/access changes.

---

# 63. Product Analytics

Track events:

```text
project_created
claim_created
claim_imported
claim_stage_changed
evidence_completed
blocker_created
blocker_resolved
action_created
action_resolved
invoice_created
cash_received
report_exported
feedback_submitted
```

Attach organization/project identifiers where appropriate and permitted.

---

# 64. Value Analytics

Track internal product-value signals:

- Exposure Detected
- Exposure With Action Assigned
- Exposure Resolved
- Cash Released
- Days Accelerated
- Claim Recovered
- Actions Resolved
- Average Stage Aging

North-star direction:

# VALUE UNDER CONTROL

Do not make a single opaque value metric before real customer evidence justifies the formula.

---

# 65. Settings Route

`/settings`

Sections:

- Organization
- Members
- Roles
- Project Access
- Stage SLA
- Evidence Templates
- Notification Preferences
- Data Settings

Future:

- Feature Flags
- Integrations

---

# 66. Feature Flags

Create architecture early.

Suggested flags:

```text
project_cash_enabled
commitments_enabled
changes_enabled
margin_enabled
whatsapp_enabled
ai_enabled
```

V1 defaults:

`false`

for future modules.

---

# 67. Validation Layer

Recommended shared validation library:

Zod or equivalent TypeScript schema validation.

Validation occurs:

1. client-side for user feedback;
2. server-side as authoritative validation;
3. database-level for critical constraints.

---

# 68. Error Handling

Do not expose raw technical errors to user.

Example business error:

> Claim cannot be marked Paid because Rp420,000,000 of related invoice value remains outstanding.

Technical stack traces belong in server logs.

---

# 69. Stage Transition Rules

Normal stages should follow expected lifecycle.

Backward transitions may be allowed only for authorized roles.

Backward transition requires:

- explicit reason;
- audit event.

Example:

`CERTIFIED → UNDER_REVIEW`

requires correction/recertification reason.

---

# 70. Delete / Correction Rules

Critical financial records cannot be silently hard-deleted from normal UI.

Use:

- archive;
- cancel;
- soft delete;
- correction with audit trail.

Cash receipt reversal workflow can be expanded later, but V1 corrections must remain auditable.

---

# 71. RLS Security Requirements

Enable RLS on every exposed tenant business table.

Access principle:

Authenticated user can access a tenant row only if an active `organization_members` membership exists for that organization.

For restricted projects, additionally validate `project_members` or organization-wide role.

RLS is a release blocker, not optional hardening.

---

# 72. Service Role Security

Supabase service-role credential:

- server only;
- never expose to browser;
- never store in client-public environment variables.

---

# 73. Storage Security

Recommended path convention:

```text
organizations/{organization_id}/projects/{project_id}/{entity_type}/{entity_id}/...
```

Storage access must validate organization/project membership.

---

# 74. Mandatory Security Tests

Create Organization A + User A.

Create Organization B + User B.

Verify User A cannot:

- select Organization B rows;
- insert Organization B records;
- update Organization B records;
- delete Organization B records;
- download Organization B files.

Also test:

- disabled member loses access;
- Viewer cannot mutate;
- non-admin cannot perform admin mutations;
- project-restricted users cannot access unauthorized projects.

---

# 75. Database Indexing

Initial useful indexes:

- organization_id
- project_id
- client_id
- current_stage
- risk_level
- responsible_owner_id
- owner_id
- due_date
- expected_cash_date
- invoice status
- claim_id
- invoice_id
- created_at

Add composite indexes after observing actual query patterns.

---

# 76. Performance Strategy

Dashboard financial aggregates must execute server-side/database-side.

Do not download all claims into browser merely to calculate KPIs.

Use:

- SQL aggregations;
- appropriate views/functions;
- pagination;
- server-side filtering;
- caching only where safe;
- lazy loading for heavy sections.

---

# 77. Responsive Behavior

Desktop:

Full functionality.

Tablet:

Full review + moderate data entry.

Mobile priority:

- Command Center
- Claims
- Claim Stage
- Actions
- Evidence Upload
- Notifications

Heavy imports/settings may remain desktop-first.

---

# 78. Design Direction

Brand:

# COVE

Expansion:

Construction Operations Value Engine

Personality:

- premium;
- enterprise;
- financial;
- serious;
- modern;
- calm;
- high trust.

Visual:

- neutral-light background;
- dark navy/charcoal primary;
- restrained muted green/amber/red semantic colors;
- strong modern sans-serif typography;
- financial tables optimized for scanning;
- minimal decorative illustration.

Avoid:

- construction clipart;
- excessive gradients;
- overly playful rounded-card design;
- gamification aesthetics;
- rainbow startup visual language.

---

# 79. Required Reusable UI Components

- Sidebar
- Top Bar
- KPI Card
- Money Display
- Risk Badge
- Stage Badge
- Aging Badge
- Freshness Badge
- Filter Bar
- Search
- Data Table
- Detail Drawer
- Modal
- Confirmation Dialog
- Money Pipeline
- Evidence Checklist
- Activity Timeline
- File Upload Zone
- Action Card
- Empty State
- Loading Skeleton
- Error State

---

# 80. Sidebar

V1:

```text
COVE

Command Center
Projects
Progress to Cash
Actions
Reports
Data
Feedback

Settings
```

Future modules only appear when feature enabled.

---

# 81. Top Bar

Contains:

- organization switcher where permitted;
- global search;
- notifications;
- user menu.

Do not overcrowd.

---

# 82. Global Search

P0 entities:

- Projects
- Claims
- Invoices
- Clients
- Actions

Search result must clearly display entity type.

---

# 83. Demo Seed Organization

Create:

**PT Nusantara Buildindo**

Users:

- Raka Pratama — Director
- Dimas Sucipto — Commercial Manager
- Andi Wijaya — Project QS
- Rani Prameswari — Finance Manager
- Fajar Nugroho — Project Manager

---

# 84. Demo Project

Create:

**Grand Meridian Office Tower**

Client:

PT Meridian Properti Indonesia

Contract value:

Rp48.500.000.000

Payment method:

Monthly Progress

Retention:

5%

---

# 85. Demo Claim

Claim:

`MC-006`

Values:

```text
Work Performed   Rp3,200,000,000
Measured         Rp3,000,000,000
Claimed          Rp2,750,000,000
Certified        Rp2,100,000,000
Invoiced         Rp2,100,000,000
Collected        Rp1,400,000,000
```

Expected calculations:

```text
Unmeasured       Rp200,000,000
Unclaimed        Rp250,000,000
Uncertified      Rp650,000,000
Invoice Outstanding Rp700,000,000
```

---

# 86. Demo Blocker

Related claim:

`MC-006`

Category:

Consultant Review

Description:

Final quantity verification pending consultant approval.

Exposure:

Rp650.000.000

Controllability:

Joint

Owner:

Dimas Sucipto

Severity:

High

---

# 87. Demo Action

Title:

`Escalate final quantity approval`

Exposure:

Rp650.000.000

Owner:

Dimas Sucipto

Priority:

Critical

Expected outcome:

Certification completed.

---

# 88. Demo Portfolio

Create at least four projects:

## Project A
Certification bottleneck.

## Project B
Invoice overdue.

## Project C
Evidence incomplete.

## Project D
Healthy / fully collected.

Dashboard KPIs must be derived from seed records.

Never hard-code demo KPI numbers directly in UI components.

---

# 89. Testing Strategy

Required:

- Unit tests
- Domain/business-rule tests
- Database/RLS tests
- Integration tests
- Critical end-to-end tests

---

# 90. Financial Test Cases

At minimum test:

- zero values;
- very large IDR values;
- negative value rejection;
- partial payment;
- multiple cash receipts;
- retention;
- advance recovery;
- deductions;
- overdue invoice;
- disputed invoice;
- claim correction;
- backward stage transition with reason;
- certified > claimed override;
- expected cash date missed;
- risk double-count prevention.

---

# 91. Critical E2E Test

Test the entire product thesis:

```text
LOGIN
↓
CREATE ORGANIZATION
↓
CREATE PROJECT
↓
CREATE CONTRACT
↓
CREATE CLAIM
↓
ENTER PROGRESS VALUES
↓
MOVE TO UNDER REVIEW
↓
ADD BLOCKER
↓
VERIFY CASH-AT-RISK
↓
CREATE ACTION
↓
MOVE CLAIM TO CERTIFIED
↓
CREATE INVOICE
↓
RECORD PARTIAL RECEIPT
↓
VERIFY OUTSTANDING
↓
RECORD FINAL RECEIPT
↓
VERIFY PAID
↓
RESOLVE ACTION
↓
RECORD FINANCIAL OUTCOME
↓
VERIFY DASHBOARD UPDATE
↓
VERIFY AUDIT HISTORY
```

This must pass before release.

---

# 92. Empty States

Every primary page must have a useful empty state.

Example Progress-to-Cash:

> No claims yet. Add your first progress claim or import existing claim data to start tracking project value from work performed to cash collected.

CTA:

- Add Claim
- Import Claims

Never show an unexplained blank table.

---

# 93. Loading States

Use:

- skeletons;
- button loading states;
- import progress;
- disabled duplicate-submit protection.

Do not leave screens frozen without feedback.

---

# 94. Product Learning Requirement

Every commercial release should enable COVE team to learn:

- which modules get used;
- which stages create the most blockers;
- which economic risks recur;
- which actions are resolved;
- which reports are exported;
- which workflows customers struggle with;
- which features customers request.

Do not collect unnecessary personal data.

---

# 95. Feature Prioritization Guidance

Customer feature request should be evaluated using:

```text
Pain Severity
× Frequency
× Economic Impact
× Customer Count
× Strategic Fit
÷ Implementation Effort
```

This is decision guidance, not mathematical truth.

Do not build a feature only because one user requested it.

---

# 96. First Value Moment

After a customer imports/creates claims, COVE should quickly reveal:

```text
Rp X Pre-Invoice Exposure
Rp Y Overdue Receivables
Rp Z Cash-at-Risk
```

and show:

`Top Actions Requiring Attention`

This is the first-value target.

---

# 97. Release Blockers

Do not release V1 if any of these remain:

- tenant isolation failure;
- RLS bypass;
- inconsistent financial calculations;
- stage history loss;
- cash receipts fail to reconcile invoices;
- Cash-at-Risk double counts values;
- dashboard KPIs hard-coded;
- missing audit trail on critical records;
- imports silently corrupt data;
- demo data does not work;
- critical E2E flow fails.

---

# 98. Implementation Order

## BUILD 01
Repository + environment.

## BUILD 02
Supabase database schema + migrations.

## BUILD 03
Authentication.

## BUILD 04
Organization + tenant context.

## BUILD 05
Users + Roles + RLS.

## BUILD 06
Clients + Projects + Contracts.

## BUILD 07
Claims.

## BUILD 08
Claim Stage Engine + History.

## BUILD 09
Evidence.

## BUILD 10
Blockers.

## BUILD 11
Invoices + Cash Receipts + Retention.

## BUILD 12
Value Gap Engine.

## BUILD 13
Cash-at-Risk Engine.

## BUILD 14
Action Engine.

## BUILD 15
Command Center.

## BUILD 16
Project Economic Overview.

## BUILD 17
Progress-to-Cash Portfolio.

## BUILD 18
Reports.

## BUILD 19
Import / Export.

## BUILD 20
Notifications.

## BUILD 21
Feedback + Product Analytics.

## BUILD 22
Seed / Demo Environment.

## BUILD 23
Security Testing.

## BUILD 24
Financial Testing.

## BUILD 25
End-to-End QA.

Only after BUILD 25:

# FIRST SELLABLE COVE V1

---

# 99. Definition of Done

COVE V1 is complete when:

- Authentication works.
- Multi-tenancy is secure.
- Projects and contracts work.
- Claims work.
- Progress-to-Cash stage workflow works.
- Stage history is preserved.
- Evidence works.
- Blockers work.
- Invoices work.
- Cash receipts reconcile correctly.
- Retention works.
- Value gaps calculate correctly.
- Cash-at-Risk works without double counting.
- Action Engine works.
- Command Center reflects real database state.
- Reports work.
- Import/export works.
- Notifications work.
- Feedback works.
- Audit logging works.
- Seed/demo data works.
- Security tests pass.
- Financial tests pass.
- Critical E2E flow passes.
- No P0 critical defects remain.

---

# 100. Non-Negotiable Implementation Rule

Antigravity must never reinterpret COVE as a generic construction project-management dashboard.

The product architecture must preserve:

# ECONOMIC STATE
→
# FINANCIAL EXPOSURE
→
# RESPONSIBLE OWNER
→
# ACTION
→
# VERIFIED OUTCOME

COVE V1 should be optimized for the full:

# MONEY → RISK → ACTION → OUTCOME

loop.
