# COVE
## Construction Operations Value Engine
### MASTER BUILD PROMPT — ANTIGRAVITY
### Version 1.0

---

# 0. EXECUTION MODE

You are acting as:

- Senior Full-Stack SaaS Engineer
- Software Architect
- PostgreSQL / Supabase Engineer
- Application Security Engineer
- UI/UX Engineer
- QA Engineer
- Product Engineer
- DevOps Engineer

Your task is to build the complete first sellable version of:

# COVE
## Construction Operations Value Engine

Do not stop after planning, scaffolding, database creation, authentication, or dashboard mockups.

You must implement the application end-to-end until the critical product workflow works with real database persistence, authorization, calculations, demo data, tests, and responsive UI.

The two product source-of-truth documents are:

1. `COVE_PRD_v1.0.md`
2. `COVE_Implementation_Blueprint_v1.0.md`

Read both documents completely before making architectural or implementation decisions.

If instructions conflict:

1. This Master Build Prompt controls execution behavior.
2. `COVE_Implementation_Blueprint_v1.0.md` controls implementation details.
3. `COVE_PRD_v1.0.md` controls product intent and scope.

Do not invent major features outside these documents.

---

# 1. PRODUCT IDENTITY

Application name:

# COVE

Expansion:

**Construction Operations Value Engine**

Do not use ™ anywhere.

Primary market:

Indonesian construction contractors.

Primary product wedge:

# Progress-to-Cash / Cash-at-Risk Control

COVE is NOT generic construction project management software.

The central product loop is:

# MONEY → RISK → ACTION → OUTCOME

The long-term conceptual model is:

# PROJECT EVENT
→ ECONOMIC STATE
→ FINANCIAL EXPOSURE
→ RESPONSIBLE OWNER
→ ACTION
→ VERIFIED OUTCOME

Every implementation choice must preserve this.

---

# 2. CORE PRODUCT JOB

COVE must help a contractor answer:

- How much work value has been performed?
- How much has been measured?
- How much has been claimed?
- How much has been certified?
- How much has been invoiced?
- How much has been collected?
- Where is project value stuck?
- How long has it been stuck?
- Why is it stuck?
- Is the blocker internally controllable?
- Who owns the issue?
- What action is due?
- What financial value was eventually released or protected?

The first sellable product is successful only when this loop works end-to-end.

---

# 3. STRICT SCOPE CONTROL

Build P0 completely.

Do NOT expand the application into a generic ERP.

## P0 — MUST BUILD

### Foundation
- Authentication
- Organization
- Multi-tenancy
- Memberships
- Roles
- Project permissions
- Clients
- Projects
- Contracts

### Progress-to-Cash
- Claims
- Claim stages
- Claim stage history
- Evidence checklist
- Documents
- Blockers
- Invoices
- Cash receipts
- Retentions

### Economic Control
- Value Gap Engine
- Stage Aging
- Risk Engine
- Cash-at-Risk
- Risk reason
- Controllability
- Action Engine
- Action outcomes

### Management
- Command Center
- Project economic overview
- Progress-to-Cash portfolio
- Reports

### Adoption
- CSV/XLSX import
- CSV/XLSX export
- In-app notifications
- Email notifications
- Feedback
- Audit trail
- Product analytics
- Data freshness
- Demo/seed environment

## P1/P2 — DO NOT FULLY IMPLEMENT NOW

- 13-week Project Cash
- Commitment-at-Risk
- Change-at-Risk
- Margin-at-Risk
- Full procurement
- ERP integration
- Accounting integration
- WhatsApp
- AI
- Predictive analytics
- BIM
- Payroll
- HR
- CRM
- Inventory
- Generic tasks
- Generic chat
- Generic DMS
- RAB builder
- Gantt builder

Prepare architecture boundaries and feature flags only where required.

Do not let P1/P2 delay P0.

---

# 4. REQUIRED TECH STACK

Use:

## Frontend
- Next.js latest stable compatible release
- React
- TypeScript
- Next.js App Router
- Tailwind CSS
- shadcn/ui

## Backend
- Next.js server-side application layer
- Server Actions for normal authenticated mutations where appropriate
- Route Handlers for bulk import/export and future integration boundaries

## Database
- PostgreSQL
- Supabase

## Authentication
- Supabase Auth
- Email + Password for V1

## File Storage
- Supabase Storage

## Hosting Target
- Vercel

## Validation
- Zod or equivalent strongly typed schema validation

## Testing
Use a modern test stack appropriate to the repository:
- Unit tests
- Integration tests
- Database/RLS tests
- End-to-end tests

Prefer Playwright for critical browser E2E unless repository constraints require another equivalent.

---

# 5. ARCHITECTURE RULE

Use:

# MODULAR MONOLITH

Do not use microservices.

Suggested domain boundaries:

```text
auth/
organizations/
members/
clients/
projects/
contracts/
claims/
evidence/
documents/
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
```

Reserve future domains without implementing full functionality:

```text
cash/
commitments/
changes/
margin/
integrations/
intelligence/
```

Do not put domain financial logic directly inside React UI components.

---

# 6. REQUIRED REPOSITORY STRUCTURE

Create a clean maintainable repository.

A recommended structure:

```text
/
├─ app/
│  ├─ (public)/
│  ├─ (auth)/
│  ├─ (app)/
│  └─ api/
├─ components/
│  ├─ ui/
│  ├─ layout/
│  ├─ dashboard/
│  ├─ claims/
│  ├─ actions/
│  ├─ projects/
│  └─ shared/
├─ modules/
│  ├─ organizations/
│  ├─ projects/
│  ├─ contracts/
│  ├─ claims/
│  ├─ evidence/
│  ├─ blockers/
│  ├─ invoices/
│  ├─ collections/
│  ├─ risks/
│  ├─ actions/
│  ├─ imports/
│  ├─ notifications/
│  ├─ feedback/
│  └─ audit/
├─ lib/
│  ├─ supabase/
│  ├─ auth/
│  ├─ validation/
│  ├─ money/
│  ├─ dates/
│  └─ utils/
├─ supabase/
│  ├─ migrations/
│  ├─ seed.sql
│  └─ tests/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ public/
├─ docs/
└─ ...
```

Exact structure may adapt to framework requirements, but domain separation must remain clear.

---

# 7. ENVIRONMENT CONFIGURATION

Create:

`.env.example`

Include only placeholders.

Required environment variables should cover:

- Supabase URL
- Supabase public/publishable key
- Supabase service role key for server-only operations
- App URL
- Email provider configuration if used
- Any server secrets

Never expose the Supabase service role key to browser code.

Do not commit real secrets.

Add setup instructions to README.

---

# 8. DATABASE MIGRATION STRATEGY

All database structure must be created through version-controlled migrations.

Do not depend on manual dashboard-only configuration.

Create migrations for:

- extensions if needed
- enums
- tables
- constraints
- indexes
- triggers/functions if justified
- RLS enablement
- policies
- storage policies where applicable
- seed support

Database schema must be reproducible from repository.

---

# 9. PRIMARY DATABASE ENTITIES

Implement at minimum:

```text
organizations
profiles
organization_members
project_members
clients
projects
contracts
claims
claim_stage_history
stage_sla_rules
evidence_requirements
claim_evidence
documents
blockers
invoices
cash_receipts
retentions
actions
notifications
imports
import_rows
feedback
feature_requests
audit_logs
product_events
```

You may add supporting tables if technically necessary.

Do not remove required entities without a strong technical reason.

---

# 10. MULTI-TENANT SECURITY

COVE contains financially sensitive project data.

Tenant isolation is a release blocker.

All tenant-owned records must include:

```text
organization_id
```

Project-owned records also include:

```text
project_id
```

Use PostgreSQL Row Level Security.

RLS must be enabled on every exposed tenant-owned business table.

Authorization must be enforced:

- at database level;
- at server/business layer;
- and reflected in UI.

UI hiding alone is never authorization.

---

# 11. MEMBERSHIP SECURITY MODEL

Authenticated users can access organization data only if an active organization membership exists.

Project-restricted users can access only assigned projects.

Organization-wide roles may access all projects according to permission policy.

Initial roles:

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

Implement role checks through centralized helpers/policies.

Do not scatter hard-coded permission conditionals throughout UI.

---

# 12. SECURITY TEST REQUIREMENT

Create at least:

- Organization A
- User A
- Organization B
- User B

Automated tests must prove User A cannot:

- SELECT Organization B business records
- INSERT Organization B business records
- UPDATE Organization B business records
- DELETE Organization B business records
- access Organization B private files

Also test:

- disabled users lose access;
- Viewer cannot mutate;
- Finance cannot perform organization administration;
- project-restricted users cannot access unassigned projects.

Failure of any tenant-isolation test is a release blocker.

---

# 13. UUID AND HUMAN IDS

Use UUID internal primary keys.

Also provide human-readable identifiers where users need them.

Examples:

```text
PRJ-001
CLM-2026-006
INV-2026-018
ACT-00045
```

Do not use sequential database IDs as security boundaries.

---

# 14. MONEY DATA TYPE

Use PostgreSQL:

```text
numeric(20,2)
```

for financial values.

Never use float/double for money.

Default currency:

```text
IDR
```

But schema must support other currency codes.

Format Rupiah correctly in UI.

---

# 15. ORGANIZATION MODULE

Build organization creation/onboarding.

Required fields:

- Name
- Legal Name
- Business Type
- Email
- Phone
- Website
- Address
- City
- Province
- Country
- Default Currency
- Timezone
- Logo URL
- Subscription Status

Initial subscription statuses:

```text
trial
active
suspended
cancelled
```

Default timezone:

`Asia/Jakarta`

Default currency:

`IDR`

---

# 16. USER / PROFILE MODULE

Use Supabase Auth for identity/password.

Do NOT build a second password system.

Application profile fields:

- full name
- email
- phone
- avatar
- job title via membership where appropriate

Support:

- sign up
- login
- logout
- forgot password
- reset password

---

# 17. CLIENT MODULE

Build client master.

Required fields:

- client code
- name
- legal name
- client type
- email
- phone
- address
- notes

A client may own multiple projects.

---

# 18. PROJECT MODULE

Required fields:

- Project Code
- Project Name
- Client
- Description
- Project Type
- Location
- City
- Province
- Contract Start
- Contract Finish
- Forecast Finish
- Currency
- Project Manager
- Commercial Manager
- Finance Owner
- Project Controller
- Status

Status:

```text
draft
active
on_hold
completed
closed
cancelled
```

---

# 19. CONTRACT MODULE

Each V1 project should support at least one primary contract.

Required:

- Contract Number
- Contract Title
- Original Contract Value
- Current Contract Value
- Payment Method
- Payment Term Days
- Retention %
- Advance Payment Amount
- Advance Recovery Amount
- Currency
- Effective Date
- Start Date
- Completion Date
- Status
- Notes

Statuses:

```text
draft
active
completed
terminated
cancelled
```

---

# 20. CLAIM ENTITY

Claims are the heart of COVE.

Required claim fields:

```text
id
organization_id
project_id
contract_id
claim_number
period_start
period_end
description
current_stage
risk_level

work_performed_value
measured_value
claimed_value
certified_value

expected_net_collectible
cash_received_value

expected_cash_date
current_stage_entered_at
responsible_owner_id

source_type
source_reference
source_updated_at

created_at
created_by
updated_at
updated_by
deleted_at
```

You may add supporting timestamps where implementation needs them.

---

# 21. CLAIM STAGES

Implement:

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

Normal order:

```text
WORK_RECORDED
→ MEASUREMENT
→ CLAIM_PREPARATION
→ CLAIM_READY
→ SUBMITTED
→ UNDER_REVIEW
→ CERTIFIED
→ INVOICE_READY
→ INVOICE_ISSUED
→ INVOICE_ACCEPTED
→ DUE
→ PARTIALLY_PAID
→ PAID
```

Exception states are outside normal order.

---

# 22. CLAIM STAGE TRANSITION SERVICE

Create centralized domain logic such as:

```text
transitionClaimStage()
```

The transition must:

1. verify authorization;
2. validate requested transition;
3. close prior stage-history row;
4. calculate duration;
5. create next history row;
6. update claim current stage;
7. update `current_stage_entered_at`;
8. evaluate claim risk;
9. create notifications if required;
10. create audit log;
11. commit atomically.

Use a transaction.

Backward or unusual transitions require:

- explicit reason;
- audit record.

Do not mutate stage history from client code.

---

# 23. CLAIM STAGE HISTORY

Implement history fields:

- claim
- from stage
- to stage
- entered at
- exited at
- duration hours
- changed by
- change reason
- created at

Never lose historical stage transitions.

---

# 24. CLAIM FINANCIAL VALIDATION

Reject negative money values.

Normal expectation:

```text
measured <= work_performed
claimed <= measured
certified <= claimed
```

However, real construction corrections can violate normal sequence.

Therefore:

- show a warning;
- require override reason;
- permit authorized override;
- record audit history.

Do not silently correct user data.

---

# 25. VALUE GAP DOMAIN SERVICE

Create centralized calculations:

```text
calculateClaimGaps()
```

At minimum:

```text
unmeasured =
max(work_performed - measured, 0)
```

```text
unclaimed =
max(measured - claimed, 0)
```

```text
uncertified =
max(claimed - certified, 0)
```

```text
certified_not_invoiced =
max(certified - total_allocated_invoice_gross, 0)
```

```text
invoiced_not_collected =
sum(invoice outstanding)
```

These calculations must not live solely in UI.

---

# 26. OPEN VALUE VS CASH-AT-RISK

Important distinction:

# OPEN VALUE ≠ CASH-AT-RISK

Open Value represents money/value that has not reached final cash state.

Cash-at-Risk is only the portion of open value associated with an active risk condition.

Never mark all open value as risk.

---

# 27. EVIDENCE MODULE

Build configurable evidence requirements.

Default templates:

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

Evidence item status:

```text
missing
in_progress
uploaded
verified
not_applicable
```

Fields include:

- required?
- owner
- due date
- verified by
- verified at
- document
- notes

---

# 28. EVIDENCE READINESS

Create:

```text
calculateEvidenceReadiness()
```

Rules:

Exclude `not_applicable`.

Use applicable required evidence.

Display:

```text
0–49%   Incomplete
50–79%  Needs Attention
80–99%  Nearly Ready
100%    Ready
```

This metric is operational readiness only.

Never present it as legal/contractual validity.

---

# 29. DOCUMENT STORAGE

Support:

- uploaded file;
- external document link.

Documents must relate to economic workflow entities.

Do not create a generic document management product.

Storage path must include tenant/project boundaries.

Example:

```text
organizations/{organization_id}/projects/{project_id}/claims/{claim_id}/...
```

Storage policies must enforce tenant access.

---

# 30. BLOCKER MODULE

A blocker can relate to:

- claim
- invoice
- project
- action
- future entity

Required fields:

- Category
- Title
- Description
- Financial Exposure
- Severity
- Controllability
- Owner
- Raised Date
- Target Resolve Date
- Resolved Date
- Status
- Resolution

Statuses:

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

# 31. DEFAULT BLOCKER CATEGORIES

Seed:

- Measurement incomplete
- Supporting document incomplete
- Internal preparation
- Consultant review
- Client review
- Technical approval
- Commercial dispute
- Quantity dispute
- Price dispute
- Invoice administration
- Tax administration
- Payment scheduling
- Owner cash constraint
- External approval
- Other

Allow configuration later without blocking V1.

---

# 32. STAGE SLA MODULE

Implement organization-level stage SLA rules.

Fields:

- stage
- warning after days
- risk after days
- critical after days
- active

Provide sensible seeded defaults.

Admin can edit them.

Stage aging uses calendar days for V1.

---

# 33. STAGE AGING

Create centralized calculation:

```text
calculateStageAging()
```

Based on:

`current_stage_entered_at`

Display e.g.:

`12 days in Under Review`

Use organization/user timezone for display.

---

# 34. INVOICE MODULE

Invoice is separate from claim.

Support one claim having multiple invoices.

Fields:

- Invoice Number
- Claim
- Project
- Issue Date
- Accepted Date
- Due Date
- Gross Amount
- Retention Amount
- Advance Recovery Amount
- Tax Amount
- Other Deduction Amount
- Net Receivable
- Cash Received
- Outstanding
- Expected Payment Date
- Status
- Finance Owner

Statuses:

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

# 35. NET RECEIVABLE

Create:

```text
calculateNetReceivable()
```

Default:

```text
gross_amount
- retention_amount
- advance_recovery_amount
- tax_amount
- other_deduction_amount
```

Do not hard-code Indonesian tax assumptions beyond stored configurable deduction values.

---

# 36. CASH RECEIPT MODULE

Support multiple payments per invoice.

Required:

- Receipt Number
- Invoice
- Project
- Amount
- Payment Date
- Bank Reference
- Notes
- Recorded By

On cash receipt creation/update:

1. validate authorization;
2. validate positive amount;
3. recompute invoice cash received;
4. recompute outstanding;
5. update invoice status;
6. update relevant claim/project aggregates;
7. evaluate risk;
8. write audit;
9. update dashboard data.

Use transaction where required.

---

# 37. INVOICE OUTSTANDING

Create:

```text
calculateInvoiceOutstanding()
```

```text
cash_received =
SUM(cash_receipts.amount)
```

```text
outstanding =
MAX(net_receivable - cash_received, 0)
```

Automatic status:

- partial payment → `partially_paid`
- zero outstanding → `paid`

Do not allow negative outstanding.

---

# 38. OVERDUE RULE

If:

```text
today > due_date
AND outstanding > 0
```

then treat as overdue risk unless invoice is cancelled.

If disputed, preserve disputed status but also expose overdue/aging context if relevant.

---

# 39. RETENTION MODULE

Track retention separately.

Fields:

- Project
- Claim
- Invoice
- Amount
- Release Condition
- Expected Release Date
- Actual Release Date
- Status
- Notes

Statuses:

```text
held
due_soon
due
released
disputed
```

---

# 40. RISK ENGINE

Build deterministic rule engine.

Create centralized services such as:

```text
evaluateClaimRisk()
evaluateInvoiceRisk()
calculateCashAtRisk()
```

Signals:

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

Do not use AI.

---

# 41. RISK LEVEL

Return:

```text
healthy
watch
at_risk
critical
```

Risk explanation is mandatory.

Never output risk score without reasons.

Example:

```text
Critical
Reason:
- Rp650M uncertified exposure
- Under Review for 16 days
- SLA critical threshold 14 days
- Active consultant approval blocker
```

---

# 42. CASH-AT-RISK CATEGORIES

Support:

```text
UNMEASURED_AT_RISK
UNCLAIMED_AT_RISK
UNCERTIFIED_AT_RISK
CERTIFIED_NOT_INVOICED_AT_RISK
RECEIVABLE_AT_RISK
RETENTION_AT_RISK
```

Prevent double-counting the same economic value.

This requirement is critical.

---

# 43. CASH-AT-RISK EXPLANATION

Each risk item should be able to show:

- Project
- Claim/Invoice
- Exposure Value
- Economic Stage
- Risk Level
- Aging
- Blocker
- Controllability
- Owner
- Expected Cash Date
- Next Action

The user should never have to infer why a number is red.

---

# 44. ACTION ENGINE

Actions are core, not generic tasks.

Actions must be linked to economic risk or economic workflow context.

Fields:

- Related Entity
- Risk Type
- Financial Exposure
- Title
- Description
- Owner
- Priority
- Due Date
- Status
- Resolution
- Outcome Type
- Outcome Value
- Resolved At

Statuses:

```text
open
in_progress
waiting_external
blocked
resolved
cancelled
```

Priority:

```text
low
medium
high
critical
```

---

# 45. ACTION OUTCOMES

Allowed outcome types:

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

When action becomes resolved:

Require:

- Resolution
- Outcome Type

Allow financial outcome value when appropriate.

Do not automatically claim causality.

User verifies financial outcomes.

---

# 46. ACTION PRIORITY ENGINE

Create centralized priority suggestion.

Inputs:

- financial exposure
- risk severity
- stage aging
- deadline urgency
- overdue status

Priority reasoning should be visible.

Exact internal numeric score may remain hidden.

Allow authorized override with audit reason.

---

# 47. DATA FRESHNESS

All key source-controlled data should support:

- Source Type
- Source Reference
- Source Updated At

Source types:

```text
manual
csv_import
xlsx_import
api
integration
system
```

Freshness defaults:

```text
FRESH         <= 24 hours
NEEDS_UPDATE  >24 hours and <=7 days
STALE         >7 days
UNKNOWN       no source timestamp
```

Create:

```text
evaluateFreshness()
```

---

# 48. COMMAND CENTER

Route:

`/dashboard`

This is the post-login home.

Goal:

> Owner should know what requires attention in under 30 seconds.

Required layout:

## Header
- Organization
- Portfolio context
- Last updated/freshness summary
- Add Claim
- Import Data

## KPI Row
1. Cash at Risk
2. Pre-Invoice Exposure
3. Overdue Receivables
4. Expected Collection 30 Days

## Money Pipeline
- Work Performed
- Measured
- Claimed
- Certified
- Invoiced
- Collected

## Top Actions Today

## Projects Requiring Attention

## Expected Collection
- 7 days
- 30 days
- 60 days
- 90 days

Every KPI must be drillable.

---

# 49. KPI DATA RULE

Do not hard-code KPI numbers.

All dashboard data must derive from seeded or real database records.

Show:

- monetary value;
- number of affected records where useful;
- freshness;
- click-through filter context.

---

# 50. PROJECTS PAGE

Route:

`/projects`

Include:

- Search
- Status Filter
- Client Filter
- Project Manager Filter
- Risk Filter

Columns:

- Project Code
- Project
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

# 51. PROJECT DETAIL

Route:

`/projects/[id]`

Required header KPIs:

- Contract Value
- Certified
- Invoiced
- Collected
- Outstanding
- Cash-at-Risk

Tabs:

- Overview
- Progress-to-Cash
- Actions
- Documents
- Activity

P1 tabs may be hidden behind flags:

- Cash
- Commitments
- Changes
- Margin

Overview includes:

- Money Pipeline
- Top Blockers
- Open Actions
- Claim Aging
- Recent Activity

---

# 52. PROGRESS-TO-CASH PORTFOLIO

Route:

`/progress-to-cash`

This must be a primary management table.

Columns:

- Project
- Claim
- Period
- Current Stage
- Stage Aging
- Work Value
- Claimed
- Certified
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
- Evidence Readiness
- Expected Cash Date
- Controllability

---

# 53. CLAIM DETAIL

Use a dedicated page or high-quality detail drawer/page combination.

Required areas:

## Summary
- Stage
- Risk
- Aging
- Owner
- Expected Cash

## Economic Pipeline
- Work
- Measured
- Claimed
- Certified
- Invoiced
- Collected

## Gap Analysis
- Unmeasured
- Unclaimed
- Uncertified
- Certified Not Invoiced
- Invoiced Not Collected

## Timeline
- Stage history

## Evidence
- readiness %
- checklist
- files

## Blockers

## Invoices

## Actions

## Activity / Audit

---

# 54. CREATE CLAIM UX

Use a simple wizard.

Step 1:
- Project
- Contract
- Period
- Claim Number

Step 2:
- Work Performed
- Measured
- Claimed
- Certified

Step 3:
- Current Stage
- relevant dates
- Expected Cash Date

Step 4:
- Evidence requirements

Step 5:
- Responsible owner

Show validation warnings.

Do not require every optional field.

---

# 55. ADD BLOCKER UX

From Claim:

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

After saving:

Offer:

`Create Action`

---

# 56. ACTIONS PAGE

Route:

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

Do not create generic to-do lists unrelated to economic control.

---

# 57. REPORTS

Route:

`/reports`

P0:

- Cash-at-Risk Report
- Claim Aging
- Certification Aging
- Invoice Aging
- Receivable Aging
- Expected Collection
- Action Aging
- Project Economic Summary

Each report supports:

- filters
- export
- generated timestamp
- freshness indication

---

# 58. IMPORT CENTER

Route:

`/data`

Support:

- Projects
- Contracts
- Claims
- Invoices
- Cash Receipts

Flow:

1. Choose entity
2. Download template or upload source
3. Map columns
4. Validate
5. Preview valid/error rows
6. Confirm
7. Import
8. Show summary
9. Download errors

Do not fail entire import because some rows are invalid.

---

# 59. XLSX / CSV IMPORT

Implement parsing with a reliable maintained library.

Do not use brittle manual parsing.

Support:

- numeric financial fields;
- date validation;
- enum mapping;
- project lookup;
- owner email mapping where applicable;
- duplicate detection.

---

# 60. IMPORT IDEMPOTENCY

Use optional:

`source_reference`

When duplicate external source key is detected:

Offer:

- Update Existing
- Skip
- Create New

Default should favor preventing accidental duplicates.

---

# 61. EXPORT

P0 export:

- CSV
- XLSX

Allow export of filtered tables.

Future PDF not required.

---

# 62. NOTIFICATION ENGINE

In-app notifications required.

Email notifications required for important triggers.

P0 triggers:

- Claim warning SLA
- Claim risk SLA
- Evidence incomplete near submission
- Invoice due soon
- Invoice overdue
- Expected cash missed
- Action due tomorrow
- Action overdue
- Critical blocker

Avoid notification spam.

Group repetitive alerts where sensible.

---

# 63. EMAIL CONTENT

Email should include:

- Project
- Claim/Invoice/Action
- Economic value
- Issue
- Owner
- Due date
- Direct application link

Example:

> Claim MC-006 Rp650M has remained Under Review for 14 days. Consultant approval is still pending. Owner: Dimas Sucipto. Action due today.

---

# 64. FEEDBACK MODULE

Route:

`/feedback`

Also provide global `Send Feedback` shortcut.

Types:

- Missing Feature
- Workflow Problem
- Bug
- Report Request
- Integration
- Improvement
- Other

Capture automatically:

- user
- organization
- current page
- timestamp
- project if context exists
- app version if available

Allow attachment.

This is important because COVE will evolve through paying-customer feedback.

---

# 65. FEATURE REQUEST INTERNAL DATA

Support internal feature-request records with:

- organization/customer
- user role
- requested feature
- underlying problem
- frequency
- financial impact
- current workaround
- status
- priority
- decision

Statuses may include:

```text
investigate
planned
building
released
rejected
duplicate
```

No need for a complex public roadmap.

---

# 66. AUDIT TRAIL

Critical events must be audited.

At minimum:

- claim financial changes
- claim stage changes
- invoice changes
- cash receipts
- blocker create/update/resolve
- action create/update/resolve
- permission changes
- membership changes
- import activity

Store:

- user
- organization
- entity
- entity id
- event
- old values
- new values
- source
- timestamp

Use JSON fields where appropriate.

---

# 67. SOFT DELETE

Financial/control records must not be hard-deleted through normal user UI.

Use:

- archived
- cancelled
- soft delete

Corrections must remain traceable.

---

# 68. PRODUCT ANALYTICS

Track:

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

Analytics must not leak data between tenants.

---

# 69. UI DESIGN DIRECTION

COVE should feel:

- premium
- serious
- enterprise
- financial
- calm
- high trust
- modern
- data dense but clean

Avoid:

- cartoon construction graphics
- overly playful illustrations
- excessive gradients
- rainbow dashboards
- excessive pill shapes
- generic startup aesthetic
- oversized empty whitespace on data-heavy screens

---

# 70. DESIGN SYSTEM

Use:

- deep navy / charcoal primary
- neutral light background
- muted green for healthy/success
- amber for watch
- red for risk
- stronger red for critical
- modern sans-serif typography
- readable tables
- strong numeric hierarchy

Color is never the only status signal.

Always include text/icon.

---

# 71. SIDEBAR

Desktop:

COVE

- Command Center
- Projects
- Progress to Cash
- Actions
- Reports
- Data
- Feedback

Divider

- Settings

P1 modules should remain hidden unless feature flag enabled.

---

# 72. TOP BAR

Include:

- organization context/switcher if user belongs to more than one
- global search
- notifications
- user menu

Keep uncluttered.

---

# 73. GLOBAL SEARCH

Search:

- projects
- claims
- invoices
- clients
- actions

Results clearly labeled by entity type.

---

# 74. SHARED UI COMPONENTS

Build reusable components:

- KPI Card
- Money Display
- Risk Badge
- Stage Badge
- Aging Badge
- Freshness Badge
- Project Selector
- User/Owner Avatar
- Action Card
- Filter Bar
- Data Table
- Activity Timeline
- Upload Zone
- Evidence Checklist
- Cash Pipeline
- Empty State
- Confirmation Dialog
- Detail Drawer
- Money Input
- Date Field
- Searchable Select

---

# 75. RESPONSIVE RULES

Desktop:
Full application.

Tablet:
Full review and moderate input.

Mobile:
Prioritize:

- dashboard
- claims
- actions
- blockers
- evidence upload
- notifications

Do not force complex bulk-import configuration onto small screens.

---

# 76. EMPTY STATES

Every primary screen needs meaningful empty states.

Example:

# No Claims Yet

Import your existing progress claims or add your first claim to begin tracking project value from work performed to cash collected.

Actions:

`Add Claim`

`Import Claims`

---

# 77. LOADING STATES

Use:

- skeletons
- loading indicators
- disabled submission states
- import progress

Never leave users wondering whether a mutation is processing.

---

# 78. USER-FACING ERRORS

Never expose raw database/framework errors to end users.

Example:

Good:

> COVE could not save this claim. Your previous data is unchanged. Please review the highlighted fields and try again.

Bad:

> PostgrestError PGRST...

Log technical details server-side.

---

# 79. BUSINESS ERRORS

Be specific.

Example:

> This claim cannot be marked Paid because Rp420,000,000 remains outstanding across its invoices.

---

# 80. FEATURE FLAGS

Implement lightweight organization-level feature flags.

At minimum reserve:

```text
project_cash_enabled
commitments_enabled
changes_enabled
margin_enabled
whatsapp_enabled
ai_enabled
```

Defaults:

false.

Do not expose unfinished features.

---

# 81. DOMAIN SERVICES

Required centralized logic functions/services should include equivalents of:

```text
calculateClaimGaps()
calculateNetReceivable()
calculateInvoiceOutstanding()
calculateEvidenceReadiness()
calculateStageAging()
evaluateClaimRisk()
evaluateInvoiceRisk()
calculateCashAtRisk()
evaluateFreshness()
transitionClaimStage()
suggestActionPriority()
```

Write unit tests around them.

---

# 82. TRANSACTIONAL OPERATIONS

Use transactional semantics for:

- stage transition + history + audit
- cash receipt + invoice reconciliation
- action resolution + outcome
- bulk import commit
- other multi-write financial mutations

Partial writes must not leave financial state inconsistent.

---

# 83. DATA SOURCE / FRESHNESS DISPLAY

For critical financial values show:

- Data Source
- Last Updated
- Freshness

Examples:

`Manual • Updated 2 hours ago • Fresh`

`XLSX Import • Updated 4 days ago • Needs Update`

Never claim “real-time” when data is stale.

---

# 84. SEED DATA

Create useful realistic seed/demo data.

Organization:

# PT Nusantara Buildindo

Users:

- Raka Pratama — Director
- Dimas Sucipto — Commercial Manager
- Andi Wijaya — Project QS
- Rani Prameswari — Finance Manager
- Fajar Nugroho — Project Manager

Create at least 4 projects.

---

# 85. DEMO PROJECT A

# Grand Meridian Office Tower

Client:

PT Meridian Properti Indonesia

Contract:

Rp48,500,000,000

Payment:

Monthly Progress

Retention:

5%

Create claim:

# MC-006

Values:

```text
Work Performed   Rp3,200,000,000
Measured         Rp3,000,000,000
Claimed          Rp2,750,000,000
Certified        Rp2,100,000,000
Invoiced         Rp2,100,000,000
Collected        Rp1,400,000,000
```

Expected gaps:

```text
Unmeasured       Rp200,000,000
Unclaimed        Rp250,000,000
Uncertified      Rp650,000,000
Invoice Outstanding Rp700,000,000
```

---

# 86. DEMO BLOCKER

For MC-006:

Category:

`Consultant Review`

Description:

`Final quantity verification pending consultant approval.`

Financial Exposure:

Rp650,000,000

Controllability:

`joint`

Owner:

Dimas Sucipto

Aging:

9 days

Severity:

high

---

# 87. DEMO ACTION

Title:

`Escalate final quantity approval`

Exposure:

Rp650,000,000

Owner:

Dimas Sucipto

Due:

Tomorrow relative to seed scenario

Priority:

Critical

Status:

Open

---

# 88. OTHER DEMO PROJECTS

Create:

## Project B
Invoice overdue scenario.

## Project C
Evidence incomplete scenario.

## Project D
Healthy/collected scenario.

This allows portfolio comparison.

Do not hard-code dashboard metrics.

They must be derived from seeded records.

---

# 89. DEMO DASHBOARD TARGET

Seed data should produce a believable dashboard containing:

- multiple project states
- multiple claim stages
- healthy and risky items
- open actions
- overdue receivable
- expected collection

Exact KPI values may depend on coherent seed records.

Never fake numbers in frontend constants.

---

# 90. TEST STRATEGY

Create:

## Unit Tests
For domain calculations.

## Integration Tests
For workflows.

## Database/RLS Tests
For isolation/security.

## E2E Tests
For first-sellable flow.

---

# 91. REQUIRED FINANCIAL UNIT TESTS

Test:

- zero values
- normal value progression
- partial payment
- multiple payments
- full payment
- retention
- deductions
- overdue invoice
- claim correction
- certified > claimed authorized override
- expected cash missed
- negative value rejection
- large IDR values
- no double-counting of risk exposure

---

# 92. REQUIRED RISK TESTS

Test:

- open but healthy claim not automatically Cash-at-Risk
- SLA warning
- SLA risk
- critical aging
- blocker creates risk
- resolved blocker removes applicable risk
- overdue receivable risk
- disputed claim
- on-hold claim
- evidence incomplete condition
- risk reason rendering
- no double counting across economic stages

---

# 93. REQUIRED ACTION TESTS

Test:

- action creation from blocker/risk
- ownership
- overdue action
- priority
- status progression
- resolve action
- require outcome type
- financial outcome value
- audit event
- dashboard update

---

# 94. REQUIRED IMPORT TESTS

Test:

- valid XLSX
- valid CSV
- invalid dates
- invalid amount
- unknown project
- duplicate source reference
- mixed valid/invalid rows
- import only valid rows
- error export
- tenant boundary
- audit event

---

# 95. CRITICAL E2E FLOW

Automate this path:

1. Sign in.
2. Create organization.
3. Create project.
4. Create contract.
5. Create claim.
6. Enter financial progress.
7. Move claim to Under Review.
8. Add blocker.
9. Verify Cash-at-Risk appears.
10. Create Action.
11. Move claim to Certified.
12. Create invoice.
13. Record partial cash receipt.
14. Verify outstanding.
15. Record final receipt.
16. Verify invoice Paid.
17. Resolve Action.
18. Record economic outcome.
19. Verify dashboard updates.
20. Verify stage history.
21. Verify audit history.

This test must pass before V1 is declared done.

---

# 96. FIRST SELLABLE CUSTOMER FLOW

The product must allow a new contractor to:

```text
SIGN UP
↓
CREATE COMPANY
↓
ADD PROJECT
↓
ADD CONTRACT
↓
IMPORT OR CREATE CLAIM
↓
SEE PROGRESS-TO-CASH PIPELINE
↓
IDENTIFY STUCK VALUE
↓
SEE WHY IT IS STUCK
↓
ASSIGN RESPONSIBLE OWNER
↓
CREATE ACTION
↓
CREATE INVOICE
↓
RECORD CASH
↓
SEE EXPOSURE REDUCE
↓
RECORD OUTCOME
```

without requiring a developer to edit the database.

---

# 97. FIRST VALUE MOMENT

Optimize onboarding toward:

> User imports/creates existing claims and COVE immediately shows where project value is stuck and which high-value actions deserve attention.

Prioritize this above decorative features.

---

# 98. README REQUIREMENT

Create a complete `README.md` containing:

- What COVE is
- Tech stack
- Local prerequisites
- Environment variables
- Supabase setup
- Migration instructions
- Seed instructions
- Development start
- Test commands
- Production build
- Deployment outline
- Security notes
- Demo credentials only if safely implemented for local/demo environment
- Known V1 limitations

Do not expose production secrets.

---

# 99. DOCUMENTATION REQUIREMENT

Create:

```text
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/BUSINESS_RULES.md
docs/SECURITY.md
docs/TESTING.md
```

Keep documentation synchronized with implementation.

---

# 100. BUILD QUALITY

The application must not merely “look complete.”

Verify:

- buttons actually work
- forms persist data
- edits persist
- filters work
- permissions work
- dashboard numbers are derived
- actions update
- payments reconcile
- files upload securely
- imports process
- notifications create
- responsive behavior works
- errors are handled
- loading states work
- audit records exist

No fake interactive controls.

---

# 101. NO PLACEHOLDER UI POLICY

Do not ship primary P0 pages containing:

- lorem ipsum
- dead buttons
- fake charts disconnected from DB
- “coming soon” for required P0
- hard-coded financial numbers
- fake user lists
- fake risk calculations

P1 features may remain hidden through feature flags.

---

# 102. ITERATIVE IMPLEMENTATION BEHAVIOR

Work through build phases internally.

Do not stop to ask for permission between phases unless an external secret/account decision truly makes execution impossible.

When a reasonable implementation choice is unspecified:

Choose the simplest secure option consistent with PRD and Blueprint.

Do not expand scope.

---

# 103. BUILD SEQUENCE

Follow this order:

## BUILD 01 — Repository & Environment
- initialize project
- dependencies
- linting
- formatting
- environment example
- base app shell

## BUILD 02 — Supabase Schema
- enums
- tables
- indexes
- migrations

## BUILD 03 — Authentication
- sign up
- login
- logout
- reset password
- protected app shell

## BUILD 04 — Organization / Tenant
- onboarding
- membership
- tenant context

## BUILD 05 — RBAC / RLS
- roles
- project access
- database policies
- automated security tests

## BUILD 06 — Client / Project / Contract
- CRUD
- validation
- project detail shell

## BUILD 07 — Claims
- CRUD
- financial fields
- filters

## BUILD 08 — Claim Stage Engine
- transitions
- history
- audit

## BUILD 09 — Evidence
- templates
- checklist
- storage

## BUILD 10 — Blockers
- lifecycle
- financial exposure
- controllability

## BUILD 11 — Invoice / Cash Receipt / Retention
- billing
- partial collection
- reconciliation

## BUILD 12 — Value Gap Engine
- all gap formulas
- unit tests

## BUILD 13 — Risk / Cash-at-Risk
- SLA
- blocker signals
- overdue
- no double counting
- explanations

## BUILD 14 — Action Engine
- actions
- priorities
- outcomes

## BUILD 15 — Command Center
- KPIs
- pipeline
- actions
- attention list
- collection windows

## BUILD 16 — Project Economic Views
- project overview
- detail drilldowns

## BUILD 17 — Progress-to-Cash Portfolio
- portfolio table
- filters
- claim detail

## BUILD 18 — Reports
- required P0 reports

## BUILD 19 — Import / Export
- CSV/XLSX
- mapping
- validation
- errors
- idempotency

## BUILD 20 — Notifications
- in-app
- critical email

## BUILD 21 — Feedback / Analytics
- feedback capture
- feature request structure
- product events

## BUILD 22 — Demo Seed
- organization
- users
- projects
- claims
- risks
- actions
- receipts

## BUILD 23 — Security QA
- RLS
- permission tests
- storage policies

## BUILD 24 — Financial QA
- formulas
- reconciliation
- large values
- corrections

## BUILD 25 — End-to-End QA
- full critical user journey
- responsive QA
- bug fixes

Do not declare completion before BUILD 25 passes.

---

# 104. V1 RELEASE BLOCKERS

Do not consider COVE ready if any of these remain:

- tenant data leak
- broken RLS
- broken financial reconciliation
- lost claim stage history
- double-counted Cash-at-Risk
- dashboard hard-coded
- missing audit trail
- import silently corrupts data
- required P0 dead button
- critical flow cannot complete
- seed/demo broken
- major responsive failure
- unhandled critical error

---

# 105. FINAL ACCEPTANCE CHECKLIST

Before declaring completion verify:

## Authentication
- [ ] Sign up
- [ ] Login
- [ ] Logout
- [ ] Reset password

## Tenant
- [ ] Organization created
- [ ] Membership works
- [ ] Project restriction works
- [ ] Cross-tenant access blocked

## Project
- [ ] Client CRUD
- [ ] Project CRUD
- [ ] Contract CRUD

## Claim
- [ ] Claim CRUD
- [ ] Stage transition
- [ ] Stage history
- [ ] Override reason
- [ ] Value gaps

## Evidence
- [ ] Checklist
- [ ] Readiness
- [ ] Upload/link
- [ ] Access control

## Blocker
- [ ] Create
- [ ] Assign
- [ ] Resolve
- [ ] Controllability

## Invoice
- [ ] Create
- [ ] Net receivable
- [ ] Due/overdue
- [ ] Multiple payments
- [ ] Outstanding
- [ ] Paid state

## Risk
- [ ] SLA
- [ ] Active blocker
- [ ] Cash-at-Risk
- [ ] Explanation
- [ ] No double counting

## Action
- [ ] Create
- [ ] Assign
- [ ] Prioritize
- [ ] Resolve
- [ ] Outcome
- [ ] Financial outcome

## Dashboard
- [ ] KPI derived from DB
- [ ] Pipeline
- [ ] Top Actions
- [ ] Projects Requiring Attention
- [ ] Collection windows
- [ ] Drilldowns
- [ ] Freshness

## Data
- [ ] CSV import
- [ ] XLSX import
- [ ] Mapping
- [ ] Validation
- [ ] Partial success
- [ ] Error export
- [ ] CSV/XLSX export

## Operations
- [ ] Notifications
- [ ] Feedback
- [ ] Audit
- [ ] Product events

## QA
- [ ] Unit tests
- [ ] Integration tests
- [ ] RLS tests
- [ ] E2E tests
- [ ] Production build succeeds

---

# 106. FINAL PRODUCT TEST

At the end, use the demo environment and prove this exact story:

A contractor has performed Rp3.20B of work.

Only Rp3.00B is measured.

Rp2.75B has been claimed.

Rp2.10B is certified.

Rp2.10B is invoiced.

Rp1.40B has been collected.

COVE must correctly show:

- Rp200M unmeasured
- Rp250M unclaimed
- Rp650M uncertified
- Rp700M invoiced but not collected

A Rp650M certification blocker is created.

COVE detects it as risk according to rules.

Dimas is assigned an action.

The action is resolved.

The claim moves forward.

An invoice/payment event is recorded.

COVE updates exposure and dashboard values.

The audit log shows what changed.

This must work through the UI using persisted database records.

---

# 107. PRODUCT EXPERIENCE TARGET

When an Owner or Commercial Manager opens COVE, the application should make this immediately obvious:

> Which project money is stuck?

> How much is at risk?

> Why?

> Who owns the problem?

> What action is due?

That experience is more important than adding more modules.

---

# 108. NON-NEGOTIABLE PRODUCT PRINCIPLE

Never turn COVE into a feature warehouse.

Do not add a module simply because another construction platform has one.

Any future capability must answer:

> What economic decision becomes materially better because this feature exists?

If there is no clear answer:

# DO NOT BUILD

---

# 109. FINAL EXECUTION DIRECTIVE

Build the application.

Do not merely produce another implementation plan.

Do not stop at scaffold.

Do not stop after generating SQL.

Do not stop after authentication.

Do not stop after creating dashboard cards.

Continue until the entire P0 product works end-to-end.

At completion:

1. Run all tests.
2. Fix failures.
3. Run production build.
4. Fix build errors.
5. Verify critical E2E flow.
6. Verify tenant isolation.
7. Verify financial calculations.
8. Verify seed/demo data.
9. Verify responsive application.
10. Provide concise final implementation report containing:
   - what was built;
   - architecture;
   - database/migrations;
   - security;
   - test results;
   - setup instructions;
   - environment variables still required;
   - known limitations;
   - recommended next customer-validation step.

The final result must be a functioning:

# COVE V1
## Construction Operations Value Engine

with the complete:

# MONEY → RISK → ACTION → OUTCOME

workflow operational.
