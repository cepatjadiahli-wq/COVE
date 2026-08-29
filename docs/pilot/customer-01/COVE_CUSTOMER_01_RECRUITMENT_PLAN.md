# COVE — Customer Pilot #1 Recruitment Operating Plan (Zero-Synthetic Baseline)

> **Objective**: Execute a focused, founder-led outbound campaign to recruit, qualify, and onboard **Customer Pilot #1** (1 genuine Indonesian contractor, 1 active project, 3–10 claims, 30-day pilot duration).  
> **Integrity Rule**: Real recruitment metrics start strictly at **0**. No simulated or synthetic data may contribute to customer validation metrics.

---

## 1. Funnel Target & Conversion Benchmarks (Real Activity Target)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          PILOT #1 RECRUITMENT TARGET FUNNEL                            │
├──────────────────────┬─────────────┬───────────────────────────────────────────────────┤
│ Stage                │ Real Target │ Operational Definition                            │
├──────────────────────┼─────────────┼───────────────────────────────────────────────────┤
│ Prospects Identified │ 20 Contacts │ Genuine contractor companies researched by founder│
│ Direct Outreach Sent │ 10 Attempts │ Real personalized messages sent (WA / Email / LI) │
│ Discovery Calls      │ 3 Completed │ Genuine 30–45 min discovery interviews conducted  │
│ Qualified Prospects  │ 1–2 Leads   │ Score $\ge 80/100$ verified on Qualification Rubric│
│ Pilot Offer Accepted │ 1 Customer  │ Contractor signs Pilot Confirmation Agreement     │
│ Active Onboarded     │ 1 Project   │ Real project imported + First Action Assigned ★   │
└──────────────────────┴─────────────┴───────────────────────────────────────────────────┘
```

---

## 2. Evidence Integrity & Classification System

Every contact and insight must carry an evidence tag:

```text
EVIDENCE SOURCE:
- FOUNDER_RESEARCH       (Researched by founder via public registries / project boards)
- FOUNDER_NETWORK        (Personal industry relationship)
- REFERRAL               (Introduced by mutual colleague)
- CUSTOMER_CONVERSATION  (Stated verbally by contractor during call)
- CUSTOMER_DATA          (Verified in actual contractor project document)
- DEMO / SYNTHETIC       (Used for software testing/demonstration only)

CONFIDENCE LEVEL:
- HIGH                   (Backed by direct customer document or confirmed quote)
- MEDIUM                 (Stated verbally during discovery)
- LOW                    (Inferred hypothesis prior to validation)
```

---

## 3. Weekly Operating Cadence (2-Week Recruitment Sprint)

### Week 1: Real Prospecting & Discovery Booking
- **Day 1 (Monday)**:
  - Identify and populate the first 10 real contractor contacts in [`COVE_PROSPECT_PIPELINE_TEMPLATE.csv`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_PROSPECT_PIPELINE_TEMPLATE.csv) or via `/internal/pilots`.
  - Complete research sheet for Top 5 candidates using [`COVE_PROSPECT_RESEARCH_TEMPLATE.md`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_PROSPECT_RESEARCH_TEMPLATE.md) (Tagging FACT vs INFERENCE).
- **Day 2 (Tuesday)**:
  - Send 10 personalized real outreach messages (WhatsApp / Email / LinkedIn).
  - Record outreach date and status in internal portal.
- **Day 3 (Wednesday)**:
  - Process real replies; send Follow-Up 1 to unread contacts.
  - Schedule Discovery Calls 1 and 2 for Thursday/Friday.
- **Day 4–5 (Thursday–Friday)**:
  - Conduct Discovery Call 1 (30–45 mins) using [`COVE_DISCOVERY_CALL_SCRIPT.md`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_DISCOVERY_CALL_SCRIPT.md).
  - Log confirmed quotes and pain statements in **Customer Evidence Ledger**.
  - Complete [`COVE_PILOT_QUALIFICATION_FORM.md`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_PILOT_QUALIFICATION_FORM.md).

### Week 2: Qualification, Pilot Offer & Onboarding
- **Day 6 (Monday)**:
  - Present [`COVE_PILOT_OFFER.md`](file:///c:/Users/rasya/COVE/docs/pilot/COVE_PILOT_OFFER.md) to Director / Commercial Director.
- **Day 7 (Tuesday)**:
  - Receive agreement; issue [`COVE_PILOT_INVITATION_TEMPLATE.md`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_PILOT_INVITATION_TEMPLATE.md) and [`COVE_CUSTOMER_01_DATA_INTAKE.md`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_CUSTOMER_01_DATA_INTAKE.md).
- **Day 8 (Wednesday)**:
  - Receive customer project details (1 active project, 3–10 recent MC claims).
  - Setup clean isolated organization tenant in COVE (`/onboarding`).
- **Day 9 (Thursday)**:
  - Execute 45–60 min Onboarding Session using [`COVE_CUSTOMER_01_ONBOARDING_RUNBOOK.md`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_CUSTOMER_01_ONBOARDING_RUNBOOK.md).
  - Validate Money Pipeline $\rightarrow$ Confirm Cash-at-Risk $\rightarrow$ **Assign First Action**.
- **Day 10 (Friday)**:
  - Issue [`COVE_PILOT_CONFIRMATION_TEMPLATE.md`](file:///c:/Users/rasya/COVE/docs/pilot/customer-01/COVE_PILOT_CONFIRMATION_TEMPLATE.md).
  - Pilot officially enters **Day 1 of 30-Day Active Monitoring**.

---

## 4. Daily Operating Time Blocks

| Time Block | Dedicated Founder Activity |
| :--- | :--- |
| **08:30 – 09:30 WIB** | Review real incoming responses, update pipeline status in `/internal/pilots` |
| **09:30 – 11:30 WIB** | Active direct outreach (WhatsApp voice notes/messages, personalized emails) |
| **13:30 – 15:30 WIB** | Conducting Discovery Calls and live Money Story demos |
| **15:30 – 17:00 WIB** | Logging field evidence in Evidence Ledger, qualification forms, issuing intake sheets |
