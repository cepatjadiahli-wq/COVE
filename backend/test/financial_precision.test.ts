// ============================================================================
// COVE Backend — Financial Precision Remediation Tests (Gate P0-B2.1)
// Behavioral & exact arithmetic tests proving exact decimal precision across
// Work Performed -> Measured -> Claimed -> Certified and G1, G2, G3.
// ============================================================================

process.env.NODE_ENV = 'test';

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import app from '../src/index.js';
import { db } from '../src/db/store.js';
import { setTestTokenVerifier } from '../src/lib/supabase.js';
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
  setLedgerRepository
} from '../src/repositories/ledger.repository.js';
import { CANONICAL_MIGRATION_ORDER } from '../src/db/migrate.js';
import {
  parseMoney,
  parseMoneyToMinorUnits,
  minorUnitsToMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  isPositiveMoney,
  isZeroMoney
} from '../src/utils/money.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgProjectRepo: PostgresProjectRepository;
let pgLedgerRepo: PostgresLedgerRepository;
let identityRepo: InMemoryIdentityRepository;

const ORG_PREC_ID = 'aaaaaaaa-9999-4999-8999-111111111111';
const USER_PREC_ID = 'usr-precision-tester';
const PROJ_PREC_ID = '33333333-aaaa-4aaa-8aaa-111111111111';

before(async () => {
  db.reset();

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

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name, status)
    VALUES ('${ORG_PREC_ID}'::uuid, 'PT Presisi Konstruksi Mandiri', 'Presisi Mandiri', 'ACTIVE');
  `);

  pgProjectRepo = new PostgresProjectRepository(pglite as any);
  setProjectRepository(pgProjectRepo);

  pgLedgerRepo = new PostgresLedgerRepository(pglite as any);
  setLedgerRepository(pgLedgerRepo);

  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES ('${PROJ_PREC_ID}'::uuid, '${ORG_PREC_ID}'::uuid, 'PRJ-PREC-01', 'Megaproject Presisi', 'Klien Presisi', 'ACTIVE', 500000000000);
  `);

  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    { id: ORG_PREC_ID, legalName: 'PT Presisi Konstruksi Mandiri', displayName: 'Presisi Mandiri', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }
  ];
  identityRepo.profiles = [
    { id: 'prof-prec', authUserId: USER_PREC_ID, fullName: 'Precision Tester', status: 'ACTIVE' }
  ];
  identityRepo.memberships = [
    { id: 'mem-prec-1', orgId: ORG_PREC_ID, profileId: 'prof-prec', role: 'OWNER', status: 'ACTIVE' }
  ];
  setIdentityRepository(identityRepo);

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-prec') {
      return {
        user: {
          id: USER_PREC_ID,
          email: 'precision@example.com',
          user_metadata: { full_name: 'Precision Tester' }
        },
        error: null
      };
    }
    return { user: null, error: 'Token tidak valid' };
  });
});

after(() => {
  setTestTokenVerifier(null);
  db.reset();
});

// ─────────────────────────────────────────────────────────────────────────────
// PRECISION UNIT TESTS: Exact Money Arithmetic Module (backend/src/utils/money.ts)
// ─────────────────────────────────────────────────────────────────────────────

test('PREC-01: Prove exact 0.10 + 0.20 = 0.30 without IEEE-754 drift', () => {
  // In IEEE-754 float: 0.1 + 0.2 = 0.30000000000000004
  const sumFloat = 0.1 + 0.2;
  assert.notStrictEqual(sumFloat.toString(), '0.3');

  // Exact money addition
  const exactSum = addMoney('0.10', '0.20');
  assert.strictEqual(exactSum, '0.30');
});

test('PREC-02: Base decimal string representations parse and format accurately', () => {
  assert.strictEqual(parseMoney('0.01'), '0.01');
  assert.strictEqual(parseMoney('0.10'), '0.10');
  assert.strictEqual(parseMoney('0.20'), '0.20');
  assert.strictEqual(parseMoney('0.30'), '0.30');
  assert.strictEqual(parseMoney('123.45'), '123.45');
  assert.strictEqual(parseMoney('1000'), '1000.00');

  assert.strictEqual(parseMoneyToMinorUnits('0.01'), 1n);
  assert.strictEqual(parseMoneyToMinorUnits('0.10'), 10n);
  assert.strictEqual(parseMoneyToMinorUnits('123.45'), 12345n);
  assert.strictEqual(minorUnitsToMoney(12345n), '123.45');
  assert.strictEqual(minorUnitsToMoney(1n), '0.01');
  assert.strictEqual(minorUnitsToMoney(0n), '0.00');
});

test('PREC-03: Values exceeding JavaScript Number.MAX_SAFE_INTEGER retain exact precision', () => {
  // Number.MAX_SAFE_INTEGER is 9,007,199,254,740,991.
  // In cents, 900719925474099.91 is 90,071,992,547,409,991 cents (> MAX_SAFE_INTEGER)
  const highVal = '900719925474099.91';
  assert.strictEqual(parseMoney(highVal), '900719925474099.91');

  // Exact subtraction: "900719925474099.91" - "0.01" must equal "900719925474099.90"
  const diff = subtractMoney(highVal, '0.01');
  assert.strictEqual(diff, '900719925474099.90');

  // Compare money equality:
  assert.strictEqual(compareMoney(highVal, diff), 1);
  assert.strictEqual(compareMoney(diff, highVal), -1);
  assert.strictEqual(compareMoney(diff, diff), 0);
});

test('PREC-04: Full NUMERIC(18,2) maximum boundary (9999999999999999.99) is supported', () => {
  const maxNumeric = '9999999999999999.99';
  assert.strictEqual(parseMoney(maxNumeric), '9999999999999999.99');
  assert.strictEqual(parseMoneyToMinorUnits(maxNumeric), 999999999999999999n);
  assert.strictEqual(minorUnitsToMoney(999999999999999999n), '9999999999999999.99');

  const subtracted = subtractMoney(maxNumeric, '0.99');
  assert.strictEqual(subtracted, '9999999999999999.00');

  const addedBack = addMoney(subtracted, '0.99');
  assert.strictEqual(addedBack, maxNumeric);
});

test('PREC-05: Reject malformed, scientific notation, NaN, Infinity, negative, and out-of-bounds values', () => {
  assert.throws(() => parseMoney('NaN'), /Format nilai uang tidak valid/);
  assert.throws(() => parseMoney('Infinity'), /Format nilai uang tidak valid/);
  assert.throws(() => parseMoney('-Infinity'), /Format nilai uang tidak valid/);
  assert.throws(() => parseMoney('1e5'), /Format nilai uang tidak valid/);
  assert.throws(() => parseMoney('1.2.3'), /Format nilai uang tidak valid/);
  assert.throws(() => parseMoney('abc'), /Format nilai uang tidak valid/);
  assert.throws(() => parseMoney('10.555'), /Format nilai uang tidak valid/); // > 2 decimals rejected
  assert.throws(() => parseMoney('-10.00'), /Format nilai uang tidak valid/);
  assert.throws(() => parseMoney('10000000000000000.00'), /melebihi batas maksimum NUMERIC\(18,2\)/); // > 16 integer digits
});

test('PREC-06: Comparison and zero/positive helpers work accurately', () => {
  assert.strictEqual(isZeroMoney('0.00'), true);
  assert.strictEqual(isZeroMoney('0'), true);
  assert.strictEqual(isZeroMoney('0.01'), false);

  assert.strictEqual(isPositiveMoney('0.01'), true);
  assert.strictEqual(isPositiveMoney('0.00'), false);

  assert.strictEqual(compareMoney('100.00', '50.00'), 1);
  assert.strictEqual(compareMoney('50.00', '100.00'), -1);
  assert.strictEqual(compareMoney('100.00', '100.00'), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// PRECISION INTEGRATION TESTS: PostgreSQL Canonical Ledger End-to-End
// ─────────────────────────────────────────────────────────────────────────────

let highWplId = '';
let highMeasId = '';
let highClaimId = '';
let highCertId = '';

test('PREC-07: High-value canonical Work Progress persists in PostgreSQL NUMERIC(18,2)', async () => {
  // W: "900719925474099.91" (exceeds Number.MAX_SAFE_INTEGER cents)
  const res = await app.request(`/api/projects/${PROJ_PREC_ID}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      lineItemCode: 'ITEM-PREC-HIGH-01',
      description: 'High-value precision foundation work',
      principalAmount: '900719925474099.91'
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.principalAmount, '900719925474099.91');
  assert.strictEqual(typeof body.data.principalAmount, 'string');
  highWplId = body.data.id;

  // Direct PostgreSQL query verification
  const dbCheck = await pglite.query<{ principal_amount: string }>(
    `SELECT principal_amount FROM public.work_progress_lines WHERE id = $1`,
    [highWplId]
  );
  assert.strictEqual(dbCheck.rows[0].principal_amount, '900719925474099.91');
});

test('PREC-08: High-value canonical Measurement allocates and persists in PostgreSQL', async () => {
  // M: "700719925474099.90"
  const res = await app.request(`/api/projects/${PROJ_PREC_ID}/measurements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      measurementNumber: 'MEAS-PREC-01',
      description: 'High-value precision measurement',
      allocations: [
        { workProgressLineId: highWplId, amount: '700719925474099.90' }
      ]
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.totalAllocatedAmount, '700719925474099.90');
  assert.strictEqual(typeof body.data.totalAllocatedAmount, 'string');
  highMeasId = body.data.id;
});

test('PREC-09: High-value canonical Claim allocates and persists in PostgreSQL', async () => {
  // C: "600000000000000.01"
  const res = await app.request(`/api/projects/${PROJ_PREC_ID}/claims`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      claimNumber: 'CLM-PREC-01',
      description: 'High-value precision claim',
      allocations: [
        { measurementId: highMeasId, amount: '600000000000000.01' }
      ]
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.totalAllocatedAmount, '600000000000000.01');
  assert.strictEqual(typeof body.data.totalAllocatedAmount, 'string');
  highClaimId = body.data.id;
});

test('PREC-10: High-value canonical Certification allocates and persists in PostgreSQL', async () => {
  // S: "500000000000000.00"
  const res = await app.request(`/api/projects/${PROJ_PREC_ID}/certificates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      certificateNumber: 'CERT-PREC-01',
      description: 'High-value precision certificate',
      allocations: [
        { claimId: highClaimId, amount: '500000000000000.00' }
      ]
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.totalAllocatedAmount, '500000000000000.00');
  assert.strictEqual(typeof body.data.totalAllocatedAmount, 'string');
  highCertId = body.data.id;
});

test('PREC-11: High-value Canonical Ledger summary verifies exact W/M/C/S and G1/G2/G3 values', async () => {
  const res = await app.request(`/api/projects/${PROJ_PREC_ID}/ledger`, {
    headers: {
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    }
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);

  // Exact W, M, C, S totals in decimal strings:
  // W: "900719925474099.91"
  // M: "700719925474099.90"
  // C: "600000000000000.01"
  // S: "500000000000000.00"
  assert.strictEqual(body.data.totals.workPerformed, '900719925474099.91');
  assert.strictEqual(body.data.totals.measured, '700719925474099.90');
  assert.strictEqual(body.data.totals.claimed, '600000000000000.01');
  assert.strictEqual(body.data.totals.certified, '500000000000000.00');

  // Gaps calculation verification:
  // G1 = W - M = 900719925474099.91 - 700719925474099.90 = "200000000000000.01"
  // G2 = M - C = 700719925474099.90 - 600000000000000.01 = "100719925474099.89"
  // G3 = C - S = 600000000000000.01 - 500000000000000.00 = "100000000000000.01"
  assert.strictEqual(body.data.totals.g1, '200000000000000.01');
  assert.strictEqual(body.data.totals.g2, '100719925474099.89');
  assert.strictEqual(body.data.totals.g3, '100000000000000.01');

  // Identity Invariant Check:
  // W = M + G1
  assert.strictEqual(addMoney(body.data.totals.measured, body.data.totals.g1), body.data.totals.workPerformed);
  // M = C + G2
  assert.strictEqual(addMoney(body.data.totals.claimed, body.data.totals.g2), body.data.totals.measured);
  // C = S + G3
  assert.strictEqual(addMoney(body.data.totals.certified, body.data.totals.g3), body.data.totals.claimed);
});

test('PREC-12: Max NUMERIC(18,2) value (9999999999999999.99) roundtrip succeeds in PostgreSQL ledger', async () => {
  const maxVal = '9999999999999999.99';

  const res = await app.request(`/api/projects/${PROJ_PREC_ID}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      lineItemCode: 'ITEM-MAX-NUMERIC',
      description: 'Maximum NUMERIC(18,2) boundary test',
      principalAmount: maxVal
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.principalAmount, maxVal);

  // Verify in PostgreSQL table
  const dbCheck = await pglite.query<{ principal_amount: string }>(
    `SELECT principal_amount FROM public.work_progress_lines WHERE id = $1`,
    [body.data.id]
  );
  assert.strictEqual(dbCheck.rows[0].principal_amount, maxVal);
});

test('PREC-13: Input validation rejects malformed money payloads with HTTP 400', async () => {
  // Negative amount
  const resNeg = await app.request(`/api/projects/${PROJ_PREC_ID}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      lineItemCode: 'ITEM-ERR-NEG',
      description: 'Invalid negative test',
      principalAmount: '-500.00'
    })
  });
  assert.strictEqual(resNeg.status, 400);

  // Scientific notation
  const resSci = await app.request(`/api/projects/${PROJ_PREC_ID}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      lineItemCode: 'ITEM-ERR-SCI',
      description: 'Invalid scientific test',
      principalAmount: '1e10'
    })
  });
  assert.strictEqual(resSci.status, 400);

  // Malformed characters
  const resMal = await app.request(`/api/projects/${PROJ_PREC_ID}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      lineItemCode: 'ITEM-ERR-MAL',
      description: 'Invalid malformed test',
      principalAmount: '123.45.67'
    })
  });
  assert.strictEqual(resMal.status, 400);

  // Excessive decimal scale (>2)
  const resScale = await app.request(`/api/projects/${PROJ_PREC_ID}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token-prec',
      'x-organization-id': ORG_PREC_ID
    },
    body: JSON.stringify({
      lineItemCode: 'ITEM-ERR-SCALE',
      description: 'Invalid scale test',
      principalAmount: '123.456'
    })
  });
  assert.strictEqual(resScale.status, 400);
});
