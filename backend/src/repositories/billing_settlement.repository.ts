// ============================================================================
// COVE Backend — Canonical Billing Settlement Repository (Gate P0-C.2)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// Ensures single ACID transaction for:
// - Locking checkout session
// - Validating tenant, exact amount, currency, and provider payment status
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
  status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED' | 'REJECTED';
  message: string;
  paymentId?: string;
  organizationId?: string;
  subscriptionId?: string;
  newPeriodEnd?: string;
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

      // 2. Validate status: only PENDING or already PAID
      if (session.status === 'PAID') {
        await client.query('COMMIT');
        return {
          status: 'DUPLICATE',
          message: `Checkout session ${params.checkoutReference} sudah berstatus PAID. Tidak ada mutasi ganda.`
        };
      }

      if (session.status !== 'PENDING') {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: `Status checkout session adalah ${session.status} (bukan PENDING). Settlement ditolak.`
        };
      }

      // 3. Validate provider payment status: only terminal successful status allowed
      const normStatus = (params.paymentStatus || '').toLowerCase().trim();
      if (normStatus !== 'settled' && normStatus !== 'paid' && normStatus !== 'success') {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: `Status pembayaran provider tidak valid untuk settlement: ${params.paymentStatus}`
        };
      }

      // 4. Validate currency (case-insensitive)
      if ((params.currency || 'IDR').toUpperCase() !== (session.currency || 'IDR').toUpperCase()) {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: `Mata uang tidak sesuai: diharapkan ${session.currency}, diterima ${params.currency}`
        };
      }

      // 5. Validate exact money amount
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

      // 6. Validate provider payment ID
      if (!params.providerPaymentId || !params.providerPaymentId.trim()) {
        await client.query('ROLLBACK');
        return {
          status: 'REJECTED',
          message: 'Provider payment ID wajib diisi dan tidak boleh kosong.'
        };
      }

      // 7. Check if provider payment ID was already processed (durable payment idempotency)
      const payCheck = await client.query(
        `SELECT id FROM public.billing_payments WHERE provider = $1 AND provider_payment_id = $2 FOR UPDATE`,
        [params.provider || 'MAYAR', params.providerPaymentId.trim()]
      );
      if (payCheck.rows.length > 0) {
        await client.query('COMMIT');
        return {
          status: 'DUPLICATE',
          message: `Payment ID ${params.providerPaymentId} sudah pernah diproses.`
        };
      }

      // 8. Insert canonical payment record
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
          params.provider || 'MAYAR',
          params.providerPaymentId.trim(),
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

      // 9. Update checkout session status to PAID
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

      // 10. Lock and calculate subscription extension
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

      const newPeriodEnd = new Date(baseDate.getTime() + 30 * 24 * 3600 * 1000).toISOString();

      // Failure injection 3
      if (params.failureInjectionStep === 'during_subscription') {
        throw new Error('SIMULATED_FAILURE: during_subscription');
      }

      // 11. Upsert subscription
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

    if (session.status === 'PAID') {
      return {
        status: 'DUPLICATE',
        message: `Checkout session ${params.checkoutReference} sudah berstatus PAID. Tidak ada mutasi ganda.`
      };
    }

    if (session.status !== 'PENDING') {
      return {
        status: 'REJECTED',
        message: `Status checkout session adalah ${session.status} (bukan PENDING). Settlement ditolak.`
      };
    }

    const normStatus = (params.paymentStatus || '').toLowerCase().trim();
    if (normStatus !== 'settled' && normStatus !== 'paid' && normStatus !== 'success') {
      return {
        status: 'REJECTED',
        message: `Status pembayaran provider tidak valid untuk settlement: ${params.paymentStatus}`
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

    if (!params.providerPaymentId || !params.providerPaymentId.trim()) {
      return {
        status: 'REJECTED',
        message: 'Provider payment ID wajib diisi dan tidak boleh kosong.'
      };
    }

    const existingPayment = this.payments.find(
      p => p.provider === (params.provider || 'MAYAR') && p.providerPaymentId === params.providerPaymentId.trim()
    );
    if (existingPayment) {
      return {
        status: 'DUPLICATE',
        message: `Payment ID ${params.providerPaymentId} sudah pernah diproses.`
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
        provider: params.provider || 'MAYAR',
        providerPaymentId: params.providerPaymentId.trim(),
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

      // 3. Upsert subscription
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

      const newPeriodEnd = new Date(baseDate.getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

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
