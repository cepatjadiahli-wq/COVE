// ============================================================================
// COVE Backend — Comprehensive Authentication & Authorization Security Tests (Gate P0-A.1)
// Covers AUTH-01 through AUTH-20 as specified in Gate P0-A.1 Remediation Directives
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before, after} from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import app from '../src/index.js';
import {db, DataStore} from '../src/db/store.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {config} from '../src/config.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository,
  getIdentityRepository
} from '../src/repositories/identity.repository.js';
import {CANONICAL_MIGRATION_ORDER, getDiscoveredMigrations} from '../src/db/migrate.js';
import {MayarService, setCheckoutClientOverride} from '../src/services/mayar.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testRepo: InMemoryIdentityRepository;

before(() => {
  db.reset();

  testRepo = new InMemoryIdentityRepository();

  // Seed test canonical organizations
  testRepo.organizations = [
    {
      id: 'org-001',
      legalName: 'PT Ruang Karya Konstruksi',
      displayName: 'Ruang Karya',
      timezone: 'Asia/Jakarta',
      defaultCurrency: 'IDR',
      status: 'ACTIVE'
    },
    {
      id: 'org-002',
      legalName: 'PT Mitra Sebelah',
      displayName: 'Mitra Sebelah',
      timezone: 'Asia/Jakarta',
      defaultCurrency: 'IDR',
      status: 'ACTIVE'
    }
  ];

  // Seed test canonical profiles
  testRepo.profiles = [
    { id: 'prof-001', authUserId: 'usr-auth-001', fullName: 'Andi Pratama', status: 'ACTIVE' },
    { id: 'prof-002', authUserId: 'usr-auth-002', fullName: 'Sari Wulandari', status: 'ACTIVE' },
    { id: 'prof-003', authUserId: 'usr-auth-003', fullName: 'Dewi Lestari', status: 'ACTIVE' },
    { id: 'prof-004', authUserId: 'usr-auth-admin', fullName: 'Admin Internal', status: 'ACTIVE' },
    { id: 'prof-005', authUserId: 'usr-auth-004', fullName: 'Bambang Auditor', status: 'ACTIVE' },
    { id: 'prof-006', authUserId: 'usr-auth-org2', fullName: 'Joko Rahasia', status: 'ACTIVE' },
    { id: 'prof-multi', authUserId: 'usr-auth-multi', fullName: 'Multi Member', status: 'ACTIVE' },
    { id: 'prof-onboarding', authUserId: 'usr-auth-onboarding', fullName: 'Calon Pendiri', status: 'ACTIVE' },
    { id: 'prof-suspended', authUserId: 'usr-auth-suspended-999', fullName: 'Suspended User', status: 'SUSPENDED' }
  ];

  // Seed test canonical memberships
  testRepo.memberships = [
    { id: 'mem-001', orgId: 'org-001', profileId: 'prof-001', role: 'OWNER', status: 'ACTIVE' },
    { id: 'mem-002', orgId: 'org-001', profileId: 'prof-002', role: 'QS', status: 'ACTIVE' },
    { id: 'mem-003', orgId: 'org-001', profileId: 'prof-003', role: 'FINANCE_MANAGER', status: 'ACTIVE' },
    { id: 'mem-004', orgId: 'org-001', profileId: 'prof-005', role: 'AUDITOR', status: 'ACTIVE' },
    { id: 'mem-005', orgId: 'org-002', profileId: 'prof-006', role: 'OWNER', status: 'ACTIVE' },
    // Multi-tenant memberships for usr-auth-multi
    { id: 'mem-multi-1', orgId: 'org-001', profileId: 'prof-multi', role: 'QS', status: 'ACTIVE' },
    { id: 'mem-multi-2', orgId: 'org-002', profileId: 'prof-multi', role: 'COMMERCIAL_MANAGER', status: 'ACTIVE' }
  ];

  // Platform Admin (Notice: no tenant membership)
  testRepo.platformAdmins = [
    { id: 'adm-001', authUserId: 'usr-auth-admin', status: 'ACTIVE' }
  ];

  testRepo.platformRoleGrants = [
    { id: 'grant-001', adminId: 'adm-001', roleScope: 'SUPER_ADMIN' }
  ];

  // Inject repository dependency
  setIdentityRepository(testRepo);

  // Configure test token verifier mapping
  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-owner') {
      return {user: {id: 'usr-auth-001', email: 'andi@ruangkarya.co.id'}, error: null};
    }
    if (token === 'token-qs') {
      return {user: {id: 'usr-auth-002', email: 'sari@ruangkarya.co.id'}, error: null};
    }
    if (token === 'token-finance') {
      return {user: {id: 'usr-auth-003', email: 'dewi@ruangkarya.co.id'}, error: null};
    }
    if (token === 'token-platform-admin') {
      return {user: {id: 'usr-auth-admin', email: 'admin@cove.id'}, error: null};
    }
    if (token === 'token-auditor') {
      return {user: {id: 'usr-auth-004', email: 'bambang@auditor.id'}, error: null};
    }
    if (token === 'token-tenant-b') {
      return {user: {id: 'usr-auth-org2', email: 'joko@sebelah.co.id'}, error: null};
    }
    if (token === 'token-multi') {
      return {user: {id: 'usr-auth-multi', email: 'multi@cove.id'}, error: null};
    }
    if (token === 'token-onboarding') {
      return {user: {id: 'usr-auth-onboarding', email: 'pendiri@baru.co.id'}, error: null};
    }
    if (token === 'token-fresh-bootstrap') {
      return {user: {id: 'usr-auth-fresh-99', email: 'fresh@cove.id', user_metadata: {full_name: 'Fresh User'}}, error: null};
    }
    if (token === 'token-no-org') {
      return {user: {id: 'usr-auth-no-org-101', email: 'noorg@cove.id', user_metadata: {full_name: 'No Org User'}}, error: null};
    }
    if (token === 'token-suspended') {
      return {user: {id: 'usr-auth-suspended-999', email: 'suspended@cove.id', user_metadata: {full_name: 'Suspended User'}}, error: null};
    }
    return {user: null, error: 'Token otentikasi tidak valid atau sudah kedaluwarsa.'};
  });
});

after(() => {
  setTestTokenVerifier(null);
});

test('AUTH-01: Request tenant API tanpa Authorization -> 401', async () => {
  const res = await app.request('/api/projects');
  assert.strictEqual(res.status, 401, 'Harus mengembalikan HTTP 401 Unauthorized');
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.match(body.error, /Autentikasi diperlukan/);
});

test('AUTH-02: Valid verified auth identity -> /auth/me returns real server actor', async () => {
  const res = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-owner'
    }
  });
  assert.strictEqual(res.status, 200, 'Harus mengembalikan HTTP 200 OK');
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.actor.authUserId, 'usr-auth-001');
  assert.strictEqual(body.data.actor.orgId, 'org-001');
  assert.strictEqual(body.data.actor.role, 'OWNER');
  assert.strictEqual(body.data.actor.fullName, 'Andi Pratama');
  assert.strictEqual(body.data.actor.isPlatformAdmin, false);
});

test('AUTH-03: Invalid/expired token -> 401', async () => {
  const res = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer invalid-expired-or-tampered-token'
    }
  });
  assert.strictEqual(res.status, 401, 'Harus mengembalikan HTTP 401');
  const body = await res.json();
  assert.strictEqual(body.success, false);
});

test('AUTH-04: User tenant A tidak dapat mengakses data tenant B -> 404 / 403', async () => {
  // Org A
  const resOrgA = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-owner' }
  });
  assert.strictEqual(resOrgA.status, 200);
  const dataOrgA = await resOrgA.json();
  const orgAProjectCodes = dataOrgA.data.map((p: any) => p.code);
  assert.ok(orgAProjectCodes.includes('COV-001'));
  assert.ok(!orgAProjectCodes.includes('EXT-001'), 'Org A tidak boleh melihat EXT-001');

  // Org B
  const resOrgB = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-tenant-b' }
  });
  assert.strictEqual(resOrgB.status, 200);
  const dataOrgB = await resOrgB.json();
  const orgBProjectCodes = dataOrgB.data.map((p: any) => p.code);
  assert.ok(orgBProjectCodes.includes('EXT-001'));
  assert.ok(!orgBProjectCodes.includes('COV-001'), 'Org B tidak boleh melihat COV-001');

  // Cross-tenant direct access
  const resCrossDetail = await app.request('/api/projects/p1', {
    headers: { Authorization: 'Bearer token-tenant-b' }
  });
  assert.strictEqual(resCrossDetail.status, 404, 'Cross-tenant detail access must return 404');
});

test('AUTH-05: Tenant OWNER membuka /api/admin/* -> 403', async () => {
  const res = await app.request('/api/admin/metrics', {
    headers: { Authorization: 'Bearer token-owner' }
  });
  assert.strictEqual(res.status, 403, 'Tenant OWNER harus ditolak dengan 403 Forbidden pada route platform admin');
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.match(body.error, /Hanya Platform Administrator/);
});

test('AUTH-06: Platform admin tanpa tenant membership -> platform admin route allowed, role === null, isPlatformAdmin === true', async () => {
  // Admin route allowed
  const resAdmin = await app.request('/api/admin/metrics', {
    headers: { Authorization: 'Bearer token-platform-admin' }
  });
  assert.strictEqual(resAdmin.status, 200, 'Platform admin harus diizinkan pada /api/admin/metrics');

  // /api/auth/me contract verification
  const resMe = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-platform-admin' }
  });
  assert.strictEqual(resMe.status, 200);
  const bodyMe = await resMe.json();
  assert.strictEqual(bodyMe.data.actor.isPlatformAdmin, true, 'isPlatformAdmin must be true');
  assert.strictEqual(bodyMe.data.actor.role, null, 'role must be null for platform admin without tenant membership');
  assert.strictEqual(bodyMe.data.actor.orgId, null, 'orgId must be null');
  assert.strictEqual(bodyMe.data.actor.membershipId, null, 'membershipId must be null');
});

test('AUTH-07: QS: allowed commercial capability, denied finance-only mutation', async () => {
  // QS commercial ledger mutation
  const commercialRes = await app.request('/api/projects/p1/ledger/entry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-qs'
    },
    body: JSON.stringify({
      stageIndex: 0,
      amount: 50000000,
      reason: 'Progress minggu 2'
    })
  });
  assert.strictEqual(commercialRes.status, 200, 'QS harus diizinkan mutasi komersial');

  // QS finance invoice creation
  const financeRes = await app.request('/api/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-qs'
    },
    body: JSON.stringify({
      projectId: 'p1',
      number: 'INV/TEST/001',
      principal: 100000000,
      certificate: 'BAP-001'
    })
  });
  assert.strictEqual(financeRes.status, 403, 'QS harus ditolak (403) saat membuat invoice');
});

test('AUTH-08: FINANCE_MANAGER: allowed invoice capability, denied commercial ledger mutation', async () => {
  // Commercial ledger mutation denied
  const commercialRes = await app.request('/api/projects/p1/ledger/entry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-finance'
    },
    body: JSON.stringify({
      stageIndex: 0,
      amount: 50000000,
      reason: 'Finance unauthorized ledger write'
    })
  });
  assert.strictEqual(commercialRes.status, 403, 'Finance harus ditolak (403) saat mencatat ledger komersial');

  // Cash receipt allowed
  const receiptRes = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-finance'
    },
    body: JSON.stringify({
      projectId: 'p1',
      amount: 10000000,
      receivedDate: '2026-09-08',
      allocations: [{invoiceId: 'i1', amount: 10000000}]
    })
  });
  assert.strictEqual(receiptRes.status, 200, 'Finance berwenang mencatat kas masuk');
});

test('AUTH-09: AUDITOR mutation -> 403', async () => {
  const readRes = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-auditor' }
  });
  assert.strictEqual(readRes.status, 200, 'Auditor diizinkan membaca');

  const writeRes = await app.request('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-auditor'
    },
    body: JSON.stringify({
      name: 'Proyek Tidak Sah',
      code: 'AUDIT-FAIL-01'
    })
  });
  assert.strictEqual(writeRes.status, 403, 'Auditor harus ditolak membuat proyek (403)');
});

test('AUTH-10: Mayar webhook: missing callback token -> reject, wrong token -> reject, correct token -> allow', async () => {
  const payload = {
    event: 'payment.settled',
    id: `evt_test_${Date.now()}`,
    data: {
      id: `pay_${Date.now()}`,
      status: 'SUCCESS',
      customer_name: 'PT Ruang Karya Konstruksi',
      amount: 4900000
    }
  };

  // Missing token
  const resMissing = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(resMissing.status, 401, 'Tanpa token harus 401');

  // Wrong token
  const resWrong = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': 'wrong-signature-attack'
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(resWrong.status, 401, 'Token salah harus 401');

  // Correct token
  const resCorrect = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(resCorrect.status, 200, 'Token valid harus 200');
});

test('AUTH-11: Frontend startup: default role is null (not OWNER), actor is null, authStatus is loading', () => {
  const storeFilePath = path.resolve(__dirname, '../../frontend/lib/store.tsx');
  const content = fs.readFileSync(storeFilePath, 'utf-8');

  // Verify role initializes to null
  assert.match(content, /useState<TenantRole\s*\|\s*null>\(null\)/, 'role harus diinisialisasi null');
  assert.doesNotMatch(content, /useState<.*>\(['"]OWNER['"]\)/, 'role TIDAK BOLEH default OWNER');

  // Verify actor initializes to null
  assert.match(content, /useState<any\s*\|\s*null>\(null\)/, 'actor harus diinisialisasi null');

  // Verify authStatus initializes to loading
  assert.match(content, /useState<.*>\(['"]loading['"]\)/, 'authStatus harus diinisialisasi loading');

  // Verify no setRole is exported from the store
  assert.doesNotMatch(content, /setRole\s*:\s*setRoleState/, 'setRole DILARANG diekspor oleh store');
});

test('AUTH-12: /preview unavailable in production build', () => {
  const appFilePath = path.resolve(__dirname, '../../frontend/app/App.tsx');
  const content = fs.readFileSync(appFilePath, 'utf-8');

  // Verify no PreviewHub import
  assert.doesNotMatch(content, /import\s+.*PreviewHub/, 'PreviewHub tidak boleh diimpor di App.tsx');

  // Verify no production /preview route
  assert.doesNotMatch(content, /path\s*===\s*['"]\/preview['"]/, 'Route /preview tidak boleh ada di App.tsx');

  // Verify preview.tsx does not exist in production features
  const previewPath = path.resolve(__dirname, '../../frontend/features/preview.tsx');
  assert.strictEqual(fs.existsSync(previewPath), false, 'frontend/features/preview.tsx harus dihapus dari codebase');
});

test('AUTH-13: Email verification UI click alone cannot create authenticated state', () => {
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const content = fs.readFileSync(accessFilePath, 'utf-8');

  // Verify VerifyEmailPage does not manually set signedIn: true
  assert.doesNotMatch(
    content,
    /export\s+function\s+VerifyEmailPage[\s\S]*?signedIn\s*:\s*true/,
    'VerifyEmailPage DILARANG secara manual mengubah signedIn menjadi true'
  );
});

test('AUTH-14: Invitation frontend cannot locally activate subscription/membership', () => {
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const content = fs.readFileSync(accessFilePath, 'utf-8');

  // Verify InvitationPage body does not mutate status/activePlan locally
  const invSnippet = content.slice(content.indexOf('function InvitationPage'), content.indexOf('function OnboardingCompanyPage'));
  assert.doesNotMatch(
    invSnippet,
    /status\s*:\s*['"]active['"]/,
    'InvitationPage DILARANG secara lokal mengaktifkan subscription'
  );
});

test('AUTH-15: Checkout uses backend endpoint and no hardcoded VA exists', async () => {
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const content = fs.readFileSync(accessFilePath, 'utf-8');

  // Verify no hardcoded VA
  assert.doesNotMatch(content, /8829-0123-9981-4402/, 'Hardcoded VA 8829-0123-9981-4402 DILARANG');

  // Verify backend checkout endpoint integrates with provider (or returns 503 if unconfigured)
  setCheckoutClientOverride(async (params) => ({
    success: true,
    data: {
      checkoutRef: 'chk_prov_scale_001',
      planId: params.planId,
      subtotal: 9900000,
      tax: 1089000,
      total: 10989000,
      paymentUrl: 'https://checkout.mayar.id/pay/chk_prov_scale_001',
      status: 'PENDING'
    }
  }));

  try {
    const res = await app.request('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-owner'
      },
      body: JSON.stringify({ planId: 'scale' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.planId, 'scale');
    assert.strictEqual(data.data.checkoutRef, 'chk_prov_scale_001');
    assert.strictEqual(data.data.paymentUrl, 'https://checkout.mayar.id/pay/chk_prov_scale_001');
  } finally {
    setCheckoutClientOverride(null);
  }
});

test('AUTH-16: Platform admin without membership is never tenant ADMIN', async () => {
  const res = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-platform-admin' }
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.data.actor.role, null, 'Role harus null, BUKAN ADMIN');
  assert.notStrictEqual(data.data.actor.role, 'ADMIN', 'Platform admin tidak boleh menjadi tenant ADMIN');
});

test('AUTH-17: Test token verifier cannot be enabled in production runtime', () => {
  const savedEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => {
        setTestTokenVerifier(async () => ({ user: null, error: null }));
      },
      /CRITICAL SECURITY VIOLATION/,
      'Memanggil setTestTokenVerifier di luar test harus throw fatal error'
    );
  } finally {
    process.env.NODE_ENV = savedEnv;
  }
});

test('AUTH-18: Identity/membership resolution no longer uses legacy JSON store', async () => {
  // Temporarily empty out legacy JSON store profiles & memberships
  const savedProfiles = db.profiles;
  const savedMemberships = db.organizationMemberships;
  (db as any).profiles = [];
  (db as any).organizationMemberships = [];

  try {
    // Auth should still succeed through canonical IdentityRepository
    const res = await app.request('/api/auth/me', {
      headers: { Authorization: 'Bearer token-owner' }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.actor.fullName, 'Andi Pratama');
    assert.strictEqual(body.data.actor.role, 'OWNER');
  } finally {
    (db as any).profiles = savedProfiles;
    (db as any).organizationMemberships = savedMemberships;
  }
});

test('AUTH-19: Admin audit writes to PostgreSQL canonical admin_audit_logs', async () => {
  const beforeCount = testRepo.adminAuditLogs.length;

  const res = await app.request('/api/admin/metrics', {
    headers: { Authorization: 'Bearer token-platform-admin' }
  });
  assert.strictEqual(res.status, 200);

  // Assert logged in repository
  assert.strictEqual(
    testRepo.adminAuditLogs.length,
    beforeCount + 1,
    'Aksi admin harus dicatat di adminAuditLogs repository'
  );
  const lastLog = testRepo.adminAuditLogs[testRepo.adminAuditLogs.length - 1];
  assert.strictEqual(lastLog.resource, 'ADMIN_CONSOLE');
  assert.match(lastLog.action, /GET .*\/admin\/metrics/);
});

test('AUTH-20: Multi-membership ambiguity does not silently select first membership', async () => {
  // 1. Request without explicit selection -> rejects with 400 TENANT_SELECTION_REQUIRED
  const resAmbiguous = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-multi' }
  });
  assert.strictEqual(resAmbiguous.status, 400, 'Ambiguous multi-tenant request must return HTTP 400');
  const bodyAmbiguous = await resAmbiguous.json();
  assert.strictEqual(bodyAmbiguous.code, 'TENANT_SELECTION_REQUIRED');

  // 2. Request with valid x-organization-id for Org 1 -> resolves Org 1 (role QS)
  const resOrg1 = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': 'org-001'
    }
  });
  assert.strictEqual(resOrg1.status, 200);
  const bodyOrg1 = await resOrg1.json();
  assert.strictEqual(bodyOrg1.data.actor.orgId, 'org-001');
  assert.strictEqual(bodyOrg1.data.actor.role, 'QS');

  // 3. Request with valid x-organization-id for Org 2 -> resolves Org 2 (role COMMERCIAL_MANAGER)
  const resOrg2 = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': 'org-002'
    }
  });
  assert.strictEqual(resOrg2.status, 200);
  const bodyOrg2 = await resOrg2.json();
  assert.strictEqual(bodyOrg2.data.actor.orgId, 'org-002');
  assert.strictEqual(bodyOrg2.data.actor.role, 'COMMERCIAL_MANAGER');

  // 4. Request with invalid/unauthorized organization ID -> 403 Forbidden
  const resUnauthorized = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': 'org-unauthorized-999'
    }
  });
  assert.strictEqual(resUnauthorized.status, 403, 'Unauthorized tenant selection must return HTTP 403');
});

test('MIGRATION-ORDER: Canonical migrations execute in strict order without 003_seed_data', () => {
  const migrations = getDiscoveredMigrations();
  const idx003b = migrations.indexOf('003b_platform_admin_foundation.sql');
  const idx004 = migrations.indexOf('004_extended_growth_feedback_schema.sql');
  const idx005 = migrations.indexOf('005_identity_access_hardening.sql');

  assert.ok(idx003b !== -1, '003b_platform_admin_foundation.sql must exist');
  assert.ok(idx004 !== -1, '004_extended_growth_feedback_schema.sql must exist');
  assert.ok(idx005 !== -1, '005_identity_access_hardening.sql must exist');

  assert.ok(idx003b < idx004, '003b must execute BEFORE 004');
  assert.ok(idx004 < idx005, '004 must execute BEFORE 005');
});

// ============================================================================
// GATE P0-A.2 FINAL IDENTITY & AUTHORITY REMEDIATION TESTS (AUTH-21 to AUTH-35)
// ============================================================================

test('AUTH-21: SignUp without confirmed session leaves user unauthenticated', () => {
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const code = fs.readFileSync(accessFilePath, 'utf-8');

  // Verify that SignupPage inspects session and does not set signedIn = true
  assert.ok(code.includes('signUpData?.session'), 'SignupPage must inspect signUpData?.session');
  assert.ok(code.includes('/verify-email'), 'Unconfirmed signup must navigate to /verify-email');
  
  // Verify that signedIn is not set unconditionally in SignupPage
  const signupSnippet = code.slice(code.indexOf('function SignupPage'), code.indexOf('function VerifyEmailPage'));
  assert.strictEqual(
    signupSnippet.includes('signedIn: true'),
    false,
    'SignupPage must not set signedIn: true'
  );
});

test('AUTH-22: UI clicks after signup cannot enter protected app without real session', async () => {
  // 1. Backend: unauthenticated requests to protected endpoints return 401
  const resProjects = await app.request('/api/projects');
  assert.strictEqual(resProjects.status, 401);

  const resAdmin = await app.request('/api/admin/metrics');
  assert.strictEqual(resAdmin.status, 401);

  // 2. Frontend: OnboardingProjectPage guards against unauthenticated actor
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const code = fs.readFileSync(accessFilePath, 'utf-8');
  assert.ok(
    code.includes("authStatus !== 'authenticated' || !s.actor"),
    'OnboardingProjectPage must guard against unauthenticated actor'
  );
});

test('AUTH-23: Forgot password redirect contains /reset-password', () => {
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const code = fs.readFileSync(accessFilePath, 'utf-8');
  assert.ok(
    code.includes('/reset-password'),
    'ForgotPasswordPage must include /reset-password redirect target'
  );
});

test('AUTH-24: /reset-password route exists and calls updateUser()', () => {
  const appFilePath = path.resolve(__dirname, '../../frontend/app/App.tsx');
  const appCode = fs.readFileSync(appFilePath, 'utf-8');
  assert.ok(
    appCode.includes("path === '/reset-password'"),
    'App.tsx must include /reset-password route'
  );
  assert.ok(
    appCode.includes('ResetPasswordPage'),
    'App.tsx must render ResetPasswordPage'
  );

  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const accessCode = fs.readFileSync(accessFilePath, 'utf-8');
  assert.ok(
    accessCode.includes('supabase.auth.updateUser({ password })'),
    'ResetPasswordPage must call supabase.auth.updateUser({ password })'
  );
});

test('AUTH-25: Organization onboarding cannot mark complete locally without server write', async () => {
  // 1. Unauthenticated request to POST /api/organizations is rejected
  const resUnauth = await app.request('/api/organizations', {
    method: 'POST',
    body: JSON.stringify({ legalName: 'PT Fraudulent' })
  });
  assert.strictEqual(resUnauth.status, 401);

  // 2. Authenticated user without org creates organization on server
  const resCreate = await app.request('/api/organizations', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-onboarding',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      legalName: 'PT Maju Terus Konstruksi',
      displayName: 'Maju Terus'
    })
  });
  assert.strictEqual(resCreate.status, 201);
  const bodyCreate = await resCreate.json();
  assert.strictEqual(bodyCreate.success, true);
  assert.strictEqual(bodyCreate.data.organization.legalName, 'PT Maju Terus Konstruksi');
  assert.strictEqual(bodyCreate.data.membership.role, 'OWNER');

  // Verify identity repository has the new organization and membership persisted
  const org = await testRepo.getOrganizationById(bodyCreate.data.organization.id);
  assert.ok(org, 'Created organization must exist in repository');
  const memberships = await testRepo.getActiveMembershipsByProfileId('prof-onboarding');
  assert.strictEqual(memberships.length, 1);
  assert.strictEqual(memberships[0].role, 'OWNER');
});

test('AUTH-26: Payment status page contains no journey.status authority', async () => {
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const accessCode = fs.readFileSync(accessFilePath, 'utf-8');
  
  // Verify that journey.status === 'pending' is completely eliminated
  assert.strictEqual(
    accessCode.includes("journey.status === 'pending'"),
    false,
    "PaymentStatusPage must not have journey.status === 'pending' fallback"
  );
  assert.ok(
    accessCode.includes('api.getBilling()'),
    'PaymentStatusPage must derive status from api.getBilling()'
  );

  // Backend GET /api/billing returns canonical server-derived status
  const res = await app.request('/api/billing', {
    headers: { Authorization: 'Bearer token-owner' }
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(['NONE', 'PENDING', 'ACTIVE', 'FAILED', 'EXPIRED'].includes(body.data.status));
});

test('AUTH-27: Checkout contains no synthetic checkout URL generator', () => {
  const billingRoutePath = path.resolve(__dirname, '../src/routes/billing.ts');
  const billingCode = fs.readFileSync(billingRoutePath, 'utf-8');
  assert.strictEqual(
    billingCode.includes('COV-PAY-'),
    false,
    'Billing route must not contain synthetic COV-PAY- URL generator'
  );

  const mayarServicePath = path.resolve(__dirname, '../src/services/mayar.service.ts');
  const mayarCode = fs.readFileSync(mayarServicePath, 'utf-8');
  assert.strictEqual(
    mayarCode.includes('COV-PAY-'),
    false,
    'MayarService must not contain synthetic COV-PAY- URL generator'
  );

  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const accessCode = fs.readFileSync(accessFilePath, 'utf-8');
  assert.strictEqual(
    accessCode.includes('COV-PAY-'),
    false,
    'Frontend access.tsx must not contain synthetic COV-PAY- generator'
  );
});

test('AUTH-28: Provider unavailable returns explicit PAYMENT_PROVIDER_NOT_CONFIGURED', async () => {
  // 1. Without configuration and without mock override -> returns 503
  setCheckoutClientOverride(null);
  const resUnavailable = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ planId: 'core' })
  });
  assert.strictEqual(resUnavailable.status, 503);
  const bodyUnavailable = await resUnavailable.json();
  assert.strictEqual(bodyUnavailable.error, 'PAYMENT_PROVIDER_NOT_CONFIGURED');

  // 2. With mock provider configured -> returns 200 with checkout URL
  setCheckoutClientOverride(async (params) => {
    return {
      success: true,
      data: {
        checkoutRef: 'chk_test_999',
        planId: params.planId,
        subtotal: 4900000,
        tax: 0,
        total: 4900000,
        paymentUrl: 'https://checkout.mayar.id/chk_test_999',
        status: 'PENDING'
      }
    };
  });

  try {
    const resSuccess = await app.request('/api/billing/checkout', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-owner',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ planId: 'core' })
    });
    assert.strictEqual(resSuccess.status, 200);
    const bodySuccess = await resSuccess.json();
    assert.strictEqual(bodySuccess.success, true);
    assert.strictEqual(bodySuccess.data.paymentUrl, 'https://checkout.mayar.id/chk_test_999');
  } finally {
    setCheckoutClientOverride(null);
  }
});

test('AUTH-29: Production migration runner does NOT execute 003_seed_data.sql', () => {
  assert.strictEqual(
    (CANONICAL_MIGRATION_ORDER as readonly string[]).includes('003_seed_data.sql'),
    false,
    'CANONICAL_MIGRATION_ORDER must NOT contain 003_seed_data.sql'
  );

  const discovered = getDiscoveredMigrations();
  assert.strictEqual(
    discovered.includes('003_seed_data.sql'),
    false,
    'getDiscoveredMigrations() must NOT include 003_seed_data.sql'
  );

  const seedDevPath = path.resolve(__dirname, '../src/db/seed_dev.ts');
  assert.ok(fs.existsSync(seedDevPath), 'Dedicated seed_dev.ts script must exist');
  const seedCode = fs.readFileSync(seedDevPath, 'utf-8');
  assert.ok(seedCode.includes("NODE_ENV === 'production'"), 'seed_dev.ts must check NODE_ENV');
  assert.ok(seedCode.includes('ALLOW_DEV_SEED'), 'seed_dev.ts must require ALLOW_DEV_SEED');
});

test('AUTH-30: Clean PostgreSQL migration SQL chain executes successfully', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = new PGlite();

  // Setup Supabase auth schema and test roles fixtures
  await pglite.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      encrypted_password TEXT,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      phone TEXT,
      email_confirmed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    BEGIN
      RETURN '00000000-0000-0000-0000-000000000001'::UUID;
    END;
    $$ LANGUAGE plpgsql STABLE;

    CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS UUID AS $$
      SELECT gen_random_uuid();
    $$ LANGUAGE sql;

    INSERT INTO pg_extension (oid, extname, extowner, extnamespace, extrelocatable, extversion)
    SELECT 16384, 'uuid-ossp', 10, oid, true, '1.1'
    FROM pg_namespace WHERE nspname = 'public';
  `);

  const migrationsDir = path.resolve(__dirname, '../migrations');
  for (const filename of CANONICAL_MIGRATION_ORDER) {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');
    await pglite.exec(sql);
  }

  // 1. Verify all tables exist (should have > 50 tables in public schema)
  const resTables = await pglite.query<{ count: string }>(
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
  );
  assert.ok(parseInt(resTables.rows[0].count, 10) >= 50, 'Must have at least 50 public tables');

  // 2. Verify foreign key constraints are established
  const resFk = await pglite.query(
    "SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_name = 'fk_profiles_auth_user'"
  );
  assert.strictEqual(resFk.rows.length, 1, 'fk_profiles_auth_user must exist');

  // 3. Verify security definer functions exist
  const resFunc = await pglite.query(
    "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'current_user_org_ids'"
  );
  assert.strictEqual(resFunc.rows.length, 1, 'current_user_org_ids() routine must exist');

  await pglite.close();
});

test('AUTH-31: Production team UI has no hardcoded members', () => {
  const settingsFilePath = path.resolve(__dirname, '../../frontend/features/settings.tsx');
  const settingsCode = fs.readFileSync(settingsFilePath, 'utf-8');
  assert.strictEqual(settingsCode.includes('Andi Pratama'), false, 'Must not hardcode Andi Pratama');
  assert.strictEqual(settingsCode.includes('Sari Wulandari'), false, 'Must not hardcode Sari Wulandari');
  assert.strictEqual(settingsCode.includes('Dewi Lestari'), false, 'Must not hardcode Dewi Lestari');
  assert.strictEqual(settingsCode.includes('Budi Santoso'), false, 'Must not hardcode Budi Santoso');
  assert.ok(settingsCode.includes('s.actor'), 'Team list must be derived from session actor');
});

test('AUTH-32: Invitation cannot display success without backend success', () => {
  const settingsFilePath = path.resolve(__dirname, '../../frontend/features/settings.tsx');
  const settingsCode = fs.readFileSync(settingsFilePath, 'utf-8');
  assert.ok(
    settingsCode.includes('Undangan tim belum tersedia pada tahap ini.'),
    'Invite button must show disabled notice'
  );
  assert.strictEqual(
    settingsCode.includes('members.push'),
    false,
    'Must not simulate member addition locally'
  );
});

test('AUTH-33: Privileged admin mutation fails if audit persistence fails (fail-closed)', async () => {
  const originalRecordAudit = testRepo.recordAdminAuditLog;

  try {
    // 1. Simulate DB failure during audit write
    testRepo.recordAdminAuditLog = async () => {
      throw new Error('DATABASE CONNECTION CRITICAL FAILURE');
    };

    // 2. Mutating action -> must reject with HTTP 500
    const resMutate = await app.request('/api/admin/recovery/template', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-platform-admin',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ leadId: 'lead-1', template: 'reminder' })
    });
    assert.strictEqual(resMutate.status, 500, 'Mutating admin route must fail-closed on audit failure');
    const bodyMutate = await resMutate.json();
    assert.strictEqual(bodyMutate.success, false);
    assert.ok(bodyMutate.error.includes('Fail-Closed Enforcement'));

    // 3. Read-only action -> still succeeds with warning
    const resRead = await app.request('/api/admin/metrics', {
      headers: { Authorization: 'Bearer token-platform-admin' }
    });
    assert.strictEqual(resRead.status, 200, 'Read-only admin route should not block completely');
  } finally {
    testRepo.recordAdminAuditLog = originalRecordAudit;
  }
});

test('AUTH-34: x-organization-id in CORS allowHeaders and membership validated', async () => {
  const indexFilePath = path.resolve(__dirname, '../src/index.ts');
  const indexCode = fs.readFileSync(indexFilePath, 'utf-8');
  assert.ok(indexCode.includes("'x-organization-id'"), 'CORS allowHeaders must include x-organization-id');

  // Verify preflight OPTIONS response includes allow-headers
  const resOptions = await app.request('/api/projects', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'x-organization-id, authorization'
    }
  });
  const allowHeaders = resOptions.headers.get('Access-Control-Allow-Headers') || '';
  assert.ok(allowHeaders.toLowerCase().includes('x-organization-id'));

  // Multi-membership check
  const resValid = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': 'org-001'
    }
  });
  assert.strictEqual(resValid.status, 200);

  const resForbidden = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': 'org-unauthorized-999'
    }
  });
  assert.strictEqual(resForbidden.status, 403);
});

test('AUTH-35: Platform role scopes in TypeScript and SQL constraint are aligned', () => {
  const domainFilePath = path.resolve(__dirname, '../src/types/domain.ts');
  const domainCode = fs.readFileSync(domainFilePath, 'utf-8');
  assert.strictEqual(
    domainCode.includes("'PRODUCT_MANAGER'"),
    false,
    'PlatformRoleScope must NOT include PRODUCT_MANAGER'
  );

  const migration004Path = path.resolve(__dirname, '../migrations/004_extended_growth_feedback_schema.sql');
  const migration004Code = fs.readFileSync(migration004Path, 'utf-8');
  assert.ok(
    migration004Code.includes("role_scope IN ('SUPER_ADMIN', 'FINANCE_OPERATOR', 'GROWTH_OPERATOR', 'SUPPORT_AGENT')"),
    '004 check constraint must strictly match PlatformRoleScope definition'
  );
});

// ============================================================================
// GATE P0-A.3 TENANT AUTHORITY & ENTITLEMENT CLOSURE TESTS (AUTH-36 to AUTH-55)
// ============================================================================

test('AUTH-36: Strict isolation on projects — fail-closed without actor.orgId, Tenant A cannot access Tenant B, and no (!p.orgId) in routes', async () => {
  // 1. Source code check: ensure (!p.orgId) pattern is eliminated
  const projectsRouteCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/projects.ts'), 'utf-8');
  assert.strictEqual(projectsRouteCode.includes('!p.orgId'), false, 'routes/projects.ts must not contain !p.orgId pattern');

  // 2. Multi-org user without x-organization-id header returns 400 TENANT_SELECTION_REQUIRED
  // (token-multi has 2 memberships: org-001 and org-002)
  const resNoOrg = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-multi' }
  });
  assert.strictEqual(resNoOrg.status, 400);
  const bodyNoOrg = await resNoOrg.json();
  assert.strictEqual(bodyNoOrg.code, 'TENANT_SELECTION_REQUIRED');

  // 3. Cross-tenant isolation
  const resOwner = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-owner' }
  });
  assert.strictEqual(resOwner.status, 200);
  const bodyOwner = await resOwner.json();
  const codes = bodyOwner.data.map((p: any) => p.code);
  assert.ok(codes.includes('COV-001'));
  assert.strictEqual(codes.includes('EXT-001'), false, 'Org A must not see Org B projects');

  // 4. Cross-tenant detail access returns 404
  const resDetail = await app.request('/api/projects/p-org2-01', {
    headers: { Authorization: 'Bearer token-owner' }
  });
  assert.strictEqual(resDetail.status, 404);
});

test('AUTH-37: Strict isolation on actions — actions list filtered by actor.orgId, cross-tenant action create returns 404', async () => {
  const actionsRouteCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/actions.ts'), 'utf-8');
  assert.strictEqual(actionsRouteCode.includes('!a.orgId'), false, 'routes/actions.ts must not contain !a.orgId pattern');

  // Cross-tenant action creation rejected
  const resCrossCreate = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: 'p-org2-01',
      title: 'Tindakan Ilegal Lintas Tenant',
      blocker: 'Blocker'
    })
  });
  assert.strictEqual(resCrossCreate.status, 404, 'Must return 404 for project not found in current org');
});

test('AUTH-38: Strict isolation on invoices — invoices list filtered by actor.orgId, cross-tenant invoice / receipt returns 404', async () => {
  const invoicesRouteCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/invoices.ts'), 'utf-8');
  assert.strictEqual(invoicesRouteCode.includes('!i.orgId'), false, 'routes/invoices.ts must not contain !i.orgId pattern');

  // Cross-tenant invoice creation rejected
  const resCrossInvoice = await app.request('/api/invoices', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-finance',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: 'p-org2-01',
      number: 'INV/HACK/001',
      principal: 1000000,
      certificate: 'BAP-001'
    })
  });
  assert.strictEqual(resCrossInvoice.status, 404);

  // Cross-tenant cash receipt rejected
  const resCrossReceipt = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-finance',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: 'p-org2-01',
      amount: 1000000,
      bankReference: 'REF-001',
      allocations: []
    })
  });
  assert.strictEqual(resCrossReceipt.status, 404);
});

test('AUTH-39: Strict isolation on ledger — cross-tenant ledger read and entry return 404', async () => {
  const ledgerRouteCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/ledger.ts'), 'utf-8');
  assert.strictEqual(ledgerRouteCode.includes('!p.orgId'), false, 'routes/ledger.ts must not contain !p.orgId pattern');

  // Cross-tenant ledger view
  const resLedger = await app.request('/api/projects/p-org2-01/ledger', {
    headers: { Authorization: 'Bearer token-owner' }
  });
  assert.strictEqual(resLedger.status, 404);

  // Cross-tenant ledger entry
  const resEntry = await app.request('/api/projects/p-org2-01/ledger/entry', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-qs',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      stageIndex: 0,
      amount: 1000000,
      reason: 'Cross-tenant'
    })
  });
  assert.strictEqual(resEntry.status, 404);
});

test('AUTH-40: Strict isolation on reports — aggregates only actor.orgId data', async () => {
  const reportsRouteCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/reports.ts'), 'utf-8');
  assert.strictEqual(reportsRouteCode.includes('!p.orgId'), false, 'routes/reports.ts must not contain !p.orgId pattern');
  assert.strictEqual(reportsRouteCode.includes('!i.orgId'), false, 'routes/reports.ts must not contain !i.orgId pattern');

  const resPortfolio = await app.request('/api/reports/portfolio', {
    headers: { Authorization: 'Bearer token-owner' }
  });
  assert.strictEqual(resPortfolio.status, 200);
  const bodyPortfolio = await resPortfolio.json();
  const crossCodes = bodyPortfolio.data.projects.map((p: any) => p.code);
  assert.strictEqual(crossCodes.includes('EXT-001'), false);
});

test('AUTH-41: Support tickets strict isolation — scoped by orgId and stamps orgId', async () => {
  // Create ticket as Org 1
  const resCreate = await app.request('/api/support/tickets', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Tiket Tenant A',
      body: 'Keluhan Tenant A'
    })
  });
  assert.strictEqual(resCreate.status, 201);
  const bodyCreate = await resCreate.json();
  assert.strictEqual(bodyCreate.data.orgId, 'org-001');

  // Tenant B cannot see this ticket
  const resTenantB = await app.request('/api/support/tickets', {
    headers: { Authorization: 'Bearer token-tenant-b' }
  });
  assert.strictEqual(resTenantB.status, 200);
  const bodyTenantB = await resTenantB.json();
  const ticketIds = bodyTenantB.data.map((t: any) => t.id);
  assert.strictEqual(ticketIds.includes(bodyCreate.data.id), false);
});

test('AUTH-42: Support message author spoofing prevention — client author rejected, derived from actor.fullName', async () => {
  // 1. Create a ticket in org-001
  const resTicket = await app.request('/api/support/tickets', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Tiket Spoofing Check',
      body: 'Isi'
    })
  });
  const bodyTicket = await resTicket.json();
  const ticketId = bodyTicket.data.id;

  // 2. Add message with spoofed author
  const resMsg = await app.request(`/api/support/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: 'Pesan dari user',
      author: 'Fake SuperAdmin Hacker'
    })
  });
  assert.strictEqual(resMsg.status, 200);
  const bodyMsg = await resMsg.json();
  const lastMsg = bodyMsg.data.messages[bodyMsg.data.messages.length - 1];
  assert.strictEqual(lastMsg.author, 'Andi Pratama', 'Author MUST be derived from verified actor, NOT client input');
});

test('AUTH-43: Support message internal flag restriction — non-admin forced to false', async () => {
  // 1. Create a ticket in org-001
  const resTicket = await app.request('/api/support/tickets', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Tiket Internal Check',
      body: 'Isi'
    })
  });
  const bodyTicket = await resTicket.json();
  const ticketId = bodyTicket.data.id;

  // 2. Tenant OWNER tries to set internal = true
  const resOwnerMsg = await app.request(`/api/support/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: 'Catatan rahasia',
      internal: true
    })
  });
  assert.strictEqual(resOwnerMsg.status, 200);
  const bodyOwnerMsg = await resOwnerMsg.json();
  const lastMsg = bodyOwnerMsg.data.messages[bodyOwnerMsg.data.messages.length - 1];
  assert.strictEqual(lastMsg.internal, false, 'Non-admin actor CANNOT set internal to true');
});

test('AUTH-44: Feature requests scoped by tenant org', async () => {
  const resCreate = await app.request('/api/support/features', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Usulan Fitur Tenant A',
      problem: 'Masalah Tenant A'
    })
  });
  assert.strictEqual(resCreate.status, 201);
  const bodyCreate = await resCreate.json();
  assert.strictEqual(bodyCreate.data.orgId, 'org-001');

  // Org B reading features cannot see Org 1 features
  const resOrgB = await app.request('/api/support/features', {
    headers: { Authorization: 'Bearer token-tenant-b' }
  });
  assert.strictEqual(resOrgB.status, 200);
  const bodyOrgB = await resOrgB.json();
  const ids = bodyOrgB.data.map((f: any) => f.id);
  assert.strictEqual(ids.includes(bodyCreate.data.id), false);
});

test('AUTH-45: SaaS Subscription isolated per tenant — settlement updates exact tenant', async () => {
  // Ensure subscriptions are seeded as INACTIVE
  await testRepo.upsertSubscription('org-001', { planId: 'core', status: 'INACTIVE' });
  await testRepo.upsertSubscription('org-002', { planId: 'core', status: 'INACTIVE' });

  // Register checkout session for org-001
  const checkoutRef = `chk_settle_t1_${Date.now()}`;
  await testRepo.createCheckoutSession({
    id: `cs-${Date.now()}`,
    organizationId: 'org-001',
    provider: 'MAYAR',
    providerReference: checkoutRef,
    status: 'PENDING',
    plan: 'core',
    amount: 4900000,
    currency: 'IDR'
  });

  // Settle checkoutRef via webhook
  const resWebhook = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({
      event: 'payment.settled',
      id: `evt_settle_${Date.now()}`,
      data: {
        id: checkoutRef,
        amount: 4900000,
        status: 'settled'
      }
    })
  });
  assert.strictEqual(resWebhook.status, 200);
  const bodyWebhook = await resWebhook.json();
  assert.strictEqual(bodyWebhook.result, 'PROCESSED');

  // Check Org 1 subscription -> ACTIVE
  const subOrg1 = await testRepo.getSubscriptionByOrgId('org-001');
  assert.strictEqual(subOrg1?.status, 'ACTIVE');

  // Check Org 2 subscription -> remains INACTIVE
  const subOrg2 = await testRepo.getSubscriptionByOrgId('org-002');
  assert.strictEqual(subOrg2?.status, 'INACTIVE');
});

test('AUTH-46: Mayar settlement requires matching checkout session — unmatched ignored', async () => {
  const unmappedRef = `unmapped_ref_${Date.now()}`;
  const resWebhook = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({
      event: 'payment.settled',
      id: `evt_unmapped_${Date.now()}`,
      data: {
        id: unmappedRef,
        amount: 4900000,
        status: 'settled'
      }
    })
  });
  assert.strictEqual(resWebhook.status, 200);
  const bodyWebhook = await resWebhook.json();
  assert.strictEqual(bodyWebhook.result, 'IGNORED', 'Unmatched checkout ref must return IGNORED without activating any tenant');
});

test('AUTH-47: Database bootstrap trigger creates profile automatically on auth.users insert', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = new PGlite();

  await pglite.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      encrypted_password TEXT,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      phone TEXT,
      email_confirmed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    BEGIN
      RETURN '00000000-0000-0000-0000-000000000001'::UUID;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);

  // Create stub roles required by Supabase-targeting migrations (002, 005)
  await pglite.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;
  `);

  const migrationsDir = path.resolve(__dirname, '../migrations');
  for (const filename of CANONICAL_MIGRATION_ORDER) {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');
    await pglite.exec(sql);
  }

  // Insert fresh user into auth.users
  const freshUserId = '11111111-2222-3333-4444-555555555555';
  await pglite.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES ('${freshUserId}'::uuid, 'trigger_auto@cove.id', '{"full_name":"Trigger Auto User"}'::jsonb);
  `);

  // Verify profile exists in public.profiles
  const profileRes = await pglite.query<{ full_name: string; status: string }>(
    `SELECT full_name, status FROM public.profiles WHERE auth_user_id = '${freshUserId}'::uuid`
  );
  assert.strictEqual(profileRes.rows.length, 1, 'Profile must be automatically bootstrapped by trigger');
  assert.strictEqual(profileRes.rows[0].full_name, 'Trigger Auto User');
  assert.strictEqual(profileRes.rows[0].status, 'ACTIVE');

  await pglite.close();
});

test('AUTH-48: Application profile bootstrap allows fresh user to authenticate without 403', async () => {
  const res = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-fresh-bootstrap' }
  });
  assert.strictEqual(res.status, 200, 'Fresh user must authenticate without 403');
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.actor.fullName, 'Fresh User');
  assert.strictEqual(body.data.actor.email, 'fresh@cove.id');
});

test('AUTH-49: Authenticated user without organization does not get 400 or 403 on onboarding/me routes', async () => {
  const resMe = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-no-org' }
  });
  assert.strictEqual(resMe.status, 200);
  const bodyMe = await resMe.json();
  assert.strictEqual(bodyMe.data.actor.orgId, null);
  assert.strictEqual(bodyMe.data.actor.role, null);
  assert.strictEqual(bodyMe.data.tenantSelectionRequired, false);

  const resTenantOptions = await app.request('/api/auth/tenant-options', {
    headers: { Authorization: 'Bearer token-no-org' }
  });
  assert.strictEqual(resTenantOptions.status, 200);
  const bodyOptions = await resTenantOptions.json();
  assert.strictEqual(bodyOptions.data.options.length, 0);
});

test('AUTH-50: Organization creation creates active membership with role OWNER for creator', async () => {
  const resCreate = await app.request('/api/organizations', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-fresh-bootstrap',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      legalName: 'PT Nusantara Baru Jaya',
      displayName: 'Nusantara Baru'
    })
  });
  assert.strictEqual(resCreate.status, 201);
  const bodyCreate = await resCreate.json();
  assert.strictEqual(bodyCreate.data.membership.role, 'OWNER');
  assert.strictEqual(bodyCreate.data.membership.status, 'ACTIVE');
});

test('AUTH-51: Multi-membership user on /api/auth/me without header returns tenantSelectionRequired', async () => {
  const res = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-multi' }
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.tenantSelectionRequired, true);
  assert.strictEqual(body.data.tenantOptions.length, 2);
  assert.strictEqual(body.data.actor.orgId, null);
});

test('AUTH-52: Multi-membership user with valid x-organization-id returns specific tenant context', async () => {
  const res = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': 'org-002'
    }
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.tenantSelectionRequired, false);
  assert.strictEqual(body.data.actor.orgId, 'org-002');
  assert.strictEqual(body.data.actor.role, 'COMMERCIAL_MANAGER');
});

test('AUTH-53: Multi-membership user with invalid x-organization-id returns 403 Forbidden', async () => {
  const res = await app.request('/api/auth/me', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': 'org-unauthorized-999'
    }
  });
  assert.strictEqual(res.status, 403);
});

test('AUTH-54: Organization update (PATCH /api/organizations/:id) requires OWNER or ADMIN role', async () => {
  // 1. Allowed for OWNER
  const resOwner = await app.request('/api/organizations/org-001', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ legalName: 'PT Ruang Karya Sukses' })
  });
  assert.strictEqual(resOwner.status, 200);

  // 2. Denied for QS (role QS has no organization update permission)
  const resQS = await app.request('/api/organizations/org-001', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-qs',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ legalName: 'PT Ruang Karya Hacked' })
  });
  assert.strictEqual(resQS.status, 403);

  // 3. Denied for Tenant B trying to update Org 1
  const resCross = await app.request('/api/organizations/org-001', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-tenant-b',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ legalName: 'PT Ruang Karya Hijacked' })
  });
  assert.strictEqual(resCross.status, 403);
});

test('AUTH-55: Production DataStore initialization starts empty without demo data', () => {
  const savedEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const store = new DataStore();
    assert.strictEqual(store.projects.length, 0, 'Production store projects must be empty');
    assert.strictEqual(store.actions.length, 0, 'Production store actions must be empty');
    assert.strictEqual(store.invoices.length, 0, 'Production store invoices must be empty');
    assert.strictEqual(store.tickets.length, 0, 'Production store tickets must be empty');
    assert.strictEqual(store.features.length, 0, 'Production store features must be empty');
    assert.strictEqual(store.subscription.status, 'INACTIVE', 'Production store subscription must be INACTIVE');
  } finally {
    process.env.NODE_ENV = savedEnv;
  }
});

test('AUTH-56: Suspended profile cannot access API, cannot be re-activated, returns HTTP 403', async () => {
  // User usr-auth-suspended-999 has status SUSPENDED in testRepo
  const res = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-suspended' }
  });
  assert.strictEqual(res.status, 403, 'Suspended profile must return HTTP 403');
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.code, 'ACCOUNT_SUSPENDED');

  // Verify profile remains SUSPENDED in repository (not reactivated or overwritten)
  const prof = await testRepo.findProfileByAuthUserIdAny('usr-auth-suspended-999');
  assert.strictEqual(prof?.status, 'SUSPENDED', 'Profile status must remain SUSPENDED in database');
});

test('AUTH-57: Multi-tenant frontend logic routes to tenant selection UI, not onboarding', () => {
  const appFile = fs.readFileSync(path.resolve(__dirname, '../../frontend/app/App.tsx'), 'utf-8');
  // Must check tenantSelectionRequired BEFORE checking !s.actor.orgId for onboarding within customer workspace guard
  const workspaceGuardStart = appFile.indexOf('// Customer Workspace Routes');
  assert.ok(workspaceGuardStart > -1, 'App.tsx must have customer workspace guard');
  const workspaceGuard = appFile.slice(workspaceGuardStart);

  const selIndex = workspaceGuard.indexOf('s.tenantSelectionRequired');
  const onbIndex = workspaceGuard.indexOf('OnboardingCompanyPage');
  assert.ok(selIndex > -1, 'Workspace guard must check s.tenantSelectionRequired');
  assert.ok(selIndex < onbIndex, 's.tenantSelectionRequired must be checked before OnboardingCompanyPage in workspace guard');
  assert.ok(workspaceGuard.includes('Pilih Organisasi'), 'App.tsx must include Pilih Organisasi UI');
});

test('AUTH-58: Tenant selection updates active organization and sets header capability', () => {
  const storeFile = fs.readFileSync(path.resolve(__dirname, '../../frontend/lib/store.tsx'), 'utf-8');
  assert.ok(storeFile.includes('setActiveOrganizationId(orgId)'), 'selectTenant must call setActiveOrganizationId');
  assert.ok(storeFile.includes('setSelectedTenantId(orgId)'), 'selectTenant must update selectedTenantId');
  assert.ok(storeFile.includes('setTenantSelectionRequired(false)'), 'selectTenant must dismiss tenant selection flag');

  const apiFile = fs.readFileSync(path.resolve(__dirname, '../../frontend/lib/api.ts'), 'utf-8');
  assert.ok(apiFile.includes("'x-organization-id': activeOrgId"), 'api.ts must pass x-organization-id header');
});

test('AUTH-59: Zero-membership authenticated user routes to onboarding', () => {
  const appFile = fs.readFileSync(path.resolve(__dirname, '../../frontend/app/App.tsx'), 'utf-8');
  assert.ok(appFile.includes('<OnboardingCompanyPage />'), 'App.tsx must route zero-membership user to OnboardingCompanyPage');
});

test('AUTH-60: Logout clears active tenant context, selectedTenantId, and localStorage', () => {
  const storeFile = fs.readFileSync(path.resolve(__dirname, '../../frontend/lib/store.tsx'), 'utf-8');
  assert.ok(storeFile.includes('clearTenantSessionState'), 'store.tsx must have clearTenantSessionState');
  assert.ok(storeFile.includes('setActiveOrganizationId(null)'), 'clearTenantSessionState must call setActiveOrganizationId(null)');
  assert.ok(storeFile.includes('setSelectedTenantId(null)'), 'clearTenantSessionState must set selectedTenantId to null');
  assert.ok(storeFile.includes('setTenantOptions([])'), 'clearTenantSessionState must clear tenant options');

  const apiFile = fs.readFileSync(path.resolve(__dirname, '../../frontend/lib/api.ts'), 'utf-8');
  assert.ok(apiFile.includes("localStorage.removeItem('cove_active_org_id')"), 'setActiveOrganizationId(null) must remove localStorage key');
});

test('AUTH-61: No stale tenant context crosses accounts on auth change', () => {
  const storeFile = fs.readFileSync(path.resolve(__dirname, '../../frontend/lib/store.tsx'), 'utf-8');
  assert.ok(storeFile.includes('clearTenantSessionState()'), 'onAuthStateChange must invoke clearTenantSessionState on signed out');
});

test('AUTH-62: Legacy pay_001 compatibility path is blocked in production mode', async () => {
  const savedEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const payload = {
      event: 'payment.settled',
      id: `evt_prod_test_${Date.now()}`,
      data: {
        id: 'pay_001',
        customer_name: 'PT Ruang Karya Konstruksi',
        amount: 4900000,
        status: 'PAID'
      }
    };
    const res = await MayarService.handleWebhook(payload);
    assert.strictEqual(res.status, 'IGNORED', 'Legacy pay_001 without checkout session must be IGNORED in production');
  } finally {
    process.env.NODE_ENV = savedEnv;
  }
});

test('AUTH-63: Subscription upsert without explicit status does not become ACTIVE', async () => {
  const sub = await testRepo.upsertSubscription('org-test-inactive', { planId: 'core' });
  assert.notStrictEqual(sub.status, 'ACTIVE', 'Subscription without explicit status must not default to ACTIVE');
  assert.strictEqual(sub.status, 'INACTIVE', 'Default subscription status must be INACTIVE');
});

test('AUTH-64: Entitlement DB failure does not return PROCESSED (fail-closed)', async () => {
  // Test webhook endpoint returns 500 when settlement throws
  const checkoutRef = 'chk-db-failure-test';
  await testRepo.createCheckoutSession({
    organizationId: 'org-001',
    provider: 'MAYAR',
    providerReference: checkoutRef,
    status: 'PENDING',
    plan: 'core',
    amount: 4900000,
    currency: 'IDR'
  });

  // Temporarily force updateCheckoutSessionStatus to throw
  const originalUpdate = testRepo.updateCheckoutSessionStatus;
  testRepo.updateCheckoutSessionStatus = async () => {
    throw new Error('DATABASE CRITICAL ERROR ON SETTLEMENT');
  };

  try {
    const res = await app.request('/api/webhooks/mayar', {
      method: 'POST',
      headers: {
        'x-callback-token': config.mayarWebhookSecret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: 'payment.settled',
        id: `evt_fail_test_${Date.now()}`,
        data: {
          id: checkoutRef,
          amount: 4900000,
          status: 'PAID'
        }
      })
    });
    assert.strictEqual(res.status, 500, 'Endpoint must return HTTP 500 when settlement throws');
    const body = await res.json();
    assert.strictEqual(body.success, false);
  } finally {
    testRepo.updateCheckoutSessionStatus = originalUpdate;
  }
});

test('AUTH-65: Settlement failure keeps subscription unchanged', async () => {
  const checkoutRef = 'chk-rollback-test';
  const orgId = 'org-002';

  // Ensure subscription is INACTIVE initially
  await testRepo.upsertSubscription(orgId, { status: 'INACTIVE', planId: 'core' });

  await testRepo.createCheckoutSession({
    organizationId: orgId,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    status: 'PENDING',
    plan: 'core',
    amount: 4900000,
    currency: 'IDR'
  });

  // Break upsertSubscription to simulate failure after step 1
  const originalUpsert = testRepo.upsertSubscription;
  testRepo.upsertSubscription = async () => {
    throw new Error('SUBSCRIPTION PERSISTENCE FAILURE');
  };

  try {
    await assert.rejects(async () => {
      await MayarService.handleWebhook({
        event: 'payment.settled',
        id: `evt_sub_fail_${Date.now()}`,
        data: {
          id: checkoutRef,
          amount: 4900000,
          status: 'PAID'
        }
      });
    }, /SUBSCRIPTION PERSISTENCE FAILURE/);

    // Verify subscription status is still INACTIVE
    const currentSub = await testRepo.getSubscriptionByOrgId(orgId);
    assert.strictEqual(currentSub?.status, 'INACTIVE', 'Subscription must remain INACTIVE on settlement failure');
  } finally {
    testRepo.upsertSubscription = originalUpsert;
  }
});
