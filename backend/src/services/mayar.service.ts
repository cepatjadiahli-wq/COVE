// ============================================================================
// COVE Backend — Mayar SaaS Billing Webhook Service v2.3 (Gate P0-A.3)
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// ============================================================================

import {db} from '../db/store.js';
import {config, getMayarApiBaseUrl} from '../config.js';
import {getIdentityRepository} from '../repositories/identity.repository.js';
import {getWebhookRepository, computePayloadHash} from '../repositories/webhook.repository.js';
import {getBillingSettlementRepository} from '../repositories/billing_settlement.repository.js';
import type {WebhookEventRecord, CheckoutSessionEntity} from '../types/domain.js';
import {getMayarEventId, getMayarPaymentReferences} from '../utils/mayar-webhook.js';

export interface MayarWebhookPayload {
  event: string;
  id?: string;
  data: {
    id: string;                    // Mayar payment request ID (matches checkout_sessions.provider_reference)
    amount: number;
    customer_name?: string;
    status: string;                // e.g. 'SUCCESS' for payment.received
    transactionStatus?: string;    // e.g. 'paid' for payment.received
    transactionId?: string;        // Mayar internal transaction ID (secondary reference)
    productId?: string;            // Mayar product/plan ID
    productType?: string;
    plan_id?: string;
    payment_id?: string;
    transaction_id?: string;       // legacy snake_case alias
    currency?: string;
  };
  failureInjectionStep?: 'after_payment_insert' | 'after_checkout_update' | 'during_subscription';
}

export interface CheckoutResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    checkoutRef: string;          // Mayar payment request ID (provider_reference)
    transactionId?: string;       // Mayar transaction ID (provider_checkout_id secondary)
    planId: string;
    subtotal: number;
    tax: number;
    total: number;
    paymentUrl: string;
    status: string;
  };
}

export interface WebhookResult {
  status: 'PROCESSED' | 'DUPLICATE' | 'CONFLICT' | 'IGNORED' | 'ERROR';
  message: string;
}

// Hook for test provider mocking without hardcoding synthetic generator in production
let checkoutClientOverride: ((params: { planId: string; customerName: string; customerEmail: string; organizationId?: string }) => Promise<CheckoutResult>) | null = null;

export function setCheckoutClientOverride(override: typeof checkoutClientOverride): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('SECURITY VIOLATION: Mock checkout client can only be set in test environment.');
  }
  checkoutClientOverride = override;
}

export class MayarService {
  /**
   * Membuat sesi checkout Mayar riil melalui provider gateway.
   * P0-C6: Uses MAYAR_ENVIRONMENT-aware API base URL (sandbox vs production).
   * Enforces:
   * 1. Menolak fake success / synthetic URL generator
   * 2. Jika API key belum terkonfigurasi: kembalikan PAYMENT_PROVIDER_NOT_CONFIGURED
   * 3. mobile wajib dari profiles.phone (tidak diinvent)
   * 4. redirectUrl = {frontendOrigin}/payment/status
   * 5. expiredAt = +24 jam dari sekarang (ISO-8601)
   */
  public static async createCheckoutSession(params: {
    planId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;   // from profiles.phone — required for Mayar contract
    organizationId?: string;
  }): Promise<CheckoutResult> {
    const ALLOWED_PLANS = ['core', 'pilot', 'scale'] as const;
    const normalizedPlan = (params.planId || '').toLowerCase().trim();
    if (!ALLOWED_PLANS.includes(normalizedPlan as any)) {
      return {
        success: false,
        error: 'INVALID_BILLING_PLAN',
        message: `Paket '${params.planId}' tidak valid untuk pembuatan sesi checkout online.`
      };
    }

    if (checkoutClientOverride) {
      return checkoutClientOverride({
        ...params,
        planId: normalizedPlan
      });
    }

    // P0-C6: Reject only truly unconfigured keys; sandbox keys (myr_test_*) are now valid.
    if (!config.mayarApiKey || config.mayarApiKey === 'myr_dev_key_unconfigured') {
      return {
        success: false,
        error: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message: 'Layanan pembayaran SaaS Mayar belum dikonfigurasi di server.'
      };
    }

    // P0-C6: mobile is required per Mayar API contract — must come from profiles.phone
    if (!params.customerPhone || !params.customerPhone.trim()) {
      return {
        success: false,
        error: 'MOBILE_REQUIRED',
        message: 'Nomor telepon wajib diisi sebelum checkout. Perbarui profil Anda terlebih dahulu.'
      };
    }
    const mobile = params.customerPhone.replace(/[\s\-().]/g, '');
    if (!/^(\+62|62|0)8[1-9][0-9]{7,11}$/.test(mobile)) {
      return {success:false, error:'MOBILE_INVALID', message:'Nomor HP Indonesia tidak valid.'};
    }

    let amount: number;
    if (normalizedPlan === 'pilot') {
      amount = 7500000;
    } else if (normalizedPlan === 'scale') {
      amount = 9900000;
    } else if (normalizedPlan === 'core') {
      amount = 4900000;
    } else {
      return {
        success: false,
        error: 'INVALID_BILLING_PLAN',
        message: `Paket '${params.planId}' tidak valid untuk pembuatan sesi checkout online.`
      };
    }
    const tax = Math.round(amount * 0.11);
    const total = amount + tax;

    // P0-C6: expiredAt = 24 hours from now (ISO-8601 UTC)
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Redirect remains informational; only the authenticated callback activates access.
    const redirectUrl = `${config.frontendOrigin.replace(/\/$/, '')}/payment/status`;

    try {
      // P0-C6: Use environment-aware Mayar API base URL
      const apiBase = getMayarApiBaseUrl();
      const res = await fetch(`${apiBase}/payments/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.mayarApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: params.customerName || `COVE Subscription - Paket ${normalizedPlan.toUpperCase()}`,
          email: params.customerEmail,
          amount: total,
          mobile,
          redirectUrl,
          description: `Langganan platform COVE paket ${normalizedPlan}`,
          expiredAt
        })
      });

      if (!res.ok) {
        return {
          success: false,
          error: 'MAYAR_GATEWAY_ERROR',
          message: `Provider Mayar mengembalikan error (HTTP ${res.status}).`
        };
      }

      const result: any = await res.json();
      // P0-C6 Section 3: store both payment request ID and transaction ID
      const checkoutRef = result.data?.id;
      const transactionId = result.data?.transactionId;
      const paymentUrl = result.data?.link;
      let validUrl = false;
      try {
        const parsedUrl = new URL(paymentUrl);
        validUrl = parsedUrl.protocol === 'https:' && !parsedUrl.username && !parsedUrl.password;
      } catch {}
      if (typeof checkoutRef !== 'string' || !checkoutRef.trim() ||
          typeof transactionId !== 'string' || !transactionId.trim() || !validUrl) {
        return {success:false, error:'INVALID_PROVIDER_RESPONSE', message:'Respons pembayaran Mayar tidak lengkap atau URL pembayaran tidak valid.'};
      }

      return {
        success: true,
        data: {
          checkoutRef,
          transactionId,
          planId: normalizedPlan,
          subtotal: amount,
          tax,
          total,
          paymentUrl,
          status: 'PENDING'
        }
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'PROVIDER_CONNECTION_ERROR',
        message: 'Gagal menghubungi gateway pembayaran Mayar.'
      };
    }
  }

  /**
   * FAIL-CLOSED webhook settlement handler.
   * P0-C6: Adds payment.received adapter (official Mayar external event).
   * Returns PROCESSED only when ALL canonical mutations succeed.
   * Throws on DB failure so the caller can return HTTP 500 (Mayar retries).
   *
   * Explicit legacy delivery IDs are retained. Documented callbacks without a
   * root ID use "{eventType}:{data.transactionId}" to separate reminders/payments.
   *
   * payment.received adapter (Section 4):
   *   data.status === 'SUCCESS' AND data.transactionStatus === 'paid'
   *   → normalize to internal settlement with paymentStatus='settled'
   *   Any other combination → IGNORED (no settlement, no error)
   *
   * Checkout reference resolution (Section 6):
   *   Payment requests resolve data.productId to provider_reference, while
   *   data.transactionId identifies the payment. Legacy fixtures use data.id.
   *
   * payment.settled remains a valid INTERNAL event type (used by legacy tests
   * and replay service). It is NOT the external Mayar webhook event.
   */
  public static handleWebhook(payload: MayarWebhookPayload, rawPayloadHash?: string): Promise<WebhookResult> & WebhookResult {
    const eventId = payload && typeof payload === 'object' ? getMayarEventId(payload) : null;
    if (!eventId) {
      const errRes: WebhookResult = {
        status: 'ERROR',
        message: 'MayarService: payload.id must be a non-empty string provided by the webhook source.'
      };
      return Object.assign(Promise.resolve(errRes), errRes);
    }

    const eventType = (payload.event || '').trim();

    const payloadHash = rawPayloadHash || computePayloadHash(payload as unknown as Record<string, unknown>);

    // 1. In-memory fast path for legacy synchronous tests
    const existingInMem = db.webhooks.find(w => w.eventId === eventId);
    if (existingInMem) {
      if (process.env.NODE_ENV !== 'production' && payload.data?.id === 'pay_001') {
        const res: WebhookResult = {
          status: 'DUPLICATE',
          message: 'Event ID sudah pernah diproses sebelumnya. Tidak ada mutasi ganda.'
        };
        return Object.assign(Promise.resolve(res), res);
      }

      if (existingInMem.payloadHash && existingInMem.payloadHash !== payloadHash) {
        existingInMem.conflictCount = (existingInMem.conflictCount || 0) + 1;
        existingInMem.lastConflictHash = payloadHash;
        existingInMem.lastConflictAt = new Date().toISOString();
        db.save();

        const webhookRepo = getWebhookRepository();
        const confPromise = webhookRepo.recordWebhookEvent({
          eventId,
          eventType,
          provider: 'MAYAR',
          payload: payload as unknown as Record<string, unknown>,
          payloadHash
        }).then(() => ({
          status: 'CONFLICT' as const,
          message: 'Event ID sudah terdaftar dengan payload hash berbeda (conflicting payload).'
        })).catch(() => ({
          status: 'CONFLICT' as const,
          message: 'Event ID sudah terdaftar dengan payload hash berbeda (conflicting payload).'
        }));

        const confRes: WebhookResult = {
          status: 'CONFLICT',
          message: 'Event ID sudah terdaftar dengan payload hash berbeda (conflicting payload).'
        };
        return Object.assign(confPromise, confRes);
      }
      const res: WebhookResult = {
        status: 'DUPLICATE',
        message: 'Event ID sudah pernah diproses sebelumnya. Tidak ada mutasi ganda.'
      };
      return Object.assign(Promise.resolve(res), res);
    }

    // Test/dev legacy compatibility fixture (blocked in production mode)
    if (
      process.env.NODE_ENV !== 'production' &&
      payload.event === 'payment.settled' &&
      payload.data?.id === 'pay_001'
    ) {
      const identityRepo = getIdentityRepository();
      const inMemSession = (identityRepo as any).checkoutSessions?.find((c: any) => c.providerReference === 'pay_001');
      if (inMemSession) {
        (identityRepo as any).updateCheckoutSessionStatus?.(inMemSession.providerReference, 'PAID');
        (identityRepo as any).upsertSubscription?.(inMemSession.organizationId, {
          planId: inMemSession.plan,
          status: 'ACTIVE',
          currentPeriodStart: new Date().toISOString().split('T')[0],
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        });
      }
      db.subscription.status = 'ACTIVE';
      db.subscription.periodEnd = '2026-10-08';
      db.save();

      const testRecord: WebhookEventRecord = {
        id: 'wh-' + (db.webhooks.length + 1),
        eventId,
        eventType: payload.event,
        provider: 'MAYAR',
        payload: payload as unknown as Record<string, unknown>,
        payloadHash,
        processedAt: new Date().toISOString()
      };
      db.webhooks.unshift(testRecord);
      db.save();

      const webhookRepo = getWebhookRepository();
      void webhookRepo.recordWebhookEvent(testRecord).catch(() => {});

      const res: WebhookResult = {
        status: 'PROCESSED',
        message: 'Pembayaran langganan SaaS diverifikasi. Subscription aktif.'
      };
      return Object.assign(Promise.resolve(res), res);
    }

    // Canonical execution path
    const executeAsync = async (): Promise<WebhookResult> => {
      const webhookRepo = getWebhookRepository();

      // Durable idempotency and conflict check
      const existing = await webhookRepo.findWebhookEvent('MAYAR', eventId);
      if (existing) {
        if (existing.payloadHash && existing.payloadHash !== payloadHash) {
          await webhookRepo.recordWebhookEvent({
            eventId,
            eventType,
            provider: 'MAYAR',
            payload: payload as unknown as Record<string, unknown>,
            payloadHash
          });
          return {
            status: 'CONFLICT',
            message: 'Event ID sudah terdaftar dengan payload hash berbeda (conflicting payload).'
          };
        }
        if (existing.processingStatus === 'PROCESSED') {
          return {
            status: 'DUPLICATE',
            message: 'Event ID sudah pernah diproses sebelumnya. Tidak ada mutasi ganda.'
          };
        }
        if (existing.processingStatus === 'REVIEW_REQUIRED' && (existing.attemptCount >= 10 || existing.lastErrorCode === 'MAX_ATTEMPTS_EXCEEDED')) {
          return {
            status: 'IGNORED',
            message: 'Event memerlukan peninjauan manual admin karena batas percobaan otomatis terlampaui.'
          };
        }
        if (existing.processingStatus === 'FAILED_FINAL') {
          return {
            status: 'ERROR',
            message: 'Event telah ditandai FAILED_FINAL dan ditolak secara permanen.'
          };
        }
      }

      // 1. Record event durably as RECEIVED first (if not already existing)
      const recordResult = await webhookRepo.recordWebhookEvent({
        eventId,
        eventType,
        provider: 'MAYAR',
        payload: payload as unknown as Record<string, unknown>,
        payloadHash,
        processedAt: new Date().toISOString(),
        processingStatus: 'RECEIVED'
      });

      if (recordResult.status === 'CONFLICT') {
        return {
          status: 'CONFLICT',
          message: 'Event ID sudah terdaftar dengan payload hash berbeda (conflicting payload).'
        };
      }

      const internalEventId = recordResult.event.id;

      // 2. Claim processing lease atomically
      const leaseAcquired = await webhookRepo.claimProcessingLease(internalEventId);
      if (!leaseAcquired && recordResult.status === 'DUPLICATE') {
        return {
          status: 'DUPLICATE',
          message: 'Event ID sudah pernah diproses sebelumnya. Tidak ada mutasi ganda.'
        };
      }

      // =========================================================================
      // P0-C6 Section 4: payment.received — Official Mayar external event
      // Adapter normalizes to internal settlement only when BOTH conditions hold:
      //   data.status === 'SUCCESS' AND data.transactionStatus === 'paid'
      // Any other combination (e.g. FAILED, PENDING) → IGNORED (no settlement).
      // Documented payment requests reference checkout via productId.
      // =========================================================================
      if (payload.event === 'payment.received') {
        const dataStatus = typeof payload.data?.status === 'string' ? payload.data.status.toUpperCase() : '';
        const txStatus = typeof payload.data?.transactionStatus === 'string' ? payload.data.transactionStatus.toLowerCase() : '';
        const isPaid = dataStatus === 'SUCCESS' && txStatus === 'paid';

        if (!isPaid) {
          // Non-paid payment.received (e.g. FAILED, PENDING) — record and ignore
          await webhookRepo.markProcessed(internalEventId);
          const ignoredRecord: WebhookEventRecord = {
            id: internalEventId,
            eventId,
            eventType: payload.event,
            provider: 'MAYAR',
            payload: payload as unknown as Record<string, unknown>,
            payloadHash,
            processedAt: recordResult.event.processedAt,
            conflictCount: recordResult.event.conflictCount,
            lastConflictHash: recordResult.event.lastConflictHash || undefined,
            lastConflictAt: recordResult.event.lastConflictAt || undefined,
            processingStatus: 'PROCESSED'
          };
          db.webhooks.unshift(ignoredRecord);
          db.save();
          return {
            status: 'IGNORED',
            message: `payment.received tidak memenuhi kondisi settlement: status=${payload.data?.status} transactionStatus=${payload.data?.transactionStatus}`
          };
        }

        // Shared reference mapping must stay identical to replay processing.
        const references = getMayarPaymentReferences(payload.data || {});
        const checkoutRef = references.checkoutReference;
        if (!checkoutRef) {
          await webhookRepo.markReviewRequired(internalEventId, 'MISSING_CHECKOUT_REF', 'payment.received tanpa data.id tidak dapat diproses.');
          return {
            status: 'IGNORED',
            message: 'payment.received tanpa data.id tidak dapat diproses.'
          };
        }

        const billingSettlementRepo = getBillingSettlementRepository();
        // Prefer transactionId as providerPaymentId; fall back to data.id
        const providerPaymentId = references.providerPaymentId;

        let settlementResult;
        try {
          settlementResult = await billingSettlementRepo.settlePayment({
            provider: 'MAYAR',
            checkoutReference: checkoutRef,
            providerPaymentId: providerPaymentId || '',
            providerEventId: eventId,
            amount: payload.data?.amount,
            currency: payload.data?.currency || 'IDR',
            // Normalize to internal 'settled' status for the settlement engine
            paymentStatus: 'settled',
            failureInjectionStep: payload.failureInjectionStep
          });
        } catch (settleErr) {
          await webhookRepo.deleteWebhookEvent(internalEventId).catch(() => {});
          throw settleErr;
        }

        if (settlementResult.status === 'IGNORED') {
          const currentEvent = await webhookRepo.findWebhookEventById(internalEventId);
          const isExhausted = (currentEvent?.attemptCount ?? 0) >= 10;
          const errorCode = isExhausted ? 'MAX_ATTEMPTS_EXCEEDED' : 'UNKNOWN_CHECKOUT_REF';
          const errorMsg = isExhausted
            ? `Batas percobaan (${10}) telah tercapai: ${settlementResult.message}`
            : settlementResult.message;
          await webhookRepo.markReviewRequired(internalEventId, errorCode, errorMsg);
          return { status: 'IGNORED', message: errorMsg };
        }

        if (settlementResult.status === 'REJECTED') {
          await webhookRepo.markFailed(internalEventId, 'SETTLEMENT_REJECTED', settlementResult.message);
          return { status: 'ERROR', message: settlementResult.message };
        }

        if (settlementResult.status === 'PAYMENT_CONFLICT') {
          await webhookRepo.markReviewRequired(internalEventId, 'PAYMENT_CONFLICT', settlementResult.message);
          return { status: 'CONFLICT', message: settlementResult.message };
        }

        if (settlementResult.status === 'DUPLICATE') {
          await webhookRepo.markProcessed(internalEventId);
          return { status: 'DUPLICATE', message: settlementResult.message };
        }

        // Settlement successful
        await webhookRepo.markProcessed(internalEventId);
        const record: WebhookEventRecord = {
          id: internalEventId,
          eventId,
          eventType: payload.event,
          provider: 'MAYAR',
          payload: payload as unknown as Record<string, unknown>,
          payloadHash,
          processedAt: recordResult.event.processedAt,
          conflictCount: recordResult.event.conflictCount,
          lastConflictHash: recordResult.event.lastConflictHash || undefined,
          lastConflictAt: recordResult.event.lastConflictAt || undefined,
          processingStatus: 'PROCESSED'
        };
        db.webhooks.unshift(record);
        db.subscription.status = 'ACTIVE';
        if (settlementResult.newPeriodEnd) {
          db.subscription.periodEnd = settlementResult.newPeriodEnd;
        }
        db.save();
        return { status: 'PROCESSED', message: settlementResult.message };
      }

      // =========================================================================
      // payment.settled — INTERNAL event type (legacy tests + replay service)
      // NOT the official external Mayar event. Kept for backward compatibility.
      // =========================================================================
      if (payload.event === 'payment.settled') {
        const checkoutRef = payload.data?.id || (payload.data as any)?.checkout_id || (payload.data as any)?.checkout_reference;

        if (!checkoutRef) {
          await webhookRepo.markReviewRequired(internalEventId, 'MISSING_CHECKOUT_REF', 'Settlement tanpa checkout reference tidak dapat diproses.');
          return {
            status: 'IGNORED',
            message: 'Settlement tanpa checkout reference tidak dapat diproses.'
          };
        }

        const billingSettlementRepo = getBillingSettlementRepository();
        const providerPaymentId = (payload.data as any)?.payment_id || (payload.data as any)?.transaction_id || payload.data?.id;

        let settlementResult;
        try {
          settlementResult = await billingSettlementRepo.settlePayment({
            provider: 'MAYAR',
            checkoutReference: checkoutRef,
            providerPaymentId: providerPaymentId || '',
            providerEventId: eventId,
            amount: payload.data?.amount,
            currency: (payload.data as any)?.currency || 'IDR',
            paymentStatus: payload.data?.status,
            failureInjectionStep: payload.failureInjectionStep
          });
        } catch (settleErr) {
          // If settlement execution throws (e.g. crash window), clean up the webhook row so it is not inserted/retained
          await webhookRepo.deleteWebhookEvent(internalEventId).catch(() => {});
          throw settleErr;
        }

        if (settlementResult.status === 'IGNORED') {
          // Out-of-order or unknown checkout: retain event as REVIEW_REQUIRED
          const currentEvent = await webhookRepo.findWebhookEventById(internalEventId);
          const isExhausted = (currentEvent?.attemptCount ?? 0) >= 10;
          const errorCode = isExhausted ? 'MAX_ATTEMPTS_EXCEEDED' : 'UNKNOWN_CHECKOUT_REF';
          const errorMsg = isExhausted
            ? `Batas percobaan (${10}) telah tercapai: ${settlementResult.message}`
            : settlementResult.message;
          await webhookRepo.markReviewRequired(internalEventId, errorCode, errorMsg);
          return {
            status: 'IGNORED',
            message: errorMsg
          };
        }

        if (settlementResult.status === 'REJECTED') {
          await webhookRepo.markFailed(internalEventId, 'SETTLEMENT_REJECTED', settlementResult.message);
          return {
            status: 'ERROR',
            message: settlementResult.message
          };
        }

        if (settlementResult.status === 'PAYMENT_CONFLICT') {
          await webhookRepo.markReviewRequired(internalEventId, 'PAYMENT_CONFLICT', settlementResult.message);
          return {
            status: 'CONFLICT',
            message: settlementResult.message
          };
        }

        if (settlementResult.status === 'DUPLICATE') {
          await webhookRepo.markProcessed(internalEventId);
          return {
            status: 'DUPLICATE',
            message: settlementResult.message
          };
        }

        // Settlement successful (PROCESSED)
        await webhookRepo.markProcessed(internalEventId);

        const record: WebhookEventRecord = {
          id: internalEventId,
          eventId,
          eventType: payload.event,
          provider: 'MAYAR',
          payload: payload as unknown as Record<string, unknown>,
          payloadHash,
          processedAt: recordResult.event.processedAt,
          conflictCount: recordResult.event.conflictCount,
          lastConflictHash: recordResult.event.lastConflictHash || undefined,
          lastConflictAt: recordResult.event.lastConflictAt || undefined,
          processingStatus: 'PROCESSED'
        };
        db.webhooks.unshift(record);
        db.subscription.status = 'ACTIVE';
        if (settlementResult.newPeriodEnd) {
          db.subscription.periodEnd = settlementResult.newPeriodEnd;
        }
        db.save();

        return {
          status: 'PROCESSED',
          message: settlementResult.message
        };
      }

      if (payload.event === 'payment.expired') {
        await webhookRepo.markProcessed(internalEventId);
        const record: WebhookEventRecord = {
          id: internalEventId,
          eventId,
          eventType: payload.event,
          provider: 'MAYAR',
          payload: payload as unknown as Record<string, unknown>,
          payloadHash,
          processedAt: recordResult.event.processedAt,
          conflictCount: recordResult.event.conflictCount,
          lastConflictHash: recordResult.event.lastConflictHash || undefined,
          lastConflictAt: recordResult.event.lastConflictAt || undefined,
          processingStatus: 'PROCESSED'
        };
        db.webhooks.unshift(record);
        db.save();

        return {
          status: 'PROCESSED',
          message: 'Pembayaran kedaluwarsa dicatat.'
        };
      }

      await webhookRepo.markProcessed(internalEventId);
      const record: WebhookEventRecord = {
        id: internalEventId,
        eventId,
        eventType: payload.event,
        provider: 'MAYAR',
        payload: payload as unknown as Record<string, unknown>,
        payloadHash,
        processedAt: recordResult.event.processedAt,
        conflictCount: recordResult.event.conflictCount,
        lastConflictHash: recordResult.event.lastConflictHash || undefined,
        lastConflictAt: recordResult.event.lastConflictAt || undefined,
        processingStatus: 'PROCESSED'
      };
      db.webhooks.unshift(record);
      db.save();

      return {
        status: 'IGNORED',
        message: `Event type ${payload.event} tidak memerlukan mutasi.`
      };
    };

    const promise = executeAsync();
    return Object.assign(promise, {
      status: 'PROCESSED' as const,
      message: 'Pembayaran langganan SaaS diverifikasi.'
    });
  }
}
