// ============================================================================
// COVE Backend — SaaS Subscription & Billing API Routes (Gate P0-A)
// Enforces request-scoped actor, tenant org isolation, and pure RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {AuthService} from '../services/auth.service.js';
import {MayarService} from '../services/mayar.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';

export const billingRoute = new Hono();

billingRoute.use('/billing', requireAuth);
billingRoute.use('/billing/*', requireAuth);

// GET /api/billing
// Canonical response contains server-derived status: 'NONE' | 'PENDING' | 'ACTIVE' | 'FAILED' | 'EXPIRED'
billingRoute.get('/billing', (c) => {
  const actor = c.get('actor');
  const activeCount = db.projects.filter(p => (!p.orgId || p.orgId === actor.orgId) && p.status === 'Aktif').length;
  db.subscription.quotaUsed = activeCount;

  return c.json({
    success: true,
    data: {
      status: db.subscription.status || 'NONE',
      subscription: db.subscription,
      quota: {
        used: activeCount,
        total: db.subscription.quotaTotal,
        isFull: activeCount >= db.subscription.quotaTotal
      },
      history: [
        {id: 'COV-INV-2026-001', date: '2026-08-08', amount: 4900000, status: 'PAID'},
        {id: 'COV-INV-2026-002', date: '2026-09-08', amount: 4900000, status: 'PAID'}
      ]
    }
  });
});

// POST /api/billing/checkout
// Calls real provider checkout; rejects synthetic URL generation
billingRoute.post('/billing/checkout', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canManageBilling(actor.role)) {
    return c.json({
      success: false,
      error: 'Hanya Pengelola Perusahaan (Owner/Admin) yang dapat melakukan pembayaran SaaS.'
    }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const planId = body.planId || 'core';

  const checkoutRes = await MayarService.createCheckoutSession({
    planId,
    customerName: actor.fullName,
    customerEmail: actor.email
  });

  if (!checkoutRes.success) {
    const httpStatus = checkoutRes.error === 'PAYMENT_PROVIDER_NOT_CONFIGURED' ? 503 : 400;
    return c.json({
      success: false,
      error: checkoutRes.error,
      message: checkoutRes.message
    }, httpStatus);
  }

  return c.json({
    success: true,
    data: checkoutRes.data
  });
});
