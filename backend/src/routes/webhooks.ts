// ============================================================================
// COVE Backend — Webhook Ingestion Endpoints (Gate P0-A, P0-C.1, P0-C.1.1)
// Enforces cryptographic constant-time comparison on x-callback-token,
// single-read raw request body SHA-256 fingerprinting, strict event ID validation,
// and conflict detection.
// ============================================================================

import {Hono} from 'hono';
import crypto from 'node:crypto';
import {MayarService} from '../services/mayar.service.js';
import {config} from '../config.js';

export const webhooksRoute = new Hono();

// POST /api/webhooks/mayar
webhooksRoute.post('/webhooks/mayar', async (c) => {
  const token = c.req.header('x-callback-token');
  const secret = config.mayarWebhookSecret;

  // 1. Fail-closed check: server webhook secret must be configured
  if (!secret) {
    return c.json({
      success: false,
      error: 'Server configuration error: Mayar webhook secret is not configured.'
    }, 500);
  }

  // 2. Missing callback token check
  if (!token) {
    return c.json({
      success: false,
      error: 'Unauthorized: missing webhook callback token.'
    }, 401);
  }

  // 3. Cryptographic constant-time comparison using fixed 32-byte SHA-256 digests
  // Eliminates token-length timing side-channels
  const tokenHash = crypto.createHash('sha256').update(token, 'utf-8').digest();
  const secretHash = crypto.createHash('sha256').update(secret, 'utf-8').digest();

  if (!crypto.timingSafeEqual(tokenHash, secretHash)) {
    return c.json({
      success: false,
      error: 'Unauthorized: invalid webhook callback token.'
    }, 401);
  }

  // 4. Single-read raw request body bytes for transport-integrity fingerprinting
  const rawBody = await c.req.text().catch(() => '');
  const payloadHash = crypto.createHash('sha256').update(rawBody, 'utf-8').digest('hex');

  // 5. Parse JSON once from raw body
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({
      success: false,
      error: 'Payload webhook tidak valid: format JSON malformed.'
    }, 400);
  }

  // 6. Strict validation of payload structure and external event ID at route boundary
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({
      success: false,
      error: 'Payload webhook tidak valid: format bukan JSON object.'
    }, 400);
  }

  if (typeof body.event !== 'string' || !body.event.trim()) {
    return c.json({
      success: false,
      error: 'Payload webhook tidak valid: field event harus berupa string non-kosong.'
    }, 400);
  }

  if (typeof body.id !== 'string' || !body.id.trim()) {
    return c.json({
      success: false,
      error: 'Payload webhook tidak valid: field id harus berupa string non-kosong.'
    }, 400);
  }

  // 7. Process webhook with raw payload hash
  const result = await MayarService.handleWebhook(body, payloadHash).catch((err: Error) => {
    // Persistence failure — return 5xx so provider (Mayar) can retry
    return null;
  });

  if (!result) {
    return c.json({
      success: false,
      error: 'Gagal memproses settlement. Entitlement persistence gagal — silakan retry.'
    }, 500);
  }

  if (result.status === 'CONFLICT') {
    return c.json({
      success: false,
      result: 'CONFLICT',
      error: 'Conflicting webhook payload detected for existing event ID.'
    }, 409);
  }

  if (result.status === 'ERROR') {
    return c.json({
      success: false,
      error: result.message
    }, 400);
  }

  return c.json({
    success: true,
    result: result.status,
    message: result.message
  });
});
