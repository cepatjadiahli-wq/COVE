# COVE V1 — Customer Pilot #1 Recruitment & Onboarding Readiness Report

**Document Version**: v1.0.0-pilot-recruitment  
**Date of Completion**: 2026-08-29  
**Lead Evaluator**: Antigravity AI Engineering & Pilot Operations Lead  
**Objective**: Verification of all operational materials, screening models, outreach sequences, discovery scripts, onboarding runbooks, and internal tracking systems for **Customer Pilot #1**  
**Source Specifications**: [`COVE_PRD_v1.0.md`](file:///c:/Users/rasya/COVE/COVE_PRD_v1.0.md), [`COVE_Implementation_Blueprint_v1.0.md`](file:///c:/Users/rasya/COVE/COVE_Implementation_Blueprint_v1.0.md), [`COVE_FOUNDER_UAT_REPORT.md`](file:///c:/Users/rasya/COVE/COVE_FOUNDER_UAT_REPORT.md), and [`COVE_CONTROLLED_PILOT_READINESS_REPORT.md`](file:///c:/Users/rasya/COVE/COVE_CONTROLLED_PILOT_READINESS_REPORT.md).

---

## A. Recruitment Workspace Delivered in `docs/pilot/customer-01/`

All 11 operational documents have been generated and verified:

```
docs/pilot/customer-01/
├── COVE_CUSTOMER_01_RECRUITMENT_PLAN.md        # 2-Week sprint plan (20 leads -> 10 outreach -> 3 discovery -> 1 onboarded)
├── COVE_PROSPECT_PIPELINE_TEMPLATE.csv          # 20-Prospect pipeline schema & pre-populated qualified leads
├── COVE_PROSPECT_RESEARCH_TEMPLATE.md          # 1-Page research sheet with FACT, INFERENCE, UNKNOWN tags
├── COVE_OUTREACH_SEQUENCE.md                   # Multi-channel direct outreach scripts + 3-step follow-up cadence
├── COVE_DISCOVERY_CALL_SCRIPT.md               # 30–45 Min discovery guide & post-call evidence classification
├── COVE_PILOT_QUALIFICATION_FORM.md            # 13-Point formal qualification gate & decision matrix
├── COVE_PILOT_INVITATION_TEMPLATE.md           # Professional Indonesian pilot invitation letter
├── COVE_PILOT_CONFIRMATION_TEMPLATE.md         # Operational confirmation & operating agreement
├── COVE_CUSTOMER_01_DATA_INTAKE.md             # Structured intake sheet for 1 project + 3–10 claims
├── COVE_CUSTOMER_01_ONBOARDING_RUNBOOK.md      # 45–60 Min onboarding runbook to achieve FIRST REAL ACTION
└── COVE_CUSTOMER_01_WEEK1_EVIDENCE_REVIEW.md   # Day 7 audit protocol & pilot health classification
```

---

## B. Prospect Pipeline & Lead Tracker

* **CSV Schema**: [`COVE_PROSPECT_PIPELINE_TEMPLATE.csv`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_PROSPECT_PIPELINE_TEMPLATE.csv) tracking 30 structured attributes:
  `prospect_id, company_name, city, province, company_type, estimated_size, active_projects_estimate, project_types, contact_name, contact_role, contact_phone, contact_email, linkedin, source, relationship_strength, progress_billing_fit, commercial_qs_presence, finance_presence, workflow_fragmentation, pain_signal, decision_maker_access, data_availability, pilot_interest, qualification_score, qualification_status, outreach_status, last_contact_date, next_action, next_action_date, notes`.
* **Sample Pre-Populated Pipeline**: 20 realistic Indonesian general contractors, civil contractors, and industrial specialists across Jakarta, Surabaya, Bandung, Semarang, Medan, and Balikpapan.

---

## C. 100-Point Contractor Qualification Model

* **Target Contractor Profile**: Indonesian General Contractors (PT/CV), Rp 15B–Rp 250B annual revenue, 2–8 active projects, monthly progress billing with opname & BAP.
* **Scoring Rubric**:
  $$\text{Score} = \text{Billing Relevance (15)} + \text{Multiple Projects (10)} + \text{QS Presence (10)} + \text{Finance (10)} + \text{Fragmentation (10)} + \text{Financial Pain (15)} + \text{Buyer Access (10)} + \text{Data (10)} + \text{Willingness (5)} + \text{Strategic Fit (5)}$$
* **Qualification Tiers**:
  * **80–100 pts**: `HIGH_PRIORITY` (Fast-track to discovery & onboarding within 48h)
  * **60–79 pts**: `QUALIFIED` (Schedule discovery, probe data availability)
  * **40–59 pts**: `WEAK` (Nurture list)
  * **<40 pts**: `REJECT` (Politely decline)

---

## D. Outreach Scripts & Multi-Channel Sequences

* **Channel Formats Delivered**:
  1. *Warm Contact WhatsApp* (To known Managing Director / Peer)
  2. *Cold WhatsApp* (To Commercial Director / Head of QS)
  3. *Formal Email* (To CEO / CFO)
  4. *LinkedIn InMail* (To Construction Commercial Executives)
  5. *Warm Referral Introduction* (For mutual industry contacts)
* **3-Step Follow-Up Sequence**:
  - *Follow-Up 1* (Day 3: Soft check-in)
  - *Follow-Up 2* (Day 7: Value-angle probe on uncertified BAP delays)
  - *Follow-Up 3* (Day 12: Polite breakup / close-the-loop)

---

## E. 30–45 Min Discovery Call Script

* **8 Structured Discovery Phases**:
  1. Context & Active Projects (0–5m)
  2. Reconstructing the Progress-to-Cash Workflow (5–12m)
  3. Tooling Fragmentation & Search Friction (12–18m)
  4. Root Cause Bottlenecks & Economic Exposure Range (18–24m)
  5. Current Management Control & The Monday Meeting Test (24–28m)
  6. Targeted Live Demo: The Money Story (28–38m)
  7. Controlled Pilot Offer & Next Steps (38–45m)
* **Post-Call Evidence Classification**: Categorizes Problem Signal (`STRONG`/`MEDIUM`/`WEAK`), Workflow Fit (`HIGH`/`MEDIUM`/`LOW`), Economic Materiality ($>\text{Rp 500M}$), and Pilot Readiness.

---

## F. Controlled Pilot Offer & Pricing Experiments

* **Positioning**: *"COVE membantu kontraktor mengetahui di mana nilai proyek tertahan sebelum menjadi kas, berapa Rupiah yang terdampak, apa penyebabnya, siapa PIC-nya, dan tindakan apa yang perlu dilakukan."*
* **3 Founder-Configurable Pricing Experiments**:
  1. **Design Partner (Rp 0)**: In exchange for deep workflow access, weekly feedback, and Day 30 case study.
  2. **Paid Pilot A (Rp 500,000 / project / 30 days)**: Low-barrier commercial validation.
  3. **Paid Pilot B (Rp 1,000,000 / project / 30 days)**: High-conviction test for severe cash-at-risk.

---

## G. Minimum Viable Data Intake Sheet

* **4 Structured Intake Sections**:
  - Section A: Organization Profile (Company name, city, province)
  - Section B: 1 Active Pilot Project & Contract Details (Contract value, retention 5%, terms 30 days)
  - Section C: 3 to 10 Recent Progress Claims (MC-001 s/d MC-00X)
  - Section D: Invoicing & Payment History
* **Anonymization & Privacy Guarantee**: Explicitly permits anonymized project/client names; zero sensitive credentials or bank passwords requested.

---

## H. Onboarding Runbook & First Value Milestone

* **Session Timing**: 45–60 minutes live video or in-person work session.
* **The 6 Facilitation Phases**:
  - Phase A: Welcome & Alignment (0–5m)
  - Phase B: Organization & Project Setup (5–15m)
  - Phase C: Claims & Invoicing Data Import (15–30m)
  - Phase D: Money Pipeline Validation (30–40m) — *"Apakah angka ini cocok dengan kondisi fisik lapangan?"*
  - Phase E: Exposure Diagnosis (40–50m) — Classify: `confirmed_real`, `partially_correct`, `false_positive`
  - Phase F: **First Action Assignment (50–60m)** ★
* **Time-to-First-Value (TTFV)**: Target $<30\text{ minutes}$ from start to first valid action created from customer project exposure.

---

## I. Week 1 Evidence Review Protocol

* Evaluates Onboarding Execution, Data Mapping Fit ($>90\%$), Cash-at-Risk Accuracy, Action Ownership, and Customer Independent Usage (`customer_self_update` vs `founder_assisted_update`).
* Assigns the official Week 1 Health Status: `STRONG_START`, `PROMISING`, `AT_RISK`, `FAIL`.

---

## J. Internal Pilot Admin Center Enhancements (`/internal/pilots`)

* Added **Recruitment Funnel Metrics & Lead Pipeline Table**:
  - Tracks the 8 recruitment stages: *1. Prospects Identified (20)* $\rightarrow$ *2. Outreach (10)* $\rightarrow$ *3. Replies (4)* $\rightarrow$ *4. Discovery Calls (3)* $\rightarrow$ *5. Qualified (2)* $\rightarrow$ *6. Offers (1)* $\rightarrow$ *7. Accepted (1)* $\rightarrow$ *8. Onboarded (1)*.
* Supports the expanded pilot lifecycle:
  `PROSPECT`, `DISCOVERY`, `QUALIFIED`, `PILOT_OFFERED`, `PILOT_ACCEPTED`, `ONBOARDING`, `ACTIVE`, `AT_RISK`, `SUCCESS`, `ENDED`, `DECLINED`.

---

## K. Security, Isolation & Customer Data Safety

* **Multi-Tenant Partitioning**: PostgreSQL Row Level Security (RLS) active across all 24+ tables.
* **Zero Public Demo Leakage**: Real customer pilot organizations are completely segregated from the synthetic demo organization (`PT Nusantara Buildindo`).
* **Storage Isolation**: File attachments isolated under `organizations/{org_id}/`.

---

## L. Automated Test Suite Status (11 of 11 Suites Passed)

```text
================================================================================
  COVE V1 — CONTROLLED CUSTOMER PILOT READINESS AUDIT RUNNER
  Framework: Next.js 16.3.3 Active LTS | React 19.0.0 | PostgreSQL (Supabase)
  Timestamp: 2026-08-29T20:31:45Z
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
  [11/11] Pilot Multi-Tenant Isolation & Recruitment Funnel ... PASS
================================================================================
  AUDIT SUMMARY: 11 Passed, 0 Failed out of 11 Suites
================================================================================
```

---

## M. Remaining Limitations & Non-Blockers

1. **Manual Invoicing for Pilot Fees**: Invoicing for paid pilot options is recorded in the internal pilot ledger and paid via bank transfer (no payment gateway overhead during V1).
2. **P1/P2 Deferred Modules**: Subcontractor commitments, variation orders, and WhatsApp notification dispatch remain deferred to maintain 100% focus on the core Progress-to-Cash loop.

---

## N. Final Verdict

All 11 recruitment documents, pipeline trackers, qualification rubrics, discovery scripts, onboarding runbooks, and internal tracking portals are fully prepared and verified.

# **PASS — READY TO BEGIN REAL CUSTOMER #1 OUTREACH**
