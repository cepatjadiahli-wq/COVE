/**
 * COVE Phase 14: Server-Side Entitlement Guard Types
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 8, 16)
 */

import { PlanId, SubscriptionStatus, SubscriptionOverride } from "../billing/types";

export interface EntitlementEvaluation {
  allowed: boolean;
  orgId: string;
  status: SubscriptionStatus;
  planId: PlanId;
  canMutate: boolean;
  canView: boolean;
  canExport: boolean; // Always true per PRD 28.1 Open Data Guarantee
  maxActiveProjects: number;
  currentActiveProjects: number;
  isProjectQuotaReached: boolean;
  maxUsers: number;
  currentUsers: number;
  isUserQuotaReached: boolean;
  features: Record<string, boolean>;
  reason?: string;
  gracePeriodDaysRemaining?: number;
  activeOverride?: SubscriptionOverride;
}

export type MutationType =
  | "CREATE_PROJECT"
  | "UPDATE_PROJECT"
  | "IMPORT_TRACKER"
  | "COMMIT_IMPORT"
  | "CREATE_CLAIM"
  | "TRANSITION_CLAIM"
  | "OVERRIDE_CHECKLIST"
  | "CREATE_ACTION"
  | "RESOLVE_ACTION"
  | "REOPEN_ACTION"
  | "UPDATE_READINESS"
  | "INVITE_USER"
  | "LOCK_SNAPSHOT";

export interface MutationGuardResult {
  allowed: boolean;
  code: "ALLOWED" | "READ_ONLY_BLOCK" | "QUOTA_EXCEEDED" | "FEATURE_DISABLED" | "ORG_SUSPENDED";
  message: string;
}
