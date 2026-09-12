// ============================================================================
// COVE Backend — P0-C2.1 Financial Integrity Remediation Tests
// Tests P0C2R-01 through P0C2R-19
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
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
import {
  PostgresWebhookRepository,
  setWebhookRepository
} from '../src/repositories/webhook.repository.js';
import {
  PostgresBillingSettlementRepository,
  setBillingSettlementRepository,
  calculatePeriodEnd
} from '../src/repositories/billing_settlement.repository.js';
import { CANONICAL_MIGRATION_ORDER } from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgSettlementRepo: PostgresBillingSettlementRepository;
let pgWebhookRepo: PostgresWebhookRepository;

const TEST_SECRET = 'myr_whsec_p0c2_remediation_secret_789';
const ORG_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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

  // Seed test plans
  await pglite.exec(`
    INSERT INTO public.plans (id, name, price_idr, billing_period, max_active_projects, max_users, status) VALUES
    ('pilot', 'Paid Pilot', 7500000.00, '45_DAYS', 1, 3, 'ACTIVE'),
    ('core', 'Core', 4900000.00, 'MONTHLY', 3, 5, 'ACTIVE'),
    ('pro', 'Pro', 990000.00, 'MONTHLY', 5, 10, 'ACTIVE'),
    ('scale', 'Scale', 9900000.00, 'MONTHLY', 10, 15, 'ACTIVE'),
    ('enterprise', 'Enterprise', 25000000.00, 'YEARLY', 999, 999, 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed test organizations
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name)
    VALUES ('${ORG_A_ID}', 'Org Alpha Remediation Legal', 'Org Alpha Remediation'),
           ('${ORG_B_ID}', 'Org Beta Remediation Legal', 'Org Beta Remediation')
    ON CONFLICT (id) DO NOTHING;
  `);

  pgWebhookRepo = new PostgresWebhookRepository(pglite as any);
  setWebhookRepository(pgWebhookRepo);

  pgSettlementRepo = new PostgresBillingSettlementRepository(pglite as any);
  setBillingSettlementRepository(pgSettlementRepo);

  config.mayarWebhookSecret = TEST_SECRET;
});

// ----------------------------------------------------------------------------
// P0C2R-01: calculatePeriodEnd 45_DAYS adds exactly 45 calendar days
// ----------------------------------------------------------------------------
test('P0C2R-01: calculatePeriodEnd 45_DAYS adds exactly 45 calendar days', () => {
  const base = new Date('2026-09-12T12:00:00Z');
  const end = calculatePeriodEnd(base, '45_DAYS');
  assert.strictEqual(end.getTime() - base.getTime(), 45 * 24 * 3600 * 1000);
});

// ----------------------------------------------------------------------------
// P0C2R-02: calculatePeriodEnd MONTHLY preserves day-of-month across months
// ----------------------------------------------------------------------------
test('P0C2R-02: calculatePeriodEnd MONTHLY preserves day-of-month across regular months', () => {
  const base = new Date('2026-05-15T00:00:00Z');
  const end = calculatePeriodEnd(base, 'MONTHLY');
  assert.strictEqual(end.getUTCFullYear(), 2026);
  assert.strictEqual(end.getUTCMonth(), 5); // June
  assert.strictEqual(end.getUTCDate(), 15);
});

// ----------------------------------------------------------------------------
// P0C2R-03: calculatePeriodEnd MONTHLY clamps Jan 31 -> Feb 28 in non-leap year
// ----------------------------------------------------------------------------
test('P0C2R-03: calculatePeriodEnd MONTHLY clamps Jan 31 to Feb 28 in non-leap year', () => {
  const base = new Date('2026-01-31T00:00:00Z');
  const end = calculatePeriodEnd(base, 'MONTHLY');
  assert.strictEqual(end.getUTCFullYear(), 2026);
  assert.strictEqual(end.getUTCMonth(), 1); // February
  assert.strictEqual(end.getUTCDate(), 28);
});

// ----------------------------------------------------------------------------
// P0C2R-04: calculatePeriodEnd MONTHLY clamps Jan 31 -> Feb 29 in leap year
// ----------------------------------------------------------------------------
test('P0C2R-04: calculatePeriodEnd MONTHLY clamps Jan 31 to Feb 29 in leap year', () => {
  const base = new Date('2024-01-31T00:00:00Z');
  const end = calculatePeriodEnd(base, 'MONTHLY');
  assert.strictEqual(end.getUTCFullYear(), 2024);
  assert.strictEqual(end.getUTCMonth(), 1); // February
  assert.strictEqual(end.getUTCDate(), 29);
});

// ----------------------------------------------------------------------------
// P0C2R-05: calculatePeriodEnd YEARLY preserves date or clamps Feb 29 -> Feb 28
// ----------------------------------------------------------------------------
test('P0C2R-05: calculatePeriodEnd YEARLY clamps Feb 29 to Feb 28 across non-leap year', () => {
  const leapBase = new Date('2024-02-29T12:00:00Z');
  const leapEnd = calculatePeriodEnd(leapBase, 'YEARLY');
  assert.strictEqual(leapEnd.getUTCFullYear(), 2025);
  assert.strictEqual(leapEnd.getUTCMonth(), 1); // February
  assert.strictEqual(leapEnd.getUTCDate(), 28);

  const regularBase = new Date('2026-06-15T12:00:00Z');
  const regularEnd = calculatePeriodEnd(regularBase, 'YEARLY');
  assert.strictEqual(regularEnd.getUTCFullYear(), 2027);
  assert.strictEqual(regularEnd.getUTCMonth(), 5); // June
  assert.strictEqual(regularEnd.getUTCDate(), 15);
});

// ----------------------------------------------------------------------------
// P0C2R-06: Pilot plan settlement sets 45-day entitlement
// ----------------------------------------------------------------------------
test('P0C2R-06: Pilot plan settlement sets 45-day entitlement from payment time', async () => {
  const checkoutRef = 'cs_p0c2r_06';
  const orgId = '33333333-3333-4333-8333-333333333306';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 06', 'Org 06') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111156', '${orgId}', 'MAYAR', '${checkoutRef}', 'chk_06', 'PENDING', 'pilot', 7500000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  const now = new Date();
  const res = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_pilot_06',
    amount: 7500000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  assert.strictEqual(res.status, 'PROCESSED');
  const sub = await pglite.query<{ current_period_end: string; plan_id: string }>(
    `SELECT current_period_end, plan_id FROM public.subscriptions WHERE org_id = $1`,
    [orgId]
  );
  assert.strictEqual(sub.rows[0].plan_id, 'pilot');
  const endMs = new Date(sub.rows[0].current_period_end).getTime();
  const expectedEndMs = now.getTime() + 45 * 24 * 3600 * 1000;
  assert.ok(Math.abs(endMs - expectedEndMs) < 3000, `Expected 45 days, got diff ${Math.abs(endMs - expectedEndMs)}ms`);
});

// ----------------------------------------------------------------------------
// P0C2R-07: Enterprise plan settlement sets 1-year entitlement
// ----------------------------------------------------------------------------
test('P0C2R-07: Enterprise plan settlement sets 1-year entitlement', async () => {
  const checkoutRef = 'cs_p0c2r_07';
  const orgId = '33333333-3333-4333-8333-333333333307';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 07', 'Org 07') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111157', '${orgId}', 'MAYAR', '${checkoutRef}', 'chk_07', 'PENDING', 'enterprise', 25000000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  const res = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_ent_07',
    amount: 25000000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  assert.strictEqual(res.status, 'PROCESSED');
  const sub = await pglite.query<{ current_period_end: string; plan_id: string }>(
    `SELECT current_period_end, plan_id FROM public.subscriptions WHERE org_id = $1`,
    [orgId]
  );
  assert.strictEqual(sub.rows[0].plan_id, 'enterprise');
  const subEnd = new Date(sub.rows[0].current_period_end);
  const now = new Date();
  assert.strictEqual(subEnd.getUTCFullYear(), now.getUTCFullYear() + 1);
});

// ----------------------------------------------------------------------------
// P0C2R-08: billing_payments organization_id FK is ON DELETE RESTRICT
// ----------------------------------------------------------------------------
test('P0C2R-08: attempting DELETE FROM public.organizations with settled payment fails (RESTRICT)', async () => {
  const orgId = '33333333-3333-4333-8333-333333333308';
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 08', 'Org 08') ON CONFLICT DO NOTHING;
    INSERT INTO public.billing_payments (organization_id, provider, provider_payment_id, amount, currency, status)
    VALUES ('${orgId}', 'MAYAR', 'pay_restrict_08', 499000, 'IDR', 'SETTLED')
    ON CONFLICT DO NOTHING;
  `);

  let deleteFailed = false;
  try {
    await pglite.query(`DELETE FROM public.organizations WHERE id = $1`, [orgId]);
  } catch (err: any) {
    deleteFailed = true;
    assert.match(err.message, /foreign key constraint|violates foreign key|23503/i);
  }
  assert.strictEqual(deleteFailed, true, 'Deleting organization with payments must violate RESTRICT FK constraint');

  // Verify payment is still intact
  const pay = await pglite.query(`SELECT id FROM public.billing_payments WHERE provider_payment_id = 'pay_restrict_08'`);
  assert.strictEqual(pay.rows.length, 1);
});

// ----------------------------------------------------------------------------
// P0C2R-09: settled billing payment cannot be deleted (trigger enforced)
// ----------------------------------------------------------------------------
test('P0C2R-09: settled billing payment cannot be deleted (immutability trigger)', async () => {
  const orgId = '33333333-3333-4333-8333-333333333309';
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 09', 'Org 09') ON CONFLICT DO NOTHING;
    INSERT INTO public.billing_payments (organization_id, provider, provider_payment_id, amount, currency, status)
    VALUES ('${orgId}', 'MAYAR', 'pay_immutable_09', 499000, 'IDR', 'SETTLED')
    ON CONFLICT DO NOTHING;
  `);

  let deleteBlocked = false;
  try {
    await pglite.query(`DELETE FROM public.billing_payments WHERE provider_payment_id = 'pay_immutable_09'`);
  } catch (err: any) {
    deleteBlocked = true;
    assert.match(err.message, /immutable|cannot be deleted/i);
  }
  assert.strictEqual(deleteBlocked, true);
});

// ----------------------------------------------------------------------------
// P0C2R-10: settled billing payment core fields cannot be mutated (trigger enforced)
// ----------------------------------------------------------------------------
test('P0C2R-10: settled billing payment core fields cannot be mutated (trigger enforced)', async () => {
  const orgId = '33333333-3333-4333-8333-333333333310';
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 10', 'Org 10') ON CONFLICT DO NOTHING;
    INSERT INTO public.billing_payments (organization_id, provider, provider_payment_id, amount, currency, status)
    VALUES ('${orgId}', 'MAYAR', 'pay_immutable_10', 499000, 'IDR', 'SETTLED')
    ON CONFLICT DO NOTHING;
  `);

  let updateBlocked = false;
  try {
    await pglite.query(`UPDATE public.billing_payments SET amount = 1000 WHERE provider_payment_id = 'pay_immutable_10'`);
  } catch (err: any) {
    updateBlocked = true;
    assert.match(err.message, /immutable/i);
  }
  assert.strictEqual(updateBlocked, true);
});

// ----------------------------------------------------------------------------
// P0C2R-11: distinct second payment on already-paid checkout creates OVERPAYMENT_REVIEW
// ----------------------------------------------------------------------------
test('P0C2R-11: distinct second payment on already-paid checkout creates OVERPAYMENT_REVIEW', async () => {
  const checkoutRef = 'cs_p0c2r_11';
  const orgId = '33333333-3333-4333-8333-333333333311';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 11', 'Org 11') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111161', '${orgId}', 'MAYAR', '${checkoutRef}', 'chk_11', 'PENDING', 'core', 4900000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  // Payment 1: SETTLED
  const res1 = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_11_initial',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });
  assert.strictEqual(res1.status, 'PROCESSED');

  // Payment 2: Distinct provider_payment_id on already-settled checkout
  const res2 = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_11_overpayment',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });
  assert.strictEqual(res2.status, 'DUPLICATE');
  assert.strictEqual(res2.isOverpaymentReview, true);

  // Verify second payment is in billing_payments with OVERPAYMENT_REVIEW status
  const p2 = await pglite.query<{ status: string; amount: string }>(
    `SELECT status, amount FROM public.billing_payments WHERE provider_payment_id = 'pay_11_overpayment'`
  );
  assert.strictEqual(p2.rows.length, 1);
  assert.strictEqual(p2.rows[0].status, 'OVERPAYMENT_REVIEW');
});

// ----------------------------------------------------------------------------
// P0C2R-12: second payment does not grant double entitlement or extend subscription
// ----------------------------------------------------------------------------
test('P0C2R-12: OVERPAYMENT_REVIEW does not extend subscription or grant double entitlement', async () => {
  const checkoutRef = 'cs_p0c2r_12';
  const orgId = '33333333-3333-4333-8333-333333333312';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 12', 'Org 12') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111162', '${orgId}', 'MAYAR', '${checkoutRef}', 'chk_12', 'PENDING', 'core', 4900000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_12_a',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  const subBefore = await pglite.query<{ current_period_end: string }>(
    `SELECT current_period_end FROM public.subscriptions WHERE org_id = $1`,
    [orgId]
  );
  const end1 = subBefore.rows[0].current_period_end;

  // Distinct second payment
  await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_12_b',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  const subAfter = await pglite.query<{ current_period_end: string }>(
    `SELECT current_period_end FROM public.subscriptions WHERE org_id = $1`,
    [orgId]
  );
  assert.strictEqual(
    new Date(subAfter.rows[0].current_period_end).getTime(),
    new Date(end1).getTime(),
    'Expiry date must NOT change upon second payment'
  );
});

// ----------------------------------------------------------------------------
// P0C2R-13: exact duplicate payment returns normal DUPLICATE without anomaly
// ----------------------------------------------------------------------------
test('P0C2R-13: exact replay of same payment returns DUPLICATE and creates no anomaly', async () => {
  const checkoutRef = 'cs_p0c2r_13';
  const orgId = '33333333-3333-4333-8333-333333333313';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 13', 'Org 13') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111163', '${orgId}', 'MAYAR', '${checkoutRef}', 'chk_13', 'PENDING', 'core', 4900000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  const res1 = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_13',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });
  assert.strictEqual(res1.status, 'PROCESSED');

  const res2 = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_13',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });
  assert.strictEqual(res2.status, 'DUPLICATE');

  const anom = await pglite.query(`SELECT id FROM public.billing_payment_anomalies WHERE provider_payment_id = 'pay_13'`);
  assert.strictEqual(anom.rows.length, 0);
});

// ----------------------------------------------------------------------------
// P0C2R-14: same payment ID with different amount triggers PAYMENT_CONFLICT and anomaly
// ----------------------------------------------------------------------------
test('P0C2R-14: same payment ID with different amount triggers PAYMENT_CONFLICT and anomaly record', async () => {
  const checkoutRef = 'cs_p0c2r_14';
  const orgId = '33333333-3333-4333-8333-333333333314';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 14', 'Org 14') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111164', '${orgId}', 'MAYAR', '${checkoutRef}', 'chk_14', 'PENDING', 'core', 4900000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_14_conflict',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  // Replay attempt with same payment ID but different amount
  const resConflict = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_14_conflict',
    amount: 990000.00, // Different!
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  assert.strictEqual(resConflict.status, 'PAYMENT_CONFLICT');
  assert.ok(resConflict.anomalyId);

  // Verify billing_payment_anomalies has record
  const anom = await pglite.query<{ conflict_type: string; incoming_amount: string }>(
    `SELECT conflict_type, incoming_amount FROM public.billing_payment_anomalies WHERE id = $1`,
    [resConflict.anomalyId]
  );
  assert.strictEqual(anom.rows.length, 1);
  assert.strictEqual(anom.rows[0].conflict_type, 'AMOUNT_MISMATCH');
});

// ----------------------------------------------------------------------------
// P0C2R-15: same payment ID with different checkout session triggers PAYMENT_CONFLICT
// ----------------------------------------------------------------------------
test('P0C2R-15: same payment ID with different checkout session triggers PAYMENT_CONFLICT', async () => {
  const checkout1 = 'cs_p0c2r_15_a';
  const checkout2 = 'cs_p0c2r_15_b';
  const orgId = '33333333-3333-4333-8333-333333333315';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 15', 'Org 15') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111165', '${orgId}', 'MAYAR', '${checkout1}', 'chk_15a', 'PENDING', 'core', 4900000.00, 'IDR'),
           ('11111111-1111-4111-8111-111111111166', '${orgId}', 'MAYAR', '${checkout2}', 'chk_15b', 'PENDING', 'core', 4900000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkout1,
    providerPaymentId: 'pay_15_shared',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  const resConflict = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkout2,
    providerPaymentId: 'pay_15_shared',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  assert.strictEqual(resConflict.status, 'PAYMENT_CONFLICT');
  const anom = await pglite.query<{ conflict_type: string }>(
    `SELECT conflict_type FROM public.billing_payment_anomalies WHERE id = $1`,
    [resConflict.anomalyId]
  );
  assert.strictEqual(anom.rows[0].conflict_type, 'CHECKOUT_MISMATCH');
});

// ----------------------------------------------------------------------------
// P0C2R-16: payment conflict via webhook route returns HTTP 409
// ----------------------------------------------------------------------------
test('P0C2R-16: payment conflict via webhook route returns HTTP 409', async () => {
  const checkout1 = 'cs_p0c2r_16_a';
  const checkout2 = 'cs_p0c2r_16_b';
  const orgId = '33333333-3333-4333-8333-333333333316';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 16', 'Org 16') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111167', '${orgId}', 'MAYAR', '${checkout1}', 'chk_16a', 'PENDING', 'core', 4900000.00, 'IDR'),
           ('11111111-1111-4111-8111-111111111168', '${orgId}', 'MAYAR', '${checkout2}', 'chk_16b', 'PENDING', 'core', 4900000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  // Legitimate payment 1
  const res1 = await sendSignedWebhook({
    event: 'payment.settled',
    id: 'evt_p0c2r_16_1',
    data: {
      id: checkout1,
      payment_id: 'pay_16_route_conflict',
      amount: 4900000.00,
      currency: 'IDR',
      status: 'settled'
    }
  });
  assert.strictEqual(res1.status, 200);

  // Conflicting payment with different checkout session
  const res2 = await sendSignedWebhook({
    event: 'payment.settled',
    id: 'evt_p0c2r_16_2',
    data: {
      id: checkout2,
      payment_id: 'pay_16_route_conflict',
      amount: 4900000.00,
      currency: 'IDR',
      status: 'settled'
    }
  });
  assert.strictEqual(res2.status, 409);
  const body = await res2.json();
  assert.strictEqual(body.result, 'CONFLICT');
});

// ----------------------------------------------------------------------------
// P0C2R-17: unevidenced status synonyms 'paid' and 'success' are rejected
// ----------------------------------------------------------------------------
test('P0C2R-17: unevidenced status synonyms paid and success are rejected (fail closed)', async () => {
  const checkoutRef = 'cs_p0c2r_17';
  const orgId = '33333333-3333-4333-8333-333333333317';

  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name) VALUES ('${orgId}', 'Org 17', 'Org 17') ON CONFLICT DO NOTHING;
    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('11111111-1111-4111-8111-111111111169', '${orgId}', 'MAYAR', '${checkoutRef}', 'chk_17', 'PENDING', 'core', 4900000.00, 'IDR')
    ON CONFLICT DO NOTHING;
  `);

  const resPaid = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_17_synonym_1',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'paid'
  });
  assert.strictEqual(resPaid.status, 'REJECTED');

  const resSuccess = await pgSettlementRepo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: checkoutRef,
    providerPaymentId: 'pay_17_synonym_2',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'success'
  });
  assert.strictEqual(resSuccess.status, 'REJECTED');
});

// ----------------------------------------------------------------------------
// P0C2R-18: authenticated role has SELECT grant on billing_payments & anomalies
// ----------------------------------------------------------------------------
test('P0C2R-18: authenticated role has SELECT grant on billing_payments and billing_payment_anomalies', async () => {
  const permRes = await pglite.query<{ table_name: string; privilege_type: string }>(
    `SELECT table_name, privilege_type
     FROM information_schema.role_table_grants
     WHERE grantee = 'authenticated'
       AND table_name IN ('billing_payments', 'billing_payment_anomalies')
       AND privilege_type = 'SELECT'`
  );

  const tables = permRes.rows.map(r => r.table_name);
  assert.ok(tables.includes('billing_payments'), 'authenticated must have SELECT on billing_payments');
  assert.ok(tables.includes('billing_payment_anomalies'), 'authenticated must have SELECT on billing_payment_anomalies');
});

// ----------------------------------------------------------------------------
// P0C2R-19: commercial W->P tables remain completely untouched
// ----------------------------------------------------------------------------
test('P0C2R-19: commercial W->P tables remain completely untouched across remediation', async () => {
  const tables = [
    'work_progress_lines',
    'measurements',
    'claims',
    'certificates',
    'project_invoices',
    'cash_receipts',
    'receipt_allocations'
  ];

  for (const t of tables) {
    const res = await pglite.query(`SELECT COUNT(*) as count FROM public.${t}`);
    assert.strictEqual(Number(res.rows[0].count), 0, `Table ${t} must remain completely untouched`);
  }
});
