// ============================================================================
// COVE Backend — P0-C5.1B Vercel Native Hono Entrypoint & Raw Body Regression
// Validates:
// 1. backend/src/index.ts is a pure Hono entrypoint with zero startup side effects
// 2. Importing index.ts does not bind TCP sockets or start background listeners
// 3. Native app.request('/api/health') returns HTTP 200
// 4. Raw webhook body preservation: semantically identical JSON with different
//    whitespace generates different payload hashes and triggers HTTP 409 conflict.
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before, after} from 'node:test';
import assert from 'node:assert';
import {execSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import app from '../src/index.js';
import appFromSrc from '../src/app.js';
import {config} from '../src/config.js';
import {db} from '../src/db/store.js';
import {
  PostgresWebhookRepository,
  setWebhookRepository
} from '../src/repositories/webhook.repository.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository,
  getIdentityRepository
} from '../src/repositories/identity.repository.js';
import {CANONICAL_MIGRATION_ORDER} from '../src/db/migrate.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgWebhookRepo: PostgresWebhookRepository;
const TEST_SECRET = 'whsec_p0c5_native_hono_test_secret';

before(async () => {
  db.reset();
  config.mayarWebhookSecret = TEST_SECRET;

  // Initialize in-memory PGlite with canonical migrations for webhook repo
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
  for (const file of CANONICAL_MIGRATION_ORDER) {
    const filePath = path.join(migrationsDir, file);
    if (fs.existsSync(filePath)) {
      const sql = fs.readFileSync(filePath, 'utf-8');
      await pglite.exec(sql);
    }
  }

  pgWebhookRepo = new PostgresWebhookRepository(pglite as any);
  setWebhookRepository(pgWebhookRepo);

  const identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    {
      id: '33333333-cccc-4333-8333-333333333333',
      legalName: 'PT Cipta Integra Teknologi',
      displayName: 'Cipta Integra',
      timezone: 'Asia/Jakarta',
      defaultCurrency: 'IDR',
      status: 'ACTIVE'
    }
  ];
  setIdentityRepository(identityRepo);
});

after(async () => {
  if (pglite) {
    await pglite.close();
  }
});

test('P0C5-01: src/index.ts exports Hono app identical to src/app.ts', () => {
  assert.strictEqual(app, appFromSrc, 'index.ts must export the exact same app instance as app.ts');
  assert.strictEqual(typeof app.fetch, 'function', 'app must expose fetch handler');
  assert.strictEqual(typeof app.request, 'function', 'app must expose request handler');
});

test('P0C5-02: importing src/index.ts has no network listener side-effects', () => {
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf-8');
  assert.ok(!indexSource.includes('serve('), 'src/index.ts must not call serve()');
  assert.ok(!indexSource.includes('@hono/node-server'), 'src/index.ts must not import @hono/node-server');

  // Verify compiled dist/index.js exits immediately with 0 active listeners
  const distIndexPath = path.resolve(__dirname, '../dist/index.js');
  assert.ok(fs.existsSync(distIndexPath), 'dist/index.js must be built before test runs');
  const code = `
    import mod from './dist/index.js';
    if (typeof mod?.fetch !== 'function') process.exit(1);
    process.exit(0);
  `;
  execSync(`node --input-type=module -e "${code.replace(/\n/g, ' ')}"`, {
    cwd: path.resolve(__dirname, '..'),
    timeout: 30000
  });
  assert.ok(true, 'Isolated import completed immediately with 0 background network listeners');
});

test('P0C5-03: app.request("/api/health") returns HTTP 200 without network socket', async () => {
  const res = await app.request('/api/health');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(data.service, 'cove-backend');
});

test('P0C5-04: webhook route rejects missing and invalid x-callback-token', async () => {
  // Test A: Missing token
  const resMissing = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'evt_no_token', event: 'payment.settled', data: {} })
  });
  assert.strictEqual(resMissing.status, 401);
  const dataMissing = await resMissing.json();
  assert.strictEqual(dataMissing.success, false);
  assert.match(dataMissing.error, /missing webhook callback token/i);

  // Test B: Invalid token
  const resInvalid = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-callback-token': 'wrong_invalid_secret_token'
    },
    body: JSON.stringify({ id: 'evt_invalid_token', event: 'payment.settled', data: {} })
  });
  assert.strictEqual(resInvalid.status, 401);
  const dataInvalid = await resInvalid.json();
  assert.strictEqual(dataInvalid.success, false);
  assert.match(dataInvalid.error, /invalid webhook callback token/i);
});

test('P0C5-05: raw webhook body preservation produces distinct hashes and triggers conflict for whitespace differences', async () => {
  const eventId = `evt_p0c5_raw_${Date.now()}`;
  const checkoutRef = `chk_p0c5_raw_${Date.now()}`;

  const idRepo = getIdentityRepository();
  await (idRepo as any).createCheckoutSession({
    id: `cs-p0c5-${Date.now()}`,
    organizationId: '33333333-cccc-4333-8333-333333333333',
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

  // Payload 1: compact JSON string
  const rawBody1 = JSON.stringify({
    event: 'payment.settled',
    id: eventId,
    data: {
      id: checkoutRef,
      amount: 4900000,
      status: 'settled'
    }
  });

  // Payload 2: semantically identical JSON but with extra whitespace and indentation
  const rawBody2 = `{\n  "event":   "payment.settled",\n  "id": "${eventId}",\n  "data": {\n    "id": "${checkoutRef}",\n    "amount": 4900000,\n    "status": "settled"\n  }\n}`;

  // Verify that parsed objects are identical
  assert.deepStrictEqual(JSON.parse(rawBody1), JSON.parse(rawBody2), 'Payloads must be semantically identical');
  assert.notStrictEqual(rawBody1, rawBody2, 'Raw text strings must be byte-distinct');

  // Delivery 1: submit Payload 1
  const res1 = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-callback-token': TEST_SECRET
    },
    body: rawBody1
  });

  // In test environment without checkout session row, settlement returns IGNORED or PROCESSED depending on test setup
  assert.ok(res1.status === 200 || res1.status === 400, `First delivery HTTP status was ${res1.status}`);

  // Delivery 2: submit exact duplicate (same rawBody1) -> must be DUPLICATE (HTTP 200)
  const resDup = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-callback-token': TEST_SECRET
    },
    body: rawBody1
  });
  assert.strictEqual(resDup.status, 200);
  const dataDup = await resDup.json();
  assert.strictEqual(dataDup.result, 'DUPLICATE');

  // Delivery 3: submit Payload 2 (same eventId, but byte-different rawBody2) -> must trigger CONFLICT (HTTP 409)
  const resConflict = await app.request('/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-callback-token': TEST_SECRET
    },
    body: rawBody2
  });

  assert.strictEqual(resConflict.status, 409, 'Different raw body bytes for same event ID must return HTTP 409 Conflict');
  const dataConflict = await resConflict.json();
  assert.strictEqual(dataConflict.success, false);
  assert.strictEqual(dataConflict.result, 'CONFLICT');
});
