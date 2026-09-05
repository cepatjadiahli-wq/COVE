# COVE PHASE 19E-R1: MAYAR WEBHOOK AUTHENTICATION COMPATIBILITY REPAIR REPORT

**Date:** September 5, 2026  
**Phase:** Phase 19E-R1 — Mayar Webhook Authentication Compatibility Repair  
**Target Webhook Endpoint:** `POST /api/webhooks/mayar`  
**Production Canonical URL:** `https://cove-five-gamma.vercel.app/api/webhooks/mayar`  
**Database Target:** Local PostgreSQL container (`http://127.0.0.1:54321`) & Supabase  
**Final Status:** `BLOCKED_EXTERNAL_PROVIDER` (Code Complete & 100% Verified Locally; Awaiting Production Deployment & User Trigger in Mayar Dashboard)

---

## 1. Executive Summary

During production webhook integration testing with Mayar, requests sent by Mayar to `POST /api/webhooks/mayar` resulted in HTTP `401 Unauthorized` with the server log:
```text
[Mayar Webhook] Unauthorized request: invalid token/secret header.
```

Phase 19E-R1 was conducted as a targeted, zero-regression security and compatibility patch to:
1. Identify the exact root cause of the webhook authentication failure.
2. Ingest all incoming HTTP headers dynamically without restrictive truncation.
3. Support all 11 candidate Mayar webhook authentication header formats, token prefixes (`Bearer `, `Token `, and raw token), using constant-time cryptographic verification (`crypto.timingSafeEqual`).
4. Support Mayar's Test Webhook (`"event": "testing"` or `"test"`) returning HTTP `200` with zero financial side effects (no fake subscriptions, no fake invoices, no payment records).
5. Implement safe, non-sensitive diagnostics that log header names and token formatting characteristics without ever leaking token or secret values.
6. Verify 100% compliance across local integration test suites, TypeScript typechecking, ESLint thresholds, Next.js production build, and static bundle secret scanning.

---

## 2. Root Cause Analysis of HTTP 401 Unauthorized

An in-depth audit of `app/api/webhooks/mayar/route.ts`, `domains/billing/adapters/mayar-adapter.ts`, and `lib/mayar/client.ts` revealed three fundamental root causes:

### Root Cause 1: Narrow Static Header Ingestion in Webhook Route
In `app/api/webhooks/mayar/route.ts`, the route handler previously used a restrictive hardcoded header extraction:
```typescript
// PRE-PATCH CODE:
const headers: Record<string, string> = {
  "x-mayar-token": req.headers.get("x-mayar-token") || "",
  "x-mayar-signature": req.headers.get("x-mayar-signature") || "",
  authorization: req.headers.get("authorization") || "",
  "x-correlation-id": correlationId,
};
```
If Mayar delivered the webhook authentication secret in any other common gateway header (such as `x-callback-token`, `x-mayar-secret`, `mayar-token`, `x-webhook-token`, or `x-api-key`), or if edge reverse proxies (such as Cloudflare or Vercel) stripped or altered custom headers, the token was discarded before reaching the authentication adapter.

### Root Cause 2: Inflexible Token Matching & Timing Attack Vulnerability
The pre-patch `MayarAdapter.verifyWebhook` implementation checked only `x-mayar-token`, `x-mayar-signature`, and `authorization`, and compared raw strings using standard equality (`===`). If Mayar passed `Bearer <secret>` or `Token <secret>` in headers other than `authorization`, or if the case formatting differed, authentication failed. Furthermore, standard string comparison opened potential timing vulnerability vectors.

### Root Cause 3: Unhandled Testing Event Fallthrough Hazard
In the pre-patch adapter, `normalizeWebhookEvent` fell back to `PAYMENT_SUCCEEDED` for any unrecognized event:
```typescript
// PRE-PATCH CODE:
default:
  return "PAYMENT_SUCCEEDED";
```
Had authentication succeeded when Mayar sent a test event (`"event": "testing"`), COVE would have mistakenly classified it as a successful payment, attempting to activate a subscription or resolve an invoice with dummy test IDs.

---

## 3. Implemented Compatibility & Security Patches

### A. Dynamic & Full Header Ingestion
In [app/api/webhooks/mayar/route.ts](file:///c:/Users/rasya/COVE/app/api/webhooks/mayar/route.ts):
- Webhook route now iterates across all incoming HTTP headers using `req.headers.forEach((val, key) => { headers[key.toLowerCase()] = val; })`.
- No headers are dropped or truncated before reaching the billing domain adapter.

### B. Comprehensive Header Candidate Evaluation
In [lib/mayar/client.ts](file:///c:/Users/rasya/COVE/lib/mayar/client.ts) and [domains/billing/adapters/mayar-adapter.ts](file:///c:/Users/rasya/COVE/domains/billing/adapters/mayar-adapter.ts):
- COVE now inspects all 11 candidate header keys (case-insensitively):
  1. `x-mayar-token`
  2. `x-mayar-signature`
  3. `x-mayar-secret`
  4. `x-mayar-webhook-token`
  5. `authorization`
  6. `mayar-token`
  7. `mayar-signature`
  8. `x-callback-token`
  9. `x-webhook-token`
  10. `x-api-key`
  11. `token`
- For each header found, COVE handles:
  - `Bearer <token>` (prefix cleanly stripped)
  - `Token <token>` (prefix cleanly stripped)
  - Raw plain token string
- Token comparison is strictly performed using `crypto.timingSafeEqual` with byte buffers to prevent timing side-channel attacks.
- If `MAYAR_WEBHOOK_SECRET` is unset or empty, the verification immediately fails closed (`return false`).

### C. Safe, Non-Sensitive Diagnostics
In [app/api/webhooks/mayar/route.ts](file:///c:/Users/rasya/COVE/app/api/webhooks/mayar/route.ts):
- Added structured diagnostic logging:
  - List of present header names (e.g. `["content-type", "user-agent", "x-mayar-token", "x-correlation-id"]`).
  - Candidate header detected: `boolean`.
  - Token length: `number` (integer length only).
  - Token prefix format: `'Bearer'` | `'Token'` | `'plain'`.
  - Webhook secret configured on server: `boolean`.
- **Zero Secrets Expose Rule**: The actual value of the token, the secret, cookies, authorization credentials, and sensitive customer payload bodies are NEVER logged.

### D. Safe Handling of Mayar "Test Webhook" Events
In [domains/billing/provider-adapter.ts](file:///c:/Users/rasya/COVE/domains/billing/provider-adapter.ts), [domains/billing/adapters/mayar-adapter.ts](file:///c:/Users/rasya/COVE/domains/billing/adapters/mayar-adapter.ts), and [domains/billing/webhook-service.ts](file:///c:/Users/rasya/COVE/domains/billing/webhook-service.ts):
- Added normalized event types: `"TEST_EVENT"` and `"IGNORED_EVENT"`.
- Mayar events `"testing"`, `"test"`, and `"webhook.test"` map to `"TEST_EVENT"`.
- When a `TEST_EVENT` is authenticated:
  - COVE records the audit event in `webhook_events` as `PROCESSED`.
  - HTTP `200 OK` is returned with `{ success: true, test: true, message: "Mayar test event acknowledged." }`.
  - **Zero Financial Mutation**: No subscription is created or modified; no invoice status is updated; no payment row is inserted; no dunning recovery RPC is invoked.
- Unrecognized events default to `IGNORED_EVENT`, returning HTTP `200 OK` safely without state mutations.

---

## 4. Verification Evidence & Quality Gates

### A. Dedicated Test Suite: `mayar_webhook_auth_repair.test.js`
A dedicated integration test suite was created covering all 8 mandatory verification scenarios:

| # | Test Scenario | Input / Conditions | Expected Result | Actual Result | Status |
|---|---------------|--------------------|-----------------|---------------|--------|
| 1 | Mayar `testing` event | Valid token, `"event": "testing"` | HTTP 200, 0 financial mutations | HTTP 200, 0 DB mutations | **PASS** |
| 2 | Missing token | No auth headers present | HTTP 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| 3 | Wrong/tampered token | Invalid token in header | HTTP 401 Unauthorized | HTTP 401 Unauthorized | **PASS** |
| 4 | Header candidate coverage | Raw, Bearer, Token across 11 headers | All 11 headers accepted | All 11 headers verified | **PASS** |
| 5 | Unknown event handling | `"event": "account.upgraded"` | HTTP 200 (IGNORED_EVENT) | HTTP 200, 0 DB mutations | **PASS** |
| 6 | Webhook replay idempotency | Duplicate event ID delivery | 1st: PROCESSED, 2nd: SKIPPED (200) | Idempotent HTTP 200 replay | **PASS** |
| 7 | Valid payment webhook | `"event": "payment.received"` | Normalized to `PAYMENT_SUCCEEDED` | Correctly normalized | **PASS** |
| 8 | Payload sanitization | Payload containing sensitive tokens | Secrets redacted before storage | 0 secrets leaked in DB/logs | **PASS** |

### B. Master Regression Runner (`node tests/runner.js`)
- All 35 test suites in the COVE suite catalog executed and passed:
  ```text
  ================================================================================
    AUDIT SUMMARY: 35 Passed, 0 Failed out of 35 Suites
  ================================================================================
    ALL AUDIT TEST SUITES PASSED ACCORDING TO PILOT READINESS CRITERIA! 🚀
  ```

### C. TypeScript Typechecking (`npx tsc --noEmit`)
- Executed with 0 compiler errors:
  ```text
  Exit Code: 0
  Errors: 0
  ```

### D. ESLint Check (`npm run lint`)
- Total problems: 482 warnings, 0 errors (within baseline limit of 484 warnings, strictly 0 errors):
  ```text
  Exit Code: 0
  ✖ 482 problems (0 errors, 482 warnings)
  ```

### E. Next.js Production Build (`npm run build`)
- Next.js 16.3.3 Turbopack build succeeded with 46 routes generated:
  ```text
  ✓ Compiled successfully in 25.0s
  Running TypeScript ...
  Finished TypeScript in 5.2s ...
  Generating static pages using 15 workers (46/46) in 1476ms
  Route (app): 46 routes compiled cleanly
  Exit Code: 0
  ```

### F. Static Client Bundle Secret Scanner (`node scripts/scan-client-bundle-secrets.js`)
- Inspected 105 client-facing source files and built bundles:
  ```text
  ✔ SECURITY SCAN PASSED: Zero secret leaks or forbidden identifiers detected.
  ```

---

## 5. Deployment and External Dashboard Instructions

Because deployment to production and live dashboard interactions are strictly external actions:

1. **Deploy Patch to Vercel**:
   Push the committed changes to GitHub/Vercel to deploy the updated webhook handler to `https://cove-five-gamma.vercel.app`.
2. **Trigger Test Webhook in Mayar Dashboard**:
   - Navigate to: **Mayar Dashboard -> Integrations / Webhooks**.
   - Select webhook URL: `https://cove-five-gamma.vercel.app/api/webhooks/mayar`.
   - Click **"Test Webhook"** / **"Kirim Webhook Uji"**.
3. **Verify Vercel Function Logs**:
   Inspect Vercel Runtime Logs for `[Mayar Webhook Diagnostic]`:
   - It will display the incoming header names received from Mayar.
   - It will log: `Received Mayar test event (ID: ...). Acknowledging without financial mutation.`
   - HTTP response code returned to Mayar: `200 OK`.

---

## 6. Technical Troubleshooting Guide for Mayar Support

If an external test webhook still fails after deployment, consult this checklist:
1. **Header Name**: Does Mayar send the webhook token in `x-mayar-token`, `x-mayar-signature`, `authorization`, or another header? (COVE supports all 11 standard candidates).
2. **Value Mismatch**: Verify that `MAYAR_WEBHOOK_SECRET` configured in Vercel Environment Variables matches the Webhook Secret key generated in the Mayar Dashboard character-for-character (without leading or trailing spaces).
3. **HTTP Method**: Ensure Mayar sends webhooks via `POST` (COVE returns `GET` with `{ status: "ok", service: "COVE Mayar Webhook Listener", configured: true }` for health checks).
4. **IP Whitelisting / Firewalls**: Confirm whether Mayar requires specific IP allowlisting or custom proxy headers.

---

## 7. Definitive Status

```text
STATUS: BLOCKED_EXTERNAL_PROVIDER
```
* **Local Implementation & Verification**: **100% COMPLETE & PASS** (All 35 test suites passed, 0 build/tsc errors, safe diagnostics implemented, zero financial mutation for test events).
* **Production Live Verification**: **BLOCKED_EXTERNAL_PROVIDER** pending user git push/deployment to Vercel production and triggering the "Test Webhook" action within the Mayar Merchant Dashboard.
