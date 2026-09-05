/**
 * COVE Phase 15: Mock Payment Provider Adapter
 * In-memory adapter for unit testing, sandbox environments, and local verification.
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

export const MOCK_WEBHOOK_SECRET = "cove_mock_webhook_secret_key_2026";

export class MockPaymentAdapter implements PaymentProviderAdapter {
  readonly providerName = "MOCK" as const;
  readonly capabilities: PaymentProviderCapabilities = {
    supportsRecurringCharge: false,
    supportsSavedPaymentMethod: false,
    supportsAutomaticRetry: false,
    supportsHostedCheckout: true,
    supportsPaymentLink: true,
  };

  private mockCustomers: Map<string, string> = new Map();
  private mockSubscriptions: Map<string, { id: string; status: string; currentPeriodEnd: string }> = new Map();

  async createCustomer(params: CreateCustomerParams): Promise<{ providerCustomerId: string }> {
    const customerId = `mock_cust_${params.orgId.replace(/[^a-zA-Z0-9]/g, "")}`;
    this.mockCustomers.set(params.orgId, customerId);
    return { providerCustomerId: customerId };
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const sessionId = `mock_sess_${Date.now()}_${params.idempotencyKey.slice(0, 8)}`;
    // Notice: Never include payment_success=true to prevent bypass!
    const checkoutUrl = `${params.successUrl}?session_id=${sessionId}&provider=MOCK&status=processing`;

    return {
      sessionId,
      checkoutUrl,
      provider: "MOCK",
      amount: params.amount,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      simulation: true,
    };
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<{ providerSubscriptionId: string; status: string }> {
    const subId = `mock_sub_${Date.now()}`;
    const periodEnd = new Date();
    if (params.interval === "ANNUAL") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const sub = {
      id: subId,
      status: "ACTIVE",
      currentPeriodEnd: periodEnd.toISOString(),
    };
    this.mockSubscriptions.set(subId, sub);
    return { providerSubscriptionId: subId, status: sub.status };
  }

  async getSubscription(providerSubscriptionId: string): Promise<{ id: string; status: string; currentPeriodEnd?: string }> {
    const sub = this.mockSubscriptions.get(providerSubscriptionId);
    if (!sub) {
      return { id: providerSubscriptionId, status: "ACTIVE" };
    }
    return sub;
  }

  async cancelSubscription(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<{ success: boolean; effectiveDate?: string }> {
    const sub = this.mockSubscriptions.get(providerSubscriptionId);
    if (sub) {
      sub.status = cancelAtPeriodEnd ? "CANCEL_AT_PERIOD_END" : "CANCELLED";
    }
    return { success: true, effectiveDate: sub?.currentPeriodEnd };
  }

  verifyWebhook(headers: Record<string, string | null | undefined>, rawBody: string): boolean {
    const token =
      headers["x-mock-token"] ||
      headers["x-mock-signature"] ||
      headers["authorization"]?.replace(/^Bearer\s+/i, "");

    // Must match secret exactly; if empty, reject
    if (!token) return false;
    return token.trim() === MOCK_WEBHOOK_SECRET;
  }

  normalizeWebhookEvent(rawPayload: any): NormalizedWebhookEvent {
    const rawType = (rawPayload.event_type || rawPayload.event || "").toLowerCase();
    let eventType: NormalizedEventType = "PAYMENT_SUCCEEDED";

    if (rawType.includes("payment.succeeded") || rawType.includes("invoice.paid") || rawType.includes("payment.received")) {
      eventType = "PAYMENT_SUCCEEDED";
    } else if (rawType.includes("payment.failed") || rawType.includes("invoice.failed")) {
      eventType = "PAYMENT_FAILED";
    } else if (rawType.includes("subscription.active") || rawType.includes("subscription.created")) {
      eventType = "SUBSCRIPTION_ACTIVATED";
    } else if (rawType.includes("subscription.cancelled") || rawType.includes("subscription.canceled")) {
      eventType = "SUBSCRIPTION_CANCELLED";
    } else if (rawType.includes("subscription.expired")) {
      eventType = "SUBSCRIPTION_EXPIRED";
    } else if (rawType.includes("refund")) {
      eventType = "REFUND_COMPLETED";
    }

    const data = rawPayload.data || rawPayload;

    return {
      eventId: rawPayload.event_id || rawPayload.eventId || rawPayload.id || `evt_mock_${Date.now()}`,
      eventType,
      provider: "MOCK",
      providerCustomerId: data.customer_id || data.customerId || data.provider_customer_id,
      providerSubscriptionId: data.subscription_id || data.subscriptionId || data.provider_subscription_id,
      externalPaymentId: data.payment_id || data.paymentId || data.external_payment_id || `pay_mock_${Date.now()}`,
      amount: Number(data.amount) || 0,
      currency: data.currency || "IDR",
      paidAt: data.paid_at || data.paidAt || new Date().toISOString(),
      customerEmail: data.customer_email || data.customerEmail || data.email,
      customerName: data.customer_name || data.customerName || data.name,
      orgId: data.org_id || data.orgId || data.metadata?.org_id || data.metadata?.orgId,
      planId: data.plan_id || data.planId || data.metadata?.plan_id || data.metadata?.planId,
      billingInterval: data.billing_interval || data.billingInterval || data.metadata?.billing_interval || "MONTHLY",
      metadata: data.metadata || {},
      rawPayload,
    };
  }

  async refundPayment(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }> {
    return {
      refundId: `mock_ref_${Date.now()}`,
      status: "SUCCEEDED",
    };
  }

  async reconcileTransaction(externalTransactionId: string): Promise<{ status: string; amount: number; settledAt?: string }> {
    return {
      status: "SETTLED",
      amount: 5000000,
      settledAt: new Date().toISOString(),
    };
  }
}
