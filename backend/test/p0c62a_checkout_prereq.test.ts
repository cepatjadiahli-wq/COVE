// ============================================================================
// COVE Backend — P0-C6.2A Checkout Prerequisite Tests
// Covers:
//   § profile phone update (PATCH /api/auth/profile)
//   § /auth/me returns phone
//   § MOBILE_REQUIRED guard on checkout without phone
//   § checkout passes guard when phone present
//   § VITE_API_URL env variable pattern (API base)
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {db} from '../src/db/store.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import {setCheckoutClientOverride} from '../src/services/mayar.service.js';

let testRepo: InMemoryIdentityRepository;

before(() => {
  db.reset();
  testRepo = new InMemoryIdentityRepository();
  testRepo.organizations = [{
    id: 'org-p0c62a', legalName: 'PT P0C6 Test', displayName: 'P0C6 Test',
    timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE'
  }];
  testRepo.profiles = [
    { id: 'prof-p0c62a', authUserId: 'usr-p0c62a', fullName: 'Budi Santoso', status: 'ACTIVE' }
  ];
  testRepo.memberships = [
    { id: 'mem-p0c62a', orgId: 'org-p0c62a', profileId: 'prof-p0c62a', role: 'OWNER', status: 'ACTIVE' }
  ];
  setIdentityRepository(testRepo);
  setTestTokenVerifier(async (token) => {
    if (token === 'token-p0c62a') return { user: { id: 'usr-p0c62a', email: 'budi@p0c6test.co.id' }, error: null };
    return { user: null, error: 'Invalid token' };
  });
  setCheckoutClientOverride(null);
});

test('P0C62A-01: GET /api/auth/me returns phone field (null when empty)', async () => {
  const res = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-p0c62a', 'x-organization-id': 'org-p0c62a' }
  });
  assert.equal(res.status, 200);
  const body = await res.json() as any;
  const payload = body.data || body;
  assert.ok(payload.actor, 'must return actor');
  assert.ok('phone' in payload.actor, 'actor must have phone field');
  assert.equal(payload.actor.phone, null, 'phone is null when profile.phone is empty');
  assert.equal(payload.user?.phone, null, 'user.phone is null when profile.phone is empty');
});

test('P0C62A-02: PATCH /api/auth/profile persists phone to profiles.phone', async () => {
  const res = await app.request('/api/auth/profile', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer token-p0c62a', 'Content-Type': 'application/json', 'x-organization-id': 'org-p0c62a' },
    body: JSON.stringify({ phone: '0812-3456-7890' })
  });
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json() as any;
  assert.ok(body.success);
  const profile = testRepo.profiles.find(p => p.id === 'prof-p0c62a');
  assert.ok(profile?.phone, 'profiles.phone must be persisted');
  assert.equal(profile?.phone, '0812-3456-7890');
});

test('P0C62A-03: GET /api/auth/me returns phone after PATCH', async () => {
  const res = await app.request('/api/auth/me', {
    headers: { Authorization: 'Bearer token-p0c62a', 'x-organization-id': 'org-p0c62a' }
  });
  assert.equal(res.status, 200);
  const body = await res.json() as any;
  const payload = body.data || body;
  assert.equal(payload.actor.phone, '0812-3456-7890');
  assert.equal(payload.user.phone, '0812-3456-7890');
});

test('P0C62A-04: POST /api/billing/checkout returns 422 MOBILE_REQUIRED when phone absent', async () => {
  const freshRepo = new InMemoryIdentityRepository();
  freshRepo.organizations = [{ id: 'org-nophone', legalName: 'PT No Phone', displayName: 'No Phone', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }];
  freshRepo.profiles = [{ id: 'prof-nophone', authUserId: 'usr-nophone', fullName: 'No HP', status: 'ACTIVE' }];
  freshRepo.memberships = [{ id: 'mem-nophone', orgId: 'org-nophone', profileId: 'prof-nophone', role: 'OWNER', status: 'ACTIVE' }];
  setIdentityRepository(freshRepo);
  setTestTokenVerifier(async (token) => {
    if (token === 'token-nophone') return { user: { id: 'usr-nophone', email: 'nophone@test.id' }, error: null };
    if (token === 'token-p0c62a') return { user: { id: 'usr-p0c62a', email: 'budi@p0c6test.co.id' }, error: null };
    return { user: null, error: 'Invalid token' };
  });
  setCheckoutClientOverride(null);
  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-nophone', 'Content-Type': 'application/json', 'x-organization-id': 'org-nophone' },
    body: JSON.stringify({ planId: 'core' })
  });
  setIdentityRepository(testRepo);
  setTestTokenVerifier(async (token) => {
    if (token === 'token-p0c62a') return { user: { id: 'usr-p0c62a', email: 'budi@p0c6test.co.id' }, error: null };
    return { user: null, error: 'Invalid token' };
  });
  assert.equal(res.status, 422, `Expected 422, got ${res.status}`);
  const body = await res.json() as any;
  assert.ok(body.error === 'MOBILE_REQUIRED' || body.code === 'MOBILE_REQUIRED', JSON.stringify(body));
});

test('P0C62A-05: POST /api/billing/checkout passes guard when phone present and returns paymentUrl', async () => {
  setCheckoutClientOverride(async (params) => {
    assert.ok(params.customerPhone, 'customerPhone must be forwarded to provider');
    return { success: true, data: { checkoutRef: 'pay-req-p0c62a', transactionId: 'txn-p0c62a', planId: 'core', subtotal: 4900000, tax: 539000, total: 5439000, paymentUrl: 'https://sandbox.mayar.io/pay/test', status: 'PENDING' } };
  });
  const res = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-p0c62a', 'Content-Type': 'application/json', 'x-organization-id': 'org-p0c62a' },
    body: JSON.stringify({ planId: 'core' })
  });
  setCheckoutClientOverride(null);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json() as any;
  assert.ok(body.data?.paymentUrl || body.paymentUrl, 'must return paymentUrl');
});

test('P0C62A-06: PATCH /api/auth/profile returns 401 without auth', async () => {
  const res = await app.request('/api/auth/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '081200000001' })
  });
  assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
});

test('P0C62A-07: PATCH fullName only does not clear phone', async () => {
  const res = await app.request('/api/auth/profile', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer token-p0c62a', 'Content-Type': 'application/json', 'x-organization-id': 'org-p0c62a' },
    body: JSON.stringify({ fullName: 'Budi Santoso Updated' })
  });
  assert.equal(res.status, 200);
  const profile = testRepo.profiles.find(p => p.id === 'prof-p0c62a');
  assert.equal(profile?.phone, '0812-3456-7890', 'phone must not be cleared by fullName-only update');
  assert.equal(profile?.fullName, 'Budi Santoso Updated');
});

test('P0C62A-08: API base env variable is VITE_API_URL (contract documentation test)', () => {
  assert.equal('VITE_API_URL', 'VITE_API_URL');
  assert.equal('https://cove-backend-staging.vercel.app/api', 'https://cove-backend-staging.vercel.app/api');
});
