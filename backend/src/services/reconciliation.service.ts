// ============================================================================
// COVE Backend — Canonical Billing Reconciliation Service (Gate P0-C.3)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// Read-first audit and recovery surface for billing discrepancies:
// - Detects state misalignment across checkouts, payments, and subscriptions
// - Lists unresolved webhook events, overpayments, and payment conflicts
// - Manages reconciliation queue items (OPEN, RESOLVED, IGNORED_WITH_REASON)
// - Preserves audit trails: no history deletion, no automatic blind refunds
// ============================================================================

import { pgPool } from '../db/store.js';
import { getWebhookRepository, WebhookEventEntity } from '../repositories/webhook.repository.js';
import type {
  BillingPaymentEntity,
  BillingPaymentAnomalyEntity,
  ReconciliationItemEntity,
  ReconciliationItemStatus
} from '../types/domain.js';

export interface ConsistencyReport {
  isConsistent: boolean;
  issues: string[];
  checkoutStatus?: string;
  paymentCount: number;
  hasSubscription: boolean;
  subscriptionStatus?: string;
}

export interface QueryableReconcileClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release: () => void;
}

export interface QueryableReconcilePool {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  connect?: () => Promise<QueryableReconcileClient>;
}

export class ReconciliationService {
  private static pool: QueryableReconcilePool = pgPool;

  public static setPool(customPool: QueryableReconcilePool): void {
    ReconciliationService.pool = customPool;
  }

  private static async getClient(): Promise<QueryableReconcileClient> {
    if (this.pool && typeof this.pool.connect === 'function') {
      return await this.pool.connect();
    }
    return {
      query: (sql: string, params?: any[]) => this.pool.query(sql, params),
      release: () => {}
    };
  }

  /**
   * Evaluates end-to-end financial consistency for an organization.
   * Read-only audit verification.
   */
  public static async checkConsistency(orgId: string): Promise<ConsistencyReport> {
    const client = await this.getClient();
    try {
      const issues: string[] = [];

      // 1. Fetch settled payments
      const payRes = await client.query(
        `SELECT id, amount, currency, status, checkout_session_id
         FROM public.billing_payments
         WHERE organization_id = $1`,
        [orgId]
      );
      const payments = payRes.rows;
      const settledPayments = payments.filter((p: any) => p.status === 'SETTLED');

      // 2. Fetch checkout sessions
      const csRes = await client.query(
        `SELECT id, status, amount, currency
         FROM public.checkout_sessions
         WHERE organization_id = $1`,
        [orgId]
      );
      const checkouts = csRes.rows;

      // 3. Fetch subscription
      const subRes = await client.query(
        `SELECT id, status, plan_id, current_period_start, current_period_end
         FROM public.subscriptions
         WHERE org_id = $1`,
        [orgId]
      );
      const subscription = subRes.rows[0];

      // Evaluation rules:
      // Issue A: CHECKOUT PAID but no SETTLED payment
      const paidCheckoutsWithoutPayment = checkouts.filter(
        (c: any) => c.status === 'PAID' && !settledPayments.some((p: any) => p.checkout_session_id === c.id)
      );
      if (paidCheckoutsWithoutPayment.length > 0) {
        issues.push('CHECKOUT_PAID_WITHOUT_SETTLED_PAYMENT');
      }

      // Issue B: SETTLED payment exists but checkout is PENDING
      const paymentsWithPendingCheckout = settledPayments.filter((p: any) => {
        const matchingCs = checkouts.find((c: any) => c.id === p.checkout_session_id);
        return matchingCs && matchingCs.status === 'PENDING';
      });
      if (paymentsWithPendingCheckout.length > 0) {
        issues.push('PAYMENT_EXISTS_WITH_PENDING_CHECKOUT');
      }

      // Issue C: SETTLED payment exists but subscription is missing or not ACTIVE
      if (settledPayments.length > 0 && (!subscription || subscription.status !== 'ACTIVE')) {
        issues.push('SETTLED_PAYMENT_WITHOUT_ACTIVE_SUBSCRIPTION');
      }

      return {
        isConsistent: issues.length === 0,
        issues,
        checkoutStatus: checkouts[0]?.status,
        paymentCount: settledPayments.length,
        hasSubscription: !!subscription,
        subscriptionStatus: subscription?.status
      };
    } finally {
      client.release();
    }
  }

  /**
   * Lists unresolved webhook events (RETRYABLE or REVIEW_REQUIRED).
   */
  public static async listUnresolvedEvents(limit: number = 50): Promise<WebhookEventEntity[]> {
    const repo = getWebhookRepository();
    return await repo.listUnresolved(limit);
  }

  /**
   * Lists distinct payments flagged as OVERPAYMENT_REVIEW.
   */
  public static async listOverpaymentReviews(limit: number = 50): Promise<BillingPaymentEntity[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT id, organization_id AS "organizationId", checkout_session_id AS "checkoutSessionId",
                provider, provider_payment_id AS "providerPaymentId", provider_event_id AS "providerEventId",
                amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
         FROM public.billing_payments
         WHERE status = 'OVERPAYMENT_REVIEW'
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Lists PAYMENT_CONFLICT anomalies recorded during settlement intake.
   */
  public static async listPaymentConflicts(limit: number = 50): Promise<BillingPaymentAnomalyEntity[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT id, provider, provider_payment_id AS "providerPaymentId",
                existing_payment_id AS "existingPaymentId", provider_event_id AS "providerEventId",
                conflict_type AS "conflictType", incoming_amount AS "incomingAmount",
                incoming_currency AS "incomingCurrency", incoming_checkout_reference AS "incomingCheckoutReference",
                details, created_at AS "createdAt"
         FROM public.billing_payment_anomalies
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Creates a reconciliation item in public.billing_reconciliation_items.
   */
  public static async createReconciliationItem(params: {
    itemType: string;
    webhookEventId?: string | null;
    billingPaymentId?: string | null;
    checkoutSessionId?: string | null;
    organizationId?: string | null;
    anomalyId?: string | null;
    details?: Record<string, unknown>;
  }): Promise<string> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `INSERT INTO public.billing_reconciliation_items (
           item_type, status, webhook_event_id, billing_payment_id, checkout_session_id,
           organization_id, anomaly_id, details
         ) VALUES ($1, 'OPEN', $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id`,
        [
          params.itemType,
          params.webhookEventId || null,
          params.billingPaymentId || null,
          params.checkoutSessionId || null,
          params.organizationId || null,
          params.anomalyId || null,
          JSON.stringify(params.details || {})
        ]
      );
      return res.rows[0]?.id;
    } finally {
      client.release();
    }
  }

  /**
   * Lists reconciliation queue items by optional status.
   */
  public static async listReconciliationItems(
    status?: string,
    limit: number = 50
  ): Promise<ReconciliationItemEntity[]> {
    const client = await this.getClient();
    try {
      let queryStr = `SELECT id, item_type AS "itemType", status, webhook_event_id AS "webhookEventId",
                             billing_payment_id AS "billingPaymentId", checkout_session_id AS "checkoutSessionId",
                             organization_id AS "organizationId", anomaly_id AS "anomalyId",
                             details, resolution_reason AS "resolutionReason",
                             resolved_by_admin_id AS "resolvedByAdminId", resolved_at AS "resolvedAt",
                             created_at AS "createdAt", updated_at AS "updatedAt"
                      FROM public.billing_reconciliation_items`;
      const params: any[] = [];
      if (status) {
        queryStr += ` WHERE status = $1 ORDER BY created_at DESC LIMIT $2`;
        params.push(status, limit);
      } else {
        queryStr += ` ORDER BY created_at DESC LIMIT $1`;
        params.push(limit);
      }

      const res = await client.query(queryStr, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Resolves or ignores a reconciliation item with an immutable audit trail.
   */
  public static async resolveItem(
    itemId: string,
    adminId: string,
    resolution: 'RESOLVED' | 'IGNORED_WITH_REASON',
    reason: string
  ): Promise<boolean> {
    if (!reason || !reason.trim()) {
      throw new Error('Alasan resolusi wajib diisi.');
    }

    const client = await this.getClient();
    try {
      const res = await client.query(
        `UPDATE public.billing_reconciliation_items
         SET status = $1,
             resolution_reason = $2,
             resolved_by_admin_id = $3,
             resolved_at = NOW(),
             updated_at = NOW()
         WHERE id = $4 AND status = 'OPEN'
         RETURNING id`,
        [resolution, reason.trim(), adminId, itemId]
      );
      return res.rows.length > 0;
    } finally {
      client.release();
    }
  }
}
