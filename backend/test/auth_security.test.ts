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
import {db} from '../src/db/store.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {config} from '../src/config.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository,
  getIdentityRepository
} from '../src/repositories/identity.repository.js';
import {CANONICAL_MIGRATION_ORDER, getDiscoveredMigrations} from '../src/db/migrate.js';

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
    { id: 'prof-multi', authUserId: 'usr-auth-multi', fullName: 'Multi Member', status: 'ACTIVE' }
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

  // Verify InvitationPage does not mutate status/activePlan locally
  assert.doesNotMatch(
    content,
    /export\s+function\s+InvitationPage[\s\S]*?status\s*:\s*['"]active['"]/,
    'InvitationPage DILARANG secara lokal mengaktifkan subscription'
  );
});

test('AUTH-15: Checkout uses backend endpoint and no hardcoded VA exists', async () => {
  const accessFilePath = path.resolve(__dirname, '../../frontend/features/access.tsx');
  const content = fs.readFileSync(accessFilePath, 'utf-8');

  // Verify no hardcoded VA
  assert.doesNotMatch(content, /8829-0123-9981-4402/, 'Hardcoded VA 8829-0123-9981-4402 DILARANG');

  // Verify backend checkout endpoint produces dynamic transaction ref
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
  assert.match(data.data.checkoutRef, /^COV-PAY-\d+/);
  assert.match(data.data.paymentUrl, /^https:\/\/checkout\.mayar\.id\/pay\/COV-PAY-\d+/);
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

test('MIGRATION-ORDER: 003b_platform_admin_foundation executes before 004 and 005', () => {
  const migrations = getDiscoveredMigrations();
  const idx003 = migrations.indexOf('003_seed_data.sql');
  const idx003b = migrations.indexOf('003b_platform_admin_foundation.sql');
  const idx004 = migrations.indexOf('004_extended_growth_feedback_schema.sql');
  const idx005 = migrations.indexOf('005_identity_access_hardening.sql');

  assert.ok(idx003 !== -1, '003_seed_data.sql must exist');
  assert.ok(idx003b !== -1, '003b_platform_admin_foundation.sql must exist');
  assert.ok(idx004 !== -1, '004_extended_growth_feedback_schema.sql must exist');
  assert.ok(idx005 !== -1, '005_identity_access_hardening.sql must exist');

  assert.ok(idx003b > idx003, '003b must execute after 003');
  assert.ok(idx003b < idx004, '003b must execute BEFORE 004');
  assert.ok(idx004 < idx005, '004 must execute BEFORE 005');
});
