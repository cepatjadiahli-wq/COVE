// ============================================================================
// COVE Backend — SaaS Subscription & Billing API Routes (Gate P0-A.3)
// Enforces request-scoped actor, fail-closed tenant org isolation, and RBAC checks.
// Canonical subscription authority lives in PostgreSQL / Supabase per-tenant.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {AuthService} from '../services/auth.service.js';
import {MayarService} from '../services/mayar.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {getIdentityRepository} from '../repositories/identity.repository.js';
import {getProjectRepository} from '../repositories/project.repository.js';
import type {CheckoutSessionEntity} from '../types/domain.js';

export const billingRoute = new Hono();

billingRoute.use('/billing', requireAuth);
billingRoute.use('/billing/*', requireAuth);

// GET /api/billing
// Canonical response contains server-derived status per tenant organization
billingRoute.get('/billing', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({
      success: true,
      data: {
        status: 'NONE',
        subscription: null,
        quota: { used: 0, total: 0, isFull: true },
        history: []
      }
    });
  }

  const identityRepo = getIdentityRepository();
  const sub = await identityRepo.getSubscriptionByOrgId(actor.orgId);
  const repoProjects = await getProjectRepository().getProjectsByOrgId(actor.orgId, { archived: false }).catch(() => []);
  const activeCount = repoProjects.length || db.projects.filter(p => p.orgId === actor.orgId && p.status === 'Aktif').length;

  const quotaTotal = sub?.quotaTotal || (sub?.plan === 'scale' ? 25 : sub?.plan === 'pilot' ? 10 : sub?.plan === 'core' ? 5 : 3);
  
  // Status mapping compliant with domain invariants:
  // 'NONE' | 'PENDING' | 'ACTIVE' | 'FAILED' | 'EXPIRED'
  let clientStatus: string = 'NONE';
  if (sub) {
    if (sub.status === 'ACTIVE') clientStatus = 'ACTIVE';
    else if (sub.status === 'PENDING') clientStatus = 'PENDING';
    else if (sub.status === 'EXPIRED' || sub.status === 'CANCELLED' || sub.status === 'CANCELED') clientStatus = 'EXPIRED';
    else if (sub.status === 'PAST_DUE') clientStatus = 'FAILED';
    else clientStatus = 'NONE';
  }

  return c.json({
    success: true,
    data: {
      status: clientStatus,
      subscription: sub ? {
        id: sub.id,
        planId: sub.plan || sub.planId || 'core',
        planName: (sub.plan || sub.planId || 'core').charAt(0).toUpperCase() + (sub.plan || sub.planId || 'core').slice(1),
        status: sub.status,
        quotaUsed: activeCount,
        quotaTotal,
        periodStart: sub.currentPeriodStart || '2026-09-08',
        periodEnd: sub.currentPeriodEnd || '2026-10-08',
        amount: (sub.plan || sub.planId) === 'scale' ? 9900000 : (sub.plan || sub.planId) === 'pilot' ? 7500000 : 4900000
      } : {
        id: '',
        planId: 'free',
        planName: 'None',
        status: 'INACTIVE',
        quotaUsed: activeCount,
        quotaTotal: 0,
        periodStart: '',
        periodEnd: '',
        amount: 0
      },
      quota: {
        used: activeCount,
        total: quotaTotal,
        isFull: activeCount >= quotaTotal
      },
      history: []
    }
  });
});

// POST /api/billing/checkout
// Calls real provider checkout; binds session to actor.orgId; records in checkout_sessions
billingRoute.post('/billing/checkout', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
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
    customerEmail: actor.email,
    organizationId: actor.orgId
  });

  if (!checkoutRes.success) {
    const httpStatus = checkoutRes.error === 'PAYMENT_PROVIDER_NOT_CONFIGURED' ? 503 : 400;
    return c.json({
      success: false,
      error: checkoutRes.error,
      message: checkoutRes.message
    }, httpStatus);
  }

  // Record canonical checkout session bound strictly to tenant organization
  if (checkoutRes.data) {
    const identityRepo = getIdentityRepository();
    const sessionRecord: CheckoutSessionEntity = {
      id: 'cs-' + Date.now(),
      organizationId: actor.orgId,
      provider: 'MAYAR',
      providerReference: checkoutRes.data.checkoutRef,
      providerCheckoutId: checkoutRes.data.checkoutRef,
      status: 'PENDING',
      plan: planId,
      amount: checkoutRes.data.total,
      currency: 'IDR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await identityRepo.createCheckoutSession(sessionRecord);
  }

  return c.json({
    success: true,
    data: checkoutRes.data
  });
});
