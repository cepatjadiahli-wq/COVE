/**
 * COVE Phase 17R: Dunning Payment Retry Eligibility Policy
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 7, 10)
 * 
 * Rules:
 * 1. Error Classification:
 *    - RETRY_NOW: Transient glitch, retry immediately (up to 1 time).
 *    - RETRY_AFTER: Transient failure (e.g. gateway timeout, network), retry after exponential backoff.
 *    - CUSTOMER_ACTION_REQUIRED: Card declined, expired, or insufficient funds requiring tenant intervention.
 *    - DO_NOT_RETRY: Permanent failure (fraud, invalid card number, account terminated).
 *    - PROVIDER_REVIEW_REQUIRED: Merchant compliance or fraud block requiring human review.
 * 2. Absolute limits: Max 3 retry attempts before freezing mutations.
 */

export type RetryEligibility =
  | "RETRY_NOW"
  | "RETRY_AFTER"
  | "CUSTOMER_ACTION_REQUIRED"
  | "DO_NOT_RETRY"
  | "PROVIDER_REVIEW_REQUIRED";

export interface RetryEvaluationResult {
  eligibility: RetryEligibility;
  normalizedCode: string;
  normalizedMessage: string;
  customerActionRequired: boolean;
  maxAttempts: number;
  earliestRetryAt: string | null;
  delaySeconds: number;
}

/**
 * Classifies gateway payment failures and determines retry eligibility
 */
export function evaluateRetryEligibility(params: {
  rawErrorCode?: string;
  rawErrorMessage?: string;
  currentAttemptCount: number;
  asOfDate?: Date;
}): RetryEvaluationResult {
  const asOf = params.asOfDate || new Date();
  const code = (params.rawErrorCode || "").toUpperCase().trim();
  const msg = (params.rawErrorMessage || "").toLowerCase().trim();

  // If already reached max attempts (3), stop retrying
  if (params.currentAttemptCount >= 3) {
    return {
      eligibility: "DO_NOT_RETRY",
      normalizedCode: "MAX_RETRIES_EXCEEDED",
      normalizedMessage: "Batas maksimum 3 kali percobaan debit telah tercapai.",
      customerActionRequired: true,
      maxAttempts: 3,
      earliestRetryAt: null,
      delaySeconds: 0,
    };
  }

  // 1. Permanent Failures: Fraud, stolen card, invalid card number
  if (
    code === "STOLEN_CARD" ||
    code === "FRAUD_SUSPECTED" ||
    code === "INVALID_CARD_NUMBER" ||
    code === "DO_NOT_HONOR" ||
    msg.includes("fraud") ||
    msg.includes("stolen") ||
    msg.includes("invalid card")
  ) {
    return {
      eligibility: "DO_NOT_RETRY",
      normalizedCode: "PERMANENT_CARD_FAILURE",
      normalizedMessage: "Kartu atau metode pembayaran tidak valid atau diblokir oleh penerbit.",
      customerActionRequired: true,
      maxAttempts: 1,
      earliestRetryAt: null,
      delaySeconds: 0,
    };
  }

  // 2. Customer Action Required: Expired card
  if (code === "EXPIRED_CARD" || msg.includes("expired")) {
    return {
      eligibility: "CUSTOMER_ACTION_REQUIRED",
      normalizedCode: "EXPIRED_CARD",
      normalizedMessage: "Masa berlaku kartu telah habis. Harap perbarui metode pembayaran.",
      customerActionRequired: true,
      maxAttempts: 1,
      earliestRetryAt: null,
      delaySeconds: 0,
    };
  }

  // 3. Customer Action Required: Insufficient funds (retry after 24h backoff, max 3)
  if (
    code === "INSUFFICIENT_FUNDS" ||
    code === "LOW_BALANCE" ||
    msg.includes("insufficient") ||
    msg.includes("saldo tidak cukup")
  ) {
    const delayHours = 24;
    const earliest = new Date(asOf.getTime() + delayHours * 60 * 60 * 1000);
    return {
      eligibility: "CUSTOMER_ACTION_REQUIRED",
      normalizedCode: "INSUFFICIENT_FUNDS",
      normalizedMessage: "Saldo atau limit tidak mencukupi untuk pembayaran tagihan.",
      customerActionRequired: true,
      maxAttempts: 3,
      earliestRetryAt: earliest.toISOString(),
      delaySeconds: delayHours * 3600,
    };
  }

  // 4. Customer Action Required: 3DS Challenge required
  if (
    code === "ACTION_REQUIRED" ||
    code === "AUTHENTICATION_REQUIRED" ||
    msg.includes("3ds") ||
    msg.includes("authentication required")
  ) {
    return {
      eligibility: "CUSTOMER_ACTION_REQUIRED",
      normalizedCode: "AUTHENTICATION_REQUIRED",
      normalizedMessage: "Diperlukan otentikasi 3D Secure oleh pemegang kartu.",
      customerActionRequired: true,
      maxAttempts: 2,
      earliestRetryAt: null,
      delaySeconds: 0,
    };
  }

  // 5. Transient Failures: Gateway timeout, network glitch
  if (
    code === "GATEWAY_TIMEOUT" ||
    code === "NETWORK_ERROR" ||
    code === "SERVICE_UNAVAILABLE" ||
    msg.includes("timeout") ||
    msg.includes("connection reset")
  ) {
    // Progressive backoff: Attempt 1 = 15 mins, Attempt 2 = 1 hour, Attempt 3 = 6 hours
    const delayMinutes = params.currentAttemptCount === 0 ? 15 : params.currentAttemptCount === 1 ? 60 : 360;
    const earliest = new Date(asOf.getTime() + delayMinutes * 60 * 1000);
    return {
      eligibility: "RETRY_AFTER",
      normalizedCode: "TRANSIENT_GATEWAY_ERROR",
      normalizedMessage: "Koneksi gateway pembayaran mengalami gangguan sementara.",
      customerActionRequired: false,
      maxAttempts: 3,
      earliestRetryAt: earliest.toISOString(),
      delaySeconds: delayMinutes * 60,
    };
  }

  // 6. Provider Review Required
  if (code === "MERCHANT_BLOCKED" || code === "COMPLIANCE_HOLD" || msg.includes("compliance")) {
    return {
      eligibility: "PROVIDER_REVIEW_REQUIRED",
      normalizedCode: "PROVIDER_REVIEW_REQUIRED",
      normalizedMessage: "Akun gateway memerlukan verifikasi kepatuhan dari penyedia.",
      customerActionRequired: false,
      maxAttempts: 1,
      earliestRetryAt: null,
      delaySeconds: 0,
    };
  }

  // Default: generic retry after 1 hour
  const defaultDelayHours = 1;
  const earliest = new Date(asOf.getTime() + defaultDelayHours * 60 * 60 * 1000);
  return {
    eligibility: "RETRY_AFTER",
    normalizedCode: code || "UNKNOWN_PAYMENT_ERROR",
    normalizedMessage: params.rawErrorMessage || "Terjadi kesalahan saat memproses pembayaran.",
    customerActionRequired: true,
    maxAttempts: 3,
    earliestRetryAt: earliest.toISOString(),
    delaySeconds: defaultDelayHours * 3600,
  };
}
