/**
 * COVE WhatsApp Communication & Alert Engine
 * Supports:
 * - One-Click Direct WhatsApp Dispatch (wa.me deep links)
 * - Automated Gateway API Sender (Fonnte / WATI / Wablas / Mayar WA API)
 * - Standardized Construction Executive Message Templates
 */

import { formatIDR } from "@/lib/utils";

export interface WhatsAppMessagePayload {
  recipientPhone: string; // Indonesian format (e.g. '08123456789' or '628123456789')
  recipientName: string;
  recipientRole?: string;
  messageType: "SLA_ALERT" | "BAP_APPROVED" | "CASH_COLLECTED" | "ACTION_ASSIGNED" | "DAILY_BRIEF";
  projectName: string;
  claimNumber?: string;
  amount?: number;
  agingDays?: number;
  blockerTitle?: string;
  actionTitle?: string;
  dueDate?: string;
  customNotes?: string;
}

/**
 * Normalizes Indonesian phone numbers to standard 62xxx format
 */
export function normalizeIndonesianPhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("08")) {
    return `628${cleaned.substring(2)}`;
  } else if (cleaned.startsWith("62")) {
    return cleaned;
  } else if (cleaned.startsWith("8")) {
    return `62${cleaned}`;
  }
  return cleaned || "6281200000000";
}

/**
 * Builds formatted Indonesian WhatsApp messages
 */
export function buildWhatsAppMessageText(payload: WhatsAppMessagePayload): string {
  const formattedAmount = payload.amount ? formatIDR(payload.amount) : "Rp 0";

  switch (payload.messageType) {
    case "SLA_ALERT":
      return `⚠️ *[PERINGATAN COVE: KLAIM TERTUNDA MK]*

Halo Bapak/Ibu *${payload.recipientName}* (${payload.recipientRole || "Tim Komersial/MK"}),

Disampaikan informasi penting terkait arus kas proyek:
🏢 *Proyek:* ${payload.projectName}
📑 *Nomor Klaim:* ${payload.claimNumber || "MC-006"}
💰 *Nilai Tertahan (Cash-at-Risk):* ${formattedAmount}
⏱️ *Durasi di Konsultan MK:* ${payload.agingDays || 14} hari (Melebihi batas SLA)
⚠️ *Kendala (Blocker):* ${payload.blockerTitle || "Persetujuan volume fisik belum disahkan"}

*Rekomendasi Tindakan:*
Mohon koordinasi segera dengan Lead QS Konsultan MK untuk verifikasi Berita Acara Opname agar BAP dapat diterbitkan minggu ini.

${payload.customNotes ? `_Catatan Tambahan:_ ${payload.customNotes}\n` : ""}
_Pesan otomatis dikirim melalui COVE Construction Value Engine._`;

    case "BAP_APPROVED":
      return `✅ *[COVE NOTIFIKASI: BAP DISAHKAN]*

Halo Bapak/Ibu *${payload.recipientName}*,

Kabar baik, dokumen Berita Acara Pembayaran (BAP) telah disetujui:
🏢 *Proyek:* ${payload.projectName}
📑 *Nomor Klaim:* ${payload.claimNumber || "MC-006"}
💰 *Nilai Sertifikasi BAP Disetujui:* ${formattedAmount}
📅 *Tanggal Disahkan:* ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}

*Langkah Selanjutnya:*
Tim Keuangan & Penagihan silakan segera menerbitkan Faktur Pajak & Invoice resmi kepada Owner untuk memulai masa jatuh tempo pembayaran.

_Sistem COVE Construction Operations Value Engine_`;

    case "CASH_COLLECTED":
      return `💰 *[COVE NOTIFIKASI: KAS CAIR DI BANK]*

Halo Bapak/Ibu *${payload.recipientName}* (Direksi & Keuangan),

Pembayaran termin proyek telah berhasil diterima:
🏢 *Proyek:* ${payload.projectName}
📑 *Nomor Klaim / Invoice:* ${payload.claimNumber || "INV-2026-001"}
💵 *Jumlah Kas Masuk:* *${formattedAmount}*
🏦 *Status:* Lunas / Rekonsiliasi Kas Bank Berhasil

Piutang telah diperbarui di Executive Command Center.

_COVE Financial Control System_`;

    case "ACTION_ASSIGNED":
      return `☑️ *[COVE: PENUGASAN TINDAKAN EKONOMI]*

Halo *${payload.recipientName}*,

Anda telah ditugaskan untuk menyelesaikan tindakan prioritas tinggi:
🏢 *Proyek:* ${payload.projectName}
🎯 *Tindakan:* *${payload.actionTitle || "Klarifikasi Volume Bersama MK"}*
💰 *Eksposur Finansial Terkait:* ${formattedAmount}
⏰ *Batas Waktu (Due Date):* *${payload.dueDate || "Segera"}*

Mohon update status penyelesaian di aplikasi COVE setelah berkoordinasi.

_COVE Economic Action Engine_`;

    case "DAILY_BRIEF":
      return `☀️ *[COVE EXECUTIVE DAILY BRIEF]*

Selamat Pagi Bapak/Ibu *${payload.recipientName}*,

Ringkasan kontrol likuiditas proyek per ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}:
🏢 *Proyek Aktif:* ${payload.projectName}
🚨 *Total Cash at Risk:* ${formattedAmount}
⏳ *Klaim Tertahan di Evaluasi:* ${payload.claimNumber || "2 Klaim"}

Akses Pusat Kendali untuk detail: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard

_COVE Executive Command Center_`;

    default:
      return `Pemberitahuan dari COVE Construction Value Engine untuk Proyek ${payload.projectName}.`;
  }
}

/**
 * Generates direct one-click WhatsApp web/mobile dispatch URL
 */
export function generateWhatsAppUrl(payload: WhatsAppMessagePayload): string {
  const phone = normalizeIndonesianPhone(payload.recipientPhone);
  const text = encodeURIComponent(buildWhatsAppMessageText(payload));
  return `https://wa.me/${phone}?text=${text}`;
}

/**
 * Server-side Automated WhatsApp Dispatcher (via Gateway API)
 */
export async function sendWhatsAppMessageViaGateway(
  payload: WhatsAppMessagePayload
): Promise<{ success: boolean; message: string }> {
  const waToken = process.env.WHATSAPP_API_TOKEN;
  const waEndpoint = process.env.WHATSAPP_API_ENDPOINT || "https://api.fonnte.com/send";

  const messageText = buildWhatsAppMessageText(payload);
  const targetPhone = normalizeIndonesianPhone(payload.recipientPhone);

  if (!waToken) {
    console.log(`[WhatsApp Simulation Mode] Message prepared for ${targetPhone}:\n${messageText}`);
    return {
      success: true,
      message: "Simulation mode: WhatsApp message generated and logged successfully.",
    };
  }

  try {
    const response = await fetch(waEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: waToken,
      },
      body: JSON.stringify({
        target: targetPhone,
        message: messageText,
      }),
    });

    const result = await response.json();
    return {
      success: response.ok,
      message: result.message || "WhatsApp message dispatched successfully.",
    };
  } catch (err: any) {
    console.error("WhatsApp Gateway API Error:", err);
    return {
      success: false,
      message: err.message || "Failed to reach WhatsApp Gateway API.",
    };
  }
}
