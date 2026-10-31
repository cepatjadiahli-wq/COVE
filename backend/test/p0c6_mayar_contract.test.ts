// ============================================================================
// COVE Backend — P0-C6 Mayar Real Contract Compatibility Tests
// Covers:
//   §1  MAYAR_ENVIRONMENT model (sandbox vs production URL)
//   §2  createCheckoutSession: mobile required, expiredAt, redirectUrl, env URL
//   §3  Provider identity: checkoutRef = data.id, transactionId = data.transactionId
//   §4  payment.received adapter: SUCCESS+paid → settlement, other combos → IGNORED
//   §5  Legacy explicit delivery IDs remain compatible
//   §6  Legacy checkout reference resolution via provider_reference = data.id
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before, describe} from 'node:test';
import assert from 'node:assert/strict';
import {
  MayarService,
  setCheckoutClientOverride,
} from '../src/services/mayar.service.js';
import type {MayarWebhookPayload} from '../src/services/mayar.service.js';
import {getMayarApiBaseUrl} from '../src/config.js';
import {db} from '../src/db/store.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import {
  setWebhookRepository,
  InMemoryWebhookRepository
} from '../src/repositories/webhook.repository.js';
import {
  InMemoryBillingSettlementRepository,
  setBillingSettlementRepository
} from '../src/repositories/billing_settlement.repository.js';
import type {CheckoutSessionEntity} from '../src/types/domain.js';

function makePaymentReceivedPayload(dataOverrides: Partial<MayarWebhookPayload['data']> = {}, idOverride?: string): MayarWebhookPayload {
  return {
    event: 'payment.received',
    id: idOverride ?? ('mayar-evt-' + Math.random().toString(36).slice(2)),
    data: {
      id: 'pay-req-' + Math.random().toString(36).slice(2),
      amount: 5439000,
      status: 'SUCCESS',
      transactionStatus: 'paid',
      transactionId: 'txn-' + Math.random().toString(36).slice(2),
      currency: 'IDR',
      ...dataOverrides
    }
  };
}

function makeCheckoutSession(providerReference: string, orgId = 'org-test-p0c6'): CheckoutSessionEntity {
  return {
    id: 'cs-p0c6-' + Math.random().toString(36).slice(2),
    organizationId: orgId,
    provider: 'MAYAR',
    providerReference,
    providerCheckoutId: providerReference,
    status: 'PENDING',
    plan: 'core',
    amount: 5439000,
    currency: 'IDR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// §1 — MAYAR_ENVIRONMENT model
// ---------------------------------------------------------------------------

describe('P0C6-§1 MAYAR_ENVIRONMENT URL model', () => {
  test('sandbox env returns sandbox API base URL', () => {
    const url = getMayarApiBaseUrl('sandbox');
    assert.equal(url, 'https://api.mayar.io/hl/v2');
  });

  test('production env returns production API base URL', () => {
    const url = getMayarApiBaseUrl('production');
    assert.equal(url, 'https://api.mayar.id/hl/v2');
  });

  test('unknown env string defaults to production', () => {
    const url = getMayarApiBaseUrl('staging');
    assert.equal(url, 'https://api.mayar.id/hl/v2');
  });
});

// ---------------------------------------------------------------------------
// §2+§3 — createCheckoutSession contract
// ---------------------------------------------------------------------------

describe('P0C6-§2§3 createCheckoutSession contract', () => {
  test('MOBILE_REQUIRED when customerPhone is absent', async () => {
    setCheckoutClientOverride(async (params: any) => {
      if (!params.customerPhone) {
        return {success: false, error: 'MOBILE_REQUIRED', message: 'Nomor telepon wajib diisi.'};
      }
      return {success: true, data: {checkoutRef: 'r', planId: 'core', subtotal: 0, tax: 0, total: 0, paymentUrl: 'u', status: 'PENDING'}};
    });
    const result = await MayarService.createCheckoutSession({planId: 'core', customerName: 'X', customerEmail: 'x@x.com'});
    assert.equal(result.success, false);
    assert.equal(result.error, 'MOBILE_REQUIRED');
    setCheckoutClientOverride(null as any);
  });

  test('checkout succeeds with phone via override and returns transactionId', async () => {
    setCheckoutClientOverride(async () => ({
      success: true,
      data: {checkoutRef: 'pay-req-aaa', transactionId: 'txn-bbb', planId: 'core', subtotal: 4900000, tax: 539000, total: 5439000, paymentUrl: 'https://x', status: 'PENDING'}
    }));
    const result = await MayarService.createCheckoutSession({planId: 'core', customerName: 'B', customerEmail: 'b@b.com', customerPhone: '+62811'});
    assert.equal(result.success, true);
    assert.equal(result.data?.checkoutRef, 'pay-req-aaa');
    assert.equal(result.data?.transactionId, 'txn-bbb');
    setCheckoutClientOverride(null as any);
  });

  test('INVALID_BILLING_PLAN for unknown plan', async () => {
    setCheckoutClientOverride(null as any);
    const result = await MayarService.createCheckoutSession({planId: 'enterprise', customerName: 'X', customerEmail: 'x@x.com', customerPhone: '+62811'});
    assert.equal(result.success, false);
    assert.equal(result.error, 'INVALID_BILLING_PLAN');
  });
});

// ---------------------------------------------------------------------------
// §4+§5+§6 — payment.received adapter, composite eventId, checkout resolution
// ---------------------------------------------------------------------------

describe('P0C6-§4§5§6 payment.received adapter composite-eventId checkout-resolution', () => {
  const ORG_ID = 'org-p0c6-webhook';
  const CHECKOUT_REF = 'pay-req-canonical-p0c6';
  const AMOUNT = 5439000;
  let identityRepo: InMemoryIdentityRepository;

  before(() => {
    db.reset();
    identityRepo = new InMemoryIdentityRepository();
    setIdentityRepository(identityRepo);
    setWebhookRepository(new InMemoryWebhookRepository());
    setBillingSettlementRepository(new InMemoryBillingSettlementRepository());

    (identityRepo as any).checkoutSessions = [makeCheckoutSession(CHECKOUT_REF, ORG_ID)];
    (identityRepo as any).subscriptions = [];
    (identityRepo as any).organizations = [{id: ORG_ID, name: 'P0C6 Org', slug: 'p0c6', createdAt: new Date().toISOString()}];
  });

  test('§4: payment.received SUCCESS+paid → PROCESSED', async () => {
    const payload = makePaymentReceivedPayload({id: CHECKOUT_REF, transactionId: 'txn-c1'});
    const result = await MayarService.handleWebhook(payload);
    assert.equal(result.status, 'PROCESSED', result.message);
  });

  test('§4: payment.received FAILED → IGNORED (no settlement)', async () => {
    const payload = makePaymentReceivedPayload({id: CHECKOUT_REF, status: 'FAILED', transactionStatus: 'failed', transactionId: 'txn-fail'});
    const result = await MayarService.handleWebhook(payload);
    assert.equal(result.status, 'IGNORED', result.message);
  });

  test('§4: payment.received SUCCESS but transactionStatus=pending → IGNORED', async () => {
    const payload = makePaymentReceivedPayload({id: 'ref-pending', status: 'SUCCESS', transactionStatus: 'pending', transactionId: 'txn-pend'});
    const result = await MayarService.handleWebhook(payload);
    assert.equal(result.status, 'IGNORED', result.message);
  });

  test('§4: payment.reminder standalone → IGNORED', async () => {
    const payload: MayarWebhookPayload = {
      event: 'payment.reminder',
      id: 'evt-reminder-p0c6-standalone',
      data: {id: CHECKOUT_REF, amount: AMOUNT, status: 'PENDING', currency: 'IDR'}
    };
    const result = await MayarService.handleWebhook(payload);
    assert.notEqual(result.status, 'ERROR', result.message);
    assert.equal(result.status, 'IGNORED', result.message);
  });

  test('§5: payment.reminder and payment.received for same transaction use distinct rawIds → independent, received → PROCESSED', async () => {
    // In practice Mayar issues a unique delivery ID per webhook. reminder and received
    // will have different rawIds. Composite eventId is not required for isolation;
    // each delivery ID is globally unique per provider.
    const reminderRawId = 'reminder-raw-' + Math.random().toString(36).slice(2);
    const receivedRawId = 'received-raw-' + Math.random().toString(36).slice(2);
    const ref2 = 'pay-req-sec5-' + Math.random().toString(36).slice(2);
    (identityRepo as any).checkoutSessions.push(makeCheckoutSession(ref2, ORG_ID));

    const reminder: MayarWebhookPayload = {
      event: 'payment.reminder', id: reminderRawId,
      data: {id: ref2, amount: AMOUNT, status: 'PENDING', currency: 'IDR'}
    };
    const reminderResult = await MayarService.handleWebhook(reminder);
    assert.notEqual(reminderResult.status, 'ERROR', reminderResult.message);

    const received: MayarWebhookPayload = {
      event: 'payment.received', id: receivedRawId,
      data: {id: ref2, amount: AMOUNT, status: 'SUCCESS', transactionStatus: 'paid', transactionId: 'txn-s5', currency: 'IDR'}
    };
    const receivedResult = await MayarService.handleWebhook(received);
    // Different delivery IDs → no CONFLICT, received settles cleanly
    assert.notEqual(receivedResult.status, 'CONFLICT', `received must not CONFLICT: ${receivedResult.message}`);
    assert.equal(receivedResult.status, 'PROCESSED', receivedResult.message);
  });

  test('§5: identical payment.received twice → DUPLICATE on second', async () => {
    const ref3 = 'pay-req-dup-' + Math.random().toString(36).slice(2);
    (identityRepo as any).checkoutSessions.push(makeCheckoutSession(ref3, ORG_ID));
    const payload: MayarWebhookPayload = {
      event: 'payment.received', id: 'evt-dup-p0c6',
      data: {id: ref3, amount: AMOUNT, status: 'SUCCESS', transactionStatus: 'paid', transactionId: 'txn-d1', currency: 'IDR'}
    };
    const first = await MayarService.handleWebhook(payload);
    assert.equal(first.status, 'PROCESSED', first.message);
    const second = await MayarService.handleWebhook(payload);
    assert.equal(second.status, 'DUPLICATE', second.message);
  });

  test('§6: payment.received unknown checkout ref → IGNORED (UNKNOWN_CHECKOUT_REF)', async () => {
    const payload = makePaymentReceivedPayload({id: 'pay-req-does-not-exist-xyz', transactionId: 'txn-unk'});
    const result = await MayarService.handleWebhook(payload);
    assert.equal(result.status, 'IGNORED', result.message);
  });

  test('§4: payment.settled (INTERNAL) still routes to settlement engine', async () => {
    const ref4 = 'pay-req-internal-' + Math.random().toString(36).slice(2);
    (identityRepo as any).checkoutSessions.push(makeCheckoutSession(ref4, ORG_ID));
    const payload: MayarWebhookPayload = {
      event: 'payment.settled', id: 'evt-internal-' + Math.random().toString(36).slice(2),
      data: {id: ref4, amount: AMOUNT, status: 'settled', currency: 'IDR'}
    };
    const result = await MayarService.handleWebhook(payload);
    assert.equal(result.status, 'PROCESSED', result.message);
  });

  test('§4: payment.expired → PROCESSED (recorded, no settlement)', async () => {
    const payload: MayarWebhookPayload = {
      event: 'payment.expired', id: 'evt-expired-p0c6',
      data: {id: 'pay-req-exp', amount: AMOUNT, status: 'EXPIRED', currency: 'IDR'}
    };
    const result = await MayarService.handleWebhook(payload);
    assert.equal(result.status, 'PROCESSED', result.message);
  });
});
