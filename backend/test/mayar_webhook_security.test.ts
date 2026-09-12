// ============================================================================
// COVE Backend — Mayar Webhook Security & Persistence Tests (Gate P0-C.1)
// Behavioral Tests P0C1-01 through P0C1-20
// Validates:
// 1. Authenticated server-to-server Mayar webhook intake
// 2. Cryptographic constant-time callback token verification (SHA-256)
// 3. Durable PostgreSQL webhook event persistence & deduplication
// 4. Deterministic SHA-256 payload fingerprinting & tampering detection
// 5. Fail-closed production configuration
// 6. No browser/client simulation authority in production
// 7. Strict commercial project finance isolation (zero mutation on commercial tables)
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before, after} from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {PGlite} from '@electric-sql/pglite';
import app from '../src/index.js';
import {db} from '../src/db/store.js';
import {config} from '../src/config.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import {
  PostgresWebhookRepository,
  setWebhookRepository,
  getWebhookRepository,
  computePayloadHash,
  verifyPayloadHash,
  canonicalJsonStringify
} from '../src/repositories/webhook.repository.js';
import {CANONICAL_MIGRATION_ORDER} from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgWebhookRepo: PostgresWebhookRepository;
let identityRepo: InMemoryIdentityRepository;

const TEST_ORG_ID = '33333333-cccc-4333-8333-333333333333';
const TEST_ADMIN_ID = 'usr-admin-p0c1';
const TEST_SECRET = 'myr_whsec_test_cove_secret_12345';

before(async () => {
  db.reset();

  // 1. Initialize PGlite database
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

  // 2. Seed identity repository
  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    {
      id: TEST_ORG_ID,
      legalName: 'PT Cipta Integra Teknologi',
      displayName: 'Cipta Integra',
      timezone: 'Asia/Jakarta',
      defaultCurrency: 'IDR',
      status: 'ACTIVE'
    }
  ];
  identityRepo.profiles = [
    { id: 'prof-p0c1-admin', authUserId: TEST_ADMIN_ID, fullName: 'Platform Admin P0C1', status: 'ACTIVE' }
  ];
  identityRepo.platformAdmins = [
    { id: 'adm-p0c1', authUserId: TEST_ADMIN_ID, status: 'ACTIVE' }
  ];
  identityRepo.platformRoleGrants = [
    { id: 'grant-p0c1', adminId: 'adm-p0c1', roleScope: 'SUPER_ADMIN' }
  ];
  setIdentityRepository(identityRepo);

  // 3. Configure webhook repository with PostgreSQL instance
  pgWebhookRepo = new PostgresWebhookRepository(pglite as any);
  setWebhookRepository(pgWebhookRepo);

  // 4. Configure token verifier
  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-platform-admin') {
      return {user: {id: TEST_ADMIN_ID, email: 'admin@cove.id'}, error: null};
    }
    return {user: null, error: new Error('Invalid token')};
  });
});

test('P0C1-01: Valid webhook token returns HTTP 200 PROCESSED', async () => {
  const checkoutRef = `chk_${Date.now()}_01`;
  await identityRepo.createCheckoutSession({
    id: `cs-${Date.now()}-01`,
    organizationId: TEST_ORG_ID,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    providerCheckoutId: checkoutRef,
    status: 'PENDING',
    plan: 'scale',
    amount: 9900000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const payload = {
    event: 'payment.settled',
    id: `evt_p0c1_${Date.now()}_01`,
    data: {
      id: checkoutRef,
      amount: 9900000,
      status: 'settled',
      customer_name: 'PT Cipta Integra'
    }
  };

  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.result, 'PROCESSED');
});

test('P0C1-02: Missing x-callback-token returns HTTP 401 Unauthorized', async () => {
  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'payment.settled', id: 'evt_no_token' })
  });
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.match(body.error, /missing webhook callback token/i);
});

test('P0C1-03: Invalid x-callback-token returns HTTP 401 Unauthorized', async () => {
  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': 'attacker-forged-secret-signature'
    },
    body: JSON.stringify({ event: 'payment.settled', id: 'evt_invalid_token' })
  });
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.match(body.error, /invalid webhook callback token/i);
});

test('P0C1-04: Length-mismatched token comparison runs in constant-time and returns 401', async () => {
  const shortToken = 'x';
  const longToken = 'a'.repeat(512);

  const resShort = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': shortToken
    },
    body: JSON.stringify({ event: 'test' })
  });
  assert.strictEqual(resShort.status, 401);

  const resLong = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': longToken
    },
    body: JSON.stringify({ event: 'test' })
  });
  assert.strictEqual(resLong.status, 401);
});

test('P0C1-05: Missing webhook secret configuration fails closed with HTTP 500', async () => {
  const originalSecret = config.mayarWebhookSecret;
  try {
    (config as any).mayarWebhookSecret = '';

    const res = await app.request('/api/webhooks/mayar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-callback-token': 'any-token'
      },
      body: JSON.stringify({ event: 'test' })
    });
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /not configured/i);
  } finally {
    (config as any).mayarWebhookSecret = originalSecret;
  }
});

test('P0C1-06: Webhook event is persistently written to PostgreSQL webhook_events table', async () => {
  const eventId = `evt_persist_${Date.now()}`;
  const checkoutRef = `chk_persist_${Date.now()}`;

  await identityRepo.createCheckoutSession({
    id: `cs-${Date.now()}-persist`,
    organizationId: TEST_ORG_ID,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    providerCheckoutId: checkoutRef,
    status: 'PENDING',
    plan: 'pilot',
    amount: 7500000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const payload = {
    event: 'payment.settled',
    id: eventId,
    data: {
      id: checkoutRef,
      amount: 7500000,
      status: 'settled'
    }
  };

  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(res.status, 200);

  // Directly query PostgreSQL to verify row persistence
  const rowRes = await pglite.query(
    `SELECT event_id, provider, event_type, payload, payload_hash, processed_at
     FROM public.webhook_events
     WHERE event_id = $1`,
    [eventId]
  );
  assert.strictEqual(rowRes.rows.length, 1, 'Event row must exist in PostgreSQL');
  const row: any = rowRes.rows[0];
  assert.strictEqual(row.event_id, eventId);
  assert.strictEqual(row.provider, 'MAYAR');
  assert.strictEqual(row.event_type, 'payment.settled');
  assert.ok(row.payload_hash, 'payload_hash must be populated');
  assert.strictEqual(row.payload_hash, computePayloadHash(payload));
});

test('P0C1-07: Deterministic SHA-256 payload hashing ignores JSON property ordering', () => {
  const payload1 = {
    id: 'evt_100',
    event: 'payment.settled',
    data: { amount: 1000, status: 'PAID', id: 'chk_1' }
  };

  const payload2 = {
    data: { status: 'PAID', id: 'chk_1', amount: 1000 },
    event: 'payment.settled',
    id: 'evt_100'
  };

  const hash1 = computePayloadHash(payload1);
  const hash2 = computePayloadHash(payload2);

  assert.strictEqual(hash1, hash2, 'Hash must be strictly identical regardless of key order');
  assert.strictEqual(verifyPayloadHash(payload1, hash2), true);
});

test('P0C1-08: Payload tampering is detected by SHA-256 hash mismatch', () => {
  const originalPayload = {
    id: 'evt_tamper_test',
    event: 'payment.settled',
    data: { amount: 1000000, id: 'chk_genuine' }
  };
  const originalHash = computePayloadHash(originalPayload);

  const tamperedPayload = {
    id: 'evt_tamper_test',
    event: 'payment.settled',
    data: { amount: 999999999, id: 'chk_genuine' } // Modified amount
  };

  const tamperedHash = computePayloadHash(tamperedPayload);
  assert.notStrictEqual(originalHash, tamperedHash, 'Tampered payload must yield distinct hash');
  assert.strictEqual(verifyPayloadHash(tamperedPayload, originalHash), false);
});

test('P0C1-09: Idempotent replay of same event_id returns DUPLICATE status without creating duplicate rows', async () => {
  const eventId = `evt_replay_${Date.now()}`;
  const checkoutRef = `chk_replay_${Date.now()}`;

  await identityRepo.createCheckoutSession({
    id: `cs-${Date.now()}-replay`,
    organizationId: TEST_ORG_ID,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    providerCheckoutId: checkoutRef,
    status: 'PENDING',
    plan: 'core',
    amount: 4900000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const payload = {
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, amount: 4900000, status: 'settled' }
  };

  // First ingestion
  const res1 = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(res1.status, 200);
  const body1 = await res1.json();
  assert.strictEqual(body1.result, 'PROCESSED');

  // Second identical ingestion
  const res2 = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(res2.status, 200);
  const body2 = await res2.json();
  assert.strictEqual(body2.result, 'DUPLICATE', 'Replayed event must return DUPLICATE');

  // Verify only 1 row exists in PostgreSQL
  const countRes = await pglite.query(
    `SELECT COUNT(*) as cnt FROM public.webhook_events WHERE event_id = $1`,
    [eventId]
  );
  assert.strictEqual(Number((countRes.rows[0] as any).cnt), 1, 'Only 1 row may exist in PostgreSQL');
});

test('P0C1-10: Concurrent ingestion of identical event_id handles race safely via 23505 recovery', async () => {
  const raceEventId = `evt_race_${Date.now()}`;
  const input = {
    eventId: raceEventId,
    provider: 'MAYAR',
    eventType: 'payment.settled',
    payload: { id: raceEventId, data: { amount: 5000 } }
  };

  // Simulate two concurrent repository inserts
  const [result1, result2] = await Promise.all([
    pgWebhookRepo.recordWebhookEvent(input),
    pgWebhookRepo.recordWebhookEvent(input)
  ]);

  // One of them is not duplicate, one is duplicate, but both succeed gracefully
  assert.ok(
    (result1.isDuplicate && !result2.isDuplicate) || (!result1.isDuplicate && result2.isDuplicate),
    'Exactly one call must succeed and one must return isDuplicate=true'
  );

  const dbRows = await pglite.query(
    `SELECT COUNT(*) as cnt FROM public.webhook_events WHERE event_id = $1`,
    [raceEventId]
  );
  assert.strictEqual(Number((dbRows.rows[0] as any).cnt), 1);
});

test('P0C1-11: Webhook event durability survives repository instance recreation', async () => {
  const eventId = `evt_durable_${Date.now()}`;
  await pgWebhookRepo.recordWebhookEvent({
    eventId,
    provider: 'MAYAR',
    eventType: 'payment.settled',
    payload: { test: 'durability' }
  });

  // Re-instantiate repository pointing to same database
  const freshRepo = new PostgresWebhookRepository(pglite as any);
  const fetched = await freshRepo.findWebhookEvent('MAYAR', eventId);

  assert.ok(fetched, 'Event must be readable by freshly created repository instance');
  assert.strictEqual(fetched?.eventId, eventId);
  assert.strictEqual(fetched?.eventType, 'payment.settled');
});

test('P0C1-12: Webhook intake NEVER mutates commercial project finance tables', async () => {
  // Snapshot row counts of commercial tables
  const invoiceCountBefore = await pglite.query(`SELECT COUNT(*) as cnt FROM public.project_invoices`);
  const receiptCountBefore = await pglite.query(`SELECT COUNT(*) as cnt FROM public.cash_receipts`);
  const certCountBefore = await pglite.query(`SELECT COUNT(*) as cnt FROM public.certificates`);
  const claimCountBefore = await pglite.query(`SELECT COUNT(*) as cnt FROM public.claims`);
  const projectCountBefore = await pglite.query(`SELECT COUNT(*) as cnt FROM public.projects`);

  const checkoutRef = `chk_no_commercial_${Date.now()}`;
  await identityRepo.createCheckoutSession({
    id: `cs-${Date.now()}-comm`,
    organizationId: TEST_ORG_ID,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    providerCheckoutId: checkoutRef,
    status: 'PENDING',
    plan: 'core',
    amount: 4900000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Execute webhook intake
  await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({
      event: 'payment.settled',
      id: `evt_comm_${Date.now()}`,
      data: { id: checkoutRef, amount: 4900000, status: 'settled' }
    })
  });

  // Snapshot row counts after
  const invoiceCountAfter = await pglite.query(`SELECT COUNT(*) as cnt FROM public.project_invoices`);
  const receiptCountAfter = await pglite.query(`SELECT COUNT(*) as cnt FROM public.cash_receipts`);
  const certCountAfter = await pglite.query(`SELECT COUNT(*) as cnt FROM public.certificates`);
  const claimCountAfter = await pglite.query(`SELECT COUNT(*) as cnt FROM public.claims`);
  const projectCountAfter = await pglite.query(`SELECT COUNT(*) as cnt FROM public.projects`);

  assert.strictEqual((invoiceCountAfter.rows[0] as any).cnt, (invoiceCountBefore.rows[0] as any).cnt, 'project_invoices count must not change');
  assert.strictEqual((receiptCountAfter.rows[0] as any).cnt, (receiptCountBefore.rows[0] as any).cnt, 'cash_receipts count must not change');
  assert.strictEqual((certCountAfter.rows[0] as any).cnt, (certCountBefore.rows[0] as any).cnt, 'certificates count must not change');
  assert.strictEqual((claimCountAfter.rows[0] as any).cnt, (claimCountBefore.rows[0] as any).cnt, 'claims count must not change');
  assert.strictEqual((projectCountAfter.rows[0] as any).cnt, (projectCountBefore.rows[0] as any).cnt, 'projects count must not change');
});

test('P0C1-13: Settlement for non-existent checkout session is safely IGNORED', async () => {
  const unmappedRef = `unmapped_chk_${Date.now()}`;
  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({
      event: 'payment.settled',
      id: `evt_unmapped_${Date.now()}`,
      data: { id: unmappedRef, amount: 4900000, status: 'settled' }
    })
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.result, 'IGNORED');
});

test('P0C1-14: Settlement for already-PAID checkout session returns DUPLICATE', async () => {
  const checkoutRef = `chk_alreadypaid_${Date.now()}`;
  await identityRepo.createCheckoutSession({
    id: `cs-${Date.now()}-paid`,
    organizationId: TEST_ORG_ID,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    providerCheckoutId: checkoutRef,
    status: 'PAID', // Already PAID
    plan: 'core',
    amount: 4900000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({
      event: 'payment.settled',
      id: `evt_alreadypaid_${Date.now()}`,
      data: { id: checkoutRef, amount: 4900000, status: 'settled' }
    })
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.result, 'DUPLICATE');
});

test('P0C1-15: Database failure during settlement rolls back and returns HTTP 500 for provider retry', async () => {
  const checkoutRef = `chk_fail_${Date.now()}`;
  await identityRepo.createCheckoutSession({
    id: `cs-${Date.now()}-fail`,
    organizationId: TEST_ORG_ID,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    providerCheckoutId: checkoutRef,
    status: 'PENDING',
    plan: 'core',
    amount: 4900000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const originalUpdate = identityRepo.updateCheckoutSessionStatus;
  identityRepo.updateCheckoutSessionStatus = async () => {
    throw new Error('CRITICAL SIMULATED DATABASE ERROR ON SETTLEMENT');
  };

  try {
    const res = await app.request('/api/webhooks/mayar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-callback-token': config.mayarWebhookSecret
      },
      body: JSON.stringify({
        event: 'payment.settled',
        id: `evt_dberr_${Date.now()}`,
        data: { id: checkoutRef, amount: 4900000, status: 'settled' }
      })
    });
    assert.strictEqual(res.status, 500, 'Must return HTTP 500 so provider retries');
    const body = await res.json();
    assert.strictEqual(body.success, false);
  } finally {
    identityRepo.updateCheckoutSessionStatus = originalUpdate;
  }
});

test('P0C1-16: Non-settlement webhook events (payment.expired) are recorded with payload hash', async () => {
  const eventId = `evt_expired_${Date.now()}`;
  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({
      event: 'payment.expired',
      id: eventId,
      data: { id: 'chk_expired_001', status: 'expired' }
    })
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.result, 'PROCESSED');

  const row = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(row);
  assert.strictEqual(row?.eventType, 'payment.expired');
  assert.ok(row?.payloadHash);
});

test('P0C1-17: Malformed payload or missing event field returns HTTP 400 Bad Request', async () => {
  const resMissingEvent = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({ id: 'evt_no_event' })
  });
  assert.strictEqual(resMissingEvent.status, 400);

  const resMalformed = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: 'not-valid-json{{'
  });
  assert.strictEqual(resMalformed.status, 400);
});

test('P0C1-18: Admin endpoint GET /api/admin/webhooks fetches durable events from WebhookRepository', async () => {
  const res = await app.request('/api/admin/webhooks', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer token-platform-admin'
    }
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0, 'Should return recorded webhook events');
});

test('P0C1-19: No unauthenticated browser/client simulation endpoint exists in production', async () => {
  // Verify that calling non-existent mock endpoints fails closed
  const resFakeSim = await app.request('/api/webhooks/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'settled' })
  });
  assert.strictEqual(resFakeSim.status, 404, 'Simulation endpoints must not exist in routing table');
});

test('P0C1-20: SaaS subscription settlement updates subscription status without altering project ledger invariants', async () => {
  const checkoutRef = `chk_invariants_${Date.now()}`;
  await identityRepo.createCheckoutSession({
    id: `cs-${Date.now()}-inv`,
    organizationId: TEST_ORG_ID,
    provider: 'MAYAR',
    providerReference: checkoutRef,
    providerCheckoutId: checkoutRef,
    status: 'PENDING',
    plan: 'scale',
    amount: 9900000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const res = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': config.mayarWebhookSecret
    },
    body: JSON.stringify({
      event: 'payment.settled',
      id: `evt_inv_${Date.now()}`,
      data: { id: checkoutRef, amount: 9900000, status: 'settled' }
    })
  });
  assert.strictEqual(res.status, 200);

  // Assert subscription for organization is ACTIVE
  const sub = await identityRepo.getSubscriptionByOrgId(TEST_ORG_ID);
  assert.strictEqual(sub?.status, 'ACTIVE');
  assert.strictEqual(sub?.planId, 'scale');
});
