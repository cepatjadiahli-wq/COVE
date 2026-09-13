// ============================================================================
// COVE Backend — P0-C3 Replay, Reconciliation & Out-of-Order Recovery Tests
// Tests P0C3-01 through P0C3-25
// ============================================================================

process.env.NODE_ENV = 'test';

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import app from '../src/index.js';
import { db } from '../src/db/store.js';
import { config } from '../src/config.js';
import { MayarService } from '../src/services/mayar.service.js';
import { ReplayService } from '../src/services/replay.service.js';
import { ReconciliationService } from '../src/services/reconciliation.service.js';
import { setTestTokenVerifier } from '../src/lib/supabase.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import {
  PostgresWebhookRepository,
  setWebhookRepository,
  getWebhookRepository
} from '../src/repositories/webhook.repository.js';
import {
  PostgresBillingSettlementRepository,
  setBillingSettlementRepository,
  getBillingSettlementRepository
} from '../src/repositories/billing_settlement.repository.js';
import { CANONICAL_MIGRATION_ORDER } from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgSettlementRepo: PostgresBillingSettlementRepository;
let pgWebhookRepo: PostgresWebhookRepository;
let identityRepo: InMemoryIdentityRepository;

const TEST_SECRET = 'myr_whsec_p0c3_replay_secret_789';
const ORG_A_ID = '33333333-aaaa-4333-8aaa-333333333333';
const ORG_B_ID = '44444444-bbbb-4444-8bbb-444444444444';
const ADMIN_AUTH_ID = '99999999-9999-4999-8999-999999999999';
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
    ('pilot', 'Paid Pilot', 7500000.00, '45_DAYS', 1, 3, 'ACTIVE'),
    ('core', 'Core', 4900000.00, 'MONTHLY', 3, 5, 'ACTIVE'),
    ('pro', 'Pro', 990000.00, 'MONTHLY', 5, 10, 'ACTIVE'),
    ('scale', 'Scale', 9900000.00, 'MONTHLY', 10, 15, 'ACTIVE'),
    ('enterprise', 'Enterprise', 25000000.00, 'YEARLY', 999, 999, 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed organizations
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name)
    VALUES ('${ORG_A_ID}', 'Org Alpha P0C3', 'Alpha P0C3'), ('${ORG_B_ID}', 'Org Beta P0C3', 'Beta P0C3')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed platform admin user in auth.users first
  await pglite.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN_AUTH_ID}', 'admin@cove.id') ON CONFLICT DO NOTHING;
    INSERT INTO public.platform_admins (id, auth_user_id, status)
    VALUES ('aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', '${ADMIN_AUTH_ID}', 'ACTIVE')
    ON CONFLICT (auth_user_id) DO NOTHING;
  `);

  // Repositories
  pgWebhookRepo = new PostgresWebhookRepository(pglite as any);
  setWebhookRepository(pgWebhookRepo);

  pgSettlementRepo = new PostgresBillingSettlementRepository(pglite as any);
  setBillingSettlementRepository(pgSettlementRepo);

  ReplayService.setPool(pglite as any);
  ReconciliationService.setPool(pglite as any);

  // Identity setup
  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    { id: ORG_A_ID, legalName: 'Org Alpha P0C3', displayName: 'Alpha', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' },
    { id: ORG_B_ID, legalName: 'Org Beta P0C3', displayName: 'Beta', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }
  ];
  identityRepo.profiles = [
    { id: 'prof-admin', authUserId: ADMIN_AUTH_ID, fullName: 'Platform Admin', status: 'ACTIVE', createdAt: new Date().toISOString() },
    { id: 'prof-tenant', authUserId: TENANT_AUTH_ID, fullName: 'Tenant User', status: 'ACTIVE', createdAt: new Date().toISOString() }
  ];
  identityRepo.memberships = [
    { id: 'mem-tenant', orgId: ORG_A_ID, profileId: 'prof-tenant', role: 'OWNER', status: 'ACTIVE' }
  ];
  identityRepo.platformAdmins = [
    { id: 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', authUserId: ADMIN_AUTH_ID, status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];
  identityRepo.platformRoleGrants = [
    { id: 'grant-p0c3', adminId: 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', roleScope: 'SUPER_ADMIN', grantedAt: new Date().toISOString() }
  ];
  setIdentityRepository(identityRepo);

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-admin-p0c3') {
      return { user: { id: ADMIN_AUTH_ID, email: 'admin@cove.id' }, error: null };
    }
    if (token === 'token-tenant-p0c3') {
      return { user: { id: TENANT_AUTH_ID, email: 'tenant@cove.id' }, error: null };
    }
    return { user: null, error: 'Token invalid' };
  });

  config.mayarWebhookSecret = TEST_SECRET;
});

after(() => {
  setTestTokenVerifier(null);
});

// ----------------------------------------------------------------------------
// P0C3-01: Replay already-PROCESSED event returns ALREADY_PROCESSED with no-op
// ----------------------------------------------------------------------------
test('P0C3-01: Replay already-PROCESSED event returns ALREADY_PROCESSED with no-op', async () => {
  const checkoutRef = 'cs_p0c3_01';
  const payId = 'pay_p0c3_01';
  const eventId = 'evt_p0c3_01';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0001-4111-8111-111111111101', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_01', 'PENDING', 'core', 499000, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  // First process live webhook
  const resLive = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(resLive.status, 200);

  const eventRow = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(eventRow);
  assert.strictEqual(eventRow.processingStatus, 'PROCESSED');

  // Replay
  const replayRes = await ReplayService.replayWebhookEvent(eventRow.id, 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(replayRes.status, 'ALREADY_PROCESSED');

  // Assert no second payment
  const payments = await pglite.query(`SELECT COUNT(*) as cnt FROM public.billing_payments WHERE provider_payment_id = $1`, [payId]);
  assert.strictEqual(Number((payments.rows[0] as any).cnt), 1);
});

// ----------------------------------------------------------------------------
// P0C3-02: Replay RETRYABLE/REVIEW_REQUIRED event converges when checkout becomes available
// ----------------------------------------------------------------------------
test('P0C3-02: Replay RETRYABLE/REVIEW_REQUIRED event converges when checkout becomes available', async () => {
  const checkoutRef = 'cs_p0c3_02_late';
  const payId = 'pay_p0c3_02';
  const eventId = 'evt_p0c3_02';

  // Event arrives BEFORE checkout session exists
  const resOutOrder = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(resOutOrder.status, 200);

  const eventRow = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(eventRow);
  assert.strictEqual(eventRow.processingStatus, 'REVIEW_REQUIRED');

  // Checkout session is created subsequently
  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0002-4111-8111-111111111102', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_02', 'PENDING', 'core', 499000, 'IDR');
  `);

  // Replay
  const replayRes = await ReplayService.replayWebhookEvent(eventRow.id, 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(replayRes.status, 'REPLAYED');

  // Payment is now SETTLED and checkout is PAID
  const cs = await pglite.query(`SELECT status FROM public.checkout_sessions WHERE provider_reference = $1`, [checkoutRef]);
  assert.strictEqual(cs.rows[0].status, 'PAID');

  const pay = await pglite.query(`SELECT status FROM public.billing_payments WHERE provider_payment_id = $1`, [payId]);
  assert.strictEqual(pay.rows[0].status, 'SETTLED');

  const updatedEvent = await pgWebhookRepo.findWebhookEventById(eventRow.id);
  assert.strictEqual(updatedEvent?.processingStatus, 'PROCESSED');
});

// ----------------------------------------------------------------------------
// P0C3-03: Out-of-order event is retained durably in webhook_events (not discarded)
// ----------------------------------------------------------------------------
test('P0C3-03: Out-of-order event is retained durably in webhook_events (not discarded)', async () => {
  const eventId = 'evt_p0c3_03_retained';
  const res = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: 'cs_nonexistent_03', payment_id: 'pay_03', amount: 499000, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(res.status, 200);

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);
  assert.strictEqual(event.processingStatus, 'REVIEW_REQUIRED');
  assert.strictEqual(event.lastErrorCode, 'UNKNOWN_CHECKOUT_REF');
});

// ----------------------------------------------------------------------------
// P0C3-04: Unknown checkout must NOT create a tenant organization
// ----------------------------------------------------------------------------
test('P0C3-04: Unknown checkout must NOT create a tenant organization', async () => {
  const orgCountBefore = await pglite.query(`SELECT COUNT(*) as cnt FROM public.organizations`);

  await sendSignedWebhook({
    event: 'payment.settled',
    id: 'evt_p0c3_04_no_tenant',
    data: { id: 'cs_no_such_checkout_04', payment_id: 'pay_04', amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const orgCountAfter = await pglite.query(`SELECT COUNT(*) as cnt FROM public.organizations`);
  assert.strictEqual(orgCountBefore.rows[0].cnt, orgCountAfter.rows[0].cnt);
});

// ----------------------------------------------------------------------------
// P0C3-05: Replay PROCESSED event never invokes settlePayment side effects twice
// ----------------------------------------------------------------------------
test('P0C3-05: Replay PROCESSED event never invokes settlePayment side effects twice', async () => {
  const checkoutRef = 'cs_p0c3_05';
  const payId = 'pay_p0c3_05';
  const eventId = 'evt_p0c3_05';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0005-4111-8111-111111111105', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_05', 'PENDING', 'core', 499000, 'IDR');
  `);

  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Replay multiple times
  await ReplayService.replayWebhookEvent(event.id);
  await ReplayService.replayWebhookEvent(event.id);

  const payments = await pglite.query(`SELECT COUNT(*) as cnt FROM public.billing_payments WHERE provider_payment_id = $1`, [payId]);
  assert.strictEqual(Number(payments.rows[0].cnt), 1);
});

// ----------------------------------------------------------------------------
// P0C3-06: Consistency checker detects CHECKOUT PAID + PAYMENT EXISTS + SUBSCRIPTION MISSING
// ----------------------------------------------------------------------------
test('P0C3-06: Consistency checker detects CHECKOUT PAID + PAYMENT EXISTS + SUBSCRIPTION MISSING', async () => {
  const orphanOrgId = '55555555-5555-4555-8555-555555555555';
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orphanOrgId}', 'Orphan Org', 'Orphan') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0006-4111-8111-111111111106', '${orphanOrgId}', 'MAYAR', 'cs_06', 'chk_06', 'PAID', 'core', 499000, 'IDR')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.billing_payments (organization_id, checkout_session_id, provider, provider_payment_id, amount, currency, status)
    VALUES ('${orphanOrgId}', '11111111-0006-4111-8111-111111111106', 'MAYAR', 'pay_06_orphan', 499000, 'IDR', 'SETTLED')
    ON CONFLICT DO NOTHING;
  `);

  const report = await ReconciliationService.checkConsistency(orphanOrgId);
  assert.strictEqual(report.isConsistent, false);
  assert.ok(report.issues.includes('SETTLED_PAYMENT_WITHOUT_ACTIVE_SUBSCRIPTION'));
});

// ----------------------------------------------------------------------------
// P0C3-07: Consistency checker detects PAYMENT EXISTS + CHECKOUT PENDING
// ----------------------------------------------------------------------------
test('P0C3-07: Consistency checker detects PAYMENT EXISTS + CHECKOUT PENDING', async () => {
  const pendingOrgId = '66666666-6666-4666-8666-666666666666';
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${pendingOrgId}', 'Pending CS Org', 'Pending') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0007-4111-8111-111111111107', '${pendingOrgId}', 'MAYAR', 'cs_07', 'chk_07', 'PENDING', 'core', 499000, 'IDR')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.billing_payments (organization_id, checkout_session_id, provider, provider_payment_id, amount, currency, status)
    VALUES ('${pendingOrgId}', '11111111-0007-4111-8111-111111111107', 'MAYAR', 'pay_07_pending', 499000, 'IDR', 'SETTLED')
    ON CONFLICT DO NOTHING;
  `);

  const report = await ReconciliationService.checkConsistency(pendingOrgId);
  assert.strictEqual(report.isConsistent, false);
  assert.ok(report.issues.includes('PAYMENT_EXISTS_WITH_PENDING_CHECKOUT'));
});

// ----------------------------------------------------------------------------
// P0C3-08: OVERPAYMENT_REVIEW reconciliation list query returns records
// ----------------------------------------------------------------------------
test('P0C3-08: OVERPAYMENT_REVIEW reconciliation list query returns records', async () => {
  const opOrgId = '77777777-7777-4777-8777-777777777777';
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${opOrgId}', 'OP Org', 'OP') ON CONFLICT DO NOTHING;
    INSERT INTO public.billing_payments (organization_id, provider, provider_payment_id, amount, currency, status)
    VALUES ('${opOrgId}', 'MAYAR', 'pay_08_overpayment', 499000, 'IDR', 'OVERPAYMENT_REVIEW')
    ON CONFLICT DO NOTHING;
  `);

  const overpayments = await ReconciliationService.listOverpaymentReviews(50);
  const found = overpayments.find(p => p.providerPaymentId === 'pay_08_overpayment');
  assert.ok(found);
  assert.strictEqual(found.status, 'OVERPAYMENT_REVIEW');
});

// ----------------------------------------------------------------------------
// P0C3-09: PAYMENT_CONFLICT reconciliation query returns anomalies
// ----------------------------------------------------------------------------
test('P0C3-09: PAYMENT_CONFLICT reconciliation query returns anomalies without auto-refund', async () => {
  await pglite.exec(`
    INSERT INTO public.billing_payment_anomalies (
      provider, provider_payment_id, conflict_type, incoming_amount, incoming_currency, incoming_checkout_reference
    ) VALUES (
      'MAYAR', 'pay_09_conflict', 'AMOUNT_MISMATCH', 999000, 'IDR', 'cs_09'
    ) ON CONFLICT DO NOTHING;
  `);

  const conflicts = await ReconciliationService.listPaymentConflicts(50);
  const found = conflicts.find(c => c.providerPaymentId === 'pay_09_conflict');
  assert.ok(found);
  assert.strictEqual(found.conflictType, 'AMOUNT_MISMATCH');
});

// ----------------------------------------------------------------------------
// P0C3-10: Reconciliation item OPEN -> RESOLVED with audit trail
// ----------------------------------------------------------------------------
test('P0C3-10: Reconciliation item OPEN -> RESOLVED with audit trail', async () => {
  const itemId = await ReconciliationService.createReconciliationItem({
    itemType: 'UNRESOLVED_WEBHOOK',
    organizationId: ORG_A_ID,
    details: { reason: 'Test reconciliation item' }
  });
  assert.ok(itemId);

  const resolved = await ReconciliationService.resolveItem(
    itemId,
    'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
    'RESOLVED',
    'Verifikasi manual: pembayaran telah dikonfirmasi valid oleh bank.'
  );
  assert.strictEqual(resolved, true);

  const items = await ReconciliationService.listReconciliationItems('RESOLVED');
  const found = items.find(i => i.id === itemId);
  assert.ok(found);
  assert.strictEqual(found.status, 'RESOLVED');
  assert.strictEqual(found.resolutionReason, 'Verifikasi manual: pembayaran telah dikonfirmasi valid oleh bank.');
  assert.ok(found.resolvedAt);
});

// ----------------------------------------------------------------------------
// P0C3-11: Reconciliation item OPEN -> IGNORED_WITH_REASON preserves reason
// ----------------------------------------------------------------------------
test('P0C3-11: Reconciliation item OPEN -> IGNORED_WITH_REASON preserves reason', async () => {
  const itemId = await ReconciliationService.createReconciliationItem({
    itemType: 'OVERPAYMENT_REVIEW',
    organizationId: ORG_A_ID,
    details: { note: 'Duplicate sandbox payload' }
  });

  const ignored = await ReconciliationService.resolveItem(
    itemId,
    'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
    'IGNORED_WITH_REASON',
    'Dikonfirmasi testing sandbox developer.'
  );
  assert.strictEqual(ignored, true);

  const items = await ReconciliationService.listReconciliationItems('IGNORED_WITH_REASON');
  const found = items.find(i => i.id === itemId);
  assert.ok(found);
  assert.strictEqual(found.status, 'IGNORED_WITH_REASON');
  assert.strictEqual(found.resolutionReason, 'Dikonfirmasi testing sandbox developer.');
});

// ----------------------------------------------------------------------------
// P0C3-12: Audit trail records every replay attempt in webhook_replay_attempts
// ----------------------------------------------------------------------------
test('P0C3-12: Audit trail records every replay attempt in webhook_replay_attempts', async () => {
  const checkoutRef = 'cs_p0c3_12';
  const payId = 'pay_p0c3_12';
  const eventId = 'evt_p0c3_12';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0012-4111-8111-111111111112', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_12', 'PENDING', 'core', 499000, 'IDR');
  `);

  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  const replayRes = await ReplayService.replayWebhookEvent(event.id, 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa');
  assert.ok(replayRes.attemptId);

  const attemptRows = await pglite.query(
    `SELECT * FROM public.webhook_replay_attempts WHERE id = $1`,
    [replayRes.attemptId]
  );
  assert.strictEqual(attemptRows.rows.length, 1);
  assert.strictEqual(attemptRows.rows[0].result_status, 'ALREADY_PROCESSED');
});

// ----------------------------------------------------------------------------
// P0C3-13: attempt_count increments in SQL (attempt_count = attempt_count + 1)
// ----------------------------------------------------------------------------
test('P0C3-13: attempt_count increments via atomic SQL update', async () => {
  const eventId = 'evt_p0c3_13_count';
  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: 'cs_unknown_13', payment_id: 'pay_13', amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);
  const initialCount = event.attemptCount;

  // Claim lease directly via repository
  await pgWebhookRepo.claimProcessingLease(event.id);

  const afterClaim = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(afterClaim?.attemptCount, initialCount + 1);
});

// ----------------------------------------------------------------------------
// P0C3-14: Bounded replay policy: max_attempts exceeded retains REVIEW_REQUIRED (recoverable)
// Semantic correction per P0-C3.1 (F-C3.1): transient retry exhaustion must NOT
// transition to irreversible FAILED_FINAL. It must retain REVIEW_REQUIRED with
// MAX_ATTEMPTS_EXCEEDED so that operators can recover genuine payments.
// ----------------------------------------------------------------------------
test('P0C3-14: Bounded replay policy: max_attempts exceeded retains REVIEW_REQUIRED (recoverable)', async () => {
  const eventId = 'evt_p0c3_14_bounded';
  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: 'cs_unknown_14', payment_id: 'pay_14', amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Artificially set attempt_count = 10 in DB
  await pglite.exec(`UPDATE public.webhook_events SET attempt_count = 10 WHERE id = '${event.id}'`);

  // Unattended / system retry is bounded: stops without lease or FAILED_FINAL
  const res = await ReplayService.replayWebhookEvent(event.id);
  assert.strictEqual(res.status, 'REVIEW_REQUIRED');

  const updated = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(updated?.processingStatus, 'REVIEW_REQUIRED');
  assert.strictEqual(updated?.lastErrorCode, 'MAX_ATTEMPTS_EXCEEDED');
  assert.notStrictEqual(updated?.processingStatus, 'FAILED_FINAL');
});

// ----------------------------------------------------------------------------
// P0C3-15: Stale PROCESSING lease recovery via processing_started_at
// ----------------------------------------------------------------------------
test('P0C3-15: Stale PROCESSING lease recovery via processing_started_at', async () => {
  const eventId = 'evt_p0c3_15_stale';
  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: 'cs_unknown_15', payment_id: 'pay_15', amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Set status = PROCESSING with processing_started_at = 10 minutes ago
  await pglite.exec(`
    UPDATE public.webhook_events
    SET processing_status = 'PROCESSING',
        processing_started_at = NOW() - INTERVAL '10 minutes'
    WHERE id = '${event.id}'
  `);

  const recovered = await pgWebhookRepo.recoverStaleLeases(5 * 60 * 1000);
  assert.ok(recovered.includes(event.id));

  const afterRecovery = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(afterRecovery?.processingStatus, 'RETRYABLE');
  assert.strictEqual(afterRecovery?.lastErrorCode, 'STALE_LEASE');
});

// ----------------------------------------------------------------------------
// P0C3-16: Concurrent replay protection blocks double settlement
// ----------------------------------------------------------------------------
test('P0C3-16: Concurrent replay protection: simultaneous replays produce one settlement', async () => {
  const checkoutRef = 'cs_p0c3_16';
  const payId = 'pay_p0c3_16';
  const eventId = 'evt_p0c3_16';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0016-4111-8111-111111111116', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_16', 'PENDING', 'core', 499000, 'IDR');
  `);

  // Initial out-of-order delivery
  await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: 'cs_not_yet_available', payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Update payload to reference valid checkout session
  await pglite.exec(`
    UPDATE public.webhook_events
    SET payload = '{"event":"payment.settled","id":"${eventId}","data":{"id":"${checkoutRef}","payment_id":"${payId}","amount":499000,"currency":"IDR","status":"settled"}}'::jsonb
    WHERE id = '${event.id}'
  `);

  // Run two concurrent replays
  const [res1, res2] = await Promise.all([
    ReplayService.replayWebhookEvent(event.id, 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'),
    ReplayService.replayWebhookEvent(event.id, 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa')
  ]);

  const outcomes = [res1.status, res2.status];
  assert.ok(outcomes.includes('REPLAYED'));
  assert.ok(outcomes.includes('CONCURRENCY_BLOCKED') || outcomes.includes('ALREADY_PROCESSED'));

  const payments = await pglite.query(`SELECT COUNT(*) as cnt FROM public.billing_payments WHERE provider_payment_id = $1`, [payId]);
  assert.strictEqual(Number(payments.rows[0].cnt), 1);
});

// ----------------------------------------------------------------------------
// P0C3-17: Replay vs live-webhook race produces exactly one settlement
// ----------------------------------------------------------------------------
test('P0C3-17: Replay vs live-webhook race produces exactly one settlement', async () => {
  const checkoutRef = 'cs_p0c3_17';
  const payId = 'pay_p0c3_17';
  const eventId = 'evt_p0c3_17';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0017-4111-8111-111111111117', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_17', 'PENDING', 'core', 499000, 'IDR');
  `);

  // Seed an unresolved event in REVIEW_REQUIRED
  await pgWebhookRepo.recordWebhookEvent({
    eventId,
    eventType: 'payment.settled',
    provider: 'MAYAR',
    payload: { id: eventId, event: 'payment.settled', data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' } },
    processingStatus: 'REVIEW_REQUIRED'
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Concurrently run replay and live webhook
  await Promise.all([
    ReplayService.replayWebhookEvent(event.id),
    sendSignedWebhook({
      event: 'payment.settled',
      id: eventId,
      data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' }
    })
  ]);

  const payments = await pglite.query(`SELECT COUNT(*) as cnt FROM public.billing_payments WHERE provider_payment_id = $1`, [payId]);
  assert.strictEqual(Number(payments.rows[0].cnt), 1);
});

// ----------------------------------------------------------------------------
// P0C3-18: Distinct second payment during replay produces SETTLED + OVERPAYMENT_REVIEW
// ----------------------------------------------------------------------------
test('P0C3-18: Distinct second payment during replay produces SETTLED + OVERPAYMENT_REVIEW', async () => {
  const checkoutRef = 'cs_p0c3_18';
  const pay1Id = 'pay_p0c3_18_1';
  const pay2Id = 'pay_p0c3_18_2';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0018-4111-8111-111111111118', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_18', 'PENDING', 'core', 499000, 'IDR');
  `);

  // First payment settles normally
  await sendSignedWebhook({
    event: 'payment.settled',
    id: 'evt_p0c3_18_first',
    data: { id: checkoutRef, payment_id: pay1Id, amount: 499000, currency: 'IDR', status: 'settled' }
  });

  // Second distinct payment against same checkout session
  await sendSignedWebhook({
    event: 'payment.settled',
    id: 'evt_p0c3_18_second',
    data: { id: checkoutRef, payment_id: pay2Id, amount: 499000, currency: 'IDR', status: 'settled' }
  });

  const pay1 = await pglite.query(`SELECT status FROM public.billing_payments WHERE provider_payment_id = $1`, [pay1Id]);
  assert.strictEqual(pay1.rows[0].status, 'SETTLED');

  const pay2 = await pglite.query(`SELECT status FROM public.billing_payments WHERE provider_payment_id = $1`, [pay2Id]);
  assert.strictEqual(pay2.rows[0].status, 'OVERPAYMENT_REVIEW');
});

// ----------------------------------------------------------------------------
// P0C3-19: Crash during replay does not permanently poison event
// ----------------------------------------------------------------------------
test('P0C3-19: Crash during replay does not permanently poison event (stale lease recovery)', async () => {
  const checkoutRef = 'cs_p0c3_19';
  const payId = 'pay_p0c3_19';
  const eventId = 'evt_p0c3_19';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0019-4111-8111-111111111119', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_19', 'PENDING', 'core', 499000, 'IDR');
  `);

  await pgWebhookRepo.recordWebhookEvent({
    eventId,
    eventType: 'payment.settled',
    provider: 'MAYAR',
    payload: { id: eventId, event: 'payment.settled', data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' } },
    processingStatus: 'RETRYABLE'
  });

  const event = await pgWebhookRepo.findWebhookEvent('MAYAR', eventId);
  assert.ok(event);

  // Simulate worker crash by leaving status = PROCESSING with expired lease
  await pglite.exec(`
    UPDATE public.webhook_events
    SET processing_status = 'PROCESSING',
        processing_started_at = NOW() - INTERVAL '10 minutes'
    WHERE id = '${event.id}'
  `);

  // Next replay run detects stale lease and successfully settles
  const replayRes = await ReplayService.replayWebhookEvent(event.id);
  assert.strictEqual(replayRes.status, 'REPLAYED');

  const updated = await pgWebhookRepo.findWebhookEventById(event.id);
  assert.strictEqual(updated?.processingStatus, 'PROCESSED');
});

// ----------------------------------------------------------------------------
// P0C3-20: Replay is admin-only (non-admin receives HTTP 403 Forbidden)
// ----------------------------------------------------------------------------
test('P0C3-20: Replay is admin-only (non-admin receives HTTP 403 Forbidden)', async () => {
  const req = new Request('http://localhost:3000/api/admin/webhooks/any-id/replay', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer token-tenant-p0c3'
    }
  });

  const res = await app.fetch(req);
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.success, false);
});

// ----------------------------------------------------------------------------
// P0C3-21: No raw secret or sensitive payload exposure in reconciliation endpoints
// ----------------------------------------------------------------------------
test('P0C3-21: No raw secret or sensitive payload exposure in reconciliation endpoints', async () => {
  const req = new Request('http://localhost:3000/api/admin/reconciliation/unresolved', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer token-admin-p0c3'
    }
  });

  const res = await app.fetch(req);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  if (body.data.length > 0) {
    const item = body.data[0];
    assert.strictEqual(item.payload, undefined, 'Raw payload JSONB must be excluded from admin unresolved list');
  }
});

// ----------------------------------------------------------------------------
// P0C3-22: No history deletion: only status and resolution metadata mutated
// ----------------------------------------------------------------------------
test('P0C3-22: No history deletion: original events and attempts remain intact', async () => {
  const eventsCount = await pglite.query(`SELECT COUNT(*) as cnt FROM public.webhook_events`);
  const attemptsCount = await pglite.query(`SELECT COUNT(*) as cnt FROM public.webhook_replay_attempts`);

  assert.ok(Number(eventsCount.rows[0].cnt) > 0);
  assert.ok(Number(attemptsCount.rows[0].cnt) > 0);

  // Ensure attempting to DELETE from webhook_replay_attempts fails due to trigger
  await assert.rejects(
    async () => {
      await pglite.exec(`DELETE FROM public.webhook_replay_attempts`);
    },
    /append-only/i
  );
});

// ----------------------------------------------------------------------------
// P0C3-23: Fresh migration 001 -> 018 executes cleanly in sequence
// ----------------------------------------------------------------------------
test('P0C3-23: Fresh migration 001 -> 018 executes cleanly in sequence', async () => {
  const freshDb = new PGlite();
  await freshDb.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ BEGIN RETURN '00000000-0000-0000-0000-000000000001'::UUID; END; $$ LANGUAGE plpgsql;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE ROLE service_role;
  `);

  const migrationsDir = path.resolve(__dirname, '../migrations');
  for (const filename of CANONICAL_MIGRATION_ORDER) {
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
    await freshDb.exec(sql);
  }

  const tableCheck = await freshDb.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('webhook_replay_attempts', 'billing_reconciliation_items')`
  );
  assert.strictEqual(tableCheck.rows.length, 2);
});

// ----------------------------------------------------------------------------
// P0C3-24: Upgrade migration from 017 schema with pre-existing rows adds defaults cleanly
// ----------------------------------------------------------------------------
test('P0C3-24: Upgrade migration from 017 schema with pre-existing rows adds defaults cleanly', async () => {
  const upgradeDb = new PGlite();
  await upgradeDb.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ BEGIN RETURN '00000000-0000-0000-0000-000000000001'::UUID; END; $$ LANGUAGE plpgsql;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE ROLE service_role;
  `);

  const migrationsDir = path.resolve(__dirname, '../migrations');
  // Run 001 through 017
  for (const filename of CANONICAL_MIGRATION_ORDER) {
    if (filename === '018_p0c3_replay_reconciliation.sql') continue;
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
    await upgradeDb.exec(sql);
  }

  // Insert a webhook event in 017 schema
  await upgradeDb.exec(`
    INSERT INTO public.webhook_events (event_id, provider, event_type, payload, processed_at)
    VALUES ('evt_pre_018', 'MAYAR', 'payment.settled', '{"test":true}'::jsonb, NOW());
  `);

  // Now apply 018
  const sql018 = fs.readFileSync(path.join(migrationsDir, '018_p0c3_replay_reconciliation.sql'), 'utf-8');
  await upgradeDb.exec(sql018);

  const check = await upgradeDb.query(
    `SELECT processing_status, attempt_count FROM public.webhook_events WHERE event_id = 'evt_pre_018'`
  );
  assert.strictEqual(check.rows[0].processing_status, 'PROCESSED');
  assert.strictEqual(check.rows[0].attempt_count, 0);
});

// ----------------------------------------------------------------------------
// P0C3-25: Full P0-C2 atomic settlement invariants remain preserved
// ----------------------------------------------------------------------------
test('P0C3-25: Full P0-C2 atomic settlement invariants remain preserved', async () => {
  const checkoutRef = 'cs_p0c3_25';
  const payId = 'pay_p0c3_25';
  const eventId = 'evt_p0c3_25';

  await pglite.exec(`
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-0025-4111-8111-111111111125', '${ORG_A_ID}', 'MAYAR', '${checkoutRef}', 'chk_25', 'PENDING', 'core', 499000, 'IDR');
  `);

  const res = await sendSignedWebhook({
    event: 'payment.settled',
    id: eventId,
    data: { id: checkoutRef, payment_id: payId, amount: 499000, currency: 'IDR', status: 'settled' }
  });
  assert.strictEqual(res.status, 200);

  const sub = await pglite.query(`SELECT status, plan_id FROM public.subscriptions WHERE org_id = $1`, [ORG_A_ID]);
  assert.strictEqual(sub.rows[0].status, 'ACTIVE');
  assert.strictEqual(sub.rows[0].plan_id, 'core');
});
