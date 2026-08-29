# COVE
## Construction Operations Value Engine
### Product Requirements Document — Build-Ready v1.0

**Document Status:** Approved for Experimental MVP Build  
**Product Stage:** Early Commercial / Validation Through Sales  
**Primary Market:** Indonesian Construction Contractors  
**Primary Wedge:** Progress-to-Cash / Cash-at-Risk  
**Architecture:** Multi-tenant SaaS  
**Primary Platform:** Responsive Web Application  
**Default Timezone:** Asia/Jakarta  
**Default Currency:** IDR

---

# 1. Product Definition

COVE adalah sistem kontrol ekonomi proyek konstruksi yang membantu kontraktor mengetahui bagaimana nilai proyek bergerak dari pekerjaan yang sudah dilakukan sampai menjadi kas.

COVE harus mampu menjawab:

- berapa nilai pekerjaan yang telah dilakukan;
- berapa yang telah diukur/opname;
- berapa yang telah diajukan;
- berapa yang telah disertifikasi;
- berapa yang telah ditagihkan;
- berapa yang masih menjadi piutang;
- berapa yang sudah diterima sebagai kas;
- di tahap mana nilai proyek tertahan;
- berapa Rupiah exposure-nya;
- apa penyebabnya;
- siapa yang bertanggung jawab;
- tindakan apa yang harus dilakukan;
- apa hasil finansial setelah tindakan dilakukan.

COVE bukan generic project-management software.

Prinsip utama:

**PROJECT EVENT → ECONOMIC STATE → FINANCIAL EXPOSURE → OWNER → ACTION → OUTCOME**

---

# 2. Product Vision

Visi jangka panjang COVE adalah berkembang menjadi **Construction Economic Operating System** untuk kontraktor Indonesia.

COVE v1 tidak mencoba menjadi ERP konstruksi lengkap. V1 harus memenangkan satu pekerjaan terlebih dahulu:

> Membantu kontraktor mengendalikan perjalanan nilai pekerjaan dari progress menjadi cash.

Ekspansi setelah customer evidence tersedia:

- Project Cash;
- Commitments;
- Change Orders / Entitlement;
- Margin Control;
- Portfolio Economic Control;
- Forecasting;
- Intelligence / AI.

---

# 3. Core Product Philosophy

Pusat produk bukan:

**Project → Task → Document → Schedule**

Pusat produk adalah:

**Money → Risk → Action → Outcome**

Setiap fitur harus membantu setidaknya satu dari berikut:

1. mengetahui di mana uang/nilai proyek berada;
2. mendeteksi risiko lebih awal;
3. mengukur konsekuensi dalam Rupiah;
4. menjelaskan penyebab;
5. menentukan siapa yang harus bertindak;
6. membantu penyelesaian;
7. membuktikan hasil ekonominya.

Jika tidak, fitur tidak masuk core COVE.

---

# 4. Primary User Problem

Workflow ekonomi utama proyek:

```text
WORK PERFORMED
      ↓
MEASUREMENT / OPNAME
      ↓
CLAIM PREPARATION
      ↓
SUBMITTED
      ↓
UNDER REVIEW
      ↓
CERTIFIED
      ↓
INVOICE
      ↓
RECEIVABLE
      ↓
COLLECTION
      ↓
CASH
```

Masalah bukan hanya invoice belum dibayar. Nilai dapat tertahan jauh sebelum invoice dibuat.

Contoh:

- Work performed: Rp1,20 miliar
- Measured: Rp1,05 miliar
- Claimed: Rp850 juta
- Certified: Rp600 juta
- Invoiced: Rp600 juta
- Collected: Rp400 juta

COVE harus memperlihatkan gap ekonomi tersebut dengan jelas.

---

# 5. Core Value Proposition

COVE membantu user menjawab:

> Berapa Rupiah nilai proyek yang belum berhasil menjadi cash?

> Di tahap mana nilai tersebut tertahan?

> Sudah berapa lama?

> Apa blocker-nya?

> Apakah blocker dapat dikendalikan kontraktor?

> Siapa pemilik masalah?

> Apa next action?

> Kapan harus selesai?

> Berapa nilai ekonomi yang berhasil dilepaskan setelah tindakan?

---

# 6. Target Customer

## Primary ICP

Growing small sampai mid-market contractor Indonesia yang:

- menjalankan beberapa proyek aktif;
- menggunakan progress billing/termin;
- memiliki QS atau commercial function;
- memiliki finance/admin project;
- memiliki project manager;
- memiliki procurement atau purchasing function;
- masih menggunakan kombinasi Excel/Sheets, WhatsApp, accounting software, ERP, atau tools terpisah;
- belum memiliki enterprise-grade economic control tower.

## Secondary ICP

- specialist contractor;
- MEP contractor;
- industrial contractor;
- EPC contractor;
- design-build contractor;
- subcontractor dengan nilai kontrak material.

## Tidak Diprioritaskan V1

- kontraktor mikro satu proyek kecil;
- bisnis yang hanya membutuhkan RAB;
- owner/developer non-contractor;
- customer yang hanya mencari accounting software;
- perusahaan yang membutuhkan SAP replacement;
- customer yang membutuhkan BIM authoring platform.

---

# 7. User Roles

## Owner / Director

Kebutuhan utama:

- portfolio Cash-at-Risk;
- projects requiring attention;
- expected collection;
- top economic risks;
- overdue actions;
- portfolio visibility.

## Commercial Manager

Mengelola:

- claims;
- certifications;
- commercial blockers;
- evidence;
- collection escalation;
- commercial actions.

## QS / Project QS

Mengelola:

- measurement;
- progress valuation;
- claim preparation;
- supporting evidence;
- claim submission.

## Finance Manager

Mengelola:

- invoices;
- receivables;
- collections;
- cash receipts;
- expected payment date.

## Project Manager

Melihat dan mengelola:

- project economic status;
- project blockers;
- risks;
- actions.

## Project Control / Cost Control

Mengelola atau membaca:

- economic analytics;
- project performance;
- future margin/cost modules.

## Procurement

V1: project-level read access.  
Future: commitment module.

## Administrator

Mengelola:

- organization;
- users;
- roles;
- projects;
- permissions;
- workflow settings;
- imports.

---

# 8. Multi-Tenant Model

Hierarchy:

```text
Organization
  → Users / Members
  → Clients
  → Projects
  → Contracts
  → Economic Records
```

Setiap business record wajib memiliki `organization_id`.

Project-related records juga memiliki `project_id`.

Data Organization A tidak boleh dapat dibaca atau diubah oleh Organization B.

Database-level Row Level Security wajib digunakan.

---

# 9. Main Navigation

V1 navigation:

1. Command Center
2. Projects
3. Progress to Cash
4. Actions
5. Reports
6. Data
7. Feedback
8. Settings

Future modules menggunakan feature flags:

- Project Cash
- Commitments
- Changes
- Margin

---

# 10. Feature Priority

## P0 — First Sellable Version

- Authentication
- Organization
- Members & Roles
- Clients
- Projects
- Contracts
- Claims
- Claim Stage History
- Evidence
- Blockers
- Invoices
- Cash Receipts
- Retention
- Value Gap Engine
- Cash-at-Risk Engine
- Action Engine
- Command Center
- Project Economic Overview
- Progress-to-Cash portfolio
- Reports dasar
- Excel/CSV import
- Excel/CSV export
- Notifications
- Audit Log
- Data Freshness
- Feedback

## P1 — Customer-Driven Expansion

- 13-week Project Cash
- Commitments
- Commitment-at-Risk
- Changes
- Change-at-Risk
- Margin
- Margin-at-Risk
- Advanced portfolio analytics

## P2

- ERP/accounting integrations
- WhatsApp integration
- Payment prediction
- AI document extraction
- AI recommendations
- Anomaly detection
- Benchmarking
- Predictive risk

---

# 11. Authentication

V1:

- email + password;
- forgot password;
- reset password;
- logout.

Future:

- Google;
- Microsoft;
- SSO.

Authentication harus dipisahkan dari authorization.

---

# 12. Organization

Fields:

- Organization Name
- Legal Name
- Business Type
- Address
- City
- Province
- Country
- Email
- Phone
- Website
- Default Currency
- Timezone
- Logo
- Subscription Status

Subscription status:

- Trial
- Active
- Suspended
- Cancelled

---

# 13. Users & Membership

Fields:

- Name
- Email
- Phone
- Job Title
- Organization Role
- Project Access
- Status
- Last Login

Status:

- Invited
- Active
- Disabled

Admin dapat:

- invite member;
- edit role;
- restrict project access;
- disable member.

---

# 14. Project Master

Fields:

- Project Code
- Project Name
- Client
- Project Type
- Location
- City
- Province
- Contract Number
- Original Contract Value
- Current Contract Value
- Start Date
- Contract Finish Date
- Forecast Finish Date
- Payment Method
- Payment Terms
- Retention %
- Advance Payment
- Advance Recovery
- Currency
- Project Manager
- Commercial Manager
- Finance Owner
- Project Controller
- Status

Project status:

- Draft
- Active
- On Hold
- Completed
- Closed
- Cancelled

---

# 15. Project Detail

Header KPI:

- Contract Value
- Certified
- Invoiced
- Collected
- Outstanding
- Cash-at-Risk

V1 tabs:

- Overview
- Progress-to-Cash
- Actions
- Documents
- Activity

Future tabs:

- Cash
- Commitments
- Changes
- Margin

---

# 16. Progress-to-Cash Core Module

Tujuan:

> Mengontrol perjalanan nilai pekerjaan sampai menjadi cash.

Default stages:

1. Work Recorded
2. Measurement
3. Claim Preparation
4. Claim Ready
5. Submitted
6. Under Review
7. Certified
8. Invoice Ready
9. Invoice Issued
10. Invoice Accepted
11. Due
12. Partially Paid
13. Paid

Exception states:

- On Hold
- Disputed
- Rejected
- Cancelled

Setiap perubahan stage wajib disimpan sebagai history.

---

# 17. Claim Data Model

## Identification

- Claim ID
- Claim Number
- Project
- Contract
- Period Start
- Period End
- Description

## Economic Values

- Work Performed Value
- Measured Value
- Claimed Value
- Certified Value
- Expected Net Collectible
- Cash Received

## Timeline

- Work Date
- Measurement Date
- Claim Prepared Date
- Submitted Date
- Review Started Date
- Certified Date
- Invoice Ready Date
- Invoice Issued Date
- Invoice Accepted Date
- Due Date
- First Payment Date
- Fully Paid Date

## Control

- Current Stage
- Stage Entered At
- Stage Aging
- Target Stage SLA
- Risk Level
- Expected Cash Date
- Responsible Owner
- Notes
- Source
- Source Updated At

---

# 18. Value Gap Engine

## Unmeasured Value

`MAX(Work Performed - Measured, 0)`

## Unclaimed Value

`MAX(Measured - Claimed, 0)`

## Uncertified Value

`MAX(Claimed - Certified, 0)`

## Certified Not Yet Invoiced

`MAX(Certified - Allocated Invoice Gross, 0)`

## Invoiced Not Collected

`SUM(Invoice Outstanding)`

## Important Rule

Open value bukan otomatis Cash-at-Risk.

Cash-at-Risk hanya muncul bila open value memiliki active risk condition.

---

# 19. Cash-at-Risk Engine

P0 menggunakan deterministic rules, bukan AI.

Risk signal:

- stage SLA breached;
- active blocker;
- evidence incomplete;
- invoice overdue;
- expected cash date missed;
- disputed;
- on hold;
- related action overdue.

Cash-at-Risk record/visual harus memperlihatkan:

- exposure amount;
- stage;
- reason;
- aging;
- blocker;
- controllability;
- owner;
- next action.

Risk categories:

- Unmeasured at Risk
- Unclaimed at Risk
- Uncertified at Risk
- Certified Not Invoiced at Risk
- Receivable at Risk
- Retention at Risk

Sistem wajib mencegah double counting nilai yang sama.

---

# 20. Risk Level

- **Healthy:** tidak ada triggered risk.
- **Watch:** mendekati threshold.
- **At Risk:** threshold terlewati atau blocker material aktif.
- **Critical:** high-value exposure + high urgency/critical aging/severe blocker.

Threshold harus dapat dikonfigurasi kemudian.

---

# 21. Blocker Engine

Blocker dapat terkait:

- Claim
- Invoice
- Project
- Future Change
- Future Commitment

Fields:

- Blocker ID
- Related Entity
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

Default categories:

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

Controllability:

- Internal
- Joint
- External
- Not Software Addressable

---

# 22. Evidence Readiness

Default evidence items:

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

Fields per requirement:

- Required
- Status
- Owner
- Due Date
- Document
- Verified By
- Verified At

Status:

- Missing
- In Progress
- Uploaded
- Verified
- Not Applicable

Formula:

`verified required items / applicable required items × 100`

Display:

- 0–49% Incomplete
- 50–79% Needs Attention
- 80–99% Nearly Ready
- 100% Ready

---

# 23. Documents

COVE bukan generic DMS.

Document hanya mendukung economic workflow.

Fields:

- Document Name
- Document Type
- Related Entity
- File / External URL
- Version
- Uploaded By
- Uploaded At
- Notes

---

# 24. Invoice

Invoice adalah entity terpisah dari Claim.

Satu Claim dapat mempunyai satu atau lebih invoices bila dibutuhkan.

Fields:

- Invoice Number
- Claim
- Project
- Issue Date
- Accepted Date
- Due Date
- Gross Amount
- Retention Amount
- Advance Recovery
- Tax Amount
- Other Deduction
- Net Receivable
- Cash Received
- Outstanding
- Expected Payment Date
- Status
- Finance Owner

Status:

- Draft
- Issued
- Accepted
- Due
- Overdue
- Partially Paid
- Paid
- Disputed
- Cancelled

Net receivable default:

`Gross - Retention - Advance Recovery - Tax - Other Deduction`

Deduction logic harus tetap fleksibel karena kontrak berbeda-beda.

---

# 25. Cash Receipt

Fields:

- Receipt Number
- Invoice
- Project
- Amount
- Payment Date
- Bank Reference
- Notes
- Recorded By

Formula:

`Cash Received = SUM(Cash Receipts)`

`Outstanding = MAX(Net Receivable - Cash Received, 0)`

Jika outstanding = 0 → Paid.

Jika partial → Partially Paid.

Jika due date lewat dan outstanding > 0 → Overdue, kecuali disputed/cancelled.

---

# 26. Retention

Fields:

- Project
- Claim
- Invoice
- Amount
- Release Condition
- Expected Release Date
- Actual Release Date
- Status

Status:

- Held
- Due Soon
- Due
- Released
- Disputed

---

# 27. Action Engine

Semua economic risk penting harus dapat menghasilkan Action.

Fields:

- Action ID
- Project
- Related Entity
- Risk Type
- Financial Exposure
- Title
- Description
- Owner
- Priority
- Created Date
- Due Date
- Status
- Resolution
- Outcome Type
- Outcome Value
- Resolved Date

Status:

- Open
- In Progress
- Waiting External
- Blocked
- Resolved
- Cancelled

Outcome Type:

- Cash Released
- Exposure Reduced
- Claim Recovered
- Margin Protected
- Cost Avoided
- Risk Accepted
- No Financial Outcome
- Unknown

Ketika action diselesaikan, user wajib mengisi resolution dan outcome type.

Outcome value tidak boleh diklaim otomatis sebagai hasil kausal tanpa verifikasi user.

---

# 28. Action Prioritization

P0 menggunakan deterministic scoring berbasis:

- Financial Exposure
- Risk Severity
- Aging
- Deadline Urgency
- Overdue Status

UI harus menjelaskan alasan priority.

Contoh:

**Critical**

- Rp1,2B exposure
- 14 days overdue
- certification pending
- action due today

---

# 29. Command Center

Route:

`/dashboard`

Tujuan:

> Dalam kurang dari 30 detik, management mengetahui apa yang harus diperhatikan hari ini.

## KPI Row

- Cash at Risk
- Pre-Invoice Exposure
- Overdue Receivables
- Expected Collection 30 Days

Setiap KPI:

- nilai;
- jumlah affected records;
- freshness;
- drill-down.

## Money Pipeline

```text
Work Performed → Measured → Claimed → Certified → Invoiced → Collected
```

Setiap stage menampilkan total Rupiah dan gap.

## Top Actions Today

Columns:

- Priority
- Project
- Issue
- Exposure
- Owner
- Due
- Status

## Projects Requiring Attention

Columns:

- Project
- Contract Value
- Cash-at-Risk
- Largest Blocker
- Open Actions
- Expected Cash
- Data Freshness
- Risk

## Expected Collection

- 7 Days
- 30 Days
- 60 Days
- 90 Days

P0 berasal dari expected payment dates, bukan predictive AI.

---

# 30. Progress-to-Cash Portfolio

Route:

`/progress-to-cash`

Columns:

- Project
- Claim
- Period
- Current Stage
- Stage Aging
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
- Evidence Readiness
- Expected Cash Date

---

# 31. Claim Detail

Sections:

1. Summary
2. Economic Pipeline
3. Stage Timeline
4. Evidence
5. Blockers
6. Invoice
7. Actions
8. Activity

Primary CTAs:

- Change Stage
- Add Evidence
- Add Blocker
- Create Action
- Create Invoice

---

# 32. Projects Page

Route:

`/projects`

Search/filter:

- Project
- Client
- Status
- PM
- Risk

Table:

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

---

# 33. Actions Page

Route:

`/actions`

Views:

- My Actions
- All Actions
- Overdue
- Critical
- Resolved

Do not create generic task-management module.

The core question is:

> What economic issue requires my action today?

---

# 34. Reports

P0:

- Cash-at-Risk Report
- Claim Aging
- Certification Aging
- Invoice Aging
- Receivable Aging
- Expected Collection
- Action Aging
- Project Economic Summary

Reports support:

- filters;
- export;
- generated date;
- data freshness.

---

# 35. Data Freshness

Every source-controlled record should store:

- Source Type
- Source Reference
- Source Updated At

Source types:

- Manual
- CSV Import
- XLSX Import
- API
- Integration
- System

Default freshness:

- Fresh: ≤24 hours
- Needs Update: >24 hours and ≤7 days
- Stale: >7 days
- Unknown: source timestamp unavailable

Do not call data “real-time” if stale.

---

# 36. Import System

P0 import types:

- Projects
- Contracts
- Claims
- Invoices
- Cash Receipts

Flow:

```text
Upload
→ Choose Entity
→ Map Columns
→ Validate
→ Preview
→ Confirm Valid Rows
→ Import
→ Summary
```

Invalid rows tidak boleh menggagalkan seluruh import.

User harus dapat download error rows.

Support optional `source_reference` untuk idempotency.

---

# 37. Export

P0:

- CSV
- XLSX

P1:

- PDF

User dapat export filtered data.

---

# 38. Notifications

P0 channels:

- In-App
- Email

Triggers:

- Claim warning SLA
- Claim risk SLA
- Evidence incomplete near submission
- Invoice due soon
- Invoice overdue
- Expected cash missed
- Action due tomorrow
- Action overdue
- Critical blocker

Notification harus actionable.

---

# 39. Feedback Module

Route:

`/feedback`

Button global:

**Send Feedback**

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

Auto-capture:

- User
- Organization
- Page
- Timestamp
- App version if available

---

# 40. Audit Log

Audit critical events:

- Claim financial changes
- Claim stage changes
- Invoice changes
- Cash receipt creation/correction
- Blocker changes
- Action resolution
- Permission/membership changes

Financial records use soft delete/archive/cancel rather than silent hard delete.

---

# 41. Product Analytics

Track:

- login
- project_created
- claim_created
- claim_imported
- claim_stage_changed
- evidence_completed
- blocker_created
- blocker_resolved
- action_created
- action_resolved
- invoice_created
- cash_received
- report_exported
- feedback_submitted

---

# 42. Value Analytics

Track:

- Exposure Detected
- Cash Released
- Exposure Reduced
- Days Accelerated
- Claim Recovered
- Margin Protected
- Cost Avoided
- Actions Resolved
- Average Stage Aging

North Star direction:

# VALUE UNDER CONTROL

---

# 43. Recommended Tech Stack

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend:

- Next.js server-side application layer
- Server Actions where appropriate
- Route Handlers for imports/exports/webhooks/integrations

Database:

- PostgreSQL

Managed Platform:

- Supabase

Authentication:

- Supabase Auth

Storage:

- Supabase Storage

Hosting:

- Vercel

Architecture:

# Modular Monolith

Do not use microservices in V1.

---

# 44. Core Data Entities

P0:

- organizations
- profiles
- organization_members
- project_members
- clients
- projects
- contracts
- claims
- claim_stage_history
- evidence_requirements
- claim_evidence
- documents
- blockers
- invoices
- cash_receipts
- retentions
- stage_sla_rules
- risk_snapshots (optional derived)
- actions
- notifications
- imports
- import_rows
- feedback
- audit_logs
- product_events

P1 reserved:

- commitments
- change_events
- forecasts
- forecast_periods
- margin_snapshots
- cost_records

---

# 45. Routes

Public:

- `/`
- `/login`
- `/forgot-password`
- `/reset-password`

Application:

- `/dashboard`
- `/projects`
- `/projects/[id]`
- `/projects/[id]/progress-to-cash`
- `/progress-to-cash`
- `/actions`
- `/reports`
- `/data`
- `/feedback`
- `/settings`

Future routes behind feature flags:

- `/projects/[id]/cash`
- `/projects/[id]/commitments`
- `/projects/[id]/changes`
- `/projects/[id]/margin`

---

# 46. UX Direction

COVE harus terasa:

- premium;
- serious;
- enterprise;
- financial;
- modern;
- calm;
- high-trust.

Design direction:

- neutral light background;
- deep navy/charcoal primary;
- muted green for healthy;
- amber for watch;
- red for risk;
- strong typography;
- dense but readable financial tables;
- minimal decoration;
- no construction clipart;
- no excessive gradients;
- no rainbow startup aesthetic.

---

# 47. Responsive Behavior

Desktop:
Full functionality.

Tablet:
Full review + moderate input.

Mobile priority:

- Dashboard
- Claim status
- Actions
- Evidence upload
- Notifications

Heavy imports/configuration can be desktop-first.

---

# 48. Demo Data

Seed organization:

**PT Nusantara Buildindo**

Users:

- Raka Pratama — Director
- Dimas Sucipto — Commercial Manager
- Andi Wijaya — Project QS
- Rani Prameswari — Finance Manager
- Fajar Nugroho — Project Manager

Demo project:

**Grand Meridian Office Tower**

Client:

PT Meridian Properti Indonesia

Contract Value:

Rp48.500.000.000

Payment:

Monthly Progress

Retention:

5%

Demo Claim:

**MC-006**

- Work Performed: Rp3.200.000.000
- Measured: Rp3.000.000.000
- Claimed: Rp2.750.000.000
- Certified: Rp2.100.000.000
- Invoiced: Rp2.100.000.000
- Collected: Rp1.400.000.000

Expected gaps:

- Unmeasured: Rp200.000.000
- Unclaimed: Rp250.000.000
- Uncertified: Rp650.000.000
- Invoice Outstanding: Rp700.000.000

Demo blocker:

- Category: Consultant Review
- Exposure: Rp650.000.000
- Owner: Dimas Sucipto
- Controllability: Joint
- Severity: High

Demo action:

- Escalate final quantity approval
- Exposure: Rp650.000.000
- Priority: Critical

At least four demo projects should represent:

1. Certification bottleneck
2. Invoice overdue
3. Evidence incomplete
4. Healthy / collected

Dashboard values must be calculated from seed records, never hard-coded.

---

# 49. Acceptance Criteria

COVE v1 dianggap usable apabila:

1. User dapat login.
2. Admin dapat membuat organization.
3. Admin dapat mengelola users/roles.
4. User tidak dapat mengakses tenant lain.
5. Project dapat dibuat.
6. Contract dapat dibuat.
7. Claim dapat dibuat/import.
8. Claim dapat berpindah stage.
9. Stage history tersimpan.
10. Evidence dapat dilampirkan.
11. Blocker dapat dibuat.
12. Stage aging dihitung otomatis.
13. Value gaps dihitung otomatis.
14. Invoice dapat dibuat.
15. Partial cash receipt dapat dicatat.
16. Outstanding dihitung otomatis.
17. Overdue invoice terdeteksi.
18. Cash-at-Risk terdeteksi tanpa double counting.
19. Risk menunjukkan alasan dan owner.
20. Risk dapat menghasilkan Action.
21. Action dapat diselesaikan dengan outcome.
22. Dashboard berubah berdasarkan data aktual.
23. Report dapat diekspor.
24. Import menangani invalid rows dengan aman.
25. Financial changes memiliki audit trail.
26. Data freshness terlihat.
27. Feedback dapat dikirim.

---

# 50. Critical E2E Flow

Sebelum release, test berikut wajib lulus:

```text
LOGIN
↓
CREATE ORGANIZATION
↓
CREATE PROJECT
↓
CREATE CONTRACT
↓
CREATE / IMPORT CLAIM
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
RECORD OUTCOME
↓
VERIFY DASHBOARD UPDATE
↓
VERIFY AUDIT HISTORY
```

---

# 51. Features Explicitly Not To Build in V1

- Payroll
- HR
- Attendance
- CRM
- Full accounting / general ledger
- Inventory/WMS
- Tender marketplace
- Generic RAB application
- Full procurement ERP
- Gantt authoring
- Primavera replacement
- BIM viewer/editor
- Drawing editor
- Generic chat
- Social feed
- Generic task management
- Generic DMS
- AI chatbot

Do not increase scope without explicit product decision.

---

# 52. First Sellable Product Definition

COVE dapat dijual sebagai early-access product ketika flow berikut berjalan tanpa developer intervention:

```text
SIGN UP
↓
CREATE COMPANY
↓
CREATE PROJECT
↓
CREATE CONTRACT
↓
IMPORT CLAIM
↓
VIEW MONEY PIPELINE
↓
IDENTIFY STUCK VALUE
↓
SEE BLOCKER
↓
ASSIGN ACTION
↓
CREATE INVOICE
↓
RECORD CASH
↓
SEE EXPOSURE REDUCE
```

---

# 53. Definition of Done

COVE v1 dianggap selesai jika:

- Authentication works
- Multi-tenancy secure
- Projects/contracts work
- Progress-to-Cash lifecycle works
- Claim history works
- Evidence works
- Blockers work
- Invoice works
- Cash Receipt works
- Retention works
- Value Gap works
- Cash-at-Risk works
- Action Engine works
- Command Center works
- Reports work
- Import/export works
- Notifications work
- Feedback works
- Audit works
- Demo data works
- Critical E2E passes
- RLS security tests pass
- No P0 critical errors remain

---

# 54. Non-Negotiable Product Rule

Antigravity must not reinterpret COVE into another construction project-management dashboard.

The center of the application must remain:

# ECONOMIC STATE
→
# FINANCIAL EXPOSURE
→
# RESPONSIBLE OWNER
→
# ACTION
→
# VERIFIED OUTCOME

Every future feature must answer:

> What economic decision becomes materially better because this feature exists?

If there is no strong answer:

**DO NOT BUILD.**
