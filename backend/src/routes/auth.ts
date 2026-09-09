// ============================================================================
// COVE Backend — Authentication & Current Session Endpoints (Gate P0-A.3)
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
// If user belongs to multiple organizations and no x-organization-id is sent,
// returns tenantSelectionRequired: true with tenantOptions without blocking authentication.
authRoute.get('/auth/me', requireAuth, async (c) => {
  const actor = c.get('actor');
  const identityRepo = getIdentityRepository();
  const org = actor.orgId ? await identityRepo.getOrganizationById(actor.orgId) : null;

  // Resolve all active memberships for this profile to support multi-tenant switching
  const memberships = await identityRepo.getActiveMembershipsByProfileId(actor.profileId);
  const tenantOptions = await Promise.all(
    memberships.map(async (m) => {
      const o = await identityRepo.getOrganizationById(m.orgId);
      return {
        orgId: m.orgId,
        membershipId: m.id,
        role: m.role,
        legalName: o?.legalName || m.orgId,
        displayName: o?.displayName || o?.legalName || m.orgId
      };
    })
  );

  const tenantSelectionRequired = memberships.length > 1 && !actor.orgId;

  return c.json({
    success: true,
    data: {
      actor,
      tenantSelectionRequired,
      tenantOptions,
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

// GET /api/auth/tenant-options
authRoute.get('/auth/tenant-options', requireAuth, async (c) => {
  const actor = c.get('actor');
  const identityRepo = getIdentityRepository();
  const memberships = await identityRepo.getActiveMembershipsByProfileId(actor.profileId);
  const options = await Promise.all(
    memberships.map(async (m) => {
      const o = await identityRepo.getOrganizationById(m.orgId);
      return {
        orgId: m.orgId,
        membershipId: m.id,
        role: m.role,
        legalName: o?.legalName || m.orgId,
        displayName: o?.displayName || o?.legalName || m.orgId
      };
    })
  );

  return c.json({
    success: true,
    data: {
      currentOrgId: actor.orgId,
      options
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

// PATCH /api/organizations/:id
// Updates organization profile (legalName, displayName, etc.)
// Enforces that actor belongs to this organization with OWNER or ADMIN role.
authRoute.patch('/organizations/:id', requireAuth, async (c) => {
  const actor = c.get('actor');
  const orgId = c.req.param('id');

  if (!actor.orgId || actor.orgId !== orgId) {
    return c.json({
      success: false,
      error: 'Akses ditolak: Anda tidak memiliki wewenang pada organisasi ini.'
    }, 403);
  }

  if (actor.role !== 'OWNER' && actor.role !== 'ADMIN') {
    return c.json({
      success: false,
      error: 'Hanya OWNER atau ADMIN yang berwenang mengubah informasi perusahaan.'
    }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const identityRepo = getIdentityRepository();
  try {
    const updated = await identityRepo.updateOrganization(orgId, {
      legalName: body.legalName?.trim(),
      displayName: body.displayName?.trim()
    });

    return c.json({
      success: true,
      data: updated
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: err.message || 'Gagal memperbarui data organisasi.'
    }, 500);
  }
});
