// ============================================================================
// COVE Backend — Mayar SaaS Billing Webhook Service v2.1
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// ============================================================================

import {db} from '../db/store.js';
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

export class MayarService {
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
