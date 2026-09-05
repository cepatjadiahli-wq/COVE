/**
 * COVE Phase 14: Billing & Entitlement Domain Types
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 8, 9)
 */

export type PlanId =
  | "b2b_pilot"
  | "b2b_core"
  | "b2b_scale"
  | "b2b_enterprise"
  | "b2b_addon_project"
  | "lifetime_799k";

export type SubscriptionStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PILOT_ACTIVE"
  | "ACTIVE"
  | "CANCEL_AT_PERIOD_END"
  | "PAST_DUE"
  | "READ_ONLY"
  | "SUSPENDED"
  | "CANCELLED"
  | "EXPIRED"
  | "MANUAL_GRANT";

export type BillingInterval = "MONTHLY" | "ANNUAL" | "ONEOFF_45_DAYS";

export type PaymentProvider = "XENDIT" | "MAYAR" | "MOCK";

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  tierLevel: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
}

export interface Price {
  id: string; // e.g. 'price_core_monthly_v1'
  planId: PlanId;
  currency: string;
  amount: number;
  billingInterval: BillingInterval;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface PlanEntitlement {
  id: string;
  planId: PlanId;
  maxActiveProjects: number; // -1 for unlimited
  maxUsers: number; // -1 for unlimited
  importEnabled: boolean;
  valueGapLedgerEnabled: boolean;
  claimReadinessEnabled: boolean;
  actionQueueEnabled: boolean;
  portfolioReviewLevel: "SINGLE" | "MULTI_RANKING" | "ENTERPRISE";
  roiLedgerEnabled: boolean;
  auditLevel: "STANDARD" | "EXTENDED" | "FORENSIC";
  emailDigestEnabled: boolean;
  exportEnabled: boolean;
  apiEnabled: boolean;
  ssoEnabled: boolean;
  storageLimitMb: number;
  supportTier: "COMMUNITY" | "STANDARD" | "PRIORITY" | "DEDICATED";
  createdAt: string;
}

export interface Subscription {
  id: string;
  orgId: string;
  planId: PlanId;
  priceId: string;
  provider: PaymentProvider;
  providerSubscriptionId?: string;
  billingInterval: BillingInterval;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  churnReason?: string;
  gracePeriodEnd?: string;
  nextBillingDate?: string;
  cancellationReason?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionItem {
  id: string;
  subscriptionId: string;
  itemType: "BASE_PLAN" | "ACTIVE_PROJECT_ADDON";
  unitPrice: number;
  quantity: number;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionStatusEvent {
  id: string;
  subscriptionId: string;
  fromStatus: SubscriptionStatus;
  toStatus: SubscriptionStatus;
  reason: string;
  source: "WEBHOOK" | "CRON" | "ADMIN_OVERRIDE" | "MIGRATION" | "USER_REQUEST";
  actorId?: string;
  correlationId?: string;
  createdAt: string;
}

export interface BillingInvoice {
  id: string;
  orgId: string;
  subscriptionId?: string;
  invoiceNumber: string;
  amountSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  amountTotal: number;
  currency: string;
  status: "DRAFT" | "PENDING" | "PAID" | "VOID" | "FAILED";
  dueDate: string;
  paidAt?: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  orgId: string;
  billingInvoiceId?: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  paymentMethod: string;
  status: "SUCCEEDED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  paidAt: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface PaymentAttempt {
  id: string;
  billingInvoiceId: string;
  attemptNumber: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  gatewayErrorCode?: string;
  gatewayErrorMessage?: string;
  attemptedAt: string;
}

export interface WebhookEvent {
  id: string;
  provider: PaymentProvider;
  eventId: string;
  eventType: string;
  rawPayload: Record<string, any>;
  processingStatus: "PENDING" | "PROCESSED" | "FAILED" | "IGNORED";
  errorMessage?: string;
  retryCount: number;
  processedAt?: string;
  createdAt: string;
}

export interface EntitlementSnapshot {
  id: string;
  orgId: string;
  subscriptionId?: string;
  maxActiveProjects: number;
  maxUsers: number;
  features: Record<string, boolean>;
  effectiveFrom: string;
  effectiveUntil?: string;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  orgId: string;
  metricName: "ACTIVE_PROJECTS" | "ACTIVE_USERS" | "STORAGE_BYTES";
  currentValue: number;
  recordedAt: string;
}

export interface SubscriptionOverride {
  id: string;
  orgId: string;
  grantedBy: string;
  reason: string;
  overrideMaxProjects?: number;
  overrideFeatures?: Record<string, boolean>;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface Discount {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  applicablePlanId?: PlanId;
  maxRedemptions?: number;
  currentRedemptions: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

export interface BillingAuditLog {
  id: string;
  orgId?: string;
  actorId: string;
  actorRole?: string;
  action: string;
  targetEntity?: string;
  targetId?: string;
  details?: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
