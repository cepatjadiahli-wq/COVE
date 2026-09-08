// ============================================================================
// COVE Backend — Canonical Identity & Access Repository (Gate P0-A.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §30
// Replaces direct JSON store access for identity, memberships, platform admins, and audit logs.
// ============================================================================

import type {
  ProfileEntity,
  OrganizationEntity,
  OrganizationMembershipEntity,
  PlatformAdminRecord,
  PlatformRoleScope,
  AdminAuditLogRecord
} from '../types/domain.js';
import {pgPool} from '../db/store.js';

export interface MembershipWithOrganization extends OrganizationMembershipEntity {
  organizationName?: string;
}

export interface IIdentityRepository {
  findProfileByAuthUserId(authUserId: string): Promise<ProfileEntity | null>;
  getActiveMembershipsByProfileId(profileId: string): Promise<MembershipWithOrganization[]>;
  getOrganizationById(orgId: string): Promise<OrganizationEntity | null>;
  getPlatformAdminByAuthUserId(authUserId: string): Promise<PlatformAdminRecord | null>;
  getPlatformRoleGrants(adminId: string): Promise<PlatformRoleScope[]>;
  createOrganizationForProfile(
    profileId: string,
    data: { legalName: string; displayName?: string }
  ): Promise<{ organization: OrganizationEntity; membership: OrganizationMembershipEntity }>;
  recordAdminAuditLog(log: {
    actorAdminId?: string;
    action: string;
    resource: string;
    beforeState?: any;
    afterState?: any;
    reason?: string;
    correlationId?: string;
    requestSource?: string;
  }): Promise<void>;
}

/**
 * PostgreSQL Implementation of Identity Repository
 * Connects directly to canonical PostgreSQL / Supabase tables.
 */
export class PostgresIdentityRepository implements IIdentityRepository {
  public async findProfileByAuthUserId(authUserId: string): Promise<ProfileEntity | null> {
    const query = `
      SELECT id, auth_user_id AS "authUserId", full_name AS "fullName", phone, status, created_at AS "createdAt"
      FROM public.profiles
      WHERE auth_user_id = $1 AND status = 'ACTIVE'
      LIMIT 1
    `;
    const res = await pgPool.query(query, [authUserId]);
    return res.rows[0] || null;
  }

  public async getActiveMembershipsByProfileId(profileId: string): Promise<MembershipWithOrganization[]> {
    const query = `
      SELECT 
        om.id, 
        om.org_id AS "orgId", 
        om.profile_id AS "profileId", 
        om.role, 
        om.status, 
        o.display_name AS "organizationName"
      FROM public.organization_memberships om
      JOIN public.organizations o ON o.id = om.org_id
      WHERE om.profile_id = $1 AND om.status = 'ACTIVE'
      ORDER BY om.joined_at ASC
    `;
    const res = await pgPool.query(query, [profileId]);
    return res.rows;
  }

  public async getOrganizationById(orgId: string): Promise<OrganizationEntity | null> {
    const query = `
      SELECT 
        id, 
        legal_name AS "legalName", 
        display_name AS "displayName", 
        timezone, 
        default_currency AS "defaultCurrency", 
        status, 
        created_at AS "createdAt"
      FROM public.organizations
      WHERE id = $1 AND status = 'ACTIVE'
      LIMIT 1
    `;
    const res = await pgPool.query(query, [orgId]);
    return res.rows[0] || null;
  }

  public async getPlatformAdminByAuthUserId(authUserId: string): Promise<PlatformAdminRecord | null> {
    const query = `
      SELECT id, auth_user_id AS "authUserId", status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM public.platform_admins
      WHERE auth_user_id = $1 AND status = 'ACTIVE'
      LIMIT 1
    `;
    const res = await pgPool.query(query, [authUserId]);
    return res.rows[0] || null;
  }

  public async getPlatformRoleGrants(adminId: string): Promise<PlatformRoleScope[]> {
    const query = `
      SELECT role_scope AS "roleScope"
      FROM public.platform_role_grants
      WHERE admin_id = $1 AND revoked_at IS NULL
    `;
    const res = await pgPool.query(query, [adminId]);
    return res.rows.map(r => r.roleScope);
  }

  public async recordAdminAuditLog(log: {
    actorAdminId?: string;
    action: string;
    resource: string;
    beforeState?: any;
    afterState?: any;
    reason?: string;
    correlationId?: string;
    requestSource?: string;
  }): Promise<void> {
    const query = `
      INSERT INTO public.admin_audit_logs (
        actor_admin_id, action, resource, before_state, after_state, reason, correlation_id, request_source, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;
    await pgPool.query(query, [
      log.actorAdminId || null,
      log.action,
      log.resource,
      log.beforeState ? JSON.stringify(log.beforeState) : null,
      log.afterState ? JSON.stringify(log.afterState) : null,
      log.reason || null,
      log.correlationId || null,
      log.requestSource || 'api'
    ]);
  }

  public async createOrganizationForProfile(
    profileId: string,
    data: { legalName: string; displayName?: string }
  ): Promise<{ organization: OrganizationEntity; membership: OrganizationMembershipEntity }> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const orgRes = await client.query(`
        INSERT INTO public.organizations (legal_name, display_name, status)
        VALUES ($1, $2, 'ACTIVE')
        RETURNING id, legal_name AS "legalName", display_name AS "displayName", timezone, default_currency AS "defaultCurrency", status, created_at AS "createdAt"
      `, [data.legalName, data.displayName || data.legalName]);
      const organization: OrganizationEntity = orgRes.rows[0];

      const memRes = await client.query(`
        INSERT INTO public.organization_memberships (org_id, profile_id, role, status)
        VALUES ($1, $2, 'OWNER', 'ACTIVE')
        RETURNING id, org_id AS "orgId", profile_id AS "profileId", role, status, joined_at AS "joinedAt"
      `, [organization.id, profileId]);
      const membership: OrganizationMembershipEntity = memRes.rows[0];

      await client.query('COMMIT');
      return { organization, membership };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

/**
 * In-Memory Implementation for isolated tests
 */
export class InMemoryIdentityRepository implements IIdentityRepository {
  public profiles: ProfileEntity[] = [];
  public organizations: OrganizationEntity[] = [];
  public memberships: OrganizationMembershipEntity[] = [];
  public platformAdmins: PlatformAdminRecord[] = [];
  public platformRoleGrants: Array<{ id: string; adminId: string; roleScope: PlatformRoleScope; revokedAt?: string | null }> = [];
  public adminAuditLogs: Array<AdminAuditLogRecord> = [];

  public async findProfileByAuthUserId(authUserId: string): Promise<ProfileEntity | null> {
    const p = this.profiles.find(x => x.authUserId === authUserId && x.status === 'ACTIVE');
    return p ? {...p} : null;
  }

  public async getActiveMembershipsByProfileId(profileId: string): Promise<MembershipWithOrganization[]> {
    const active = this.memberships.filter(m => m.profileId === profileId && m.status === 'ACTIVE');
    return active.map(m => {
      const org = this.organizations.find(o => o.id === m.orgId);
      return {
        ...m,
        organizationName: org?.displayName || org?.legalName
      };
    });
  }

  public async getOrganizationById(orgId: string): Promise<OrganizationEntity | null> {
    const o = this.organizations.find(x => x.id === orgId && x.status === 'ACTIVE');
    return o ? {...o} : null;
  }

  public async getPlatformAdminByAuthUserId(authUserId: string): Promise<PlatformAdminRecord | null> {
    const pa = this.platformAdmins.find(x => x.authUserId === authUserId && x.status === 'ACTIVE');
    return pa ? {...pa} : null;
  }

  public async getPlatformRoleGrants(adminId: string): Promise<PlatformRoleScope[]> {
    return this.platformRoleGrants
      .filter(g => g.adminId === adminId && !g.revokedAt)
      .map(g => g.roleScope);
  }

  public async recordAdminAuditLog(log: {
    actorAdminId?: string;
    action: string;
    resource: string;
    beforeState?: any;
    afterState?: any;
    reason?: string;
    correlationId?: string;
    requestSource?: string;
  }): Promise<void> {
    this.adminAuditLogs.push({
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      actorAdminId: log.actorAdminId,
      action: log.action,
      resource: log.resource,
      beforeState: log.beforeState,
      afterState: log.afterState,
      reason: log.reason,
      correlationId: log.correlationId,
      requestSource: log.requestSource,
      createdAt: new Date().toISOString()
    });
  }

  public async createOrganizationForProfile(
    profileId: string,
    data: { legalName: string; displayName?: string }
  ): Promise<{ organization: OrganizationEntity; membership: OrganizationMembershipEntity }> {
    const org: OrganizationEntity = {
      id: `org-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      legalName: data.legalName,
      displayName: data.displayName || data.legalName,
      timezone: 'Asia/Jakarta',
      defaultCurrency: 'IDR',
      status: 'ACTIVE'
    };
    this.organizations.push(org);

    const membership: OrganizationMembershipEntity = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orgId: org.id,
      profileId,
      role: 'OWNER',
      status: 'ACTIVE'
    };
    this.memberships.push(membership);
    return { organization: org, membership };
  }
}

// Global active identity repository
let currentIdentityRepository: IIdentityRepository = new PostgresIdentityRepository();

export function getIdentityRepository(): IIdentityRepository {
  return currentIdentityRepository;
}

export function setIdentityRepository(repo: IIdentityRepository): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('CRITICAL SECURITY VIOLATION: Custom identity repository can only be configured in test environment (NODE_ENV=test).');
  }
  currentIdentityRepository = repo;
}
