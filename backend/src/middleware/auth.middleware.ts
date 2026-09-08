// ============================================================================
// COVE Backend — Request-Scoped Authentication & RBAC Middleware (Gate P0-A)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §30
// ============================================================================

import type {Context, Next} from 'hono';
import {verifyToken} from '../lib/supabase.js';
import {db} from '../db/store.js';
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

  // 1. Resolve Profile
  const profile = db.profiles.find(p => p.authUserId === authUserId && p.status === 'ACTIVE');
  if (!profile) {
    return c.json({
      success: false,
      error: 'Profil pengguna tidak ditemukan atau akun dinonaktifkan.'
    }, 403);
  }

  // 2. Resolve Platform Admin Status & Grants (Strict Separation from Tenant Role)
  const platformAdmin = db.platformAdmins.find(
    pa => pa.authUserId === authUserId && pa.status === 'ACTIVE'
  );
  const isPlatformAdmin = !!platformAdmin;

  let platformGrants: PlatformRoleScope[] = [];
  if (platformAdmin) {
    platformGrants = db.platformRoleGrants
      .filter(g => g.adminId === platformAdmin.id && !g.revokedAt)
      .map(g => g.roleScope);
  }

  // 3. Resolve Active Organization Membership
  const membership = db.organizationMemberships.find(
    m => m.profileId === profile.id && m.status === 'ACTIVE'
  );
  if (!membership && !isPlatformAdmin) {
    return c.json({
      success: false,
      error: 'Pengguna tidak memiliki keanggotaan aktif pada organisasi tenant.'
    }, 403);
  }

  // 4. Construct Request-Scoped Actor
  const actor: RequestActor = {
    authUserId,
    profileId: profile.id,
    orgId: membership ? membership.orgId : '',
    membershipId: membership ? membership.id : '',
    role: membership ? membership.role : 'ADMIN',
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

  // Canonical Admin Audit Logging
  try {
    const adminRecord = db.platformAdmins.find(pa => pa.authUserId === actor.authUserId);
    db.adminAuditLogs.push({
      id: 'log-' + Date.now(),
      actorAdminId: adminRecord?.id,
      action: `${c.req.method} ${c.req.path}`,
      resource: 'ADMIN_CONSOLE',
      requestSource: c.req.header('user-agent') || 'api',
      correlationId: `req-${Date.now()}`,
      createdAt: new Date().toISOString()
    });
    db.save();
  } catch (err) {
    console.warn('Admin audit log failed:', err);
  }

  await next();
}
