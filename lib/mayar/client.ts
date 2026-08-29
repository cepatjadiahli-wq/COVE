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
  metadata?: Record<string, any>;
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
    metadata?: Record<string, any>;
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

/**
 * Validates Mayar Webhook signature / security token
 */
export function verifyMayarWebhookToken(
  tokenHeader: string | null,
  secretEnv: string | undefined
): boolean {
  if (!secretEnv) {
    // If not configured in development, allow for testing
    console.warn("MAYAR_WEBHOOK_SECRET is not configured in environment variables.");
    return true;
  }

  if (!tokenHeader) {
    return false;
  }

  // Support Bearer token or direct token string
  const cleanHeader = tokenHeader.replace(/^Bearer\s+/i, "").trim();
  const cleanSecret = secretEnv.trim();

  return cleanHeader === cleanSecret;
}
