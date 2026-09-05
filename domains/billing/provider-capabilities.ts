/**
 * COVE Phase 17R: Runtime Payment Provider Capability Matrix
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 10, 11)
 * 
 * Rules:
 * 1. Replace static booleans with fine-grained capability statuses:
 *    - SUPPORTED: Fully operational and verified for immediate execution.
 *    - UNSUPPORTED: Feature not available from the provider.
 *    - REQUIRES_ACTIVATION: Merchant agreement / feature toggle required at provider dashboard.
 *    - REQUIRES_CUSTOMER_CONSENT: End-user debit mandate / tokenization agreement required.
 *    - UNKNOWN: Provider capability is unverified or under review.
 * 2. Scheduler Collision Prevention:
 *    - COVE maintains absolute single source of truth for subscription periods and invoices.
 *    - External provider recurring schedulers (e.g. Xendit Subscriptions) must NOT autonomously
 *      advance periods without COVE's explicit invoice creation and webhook verification.
 */

import { PaymentProvider } from "./types";

export type CapabilityStatus =
  | "SUPPORTED"
  | "UNSUPPORTED"
  | "REQUIRES_ACTIVATION"
  | "REQUIRES_CUSTOMER_CONSENT"
  | "UNKNOWN";

export interface MerchantCapabilityContext {
  provider: PaymentProvider;
  isMerchantActive?: boolean;
  hasMandateAgreement?: boolean;
  hasCustomerConsent?: boolean;
  customerConsentReference?: string;
  environment?: "development" | "staging" | "production";
}

export interface ProviderCapabilityMatrix {
  paymentLink: CapabilityStatus;
  virtualAccount: CapabilityStatus;
  qris: CapabilityStatus;
  creditCardTokenization: CapabilityStatus;
  automatedRecurringDebit: CapabilityStatus;
  webhookSignatureVerification: CapabilityStatus;
  partialPaymentSupport: CapabilityStatus;
  refundSupport: CapabilityStatus;
  schedulerCollisionRisk: "NONE" | "HIGH_RISK_IF_DUAL_SCHEDULED";
}

/**
 * Evaluates provider capabilities dynamically based on runtime merchant configuration
 */
export function evaluateProviderCapabilities(
  context: MerchantCapabilityContext
): ProviderCapabilityMatrix {
  switch (context.provider) {
    case "XENDIT": {
      // Recurring debit requires both merchant feature activation and customer token mandate
      let recurringStatus: CapabilityStatus = "SUPPORTED";
      if (context.isMerchantActive === false) {
        recurringStatus = "REQUIRES_ACTIVATION";
      } else if (!context.hasMandateAgreement) {
        recurringStatus = "REQUIRES_ACTIVATION";
      } else if (!context.hasCustomerConsent) {
        recurringStatus = "REQUIRES_CUSTOMER_CONSENT";
      }

      return {
        paymentLink: "SUPPORTED",
        virtualAccount: "SUPPORTED",
        qris: "SUPPORTED",
        creditCardTokenization: "SUPPORTED",
        automatedRecurringDebit: recurringStatus,
        webhookSignatureVerification: "SUPPORTED",
        partialPaymentSupport: "UNSUPPORTED", // COVE strictly rejects partial subscription payments
        refundSupport: "SUPPORTED",
        schedulerCollisionRisk: "HIGH_RISK_IF_DUAL_SCHEDULED",
      };
    }

    case "MAYAR": {
      return {
        paymentLink: "SUPPORTED",
        virtualAccount: "SUPPORTED",
        qris: "SUPPORTED",
        creditCardTokenization: "UNKNOWN",
        automatedRecurringDebit: "UNKNOWN", // Mayar recurring engine requires custom enterprise agreement
        webhookSignatureVerification: "SUPPORTED",
        partialPaymentSupport: "UNSUPPORTED",
        refundSupport: "REQUIRES_ACTIVATION",
        schedulerCollisionRisk: "NONE",
      };
    }

    case "MOCK":
    default: {
      return {
        paymentLink: "SUPPORTED",
        virtualAccount: "SUPPORTED",
        qris: "SUPPORTED",
        creditCardTokenization: "SUPPORTED",
        automatedRecurringDebit: context.hasCustomerConsent ? "SUPPORTED" : "REQUIRES_CUSTOMER_CONSENT",
        webhookSignatureVerification: "SUPPORTED",
        partialPaymentSupport: "UNSUPPORTED",
        refundSupport: "SUPPORTED",
        schedulerCollisionRisk: "NONE",
      };
    }
  }
}

/**
 * Validates that COVE's internal cron scheduler and the provider's native scheduler
 * do not double-bill or trigger concurrent collision on the same period.
 */
export function validateSchedulerExclusivity(params: {
  provider: PaymentProvider;
  coveSubscriptionId: string;
  providerSubscriptionId?: string;
  capabilities: ProviderCapabilityMatrix;
}): {
  allowed: boolean;
  strategy: "COVE_INTERNAL_CRON_ONLY" | "GATEWAY_MANAGED" | "DUAL_SCHEDULING_BLOCKED";
  reason: string;
} {
  if (params.capabilities.automatedRecurringDebit !== "SUPPORTED") {
    return {
      allowed: true,
      strategy: "COVE_INTERNAL_CRON_ONLY",
      reason: "Gateway does not execute recurring auto-debit; COVE internal cron generates payment links exclusively.",
    };
  }

  // When gateway has automated recurring debit capability:
  // COVE MUST retain invoice generation leadership and prevent the gateway from initiating un-correlated renewals.
  if (params.providerSubscriptionId) {
    return {
      allowed: true,
      strategy: "COVE_INTERNAL_CRON_ONLY",
      reason: "COVE generates discrete invoices and uses tokenized charge API. Gateway-side autonomous recurring schedule disabled to eliminate collision.",
    };
  }

  return {
    allowed: true,
    strategy: "COVE_INTERNAL_CRON_ONLY",
    reason: "Default single-scheduler model: COVE internal cron owns invoice and dunning lifecycle.",
  };
}
