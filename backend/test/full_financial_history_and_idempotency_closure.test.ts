// ============================================================================
// COVE Backend — Full Financial History & Idempotency Closure Tests (Gate P0-B3.2)
// Behavioral Tests P0B3F-01 through P0B3F-24
// Validates F-04.1 (Mandatory Receipt Idempotency) & F-01.1 (W->P History Protection)
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before} from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {PGlite} from '@electric-sql/pglite';
import app from '../src/index.js';
import {db} from '../src/db/store.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import {
  PostgresProjectRepository,
  setProjectRepository
} from '../src/repositories/project.repository.js';
import {
  PostgresLedgerRepository,
  setLedgerRepository,
  getLedgerRepository
} from '../src/repositories/ledger.repository.js';
import {CANONICAL_MIGRATION_ORDER} from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgProjectRepo: PostgresProjectRepository;
let pgLedgerRepo: PostgresLedgerRepository;
let identityRepo: InMemoryIdentityRepository;

const ORG_A_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORG_B_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_A_ID = 'usr-p0b3f-tenant-a';
const USER_B_ID = 'usr-p0b3f-tenant-b';

const PROJ_A_1 = '11111111-aaaa-4aaa-8aaa-111111111111';
const PROJ_B_1 = '22222222-bbbb-4bbb-8bbb-222222222222';

let baseWplAId: string = '';
let baseMeasAId: string = '';
let baseClaimAId: string = '';
let baseCertAId: string = '';
let baseInvoiceAId: string = '';
let baseInvoiceA2Id: string = '';
let baseInvoiceBId: string = '';
let baseCertBId: string = '';

before(async () => {
  db.reset();

  // 1. Initialize PGlite and run full canonical migration chain (001 through 011)
  pglite = new PGlite();

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

  // 2. Seed canonical organizations
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name, status)
    VALUES 
      ('${ORG_A_ID}'::uuid, 'PT Alfa Konstruksi Idem', 'Alfa Idem', 'ACTIVE'),
      ('${ORG_B_ID}'::uuid, 'PT Beta Properti Idem', 'Beta Idem', 'ACTIVE');
  `);

  // 3. Setup repositories
  pgProjectRepo = new PostgresProjectRepository(pglite as any);
  setProjectRepository(pgProjectRepo);

  pgLedgerRepo = new PostgresLedgerRepository(pglite as any);
  setLedgerRepository(pgLedgerRepo);

  // 4. Seed test projects
  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES
      ('${PROJ_A_1}'::uuid, '${ORG_A_ID}'::uuid, 'P0B3F-PROJ-A', 'Proyek Idem Alfa', 'Klien Alfa', 'ACTIVE', 50000000000),
      ('${PROJ_B_1}'::uuid, '${ORG_B_ID}'::uuid, 'P0B3F-PROJ-B', 'Proyek Idem Beta', 'Klien Beta', 'ACTIVE', 30000000000);
  `);

  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    { id: ORG_A_ID, legalName: 'PT Alfa Konstruksi Idem', displayName: 'Alfa Idem', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' },
    { id: ORG_B_ID, legalName: 'PT Beta Properti Idem', displayName: 'Beta Idem', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }
  ];
  identityRepo.profiles = [
    { id: 'prof-p0b3f-a', authUserId: USER_A_ID, fullName: 'Finance Manager Alfa', status: 'ACTIVE' },
    { id: 'prof-p0b3f-b', authUserId: USER_B_ID, fullName: 'Finance Manager Beta', status: 'ACTIVE' }
  ];
  identityRepo.memberships = [
    {
      id: 'mem-p0b3f-a',
      orgId: ORG_A_ID,
      profileId: 'prof-p0b3f-a',
      role: 'FINANCE_MANAGER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem-p0b3f-b',
      orgId: ORG_B_ID,
      profileId: 'prof-p0b3f-b',
      role: 'FINANCE_MANAGER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ];
  setIdentityRepository(identityRepo);

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-p0b3f-a') {
      return {
        user: { id: USER_A_ID, email: 'finance-a@cove.test' },
        error: null
      };
    }
    if (token === 'token-p0b3f-b') {
      return {
        user: { id: USER_B_ID, email: 'finance-b@cove.test' },
        error: null
      };
    }
    return { user: null, error: 'Token tidak valid' };
  });

  // Seed baseline W -> M -> C -> S -> I for Tenant A
  const wpl = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    description: 'Pekerjaan Pondasi dan Struktur Alfa',
    principalAmount: '1000000000.00'
  });
  baseWplAId = wpl.id;

  const meas = await pgLedgerRepo.createMeasurement({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    measurementNumber: 'OPN-P0B3F-01',
    allocations: [{ workProgressLineId: baseWplAId, amount: '1000000000.00' }]
  });
  baseMeasAId = meas.id;

  const claim = await pgLedgerRepo.createClaim({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    claimNumber: 'CLM-P0B3F-01',
    allocations: [{ measurementId: baseMeasAId, amount: '1000000000.00' }]
  });
  baseClaimAId = claim.id;

  const cert = await pgLedgerRepo.createCertificate({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    certificateNumber: 'BAP-P0B3F-01',
    allocations: [{ claimId: baseClaimAId, amount: '1000000000.00' }]
  });
  baseCertAId = cert.id;

  const inv = await pgLedgerRepo.createProjectInvoice({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    invoiceNumber: 'INV-P0B3F-01',
    dueAt: '2026-10-01',
    allocations: [{ certificateId: baseCertAId, amount: '500000000.00' }]
  });
  baseInvoiceAId = inv.id;

  const inv2 = await pgLedgerRepo.createProjectInvoice({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    invoiceNumber: 'INV-P0B3F-02',
    dueAt: '2026-10-01',
    allocations: [{ certificateId: baseCertAId, amount: '300000000.00' }]
  });
  baseInvoiceA2Id = inv2.id;
});

// ============================================================================
// F-04.1: Mandatory Receipt Idempotency Tests (P0B3F-01 .. P0B3F-14)
// ============================================================================

test('P0B3F-01: POST /api/invoices/receipts without idempotency key returns 400', async () => {
  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      receivedAmount: '10000000.00',
      allocations: [{ invoiceId: baseInvoiceAId, amount: '10000000.00' }]
    })
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.error, 'IDEMPOTENCY_KEY_REQUIRED');
});

test('P0B3F-02: POST /api/invoices/receipts with empty string idempotency key returns 400', async () => {
  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      idempotencyKey: '',
      receivedAmount: '10000000.00',
      allocations: [{ invoiceId: baseInvoiceAId, amount: '10000000.00' }]
    })
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.error, 'IDEMPOTENCY_KEY_REQUIRED');
});

test('P0B3F-03: POST /api/invoices/receipts with whitespace-only idempotency key returns 400', async () => {
  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID,
      'idempotency-key': '    '
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      receivedAmount: '10000000.00',
      allocations: [{ invoiceId: baseInvoiceAId, amount: '10000000.00' }]
    })
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.error, 'IDEMPOTENCY_KEY_REQUIRED');
});

test('P0B3F-04: POST /api/invoices/receipts with >120 chars idempotency key returns 400', async () => {
  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      idempotencyKey: 'x'.repeat(121),
      receivedAmount: '10000000.00',
      allocations: [{ invoiceId: baseInvoiceAId, amount: '10000000.00' }]
    })
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.error, 'IDEMPOTENCY_KEY_TOO_LONG');
});

test('P0B3F-05: Direct repository call without idempotency key throws 400', async () => {
  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        orgId: ORG_A_ID,
        projectId: PROJ_A_1,
        idempotencyKey: '',
        receivedAmount: '10000000.00',
        allocations: [{ invoiceId: baseInvoiceAId, amount: '10000000.00' }]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.message, 'IDEMPOTENCY_KEY_REQUIRED');
      return true;
    }
  );
});

let sharedReceiptId: string = '';

test('P0B3F-06: POST /api/invoices/receipts with valid idempotency key creates receipt (200/201)', async () => {
  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID,
      'idempotency-key': 'IDEM-P0B3F-VALID-01'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      receiptNumber: 'RCPT-P0B3F-01',
      receivedAmount: '50000000.00',
      allocations: [{ invoiceId: baseInvoiceAId, amount: '50000000.00' }]
    })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.data.id);
  assert.strictEqual(data.data.receivedAmount, '50000000.00');
  sharedReceiptId = data.data.id;
});

test('P0B3F-07: Identical retry with same idempotency key returns same receipt (replay), row count unchanged', async () => {
  const beforeRows = (await pglite.query(`SELECT COUNT(*) FROM public.cash_receipts WHERE org_id = $1`, [ORG_A_ID])).rows[0].count;

  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID,
      'idempotency-key': 'IDEM-P0B3F-VALID-01'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      receiptNumber: 'RCPT-P0B3F-01',
      receivedAmount: '50000000.00',
      allocations: [{ invoiceId: baseInvoiceAId, amount: '50000000.00' }]
    })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.data.id, sharedReceiptId, 'Must return same receipt record');

  const afterRows = (await pglite.query(`SELECT COUNT(*) FROM public.cash_receipts WHERE org_id = $1`, [ORG_A_ID])).rows[0].count;
  assert.strictEqual(afterRows, beforeRows, 'Row count must not increase on idempotency replay');
});

test('P0B3F-08: Conflicting retry (different amount) with same idempotency key returns 409', async () => {
  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID,
      'idempotency-key': 'IDEM-P0B3F-VALID-01'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      receivedAmount: '60000000.00', // CONFLICTING AMOUNT
      allocations: [{ invoiceId: baseInvoiceAId, amount: '60000000.00' }]
    })
  });

  assert.strictEqual(res.status, 409);
  const data = await res.json();
  assert.strictEqual(data.error, 'RECEIPT_IDEMPOTENCY_CONFLICT');
});

test('P0B3F-09: Conflicting retry (different allocations) with same idempotency key returns 409', async () => {
  const res = await app.request('/api/invoices/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-p0b3f-a',
      'x-organization-id': ORG_A_ID,
      'idempotency-key': 'IDEM-P0B3F-VALID-01'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      receivedAmount: '50000000.00',
      allocations: [{ invoiceId: '00000000-0000-0000-0000-000000000099', amount: '50000000.00' }] // CONFLICTING TARGET
    })
  });

  assert.strictEqual(res.status, 409);
  const data = await res.json();
  assert.strictEqual(data.error, 'RECEIPT_IDEMPOTENCY_CONFLICT');
});

test('P0B3F-10: 10 concurrent requests with identical payload + identical key: exactly 1 creates, 9 replay, 0 duplicates, 0 500 errors', async () => {
  const initialReceiptCount = Number((await pglite.query(`SELECT COUNT(*) FROM public.cash_receipts`)).rows[0].count);
  const initialAllocCount = Number((await pglite.query(`SELECT COUNT(*) FROM public.receipt_allocations`)).rows[0].count);

  const CONCURRENT_KEY = 'IDEM-CONCUR-RACE-TEST-99';
  const tasks = Array.from({ length: 10 }).map(() =>
    pgLedgerRepo.createCashReceipt({
      orgId: ORG_A_ID,
      projectId: PROJ_A_1,
      idempotencyKey: CONCURRENT_KEY,
      receivedAmount: '25000000.00',
      allocations: [{ invoiceId: baseInvoiceAId, amount: '25000000.00' }]
    })
  );

  const results = await Promise.allSettled(tasks);
  const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.strictEqual(rejected.length, 0, 'No concurrent request with identical key should reject or return 500');
  assert.strictEqual(fulfilled.length, 10, 'All 10 concurrent requests must resolve successfully');

  // Verify all 10 got the exact same receipt ID
  const firstId = fulfilled[0].value.id;
  for (const f of fulfilled) {
    assert.strictEqual(f.value.id, firstId, 'All concurrent calls must return identical receipt ID');
  }

  // Verify exactly 1 receipt and 1 allocation row were inserted in DB
  const finalReceiptCount = Number((await pglite.query(`SELECT COUNT(*) FROM public.cash_receipts`)).rows[0].count);
  const finalAllocCount = Number((await pglite.query(`SELECT COUNT(*) FROM public.receipt_allocations`)).rows[0].count);

  assert.strictEqual(finalReceiptCount, initialReceiptCount + 1, 'Exactly one cash receipt row inserted');
  assert.strictEqual(finalAllocCount, initialAllocCount + 1, 'Exactly one receipt allocation row inserted');
});

test('P0B3F-11: Same idempotency key across different tenants / projects does not collide', async () => {
  // Tenant B creates W -> M -> C -> I
  const wplB = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    description: 'Pekerjaan Beta Idem Scope',
    principalAmount: '300000000.00'
  });
  const measB = await pgLedgerRepo.createMeasurement({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    measurementNumber: 'OPN-B-IDEM',
    allocations: [{ workProgressLineId: wplB.id, amount: '300000000.00' }]
  });
  const claimB = await pgLedgerRepo.createClaim({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    claimNumber: 'CLM-B-IDEM',
    allocations: [{ measurementId: measB.id, amount: '300000000.00' }]
  });
  const certB = await pgLedgerRepo.createCertificate({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    certificateNumber: 'BAP-B-IDEM',
    allocations: [{ claimId: claimB.id, amount: '300000000.00' }]
  });
  baseCertBId = certB.id;
  const invB = await pgLedgerRepo.createProjectInvoice({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    invoiceNumber: 'INV-B-IDEM-01',
    allocations: [{ certificateId: certB.id, amount: '100000000.00' }]
  });
  baseInvoiceBId = invB.id;

  // Tenant B uses the same idempotency key that Tenant A used in P0B3F-06
  const rcptB = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    idempotencyKey: 'IDEM-P0B3F-VALID-01', // SAME KEY AS TENANT A
    receivedAmount: '100000000.00',
    allocations: [{ invoiceId: invB.id, amount: '100000000.00' }]
  });

  assert.ok(rcptB.id);
  assert.notStrictEqual(rcptB.id, sharedReceiptId, 'Tenant B must create distinct receipt');
  assert.strictEqual(rcptB.orgId, ORG_B_ID);
  assert.strictEqual(rcptB.idempotencyKey, 'IDEM-P0B3F-VALID-01');
});

test('P0B3F-12: Idempotency replay works across app/repository restart', async () => {
  // Instantiate a fresh repository pointing to the same PGlite instance
  const freshRepo = new PostgresLedgerRepository(pglite as any);

  const replayed = await freshRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: 'IDEM-P0B3F-VALID-01',
    receiptNumber: 'RCPT-P0B3F-01',
    receivedAmount: '50000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '50000000.00' }]
  });

  assert.strictEqual(replayed.id, sharedReceiptId, 'Fresh repository instance must replay existing receipt');
});

test('P0B3F-13: Transaction failure leaves no orphaned idempotency record', async () => {
  const FAILED_KEY = 'IDEM-WILL-FAIL-001';

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        orgId: ORG_A_ID,
        projectId: PROJ_A_1,
        idempotencyKey: FAILED_KEY,
        receivedAmount: '999999999999.00',
        allocations: [{ invoiceId: baseInvoiceAId, amount: '999999999999.00' }] // Exceeds unpaid principal
      });
    }
  );

  // Verify no row with FAILED_KEY exists in cash_receipts
  const check = await pglite.query(
    `SELECT COUNT(*) FROM public.cash_receipts WHERE org_id = $1 AND idempotency_key = $2`,
    [ORG_A_ID, FAILED_KEY]
  );
  assert.strictEqual(Number(check.rows[0].count), 0, 'Aborted transaction must not commit idempotency key');

  // Verify that subsequent request with the same key and valid payload succeeds
  const succeeded = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: FAILED_KEY,
    receivedAmount: '5000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '5000000.00' }]
  });
  assert.ok(succeeded.id);
  assert.strictEqual(succeeded.idempotencyKey, FAILED_KEY);
});

test('P0B3F-14: No crypto.randomUUID() fallback used for idempotency keys anywhere in receipt path', () => {
  const routesCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/invoices.ts'), 'utf-8');
  const repoCode = fs.readFileSync(path.resolve(__dirname, '../src/repositories/ledger.repository.ts'), 'utf-8');

  // Route must not fallback to randomUUID for receipt idempotency
  assert.ok(!routesCode.includes('crypto.randomUUID()'), 'invoices.ts route must not use randomUUID');
  
  // PostgresLedgerRepository createCashReceipt section must not fallback to randomUUID for idempotencyKey
  const createRcptMethod = repoCode.substring(
    repoCode.indexOf('public async createCashReceipt'),
    repoCode.indexOf('public async updateCashReceipt')
  );
  assert.ok(!createRcptMethod.includes('randomUUID'), 'createCashReceipt must not use randomUUID for idempotency key');
});

// ============================================================================
// F-01.1: Full W->P Financial History Protection (P0B3F-15 .. P0B3F-24)
// ============================================================================

test('P0B3F-15: Project with only Work Progress (W) cannot be deleted (ON DELETE RESTRICT)', async () => {
  const PROJ_W = '33333333-3333-4333-8333-333333333333';
  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES ('${PROJ_W}'::uuid, '${ORG_A_ID}'::uuid, 'PROJ-W-ONLY', 'W Only Project', 'Client', 'ACTIVE', 10000000);
  `);

  await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_A_ID,
    projectId: PROJ_W,
    description: 'Pekerjaan Pondasi Saja',
    principalAmount: '5000000.00'
  });

  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.projects WHERE id = $1`, [PROJ_W]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-16: Project with W -> M cannot be deleted (ON DELETE RESTRICT)', async () => {
  const PROJ_WM = '44444444-4444-4444-8444-444444444444';
  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES ('${PROJ_WM}'::uuid, '${ORG_A_ID}'::uuid, 'PROJ-WM', 'WM Project', 'Client', 'ACTIVE', 10000000);
  `);

  const wpl = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_A_ID,
    projectId: PROJ_WM,
    description: 'Pekerjaan WM',
    principalAmount: '5000000.00'
  });
  await pgLedgerRepo.createMeasurement({
    orgId: ORG_A_ID,
    projectId: PROJ_WM,
    measurementNumber: 'OPN-WM',
    allocations: [{ workProgressLineId: wpl.id, amount: '5000000.00' }]
  });

  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.projects WHERE id = $1`, [PROJ_WM]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-17: Project with W -> M -> C cannot be deleted (ON DELETE RESTRICT)', async () => {
  const PROJ_WMC = '55555555-5555-4555-8555-555555555555';
  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES ('${PROJ_WMC}'::uuid, '${ORG_A_ID}'::uuid, 'PROJ-WMC', 'WMC Project', 'Client', 'ACTIVE', 10000000);
  `);

  const wpl = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_A_ID,
    projectId: PROJ_WMC,
    description: 'Pekerjaan WMC',
    principalAmount: '5000000.00'
  });
  const meas = await pgLedgerRepo.createMeasurement({
    orgId: ORG_A_ID,
    projectId: PROJ_WMC,
    measurementNumber: 'OPN-WMC',
    allocations: [{ workProgressLineId: wpl.id, amount: '5000000.00' }]
  });
  await pgLedgerRepo.createClaim({
    orgId: ORG_A_ID,
    projectId: PROJ_WMC,
    claimNumber: 'CLM-WMC',
    allocations: [{ measurementId: meas.id, amount: '5000000.00' }]
  });

  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.projects WHERE id = $1`, [PROJ_WMC]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-18: Project with W -> M -> C -> S cannot be deleted (ON DELETE RESTRICT)', async () => {
  const PROJ_WMCS = '66666666-6666-4666-8666-666666666666';
  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES ('${PROJ_WMCS}'::uuid, '${ORG_A_ID}'::uuid, 'PROJ-WMCS', 'WMCS Project', 'Client', 'ACTIVE', 10000000);
  `);

  const wpl = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_A_ID,
    projectId: PROJ_WMCS,
    description: 'Pekerjaan WMCS',
    principalAmount: '5000000.00'
  });
  const meas = await pgLedgerRepo.createMeasurement({
    orgId: ORG_A_ID,
    projectId: PROJ_WMCS,
    measurementNumber: 'OPN-WMCS',
    allocations: [{ workProgressLineId: wpl.id, amount: '5000000.00' }]
  });
  const claim = await pgLedgerRepo.createClaim({
    orgId: ORG_A_ID,
    projectId: PROJ_WMCS,
    claimNumber: 'CLM-WMCS',
    allocations: [{ measurementId: meas.id, amount: '5000000.00' }]
  });
  await pgLedgerRepo.createCertificate({
    orgId: ORG_A_ID,
    projectId: PROJ_WMCS,
    certificateNumber: 'BAP-WMCS',
    allocations: [{ claimId: claim.id, amount: '5000000.00' }]
  });

  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.projects WHERE id = $1`, [PROJ_WMCS]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-19: Organization with active W/M/C/S records cannot be deleted (ON DELETE RESTRICT)', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.organizations WHERE id = $1`, [ORG_A_ID]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-20: Attempting to delete work_progress_line with downstream measurement fails (RESTRICT)', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.work_progress_lines WHERE id = $1`, [baseWplAId]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-21: Attempting to delete measurement with downstream claim fails (RESTRICT)', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.measurements WHERE id = $1`, [baseMeasAId]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-22: Attempting to delete claim with downstream certificate fails (RESTRICT)', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.claims WHERE id = $1`, [baseClaimAId]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-23: Attempting to delete certificate with downstream invoice fails (RESTRICT)', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.certificates WHERE id = $1`, [baseCertAId]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

test('P0B3F-24: Attempting to delete invoice with downstream receipt fails (RESTRICT)', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.project_invoices WHERE id = $1`, [baseInvoiceAId]);
    },
    (err: any) => {
      assert.ok(
        ['23001', '23503'].includes(err.code) ||
        err.message.toLowerCase().includes('foreign key') ||
        err.message.toLowerCase().includes('restrict'),
        `Expected FK/RESTRICT error, got ${err.code}: ${err.message}`
      );
      return true;
    }
  );
});

// ============================================================================
// P0-B3.3: Canonical Receipt Idempotency Fingerprint Tests (P0B3I-01 .. P0B3I-18)
// ============================================================================

test('P0B3I-01: Same full command replays original receipt', async () => {
  const KEY = 'P0B3I-KEY-01';
  const payload = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receiptNumber: 'RCPT-I-01',
    receivedAt: '2026-09-12',
    currency: 'IDR',
    bankReference: 'BANK-BCA-01',
    paymentMethod: 'BANK_TRANSFER',
    receivedAmount: '1000000.00',
    description: 'Pembayaran Termin 1',
    notes: 'Catatan transfer',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  const first = await pgLedgerRepo.createCashReceipt(payload);
  const replay = await pgLedgerRepo.createCashReceipt(payload);

  assert.strictEqual(first.id, replay.id);
  assert.strictEqual(first.receivedAmount, replay.receivedAmount);
  assert.strictEqual(first.receiptNumber, replay.receiptNumber);
});

test('P0B3I-02: receivedAmount difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-02';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        receivedAmount: '1000000.01',
        allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.01' }]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-03: receivedAt difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-03';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAt: '2026-09-12',
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        receivedAt: '2026-09-13'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-04: currency difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-04';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    currency: 'IDR',
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        currency: 'USD'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-05: receiptNumber difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-05';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receiptNumber: 'RCPT-ORIG-01',
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        receiptNumber: 'RCPT-DIFF-02'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-06: bankReference difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-06';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    bankReference: 'BANK-MANDIRI-ORIG',
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        bankReference: 'BANK-BCA-DIFF'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-07: paymentMethod difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-07';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    paymentMethod: 'BANK_TRANSFER',
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        paymentMethod: 'CASH'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-08: description difference follows documented policy (conflicts 409)', async () => {
  const KEY = 'P0B3I-KEY-08';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    description: 'Deskripsi Asli',
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        description: 'Deskripsi Berbeda'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-09: notes difference follows documented policy (conflicts 409)', async () => {
  const KEY = 'P0B3I-KEY-09';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    notes: 'Catatan 1',
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        notes: 'Catatan 2 Berbeda'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-10: allocation invoice difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-10';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '1000000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '1000000.00' }]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        allocations: [{ invoiceId: baseInvoiceA2Id, amount: '1000000.00' }]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-11: allocation amount difference conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-11';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '1000000.00',
    allocations: [
      { invoiceId: baseInvoiceAId, amount: '600000.00' },
      { invoiceId: baseInvoiceA2Id, amount: '400000.00' }
    ]
  };

  await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        allocations: [
          { invoiceId: baseInvoiceAId, amount: '500000.00' },
          { invoiceId: baseInvoiceA2Id, amount: '500000.00' }
        ]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-12: allocation order permutation replays (200)', async () => {
  const KEY = 'P0B3I-KEY-12';
  const base1 = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '1000000.00',
    allocations: [
      { invoiceId: baseInvoiceAId, amount: '600000.00' },
      { invoiceId: baseInvoiceA2Id, amount: '400000.00' }
    ]
  };

  const base2 = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '1000000.00',
    allocations: [
      { invoiceId: baseInvoiceA2Id, amount: '400000.00' },
      { invoiceId: baseInvoiceAId, amount: '600000.00' }
    ]
  };

  const r1 = await pgLedgerRepo.createCashReceipt(base1);
  const r2 = await pgLedgerRepo.createCashReceipt(base2);

  assert.strictEqual(r1.id, r2.id);
});

test('P0B3I-13: duplicate-allocation multiset mismatch conflicts (409)', async () => {
  const KEY = 'P0B3I-KEY-13';
  const base1 = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '300000.00',
    allocations: [
      { invoiceId: baseInvoiceAId, amount: '100000.00' },
      { invoiceId: baseInvoiceAId, amount: '200000.00' }
    ]
  };

  await pgLedgerRepo.createCashReceipt(base1);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        orgId: ORG_A_ID,
        projectId: PROJ_A_1,
        idempotencyKey: KEY,
        receivedAmount: '300000.00',
        allocations: [
          { invoiceId: baseInvoiceAId, amount: '100000.00' },
          { invoiceId: baseInvoiceAId, amount: '100000.00' }
        ]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-14: duplicate-allocation identical multiset replays (200)', async () => {
  const KEY = 'P0B3I-KEY-14';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '200000.00',
    allocations: [
      { invoiceId: baseInvoiceAId, amount: '100000.00' },
      { invoiceId: baseInvoiceAId, amount: '100000.00' }
    ]
  };

  const r1 = await pgLedgerRepo.createCashReceipt(base);
  const r2 = await pgLedgerRepo.createCashReceipt(base);

  assert.strictEqual(r1.id, r2.id);
});

test('P0B3I-15: 23505 recovery uses full fingerprint', async () => {
  const KEY = 'P0B3I-KEY-15';
  const base = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    bankReference: 'BANK-REF-23505-A',
    receivedAmount: '500000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '500000.00' }]
  };

  const r1 = await pgLedgerRepo.createCashReceipt(base);

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        ...base,
        bankReference: 'BANK-REF-23505-B'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-16: concurrent bankReference conflict returns one success + one conflict', async () => {
  const KEY = 'P0B3I-KEY-16';
  const reqA = pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    bankReference: 'BANK-CONCUR-A',
    receivedAmount: '500000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '500000.00' }]
  });

  const reqB = pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    bankReference: 'BANK-CONCUR-B',
    receivedAmount: '500000.00',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '500000.00' }]
  });

  const results = await Promise.allSettled([reqA, reqB]);
  const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
  assert.strictEqual(rejected.length, 1, 'Conflicting concurrent request must reject with 409');
  assert.strictEqual((rejected[0].reason as any).statusCode, 409);
  assert.ok((rejected[0].reason as any).message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
});

test('P0B3I-17: restart preserves full command semantics', async () => {
  const KEY = 'P0B3I-KEY-17';
  const payload = {
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receiptNumber: 'RCPT-RESTART-01',
    receivedAt: '2026-09-12',
    currency: 'IDR',
    bankReference: 'BANK-RESTART',
    paymentMethod: 'BANK_TRANSFER',
    receivedAmount: '500000.00',
    description: 'Restart test description',
    notes: 'Restart test notes',
    allocations: [{ invoiceId: baseInvoiceAId, amount: '500000.00' }]
  };

  const r1 = await pgLedgerRepo.createCashReceipt(payload);

  const freshRepo = new PostgresLedgerRepository(pglite as any);
  const replayed = await freshRepo.createCashReceipt(payload);
  assert.strictEqual(replayed.id, r1.id);

  await assert.rejects(
    async () => {
      await freshRepo.createCashReceipt({
        ...payload,
        bankReference: 'BANK-RESTART-CHANGED'
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('RECEIPT_IDEMPOTENCY_CONFLICT'));
      return true;
    }
  );
});

test('P0B3I-18: tenant scoping remains independent', async () => {
  const KEY = 'P0B3I-KEY-18-SHARED';

  const rTenantA = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: KEY,
    receivedAmount: '200000.00',
    allocations: [{ invoiceId: baseInvoiceA2Id, amount: '200000.00' }]
  });

  const invB2 = await pgLedgerRepo.createProjectInvoice({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    invoiceNumber: 'INV-B-IDEM-02',
    allocations: [{ certificateId: baseCertBId, amount: '100000000.00' }]
  });

  const rTenantB = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    idempotencyKey: KEY,
    receivedAmount: '200000.00',
    allocations: [{ invoiceId: invB2.id, amount: '200000.00' }]
  });

  assert.ok(rTenantA.id);
  assert.ok(rTenantB.id);
  assert.notStrictEqual(rTenantA.id, rTenantB.id);
  assert.strictEqual(rTenantA.orgId, ORG_A_ID);
  assert.strictEqual(rTenantB.orgId, ORG_B_ID);
});
