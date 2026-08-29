# COVE — Pilot Evidence Scorecard & Evaluation Model

> **Purpose**: Standardized framework to evaluate customer pilot evidence quantitatively (1–5 Scale across 12 dimensions) and qualitatively, preventing founder bias.

---

## 1. The 12-Dimension Evaluation Framework

```
┌───────────────────────────────────────────────┬───────┬────────────────────────────────────────────────────────┐
│ Evaluation Dimension                          │ Score │ Scoring Benchmark (1 to 5)                             │
├───────────────────────────────────────────────┼───────┼────────────────────────────────────────────────────────┤
│ 1. Onboarding Completion                      │ [1–5] │ 5 = Done in <30m | 3 = Done in 3 days | 1 = Incomplete │
│ 2. Data Continuity & Excel Mapping            │ [1–5] │ 5 = 100% data mapped | 3 = Minor gaps | 1 = Unusable   │
│ 3. Money Pipeline Calculation Accuracy       │ [1–5] │ 5 = 100% matched field reality | 1 = Numbers doubted   │
│ 4. Cash-at-Risk Detection Accuracy            │ [1–5] │ 5 = Confirmed real by QS | 3 = Some noise | 1 = False  │
│ 5. Economic Materiality of Exposure           │ [1–5] │ 5 = >Rp 500M at stake | 3 = Rp 100M–500M | 1 = <Rp 20M │
│ 6. Action Creation & PIC Assignment           │ [1–5] │ 5 = Assigned & tracked | 3 = Created only | 1 = Zero   │
│ 7. Repeat Usage Frequency                     │ [1–5] │ 5 = Multiple times/week | 3 = Weekly | 1 = Only at demo│
│ 8. Customer Self-Service Data Updates ★       │ [1–5] │ 5 = 100% self-updated | 3 = 50% assisted | 1 = Founder │
│ 9. Verified Outcome Evidence                  │ [1–5] │ 5 = BAP approved / cash released | 1 = No outcome      │
│ 10. Customer Qualitative Satisfaction         │ [1–5] │ 5 = Enthusiastic advocate | 3 = Neutral | 1 = Confused │
│ 11. Willingness to Continue (Renewal)         │ [1–5] │ 5 = Immediate request to continue | 1 = Wants to stop  │
│ 12. Willingness to Pay (Commercial Intent)    │ [1–5] │ 5 = Agrees to paid pricing | 3 = Hesitant | 1 = Refuse │
└───────────────────────────────────────────────┴───────┴────────────────────────────────────────────────────────┘
```

> ★ **Critical Distinction**: Dimension #8 measures whether the contractor updated data independently (`customer_self_update`) or whether the founder had to enter it for them (`founder_assisted_update`).

---

## 2. Quantitative Metric Record

For every pilot organization, record the following standard ledger:

```text
projects_tracked:                     1
claims_tracked:                       [N] claims
total_contract_value_monitored:       Rp [Amount]
open_value:                           Rp [Amount]
cash_at_risk_detected:               Rp [Amount]
customer_confirmed_cash_at_risk:      Rp [Amount]
false_positive_exposure:              Rp [Amount]
actions_created:                      [N]
actions_resolved:                     [N]
exposure_resolved:                    Rp [Amount]
cash_collected_during_monitoring:     Rp [Amount]
verified_financial_outcome:           Rp [Amount]
customer_self_updates_count:          [N]
founder_assisted_updates_count:       [N]
feedback_submissions_count:           [N]
```

---

## 3. The Strict Causality Rule

When compiling outcome reports:

$$\text{INCORRECT: } \text{"COVE generated Rp 1.5B in cash collection."}$$
$$\text{CORRECT: } \text{"Rp 1.5B collected during the 30-day COVE monitoring period."}$$

### Allowed Outcome Attributions:
- **Verified Claim Recertification**: Selisih volume Rp 650M disetujui konsultan MK setelah rapat klarifikasi yang ditugaskan melalui COVE Action.
- **Invoice Acceleration**: Faktur diterbitkan 7 hari lebih awal karena dokumen evidence disiapkan sesuai checklist COVE.
- **Overdue Collection Focus**: Follow-up piutang overdue Rp 595M diprioritaskan oleh Direksi setelah muncul di peringatan Command Center.
