process.env.NODE_ENV = 'test';

import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {config} from '../src/config.js';
import {MayarService, setCheckoutClientOverride} from '../src/services/mayar.service.js';
import {InMemoryIdentityRepository, setIdentityRepository} from '../src/repositories/identity.repository.js';
import {InMemoryWebhookRepository, setWebhookRepository} from '../src/repositories/webhook.repository.js';
import {InMemoryBillingSettlementRepository, setBillingSettlementRepository} from '../src/repositories/billing_settlement.repository.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {db} from '../src/db/store.js';

const originalFetch = globalThis.fetch;
const originalConfig = {...config};
let identity: InMemoryIdentityRepository;
let providerCalls: {url: string; body: any}[];

beforeEach(() => {
  db.reset();
  identity = new InMemoryIdentityRepository();
  identity.organizations = [{id:'org-closure', legalName:'PT Test', displayName:'Test', timezone:'Asia/Jakarta', defaultCurrency:'IDR', status:'ACTIVE'}];
  identity.profiles = [{id:'profile-closure', authUserId:'user-closure', fullName:'Budi', phone:'081234567890', status:'ACTIVE'}];
  identity.memberships = [{id:'member-closure', orgId:'org-closure', profileId:'profile-closure', role:'OWNER', status:'ACTIVE'}];
  setIdentityRepository(identity);
  setWebhookRepository(new InMemoryWebhookRepository());
  setBillingSettlementRepository(new InMemoryBillingSettlementRepository());
  setTestTokenVerifier(async token => token === 'closure-token'
    ? {user:{id:'user-closure', email:'budi@example.com'}, error:null}
    : {user:null, error:'Invalid token'});
  setCheckoutClientOverride(null);
  config.mayarApiKey = 'test-fixture-key';
  config.mayarEnvironment = 'sandbox';
  providerCalls = [];
  globalThis.fetch = async (url, init) => {
    providerCalls.push({url:String(url), body:JSON.parse(String(init?.body))});
    return Response.json({statusCode:200, messages:'success', data:{id:'request-closure', transactionId:'transaction-closure', link:'https://testing.myr.id/pl/closure'}});
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.assign(config, originalConfig);
  setTestTokenVerifier(null);
});

const authHeaders = {Authorization:'Bearer closure-token', 'Content-Type':'application/json'};
const webhook = (body: any) => app.request('/api/webhooks/mayar', {
  method:'POST', headers:{'Content-Type':'application/json','x-callback-token':config.mayarWebhookSecret}, body:JSON.stringify(body)
});
const received = (event = 'payment.received') => ({event, data:{
  id:'transaction-closure', transactionId:'transaction-closure', productId:'request-closure', productType:'payment_request',
  amount:5439000, status:'SUCCESS', transactionStatus:event === 'payment.received' ? 'paid' : 'created'
}});

test('V2 checkout binds server price and provider references; official webhook settles only once', async () => {
  const before = Date.now();
  const res = await app.request('/api/billing/checkout', {method:'POST', headers:authHeaders,
    body:JSON.stringify({planId:'core', amount:1, organizationId:'other-org'})});
  assert.equal(res.status, 200);
  assert.equal(providerCalls[0].url, 'https://api.mayar.io/hl/v2/payments/create');
  assert.equal(providerCalls[0].body.amount, 5439000);
  assert.equal(providerCalls[0].body.mobile, '081234567890');
  assert.equal(providerCalls[0].body.redirectUrl, `${config.frontendOrigin}/payment/status`);
  assert.ok(Math.abs(Date.parse(providerCalls[0].body.expiredAt) - before - 86400000) < 5000);
  assert.equal(identity.checkoutSessions[0].organizationId, 'org-closure');
  assert.equal(identity.checkoutSessions[0].providerCheckoutId, 'transaction-closure');
  assert.notEqual((await identity.getSubscriptionByOrgId('org-closure'))?.status, 'ACTIVE');
  assert.equal((await webhook(received('payment.reminder'))).status, 200);
  const paid = await webhook(received());
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).result, 'PROCESSED');
  assert.equal((await identity.getSubscriptionByOrgId('org-closure'))?.status, 'ACTIVE');
  const duplicate = await webhook(received());
  assert.equal((await duplicate.json()).result, 'DUPLICATE');
  const changed = received(); changed.data.amount = 1;
  assert.equal((await webhook(changed)).status, 409);
});

test('incomplete or unsafe provider response never creates a canonical checkout', async () => {
  for (const data of [null, {}, {id:'r', transactionId:'t', link:'javascript:alert(1)'}, {id:'r', link:'https://testing.myr.id/pl/r'}]) {
    globalThis.fetch = async () => Response.json({statusCode:200, data});
    const res = await app.request('/api/billing/checkout', {method:'POST', headers:authHeaders, body:JSON.stringify({planId:'core'})});
    assert.equal(res.status, 400);
    assert.equal(identity.checkoutSessions.length, 0);
  }
});

test('provider errors do not expose raw provider bodies', async () => {
  globalThis.fetch = async () => new Response('secret-token customer@example.com', {status:502});
  const result = await MayarService.createCheckoutSession({planId:'core', customerName:'Budi', customerEmail:'budi@example.com', customerPhone:'081234567890'});
  assert.equal(result.success, false);
  assert.doesNotMatch(JSON.stringify(result), /secret-token|customer@example/);
});

test('profile validates phone/name and cannot edit another profile', async () => {
  identity.profiles.push({id:'someone-else', authUserId:'other-user', fullName:'Other', phone:'081111111111', status:'ACTIVE'});
  for (const body of [{phone:{}}, {phone:'abc'}, {phone:null}, {fullName:''}, {fullName:42}]) {
    const res = await app.request('/api/auth/profile', {method:'PATCH', headers:authHeaders, body:JSON.stringify(body)});
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const res = await app.request('/api/auth/profile', {method:'PATCH', headers:authHeaders,
    body:JSON.stringify({phone:'+62 812-3456-7890', profileId:'someone-else'})});
  assert.equal(res.status, 200);
  assert.equal(identity.profiles[0].phone, '+62 812-3456-7890');
  assert.equal(identity.profiles[1].phone, '081111111111');
});

test('invalid legacy phone prevents contacting the provider', async () => {
  identity.profiles[0].phone = 'invalid';
  const res = await app.request('/api/billing/checkout', {method:'POST', headers:authHeaders, body:JSON.stringify({planId:'core'})});
  assert.equal(res.status, 422);
  assert.equal(providerCalls.length, 0);
});

test('an unaffiliated authenticated user can complete phone before company onboarding', async () => {
  identity.memberships = [];
  const res = await app.request('/api/auth/profile', {method:'PATCH', headers:authHeaders, body:JSON.stringify({phone:'081234567890'})});
  assert.equal(res.status, 200);
});
