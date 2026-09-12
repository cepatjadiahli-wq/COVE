// ============================================================================
// COVE Backend — Canonical Billing Settlement Repository (Gate P0-C.2 / P0-C.2.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// Ensures single ACID transaction for:
// - Locking checkout session
// - Validating tenant, exact amount, currency, and provider payment status
// - Canonical plan billing_period calculation (45_DAYS, MONTHLY, YEARLY)
// - Recording distinct payments on settled checkouts as OVERPAYMENT_REVIEW
// - Detecting material economic payment conflicts and logging anomalies (PAYMENT_CONFLICT)
// - Inserting canonical payment record
// - Marking checkout session PAID
// - Upserting / extending subscription entitlement
// ============================================================================

import { pgPool } from '../db/store.js';
import { parseMoney, parseMoneyToMinorUnits } from '../utils/money.js';
import { getIdentityRepository } from './identity.repository.js';
import type {
  BillingPaymentEntity,
  CheckoutSessionEntity,
  TenantSubscriptionEntity
} from '../types/domain.js';

export interface SettlePaymentParams {
  provider: string;
  checkoutReference: string;
  providerPaymentId: string;
  providerEventId?: string;
  amount: number | string;
  currency: string;
  paymentStatus: string;
  failureInjectionStep?: 'after_payment_insert' | 'after_checkout_update' | 'during_subscription';
}

export interface SettlePaymentResult {
  status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED' | 'REJECTED' | 'PAYMENT_CONFLICT';
  message: string;
  paymentId?: string;
  organizationId?: string;
  subscriptionId?: string;
  newPeriodEnd?: string;
  anomalyId?: string;
  isOverpaymentReview?: boolean;
}

export interface QueryableBillingClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release: () => void;
}

export interface QueryableBillingPool {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  connect?: () => Promise<QueryableBillingClient>;
}

export interface IBillingSettlementRepository {
  settlePayment(params: SettlePaymentParams): Promise<SettlePaymentResult>;
  getPaymentByProviderPaymentId(provider: string, providerPaymentId: string): Promise<BillingPaymentEntity | null>;
  getPaymentsByOrgId(orgId: string): Promise<BillingPaymentEntity[]>;
}

/**
 * Calculates canonical subscription period end based on plan billing period using UTC calendar arithmetic.
 * - '45_DAYS': baseDate + 45 days (Paid Pilot)
 * - 'YEARLY': baseDate + 1 UTC calendar year (with leap year clamp, e.g. Feb 29 -> Feb 28)
 * - 'MONTHLY' (default): baseDate + 1 UTC calendar month (with end-of-month clamp, e.g. Jan 31 -> Feb 28/29)
 */
export function calculatePeriodEnd(baseDate: Date, billingPeriod?: string | null): Date {
  const normPeriod = (billingPeriod || 'MONTHLY').toUpperCase().trim();
  if (normPeriod === '45_DAYS') {
    return new Date(baseDate.getTime() + 45 * 24 * 3600 * 1000);
  } else if (normPeriod === 'YEARLY') {
    const d = new Date(baseDate);
    const targetYear = d.getUTCFullYear() + 1;
    const targetMonth = d.getUTCMonth();
    const originalDay = d.getUTCDate();
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    const daysInMonths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const maxDay = daysInMonths[targetMonth];
    d.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, maxDay));
    return d;
  } else {
    // MONTHLY or default
    const d = new Date(baseDate);
    let targetYear = d.getUTCFullYear();
    let targetMonth = d.getUTCMonth() + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    const originalDay = d.getUTCDate();
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    const daysInMonths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const maxDay = daysInMonths[targetMonth];
    d.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, maxDay));
    return d;
  }
}

export class PostgresBillingSettlementRepository implements IBillingSettlementRepository {
  private pool: QueryableBillingPool;

  constructor(pool: QueryableBillingPool = pgPool) {
    this.pool = pool;
  }

  private async getClient(): Promise<QueryableBillingClient> {
    if (this.pool && typeof this.pool.connect === 'function') {
      return await this.pool.connect();
    }
    return {
      query: (sql: string, params?: any[]) => this.pool.query(sql, params),
      release: () => {}
    };
  }

  private locks: Map<string, Promise<void>> = new Map();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolver: () => void = () => {};
    const promise = new Promise<void>(resolve => {
      resolver = resolve;
    });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      resolver();
    };
  }

  public async settlePayment(params: SettlePaymentParams): Promise<SettlePaymentResult> {
    const unlockSession = await this.acquireLock(`checkout-${params.checkoutReference}`);
    let unlockPay: (() => void) | null = null;
    if (params.providerPaymentId && params.providerPaymentId.trim()) {
      unlockPay = await this.acquireLock(`pay-${params.providerPaymentId.trim()}`);
    }

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      // 1. Lock canonical checkout session row
      const csRes = await client.query(
        `SELECT id, organization_id, provider, provider_reference, provider_checkout_id,
                status, plan, amount, currency
         FROM public.checkout_sessions
         WHERE provider_reference = $1
         FOR UPDATE`,
        [params.checkoutReference]
      );

      if (csRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          status: 'IGNORED',
          message: `Checkout session reference ${params.checkoutReference} tidak ditemukan.`
        };
      }

      const session = csRes.rows[0];

      // 2. Validate provider payment status: strictly 'settled'
      const normStatus = (params.paymentStatus || '').toLowerCase().trim();
      if (normStatus !== 'settled') {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: `Status pembayaran provider tidak valid untuk settlement: ${params.paymentStatus}`
        };
      }

      // 3. Validate provider payment ID
      if (!params.providerPaymentId || !params.providerPaymentId.trim()) {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: 'Provider payment ID wajib diisi dan tidak boleh kosong.'
        };
      }

      const providerName = params.provider || 'MAYAR';
      const providerPaymentId = params.providerPaymentId.trim();

      // 4. Check if provider payment ID was already recorded in billing_payments
      const payCheck = await client.query(
        `SELECT id, organization_id, checkout_session_id, amount, currency, status
         FROM public.billing_payments
         WHERE provider = $1 AND provider_payment_id = $2
         FOR UPDATE`,
        [providerName, providerPaymentId]
      );

      if (payCheck.rows.length > 0) {
        const existingPay = payCheck.rows[0];
        let amountMatches = false;
        try {
          amountMatches = parseMoneyToMinorUnits(existingPay.amount) === parseMoneyToMinorUnits(params.amount);
        } catch {
          amountMatches = false;
        }

        const orgMatches = existingPay.organization_id === session.organization_id;
        const checkoutMatches = existingPay.checkout_session_id === session.id;
        const currencyMatches = (existingPay.currency || '').toUpperCase() === (params.currency || 'IDR').toUpperCase();

        if (amountMatches && orgMatches && checkoutMatches && currencyMatches) {
          await client.query('COMMIT');
          return {
            status: 'DUPLICATE',
            message: `Payment ID ${providerPaymentId} sudah pernah diproses.`
          };
        }

        // Material economic conflict detected!
        let conflictType = 'PAYMENT_CONFLICT';
        if (!orgMatches) conflictType = 'ORGANIZATION_MISMATCH';
        else if (!checkoutMatches) conflictType = 'CHECKOUT_MISMATCH';
        else if (!amountMatches) conflictType = 'AMOUNT_MISMATCH';
        else if (!currencyMatches) conflictType = 'CURRENCY_MISMATCH';

        const anomRes = await client.query(
          `INSERT INTO public.billing_payment_anomalies (
             provider, provider_payment_id, existing_payment_id, provider_event_id,
             conflict_type, incoming_amount, incoming_currency, incoming_checkout_reference, details
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            providerName,
            providerPaymentId,
            existingPay.id,
            params.providerEventId || null,
            conflictType,
            parseMoney(params.amount),
            (params.currency || 'IDR').toUpperCase(),
            params.checkoutReference,
            JSON.stringify({
              reason: 'Material difference in payment attributes for existing provider_payment_id',
              existing: {
                organization_id: existingPay.organization_id,
                checkout_session_id: existingPay.checkout_session_id,
                amount: existingPay.amount,
                currency: existingPay.currency,
                status: existingPay.status
              },
              incoming: {
                organization_id: session.organization_id,
                checkout_session_id: session.id,
                amount: params.amount,
                currency: params.currency
              }
            })
          ]
        );

        await client.query('COMMIT');
        return {
          status: 'PAYMENT_CONFLICT',
          message: `Economic conflict detected for payment ID ${providerPaymentId}: ${conflictType}`,
          anomalyId: anomRes.rows[0]?.id
        };
      }

      // 5. Handle already-paid checkout session
      if (session.status === 'PAID') {
        // Distinct new payment on an already-settled checkout -> OVERPAYMENT_REVIEW
        const opRes = await client.query(
          `INSERT INTO public.billing_payments (
             organization_id, checkout_session_id, provider, provider_payment_id,
             provider_event_id, amount, currency, status, paid_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OVERPAYMENT_REVIEW', NOW())
           ON CONFLICT (provider, provider_payment_id) DO NOTHING
           RETURNING id, organization_id, amount, currency, status, paid_at, created_at`,
          [
            session.organization_id,
            session.id,
            providerName,
            providerPaymentId,
            params.providerEventId || null,
            parseMoney(params.amount),
            (params.currency || 'IDR').toUpperCase()
          ]
        );

        await client.query('COMMIT');
        return {
          status: 'DUPLICATE',
          message: `Checkout session ${params.checkoutReference} sudah berstatus PAID. Pembayaran baru dicatat sebagai OVERPAYMENT_REVIEW.`,
          paymentId: opRes.rows[0]?.id,
          organizationId: session.organization_id,
          isOverpaymentReview: true
        };
      }

      // 6. Validate session status is PENDING
      if (session.status !== 'PENDING') {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: `Status checkout session adalah ${session.status} (bukan PENDING). Settlement ditolak.`
        };
      }

      // 7. Validate currency (case-insensitive)
      if ((params.currency || 'IDR').toUpperCase() !== (session.currency || 'IDR').toUpperCase()) {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: `Mata uang tidak sesuai: diharapkan ${session.currency}, diterima ${params.currency}`
        };
      }

      // 8. Validate exact money amount
      try {
        const expectedMinor = parseMoneyToMinorUnits(session.amount);
        const paidMinor = parseMoneyToMinorUnits(params.amount);
        if (expectedMinor !== paidMinor) {
          await client.query('ROLLBACK');
          return {
            status: 'REJECTED',
            message: `Jumlah pembayaran tidak sesuai: diharapkan ${session.amount}, diterima ${params.amount}`
          };
        }
      } catch (err: any) {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: `Format nilai pembayaran tidak valid: ${err.message}`
        };
      }

      // 9. Fetch canonical plan definition for billing period
      const planRes = await client.query(
        `SELECT id, billing_period FROM public.plans WHERE id = $1 FOR UPDATE`,
        [session.plan || 'core']
      );
      const planBillingPeriod = planRes.rows[0]?.billing_period || 'MONTHLY';

      // 10. Insert canonical payment record
      const payRes = await client.query(
        `INSERT INTO public.billing_payments (
           organization_id, checkout_session_id, provider, provider_payment_id,
           provider_event_id, amount, currency, status, paid_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'SETTLED', NOW())
         ON CONFLICT (provider, provider_payment_id) DO NOTHING
         RETURNING id, organization_id, amount, currency, status, paid_at, created_at`,
        [
          session.organization_id,
          session.id,
          providerName,
          providerPaymentId,
          params.providerEventId || null,
          parseMoney(params.amount),
          (params.currency || 'IDR').toUpperCase()
        ]
      );

      if (payRes.rows.length === 0) {
        await client.query('COMMIT');
        return {
          status: 'DUPLICATE',
          message: `Payment ID ${params.providerPaymentId} sudah pernah diproses.`
        };
      }

      const paymentRecord = payRes.rows[0];

      // Failure injection 1
      if (params.failureInjectionStep === 'after_payment_insert') {
        throw new Error('SIMULATED_FAILURE: after_payment_insert');
      }

      // 11. Update checkout session status to PAID
      await client.query(
        `UPDATE public.checkout_sessions
         SET status = 'PAID', updated_at = NOW()
         WHERE id = $1`,
        [session.id]
      );

      // Failure injection 2
      if (params.failureInjectionStep === 'after_checkout_update') {
        throw new Error('SIMULATED_FAILURE: after_checkout_update');
      }

      // 12. Lock and calculate subscription extension using plan billing_period
      const subRes = await client.query(
        `SELECT id, plan_id, status, current_period_start, current_period_end
         FROM public.subscriptions
         WHERE org_id = $1
         FOR UPDATE`,
        [session.organization_id]
      );

      const now = new Date();
      let baseDate = now;
      let periodStart = now.toISOString();

      if (subRes.rows.length > 0) {
        const currentSub = subRes.rows[0];
        if (currentSub.status === 'ACTIVE' && currentSub.current_period_end) {
          const existingEndDate = new Date(currentSub.current_period_end);
          if (existingEndDate.getTime() > now.getTime()) {
            baseDate = existingEndDate;
            periodStart = new Date(currentSub.current_period_start).toISOString();
          }
        }
      }

      const newPeriodEndDate = calculatePeriodEnd(baseDate, planBillingPeriod);
      const newPeriodEnd = newPeriodEndDate.toISOString();

      // Failure injection 3
      if (params.failureInjectionStep === 'during_subscription') {
        throw new Error('SIMULATED_FAILURE: during_subscription');
      }

      // 13. Upsert subscription
      const upsertSubRes = await client.query(
        `INSERT INTO public.subscriptions (
           org_id, plan_id, status, current_period_start, current_period_end, updated_at
         ) VALUES ($1, $2, 'ACTIVE', $3, $4, NOW())
         ON CONFLICT (org_id) DO UPDATE
         SET plan_id = EXCLUDED.plan_id,
             status = 'ACTIVE',
             current_period_start = EXCLUDED.current_period_start,
             current_period_end = EXCLUDED.current_period_end,
             updated_at = NOW()
         RETURNING id, org_id, plan_id, status, current_period_start, current_period_end`,
        [session.organization_id, session.plan || 'core', periodStart, newPeriodEnd]
      );

      await client.query('COMMIT');

      return {
        status: 'PROCESSED',
        message: `Pembayaran SaaS berhasil disettle untuk organisasi ${session.organization_id}. Subscription aktif hingga ${newPeriodEnd}.`,
        paymentId: paymentRecord.id,
        organizationId: session.organization_id,
        subscriptionId: upsertSubRes.rows[0]?.id,
        newPeriodEnd
      };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505' && (err.constraint === 'uq_billing_payments_provider_payment' || err.message?.includes('uq_billing_payments_provider_payment'))) {
        return {
          status: 'DUPLICATE',
          message: `Payment ID ${params.providerPaymentId} sudah pernah diproses.`
        };
      }
      throw err;
    } finally {
      client.release();
      if (unlockPay) unlockPay();
      unlockSession();
    }
  }

  public async getPaymentByProviderPaymentId(provider: string, providerPaymentId: string): Promise<BillingPaymentEntity | null> {
    const res = await this.pool.query(
      `SELECT id, organization_id AS "organizationId", checkout_session_id AS "checkoutSessionId",
              provider, provider_payment_id AS "providerPaymentId", provider_event_id AS "providerEventId",
              amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
       FROM public.billing_payments
       WHERE provider = $1 AND provider_payment_id = $2`,
      [provider, providerPaymentId]
    );
    return res.rows[0] || null;
  }

  public async getPaymentsByOrgId(orgId: string): Promise<BillingPaymentEntity[]> {
    const res = await this.pool.query(
      `SELECT id, organization_id AS "organizationId", checkout_session_id AS "checkoutSessionId",
              provider, provider_payment_id AS "providerPaymentId", provider_event_id AS "providerEventId",
              amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
       FROM public.billing_payments
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [orgId]
    );
    return res.rows;
  }
}

export class InMemoryBillingSettlementRepository implements IBillingSettlementRepository {
  public payments: BillingPaymentEntity[] = [];
  public checkoutSessions: CheckoutSessionEntity[] = [];
  public subscriptions: TenantSubscriptionEntity[] = [];
  public anomalies: any[] = [];

  private getSessionList(): CheckoutSessionEntity[] {
    const identityRepo = getIdentityRepository();
    if ((identityRepo as any).checkoutSessions) {
      return (identityRepo as any).checkoutSessions;
    }
    return this.checkoutSessions;
  }

  private getSubList(): TenantSubscriptionEntity[] {
    const identityRepo = getIdentityRepository();
    if ((identityRepo as any).subscriptions) {
      return (identityRepo as any).subscriptions;
    }
    return this.subscriptions;
  }

  public async settlePayment(params: SettlePaymentParams): Promise<SettlePaymentResult> {
    const sessions = this.getSessionList();
    const subs = this.getSubList();

    const session = sessions.find(cs => cs.providerReference === params.checkoutReference);
    if (!session) {
      return {
        status: 'IGNORED',
        message: `Checkout session reference ${params.checkoutReference} tidak ditemukan.`
      };
    }

    const normStatus = (params.paymentStatus || '').toLowerCase().trim();
    if (normStatus !== 'settled') {
      return {
        status: 'REJECTED',
        message: `Status pembayaran provider tidak valid untuk settlement: ${params.paymentStatus}`
      };
    }

    if (!params.providerPaymentId || !params.providerPaymentId.trim()) {
      return {
        status: 'REJECTED',
        message: 'Provider payment ID wajib diisi dan tidak boleh kosong.'
      };
    }

    const providerName = params.provider || 'MAYAR';
    const providerPaymentId = params.providerPaymentId.trim();

    // Check if payment already exists
    const existingPayment = this.payments.find(
      p => p.provider === providerName && p.providerPaymentId === providerPaymentId
    );

    if (existingPayment) {
      let amountMatches = false;
      try {
        amountMatches = parseMoneyToMinorUnits(existingPayment.amount) === parseMoneyToMinorUnits(params.amount);
      } catch {
        amountMatches = false;
      }

      const orgMatches = existingPayment.organizationId === session.organizationId;
      const checkoutMatches = existingPayment.checkoutSessionId === session.id;
      const currencyMatches = (existingPayment.currency || '').toUpperCase() === (params.currency || 'IDR').toUpperCase();

      if (amountMatches && orgMatches && checkoutMatches && currencyMatches) {
        return {
          status: 'DUPLICATE',
          message: `Payment ID ${providerPaymentId} sudah pernah diproses.`
        };
      }

      // Material economic conflict detected!
      let conflictType = 'PAYMENT_CONFLICT';
      if (!orgMatches) conflictType = 'ORGANIZATION_MISMATCH';
      else if (!checkoutMatches) conflictType = 'CHECKOUT_MISMATCH';
      else if (!amountMatches) conflictType = 'AMOUNT_MISMATCH';
      else if (!currencyMatches) conflictType = 'CURRENCY_MISMATCH';

      const anomaly = {
        id: `anom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        provider: providerName,
        providerPaymentId,
        existingPaymentId: existingPayment.id,
        providerEventId: params.providerEventId || null,
        conflictType,
        incomingAmount: parseMoney(params.amount),
        incomingCurrency: (params.currency || 'IDR').toUpperCase(),
        incomingCheckoutReference: params.checkoutReference,
        details: {
          existing: { ...existingPayment },
          incoming: { organizationId: session.organizationId, checkoutSessionId: session.id, amount: params.amount, currency: params.currency }
        },
        createdAt: new Date().toISOString()
      };
      this.anomalies.push(anomaly);

      return {
        status: 'PAYMENT_CONFLICT',
        message: `Economic conflict detected for payment ID ${providerPaymentId}: ${conflictType}`,
        anomalyId: anomaly.id
      };
    }

    // Handle session already PAID
    if (session.status === 'PAID') {
      const paymentRecord: BillingPaymentEntity = {
        id: `bp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        organizationId: session.organizationId,
        checkoutSessionId: session.id,
        provider: providerName,
        providerPaymentId,
        providerEventId: params.providerEventId,
        amount: parseMoney(params.amount),
        currency: (params.currency || 'IDR').toUpperCase(),
        status: 'OVERPAYMENT_REVIEW',
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      this.payments.push(paymentRecord);

      return {
        status: 'DUPLICATE',
        message: `Checkout session ${params.checkoutReference} sudah berstatus PAID. Pembayaran baru dicatat sebagai OVERPAYMENT_REVIEW.`,
        paymentId: paymentRecord.id,
        organizationId: session.organizationId,
        isOverpaymentReview: true
      };
    }

    if (session.status !== 'PENDING') {
      return {
        status: 'REJECTED',
        message: `Status checkout session adalah ${session.status} (bukan PENDING). Settlement ditolak.`
      };
    }

    if ((params.currency || 'IDR').toUpperCase() !== (session.currency || 'IDR').toUpperCase()) {
      return {
        status: 'REJECTED',
        message: `Mata uang tidak sesuai: diharapkan ${session.currency}, diterima ${params.currency}`
      };
    }

    try {
      const expectedMinor = parseMoneyToMinorUnits(session.amount);
      const paidMinor = parseMoneyToMinorUnits(params.amount);
      if (expectedMinor !== paidMinor) {
        return {
          status: 'REJECTED',
          message: `Jumlah pembayaran tidak sesuai: diharapkan ${session.amount}, diterima ${params.amount}`
        };
      }
    } catch (err: any) {
      return {
        status: 'REJECTED',
        message: `Format nilai pembayaran tidak valid: ${err.message}`
      };
    }

    // Atomic snapshot before mutating
    const sessionSnapshot = { ...session };
    const paymentsSnapshot = [...this.payments];
    const subsSnapshot = subs.map(s => ({ ...s }));

    try {
      // 1. Insert payment
      const paymentRecord: BillingPaymentEntity = {
        id: `bp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        organizationId: session.organizationId,
        checkoutSessionId: session.id,
        provider: providerName,
        providerPaymentId,
        providerEventId: params.providerEventId,
        amount: parseMoney(params.amount),
        currency: (params.currency || 'IDR').toUpperCase(),
        status: 'SETTLED',
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      this.payments.push(paymentRecord);

      if (params.failureInjectionStep === 'after_payment_insert') {
        throw new Error('SIMULATED_FAILURE: after_payment_insert');
      }

      // 2. Update checkout session status
      const identityRepo = getIdentityRepository();
      if ((identityRepo as any).updateCheckoutSessionStatus) {
        await (identityRepo as any).updateCheckoutSessionStatus(session.providerReference, 'PAID');
      }
      session.status = 'PAID';
      session.updatedAt = new Date().toISOString();

      if (params.failureInjectionStep === 'after_checkout_update') {
        throw new Error('SIMULATED_FAILURE: after_checkout_update');
      }

      // 3. Determine plan billing period
      const planId = (session.plan || 'core').toLowerCase().trim();
      let billingPeriod = 'MONTHLY';
      if (planId === 'pilot') billingPeriod = '45_DAYS';
      else if (planId === 'enterprise') billingPeriod = 'YEARLY';

      // 4. Upsert subscription
      const now = new Date();
      let baseDate = now;
      let periodStart = now.toISOString().split('T')[0];

      const currentSub = subs.find(s => s.organizationId === session.organizationId);
      if (currentSub && currentSub.status === 'ACTIVE' && currentSub.currentPeriodEnd) {
        const existingEndDate = new Date(currentSub.currentPeriodEnd);
        if (existingEndDate.getTime() > now.getTime()) {
          baseDate = existingEndDate;
          periodStart = currentSub.currentPeriodStart || periodStart;
        }
      }

      const newPeriodEndDate = calculatePeriodEnd(baseDate, billingPeriod);
      const newPeriodEnd = newPeriodEndDate.toISOString().split('T')[0];

      if (params.failureInjectionStep === 'during_subscription') {
        throw new Error('SIMULATED_FAILURE: during_subscription');
      }

      if ((identityRepo as any).upsertSubscription) {
        await (identityRepo as any).upsertSubscription(session.organizationId, {
          planId: session.plan || 'core',
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: newPeriodEnd
        });
      }

      if (currentSub) {
        currentSub.planId = session.plan || 'core';
        currentSub.status = 'ACTIVE';
        currentSub.currentPeriodStart = periodStart;
        currentSub.currentPeriodEnd = newPeriodEnd;
        currentSub.updatedAt = new Date().toISOString();
      } else {
        subs.push({
          id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          organizationId: session.organizationId,
          planId: session.plan || 'core',
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: newPeriodEnd,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      return {
        status: 'PROCESSED',
        message: `Pembayaran SaaS berhasil disettle untuk organisasi ${session.organizationId}. Subscription aktif hingga ${newPeriodEnd}.`,
        paymentId: paymentRecord.id,
        organizationId: session.organizationId,
        newPeriodEnd
      };
    } catch (err) {
      // Rollback memory state
      Object.assign(session, sessionSnapshot);
      this.payments = paymentsSnapshot;
      subs.length = 0;
      subs.push(...subsSnapshot);
      throw err;
    }
  }

  public async getPaymentByProviderPaymentId(provider: string, providerPaymentId: string): Promise<BillingPaymentEntity | null> {
    return this.payments.find(p => p.provider === provider && p.providerPaymentId === providerPaymentId) || null;
  }

  public async getPaymentsByOrgId(orgId: string): Promise<BillingPaymentEntity[]> {
    return this.payments.filter(p => p.organizationId === orgId);
  }
}

let explicitBillingSettlementRepository: IBillingSettlementRepository | null = null;
const inMemorySettlementRepo = new InMemoryBillingSettlementRepository();

export function setBillingSettlementRepository(repo: IBillingSettlementRepository | null): void {
  explicitBillingSettlementRepository = repo;
}

export function getBillingSettlementRepository(): IBillingSettlementRepository {
  if (explicitBillingSettlementRepository) {
    return explicitBillingSettlementRepository;
  }
  const identityRepo = getIdentityRepository();
  if ((identityRepo as any).checkoutSessions) {
    return inMemorySettlementRepo;
  }
  return new PostgresBillingSettlementRepository();
}
