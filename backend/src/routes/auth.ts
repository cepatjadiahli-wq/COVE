// ============================================================================
// COVE Backend — Authentication & Current Session Endpoints (Gate P0-A)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, SR-017
// Removed prototype login and switch-role. All identity flows via Supabase Auth.
// ============================================================================

import {Hono} from 'hono';
import {requireAuth} from '../middleware/auth.middleware.js';
import {AuthService} from '../services/auth.service.js';
import {db} from '../db/store.js';

export const authRoute = new Hono();

// GET /api/auth/me
// Returns verified session actor, organization info, and role permissions.
authRoute.get('/auth/me', requireAuth, (c) => {
  const actor = c.get('actor');
  const org = db.organizations.find(o => o.id === actor.orgId);

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
        company: org?.legalName || 'PT Ruang Karya Konstruksi',
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
