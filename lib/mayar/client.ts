/**
 * Mayar.id Payment Gateway SDK Client & Webhook Utilities
 * API Reference: https://docs.mayar.id
 */

export interface MayarPaymentRequest {
  name: string; // Product / billing title
  amount: number; // IDR amount
  customerName: string;
  customerEmail: string;
  customerMobile?: string;
  description?: string;
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface MayarPaymentResponse {
  statusCode: number;
  message: string;
  data?: {
    id: string;
    link: string;
    status: string;
    amount: number;
    expiredAt?: string;
  };
}

export interface MayarWebhookPayload {
  event: string; // e.g. 'payment.received', 'invoice.paid', 'subscription.active', 'payment.settled'
  data: {
    id: string; // Mayar payment/transaction ID
    paymentId?: string;
    invoiceId?: string;
    amount: number;
    fee?: number;
    netAmount?: number;
    status: string; // 'SUCCESS', 'PAID', 'SETTLED'
    paymentMethod?: string; // 'qris', 'va_bca', 'va_mandiri', etc.
    customer?: {
      name?: string;
      email?: string;
      mobile?: string;
    };
    description?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  };
}

/**
 * Creates a checkout payment link via Mayar API
 */
export async function createMayarPaymentLink(
  request: MayarPaymentRequest
): Promise<MayarPaymentResponse> {
  const apiKey = process.env.MAYAR_API_KEY;
  if (!apiKey) {
    throw new Error("MAYAR_API_KEY environment variable is not configured.");
  }

  const endpoint = process.env.MAYAR_API_URL || "https://api.mayar.id/hl/v1/payment/create";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: request.name,
      amount: request.amount,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerMobile: request.customerMobile || "08123456789",
      description: request.description || "COVE Construction SaaS Payment",
      redirectUrl: request.redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`,
      metadata: request.metadata || {},
    }),
  });

  const data = await response.json();
  return data;
}

import crypto from "crypto";

export const MAYAR_AUTH_HEADER_CANDIDATES = [
  "x-mayar-token",
  "x-mayar-signature",
  "x-mayar-secret",
  "x-mayar-webhook-token",
  "authorization",
  "mayar-token",
  "mayar-signature",
  "x-callback-token",
  "x-webhook-token",
  "x-api-key",
  "token",
] as const;

/**
 * Constant-time comparison between two strings to prevent timing side-channel attacks
 */
export function safeTimingEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a.trim(), "utf-8");
    const bufB = Buffer.from(b.trim(), "utf-8");
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Validates Mayar Webhook signature / security token against MAYAR_WEBHOOK_SECRET
 * using constant-time comparison.
 */
export function verifyMayarWebhookToken(
  tokenHeader: string | null | undefined,
  secretEnv: string | undefined
): boolean {
  if (!secretEnv || secretEnv.trim().length === 0) {
    // Fail-closed in production or when explicitly configured as MAYAR provider
    if (process.env.NODE_ENV === "production" || process.env.PAYMENT_PROVIDER === "MAYAR") {
      console.error("❌ MAYAR_WEBHOOK_SECRET is not configured. Webhook rejected fail-closed.");
      return false;
    }
    console.warn("MAYAR_WEBHOOK_SECRET is not configured in development environment variables.");
    return false;
  }

  if (!tokenHeader || typeof tokenHeader !== "string") {
    return false;
  }

  // Support Bearer token, Token prefix, or direct raw token string
  const cleanHeader = tokenHeader
    .replace(/^Bearer\s+/i, "")
    .replace(/^Token\s+/i, "")
    .trim();
  const cleanSecret = secretEnv.trim();

  if (cleanHeader.length === 0) {
    return false;
  }

  return safeTimingEqual(cleanHeader, cleanSecret);
}
