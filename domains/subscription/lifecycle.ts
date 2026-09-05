/**
 * COVE Phase 14: Subscription Lifecycle State Machine Domain Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 7, 12)
 */

import { Subscription, SubscriptionStatus, SubscriptionStatusEvent } from "../billing/types";
import { TransitionRequest, TransitionResult } from "./types";

/**
 * Permitted transitions graph between the 11 official lifecycle states
 */
export const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["ACTIVE", "PILOT_ACTIVE", "DRAFT", "CANCELLED"],
  PILOT_ACTIVE: ["ACTIVE", "EXPIRED", "MANUAL_GRANT", "CANCELLED"],
  ACTIVE: [
    "CANCEL_AT_PERIOD_END",
    "PAST_DUE",
    "READ_ONLY",
    "SUSPENDED",
    "CANCELLED",
    "MANUAL_GRANT",
  ],
  CANCEL_AT_PERIOD_END: ["ACTIVE", "CANCELLED", "PAST_DUE"],
  PAST_DUE: ["ACTIVE", "READ_ONLY", "CANCELLED", "MANUAL_GRANT"],
  READ_ONLY: ["ACTIVE", "SUSPENDED", "CANCELLED", "MANUAL_GRANT"],
  SUSPENDED: ["ACTIVE", "CANCELLED", "MANUAL_GRANT"],
  CANCELLED: ["PENDING_PAYMENT", "ACTIVE", "MANUAL_GRANT"],
  EXPIRED: ["PENDING_PAYMENT", "ACTIVE", "MANUAL_GRANT"],
  MANUAL_GRANT: ["ACTIVE", "READ_ONLY", "EXPIRED", "CANCELLED"],
};

/**
 * Validates whether a transition from one state to another is permissible
 */
export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return true; // Idempotent no-op
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Executes state machine transition with audit trail generation
 */
export function executeSubscriptionTransition(
  subscription: Subscription,
  request: TransitionRequest
): {
  result: TransitionResult;
  updatedSubscription: Subscription;
  statusEvent?: SubscriptionStatusEvent;
} {
  const fromStatus = subscription.status;
  const toStatus = request.targetStatus;

  // 1. Idempotent check
  if (fromStatus === toStatus) {
    return {
      result: {
        success: true,
        fromStatus,
        toStatus,
      },
      updatedSubscription: subscription,
    };
  }

  // 2. Validate transition legality
  if (!canTransition(fromStatus, toStatus)) {
    return {
      result: {
        success: false,
        fromStatus,
        toStatus,
        error: `[INVALID_STATE_TRANSITION] Transisi status dari ${fromStatus} ke ${toStatus} tidak diizinkan oleh aturan bisnis COVE.`,
      },
      updatedSubscription: subscription,
    };
  }

  // 3. Clone and apply state modifications
  const updated: Subscription = {
    ...subscription,
    status: toStatus,
    updatedAt: request.effectiveDate || new Date().toISOString(),
  };

  if (toStatus === "CANCEL_AT_PERIOD_END") {
    updated.cancelAtPeriodEnd = true;
    updated.churnReason = request.reason;
  } else if (toStatus === "ACTIVE") {
    updated.cancelAtPeriodEnd = false;
    updated.gracePeriodEnd = undefined;
  } else if (toStatus === "PAST_DUE") {
    const graceDays = request.gracePeriodDays || 7;
    const graceEnd = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
    updated.gracePeriodEnd = graceEnd.toISOString();
  } else if (toStatus === "CANCELLED") {
    updated.canceledAt = new Date().toISOString();
  }

  // 4. Create immutable status event for audit trail
  const statusEvent: SubscriptionStatusEvent = {
    id: "sub-event-" + Math.random().toString(36).substring(2, 9),
    subscriptionId: subscription.id,
    fromStatus,
    toStatus,
    reason: request.reason,
    source: request.source,
    actorId: request.actorId,
    correlationId: request.correlationId,
    createdAt: new Date().toISOString(),
  };

  return {
    result: {
      success: true,
      fromStatus,
      toStatus,
      eventRecorded: true,
    },
    updatedSubscription: updated,
    statusEvent,
  };
}
