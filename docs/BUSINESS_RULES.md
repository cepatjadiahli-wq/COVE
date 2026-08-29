# COVE Business Rules & Financial Calculation Logic

## 1. Value Gap Engine Formulas

```text
Unmeasured Value           = MAX(Work Performed - Measured, 0)
Unclaimed Value            = MAX(Measured - Claimed, 0)
Uncertified Value          = MAX(Claimed - Certified, 0)
Certified Not Invoiced     = MAX(Certified - Allocated Invoice Gross, 0)
Invoiced Not Collected     = SUM(Invoice Outstanding)
```

---

## 2. Cash-at-Risk Definition & Non-Double-Counting

> **Rule:** Open Value ≠ Cash-at-Risk. Open Value is merely work performed not yet converted to cash. Cash-at-Risk is only generated when open value has an active risk condition (SLA breach, active blocker, evidence incomplete, invoice overdue).

### Risk Categories:
1. `UNMEASURED_AT_RISK`: Open unmeasured value in `WORK_RECORDED` or `MEASUREMENT` with active risk.
2. `UNCLAIMED_AT_RISK`: Open unclaimed value in `CLAIM_PREPARATION` or `CLAIM_READY` with active risk.
3. `UNCERTIFIED_AT_RISK`: Open uncertified value in `SUBMITTED`, `UNDER_REVIEW`, or `DISPUTED` with active risk.
4. `CERTIFIED_NOT_INVOICED_AT_RISK`: Certified value in `CERTIFIED` or `INVOICE_READY` not yet invoiced with active risk.
5. `RECEIVABLE_AT_RISK`: Invoiced value overdue or disputed.
6. `RETENTION_AT_RISK`: Held retention overdue past release condition.

Each Rupiah of value can only be attributed to **at most one** risk category to guarantee zero double counting.

---

## 3. Invoice Net Receivable Formula

```text
Net Receivable = Gross Amount - Retention Amount - Advance Recovery - Tax Amount - Other Deductions
Outstanding    = MAX(Net Receivable - Cash Received, 0)
```

---

## 4. Evidence Readiness Formula

```text
Evidence Readiness % = (Verified Required Items / Total Applicable Required Items) × 100
```
- Items with status `not_applicable` are excluded from the denominator.
- Readiness bands:
  - 0–49%: `INCOMPLETE`
  - 50–79%: `NEEDS_ATTENTION`
  - 80–99%: `NEARLY_READY`
  - 100%: `READY`
