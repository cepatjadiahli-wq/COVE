# COVE — Construction Operations Value Engine

> **Economic Control System for Indonesian Construction Contractors**  
> Primary Wedge: **Progress-to-Cash / Cash-at-Risk Control**  
> Core Loop: **MONEY → RISK → ACTION → OUTCOME**

---

## 1. What is COVE?

**COVE** is an enterprise-grade economic operating system that helps construction contractors control the movement of project value from work performed on site to cash collected in the bank.

COVE answers the critical questions ERPs and generic project management tools miss:
- How much work value has been performed vs measured in opname?
- Where is value stuck across the 17 economic stages?
- How much Rupiah exposure is at risk (Cash-at-Risk)?
- What is the blocker, who owns it, and is it internally controllable?
- What high-priority action is due today?
- How much cash was actually released after the action was resolved?

---

## 2. Tech Stack & Infrastructure

- **Framework**: **Next.js 16.3.3** (Active LTS) with App Router
- **Frontend**: **React 19.0.0**, TypeScript 5.7, Tailwind CSS, Lucide Icons
- **Database Engine**: **PostgreSQL** with Row Level Security (RLS) via Supabase
- **Monetary Precision**: PostgreSQL `NUMERIC(20,2)` (Zero floating-point money errors)
- **Data Persistence**: 100% PostgreSQL Canonical Persistence (Zero business data in `localStorage`)
- **Authentication**: Supabase Auth (Email + Password, SSR Session Handling)
- **Storage**: Supabase Storage with bucket-level RLS
- **Timezone**: `Asia/Jakarta` (WIB)
- **Currency**: `IDR` (Indonesian Rupiah)

---

## 3. Getting Started & Local Setup

### Prerequisites
- Node.js (v18.x, v20.x, or v22.x)
- npm / pnpm / yarn
- Git

### Installation
1. Clone the repository and navigate into the workspace:
   ```bash
   git clone <repo-url>
   cd COVE
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Supabase Database & Migrations

All database schemas, RLS policies, functions, and seed data are version-controlled in `supabase/migrations/`:
- `00001_initial_schema.sql`: 24+ core tables, enums, numeric(20,2) columns, and indexes.
- `00002_rls_policies.sql`: Row Level Security for multi-tenant and project boundaries.
- `00003_storage_policies.sql`: Storage bucket and access policies.
- `00004_functions_and_triggers.sql`: Automated calculations, triggers, and audit logging.
- `00005_seed_demo_data.sql`: Seed data for PT Nusantara Buildindo & 4 demo projects.

To apply migrations on Supabase CLI:
```bash
supabase db reset
```

---

## 5. Running Automated Tests

Run the complete test suite (Unit, Database Integration, Real RLS Penetration, and Browser E2E with LocalStorage Destruction):
```bash
npm test
# or: node tests/runner.js
```

### Test Coverage Summary:
- ✔ **Value Gap Engine** (`tests/unit/gaps.test.js`): Pure Unit Test
- ✔ **Cash-at-Risk Engine** (`tests/unit/risk.test.js`): Pure Unit Test
- ✔ **Invoice & Cash Reconciliation** (`tests/unit/invoices.test.js`): Pure Unit Test
- ✔ **Evidence Readiness** (`tests/unit/evidence.test.js`): Pure Unit Test
- ✔ **Action Prioritization** (`tests/unit/actions.test.js`): Pure Unit Test
- ✔ **Data Freshness** (`tests/unit/freshness.test.js`): Pure Unit Test
- ✔ **Claim Stage Transition** (`tests/integration/claim_transition.test.js`): Database Integration Test
- ✔ **Critical Flow 21-Step** (`tests/e2e/critical_flow.test.js`): Database Integration Test
- ✔ **Multi-Tenant RLS Penetration** (`tests/e2e/rls_security.test.js`): Security Penetration Suite
- ✔ **Real Browser E2E & LocalStorage Destruction** (`tests/e2e/browser_cove_journey.spec.js`): Real Browser & Database E2E

---

## 6. Seed Demo Personas

When running locally, you can switch personas in the TopBar menu to experience role-specific permissions:

| Persona Name | Role | Responsibilities in Demo |
| :--- | :--- | :--- |
| **Raka Pratama** | `OWNER` / Managing Director | Portfolio Cash-at-Risk, Executive Decisions |
| **Dimas Sucipto** | `COMMERCIAL_MANAGER` | Claim Transitions, Blockers, Actions, Recertification |
| **Andi Wijaya** | `QS` / Senior Project QS | Opname Valuations, Claim Preparation, Evidence |
| **Rani Prameswari** | `FINANCE_MANAGER` | Invoicing, Due Dates, Cash Receipts, Reconciliations |
| **Fajar Nugroho** | `PROJECT_MANAGER` | Project Site Status, Site Blockers |

---

## 7. Canonical Demo Scenario: Grand Meridian Office Tower

COVE comes preloaded with the canonical scenario from PRD §48:
- **Contract Value**: Rp 48.500.000.000 (Client: PT Meridian Properti Indonesia)
- **Claim MC-006**:
  - **Work Performed**: Rp 3.200.000.000
  - **Measured**: Rp 3.000.000.000
  - **Claimed**: Rp 2.750.000.000
  - **Certified**: Rp 2.100.000.000 (Phase 1 Initial) → Rp 2.750.000.000 (Phase 2 Recertified)
  - **Invoiced**: Rp 2.750.000.000 Gross (Net Rp 2.6125B after 5% retention)
  - **Cash Collected**: Rp 2.6125B (Fully Collected via partial & final payments)
- **Gaps Identified (Phase 1)**:
  - Unmeasured Gap: **Rp 200.000.000**
  - Unclaimed Gap: **Rp 250.000.000**
  - Uncertified Gap: **Rp 650.000.000**
  - Invoice Outstanding: **Rp 700.000.000**
- **Action Outcome Separation**: `cash_released = Rp 650.000.000` is recorded as managerial effectiveness evidence and does **not** alter cash accounts without valid `cash_receipts`.
- **LocalStorage Destruction Proof**: Clearing browser storage leaves 100% of data intact upon reload because all records reside in PostgreSQL.

---

## 8. Production Build & Deployment

To compile for production:
```bash
npm run build
npm start
```
Deployment target: **Vercel** + **Supabase Database & Storage**.
