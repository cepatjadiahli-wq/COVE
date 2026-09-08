// ============================================================================
// COVE Backend — Authentication & Current Session Endpoints (Gate P0-A)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, SR-017
// Removed prototype login and switch-role. All identity flows via Supabase Auth.
// ============================================================================

import {Hono} from 'hono';
import {requireAuth} from '../middleware/auth.middleware.js';
import {AuthService} from '../services/auth.service.js';
import {getIdentityRepository} from '../repositories/identity.repository.js';

export const authRoute = new Hono();

// GET /api/auth/me
// Returns verified session actor, organization info, and role permissions.
// No fake company fallback; resolves organization from canonical repository.
authRoute.get('/auth/me', requireAuth, async (c) => {
  const actor = c.get('actor');
  const identityRepo = getIdentityRepository();
  const org = actor.orgId ? await identityRepo.getOrganizationById(actor.orgId) : null;

  return c.json({
    success: true,
    data: {
      actor,
      user: {
        id: actor.profileId,
        authUserId: actor.authUserId,
        name: actor.fullName,
        email: actor.email,
        orgId: actor.orgId,
        company: org ? (org.displayName || org.legalName) : '',
        role: actor.role,
        isPlatformAdmin: actor.isPlatformAdmin
      },
      organization: org || null,
      permissions: {
        canWrite: AuthService.canWrite(actor.role),
        canManageFinance: AuthService.canManageFinance(actor.role),
        canManageCommercial: AuthService.canManageCommercial(actor.role),
        canManageBilling: AuthService.canManageBilling(actor.role),
        canManageUsers: AuthService.canManageUsers(actor.role)
      }
    }
  });
});

// POST /api/organizations
// Creates a new organization for an authenticated actor and assigns OWNER role.
authRoute.post('/organizations', requireAuth, async (c) => {
  const actor = c.get('actor');
  if (!actor || !actor.profileId) {
    return c.json({
      success: false,
      error: 'Profil pengguna tidak teridentifikasi.'
    }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const legalName = (body.legalName || '').trim();
  const displayName = (body.displayName || legalName).trim();

  if (!legalName) {
    return c.json({
      success: false,
      error: 'Nama legal perusahaan wajib diisi.'
    }, 400);
  }

  const identityRepo = getIdentityRepository();
  try {
    const result = await identityRepo.createOrganizationForProfile(actor.profileId, {
      legalName,
      displayName
    });

    return c.json({
      success: true,
      data: result
    }, 201);
  } catch (err: any) {
    console.error('Failed to create organization:', err);
    return c.json({
      success: false,
      error: err.message || 'Gagal membuat organisasi di basis data.'
    }, 500);
  }
});
