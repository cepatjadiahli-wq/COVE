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
  AdminAuditLogRecord,
  TenantSubscriptionEntity,
  CheckoutSessionEntity
} from '../types/domain.js';
import {pgPool} from '../db/store.js';

export interface MembershipWithOrganization extends OrganizationMembershipEntity {
  organizationName?: string;
}

export interface IIdentityRepository {
  findProfileByAuthUserId(authUserId: string): Promise<ProfileEntity | null>;
  ensureProfileForAuthUser(authUserId: string, email: string, fullName?: string): Promise<ProfileEntity>;
  getActiveMembershipsByProfileId(profileId: string): Promise<MembershipWithOrganization[]>;
  getOrganizationById(orgId: string): Promise<OrganizationEntity | null>;
  updateOrganization(orgId: string, data: { legalName?: string; displayName?: string }): Promise<OrganizationEntity>;
  getPlatformAdminByAuthUserId(authUserId: string): Promise<PlatformAdminRecord | null>;
  getPlatformRoleGrants(adminId: string): Promise<PlatformRoleScope[]>;
  createOrganizationForProfile(
    profileId: string,
    data: { legalName: string; displayName?: string }
  ): Promise<{ organization: OrganizationEntity; membership: OrganizationMembershipEntity }>;
  getSubscriptionByOrgId(orgId: string): Promise<TenantSubscriptionEntity | null>;
  upsertSubscription(orgId: string, data: Partial<TenantSubscriptionEntity>): Promise<TenantSubscriptionEntity>;
  createCheckoutSession(data: CheckoutSessionEntity): Promise<CheckoutSessionEntity>;
  getCheckoutSessionByReference(reference: string): Promise<CheckoutSessionEntity | null>;
  updateCheckoutSessionStatus(reference: string, status: string): Promise<void>;
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

  public async ensureProfileForAuthUser(authUserId: string, email: string, fullName?: string): Promise<ProfileEntity> {
    const existing = await this.findProfileByAuthUserId(authUserId);
    if (existing) return existing;

    const resolvedName = fullName?.trim() || email.split('@')[0] || 'Pengguna COVE';
    const query = `
      INSERT INTO public.profiles (auth_user_id, full_name, status)
      VALUES ($1, $2, 'ACTIVE')
      ON CONFLICT (auth_user_id) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id, auth_user_id AS "authUserId", full_name AS "fullName", phone, status, created_at AS "createdAt"
    `;
    const res = await pgPool.query(query, [authUserId, resolvedName]);
    return res.rows[0];
  }

  public async updateOrganization(orgId: string, data: { legalName?: string; displayName?: string }): Promise<OrganizationEntity> {
    const existing = await this.getOrganizationById(orgId);
    if (!existing) throw new Error('Organisasi tidak ditemukan.');

    const legalName = data.legalName?.trim() || existing.legalName;
    const displayName = data.displayName?.trim() || data.legalName?.trim() || existing.displayName;

    const res = await pgPool.query(`
      UPDATE public.organizations
      SET legal_name = $1, display_name = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, legal_name AS "legalName", display_name AS "displayName", timezone, default_currency AS "defaultCurrency", status
    `, [legalName, displayName, orgId]);
    return res.rows[0];
  }

  public async getSubscriptionByOrgId(orgId: string): Promise<TenantSubscriptionEntity | null> {
    const res = await pgPool.query(`
      SELECT s.id, s.org_id AS "organizationId", s.plan_id AS "planId", p.name AS "planName", s.status,
             s.current_period_start AS "currentPeriodStart", s.current_period_end AS "currentPeriodEnd",
             s.created_at AS "createdAt", s.updated_at AS "updatedAt"
      FROM public.subscriptions s
      LEFT JOIN public.plans p ON p.id = s.plan_id
      WHERE s.org_id = $1
    `, [orgId]);
    return res.rows[0] || null;
  }

  public async upsertSubscription(orgId: string, data: Partial<TenantSubscriptionEntity>): Promise<TenantSubscriptionEntity> {
    const planId = data.planId || 'core';
    const status = data.status || 'ACTIVE';
    const start = data.currentPeriodStart || new Date().toISOString();
    const end = data.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    const res = await pgPool.query(`
      INSERT INTO public.subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (org_id) DO UPDATE
      SET plan_id = EXCLUDED.plan_id, status = EXCLUDED.status,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          updated_at = NOW()
      RETURNING id, org_id AS "organizationId", plan_id AS "planId", status,
                current_period_start AS "currentPeriodStart", current_period_end AS "currentPeriodEnd",
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [orgId, planId, status, start, end]);
    return res.rows[0];
  }

  public async createCheckoutSession(data: CheckoutSessionEntity): Promise<CheckoutSessionEntity> {
    const res = await pgPool.query(`
      INSERT INTO public.checkout_sessions (organization_id, provider, provider_reference, provider_checkout_id, status, plan, amount, currency)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, organization_id AS "organizationId", provider, provider_reference AS "providerReference",
                provider_checkout_id AS "providerCheckoutId", status, plan, amount, currency,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [
      data.organizationId,
      data.provider || 'MAYAR',
      data.providerReference,
      data.providerCheckoutId || null,
      data.status || 'PENDING',
      data.plan,
      data.amount,
      data.currency || 'IDR'
    ]);
    return res.rows[0];
  }

  public async getCheckoutSessionByReference(reference: string): Promise<CheckoutSessionEntity | null> {
    const res = await pgPool.query(`
      SELECT id, organization_id AS "organizationId", provider, provider_reference AS "providerReference",
             provider_checkout_id AS "providerCheckoutId", status, plan, amount, currency,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM public.checkout_sessions
      WHERE provider_reference = $1
    `, [reference]);
    return res.rows[0] || null;
  }

  public async updateCheckoutSessionStatus(reference: string, status: string): Promise<void> {
    await pgPool.query(`
      UPDATE public.checkout_sessions
      SET status = $1, updated_at = NOW()
      WHERE provider_reference = $2
    `, [status, reference]);
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
  public subscriptions: TenantSubscriptionEntity[] = [];
  public checkoutSessions: CheckoutSessionEntity[] = [];
  public platformRoleGrants: Array<{ id: string; adminId: string; roleScope: PlatformRoleScope; revokedAt?: string | null }> = [];
  public adminAuditLogs: Array<AdminAuditLogRecord> = [];

  public async ensureProfileForAuthUser(authUserId: string, email: string, fullName?: string): Promise<ProfileEntity> {
    let existing = this.profiles.find(p => p.authUserId === authUserId);
    if (!existing) {
      existing = {
        id: `prof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        authUserId,
        fullName: fullName?.trim() || email.split('@')[0] || 'Pengguna COVE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      this.profiles.push(existing);
    }
    return {...existing};
  }

  public async updateOrganization(orgId: string, data: { legalName?: string; displayName?: string }): Promise<OrganizationEntity> {
    const org = this.organizations.find(o => o.id === orgId);
    if (!org) throw new Error('Organisasi tidak ditemukan.');
    if (data.legalName) org.legalName = data.legalName.trim();
    if (data.displayName) org.displayName = data.displayName.trim();
    return {...org};
  }

  public async getSubscriptionByOrgId(orgId: string): Promise<TenantSubscriptionEntity | null> {
    const s = this.subscriptions.find(x => x.organizationId === orgId);
    return s ? {...s} : null;
  }

  public async upsertSubscription(orgId: string, data: Partial<TenantSubscriptionEntity>): Promise<TenantSubscriptionEntity> {
    let sub = this.subscriptions.find(x => x.organizationId === orgId);
    if (sub) {
      if (data.planId) sub.planId = data.planId;
      if (data.planName) sub.planName = data.planName;
      if (data.status) sub.status = data.status;
      if (data.currentPeriodStart) sub.currentPeriodStart = data.currentPeriodStart;
      if (data.currentPeriodEnd) sub.currentPeriodEnd = data.currentPeriodEnd;
      if (data.amount !== undefined) sub.amount = data.amount;
      sub.updatedAt = new Date().toISOString();
    } else {
      sub = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        organizationId: orgId,
        planId: data.planId || 'core',
        planName: data.planName || 'Core',
        status: data.status || 'ACTIVE',
        currentPeriodStart: data.currentPeriodStart || new Date().toISOString(),
        currentPeriodEnd: data.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        amount: data.amount || 4900000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.subscriptions.push(sub);
    }
    return {...sub};
  }

  public async createCheckoutSession(data: CheckoutSessionEntity): Promise<CheckoutSessionEntity> {
    const session = {
      ...data,
      id: data.id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.checkoutSessions.push(session);
    return {...session};
  }

  public async getCheckoutSessionByReference(reference: string): Promise<CheckoutSessionEntity | null> {
    const c = this.checkoutSessions.find(x => x.providerReference === reference);
    return c ? {...c} : null;
  }

  public async updateCheckoutSessionStatus(reference: string, status: string): Promise<void> {
    const c = this.checkoutSessions.find(x => x.providerReference === reference);
    if (c) {
      c.status = status as any;
      c.updatedAt = new Date().toISOString();
    }
  }

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
