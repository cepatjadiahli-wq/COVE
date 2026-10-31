# Mayar checkout closure

Scope: finish the existing checkout/profile/webhook changes before entitlement work.

1. Use Mayar V2 `POST /hl/v2/payments/create`, including `redirectUrl`, mobile and expiry.
2. Validate profile input on the server and allow phone completion directly at checkout. Save the phone before creating an organization so a profile failure cannot strand onboarding.
3. Accept the documented payment-request webhook shape without a root ID. Derive a stable ID from event type and transaction ID; resolve the request through `productId`. Keep existing explicit event IDs compatible. Live processing and replay must use the same references.
4. Reject incomplete provider responses and unsafe payment URLs. Never return provider response bodies or credentials in error messages.

Verification: transport-level fetch fixtures (not a replacement checkout function), authenticated profile validation/isolation, official-shaped webhook through the HTTP route, duplicate/conflict handling, out-of-order replay using PostgreSQL semantics, frontend interaction tests, full backend regression and production builds.

Security: existing Bearer authentication, current-profile ownership, tenant-bound sessions and constant-time callback authentication remain authoritative. Pricing remains server-derived. A browser redirect never activates a subscription. No live payment, remote migration or deployment is needed for local verification.

Provider references checked 2026-11-01:
- https://docs.mayar.id/api-reference-v2/migration-from-v1
- https://docs.mayar.id/api-reference-v2/reqpayment/create
- https://docs.mayar.id/api-reference-v2/webhook/newhistory

Live verification remains separate: configured matching-environment API credentials, public callback URL/token and an actual provider delivery are required. Local fixtures are not evidence of a live payment.

## Verification results

- Backend: `npm test` — 435 passed, 0 failed. Full output: `mayar-backend-test-results.txt`.
- Frontend: `npx vitest run test/checkout.test.tsx` — 4 passed. On this Windows environment, set process TEMP and TMP to `frontend/node_modules/.cache/cove-vitest` if the runner cannot rename files in its default temporary directory.
- `npm run build` passed in both backend and frontend. Frontend retains a bundle-size warning.
- New regression tests first reproduced four failures, then passed after implementation.
- Transport fixture covers server pricing, request expiry, V2 response IDs, invalid provider response/URL, raw error redaction, authenticated profile validation and the official webhook shape. PostgreSQL integration covers out-of-order delivery, replay after status repair, duplicate settlement and unchanged access for another tenant.
- UI tests cover missing-phone completion, failure preventing checkout/company creation, and a paid URL parameter that cannot activate access.

## Remaining provider verification

The local environment defaults to Mayar production and has configured credential values, but their validity was not tested. Its frontend origin is not a public HTTPS URL. No provider payment or remote deployment was performed.

For staging UAT, configure a matching Mayar sandbox key/environment, a public frontend origin and public backend callback URL with its callback secret. Verify the redirect is persisted by Mayar, the authenticated callback reaches COVE, one payment activates only its organization, and repeat delivery does not extend the subscription again. Capture redacted provider delivery evidence before calling the live gate complete.
