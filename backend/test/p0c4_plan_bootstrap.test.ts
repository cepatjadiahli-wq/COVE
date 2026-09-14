// ============================================================================
// COVE Backend — Gate P0-C.4.1: Canonical Plan Bootstrap & Settlement Recovery Tests
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §26
// Verifies that:
// 1. CANONICAL_MIGRATION_ORDER includes 019_canonical_plans.sql and excludes 003_seed_data.sql
// 2. Fresh canonical migrations populate public.plans with exact canonical catalog
// 3. Exact periods (45_DAYS, MONTHLY, YEARLY) and prices (7.5M, 4.9M, 9.9M, 25M)
// 4. Migration 019 is strictly idempotent
// 5. Canonical settlement succeeds on fresh database WITHOUT any manual test fixture
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { CANONICAL_MIGRATION_ORDER, getDiscoveredMigrations } from '../src/db/migrate.js';
import { PostgresBillingSettlementRepository } from '../src/repositories/billing_settlement.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../migrations');

// Helper to run all canonical migrations on a fresh PGlite instance
async function createFreshCanonicalDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ BEGIN RETURN '00000000-0000-0000-0000-000000000001'::UUID; END; $$ LANGUAGE plpgsql;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE ROLE service_role;
  `);

  for (const filename of CANONICAL_MIGRATION_ORDER) {
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
    await db.exec(sql);
  }
  return db;
}

// ----------------------------------------------------------------------------
// P0C4-01: CANONICAL_MIGRATION_ORDER includes 019 and excludes 003_seed_data.sql
// ----------------------------------------------------------------------------
test('P0C4-01: CANONICAL_MIGRATION_ORDER includes 019 and excludes 003_seed_data.sql', () => {
  assert.ok(CANONICAL_MIGRATION_ORDER.includes('019_canonical_plans.sql' as any), '019 must be in CANONICAL_MIGRATION_ORDER');
  assert.strictEqual(
    CANONICAL_MIGRATION_ORDER.includes('003_seed_data.sql' as any),
    false,
    '003_seed_data.sql must NOT be in CANONICAL_MIGRATION_ORDER'
  );

  const discovered = getDiscoveredMigrations();
  assert.ok(discovered.includes('019_canonical_plans.sql'), '019 must be in discovered migrations');
  assert.strictEqual(discovered.includes('003_seed_data.sql'), false, '003_seed_data.sql must NOT be in discovered migrations');

  // Verify 019 is the tail
  const tail = CANONICAL_MIGRATION_ORDER[CANONICAL_MIGRATION_ORDER.length - 1];
  assert.strictEqual(tail, '019_canonical_plans.sql', '019 must be the tail of CANONICAL_MIGRATION_ORDER');
});

// ----------------------------------------------------------------------------
// P0C4-02: Fresh canonical migrations populate public.plans with exact 4 canonical tiers
// ----------------------------------------------------------------------------
test('P0C4-02: Fresh canonical migrations populate public.plans with exact 4 canonical tiers', async () => {
  const db = await createFreshCanonicalDb();

  const res = await db.query(
    `SELECT id, name, price_idr, billing_period, max_active_projects, max_users, status
     FROM public.plans
     ORDER BY price_idr ASC`
  );

  assert.strictEqual(res.rows.length, 4, 'Must have exactly 4 canonical plans');
  const planIds = res.rows.map((r: any) => r.id).sort();
  assert.deepStrictEqual(planIds, ['core', 'enterprise', 'pilot', 'scale']);
});

// ----------------------------------------------------------------------------
// P0C4-03: Exact canonical periods and pricing attributes verified
// ----------------------------------------------------------------------------
test('P0C4-03: Exact canonical periods and pricing attributes verified', async () => {
  const db = await createFreshCanonicalDb();

  const planMap: Record<string, any> = {};
  const res = await db.query(`SELECT * FROM public.plans`);
  for (const r of res.rows as any[]) {
    planMap[r.id] = r;
  }

  // Pilot: 7.5M IDR, 45_DAYS, 1 project, 3 users, ACTIVE
  assert.strictEqual(planMap['pilot'].name, 'Paid Pilot');
  assert.strictEqual(Number(planMap['pilot'].price_idr), 7500000);
  assert.strictEqual(planMap['pilot'].billing_period, '45_DAYS');
  assert.strictEqual(planMap['pilot'].max_active_projects, 1);
  assert.strictEqual(planMap['pilot'].max_users, 3);
  assert.strictEqual(planMap['pilot'].status, 'ACTIVE');

  // Core: 4.9M IDR, MONTHLY, 3 projects, 5 users, ACTIVE
  assert.strictEqual(planMap['core'].name, 'Core');
  assert.strictEqual(Number(planMap['core'].price_idr), 4900000);
  assert.strictEqual(planMap['core'].billing_period, 'MONTHLY');
  assert.strictEqual(planMap['core'].max_active_projects, 3);
  assert.strictEqual(planMap['core'].max_users, 5);
  assert.strictEqual(planMap['core'].status, 'ACTIVE');

  // Scale: 9.9M IDR, MONTHLY, 10 projects, 15 users, ACTIVE
  assert.strictEqual(planMap['scale'].name, 'Scale');
  assert.strictEqual(Number(planMap['scale'].price_idr), 9900000);
  assert.strictEqual(planMap['scale'].billing_period, 'MONTHLY');
  assert.strictEqual(planMap['scale'].max_active_projects, 10);
  assert.strictEqual(planMap['scale'].max_users, 15);
  assert.strictEqual(planMap['scale'].status, 'ACTIVE');

  // Enterprise: 25M IDR, YEARLY, 999 projects, 999 users, ACTIVE
  assert.strictEqual(planMap['enterprise'].name, 'Enterprise');
  assert.strictEqual(Number(planMap['enterprise'].price_idr), 25000000);
  assert.strictEqual(planMap['enterprise'].billing_period, 'YEARLY');
  assert.strictEqual(planMap['enterprise'].max_active_projects, 999);
  assert.strictEqual(planMap['enterprise'].max_users, 999);
  assert.strictEqual(planMap['enterprise'].status, 'ACTIVE');
});

// ----------------------------------------------------------------------------
// P0C4-04: Migration 019 is strictly idempotent (ON CONFLICT DO UPDATE)
// ----------------------------------------------------------------------------
test('P0C4-04: Migration 019 is strictly idempotent (ON CONFLICT DO UPDATE)', async () => {
  const db = await createFreshCanonicalDb();

  // Run 019 again
  const sql019 = fs.readFileSync(path.join(migrationsDir, '019_canonical_plans.sql'), 'utf-8');
  await db.exec(sql019);

  // Check count is still exactly 4
  const res = await db.query(`SELECT COUNT(*) as cnt FROM public.plans`);
  assert.strictEqual(Number(res.rows[0].cnt), 4, 'Re-running 019 must not create duplicate plan rows');

  // Modify one attribute temporarily, re-run 019, verify self-healing
  await db.exec(`UPDATE public.plans SET name = 'Drifted Name' WHERE id = 'core'`);
  await db.exec(sql019);
  const healed = await db.query(`SELECT name FROM public.plans WHERE id = 'core'`);
  assert.strictEqual(healed.rows[0].name, 'Core', 'Re-running 019 must restore canonical metadata');
});

// ----------------------------------------------------------------------------
// P0C4-05: Canonical Core settlement succeeds on fresh database WITHOUT manual test fixture
// ----------------------------------------------------------------------------
test('P0C4-05: Canonical Core settlement succeeds on fresh database WITHOUT manual test fixture', async () => {
  const db = await createFreshCanonicalDb();
  const repo = new PostgresBillingSettlementRepository(db as any);

  const orgId = '00000000-0000-4000-a000-000000000001';
  const csId = '11111111-0001-4111-8111-111111111101';
  await db.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name)
    VALUES ('${orgId}', 'PT Test Canonical', 'Test Canonical');

    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('${csId}', '${orgId}', 'MAYAR', 'chk_ref_core_fresh', 'chk_core_fresh', 'PENDING', 'core', 4900000.00, 'IDR');
  `);

  // Note: NO manual INSERT INTO public.plans was executed in this test!
  const result = await repo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: 'chk_ref_core_fresh',
    providerPaymentId: 'pay_core_fresh_1',
    amount: 4900000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  assert.strictEqual(result.status, 'PROCESSED');
  assert.ok(result.paymentId);
  assert.ok(result.subscriptionId);

  // Check checkout is PAID
  const cs = await db.query(`SELECT status FROM public.checkout_sessions WHERE id = '${csId}'`);
  assert.strictEqual(cs.rows[0].status, 'PAID');

  // Check billing payment is SETTLED
  const pay = await db.query(`SELECT status, amount FROM public.billing_payments WHERE id = $1`, [result.paymentId]);
  assert.strictEqual(pay.rows[0].status, 'SETTLED');
  assert.strictEqual(Number(pay.rows[0].amount), 4900000);

  // Check subscription is ACTIVE
  const sub = await db.query(`SELECT plan_id, status, current_period_start, current_period_end FROM public.subscriptions WHERE id = $1`, [result.subscriptionId]);
  assert.strictEqual(sub.rows[0].plan_id, 'core');
  assert.strictEqual(sub.rows[0].status, 'ACTIVE');
});

// ----------------------------------------------------------------------------
// P0C4-06: Canonical Pilot settlement sets 45-day entitlement from payment time
// ----------------------------------------------------------------------------
test('P0C4-06: Canonical Pilot settlement sets 45-day entitlement from payment time', async () => {
  const db = await createFreshCanonicalDb();
  const repo = new PostgresBillingSettlementRepository(db as any);

  const orgId = '00000000-0000-4000-a000-000000000002';
  const csId = '11111111-0002-4111-8111-111111111102';
  await db.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name)
    VALUES ('${orgId}', 'PT Pilot Org', 'Pilot Org');

    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('${csId}', '${orgId}', 'MAYAR', 'chk_ref_pilot_fresh', 'chk_pilot_fresh', 'PENDING', 'pilot', 7500000.00, 'IDR');
  `);

  const result = await repo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: 'chk_ref_pilot_fresh',
    providerPaymentId: 'pay_pilot_fresh_1',
    amount: 7500000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  assert.strictEqual(result.status, 'PROCESSED');
  const sub = await db.query(`SELECT current_period_start, current_period_end FROM public.subscriptions WHERE org_id = $1`, [orgId]);
  const start = new Date(sub.rows[0].current_period_start).getTime();
  const end = new Date(sub.rows[0].current_period_end).getTime();

  const diffDays = Math.round((end - start) / (24 * 3600 * 1000));
  assert.strictEqual(diffDays, 45, 'Pilot entitlement must be exactly 45 calendar days');
});

// ----------------------------------------------------------------------------
// P0C4-07: Canonical Enterprise settlement sets 1-year entitlement
// ----------------------------------------------------------------------------
test('P0C4-07: Canonical Enterprise settlement sets 1-year entitlement', async () => {
  const db = await createFreshCanonicalDb();
  const repo = new PostgresBillingSettlementRepository(db as any);

  const orgId = '00000000-0000-4000-a000-000000000003';
  const csId = '11111111-0003-4111-8111-111111111103';
  await db.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name)
    VALUES ('${orgId}', 'PT Enterprise Org', 'Enterprise Org');

    INSERT INTO public.checkout_sessions (id, organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
    VALUES ('${csId}', '${orgId}', 'MAYAR', 'chk_ref_ent_fresh', 'chk_ent_fresh', 'PENDING', 'enterprise', 25000000.00, 'IDR');
  `);

  const result = await repo.settlePayment({
    provider: 'MAYAR',
    checkoutReference: 'chk_ref_ent_fresh',
    providerPaymentId: 'pay_ent_fresh_1',
    amount: 25000000.00,
    currency: 'IDR',
    paymentStatus: 'settled'
  });

  assert.strictEqual(result.status, 'PROCESSED');
  const sub = await db.query(`SELECT current_period_start, current_period_end FROM public.subscriptions WHERE org_id = $1`, [orgId]);
  const start = new Date(sub.rows[0].current_period_start);
  const end = new Date(sub.rows[0].current_period_end);

  assert.strictEqual(end.getUTCFullYear(), start.getUTCFullYear() + 1, 'Enterprise entitlement must be exactly 1 year');
  assert.strictEqual(end.getUTCMonth(), start.getUTCMonth(), 'Month must match');
});
