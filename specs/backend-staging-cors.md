# Backend staging: profile route and frontend access

Scope: deploy the latest backend to the existing staging API domain and allow only the exact COVE frontend origins being used for verification.

Team: cepat. Project: cove-backend-staging (prj_1xustL3EdfRm5whlSwuy59KD9Cnk). Domain: https://cove-backend-staging.vercel.app. This project's fixed domain uses Vercel's production target; the customer frontend project is not promoted.

Previous deployment: dpl_7ZhciHk8fJTK442koQGojDptbMq6, commit 9765e22.

Configuration:
- FRONTEND_ORIGIN=https://cove-git-p0c6-mayar-contract-sandbox-cepat.vercel.app
- FRONTEND_ALLOWED_ORIGINS=https://cove-five-gamma.vercel.app,https://cove-8ai4bk8r1-cepat.vercel.app

The canonical origin remains separate from the additional CORS allowlist so payment redirects receive one URL. No wildcard or all-Vercel-domain rule is added. Existing authentication remains required.

Local verification: three CORS regression tests initially reproduced the missing-origin headers. After implementation, all 438 backend tests passed, and npm run build passed. Tests cover preflight from all three intended origins, rejection of unrelated/lookalike domains, PATCH support, request headers, and a COVE-generated 401 for an unauthenticated profile update.

Release gate: deploy the exact reviewed commit to the staging backend project, confirm health 200, PATCH profile 401 from COVE rather than 404, correct allow-origin headers for the intended frontends, and no allow-origin header for an unrelated domain. No account or payment is needed for these checks.
