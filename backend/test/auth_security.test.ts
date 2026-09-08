// ============================================================================
// COVE Backend — Authentication & Authorization Security Tests (Gate P0-A)
// Covers AUTH-01 through AUTH-10
// ============================================================================

import {test, before, after} from 'node:test';
import assert from 'node:assert';
import app from '../src/index.js';
import {db} from '../src/db/store.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {config} from '../src/config.js';

before(() => {
  db.reset();

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
    return {user: null, error: 'Token otentikasi tidak valid atau sudah kedaluwarsa.'};
  });
});

after(() => {
  setTestTokenVerifier(null);
});

test('AUTH-01: Menolak permintaan tanpa otentikasi pada endpoint terlindungi (/api/projects -> 401)', async () => {
  const res = await app.request('/api/projects');
  assert.strictEqual(res.status, 401, 'Harus mengembalikan HTTP 401 Unauthorized');
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.match(body.error, /Autentikasi diperlukan/);
});

test('AUTH-02: Menerima Supabase JWT valid pada route terlindungi (/api/projects -> 200)', async () => {
  const res = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer token-owner'
    }
  });
  assert.strictEqual(res.status, 200, 'Harus mengembalikan HTTP 200 OK');
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
});

test('AUTH-03: Menolak JWT tidak valid atau kedaluwarsa (/api/projects -> 401)', async () => {
  const res = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer invalid-expired-or-tampered-token'
    }
  });
  assert.strictEqual(res.status, 401, 'Harus mengembalikan HTTP 401');
  const body = await res.json();
  assert.strictEqual(body.success, false);
});

test('AUTH-04: Isolasi Tenant: pengguna Org A tidak dapat melihat atau mengakses data Org B', async () => {
  // Org A (Ruang Karya)
  const resOrgA = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer token-owner'
    }
  });
  assert.strictEqual(resOrgA.status, 200);
  const dataOrgA = await resOrgA.json();
  const orgAProjectCodes = dataOrgA.data.map((p: any) => p.code);
  assert.ok(orgAProjectCodes.includes('COV-001'), 'Org A harus dapat melihat proyeknya sendiri');
  assert.ok(!orgAProjectCodes.includes('EXT-001'), 'Org A TIDAK BOLEH melihat proyek Org B (EXT-001)');

  // Org B (Kontraktor Sebelah)
  const resOrgB = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer token-tenant-b'
    }
  });
  assert.strictEqual(resOrgB.status, 200);
  const dataOrgB = await resOrgB.json();
  const orgBProjectCodes = dataOrgB.data.map((p: any) => p.code);
  assert.ok(orgBProjectCodes.includes('EXT-001'), 'Org B harus dapat melihat proyeknya sendiri');
  assert.ok(!orgBProjectCodes.includes('COV-001'), 'Org B TIDAK BOLEH melihat proyek Org A');

  // Org B mencoba akses langsung detail proyek Org A (/api/projects/p1)
  const resCrossDetail = await app.request('/api/projects/p1', {
    headers: {
      Authorization: 'Bearer token-tenant-b'
    }
  });
  assert.strictEqual(resCrossDetail.status, 404, 'Akses cross-tenant proyek harus mengembalikan 404 Not Found');
});

test('AUTH-05: Non-platform-admin (Tenant OWNER sekalipun) ditolak dengan 403 pada /api/admin/*', async () => {
  const res = await app.request('/api/admin/metrics', {
    headers: {
      Authorization: 'Bearer token-owner'
    }
  });
  assert.strictEqual(res.status, 403, 'Tenant OWNER harus ditolak dengan 403 Forbidden pada area admin platform');
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.match(body.error, /Hanya Platform Administrator/);
});

test('AUTH-06: Platform Administrator valid diterima pada /api/admin/* dan tercatat di audit log', async () => {
  const beforeCount = db.adminAuditLogs.length;

  const res = await app.request('/api/admin/metrics', {
    headers: {
      Authorization: 'Bearer token-platform-admin'
    }
  });
  assert.strictEqual(res.status, 200, 'Platform admin harus diizinkan dengan HTTP 200');
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.data.mrr > 0);

  // Verifikasi pencatatan audit log canonical
  assert.ok(db.adminAuditLogs.length > beforeCount, 'Admin access harus dicatat di adminAuditLogs');
  const lastLog = db.adminAuditLogs[db.adminAuditLogs.length - 1];
  assert.strictEqual(lastLog.resource, 'ADMIN_CONSOLE');
  assert.match(lastLog.action, /GET .*\/admin\/metrics/);
});

test('AUTH-07: Hak Akses Role: QS berwenang mencatat komersial, tetapi ditolak menerbitkan invoice finansial', async () => {
  // QS mencatat entri komersial
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
  assert.strictEqual(commercialRes.status, 200, 'QS harus berwenang mencatat progres komersial');

  // QS mencoba menerbitkan invoice finansial
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

test('AUTH-08: Hak Akses Role: Finance berwenang mengelola invoice finansial, tetapi ditolak mengubah ledger komersial', async () => {
  // Finance mencoba mencatat komersial ledger
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

  // Finance mencatat penerimaan kas proyek
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
  assert.strictEqual(receiptRes.status, 200, 'Finance berwenang mencatat kas masuk proyek');
});

test('AUTH-09: Hak Akses Role: AUDITOR bersifat read-only dan ditolak mutasi data (403)', async () => {
  // Auditor membaca proyek (diizinkan)
  const readRes = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer token-auditor'
    }
  });
  assert.strictEqual(readRes.status, 200, 'Auditor dapat membaca data');

  // Auditor mencoba membuat proyek baru (ditolak)
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

  // Auditor mencoba membuat tindakan (ditolak)
  const actionRes = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-auditor'
    },
    body: JSON.stringify({
      projectId: 'p1',
      title: 'Tindakan Auditor',
      blocker: 'Blocker'
    })
  });
  assert.strictEqual(actionRes.status, 403, 'Auditor harus ditolak membuat tindakan (403)');
});

test('AUTH-10: Webhook Mayar: verifikasi x-callback-token konstan-waktu menolak tanpa token/salah dan menerima token valid', async () => {
  const payload = {
    event: 'payment.settled',
    id: `evt_sec_test_${Date.now()}`,
    data: {
      id: 'pay_sec_01',
      amount: 4900000,
      status: 'settled',
      plan_id: 'core'
    }
  };

  // 1. Tanpa header x-callback-token
  const noHeaderRes = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(noHeaderRes.status, 401, 'Tanpa x-callback-token harus ditolak 401');

  // 2. Dengan header token yang salah
  const invalidTokenRes = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': 'wrong-token-value'
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(invalidTokenRes.status, 401, 'Token tidak cocok harus ditolak 401');

  // 3. Dengan token valid
  const validTokenRes = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(validTokenRes.status, 200, 'Token valid harus diterima 200 OK');
  const validBody = await validTokenRes.json();
  assert.strictEqual(validBody.success, true);
  assert.strictEqual(validBody.result, 'PROCESSED');
});
