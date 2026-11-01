process.env.NODE_ENV = 'test';

import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../src/app.js';
import {config} from '../src/config.js';

const canonicalOrigin = config.frontendOrigin;
const originalAllowed = config.frontendAllowedOrigins;
const branchOrigin = 'https://cove-git-p0c6-mayar-contract-sandbox-cepat.vercel.app';
const previewOrigin = 'https://cove-8ai4bk8r1-cepat.vercel.app';
const stableOrigin = 'https://cove-five-gamma.vercel.app';

beforeEach(() => {
  config.frontendOrigin = branchOrigin;
  config.frontendAllowedOrigins = [previewOrigin, stableOrigin];
});
afterEach(() => {
  config.frontendOrigin = canonicalOrigin;
  config.frontendAllowedOrigins = originalAllowed;
});

function preflight(origin: string) {
  return app.request('/api/auth/profile', {method:'OPTIONS', headers:{
    Origin:origin, 'Access-Control-Request-Method':'PATCH',
    'Access-Control-Request-Headers':'authorization,content-type,x-organization-id'
  }});
}

test('CORS allows the canonical frontend and both explicitly configured staging origins', async () => {
  for (const origin of [branchOrigin, previewOrigin, stableOrigin]) {
    const res = await preflight(origin);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
    assert.match(res.headers.get('access-control-allow-methods') || '', /PATCH/);
    assert.match(res.headers.get('access-control-allow-headers') || '', /Authorization/i);
    assert.match(res.headers.get('access-control-allow-headers') || '', /x-organization-id/i);
  }
});

test('CORS denies unconfigured and lookalike origins', async () => {
  for (const origin of ['https://untrusted.example', stableOrigin+'.evil.example', 'https://other-project.vercel.app']) {
    const res = await preflight(origin);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  }
});

test('allowed frontend receives COVE authentication errors without granting profile access', async () => {
  const res = await app.request('/api/auth/profile', {
    method:'PATCH', headers:{Origin:previewOrigin, 'Content-Type':'application/json'}, body:'{}'
  });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('access-control-allow-origin'), previewOrigin);
  assert.match((await res.json()).error, /Header Authorization Bearer tidak ditemukan/);
});
