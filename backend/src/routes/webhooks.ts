// ============================================================================
// COVE Backend — Webhook Ingestion Endpoints (Gate P0-A, P0-07)
// Enforces cryptographic constant-time comparison on x-callback-token.
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

  if (!token || !secret) {
    return c.json({
      success: false,
      error: 'Unauthorized: missing webhook callback token or secret.'
    }, 401);
  }

  const tokenBuffer = Buffer.from(token, 'utf-8');
  const secretBuffer = Buffer.from(secret, 'utf-8');

  // Constant-time comparison with length check
  if (tokenBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(tokenBuffer, secretBuffer)) {
    return c.json({
      success: false,
      error: 'Unauthorized: invalid webhook callback token.'
    }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || !body.event) {
    return c.json({success: false, error: 'Payload webhook tidak valid.'}, 400);
  }

  const result = await MayarService.handleWebhook(body).catch((err: Error) => {
    // Persistence failure — return 5xx so provider (Mayar) can retry
    return null;
  });

  if (!result) {
    return c.json({
      success: false,
      error: 'Gagal memproses settlement. Entitlement persistence gagal — silakan retry.'
    }, 500);
  }

  return c.json({
    success: true,
    result: result.status,
    message: result.message
  });
});
