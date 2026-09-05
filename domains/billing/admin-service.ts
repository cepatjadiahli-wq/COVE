/**
 * COVE Phase 18: Admin Billing Control Center Service Layer
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md & PRD v1.0
 * 
 * Provides centralized data retrieval, pagination, filtering, and controlled operational actions
 * for the 14 Platform Administrator Billing Control Center modules.
 */

import { createAdminClient } from "../../lib/supabase/admin";
import { calculateLiveSaaSMetrics, createOrUpdateMetricsSnapshot } from "./saas-metrics-engine";
import { reconcilePaymentManually, unapplyPaymentManually } from "./reconciliation-engine";
import { processRefundOrDispute } from "./refund-service";

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface PaginatedResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AdminBillingService {
  private getClient() {
    return createAdminClient();
  }

  // ---------------------------------------------------------------------------
  // 1. Billing Overview
  // ---------------------------------------------------------------------------
  public async getBillingOverview() {
    const supabase = this.getClient();

    // 1. SaaS Financial Metrics
    const metrics = await calculateLiveSaaSMetrics();

    // 2. Count reconciliation items needing attention
    const { count: reconCount } = await supabase
      .from("reconciliation_queue")
      .select("*", { count: "exact", head: true })
      .in("status", ["UNAPPLIED", "PARTIALLY_APPLIED", "OVERPAYMENT", "MANUAL_REVIEW", "CHARGEBACK"]);

    // 3. Count overdue / restricted subscriptions
    const { count: overdueCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .in("status", ["PAST_DUE", "READ_ONLY", "SUSPENDED"]);

    // 4. Count active dunning cycles
    const { count: dunningCount } = await supabase
      .from("dunning_cycles")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE");

    // 5. Count pending invoices
    const { count: pendingInvoicesCount } = await supabase
      .from("billing_invoices")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING");

    return {
      metrics,
      alerts: {
        reconciliationQueueCount: reconCount || 0,
        overdueSubscriptionsCount: overdueCount || 0,
        activeDunningCount: dunningCount || 0,
        pendingInvoicesCount: pendingInvoicesCount || 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Organizations / Customers
  // ---------------------------------------------------------------------------
  public async listOrganizations(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("organizations")
      .select("id, name, subscription_status, subscription_tier, created_at, subscriptions!subscriptions_org_id_fkey(*)", { count: "exact" });

    if (params.status) {
      query = query.eq("subscription_status", params.status);
    }
    if (params.search) {
      query = query.ilike("name", `%${params.search}%`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Subscriptions List
  // ---------------------------------------------------------------------------
  public async listSubscriptions(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("subscriptions")
      .select("*, organizations!subscriptions_org_id_fkey(id, name)", { count: "exact" });

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Subscription Detail & Lifecycle
  // ---------------------------------------------------------------------------
  public async getSubscriptionDetail(id: string) {
    const supabase = this.getClient();

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("*, organizations!subscriptions_org_id_fkey(*)")
      .eq("id", id)
      .single();

    if (subErr || !sub) {
      throw new Error(`Subscription ${id} not found`);
    }

    // Related status events (lifecycle)
    const { data: statusEvents } = await supabase
      .from("subscription_status_events")
      .select("*")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false });

    // Related billing invoices
    const { data: invoices } = await supabase
      .from("billing_invoices")
      .select("*")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false });

    // Related manual overrides
    const { data: overrides } = await supabase
      .from("manual_subscription_overrides")
      .select("*")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false });

    // Active dunning cycle
    const { data: dunningCycles } = await supabase
      .from("dunning_cycles")
      .select("*")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false });

    return {
      subscription: sub,
      statusEvents: statusEvents || [],
      invoices: invoices || [],
      overrides: overrides || [],
      dunningCycles: dunningCycles || [],
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Billing Invoices
  // ---------------------------------------------------------------------------
  public async listInvoices(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("billing_invoices")
      .select("*, organizations(id, name), payments(*)", { count: "exact" });

    if (params.status) {
      query = query.eq("status", params.status);
    }
    if (params.search) {
      query = query.ilike("invoice_number", `%${params.search}%`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Payments
  // ---------------------------------------------------------------------------
  public async listPayments(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("payments")
      .select("*, organizations(id, name), billing_invoices(id, invoice_number)", { count: "exact" });

    if (params.status) {
      query = query.eq("status", params.status);
    }
    if (params.search) {
      query = query.ilike("provider_payment_id", `%${params.search}%`);
    }

    const { data, count, error } = await query
      .order("paid_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Payment Attempts
  // ---------------------------------------------------------------------------
  public async listPaymentAttempts(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from("payment_retry_attempts")
      .select("*, billing_invoices(id, invoice_number, org_id)", { count: "exact" })
      .order("attempted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Reconciliation Queue
  // ---------------------------------------------------------------------------
  public async listReconciliationQueue(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("reconciliation_queue")
      .select("*, organizations(id, name), payments(*), billing_invoices(id, invoice_number)", { count: "exact" });

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 9. Dunning Cycles
  // ---------------------------------------------------------------------------
  public async listDunningCycles(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("dunning_cycles")
      .select("*, organizations(id, name), subscriptions(id, plan_id)", { count: "exact" });

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 10. Notifications
  // ---------------------------------------------------------------------------
  public async listNotifications(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("billing_notifications")
      .select("*, organizations(id, name)", { count: "exact" });

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 11. Webhook Events
  // ---------------------------------------------------------------------------
  public async listWebhookEvents(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("webhook_events")
      .select("*", { count: "exact" });

    if (params.status) {
      query = query.eq("processing_status", params.status);
    }
    if (params.search) {
      query = query.ilike("event_id", `%${params.search}%`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 12. Plans, Prices & Entitlements
  // ---------------------------------------------------------------------------
  public async listPlansAndPrices() {
    const supabase = this.getClient();

    const { data: plans } = await supabase
      .from("plans")
      .select("*")
      .order("tier_level", { ascending: true });

    const { data: prices } = await supabase
      .from("prices")
      .select("*")
      .order("amount", { ascending: true });

    const { data: entitlements } = await supabase
      .from("plan_entitlements")
      .select("*");

    return {
      plans: plans || [],
      prices: prices || [],
      entitlements: entitlements || [],
    };
  }

  // ---------------------------------------------------------------------------
  // 13. Manual Overrides
  // ---------------------------------------------------------------------------
  public async listManualOverrides(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from("manual_subscription_overrides")
      .select("*, organizations(id, name), platform_admins(id, notes)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async grantManualOverride(params: {
    subscriptionId: string;
    overrideType: "ACCESS_EXTENSION" | "STATUS_OVERRIDE" | "PRICE_OVERRIDE" | "ENTITLEMENT_BOOST" | "DISCOUNT_APPLIED";
    newValue: Record<string, unknown>;
    reason: string;
    expiresAt: string; // ISO String in future
    adminId: string;
  }) {
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error("REASON_REQUIRED: Alasan manual override wajib diisi (minimal 5 karakter).");
    }

    const expiry = new Date(params.expiresAt);
    if (isNaN(expiry.getTime()) || expiry <= new Date()) {
      throw new Error("EXPIRATION_REQUIRED: Manual override wajib memiliki masa berlaku (expires_at) di masa depan.");
    }

    const supabase = this.getClient();

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("*, organizations!subscriptions_org_id_fkey(*)")
      .eq("id", params.subscriptionId)
      .single();

    if (subErr || !sub) {
      throw new Error(`Subscription ${params.subscriptionId} tidak ditemukan.`);
    }

    const previousValue = {
      status: sub.status,
      current_period_end: sub.current_period_end,
      plan_id: sub.plan_id,
    };

    // Apply mutation based on overrideType
    if (params.overrideType === "STATUS_OVERRIDE" && params.newValue.status) {
      await supabase
        .from("subscriptions")
        .update({ status: params.newValue.status, updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      await supabase
        .from("organizations")
        .update({ subscription_status: params.newValue.status, updated_at: new Date().toISOString() })
        .eq("id", sub.org_id);
    } else if (params.overrideType === "ACCESS_EXTENSION" && params.newValue.extendDays) {
      const currentEnd = new Date(sub.current_period_end);
      const newEnd = new Date(currentEnd.getTime() + Number(params.newValue.extendDays) * 86400000);
      await supabase
        .from("subscriptions")
        .update({
          current_period_end: newEnd.toISOString(),
          status: "ACTIVE",
          grace_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }

    // Insert into manual_subscription_overrides
    const { data: overrideRecord, error: overrideErr } = await supabase
      .from("manual_subscription_overrides")
      .insert({
        subscription_id: sub.id,
        org_id: sub.org_id,
        override_type: params.overrideType,
        previous_value: previousValue,
        new_value: params.newValue,
        reason: params.reason,
        admin_id: params.adminId,
        expires_at: expiry.toISOString(),
      })
      .select()
      .single();

    if (overrideErr) {
      throw new Error(`Gagal menyimpan manual override: ${overrideErr.message}`);
    }

    // Record admin audit log
    await supabase.from("admin_audit_logs").insert({
      admin_id: params.adminId,
      action: `GRANT_${params.overrideType}`,
      target_entity: "SUBSCRIPTION",
      target_id: sub.id,
      org_id: sub.org_id,
      reason: params.reason,
      before_state: previousValue,
      after_state: params.newValue,
    });

    return overrideRecord;
  }

  public async revokeManualOverride(params: {
    overrideId: string;
    revocationReason: string;
    adminId: string;
  }) {
    if (!params.revocationReason || params.revocationReason.trim().length < 5) {
      throw new Error("REVOCATION_REASON_REQUIRED: Alasan pembatalan override wajib diisi (minimal 5 karakter).");
    }

    const supabase = this.getClient();

    const { data: override, error: ovrErr } = await supabase
      .from("manual_subscription_overrides")
      .select("*")
      .eq("id", params.overrideId)
      .single();

    if (ovrErr || !override) {
      throw new Error(`Override ${params.overrideId} tidak ditemukan.`);
    }

    if (override.is_revoked) {
      return override;
    }

    // Restore previous values
    if (override.previous_value?.status) {
      await supabase
        .from("subscriptions")
        .update({
          status: override.previous_value.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", override.subscription_id);

      await supabase
        .from("organizations")
        .update({
          subscription_status: override.previous_value.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", override.org_id);
    }

    const { data: updated, error: upErr } = await supabase
      .from("manual_subscription_overrides")
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revocation_reason: params.revocationReason,
        revoked_by: params.adminId,
      })
      .eq("id", override.id)
      .select()
      .single();

    if (upErr) throw new Error(upErr.message);

    // Record audit
    await supabase.from("admin_audit_logs").insert({
      admin_id: params.adminId,
      action: "REVOKE_MANUAL_OVERRIDE",
      target_entity: "MANUAL_SUBSCRIPTION_OVERRIDE",
      target_id: override.id,
      org_id: override.org_id,
      reason: params.revocationReason,
      before_state: override.new_value,
      after_state: override.previous_value,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 14. SaaS Metrics & Audit Logs
  // ---------------------------------------------------------------------------
  public async listAuditLogs(params: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
    const supabase = this.getClient();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from("admin_audit_logs")
      .select("*, platform_admins(id, notes), organizations(id, name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const total = count || 0;
    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getSaasMetrics(params: { asOfDate?: string; excludeDemoTenants?: boolean }) {
    return calculateLiveSaaSMetrics(params);
  }

  public async createMetricsSnapshot(params: { periodType: "DAILY" | "MONTHLY"; snapshotDate: string; isLocked?: boolean }) {
    return createOrUpdateMetricsSnapshot(params);
  }

  // ---------------------------------------------------------------------------
  // Controlled Action Proxies
  // ---------------------------------------------------------------------------
  public async reconcilePayment(params: Parameters<typeof reconcilePaymentManually>[0]) {
    return reconcilePaymentManually(params);
  }

  public async unapplyPayment(params: Parameters<typeof unapplyPaymentManually>[0]) {
    return unapplyPaymentManually(params);
  }

  public async processRefund(params: Parameters<typeof processRefundOrDispute>[0]) {
    return processRefundOrDispute(params);
  }
}

export const adminBillingService = new AdminBillingService();
