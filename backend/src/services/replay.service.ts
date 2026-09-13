// ============================================================================
// COVE Backend — Canonical Webhook Replay Service (Gate P0-C.3)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// Ensures safe recovery of unresolved, retryable, or out-of-order webhook events:
// - Admin-only authorization
// - Idempotent re-execution (ALREADY_PROCESSED short-circuit)
// - Concurrency protection via DB lease claim
// - No bypass: routes through canonical PostgresBillingSettlementRepository.settlePayment()
// - Immutable audit logging to public.webhook_replay_attempts
// - Attempt counting incremented atomically in SQL
// ============================================================================

import { pgPool } from '../db/store.js';
import { getWebhookRepository } from '../repositories/webhook.repository.js';
import { getBillingSettlementRepository } from '../repositories/billing_settlement.repository.js';
import type { ReplayResultStatus } from '../types/domain.js';

export interface ReplayResult {
  status: ReplayResultStatus;
  message: string;
  attemptId?: string;
  paymentId?: string;
  newPeriodEnd?: string;
}

export interface QueryableReplayClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release: () => void;
}

export interface QueryableReplayPool {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  connect?: () => Promise<QueryableReplayClient>;
}

export class ReplayService {
  private static pool: QueryableReplayPool = pgPool;

  public static setPool(customPool: QueryableReplayPool): void {
    ReplayService.pool = customPool;
  }

  private static async getClient(): Promise<QueryableReplayClient> {
    if (this.pool && typeof this.pool.connect === 'function') {
      return await this.pool.connect();
    }
    return {
      query: (sql: string, params?: any[]) => this.pool.query(sql, params),
      release: () => {}
    };
  }

  private static async recordAttempt(params: {
    webhookEventId: string;
    adminId?: string | null;
    resultStatus: ReplayResultStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
    durationMs?: number | null;
  }): Promise<string | undefined> {
    try {
      const client = await this.getClient();
      try {
        const res = await client.query(
          `INSERT INTO public.webhook_replay_attempts (
             webhook_event_id, initiated_by_admin_id, result_status, error_code, error_message, duration_ms
           ) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            params.webhookEventId,
            params.adminId || null,
            params.resultStatus,
            params.errorCode || null,
            params.errorMessage || null,
            params.durationMs || 0
          ]
        );
        return res.rows[0]?.id;
      } finally {
        client.release();
      }
    } catch (err) {
      // In-memory or fallback mode: log warning, do not crash replay
      console.warn('Could not record replay attempt to PostgreSQL:', err);
      return undefined;
    }
  }

  /**
   * Replays an existing webhook event by internal UUID.
   * NEVER bypasses settlement validation.
   * Re-routes through canonical BillingSettlementRepository.settlePayment().
   */
  public static async replayWebhookEvent(
    eventId: string,
    adminId?: string | null
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    const webhookRepo = getWebhookRepository();

    // 1. Fetch event by internal ID
    const event = await webhookRepo.findWebhookEventById(eventId);
    if (!event) {
      return {
        status: 'NOT_FOUND',
        message: `Webhook event dengan ID ${eventId} tidak ditemukan.`
      };
    }

    // 2. Short-circuit: already processed events require no re-execution
    if (event.processingStatus === 'PROCESSED') {
      const attemptId = await this.recordAttempt({
        webhookEventId: event.id,
        adminId,
        resultStatus: 'ALREADY_PROCESSED',
        durationMs: Date.now() - startTime
      });
      return {
        status: 'ALREADY_PROCESSED',
        message: `Event ID ${event.eventId} sudah berstatus PROCESSED. Tidak ada mutasi ulang.`,
        attemptId
      };
    }

    // 3. Enforce bounded replay policy (max 10 attempts)
    if (event.attemptCount >= 10) {
      await webhookRepo.markFailed(event.id, 'MAX_ATTEMPTS_EXCEEDED', 'Maksimum batas replay percobaan (10) telah terlampaui.');
      const attemptId = await this.recordAttempt({
        webhookEventId: event.id,
        adminId,
        resultStatus: 'FAILED',
        errorCode: 'MAX_ATTEMPTS_EXCEEDED',
        errorMessage: 'Maksimum batas replay percobaan telah terlampaui.',
        durationMs: Date.now() - startTime
      });
      return {
        status: 'FAILED',
        message: 'Maksimum batas replay percobaan (10) telah terlampaui. Status ditandai FAILED_FINAL.',
        attemptId
      };
    }

    // 4. Claim processing lease atomically to prevent concurrent double-replay
    const leaseAcquired = await webhookRepo.claimProcessingLease(event.id);
    if (!leaseAcquired) {
      const attemptId = await this.recordAttempt({
        webhookEventId: event.id,
        adminId,
        resultStatus: 'CONCURRENCY_BLOCKED',
        errorCode: 'LEASE_ACQUIRE_FAILED',
        errorMessage: 'Proses replay sedang berjalan pada transaksi lain atau lease belum kedaluwarsa.',
        durationMs: Date.now() - startTime
      });
      return {
        status: 'CONCURRENCY_BLOCKED',
        message: 'Proses replay untuk event ini sedang berlangsung di transaksi lain.',
        attemptId
      };
    }

    // 5. Execute canonical settlement flow
    try {
      const payload: any = event.payload || {};
      if (event.eventType === 'payment.settled') {
        const checkoutRef = payload.data?.id || payload.data?.checkout_id || payload.data?.checkout_reference;
        if (!checkoutRef) {
          await webhookRepo.markReviewRequired(event.id, 'MISSING_CHECKOUT_REF', 'Settlement tanpa checkout reference tidak dapat diproses.');
          const attemptId = await this.recordAttempt({
            webhookEventId: event.id,
            adminId,
            resultStatus: 'REVIEW_REQUIRED',
            errorCode: 'MISSING_CHECKOUT_REF',
            durationMs: Date.now() - startTime
          });
          return {
            status: 'REVIEW_REQUIRED',
            message: 'Checkout reference tidak ada dalam payload event.',
            attemptId
          };
        }

        const providerPaymentId = payload.data?.payment_id || payload.data?.transaction_id || payload.data?.id;
        const billingSettlementRepo = getBillingSettlementRepository();

        const settlementResult = await billingSettlementRepo.settlePayment({
          provider: event.provider || 'MAYAR',
          checkoutReference: checkoutRef,
          providerPaymentId: providerPaymentId || '',
          providerEventId: event.eventId,
          amount: payload.data?.amount,
          currency: payload.data?.currency || 'IDR',
          paymentStatus: payload.data?.status || 'settled'
        });

        if (settlementResult.status === 'PROCESSED') {
          await webhookRepo.markProcessed(event.id);
          const attemptId = await this.recordAttempt({
            webhookEventId: event.id,
            adminId,
            resultStatus: 'REPLAYED',
            durationMs: Date.now() - startTime
          });
          return {
            status: 'REPLAYED',
            message: settlementResult.message,
            paymentId: settlementResult.paymentId,
            newPeriodEnd: settlementResult.newPeriodEnd,
            attemptId
          };
        }

        if (settlementResult.status === 'DUPLICATE') {
          await webhookRepo.markProcessed(event.id);
          const attemptId = await this.recordAttempt({
            webhookEventId: event.id,
            adminId,
            resultStatus: 'ALREADY_PROCESSED',
            durationMs: Date.now() - startTime
          });
          return {
            status: 'ALREADY_PROCESSED',
            message: settlementResult.message,
            attemptId
          };
        }

        if (settlementResult.status === 'IGNORED') {
          // Out of order: checkout still not found
          await webhookRepo.markReviewRequired(event.id, 'UNKNOWN_CHECKOUT_REF', settlementResult.message);
          const attemptId = await this.recordAttempt({
            webhookEventId: event.id,
            adminId,
            resultStatus: 'REVIEW_REQUIRED',
            errorCode: 'UNKNOWN_CHECKOUT_REF',
            errorMessage: settlementResult.message,
            durationMs: Date.now() - startTime
          });
          return {
            status: 'REVIEW_REQUIRED',
            message: settlementResult.message,
            attemptId
          };
        }

        if (settlementResult.status === 'PAYMENT_CONFLICT') {
          await webhookRepo.markReviewRequired(event.id, 'PAYMENT_CONFLICT', settlementResult.message);
          const attemptId = await this.recordAttempt({
            webhookEventId: event.id,
            adminId,
            resultStatus: 'REVIEW_REQUIRED',
            errorCode: 'PAYMENT_CONFLICT',
            errorMessage: settlementResult.message,
            durationMs: Date.now() - startTime
          });
          return {
            status: 'REVIEW_REQUIRED',
            message: settlementResult.message,
            attemptId
          };
        }

        // REJECTED
        await webhookRepo.markFailed(event.id, 'SETTLEMENT_REJECTED', settlementResult.message);
        const attemptId = await this.recordAttempt({
          webhookEventId: event.id,
          adminId,
          resultStatus: 'FAILED',
          errorCode: 'SETTLEMENT_REJECTED',
          errorMessage: settlementResult.message,
          durationMs: Date.now() - startTime
        });
        return {
          status: 'FAILED',
          message: settlementResult.message,
          attemptId
        };
      }

      // Non-settled event types (e.g. payment.expired)
      await webhookRepo.markProcessed(event.id);
      const attemptId = await this.recordAttempt({
        webhookEventId: event.id,
        adminId,
        resultStatus: 'REPLAYED',
        durationMs: Date.now() - startTime
      });
      return {
        status: 'REPLAYED',
        message: `Event type ${event.eventType} berhasil ditandai selesai.`,
        attemptId
      };
    } catch (err: any) {
      await webhookRepo.markRetryable(event.id, 'REPLAY_EXCEPTION', err.message || 'Unknown exception');
      const attemptId = await this.recordAttempt({
        webhookEventId: event.id,
        adminId,
        resultStatus: 'FAILED',
        errorCode: 'REPLAY_EXCEPTION',
        errorMessage: err.message,
        durationMs: Date.now() - startTime
      });
      throw err;
    }
  }
}
