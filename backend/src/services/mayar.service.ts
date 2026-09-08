// ============================================================================
// COVE Backend — Mayar SaaS Billing Webhook Service v2.1
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// ============================================================================

import {db} from '../db/store.js';
import {config} from '../config.js';
import type {WebhookEventRecord} from '../types/domain.js';

export interface MayarWebhookPayload {
  event: string;
  id: string;
  data: {
    id: string;
    amount: number;
    customer_name?: string;
    status: string;
    plan_id?: string;
  };
}

export interface CheckoutResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    checkoutRef: string;
    planId: string;
    subtotal: number;
    tax: number;
    total: number;
    paymentUrl: string;
    status: string;
  };
}

// Hook for test provider mocking without hardcoding synthetic generator in production
let checkoutClientOverride: ((params: { planId: string; customerName: string; customerEmail: string }) => Promise<CheckoutResult>) | null = null;

export function setCheckoutClientOverride(override: typeof checkoutClientOverride): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('SECURITY VIOLATION: Mock checkout client can only be set in test environment.');
  }
  checkoutClientOverride = override;
}

export class MayarService {
  /**
   * Membuat sesi checkout Mayar riil melalui provider gateway
   * Enforces:
   * 1. Menolak fake success / synthetic URL generator
   * 2. Jika API key belum terkonfigurasi: kembalikan PAYMENT_PROVIDER_NOT_CONFIGURED
   */
  public static async createCheckoutSession(params: {
    planId: string;
    customerName: string;
    customerEmail: string;
  }): Promise<CheckoutResult> {
    if (checkoutClientOverride) {
      return checkoutClientOverride(params);
    }

    if (!config.mayarApiKey || config.mayarApiKey === 'myr_dev_key_unconfigured' || config.mayarApiKey.startsWith('myr_test_')) {
      return {
        success: false,
        error: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message: 'Layanan pembayaran SaaS Mayar belum dikonfigurasi di server.'
      };
    }

    const amount = params.planId === 'pilot' ? 7500000 : params.planId === 'scale' ? 9900000 : 4900000;
    const tax = Math.round(amount * 0.11);
    const total = amount + tax;

    try {
      // Call actual Mayar API endpoint
      const res = await fetch('https://api.mayar.id/hl/v1/payment/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.mayarApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `COVE Subscription - Paket ${params.planId.toUpperCase()}`,
          email: params.customerEmail,
          amount: total,
          description: `Langganan platform COVE paket ${params.planId}`
        })
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        return {
          success: false,
          error: 'MAYAR_GATEWAY_ERROR',
          message: `Provider Mayar mengembalikan error: ${res.status} ${errBody}`
        };
      }

      const result: any = await res.json();
      return {
        success: true,
        data: {
          checkoutRef: result.data?.id || result.id,
          planId: params.planId,
          subtotal: amount,
          tax,
          total,
          paymentUrl: result.data?.link || result.link,
          status: 'PENDING'
        }
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'PROVIDER_CONNECTION_ERROR',
        message: err.message || 'Gagal menghubungi gateway pembayaran Mayar.'
      };
    }
  }
  /**
   * Memproses callback webhook dari Mayar
   * Enforces:
   * 1. Idempotency: jika event_id sudah ada, kembalikan duplikat tanpa error
   * 2. Pemisahan domain: TIDAK memutasi cash_receipts proyek kontraktor
   * 3. Pembaruan status subscription SaaS
   */
  public static handleWebhook(payload: MayarWebhookPayload): {
    status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED';
    message: string;
  } {
    const eventId = payload.id || `evt_mock_${Date.now()}`;

    // 1. Cek Idempotency
    const existing = db.webhooks.find(w => w.eventId === eventId);
    if (existing) {
      return {
        status: 'DUPLICATE',
        message: 'Event ID sudah pernah diproses sebelumnya. Tidak ada mutasi ganda.'
      };
    }

    // 2. Simpan record webhook
    const record: WebhookEventRecord = {
      id: 'wh-' + (db.webhooks.length + 1),
      eventId,
      eventType: payload.event,
      provider: 'MAYAR',
      payload: payload as unknown as Record<string, unknown>,
      processedAt: new Date().toISOString()
    };
    db.webhooks.unshift(record);

    // 3. Tangani event settlement
    if (payload.event === 'payment.settled') {
      db.subscription.status = 'ACTIVE';
      db.subscription.periodEnd = '2026-10-08';
      db.save();

      return {
        status: 'PROCESSED',
        message: 'Pembayaran langganan SaaS diverifikasi. Subscription aktif.'
      };
    }

    if (payload.event === 'payment.expired') {
      db.save();
      return {
        status: 'PROCESSED',
        message: 'Pembayaran kedaluwarsa dicatat.'
      };
    }

    db.save();
    return {
      status: 'IGNORED',
      message: `Event type ${payload.event} tidak memerlukan mutasi.`
    };
  }
}
