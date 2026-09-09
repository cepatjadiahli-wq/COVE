// ============================================================================
// COVE Backend — Request-Scoped Authentication & RBAC Middleware (Gate P0-A.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §30
// Replaces JSON store lookup with canonical PostgreSQL IdentityRepository.
// ============================================================================

import type {Context, Next} from 'hono';
import {verifyToken} from '../lib/supabase.js';
import {getIdentityRepository} from '../repositories/identity.repository.js';
import type {RequestActor, PlatformRoleScope} from '../types/domain.js';

// Extend Hono Context type
declare module 'hono' {
  interface ContextVariableMap {
    actor: RequestActor;
  }
}

/**
 * Global/Route Middleware: Require Valid Authenticated Session
 * Resolves request-scoped actor from verified Supabase JWT Bearer token.
 * Queries canonical PostgreSQL tables via IdentityRepository.
 * Never trusts client headers/body/query for identity or organization.
 */
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: 'Autentikasi diperlukan. Header Authorization Bearer tidak ditemukan.'
    }, 401);
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return c.json({
      success: false,
      error: 'Token otentikasi kosong.'
    }, 401);
  }

  // Authoritative token verification
  const verification = await verifyToken(token);
  if (verification.error || !verification.user) {
    return c.json({
      success: false,
      error: verification.error || 'Token otentikasi tidak valid atau sudah kedaluwarsa.'
    }, 401);
  }

  const authUserId = verification.user.id;
  const identityRepo = getIdentityRepository();

  // 1. Resolve Profile from PostgreSQL (Bootstrap automatically if fresh user)
  let profile = await identityRepo.findProfileByAuthUserId(authUserId);
  if (!profile) {
    profile = await identityRepo.ensureProfileForAuthUser(
      authUserId,
      verification.user.email || 'user@cove.id',
      (verification.user as any)?.user_metadata?.full_name || (verification.user as any)?.user_metadata?.name || verification.user.email?.split('@')[0] || 'Pengguna COVE'
    );
  }
  if (!profile) {
    return c.json({
      success: false,
      error: 'Profil pengguna tidak ditemukan atau akun dinonaktifkan.'
    }, 403);
  }

  // 2. Resolve Platform Admin Status & Grants from PostgreSQL (Strict Separation)
  const platformAdmin = await identityRepo.getPlatformAdminByAuthUserId(authUserId);
  const isPlatformAdmin = !!platformAdmin;

  let platformGrants: PlatformRoleScope[] = [];
  if (platformAdmin) {
    platformGrants = await identityRepo.getPlatformRoleGrants(platformAdmin.id);
  }

  // 3. Resolve Active Organization Memberships from PostgreSQL (Deterministic Strategy)
  const activeMemberships = await identityRepo.getActiveMembershipsByProfileId(profile.id);

  let selectedMembership: (typeof activeMemberships)[0] | null = null;
  if (activeMemberships.length === 0) {
    if (!isPlatformAdmin) {
      // Allow onboarding and identity discovery routes for authenticated users who have not yet created/joined an organization
      const isIdentityOrOnboardingRoute = c.req.path === '/api/auth/me' || c.req.path === '/api/organizations' || c.req.path === '/api/auth/profile' || c.req.path === '/api/auth/tenant-options';
      if (!isIdentityOrOnboardingRoute) {
        return c.json({
          success: false,
          error: 'Pengguna tidak memiliki keanggotaan aktif pada organisasi tenant.'
        }, 403);
      }
    }
    // Platform admin without tenant membership or user completing onboarding
    selectedMembership = null;
  } else if (activeMemberships.length === 1) {
    const requestedOrgId = c.req.header('x-organization-id');
    if (requestedOrgId && requestedOrgId !== activeMemberships[0].orgId) {
      return c.json({
        success: false,
        error: 'Akses ditolak: Pengguna bukan anggota aktif dari organisasi yang diminta.'
      }, 403);
    }
    selectedMembership = activeMemberships[0];
  } else {
    // Multi-membership: >1 active memberships requires explicit valid tenant selection
    const requestedOrgId = c.req.header('x-organization-id');
    if (!requestedOrgId) {
      const isIdentityRoute = c.req.path === '/api/auth/me' || c.req.path === '/api/auth/tenant-options' || c.req.path === '/api/organizations';
      if (isIdentityRoute) {
        selectedMembership = null;
      } else {
        return c.json({
          success: false,
          code: 'TENANT_SELECTION_REQUIRED',
          error: 'Multi-organisasi terdeteksi. Silakan tentukan organisasi aktif melalui header x-organization-id.'
        }, 400);
      }
    } else {
      const match = activeMemberships.find(m => m.orgId === requestedOrgId);
      if (!match) {
        return c.json({
          success: false,
          error: 'Akses ditolak: Pengguna bukan anggota aktif dari organisasi yang diminta.'
        }, 403);
      }
      selectedMembership = match;
    }
  }

  // 4. Construct Request-Scoped Actor
  const actor: RequestActor = {
    authUserId,
    profileId: profile.id,
    orgId: selectedMembership ? selectedMembership.orgId : null,
    membershipId: selectedMembership ? selectedMembership.id : null,
    role: selectedMembership ? selectedMembership.role : null,
    fullName: profile.fullName,
    email: verification.user.email,
    isPlatformAdmin,
    platformGrants
  };

  c.set('actor', actor);
  await next();
}

/**
 * Admin Middleware: Require Valid Platform Administrator Identity
 * Tenant OWNER alone is strictly FORBIDDEN (HTTP 403).
 */
export async function requirePlatformAdmin(c: Context, next: Next) {
  // Ensure authenticated actor is resolved
  let actor = c.get('actor');
  if (!actor) {
    const res = await requireAuth(c, async () => {});
    if (res) return res;
    actor = c.get('actor');
    if (!actor) return; // requireAuth already returned 401/403
  }

  if (!actor.isPlatformAdmin) {
    return c.json({
      success: false,
      error: 'Akses ditolak: Hanya Platform Administrator yang memiliki wewenang mengakses area internal COVE.'
    }, 403);
  }

  // Canonical Admin Audit Logging to PostgreSQL admin_audit_logs
  const isMutating = c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.method !== 'OPTIONS';
  try {
    const identityRepo = getIdentityRepository();
    const adminRecord = await identityRepo.getPlatformAdminByAuthUserId(actor.authUserId);
    await identityRepo.recordAdminAuditLog({
      actorAdminId: adminRecord?.id,
      action: `${c.req.method} ${c.req.path}`,
      resource: 'ADMIN_CONSOLE',
      requestSource: c.req.header('user-agent') || 'api',
      correlationId: `req-${Date.now()}`
    });
  } catch (err: any) {
    if (isMutating) {
      return c.json({
        success: false,
        error: 'Operasi mutasi admin dibatalkan: Kegagalan pencatatan audit trail (Fail-Closed Enforcement).'
      }, 500);
    }
    console.warn('Admin audit log failed for read-only route:', err);
  }

  await next();
}
