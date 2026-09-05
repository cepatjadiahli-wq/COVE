# COVE MAYAR CAPABILITY AND INTEGRATION REPORT
## Mayar Gateway Architectural Verification, Capability Matrix & Contract Analysis

---

### 1. Official Mayar Technical Specification & Capability Matrix

Based on Mayar's official developer documentation (`docs.mayar.id`) and adapter verification:

| Capability Dimension | Mayar Support Status | Technical Specification & Implementation Note |
|---|---|---|
| **Payment Link (Single Charge)** | ✅ Fully Supported | `POST https://api.mayar.id/hl/v1/payment/create` generates hosted checkout URL. |
| **Invoice / Subscription API** | ⚠️ Partial / Hosted | Mayar offers hosted payment links. Headless merchant billing engine is NOT provided. |
| **Tokenization / Headless Card Recurring** | ❌ NOT Supported | Mayar does not provide headless credit card tokenization or background debit APIs. |
| **Customer Portal Hosted by Mayar** | ⚠️ Restricted / External | Requires customer login on Mayar domain. COVE provides its own white-labeled portal. |
| **Webhook Delivery & Retries** | ✅ Supported | Delivers JSON payload on payment events (`payment.received`, `invoice.paid`). |
| **Webhook Signature Mechanism** | ⚠️ Shared Secret Token | Authenticates via `x-mayar-token` or `Authorization: Bearer <TOKEN>`. No HMAC SHA-256. |
| **Sandbox / Test Environment** | ⚠️ Requires Merchant Account | Mayar test environment requires active developer account and generated API keys. |
| **Programmatic Refund API** | ❌ NOT Supported | Mayar does not provide an automated refund API; refunds are managed via Mayar dashboard. |

---

### 2. Realistic Recurring Architecture: Model A vs Model B vs Model C

| Architecture Model | Definition | Feasibility on Mayar | COVE Production Architecture Decision |
|---|---|---|---|
| **Model A: Payment Link Renewal** | COVE internal scheduler triggers renewal, issues invoice, and generates Mayar checkout link. Customer manually authorizes payment each cycle. | ✅ 100% Feasible | **ADOPTED: `MAYAR_PAYMENT_LINK_RENEWAL_ONLY`** |
| **Model B: Mayar-Native Recurring** | Mayar internal subscription engine manages renewal schedules and charges stored customer methods. | ❌ Incompatible | REJECTED: Mayar lacks API controls for custom B2B tiers, proration, and dunning grace periods. |
| **Model C: Headless Tokenized Auto-Debit (Netflix-Style)** | Server stores payment method token and triggers background headless recurring debits at midnight on due date. | ❌ NOT Possible | REJECTED: Mayar has zero APIs for merchant-initiated headless card tokenization. |

#### Architectural Invariants:
1. **Scheduler Ownership:** **COVE** is the sole scheduler owner (`scheduler_owner: 'COVE'`). Renewal sweeps, invoice generation, dunning escalation, and grace periods are fully executed by COVE crons.
2. **Auto-Debit Claim Policy:** COVE explicitly makes **NO CLAIM** of Netflix-style headless background auto-debit on Mayar.

---

### 3. Gap Analysis: Mayar Supported vs COVE Internal Emulation

| Feature Requirement | Supported by Mayar API? | COVE Internal Architecture Solution |
|---|---|---|
| B2B Seat / Project Tiering | No | Managed via COVE Plan Catalog and Entitlement Engine |
| Mid-Cycle Proration | No | Computed deterministically in `domains/billing/proration.ts` |
| 7-Day Grace Period & Dunning | No | Automated via `app/api/internal/cron/dunning` & PostgreSQL RPC |
| Open Data Guarantee (Read-Only Export) | No | Handled by `domains/entitlement/service.ts` |
| Cryptographic Webhook HMAC | No | Verified with timing-safe shared secret token in `lib/mayar/client.ts` |
| Programmatic Refunds | No | Handled by `domains/billing/refund-service.ts` with period-aware entitlement logic |

---

### 4. Adapter & Webhook Normalization Contract

- **Adapter File:** `domains/billing/adapters/mayar-adapter.ts`
- **Client File:** `lib/mayar/client.ts`
- **Webhook Route:** `app/api/webhooks/mayar/route.ts` & `app/api/webhooks/[provider]/route.ts`
- **Normalizer:** Extracts `payment.received` or `invoice.paid` into canonical `PAYMENT_SUCCESS` event.
- **Fail-Closed Security:** Rejects requests with missing or invalid tokens using `crypto.timingSafeEqual`. Throws configuration error in production if `MAYAR_WEBHOOK_SECRET` is missing.

---

### 5. External Network Sandbox Test Status

- **Status:** `NOT RUN — BLOCKED (BLOCKED_EXTERNAL_PROVIDER)`
- **Audit Rule Adherence:** Since `MAYAR_API_KEY` and `MAYAR_WEBHOOK_SECRET` are not present in the local environment, external HTTP requests were intentionally NOT forged or simulated as real gateway responses. The test harness cleanly reported `BLOCKED_EXTERNAL_PROVIDER` without failing the internal suite.
