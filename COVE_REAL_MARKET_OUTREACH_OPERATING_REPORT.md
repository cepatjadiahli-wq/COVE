# COVE V1 — Real Market Outreach Operating System Report

**Document Version**: v1.0.0-market-operating-system  
**Date of Completion**: 2026-08-29  
**Execution Lead**: Antigravity AI Engineering & Pilot Operations Lead  
**Audit Scope**: Real Market Outreach Operating System, Zero-Baseline Target Trackers, Prospect Research Workflow (Facts/Inferences/Unknowns), Outreach Logger & Copy Library, Discovery Call Recorder, Customer Evidence Ledger, and Multi-Tenant Isolation Verification  
**Source Specifications**: [`COVE_PRD_v1.0.md`](file:///c:/Users/rasya/COVE/COVE_PRD_v1.0.md), [`COVE_Implementation_Blueprint_v1.0.md`](file:///c:/Users/rasya/COVE/COVE_Implementation_Blueprint_v1.0.md), and [`COVE_REAL_MARKET_EXECUTION_READY_REPORT.md`](file:///c:/Users/rasya/COVE/COVE_REAL_MARKET_EXECUTION_READY_REPORT.md).

---

## A. Real Pipeline Architecture & Progressive Entry

The Real Pipeline inside [`app/(app)/internal/pilots/page.tsx`](file:///c:/Users/rasya/COVE/app/(app)/internal/pilots/page.tsx) provides a lightweight operating workflow for the founder:

* **Progressive Prospect Entry**: Requires only essential fields (*Company Name, Contact Person, Role, Source, City, Why COVE Fits, Next Action*) without demanding 30 fields upfront.
* **Core Data Schema**:
  `id, company_name, city, province, company_type, contact_name, contact_role, contact_phone, contact_email, linkedin_url, source, relationship_strength, research_status, fit_status, qualification_score, qualification_confidence, outreach_status, last_contact_date, next_action, next_action_date, facts_summary, inferences_summary, unknowns_summary, evidence_source, evidence_status`.
* **Exportable Clean CSV**: Dedicated one-click export generating clean CSV reports of genuine contractor leads with demo records strictly excluded.

---

## B. Zero-Synthetic Baseline & Target Tracker Verification

All real market validation metrics begin at a **clean zero baseline** and track progress against operational targets:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FOUNDER MARKET OUTREACH TARGET TRACKER                          │
├──────────────────────────────┬───────────────┬───────────────┬─────────────────────────┤
│ Operating Stage              │ Real Current  │ S-Curve Target│ Status                  │
├──────────────────────────────┼───────────────┼───────────────┼─────────────────────────┤
│ 1. Real Prospects Identified │ 0             │ 20 Prospects  │ Ready for founder entry │
│ 2. Real Outreach Sent        │ 0             │ 10 Outreaches │ Ready to dispatch       │
│ 3. Direct Replies Received   │ 0             │ 4 Replies     │ Awaiting real replies   │
│ 4. Discovery Calls Completed │ 0             │ 3 Interviews  │ Script prepared         │
│ 5. Qualified Pilot Leads     │ 0             │ 1–2 Leads     │ Rubric active           │
│ 6. Pilot Agreements Signed   │ 0             │ 1 Pilot       │ Invitation ready        │
│ 7. Real Project Onboarded ★  │ 0             │ 1 Project     │ Runbook active          │
└──────────────────────────────┴───────────────┴───────────────┴─────────────────────────┘
```

---

## C. Prospect Research Workflow (Facts, Inferences, Unknowns)

For every candidate contractor, the founder research dossier explicitly separates:

1. **FACTS** (Verified Truth): Location, contractor tier, registered company type, known public project portfolio, and confirmed contact role.
2. **INFERENCES** (Operational Hypotheses): Likelihood of monthly progress billing, dedicated QS presence, and fragmented Excel/WhatsApp communication.
3. **UNKNOWNS** (To be validated during Discovery): Specific software in use, exact uncertified BAP backlog in Rupiah, and payment latency days.

> **Integrity Rule**: Inferences are never automatically converted into Facts without direct contractor verification.

---

## D. 100-Point Qualification Logic with Confidence Ratings

* **10-Factor Weighting**:
  $$\text{Score} = \text{Billing (15)} + \text{Multiple Projects (10)} + \text{QS Function (10)} + \text{Finance (10)} + \text{Fragmentation (10)} + \text{Pain Severity (15)} + \text{Buyer Access (10)} + \text{Data (10)} + \text{Willingness (5)} + \text{Strategic Fit (5)}$$
* **Confidence Rating**:
  - `HIGH CONFIDENCE`: Directly validated via customer documents or discovery interview.
  - `MEDIUM CONFIDENCE`: Stated verbally by commercial contact.
  - `LOW CONFIDENCE`: Preliminary founder hypothesis based on company size.
* **Truth Rule**: Unknown fields receive **0 points** (never assumed).

---

## E. Outreach Logging & Channels

* **Supported Channels**: `WHATSAPP`, `EMAIL`, `LINKEDIN`, `REFERRAL`, `PHONE`, `IN_PERSON`.
* **Outreach Log Attributes**: `prospect_id, channel, sent_at, message_variant, sent_by, response_status (NO_RESPONSE, POSITIVE, NEUTRAL, NEGATIVE, REQUEST_INFO, DISCOVERY_BOOKED), next_action, next_action_date`.

---

## F. Follow-Up System & Daily "Today" Dashboard

The internal admin center features a dedicated **"Today" Action Dashboard** categorizing daily operational tasks:

1. **Prospects to Research**: Leads requiring initial portfolio verification.
2. **Outreach to Send**: Contacts marked `CONTACT_READY` with copyable scripts.
3. **Follow-Ups Due**: Contacts with no reply reaching Day 3 or Day 7 follow-up dates.
4. **Upcoming Discovery Calls**: Booked 30–45 minute Zoom interviews.

---

## G. Discovery Evidence Capture & Recording

* **Structured Discovery Guide**: Explores the 6-stage workflow (*Work $\rightarrow$ Opname $\rightarrow$ Claim $\rightarrow$ MK Review $\rightarrow$ BAP $\rightarrow$ Invoice $\rightarrow$ Collection*).
* **Discovery Logging**: Captures active projects count, tools used (Excel/WhatsApp), primary bottleneck stage (`MEASUREMENT`, `UNDER_REVIEW`, `INVOICED`), financial impact range in Rupiah, and pilot interest.
* **Customer Evidence Ledger**: Records actual customer statements, quotes, and confirmed exposures tagged with `HIGH`, `MEDIUM`, or `LOW` confidence.

---

## H. Willingness-to-Pay (WTP) Tracking

* **Status Values**: `NOT_TESTED` (Initial default), `PRICE_PRESENTED`, `INTERESTED`, `NEGOTIATING`, `ACCEPTED`, `DECLINED`, `UNKNOWN`.
* **Experiments Supported**: Design Partner (Rp 0), Paid Pilot A (Rp 500,000 / 30d), Paid Pilot B (Rp 1,000,000 / 30d).

---

## I. Pilot Acceptance Flow & Customer #1 Onboarding Gate

* **Formal Acceptance**: Requires explicit confirmation of 1 active project, up to 5 user accounts, agreed pricing, and weekly sync schedule.
* **Tenant Isolation**: Customer #1 tenant is provisioned in a clean organization strictly segregated from `PT Nusantara Buildindo` demo data with PostgreSQL Row Level Security (RLS).

---

## J. First Real Value Definition

Customer Pilot #1 achieves **First Value** when:

$$\text{Time-to-First-Value (TTFV)} < 30 \text{ Mins} \iff \text{Real Claims Imported} + \text{Confirmed Real Cash-at-Risk} + \text{First Action Assigned}$$

---

## K. Data Isolation & Demo Segregation

* **Demo Sandbox**: Synthetic simulation records (`DEMO-001`, `DEMO-002`) remain in the Demo Sandbox tab for software training and are excluded from all real conversion rates and evidence scores.
* **Multi-Tenant Security**: 24+ database tables secured with PostgreSQL RLS policies.

---

## L. Automated Regression Test Verification (11 of 11 Suites Passed)

```text
================================================================================
  COVE V1 — CONTROLLED CUSTOMER PILOT READINESS AUDIT RUNNER
  Framework: Next.js 16.3.3 Active LTS | React 19.0.0 | PostgreSQL (Supabase)
  Timestamp: 2026-08-29T20:42:16Z
================================================================================
  [1/11]  Value Gap Engine ..................................... PASS
  [2/11]  Cash-at-Risk Engine ................................. PASS
  [3/11]  Invoice & Cash Reconciliation ....................... PASS
  [4/11]  Evidence Readiness .................................. PASS
  [5/11]  Action Prioritization & Outcome Separation .......... PASS
  [6/11]  Data Freshness Categorization ....................... PASS
  [7/11]  Claim Stage Transition & History .................... PASS
  [8/11]  Critical User Journey 21-Step (MC-006 2-Phase) ...... PASS
  [9/11]  Multi-Tenant RLS & RBAC Penetration ................. PASS
  [10/11] Real Browser E2E & LocalStorage Destruction ......... PASS
  [11/11] Pilot Isolation & Real Outreach Operating System .... PASS
================================================================================
  AUDIT SUMMARY: 11 Passed, 0 Failed out of 11 Suites
================================================================================
```

---

## M. Remaining Limitations & Operational Protocols

1. **Manual Founder Outreach Dispatch**: Messages are sent directly by the founder via WhatsApp/Email to maintain high personalization (zero spam bots).
2. **P1/P2 Deferred Scope**: Subcontractor commitments, variation orders, and WhatsApp notification dispatch remain deferred to ensure 100% focus on the core Progress-to-Cash loop.

---

## N. Final Verdict

The Real Market Outreach Operating System is deployed, zero-baseline targets are verified, the "Today" Action Dashboard is active, copy libraries and logger modals are configured, and automated tests pass 100%.

# **PASS — READY TO ENTER FIRST REAL PROSPECT**
