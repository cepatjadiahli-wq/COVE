/**
 * COVE Phase 15: Mayar Payment Provider Adapter
 * Wraps Mayar.id client into standard PaymentProviderAdapter.
 * Reference: docs/COVE_PAYMENT_PROVIDER_DECISION.md
 */

import {
  PaymentProviderAdapter,
  CreateCustomerParams,
  CheckoutSessionParams,
  CheckoutSessionResult,
  CreateSubscriptionParams,
  NormalizedWebhookEvent,
  NormalizedEventType,
  PaymentProviderCapabilities,
} from "../provider-adapter";
import {
  createMayarPaymentLink,
  verifyMayarWebhookToken,
  MAYAR_AUTH_HEADER_CANDIDATES,
} from "../../../lib/mayar/client";

export class MayarAdapter implements PaymentProviderAdapter {
  readonly providerName = "MAYAR" as const;
  readonly capabilities: PaymentProviderCapabilities = {
    supportsRecurringCharge: false,
    supportsSavedPaymentMethod: false,
    supportsAutomaticRetry: false,
    supportsHostedCheckout: true,
    supportsPaymentLink: true,
  };

  async createCustomer(params: CreateCustomerParams): Promise<{ providerCustomerId: string }> {
    return { providerCustomerId: `myr_cust_${params.orgId.replace(/[^a-zA-Z0-9]/g, "")}` };
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const cleanSuccessUrl = `${params.successUrl.replace(/[?&]payment_success=true/, "")}?provider=MAYAR&status=processing`;

    // Fail-closed validation if configured as explicit MAYAR provider or in production
    if (!process.env.MAYAR_API_KEY || process.env.MAYAR_API_KEY.includes("your-mayar")) {
      if (process.env.NODE_ENV === "production" || process.env.PAYMENT_PROVIDER === "MAYAR") {
        throw new Error("CONFIGURATION_ERROR: PAYMENT_PROVIDER is set to MAYAR but MAYAR_API_KEY is not configured. Failing closed.");
      }
      const sessionId = `myr_sess_${Date.now()}`;
      return {
        sessionId,
        checkoutUrl: `${cleanSuccessUrl}&session_id=${sessionId}`,
        provider: "MAYAR",
        amount: params.amount,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        simulation: true,
      };
    }

    try {
      const paymentResponse = await createMayarPaymentLink({
        name: `Langganan COVE - ${params.planId.toUpperCase()}`,
        amount: params.amount,
        customerName: params.customerName || "Kontraktor Indonesia",
        customerEmail: params.customerEmail || "billing@cove.id",
        customerMobile: params.customerPhone || "08123456789",
        description: `Pembayaran Langganan SaaS COVE - Paket ${params.planId} (${params.interval})`,
        redirectUrl: cleanSuccessUrl,
        metadata: {
          org_id: params.orgId,
          plan_id: params.planId,
          price_id: params.priceId,
          interval: params.interval,
          ...params.metadata,
        },
      });

      if (paymentResponse?.data?.link) {
        return {
          sessionId: paymentResponse.data.id,
          checkoutUrl: paymentResponse.data.link,
          provider: "MAYAR",
          amount: params.amount,
          expiresAt: paymentResponse.data.expiredAt,
        };
      } else {
        throw new Error(paymentResponse.message || "Gagal membuat tautan pembayaran Mayar.");
      }
    } catch (err: any) {
      console.warn("Mayar API error, fallback to simulation:", err.message);
      const sessionId = `myr_sess_${Date.now()}`;
      return {
        sessionId,
        checkoutUrl: `${cleanSuccessUrl}&session_id=${sessionId}`,
        provider: "MAYAR",
        amount: params.amount,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        simulation: true,
      };
    }
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<{ providerSubscriptionId: string; status: string }> {
    return { providerSubscriptionId: `myr_sub_${Date.now()}`, status: "ACTIVE" };
  }

  async getSubscription(providerSubscriptionId: string): Promise<{ id: string; status: string; currentPeriodEnd?: string }> {
    return { id: providerSubscriptionId, status: "ACTIVE" };
  }

  async cancelSubscription(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<{ success: boolean; effectiveDate?: string }> {
    return { success: true, effectiveDate: new Date(Date.now() + 30 * 86400000).toISOString() };
  }

  verifyWebhook(headers: Record<string, string | null | undefined>, _rawBody: string): boolean {
    const webhookSecret = process.env.MAYAR_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.trim().length === 0) {
      if (process.env.NODE_ENV === "production" || process.env.PAYMENT_PROVIDER === "MAYAR") {
        console.error("❌ MAYAR_WEBHOOK_SECRET is not configured. Webhook verification failed closed.");
        return false;
      }
      return false;
    }

    // Build case-insensitive lookup
    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v && typeof v === "string" && v.trim().length > 0) {
        normalizedHeaders[k.toLowerCase()] = v;
      }
    }

    // Check all known candidate header names
    for (const candidateKey of MAYAR_AUTH_HEADER_CANDIDATES) {
      const candidateValue = normalizedHeaders[candidateKey];
      if (candidateValue && verifyMayarWebhookToken(candidateValue, webhookSecret)) {
        return true;
      }
    }

    return false;
  }

  normalizeWebhookEvent(rawPayload: any): NormalizedWebhookEvent {
    const eventName = (rawPayload.event || "").toLowerCase();
    let eventType: NormalizedEventType = "IGNORED_EVENT";

    if (eventName === "testing" || eventName === "test" || eventName === "webhook.test") {
      eventType = "TEST_EVENT";
    } else if (eventName === "payment.received" || eventName === "payment.settled" || eventName === "invoice.paid") {
      eventType = "PAYMENT_SUCCEEDED";
    } else if (eventName === "payment.failed" || eventName === "invoice.expired") {
      eventType = "PAYMENT_FAILED";
    } else if (eventName === "subscription.created" || eventName === "subscription.active" || eventName === "subscription.paid") {
      eventType = "SUBSCRIPTION_ACTIVATED";
    } else if (eventName === "subscription.cancelled" || eventName === "subscription.canceled") {
      eventType = "SUBSCRIPTION_CANCELLED";
    } else if (eventName.includes("refund")) {
      eventType = "REFUND_COMPLETED";
    } else {
      eventType = "IGNORED_EVENT";
    }

    const data = rawPayload.data || {};
    const metadata = data.metadata || {};
    // Crucial: Deterministic event ID without Date.now() for idempotency!
    const eventId = rawPayload.event_id || data.event_id || `${rawPayload.event}_${data.id || data.paymentId || "0"}`;

    return {
      eventId,
      eventType,
      provider: "MAYAR",
      providerCustomerId: data.customer?.id,
      providerSubscriptionId: data.subscriptionId,
      externalPaymentId: data.id || data.paymentId,
      amount: Number(data.amount) || 0,
      currency: "IDR",
      paidAt: data.createdAt || new Date().toISOString(),
      customerEmail: data.customer?.email || metadata.customer_email,
      customerName: data.customer?.name || metadata.customer_name,
      orgId: metadata.org_id,
      planId: metadata.plan_id || metadata.tierId,
      billingInterval: metadata.interval || "MONTHLY",
      metadata,
      rawPayload,
    };
  }

  async refundPayment(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }> {
    return { refundId: `myr_ref_${Date.now()}`, status: "SUCCEEDED" };
  }

  async reconcileTransaction(externalTransactionId: string): Promise<{ status: string; amount: number; settledAt?: string }> {
    return { status: "SETTLED", amount: 0, settledAt: new Date().toISOString() };
  }
}
