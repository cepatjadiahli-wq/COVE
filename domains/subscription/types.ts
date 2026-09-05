/**
 * COVE Phase 14: Subscription Lifecycle Types
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 12)
 */

import { SubscriptionStatus } from "@/domains/billing/types";

export interface TransitionRequest {
  targetStatus: SubscriptionStatus;
  reason: string;
  source: "WEBHOOK" | "CRON" | "ADMIN_OVERRIDE" | "MIGRATION" | "USER_REQUEST";
  actorId?: string;
  correlationId?: string;
  effectiveDate?: string;
  gracePeriodDays?: number;
}

export interface TransitionResult {
  success: boolean;
  fromStatus: SubscriptionStatus;
  toStatus: SubscriptionStatus;
  error?: string;
  eventRecorded?: boolean;
}
