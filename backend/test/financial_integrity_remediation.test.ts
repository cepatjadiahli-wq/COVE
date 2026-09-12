// ============================================================================
// COVE Backend — Financial Integrity Hardening Tests (Gate P0-B.3.1)
// Behavioral Tests P0B3R-01 through P0B3R-24
// Validates F-01, F-02, F-03, F-04 and regression invariants.
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before, after} from 'node:test';
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
import {
  parseMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  isPositiveMoney
} from '../src/utils/money.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgProjectRepo: PostgresProjectRepository;
let pgLedgerRepo: PostgresLedgerRepository;
let identityRepo: InMemoryIdentityRepository;

const ORG_A_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORG_B_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_A_ID = 'usr-rem-tenant-a';
const USER_B_ID = 'usr-rem-tenant-b';

const PROJ_A_1 = '11111111-aaaa-4aaa-8aaa-111111111111';
const PROJ_B_1 = '22222222-bbbb-4bbb-8bbb-222222222222';

let certA1Id: string = '';
let certB1Id: string = '';
let invoiceA1Id: string = '';
let receiptA1Id: string = '';

before(async () => {
  db.reset();

  // 1. Initialize PGlite database and run canonical migration chain (001 through 010)
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

  // 2. Seed canonical organizations in PostgreSQL
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name, status)
    VALUES 
      ('${ORG_A_ID}'::uuid, 'PT Tenant Alfa Konstruksi', 'Tenant Alfa', 'ACTIVE'),
      ('${ORG_B_ID}'::uuid, 'PT Tenant Beta Properti', 'Tenant Beta', 'ACTIVE');
  `);

  // 3. Setup repositories
  pgProjectRepo = new PostgresProjectRepository(pglite as any);
  setProjectRepository(pgProjectRepo);

  pgLedgerRepo = new PostgresLedgerRepository(pglite as any);
  setLedgerRepository(pgLedgerRepo);

  // 4. Seed test projects in PostgreSQL
  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES
      ('${PROJ_A_1}'::uuid, '${ORG_A_ID}'::uuid, 'REM-PROJ-A', 'Proyek Remediasi Alfa', 'Klien Alfa', 'ACTIVE', 50000000000),
      ('${PROJ_B_1}'::uuid, '${ORG_B_ID}'::uuid, 'REM-PROJ-B', 'Proyek Remediasi Beta', 'Klien Beta', 'ACTIVE', 30000000000);
  `);

  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    { id: ORG_A_ID, legalName: 'PT Tenant Alfa Konstruksi', displayName: 'Tenant Alfa', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' },
    { id: ORG_B_ID, legalName: 'PT Tenant Beta Properti', displayName: 'Tenant Beta', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }
  ];
  identityRepo.profiles = [
    { id: 'prof-a-1', authUserId: USER_A_ID, fullName: 'Finance Manager A', status: 'ACTIVE' },
    { id: 'prof-b-1', authUserId: USER_B_ID, fullName: 'Finance Manager B', status: 'ACTIVE' }
  ];
  identityRepo.memberships = [
    {
      id: 'mem-a-1',
      orgId: ORG_A_ID,
      profileId: 'prof-a-1',
      role: 'FINANCE_MANAGER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem-b-1',
      orgId: ORG_B_ID,
      profileId: 'prof-b-1',
      role: 'FINANCE_MANAGER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ];
  setIdentityRepository(identityRepo);

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-rem-a') {
      return {
        user: {
          id: USER_A_ID,
          email: 'finance-a@cove.test'
        },
        error: null
      };
    }
    if (token === 'token-rem-b') {
      return {
        user: {
          id: USER_B_ID,
          email: 'finance-b@cove.test'
        },
        error: null
      };
    }
    return { user: null, error: 'Token tidak valid' };
  });

  // 5. Seed full lineage W -> M -> C -> S for Tenant A
  const wplA = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    description: 'Pekerjaan Struktur Utama',
    principalAmount: '1000000000.00'
  });

  const measA = await pgLedgerRepo.createMeasurement({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    measurementNumber: 'OPN-REM-A-01',
    allocations: [{ workProgressLineId: wplA.id, amount: '1000000000.00' }]
  });

  const claimA = await pgLedgerRepo.createClaim({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    claimNumber: 'CLM-REM-A-01',
    allocations: [{ measurementId: measA.id, amount: '1000000000.00' }]
  });

  const certA = await pgLedgerRepo.createCertificate({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    certificateNumber: 'BAP-REM-A-01',
    allocations: [{ claimId: claimA.id, amount: '1000000000.00' }]
  });
  certA1Id = certA.id;

  // Tenant B Certificate
  const wplB = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    description: 'Pekerjaan Pondasi Beta',
    principalAmount: '500000000.00'
  });

  const measB = await pgLedgerRepo.createMeasurement({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    measurementNumber: 'OPN-REM-B-01',
    allocations: [{ workProgressLineId: wplB.id, amount: '500000000.00' }]
  });

  const claimB = await pgLedgerRepo.createClaim({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    claimNumber: 'CLM-REM-B-01',
    allocations: [{ measurementId: measB.id, amount: '500000000.00' }]
  });

  const certB = await pgLedgerRepo.createCertificate({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    certificateNumber: 'BAP-REM-B-01',
    allocations: [{ claimId: claimB.id, amount: '500000000.00' }]
  });
  certB1Id = certB.id;

  // Create base invoice for Tenant A
  const invA = await pgLedgerRepo.createProjectInvoice({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    invoiceNumber: 'INV-REM-A-001',
    dueAt: '2026-08-01', // intentionally past due for aging test
    allocations: [{ certificateId: certA1Id, amount: '600000000.00' }]
  });
  invoiceA1Id = invA.id;

  // Create base receipt for Tenant A
  const rcptA = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: 'IDEM-INIT-001',
    receiptNumber: 'RCPT-REM-A-001',
    receivedAmount: '200000000.00',
    allocations: [{ invoiceId: invoiceA1Id, amount: '200000000.00' }]
  });
  receiptA1Id = rcptA.id;
});

// ----------------------------------------------------------------------------
// F-01: Financial Delete Safety (ON DELETE RESTRICT)
// ----------------------------------------------------------------------------

test('P0B3R-01: Deleting project with canonical invoice/receipt history is rejected', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.projects WHERE id = $1`, [PROJ_A_1]);
    },
    (err: any) => {
      // Must be foreign key violation (23001 RESTRICT_VIOLATION or 23503 FOREIGN_KEY_VIOLATION)
      assert.ok(['23001', '23503'].includes(err.code), `Expected FK/RESTRICT violation, got ${err.code}: ${err.message}`);
      return true;
    }
  );

  // Verify project and financial rows are still present
  const projCheck = await pglite.query(`SELECT id FROM public.projects WHERE id = $1`, [PROJ_A_1]);
  assert.strictEqual(projCheck.rows.length, 1, 'Project must survive failed delete');

  const invCheck = await pglite.query(`SELECT id FROM public.project_invoices WHERE id = $1`, [invoiceA1Id]);
  assert.strictEqual(invCheck.rows.length, 1, 'Invoice must survive');
});

test('P0B3R-02: Deleting organization with canonical financial history is rejected', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.organizations WHERE id = $1`, [ORG_A_ID]);
    },
    (err: any) => {
      assert.ok(['23001', '23503'].includes(err.code), `Expected FK/RESTRICT violation, got ${err.code}: ${err.message}`);
      return true;
    }
  );

  const orgCheck = await pglite.query(`SELECT id FROM public.organizations WHERE id = $1`, [ORG_A_ID]);
  assert.strictEqual(orgCheck.rows.length, 1, 'Organization must survive failed delete');
});

test('P0B3R-03: Deleting invoice with receipt lineage is rejected', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.project_invoices WHERE id = $1`, [invoiceA1Id]);
    },
    (err: any) => {
      assert.ok(['23001', '23503'].includes(err.code), `Expected FK/RESTRICT violation, got ${err.code}: ${err.message}`);
      return true;
    }
  );

  const invCheck = await pglite.query(`SELECT id FROM public.project_invoices WHERE id = $1`, [invoiceA1Id]);
  assert.strictEqual(invCheck.rows.length, 1, 'Invoice must survive failed delete');
});

test('P0B3R-04: Deleting receipt with allocation lineage is rejected', async () => {
  await assert.rejects(
    async () => {
      await pglite.query(`DELETE FROM public.cash_receipts WHERE id = $1`, [receiptA1Id]);
    },
    (err: any) => {
      assert.ok(['23001', '23503'].includes(err.code), `Expected FK/RESTRICT violation, got ${err.code}: ${err.message}`);
      return true;
    }
  );

  const rcptCheck = await pglite.query(`SELECT id FROM public.cash_receipts WHERE id = $1`, [receiptA1Id]);
  assert.strictEqual(rcptCheck.rows.length, 1, 'Receipt must survive failed delete');
});

// ----------------------------------------------------------------------------
// F-02: Canonical Reporting & Project Detail
// ----------------------------------------------------------------------------

test('P0B3R-05: /reports/aging uses canonical PostgreSQL invoices', async () => {
  const res = await app.request('/api/reports/aging', {
    headers: {
      Authorization: 'Bearer token-rem-a',
      'x-org-id': ORG_A_ID
    }
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);

  // invoiceA1Id principal = 600,000,000, paid = 200,000,000 -> remaining = 400,000,000
  // dueAt = 2026-08-01 which is > 30 days overdue relative to 2026-09-08
  assert.strictEqual(json.data.aging.totalOutstanding, '400000000.00');
  assert.strictEqual(json.data.aging.overdueOver30, '400000000.00');
});

test('P0B3R-06: /reports/forecast uses canonical PostgreSQL invoices', async () => {
  const res = await app.request('/api/reports/forecast', {
    headers: {
      Authorization: 'Bearer token-rem-a',
      'x-org-id': ORG_A_ID
    }
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.forecast30Days, '400000000.00');
  assert.strictEqual(json.data.schedule.length, 1);
  assert.strictEqual(json.data.schedule[0].invoice, 'INV-REM-A-001');
  assert.strictEqual(json.data.schedule[0].amount, '400000000.00');
});

test('P0B3R-07: /projects/:id embeds canonical PostgreSQL invoices', async () => {
  const res = await app.request(`/api/projects/${PROJ_A_1}`, {
    headers: {
      Authorization: 'Bearer token-rem-a',
      'x-org-id': ORG_A_ID
    }
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.project.id, PROJ_A_1);

  const invList = json.data.invoices;
  assert.strictEqual(invList.length, 1);
  assert.strictEqual(invList[0].id, invoiceA1Id);
  assert.strictEqual(invList[0].invoiceNumber, 'INV-REM-A-001');
  assert.strictEqual(invList[0].principalAmount, '600000000.00');
  assert.strictEqual(invList[0].paidAmount, '200000000.00');
  assert.strictEqual(invList[0].remainingAmount, '400000000.00');
});

test('P0B3R-08: db.invoices empty/restarted does NOT zero canonical aging', async () => {
  // Empty legacy db.invoices
  db.invoices = [];

  const res = await app.request('/api/reports/aging', {
    headers: {
      Authorization: 'Bearer token-rem-a',
      'x-org-id': ORG_A_ID
    }
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.data.aging.totalOutstanding, '400000000.00', 'Aging must be unaffected by db.invoices');
});

test('P0B3R-09: db.invoices empty/restarted does NOT zero canonical forecast', async () => {
  db.invoices = [];

  const res = await app.request('/api/reports/forecast', {
    headers: {
      Authorization: 'Bearer token-rem-a',
      'x-org-id': ORG_A_ID
    }
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.data.forecast30Days, '400000000.00', 'Forecast must be unaffected by db.invoices');
});

// ----------------------------------------------------------------------------
// F-03: Sole Canonical Allocation Value (allocated_amount)
// ----------------------------------------------------------------------------

test('P0B3R-10: divergent allocated_principal vs allocated_amount rejected by DB', async () => {
  // Try direct DB insertion into project_invoice_allocations with divergent values
  await assert.rejects(
    async () => {
      await pglite.query(`
        INSERT INTO public.project_invoice_allocations (
          org_id, project_id, certificate_id, project_invoice_id,
          allocated_principal, allocated_amount
        ) VALUES ($1, $2, $3, $4, 50000000.00, 60000000.00)
      `, [ORG_A_ID, PROJ_A_1, certA1Id, invoiceA1Id]);
    },
    (err: any) => {
      assert.strictEqual(err.code, '23514', 'Expected check constraint violation (chk_pia_allocation_equality)');
      return true;
    }
  );
});

test('P0B3R-11: divergent principal_allocated vs allocated_amount rejected by DB', async () => {
  // Try direct DB insertion into receipt_allocations with divergent values
  await assert.rejects(
    async () => {
      await pglite.query(`
        INSERT INTO public.receipt_allocations (
          org_id, project_id, cash_receipt_id, project_invoice_id,
          principal_allocated, allocated_amount
        ) VALUES ($1, $2, $3, $4, 50000000.00, 60000000.00)
      `, [ORG_A_ID, PROJ_A_1, receiptA1Id, invoiceA1Id]);
    },
    (err: any) => {
      assert.strictEqual(err.code, '23514', 'Expected check constraint violation (chk_ra_allocation_equality)');
      return true;
    }
  );
});

test('P0B3R-12: canonical calculations read allocated_amount only', async () => {
  const totals = await pgLedgerRepo.getLedgerTotals(ORG_A_ID, PROJ_A_1);
  assert.strictEqual(totals.invoiced, '600000000.00');
  assert.strictEqual(totals.collected, '200000000.00');

  const invs = await pgLedgerRepo.getProjectInvoices(ORG_A_ID, PROJ_A_1);
  assert.strictEqual(invs[0].paidAmount, '200000000.00');
  assert.strictEqual(invs[0].remainingAmount, '400000000.00');
});

// ----------------------------------------------------------------------------
// F-04: Cash Receipt Idempotency
// ----------------------------------------------------------------------------

test('P0B3R-13: receipt with null receipt_number + idempotency key creates once', async () => {
  const rcpt = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: 'IDEM-NULL-RCPT-001',
    receiptNumber: undefined, // null receipt_number
    receivedAmount: '50000000.00',
    allocations: [{ invoiceId: invoiceA1Id, amount: '50000000.00' }]
  });

  assert.ok(rcpt.id);
  assert.strictEqual(rcpt.idempotencyKey, 'IDEM-NULL-RCPT-001');
  assert.strictEqual(rcpt.receivedAmount, '50000000.00');

  // Verify DB contains exactly 1 row with this idempotency_key
  const dbCheck = await pglite.query(
    `SELECT id, receipt_number, idempotency_key FROM public.cash_receipts WHERE org_id = $1 AND idempotency_key = $2`,
    [ORG_A_ID, 'IDEM-NULL-RCPT-001']
  );
  assert.strictEqual(dbCheck.rows.length, 1);
  assert.strictEqual(dbCheck.rows[0].receipt_number, null);
});

test('P0B3R-14: same receipt request + same idempotency key does not duplicate', async () => {
  const countBefore = (await pglite.query(`SELECT COUNT(*) FROM public.cash_receipts WHERE org_id = $1`, [ORG_A_ID])).rows[0].count;

  // Re-request identical payload
  const replayed = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: 'IDEM-NULL-RCPT-001',
    receivedAmount: '50000000.00',
    allocations: [{ invoiceId: invoiceA1Id, amount: '50000000.00' }]
  });

  const countAfter = (await pglite.query(`SELECT COUNT(*) FROM public.cash_receipts WHERE org_id = $1`, [ORG_A_ID])).rows[0].count;
  assert.strictEqual(countAfter, countBefore, 'Row count must NOT increase on duplicate idempotency key');
  assert.strictEqual(replayed.idempotencyKey, 'IDEM-NULL-RCPT-001');
  assert.strictEqual(replayed.receivedAmount, '50000000.00');
});

test('P0B3R-15: same idempotency key + conflicting payload rejected with 409', async () => {
  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        orgId: ORG_A_ID,
        projectId: PROJ_A_1,
        idempotencyKey: 'IDEM-NULL-RCPT-001',
        receivedAmount: '99000000.00', // CONFLICTING AMOUNT
        allocations: [{ invoiceId: invoiceA1Id, amount: '99000000.00' }]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      assert.ok(err.message.includes('idempotensi'));
      return true;
    }
  );
});

test('P0B3R-16: same idempotency key across different tenants does not collide', async () => {
  // First create invoice for Tenant B
  const invB = await pgLedgerRepo.createProjectInvoice({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    invoiceNumber: 'INV-REM-B-001',
    allocations: [{ certificateId: certB1Id, amount: '200000000.00' }]
  });

  // Tenant B uses the same idempotency key 'IDEM-NULL-RCPT-001'
  const rcptB = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_B_ID,
    projectId: PROJ_B_1,
    idempotencyKey: 'IDEM-NULL-RCPT-001',
    receivedAmount: '50000000.00',
    allocations: [{ invoiceId: invB.id, amount: '50000000.00' }]
  });

  assert.ok(rcptB.id);
  assert.strictEqual(rcptB.orgId, ORG_B_ID);
  assert.strictEqual(rcptB.idempotencyKey, 'IDEM-NULL-RCPT-001');

  // Verify both exist independently in PostgreSQL
  const dbCheck = await pglite.query(
    `SELECT org_id, idempotency_key FROM public.cash_receipts WHERE idempotency_key = $1 ORDER BY org_id ASC`,
    ['IDEM-NULL-RCPT-001']
  );
  assert.strictEqual(dbCheck.rows.length, 2, 'Both tenants should have their own record with the same idempotency key');
});

test('P0B3R-17: idempotency behavior survives repository/app recreation', async () => {
  // Create a brand new instance of PostgresLedgerRepository attached to the same DB
  const freshRepo = new PostgresLedgerRepository(pglite as any);

  // Exact replay on fresh repo
  const replayOnFresh = await freshRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: 'IDEM-NULL-RCPT-001',
    receivedAmount: '50000000.00',
    allocations: [{ invoiceId: invoiceA1Id, amount: '50000000.00' }]
  });
  assert.strictEqual(replayOnFresh.idempotencyKey, 'IDEM-NULL-RCPT-001');
  assert.strictEqual(replayOnFresh.receivedAmount, '50000000.00');

  // Conflicting replay on fresh repo -> 409
  await assert.rejects(
    async () => {
      await freshRepo.createCashReceipt({
        orgId: ORG_A_ID,
        projectId: PROJ_A_1,
        idempotencyKey: 'IDEM-NULL-RCPT-001',
        receivedAmount: '1234567.00',
        allocations: [{ invoiceId: invoiceA1Id, amount: '1234567.00' }]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 409);
      return true;
    }
  );
});

test('P0B3R-18: receipt transaction failure leaves no idempotency/receipt orphan', async () => {
  const failedKey = 'IDEM-WILL-FAIL-001';

  await assert.rejects(
    async () => {
      await pgLedgerRepo.createCashReceipt({
        orgId: ORG_A_ID,
        projectId: PROJ_A_1,
        idempotencyKey: failedKey,
        receivedAmount: '99999999999.00', // Exceeds remaining invoice balance -> must fail transaction
        allocations: [{ invoiceId: invoiceA1Id, amount: '99999999999.00' }]
      });
    },
    (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      return true;
    }
  );

  // Ensure no row exists in cash_receipts or receipt_allocations with this idempotency key
  const orphanCheck = await pglite.query(
    `SELECT id FROM public.cash_receipts WHERE org_id = $1 AND idempotency_key = $2`,
    [ORG_A_ID, failedKey]
  );
  assert.strictEqual(orphanCheck.rows.length, 0, 'No orphan receipt row should exist after failed transaction');
});

// ----------------------------------------------------------------------------
// Invariant & Conservation Tests
// ----------------------------------------------------------------------------

test('P0B3R-19: G1-G5 conservation still exact', async () => {
  const totals = await pgLedgerRepo.getLedgerTotals(ORG_A_ID, PROJ_A_1);
  const W = parseMoney(totals.workPerformed);
  const M = parseMoney(totals.measured);
  const C = parseMoney(totals.claimed);
  const S = parseMoney(totals.certified);
  const I = parseMoney(totals.invoiced);
  const P = parseMoney(totals.collected);

  const G1 = subtractMoney(W, M);
  const G2 = subtractMoney(M, C);
  const G3 = subtractMoney(C, S);
  const G4 = subtractMoney(S, I);
  const G5 = subtractMoney(I, P);

  const totalGaps = addMoney(addMoney(addMoney(addMoney(G1, G2), G3), G4), G5);
  const expectedDiff = subtractMoney(W, P);

  assert.strictEqual(totalGaps, expectedDiff, 'G1+G2+G3+G4+G5 must equal W-P exactly');
});

test('P0B3R-20: high-value exact money still passes', async () => {
  const highWpl = await pgLedgerRepo.createWorkProgressLine({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    description: 'High Value Work',
    principalAmount: '8888888888888.88'
  });

  const highMeas = await pgLedgerRepo.createMeasurement({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    measurementNumber: 'OPN-HIGH-01',
    allocations: [{ workProgressLineId: highWpl.id, amount: '8888888888888.88' }]
  });

  const highClaim = await pgLedgerRepo.createClaim({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    claimNumber: 'CLM-HIGH-01',
    allocations: [{ measurementId: highMeas.id, amount: '8888888888888.88' }]
  });

  const highCert = await pgLedgerRepo.createCertificate({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    certificateNumber: 'BAP-HIGH-01',
    allocations: [{ claimId: highClaim.id, amount: '8888888888888.88' }]
  });

  const highInv = await pgLedgerRepo.createProjectInvoice({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    invoiceNumber: 'INV-HIGH-001',
    allocations: [{ certificateId: highCert.id, amount: '8888888888888.88' }]
  });

  const highRcpt = await pgLedgerRepo.createCashReceipt({
    orgId: ORG_A_ID,
    projectId: PROJ_A_1,
    idempotencyKey: 'IDEM-HIGH-001',
    receivedAmount: '8888888888888.88',
    allocations: [{ invoiceId: highInv.id, amount: '8888888888888.88' }]
  });

  assert.strictEqual(highInv.principalAmount, '8888888888888.88');
  assert.strictEqual(highRcpt.receivedAmount, '8888888888888.88');
  assert.strictEqual(highRcpt.allocatedAmount, '8888888888888.88');
});

test('P0B3R-21: P0-A regression (tenant isolation and auth)', async () => {
  // Tenant A cannot query Tenant B project invoices
  const tenantAInvs = await pgLedgerRepo.getProjectInvoices(ORG_A_ID, PROJ_B_1);
  assert.strictEqual(tenantAInvs.length, 0, 'Tenant A must not see Tenant B invoices');

  // Tenant B cannot query Tenant A project invoices
  const tenantBInvs = await pgLedgerRepo.getProjectInvoices(ORG_B_ID, PROJ_A_1);
  assert.strictEqual(tenantBInvs.length, 0, 'Tenant B must not see Tenant A invoices');
});

test('P0B3R-22: P0-B1 regression (project repository persistence)', async () => {
  const p = await pgProjectRepo.getProjectById(ORG_A_ID, PROJ_A_1);
  assert.ok(p);
  assert.strictEqual(p.code, 'REM-PROJ-A');
  assert.strictEqual(p.orgId, ORG_A_ID);
});

test('P0B3R-23: P0-B2 regression (W/M/C/S ledger integrity)', async () => {
  const cert = await pgLedgerRepo.getCertificateById(ORG_A_ID, PROJ_A_1, certA1Id);
  assert.ok(cert);
  assert.strictEqual(cert.certificateNumber, 'BAP-REM-A-01');
  assert.strictEqual(cert.totalAllocatedAmount, '1000000000.00');
});

test('P0B3R-24: original P0-B3 suite regression', async () => {
  // Verify invoice -> receipt allocation linkage and status updates
  const inv = await pgLedgerRepo.getProjectInvoiceById(ORG_A_ID, PROJ_A_1, invoiceA1Id);
  assert.ok(inv);
  assert.strictEqual(inv.invoiceNumber, 'INV-REM-A-001');
  assert.strictEqual(inv.principalAmount, '600000000.00');
  // Total paid = 200,000,000 (init) + 50,000,000 (P0B3R-13) = 250,000,000
  assert.strictEqual(inv.paidAmount, '250000000.00');
  assert.strictEqual(inv.remainingAmount, '350000000.00');
  assert.strictEqual(inv.status, 'PARTIALLY_PAID');
});
