# COVE PHASE 19 — OBSERVABILITY RUNBOOK
## Logging Architecture, Telemetry, Health Calculation & Operational Incident Procedures

---

### 1. Structured Logging Schema

All billing operations emit structured JSON logs via `logBillingEvent` in `domains/billing/observability.ts`:

```json
{
  "timestamp": "2026-09-04T22:36:16.757Z",
  "level": "INFO",
  "message": "Webhook event evt_valid_123 processed successfully.",
  "correlation_id": "corr_1788561376757_09fc0c96",
  "provider": "MAYAR",
  "event_id": "evt_valid_123",
  "invoice_id": "inv_456",
  "subscription_id": "sub_789",
  "org_id": "org_abc",
  "action": "BILLING_OPERATION",
  "status": "SUCCEEDED",
  "retry_count": 0,
  "error_category": null,
  "duration_ms": 3
}
```

---

### 2. Operational Health Metrics & Alert Thresholds

Evaluated dynamically via `evaluateOperationalHealth` in `domains/billing/observability.ts`:

| Metric Name | Calculation Method | Warning / Critical Threshold | Operational Response Action |
|---|---|---|---|
| **Webhook Failure Rate** | `failures / totalEvents * 100` | Alert if **> 2.0%** | Inspect gateway error codes, check token configuration, verify network latency. |
| **Webhook P95 Latency** | 95th percentile latency | Alert if **> 2000ms** | Investigate database connection pools or lock contention. |
| **Reconciliation Queue Age** | Age of oldest unapplied record | Alert if **> 24 hours** | Finance team must review and resolve unmatched transactions in admin portal. |
| **Dunning Recovery Rate** | `recovered / overdue * 100` | Alert if **< 80%** | Audit WhatsApp notification delivery and payment link usability. |

---

### 3. Incident Response Playbooks

#### Playbook 1: Webhook Flood or Replay Storm
1. **Detection:** High webhook traffic volume with elevated duplicate rate.
2. **Behavior:** COVE idempotency layer returns cached HTTP 200 without database mutations.
3. **Action:** Verify provider webhook retry logs. If malicious, rate-limit provider IP or rotate webhook path.

#### Playbook 2: Provider Gateway Outage
1. **Detection:** Webhook failure rate spikes or checkout link generation fails with HTTP 5xx.
2. **Behavior:** Customers attempting to checkout receive user-friendly retry notices; renewal crons do not cancel subscriptions.
3. **Action:** Switch to manual payment instructions in admin control center; notify impacted tenants.

#### Playbook 3: High Reconciliation Queue Volume
1. **Detection:** `reconciliation_queue` contains > 10 unresolved entries older than 12 hours.
2. **Action:** Finance admin opens `/admin/billing`, inspects payload mismatches, and applies manual reconciliation RPC.
