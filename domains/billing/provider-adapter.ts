/**
 * COVE Phase 15: Generic Payment Provider Adapter Interface
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 10, 11)
 * Reference: docs/COVE_PAYMENT_PROVIDER_DECISION.md
 */

import { PaymentProvider, PlanId, BillingInterval } from "./types";

export type NormalizedEventType =
  | "CHECKOUT_COMPLETED"
  | "SUBSCRIPTION_ACTIVATED"
  | "BILLING_CYCLE_CREATED"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_CHANGED"
  | "CANCELLATION_SCHEDULED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_EXPIRED"
  | "REFUND_COMPLETED"
  | "TEST_EVENT"
  | "IGNORED_EVENT";

export interface NormalizedWebhookEvent {
  eventId: string;
  eventType: NormalizedEventType;
  provider: PaymentProvider;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  externalPaymentId?: string;
  amount: number;
  currency: string;
  paidAt?: string;
  customerEmail?: string;
  customerName?: string;
  orgId?: string;
  planId?: PlanId;
  billingInterval?: BillingInterval;
  metadata?: Record<string, any>;
  rawPayload: Record<string, any>;
}

export interface CreateCustomerParams {
  orgId: string;
  name: string;
  email: string;
  phone?: string;
}

export interface CheckoutSessionParams {
  orgId: string;
  planId: PlanId;
  priceId: string;
  amount: number;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  provider: PaymentProvider;
  amount: number;
  expiresAt?: string;
  simulation?: boolean;
}

export interface CreateSubscriptionParams {
  orgId: string;
  providerCustomerId: string;
  planId: PlanId;
  amount: number;
  interval: "MONTHLY" | "ANNUAL";
  idempotencyKey?: string;
}

export interface PaymentProviderCapabilities {
  supportsRecurringCharge: boolean;
  supportsSavedPaymentMethod: boolean;
  supportsAutomaticRetry: boolean;
  supportsHostedCheckout: boolean;
  supportsPaymentLink: boolean;
}

/**
 * Generic Payment Provider Adapter Interface
 * All payment gateways (Xendit, Mayar, Mock) must implement this interface.
 */
export interface PaymentProviderAdapter {
  readonly providerName: PaymentProvider;
  readonly capabilities: PaymentProviderCapabilities;

  createCustomer(params: CreateCustomerParams): Promise<{ providerCustomerId: string }>;

  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;

  createSubscription(params: CreateSubscriptionParams): Promise<{ providerSubscriptionId: string; status: string }>;

  getSubscription(providerSubscriptionId: string): Promise<{ id: string; status: string; currentPeriodEnd?: string }>;

  cancelSubscription(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<{ success: boolean; effectiveDate?: string }>;

  verifyWebhook(headers: Record<string, string | null | undefined>, rawBody: string): boolean;

  normalizeWebhookEvent(rawPayload: any, headers?: Record<string, string | null | undefined>): NormalizedWebhookEvent;

  refundPayment(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }>;

  reconcileTransaction(externalTransactionId: string): Promise<{ status: string; amount: number; settledAt?: string }>;
}
