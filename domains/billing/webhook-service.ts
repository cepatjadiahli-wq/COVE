/**
 * COVE Phase 15: Webhook Processing & Idempotency Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 11)
 * Rules:
 * - Strict signature verification (reject 401 on failure)
 * - Strict idempotency check on (provider, event_id)
 * - Raw payload persistence before mutation
 * - Decoupled from physical construction invoices
 * - Deterministic error recording and status updates
 */

import { PaymentProvider } from "./types";
import { getPaymentAdapter } from "./adapters";
import { dbAdapter } from "../../lib/db/database-adapter";
import { logBillingEvent } from "./observability";

export interface WebhookProcessResult {
  success: boolean;
  statusCode: number;
  eventId?: string;
  eventType?: string;
  provider?: string;
  idempotentReplay?: boolean;
  message?: string;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Sanitizes webhook payload by redacting sensitive authentication headers, tokens, card details, CVVs, and secrets
 */
export function sanitizeWebhookPayload(payload: any, parentKeyIsSensitive: boolean = false): any {
  if (payload === null || payload === undefined) {
    return payload;
  }
  if (typeof payload !== "object") {
    if (parentKeyIsSensitive) return "[REDACTED]";
    if (typeof payload === "string") {
      // Credit card pattern (13-19 digits, with or without spaces/dashes)
      if (/\b(?:\d[ -]*?){13,19}\b/.test(payload)) return "[REDACTED]";
      // JWT / Bearer pattern
      if (/^Bearer\s+[A-Za-z0-9._-]+/i.test(payload) || /^ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(payload)) return "[REDACTED]";
    }
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeWebhookPayload(item, parentKeyIsSensitive));
  }
  const sanitized: Record<string, any> = {};
  const sensitivePatterns = [
    /auth/i,
    /secret/i,
    /token/i,
    /password/i,
    /card/i,
    /pan/i,
    /cvv/i,
    /cvc/i,
    /api[-_]?key/i,
    /bearer/i,
    /signature/i,
    /refresh[-_]?token/i,
    /access[-_]?token/i,
    /client[-_]?secret/i,
    /pin/i,
  ];

  for (const [key, val] of Object.entries(payload)) {
    const isSensitive = parentKeyIsSensitive || sensitivePatterns.some((pattern) => pattern.test(key));
    if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeWebhookPayload(val, isSensitive);
    } else if (isSensitive && (typeof val === "string" || typeof val === "number")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "string" && (/\b(?:\d[ -]*?){13,19}\b/.test(val) || /^Bearer\s+/i.test(val))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export async function processWebhookEvent(params: {
  provider: PaymentProvider | string;
  headers: Record<string, string | null | undefined>;
  rawPayload: any;
  rawBody?: string;
}): Promise<WebhookProcessResult> {
  const startTime = Date.now();
  const adapter = getPaymentAdapter(params.provider);

  // 1. Verify Webhook Signature / Token
  const rawBodyString = params.rawBody || (typeof params.rawPayload === "string" ? params.rawPayload : JSON.stringify(params.rawPayload));
  const isVerified = adapter.verifyWebhook(params.headers, rawBodyString);

  if (!isVerified) {
    logBillingEvent("error", `Unauthorized: ${adapter.providerName} webhook signature verification failed.`, {
      provider: adapter.providerName,
      status: "BLOCKED",
      errorCategory: "AUTHENTICATION",
      durationMs: Date.now() - startTime,
    });
    return {
      success: false,
      statusCode: 401,
      provider: adapter.providerName,
      error: `Unauthorized: Invalid webhook signature or token for provider ${adapter.providerName}.`,
    };
  }

  // 2. Normalize Webhook Payload
  const normalized = adapter.normalizeWebhookEvent(params.rawPayload, params.headers);

  // 3. Check Idempotency in Database
  const existingEvent = dbAdapter.findWebhookEvent(normalized.provider, normalized.eventId);
  if (existingEvent && existingEvent.processingStatus === "PROCESSED") {
    logBillingEvent("info", `Idempotent replay: event ${normalized.provider}:${normalized.eventId} already processed.`, {
      provider: normalized.provider,
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      status: "SKIPPED",
      durationMs: Date.now() - startTime,
    });
    return {
      success: true,
      statusCode: 200,
      idempotentReplay: true,
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      provider: normalized.provider,
      message: `Webhook event ${normalized.eventId} was already processed successfully. Duplicate execution skipped.`,
    };
  }

  // 4. Record Initial Webhook Event in Pending State (Sanitized)
  const sanitizedPayload = sanitizeWebhookPayload(normalized.rawPayload);
  const whRecord = dbAdapter.recordWebhookEvent({
    provider: normalized.provider,
    eventId: normalized.eventId,
    eventType: normalized.eventType,
    rawPayload: sanitizedPayload,
    processingStatus: "PENDING",
    retryCount: 0,
  });

  // 5. Execute Business State Changes
  try {
    // Resolve organization ID
    let targetOrgId = normalized.orgId;
    if (!targetOrgId) {
      const orgs = dbAdapter.getOrganizations();
      if (normalized.customerEmail) {
        const matched = orgs.find(
          (o) =>
            (o.billingEmail && o.billingEmail.toLowerCase() === normalized.customerEmail?.toLowerCase()) ||
            (o.name && normalized.customerName && o.name.toLowerCase().includes(normalized.customerName.toLowerCase()))
        );
        if (matched) targetOrgId = matched.id;
      }
      if (!targetOrgId) {
        targetOrgId = orgs[0]?.id || "org-nusantara-01";
      }
    }

    switch (normalized.eventType) {
      case "PAYMENT_SUCCEEDED":
      case "CHECKOUT_COMPLETED":
      case "SUBSCRIPTION_ACTIVATED": {
        const requestedPlan = (normalized.planId || "").toLowerCase();
        if (requestedPlan === "lifetime_799k" || requestedPlan === "lifetime") {
          console.error(`❌ [Webhook Service] Security violation: Attempted activation of legacy lifetime plan ${requestedPlan}`);
          return {
            success: false,
            statusCode: 400,
            error: "Security Violation: Paket legacy lifetime_799k ditolak dan tidak dapat diaktifkan melalui webhook.",
          };
        }

        console.log(`💰 [Webhook Service] Processing payment success: Rp ${normalized.amount} for org ${targetOrgId}`);
        try {
          dbAdapter.activateSubscriptionViaWebhook({
            orgId: targetOrgId,
            billingInvoiceId: normalized.metadata?.billingInvoiceId || normalized.metadata?.invoiceId,
            planId: normalized.planId || "b2b_core",
            billingInterval: normalized.billingInterval || "MONTHLY",
            amount: normalized.amount,
            currency: normalized.currency || "IDR",
            settlementStatus: normalized.metadata?.settlementStatus || "SETTLED",
            provider: normalized.provider,
            providerPaymentId: normalized.externalPaymentId || normalized.eventId,
            eventId: normalized.eventId,
            paymentMethod: normalized.metadata?.paymentMethod || "GATEWAY_WEBHOOK",
          });
        } catch (integrityErr: any) {
          console.error(`❌ [Webhook Service] Financial integrity check failed:`, integrityErr.message);
          return {
            success: false,
            statusCode: 400,
            error: integrityErr.message,
          };
        }
        break;
      }

      case "PAYMENT_FAILED": {
        console.warn(`⚠️ [Webhook Service] Processing payment failure for org ${targetOrgId}`);
        dbAdapter.recordPaymentAttempt({
          attemptNumber: 1,
          status: "FAILED",
          gatewayErrorCode: normalized.metadata?.errorCode || "PAYMENT_FAILED",
          gatewayErrorMessage: normalized.metadata?.errorMessage || "Payment declined by gateway",
        });

        const activeSub = dbAdapter.getActiveSubscription(targetOrgId);
        if (activeSub && activeSub.status === "ACTIVE") {
          dbAdapter.setSubscriptionStatus(
            activeSub.id,
            "PAST_DUE",
            `Payment failure webhook received from ${normalized.provider}`,
            `WEBHOOK_${normalized.provider}`
          );
        }
        break;
      }

      case "SUBSCRIPTION_CANCELLED": {
        console.log(`ℹ️ [Webhook Service] Processing subscription cancellation for org ${targetOrgId}`);
        const activeSub = dbAdapter.getActiveSubscription(targetOrgId);
        if (activeSub) {
          dbAdapter.setSubscriptionStatus(
            activeSub.id,
            "CANCELLED",
            `Cancellation webhook received from ${normalized.provider}`,
            `WEBHOOK_${normalized.provider}`
          );
        }
        break;
      }

      case "SUBSCRIPTION_EXPIRED": {
        console.log(`ℹ️ [Webhook Service] Processing subscription expiration for org ${targetOrgId}`);
        const activeSub = dbAdapter.getActiveSubscription(targetOrgId);
        if (activeSub) {
          dbAdapter.setSubscriptionStatus(
            activeSub.id,
            "EXPIRED",
            `Expiration webhook received from ${normalized.provider}`,
            `WEBHOOK_${normalized.provider}`
          );
        }
        break;
      }

      case "REFUND_COMPLETED": {
        console.log(`ℹ️ [Webhook Service] Processing refund completed for org ${targetOrgId}`);
        dbAdapter.recordBillingAuditLog({
          orgId: targetOrgId,
          action: "PAYMENT_REFUNDED",
          actorId: `PROVIDER_${normalized.provider}`,
          details: {
            amount: normalized.amount,
            eventId: normalized.eventId,
            paymentId: normalized.externalPaymentId,
          },
        });
        break;
      }

      case "TEST_EVENT": {
        console.log(`🧪 [Webhook Service] Received Mayar test event (ID: ${normalized.eventId}). Acknowledging without financial mutation.`);
        break;
      }

      case "IGNORED_EVENT":
      default:
        console.log(`ℹ️ [Webhook Service] Unhandled/Ignored event type: ${normalized.eventType}`);
    }

    // 6. Update Webhook Event Status to PROCESSED
    dbAdapter.updateWebhookEventStatus(whRecord.id, "PROCESSED");

    logBillingEvent("info", `Webhook event ${normalized.eventId} processed successfully.`, {
      provider: normalized.provider,
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      orgId: targetOrgId,
      status: "SUCCEEDED",
      durationMs: Date.now() - startTime,
    });

    return {
      success: true,
      statusCode: 200,
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      provider: normalized.provider,
      message: normalized.eventType === "TEST_EVENT"
        ? "Test webhook event acknowledged successfully; zero financial mutation."
        : `Webhook event ${normalized.eventId} processed successfully.`,
    };
  } catch (err: any) {
    dbAdapter.updateWebhookEventStatus(whRecord.id, "FAILED", err.message);

    logBillingEvent("error", `Failed to process webhook event: ${err.message}`, {
      provider: normalized?.provider,
      eventId: normalized?.eventId,
      status: "FAILED",
      errorCategory: "BUSINESS_RULE",
      durationMs: Date.now() - startTime,
    });

    return {
      success: false,
      statusCode: 500,
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      provider: normalized.provider,
      error: `Failed to process webhook event: ${err.message}`,
    };
  }
}
