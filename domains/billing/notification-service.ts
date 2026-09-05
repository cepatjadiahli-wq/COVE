/**
 * COVE Phase 17: Customer Billing Notification Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 7, 10)
 * 
 * Rules:
 * 1. Channels: IN_APP, EMAIL, and WHATSAPP (WhatsApp provided as direct link/manual template).
 * 2. Mandatory content: Org name, active plan, billing amount, due date (WIB), payment status,
 *    accurate operational consequences, official payment link, help channel.
 * 3. STRICT PROHIBITION:
 *    - NO excessive threats.
 *    - NEVER claim customer data or project documents will be deleted.
 *    - NEVER claim payment failed if provider has not confirmed.
 *    - NEVER leak secrets, tokens, or webhook payloads.
 */

import { DunningStage, DUNNING_STAGES, formatJakartaTime } from "../subscription/dunning-engine";

export type NotificationChannel = "IN_APP" | "EMAIL" | "WHATSAPP";

export type NotificationStatus =
  | "DRAFT"
  | "QUEUED"
  | "GENERATED"
  | "SENDING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "BOUNCED"
  | "SKIPPED";

export interface NotificationPayload {
  orgId: string;
  orgName: string;
  planName: string;
  amount: number;
  currency?: string;
  dueDateUtc: string;
  stage: DunningStage;
  paymentUrl: string;
  invoiceNumber?: string;
  helpChannel?: string;
}

export interface GeneratedNotification {
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  bodyText: string;
  actionUrl: string;
  consequence: string;
  status: NotificationStatus;
}

/**
 * Formats currency to standard Indonesian Rupiah format
 */
export function formatCurrencyIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Builds the notification template across all supported channels
 */
export function buildDunningNotification(
  payload: NotificationPayload,
  channel: NotificationChannel = "IN_APP",
  recipient: string = "billing@tenant.com"
): GeneratedNotification {
  const stageConfig = DUNNING_STAGES.find((s) => s.stage === payload.stage);
  const formattedDueDate = formatJakartaTime(payload.dueDateUtc);
  const formattedAmount = formatCurrencyIdr(payload.amount);
  const helpChannel = payload.helpChannel || "support@cove.id / WhatsApp +62-812-3456-7890";
  const consequence = stageConfig ? stageConfig.consequence : "Harap periksa status tagihan Anda.";

  let subject = "";
  let bodyText = "";

  switch (payload.stage) {
    case "H_MINUS_7":
      subject = `[COVE] Pengingat Perpanjangan Langganan Paket ${payload.planName} — ${payload.orgName}`;
      bodyText =
        `Halo Tim ${payload.orgName},\n\n` +
        `Langganan COVE Anda untuk paket ${payload.planName} akan jatuh tempo pada ${formattedDueDate}.\n` +
        `Nilai tagihan: ${formattedAmount}.\n\n` +
        `Konsekuensi Operasional:\n${consequence}\n\n` +
        `Untuk memastikan kelancaran operasional opname dan klaim konstruksi Anda, silakan lakukan pembayaran melalui tautan resmi berikut:\n` +
        `${payload.paymentUrl}\n\n` +
        `Pusat Bantuan: ${helpChannel}`;
      break;

    case "H_MINUS_1":
      subject = `[PENTING] Tagihan COVE Jatuh Tempo Besok — Paket ${payload.planName}`;
      bodyText =
        `Halo Tim ${payload.orgName},\n\n` +
        `Pengingat bahwa tagihan langganan paket ${payload.planName} sebesar ${formattedAmount} akan jatuh tempo besok (${formattedDueDate}).\n\n` +
        `Konsekuensi Operasional:\n${consequence}\n\n` +
        `Tautan Pembayaran Resmi:\n${payload.paymentUrl}\n\n` +
        `Pusat Bantuan: ${helpChannel}`;
      break;

    case "DUE_DATE":
      subject = `[TAGIHAN JATUH TEMPO] Invoice ${payload.invoiceNumber || "Langganan"} — Paket ${payload.planName}`;
      bodyText =
        `Halo Tim ${payload.orgName},\n\n` +
        `Tagihan langganan COVE Anda sebesar ${formattedAmount} jatuh tempo hari ini (${formattedDueDate}).\n\n` +
        `Konsekuensi Operasional:\n${consequence}\n\n` +
        `Anda memiliki masa tenggang (grace period) selama 7 hari kalender dengan fitur lengkap tetap aktif.\n\n` +
        `Selesaikan Pembayaran Sekarang:\n${payload.paymentUrl}\n\n` +
        `Pusat Bantuan: ${helpChannel}`;
      break;

    case "H_PLUS_1":
      subject = `[PEMBERITAHUAN] Tagihan COVE Melewati Jatuh Tempo (Masa Tenggang Aktif) — ${payload.orgName}`;
      bodyText =
        `Halo Tim ${payload.orgName},\n\n` +
        `Tagihan langganan paket ${payload.planName} (${formattedAmount}) telah melewati jatuh tempo pada ${formattedDueDate}.\n\n` +
        `Konsekuensi Operasional:\n${consequence}\n\n` +
        `Tautan Pembayaran Resmi:\n${payload.paymentUrl}\n\n` +
        `Pusat Bantuan: ${helpChannel}`;
      break;

    case "H_PLUS_3":
      subject = `[PERINGATAN] Sisa Masa Tenggang Tagihan COVE (4 Hari Tersisa) — ${payload.orgName}`;
      bodyText =
        `Halo Tim ${payload.orgName},\n\n` +
        `Masa tenggang untuk tagihan ${payload.planName} (${formattedAmount}) tersisa 4 hari kalender.\n\n` +
        `Konsekuensi Operasional:\n${consequence}\n\n` +
        `Selesaikan pembayaran untuk mencegah akun beralih ke mode READ_ONLY:\n${payload.paymentUrl}\n\n` +
        `Pusat Bantuan: ${helpChannel}`;
      break;

    case "H_PLUS_7":
      subject = `[PEMBERITAHUAN RESMI] Akun COVE Beralih ke Mode READ_ONLY — ${payload.orgName}`;
      bodyText =
        `Halo Tim ${payload.orgName},\n\n` +
        `Masa tenggang 7 hari telah berakhir untuk tagihan paket ${payload.planName} (${formattedAmount}).\n\n` +
        `Konsekuensi Operasional:\n${consequence}\n\n` +
        `Data Anda Tetap 100% Aman:\n` +
        `- Anda tetap dapat login dan melihat seluruh data proyek serta klaim.\n` +
        `- Ekspor data lengkap (Open Data Guarantee) tetap dapat diunduh kapan saja.\n` +
        `- Pembuatan dan perubahan data baru dibekukan sementara hingga pembayaran selesai.\n\n` +
        `Pulihkan Akun ke Status Aktif Sekarang:\n${payload.paymentUrl}\n\n` +
        `Pusat Bantuan: ${helpChannel}`;
      break;

    case "H_PLUS_21":
      subject = `[PENANGGUHAN OPERASIONAL] Akun COVE Berstatus SUSPENDED — ${payload.orgName}`;
      bodyText =
        `Halo Tim ${payload.orgName},\n\n` +
        `Tagihan langganan ${payload.planName} (${formattedAmount}) belum terselesaikan setelah 21 hari kalender.\n\n` +
        `Konsekuensi Operasional:\n${consequence}\n\n` +
        `Jaminan Keamanan Data (PRD 28.1 Open Data Guarantee):\n` +
        `- Seluruh data proyek, dokumen, bukti opname, dan riwayat audit TIDAK DIHAPUS.\n` +
        `- Fitur Ekspor Data Lengkap tetap dapat diakses melalui portal pemulihan.\n` +
        `- Pembayaran tagihan akan secara otomatis memulihkan akun ke status ACTIVE seketika.\n\n` +
        `Kanal Pembayaran Pemulihan:\n${payload.paymentUrl}\n\n` +
        `Pusat Bantuan: ${helpChannel}`;
      break;
  }

  return {
    channel,
    recipient,
    subject,
    bodyText,
    actionUrl: payload.paymentUrl,
    consequence,
    status: "GENERATED",
  };
}
