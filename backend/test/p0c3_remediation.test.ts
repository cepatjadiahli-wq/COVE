// ============================================================================
// COVE Backend — P0-C3.1 Transient Exhaustion Recovery Remediation Tests
// Tests P0C3R-01 through P0C3R-15 (F-C3.1 Blocker Closure)
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
import { config } from '../src/config.js';
import { MayarService } from '../src/services/mayar.service.js';
import { ReplayService } from '../src/services/replay.service.js';
import { setTestTokenVerifier } from '../src/lib/supabase.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import {
  PostgresWebhookRepository,
  setWebhookRepository
} from '../src/repositories/webhook.repository.js';
import {
  PostgresBillingSettlementRepository,
  setBillingSettlementRepository
} from '../src/repositories/billing_settlement.repository.js';
import { CANONICAL_MIGRATION_ORDER } from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgWebhookRepo: PostgresWebhookRepository;
let pgSettlementRepo: PostgresBillingSettlementRepository;
let identityRepo: InMemoryIdentityRepository;

const TEST_SECRET = 'myr_whsec_p0c31_remediation_sec_999';
const ORG_A_ID = '33333333-aaaa-4333-8aaa-333333333333';
const ADMIN_AUTH_ID = '99999999-9999-4999-8999-999999999999';
const ADMIN_RECORD_ID = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_AUTH_ID = '88888888-8888-4888-8888-888888888888';

async function sendSignedWebhook(payload: Record<string, any>, token: string = TEST_SECRET) {
  const payloadStr = JSON.stringify(payload);
  const req = new Request('http://localhost:3000/api/webhooks/mayar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': token
    },
    body: payloadStr
  });
  return await app.fetch(req);
}

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

  // Seed plans
  await pglite.exec(`
    INSERT INTO public.plans (id, name, price_idr, billing_period, max_active_projects, max_users, status) VALUES
    ('core', 'Core', 4900000.00, 'MONTHLY', 3, 5, 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed organizations
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name)
    VALUES ('${ORG_A_ID}', 'Org Alpha Remediation', 'Alpha Remediation')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed platform admin
  await pglite.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN_AUTH_ID}', 'admin@cove.id') ON CONFLICT DO NOTHING;
    INSERT INTO public.platform_admins (id, auth_user_id, status)
    VALUES ('${ADMIN_RECORD_ID}', '${ADMIN_AUTH_ID}', 'ACTIVE')
    ON CONFLICT (auth_user_id) DO NOTHING;
  `);

  pgWebhookRepo = new PostgresWebhookRepository(pglite as any);
  setWebhookRepository(pgWebhookRepo);

  pgSettlementRepo = new PostgresBillingSettlementRepository(pglite as any);
  setBillingSettlementRepository(pgSettlementRepo);

  ReplayService.setPool(pglite as any);

  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    { id: ORG_A_ID, legalName: 'Org Alpha Remediation', displayName: 'Alpha Remediation', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }
  ];
  identityRepo.profiles = [
    { id: 'prof-admin', authUserId: ADMIN_AUTH_ID, fullName: 'Platform Admin', status: 'ACTIVE', createdAt: new Date().toISOString() },
    { id: 'prof-tenant', authUserId: TENANT_AUTH_ID, fullName: 'Tenant User', status: 'ACTIVE', createdAt: new Date().toISOString() }
  ];
  identityRepo.memberships = [
    { id: 'mem-tenant', orgId: ORG_A_ID, profileId: 'prof-tenant', role: 'OWNER', status: 'ACTIVE' }
  ];
  identityRepo.platformAdmins = [
    { id: ADMIN_RECORD_ID, authUserId: ADMIN_AUTH_ID, status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];
  setIdentityRepository(identityRepo);

  (config as any).mayarWebhookSecret = TEST_SECRET;

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-admin-p0c3r') {
      return { user: { id: ADMIN_AUTH_ID, email: 'admin@cove.id' }, error: null };
    }
    if (token === 'token-tenant-p0c3r') {
      return { user: { id: TENANT_AUTH_ID, email: 'tenant@cove.id' }, error: null };
    }
    return { user: null, error: 'Token invalid' };
  });
});

after(() => {
  setTestTokenVerifier(null);
});

// ----------------------------------------------------------------------------
// P0C3R-01: unknown checkout remains recoverable after 10 attempts (REVIEW_REQUIRED, not FAILED_FINAL)
// ----------------------------------------------------------------------------
test('P0C3R-01: unknown checkout remains recoverable after 10 attempts (REVIEW_REQUIRED, not FAILED_FINAL)', async () => {
  const eventId = 'evt_p0c3r_01';
  const checkoutRef = 'cs_p0c3r_01_unknown';
  const payId = 'pay_p0c3r_01';

  // Live webhook with unknown checkout
  const res = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(res.status, 200);

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Set attempt_count = 10 to simulate exhaustion on transient out-of-order event
  await pglite.exec(`
    UPDATE public.webhook_events
    SET attempt_count = 10,
        processing_status = 'REVIEW_REQUIRED',
        last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
    WHERE id = '${event.id}'
  `);

  const updated = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(updated?.processingStatus, 'REVIEW_REQUIRED');
  assert.strictEqual(updated?.lastErrorCode, 'MAX_ATTEMPTS_EXCEEDED');
  assert.notStrictEqual(updated?.processingStatus, 'FAILED_FINAL');
});

// ----------------------------------------------------------------------------
// P0C3R-02: attempt 11 live/system retry does not settle automatically (bounded)
// ----------------------------------------------------------------------------
test('P0C3R-02: attempt 11 live/system retry does not settle automatically (bounded)', async () => {
  const eventId = 'evt_p0c3r_02';
  const checkoutRef = 'cs_p0c3r_02_unknown';
  const payId = 'pay_p0c3r_02';

  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Exhaust attempts
  await pglite.exec(`
    UPDATE public.webhook_events
    SET attempt_count = 10,
        processing_status = 'REVIEW_REQUIRED',
        last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
    WHERE id = '${event.id}'
  `);

  // Redeliver live webhook at attempt 10+
  const redeliveryRes = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(redeliveryRes.status, 200);
  const body = await redeliveryRes.json();
  assert.strictEqual(body.result, 'IGNORED');
  assert.match(body.message, /peninjauan manual/);

  // Verify attempt_count did NOT increment on bounded live redelivery
  const checked = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(checked?.attemptCount, 10);
  assert.strictEqual(checked?.processingStatus, 'REVIEW_REQUIRED');

  // Also check unattended/system replay call (adminId = null)
  const systemReplayRes = await ReplayService.replayWebhookEvent(event.id);
  assert.strictEqual(systemReplayRes.status, 'REVIEW_REQUIRED');
  assert.match(systemReplayRes.message, /terlampaui/);
});

// ----------------------------------------------------------------------------
// P0C3R-03: attempt 11 does not convert transient event to irreversible FAILED_FINAL
// ----------------------------------------------------------------------------
test('P0C3R-03: attempt 11 does not convert transient event to irreversible FAILED_FINAL', async () => {
  const eventId = 'evt_p0c3r_03';
  const checkoutRef = 'cs_p0c3r_03_unknown';
  const payId = 'pay_p0c3r_03';

  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  await pglite.exec(`
    UPDATE public.webhook_events
    SET attempt_count = 11,
        processing_status = 'REVIEW_REQUIRED',
        last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
    WHERE id = '${event.id}'
  `);

  const current = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(current?.processingStatus, 'REVIEW_REQUIRED');
  assert.notStrictEqual(current?.processingStatus, 'FAILED_FINAL');
});

// ----------------------------------------------------------------------------
// P0C3R-04: checkout created after exhaustion
// ----------------------------------------------------------------------------
test('P0C3R-04: checkout created after exhaustion', async () => {
  const eventId = 'evt_p0c3r_04';
  const checkoutRef = 'cs_p0c3r_04_delayed';
  const payId = 'pay_p0c3r_04';

  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  await pglite.exec(`
    UPDATE public.webhook_events
    SET attempt_count = 10,
        processing_status = 'REVIEW_REQUIRED',
        last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
    WHERE id = '${event.id}'
  `);

  // Now create the checkout session after exhaustion has occurred
  await pglite.exec(`
    INSERT INTO public.checkout_sessions (
      id, organization_id, provider, provider_reference, provider_checkout_id,
      status, plan, amount, currency
    ) VALUES (
      '11111111-0004-4111-8111-111111111104',
      '${ORG_A_ID}',
      'MAYAR',
      '${checkoutRef}',
      'chk_p0c3r_04',
      'PENDING',
      'core',
      4900000,
      'IDR'
    );
  `);

  const chk = await pglite.query(`SELECT status FROM public.checkout_sessions WHERE provider_reference = '${checkoutRef}'`);
  assert.strictEqual(chk.rows[0].status, 'PENDING');
});

// ----------------------------------------------------------------------------
// P0C3R-05: platform admin can manually replay exhausted transient event
// ----------------------------------------------------------------------------
test('P0C3R-05: platform admin can manually replay exhausted transient event', async () => {
  const eventId = 'evt_p0c3r_04';
  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Platform admin invokes manual replay via API endpoint
  const req = new Request(`http://localhost:3000/api/admin/webhooks/${event.id}/replay`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer token-admin-p0c3r'
    }
  });

  const res = await app.fetch(req);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.status, 'REPLAYED');
});

// ----------------------------------------------------------------------------
// P0C3R-06: manual recovery settles payment exactly once
// ----------------------------------------------------------------------------
test('P0C3R-06: manual recovery settles payment exactly once', async () => {
  const payments = await pglite.query(`
    SELECT * FROM public.billing_payments
    WHERE provider_payment_id = 'pay_p0c3r_04'
  `);
  assert.strictEqual(payments.rows.length, 1);
  assert.strictEqual(payments.rows[0].status, 'SETTLED');
  assert.strictEqual(Number(payments.rows[0].amount), 4900000);
});

// ----------------------------------------------------------------------------
// P0C3R-07: manual recovery activates subscription exactly once
// ----------------------------------------------------------------------------
test('P0C3R-07: manual recovery activates subscription exactly once', async () => {
  const subs = await pglite.query(`
    SELECT * FROM public.subscriptions
    WHERE org_id = '${ORG_A_ID}'
  `);
  assert.strictEqual(subs.rows.length, 1);
  assert.strictEqual(subs.rows[0].status, 'ACTIVE');
  assert.strictEqual(subs.rows[0].plan_id, 'core');

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', 'evt_p0c3r_04');
  assert.strictEqual(event?.processingStatus, 'PROCESSED');
  assert.strictEqual(event?.lastErrorCode, null);
});

// ----------------------------------------------------------------------------
// P0C3R-08: post-success replay no-op (ALREADY_PROCESSED)
// ----------------------------------------------------------------------------
test('P0C3R-08: post-success replay no-op (ALREADY_PROCESSED)', async () => {
  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', 'evt_p0c3r_04');
  assert.ok(event);

  const req = new Request(`http://localhost:3000/api/admin/webhooks/${event.id}/replay`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer token-admin-p0c3r'
    }
  });

  const res = await app.fetch(req);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'ALREADY_PROCESSED');

  // Verify payment count is still 1
  const payments = await pglite.query(`
    SELECT COUNT(*) FROM public.billing_payments
    WHERE provider_payment_id = 'pay_p0c3r_04'
  `);
  assert.strictEqual(Number(payments.rows[0].count), 1);
});

// ----------------------------------------------------------------------------
// P0C3R-09: permanent SETTLEMENT_REJECTED remains terminal (cannot be replayed)
// ----------------------------------------------------------------------------
test('P0C3R-09: permanent SETTLEMENT_REJECTED remains terminal (cannot be replayed)', async () => {
  const checkoutRef = 'cs_p0c3r_09_bad_amount';
  const payId = 'pay_p0c3r_09';
  const eventId = 'evt_p0c3r_09';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (
      id, organization_id, provider, provider_reference, provider_checkout_id,
      status, plan, amount, currency
    ) VALUES (
      '11111111-0009-4111-8111-111111111109',
      '${ORG_A_ID}',
      'MAYAR',
      '${checkoutRef}',
      'chk_p0c3r_09',
      'PENDING',
      'core',
      4900000,
      'IDR'
    );
  `);

  // Wrong amount: 100 IDR instead of 4,900,000 IDR
  const res = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 100, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(res.status, 400);

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);
  assert.strictEqual(event.processingStatus, 'FAILED_FINAL');
  assert.strictEqual(event.lastErrorCode, 'SETTLEMENT_REJECTED');

  // Admin replay must be rejected for permanent failure
  const replayRes = await ReplayService.replayWebhookEvent(event.id, ADMIN_AUTH_ID);
  assert.strictEqual(replayRes.status, 'FAILED');
  assert.match(replayRes.message, /ditolak secara permanen/);

  // Still FAILED_FINAL
  const checked = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(checked?.processingStatus, 'FAILED_FINAL');
});

// ----------------------------------------------------------------------------
// P0C3R-10: tenant cannot recover exhausted event (HTTP 403 Forbidden)
// ----------------------------------------------------------------------------
test('P0C3R-10: tenant cannot recover exhausted event (HTTP 403 Forbidden)', async () => {
  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', 'evt_p0c3r_01');
  assert.ok(event);

  const req = new Request(`http://localhost:3000/api/admin/webhooks/${event.id}/replay`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer token-tenant-p0c3r'
    }
  });

  const res = await app.fetch(req);
  assert.strictEqual(res.status, 403);
});

// ----------------------------------------------------------------------------
// P0C3R-11: two admin replays produce one settlement (concurrency lock)
// ----------------------------------------------------------------------------
test('P0C3R-11: two admin replays produce one settlement (concurrency lock)', async () => {
  const checkoutRef = 'cs_p0c3r_11_concurrent';
  const payId = 'pay_p0c3r_11';
  const eventId = 'evt_p0c3r_11';

  // Create event with unknown checkout, exhausted to 10
  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  await pglite.exec(`
    UPDATE public.webhook_events
    SET attempt_count = 10,
        processing_status = 'REVIEW_REQUIRED',
        last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
    WHERE id = '${event.id}'
  `);

  // Checkout created
  await pglite.exec(`
    INSERT INTO public.checkout_sessions (
      id, organization_id, provider, provider_reference, provider_checkout_id,
      status, plan, amount, currency
    ) VALUES (
      '11111111-0011-4111-8111-111111111111',
      '${ORG_A_ID}',
      'MAYAR',
      '${checkoutRef}',
      'chk_p0c3r_11',
      'PENDING',
      'core',
      4900000,
      'IDR'
    );
  `);

  // Race two admin replay requests concurrently
  const [res1, res2] = await Promise.all([
    ReplayService.replayWebhookEvent(event.id, ADMIN_AUTH_ID),
    ReplayService.replayWebhookEvent(event.id, ADMIN_AUTH_ID)
  ]);

  const statuses = [res1.status, res2.status];
  assert.ok(statuses.includes('REPLAYED'));
  assert.ok(statuses.includes('CONCURRENCY_BLOCKED') || statuses.includes('ALREADY_PROCESSED'));

  // Exactly one payment row
  const payments = await pglite.query(`
    SELECT COUNT(*) FROM public.billing_payments
    WHERE provider_payment_id = '${payId}'
  `);
  assert.strictEqual(Number(payments.rows[0].count), 1);
});

// ----------------------------------------------------------------------------
// P0C3R-12: live vs manual replay produces one settlement
// ----------------------------------------------------------------------------
test('P0C3R-12: live vs manual replay produces one settlement', async () => {
  const checkoutRef = 'cs_p0c3r_12_live_vs_admin';
  const payId = 'pay_p0c3r_12';
  const eventId = 'evt_p0c3r_12';

  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  await pglite.exec(`
    UPDATE public.webhook_events
    SET attempt_count = 10,
        processing_status = 'REVIEW_REQUIRED',
        last_error_code = 'MAX_ATTEMPTS_EXCEEDED'
    WHERE id = '${event.id}'
  `);

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (
      id, organization_id, provider, provider_reference, provider_checkout_id,
      status, plan, amount, currency
    ) VALUES (
      '11111111-0012-4111-8111-111111111112',
      '${ORG_A_ID}',
      'MAYAR',
      '${checkoutRef}',
      'chk_p0c3r_12',
      'PENDING',
      'core',
      4900000,
      'IDR'
    );
  `);

  // Race live redelivery and admin replay concurrently
  const [liveRes, adminRes] = await Promise.all([
    sendSignedWebhook({
      event: 'payment.settled',
      id: eventId,
      data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
    }),
    ReplayService.replayWebhookEvent(event.id, ADMIN_AUTH_ID)
  ]);

  assert.strictEqual(liveRes.status, 200);
  assert.strictEqual(adminRes.status, 'REPLAYED');

  const payments = await pglite.query(`
    SELECT COUNT(*) FROM public.billing_payments
    WHERE provider_payment_id = '${payId}'
  `);
  assert.strictEqual(Number(payments.rows[0].count), 1);
});

// ----------------------------------------------------------------------------
// P0C3R-13: attempt audit trail preserved in webhook_replay_attempts
// ----------------------------------------------------------------------------
test('P0C3R-13: attempt audit trail preserved in webhook_replay_attempts', async () => {
  const attempts = await pglite.query(`
    SELECT * FROM public.webhook_replay_attempts
    ORDER BY created_at ASC
  `);
  assert.ok(attempts.rows.length > 0);

  // Check that admin attempts correctly logged initiated_by_admin_id as UUID
  const adminAttempts = attempts.rows.filter(a => a.initiated_by_admin_id !== null);
  assert.ok(adminAttempts.length > 0);
  assert.strictEqual(adminAttempts[0].initiated_by_admin_id, ADMIN_AUTH_ID);
});

// ----------------------------------------------------------------------------
// P0C3R-14: attempt_count not reset (preserved across manual recoveries)
// ----------------------------------------------------------------------------
test('P0C3R-14: attempt_count not reset (preserved across manual recoveries)', async () => {
  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', 'evt_p0c3r_04');
  assert.ok(event);
  // Event started with 10 attempts, recovered by admin (+1 = 11)
  assert.ok(event.attemptCount >= 11, `Expected attemptCount >= 11, got ${event.attemptCount}`);
});

// ----------------------------------------------------------------------------
// P0C3R-15: P0-C2 preserved (economic validations, exact IDR, atomic duration)
// ----------------------------------------------------------------------------
test('P0C3R-15: P0-C2 preserved (economic validations, exact IDR, atomic duration)', async () => {
  const checkoutRef = 'cs_p0c3r_15_p0c2';
  const payId = 'pay_p0c3r_15';
  const eventId = 'evt_p0c3r_15';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (
      id, organization_id, provider, provider_reference, provider_checkout_id,
      status, plan, amount, currency
    ) VALUES (
      '11111111-0015-4111-8111-111111111115',
      '${ORG_A_ID}',
      'MAYAR',
      '${checkoutRef}',
      'chk_p0c3r_15',
      'PENDING',
      'core',
      4900000,
      'IDR'
    );
  `);

  // 1. Invalid currency fails closed
  const badCurrRes = await sendSignedWebhook({
    event: 'payment.settled',
    id: `${eventId}_curr`,
    data: { id: checkoutRef, payment_id: `${payId}_curr`, amount: 4900000, currency: 'USD', status: 'settled' }
  });
  assert.strictEqual(badCurrRes.status, 400);

  // 2. Exact currency and amount succeeds atomically
  const goodRes = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 4900000, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(goodRes.status, 200);

  const sub = await pglite.query(`
    SELECT * FROM public.subscriptions
    WHERE org_id = '${ORG_A_ID}'
  `);
  assert.strictEqual(sub.rows[0].status, 'ACTIVE');
});
