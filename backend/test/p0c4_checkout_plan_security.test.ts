// ============================================================================
// COVE Backend — Gate P0-C.4.2: Checkout Plan Authorization & Pricing Integrity
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §26
// Verifies finding F-C4.1-01 remediation:
// 1. Strict allowlist for self-service checkout: only 'pilot', 'core', 'scale' permitted
// 2. Fail-closed rejection of 'enterprise', arbitrary strings, and malformed plans (HTTP 400, INVALID_BILLING_PLAN)
// 3. Backward-compatible default: missing/empty planId defaults to 'core'
// 4. Zero side-effects: rejected requests create no rows in checkout_sessions
// 5. MayarService defense-in-depth: direct calls reject unmapped plans without fallback to Core price
// ============================================================================

process.env.NODE_ENV = 'test';

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import app from '../src/index.js';
import { db } from '../src/db/store.js';
import { setTestTokenVerifier } from '../src/lib/supabase.js';
import { config } from '../src/config.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import { MayarService, setCheckoutClientOverride } from '../src/services/mayar.service.js';

let testRepo: InMemoryIdentityRepository;

before(() => {
  db.reset();

  testRepo = new InMemoryIdentityRepository();

  testRepo.organizations = [
    {
      id: 'org-c4-001',
      legalName: 'PT C4 Security Test Org',
      displayName: 'C4 Test Org',
      timezone: 'Asia/Jakarta',
      defaultCurrency: 'IDR',
      status: 'ACTIVE'
    }
  ];

  testRepo.profiles = [
    { id: 'prof-c4-001', authUserId: 'usr-c4-owner', fullName: 'Owner C4', status: 'ACTIVE' },
    { id: 'prof-c4-002', authUserId: 'usr-c4-qs', fullName: 'QS C4', status: 'ACTIVE' }
  ];

  testRepo.memberships = [
    { id: 'mem-c4-001', orgId: 'org-c4-001', profileId: 'prof-c4-001', role: 'OWNER', status: 'ACTIVE' },
    { id: 'mem-c4-002', orgId: 'org-c4-001', profileId: 'prof-c4-002', role: 'QS', status: 'ACTIVE' }
  ];

  setIdentityRepository(testRepo);

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-c4-owner') {
      return { user: { id: 'usr-c4-owner', email: 'owner@c4test.id' }, error: null };
    }
    if (token === 'token-c4-qs') {
      return { user: { id: 'usr-c4-qs', email: 'qs@c4test.id' }, error: null };
    }
    return { user: null, error: 'INVALID_TOKEN' };
  });
});

beforeEach(() => {
  testRepo.checkoutSessions = [];
  setCheckoutClientOverride(null);
});

// ----------------------------------------------------------------------------
// TEST 1: core checkout -> 200 OK & session recorded
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-01: Valid core plan checkout creates checkout session with 200 OK', async () => {
  setCheckoutClientOverride(async (params) => ({
    success: true,
    data: {
      checkoutRef: 'chk_mock_core_01',
      planId: params.planId,
      subtotal: 4900000,
      tax: 539000,
      total: 5439000,
      paymentUrl: 'https://pay.mayar.id/chk_mock_core_01',
      status: 'PENDING'
    }
  }));

  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-owner'
    },
    body: JSON.stringify({ planId: 'core' })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.data.planId, 'core');
  assert.strictEqual(data.data.checkoutRef, 'chk_mock_core_01');

  // Verify session recorded in repository
  const sessions = testRepo.checkoutSessions;
  assert.strictEqual(sessions.length, 1);
  assert.strictEqual(sessions[0].plan, 'core');
  assert.strictEqual(sessions[0].providerReference, 'chk_mock_core_01');
});

// ----------------------------------------------------------------------------
// TEST 2: pilot checkout -> 200 OK & session recorded
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-02: Valid pilot plan checkout creates checkout session with 200 OK', async () => {
  setCheckoutClientOverride(async (params) => ({
    success: true,
    data: {
      checkoutRef: 'chk_mock_pilot_01',
      planId: params.planId,
      subtotal: 7500000,
      tax: 825000,
      total: 8325000,
      paymentUrl: 'https://pay.mayar.id/chk_mock_pilot_01',
      status: 'PENDING'
    }
  }));

  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-owner'
    },
    body: JSON.stringify({ planId: 'pilot' })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.data.planId, 'pilot');

  const sessions = testRepo.checkoutSessions;
  assert.strictEqual(sessions.length, 1);
  assert.strictEqual(sessions[0].plan, 'pilot');
});

// ----------------------------------------------------------------------------
// TEST 3: scale checkout -> 200 OK & session recorded
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-03: Valid scale plan checkout creates checkout session with 200 OK', async () => {
  setCheckoutClientOverride(async (params) => ({
    success: true,
    data: {
      checkoutRef: 'chk_mock_scale_01',
      planId: params.planId,
      subtotal: 9900000,
      tax: 1089000,
      total: 10989000,
      paymentUrl: 'https://pay.mayar.id/chk_mock_scale_01',
      status: 'PENDING'
    }
  }));

  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-owner'
    },
    body: JSON.stringify({ planId: 'scale' })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.data.planId, 'scale');

  const sessions = testRepo.checkoutSessions;
  assert.strictEqual(sessions.length, 1);
  assert.strictEqual(sessions[0].plan, 'scale');
});

// ----------------------------------------------------------------------------
// TEST 4: omitted planId -> defaults to 'core' (200 OK)
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-04: Omitted planId defaults to core (backward compatibility preserved)', async () => {
  setCheckoutClientOverride(async (params) => ({
    success: true,
    data: {
      checkoutRef: 'chk_mock_default_01',
      planId: params.planId,
      subtotal: 4900000,
      tax: 539000,
      total: 5439000,
      paymentUrl: 'https://pay.mayar.id/chk_mock_default_01',
      status: 'PENDING'
    }
  }));

  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-owner'
    },
    body: JSON.stringify({})
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.data.planId, 'core');

  const sessions = testRepo.checkoutSessions;
  assert.strictEqual(sessions.length, 1);
  assert.strictEqual(sessions[0].plan, 'core');
});

// ----------------------------------------------------------------------------
// TEST 5: enterprise checkout via self-service -> 400 INVALID_BILLING_PLAN
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-05: Enterprise plan via self-service checkout is rejected fail-closed (400 INVALID_BILLING_PLAN)', async () => {
  let mockCalled = false;
  setCheckoutClientOverride(async () => {
    mockCalled = true;
    return {
      success: true,
      data: {
        checkoutRef: 'chk_should_not_exist',
        planId: 'enterprise',
        subtotal: 4900000,
        tax: 539000,
        total: 5439000,
        paymentUrl: 'https://pay.mayar.id/chk_should_not_exist',
        status: 'PENDING'
      }
    };
  });

  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-owner'
    },
    body: JSON.stringify({ planId: 'enterprise' })
  });

  assert.strictEqual(res.status, 400, 'Must return HTTP 400');
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.code, 'INVALID_BILLING_PLAN');
  assert.ok(data.error.includes('enterprise'));
  assert.strictEqual(mockCalled, false, 'Provider client must not even be invoked');

  // Verify ZERO checkout_sessions rows created
  assert.strictEqual(testRepo.checkoutSessions.length, 0, 'No checkout session must be created');
});

// ----------------------------------------------------------------------------
// TEST 6: arbitrary plan string -> 400 INVALID_BILLING_PLAN
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-06: Arbitrary plan string is rejected fail-closed with 400 INVALID_BILLING_PLAN', async () => {
  const invalidPlans = ['invalid_xyz', 'pro', 'unlimited', 'free', 'test_plan_999'];

  for (const plan of invalidPlans) {
    const res = await app.request('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-c4-owner'
      },
      body: JSON.stringify({ planId: plan })
    });

    assert.strictEqual(res.status, 400, `Plan '${plan}' must return HTTP 400`);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_BILLING_PLAN');
  }

  assert.strictEqual(testRepo.checkoutSessions.length, 0, 'No checkout sessions created for invalid plans');
});

// ----------------------------------------------------------------------------
// TEST 7: Case normalization handles CORE/PILOT/SCALE cleanly, rejects ENTERPRISE
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-07: Case normalization accepts upper/mixed valid plans and rejects uppercase ENTERPRISE', async () => {
  setCheckoutClientOverride(async (params) => ({
    success: true,
    data: {
      checkoutRef: 'chk_mock_case_01',
      planId: params.planId,
      subtotal: 4900000,
      tax: 539000,
      total: 5439000,
      paymentUrl: 'https://pay.mayar.id/chk_mock_case_01',
      status: 'PENDING'
    }
  }));

  // Upper CORE -> accepted as normalized 'core'
  const resValid = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-owner'
    },
    body: JSON.stringify({ planId: ' CORE ' })
  });
  assert.strictEqual(resValid.status, 200);

  // Upper ENTERPRISE -> rejected
  const resInvalid = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-owner'
    },
    body: JSON.stringify({ planId: 'ENTERPRISE' })
  });
  assert.strictEqual(resInvalid.status, 400);
  const invalidData = await resInvalid.json();
  assert.strictEqual(invalidData.code, 'INVALID_BILLING_PLAN');
});

// ----------------------------------------------------------------------------
// TEST 8: MayarService.createCheckoutSession defense-in-depth direct unit test
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-08: MayarService.createCheckoutSession directly rejects unmapped plans without fallback', async () => {
  setCheckoutClientOverride(null);

  // Direct call with enterprise
  const entRes = await MayarService.createCheckoutSession({
    planId: 'enterprise',
    customerName: 'Direct Tester',
    customerEmail: 'tester@enterprise.com'
  });
  assert.strictEqual(entRes.success, false);
  assert.strictEqual(entRes.error, 'INVALID_BILLING_PLAN');

  // Direct call with unknown plan
  const unkRes = await MayarService.createCheckoutSession({
    planId: 'hack_plan_999',
    customerName: 'Direct Tester',
    customerEmail: 'tester@hack.com'
  });
  assert.strictEqual(unkRes.success, false);
  assert.strictEqual(unkRes.error, 'INVALID_BILLING_PLAN');
});

// ----------------------------------------------------------------------------
// TEST 9: MayarService.createCheckoutSession pricing verification
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-09: MayarService calculates exact pricing without generic fallback', async () => {
  const origKey = config.mayarApiKey;
  config.mayarApiKey = 'myr_live_mock_key_for_pricing_check';

  const origFetch = globalThis.fetch;
  const capturedPayloads: any[] = [];
  globalThis.fetch = async (url: any, init: any) => {
    if (url.toString().includes('mayar.id/hl/v1/payment/create')) {
      const parsedBody = JSON.parse(init.body);
      capturedPayloads.push(parsedBody);
      return {
        ok: true,
        json: async () => ({
          id: 'chk_provider_' + Date.now(),
          link: 'https://pay.mayar.id/test'
        })
      } as any;
    }
    return origFetch(url, init);
  };

  try {
    // 1. Pilot: 7,500,000 + 11% tax = 8,325,000
    const pilotRes = await MayarService.createCheckoutSession({
      planId: 'pilot',
      customerName: 'Pilot User',
      customerEmail: 'pilot@cove.id'
    });
    assert.strictEqual(pilotRes.success, true);
    assert.strictEqual(pilotRes.data?.subtotal, 7500000);
    assert.strictEqual(pilotRes.data?.tax, 825000);
    assert.strictEqual(pilotRes.data?.total, 8325000);

    // 2. Core: 4,900,000 + 11% tax = 5,439,000
    const coreRes = await MayarService.createCheckoutSession({
      planId: 'core',
      customerName: 'Core User',
      customerEmail: 'core@cove.id'
    });
    assert.strictEqual(coreRes.success, true);
    assert.strictEqual(coreRes.data?.subtotal, 4900000);
    assert.strictEqual(coreRes.data?.tax, 539000);
    assert.strictEqual(coreRes.data?.total, 5439000);

    // 3. Scale: 9,900,000 + 11% tax = 10,989,000
    const scaleRes = await MayarService.createCheckoutSession({
      planId: 'scale',
      customerName: 'Scale User',
      customerEmail: 'scale@cove.id'
    });
    assert.strictEqual(scaleRes.success, true);
    assert.strictEqual(scaleRes.data?.subtotal, 9900000);
    assert.strictEqual(scaleRes.data?.tax, 1089000);
    assert.strictEqual(scaleRes.data?.total, 10989000);

    // Verify captured provider payloads received exact amounts
    assert.strictEqual(capturedPayloads[0].amount, 8325000);
    assert.strictEqual(capturedPayloads[1].amount, 5439000);
    assert.strictEqual(capturedPayloads[2].amount, 10989000);
  } finally {
    globalThis.fetch = origFetch;
    config.mayarApiKey = origKey;
  }
});

// ----------------------------------------------------------------------------
// TEST 10: Non-admin / non-owner cannot checkout regardless of plan
// ----------------------------------------------------------------------------
test('P0C4-CHECKOUT-10: Non-admin role (e.g. QS) receives 403 Forbidden even with valid plan', async () => {
  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-c4-qs'
    },
    body: JSON.stringify({ planId: 'core' })
  });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(testRepo.checkoutSessions.length, 0);
});
