/**
 * COVE Phase 14: Server-Side Entitlement Guard Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 8, 16)
 */

import { Subscription, PlanEntitlement, SubscriptionOverride } from "../billing/types";
import { INITIAL_PLAN_ENTITLEMENTS } from "../billing/seed-data";
import { EntitlementEvaluation, MutationGuardResult, MutationType } from "./types";

export interface CanonicalManualOverride {
  id?: string;
  subscriptionId?: string;
  subscription_id?: string;
  orgId?: string;
  org_id?: string;
  overrideType?: string;
  override_type?: string;
  previousValue?: Record<string, unknown>;
  previous_value?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  reason?: string;
  adminId?: string;
  admin_id?: string;
  expiresAt?: string;
  expires_at?: string;
  isRevoked?: boolean;
  is_revoked?: boolean;
  overrideMaxProjects?: number;
  overrideFeatures?: Record<string, boolean>;
  isActive?: boolean;
}

/**
 * Evaluates tenant entitlement based on active subscription, limits, and overrides
 */
export function evaluateTenantEntitlement(params: {
  orgId: string;
  subscription?: Subscription | null;
  activeProjectsCount: number;
  activeUsersCount: number;
  activeOverride?: SubscriptionOverride | null;
  manualOverrides?: CanonicalManualOverride[] | null;
  currentTime?: string; // ISO string, defaults to NOW
}): EntitlementEvaluation {
  const { orgId, subscription, activeProjectsCount, activeUsersCount, activeOverride, manualOverrides } = params;
  const now = params.currentTime ? new Date(params.currentTime) : new Date();

  // Default fallback if no subscription exists
  if (!subscription) {
    return {
      allowed: false,
      orgId,
      status: "DRAFT",
      planId: "b2b_pilot",
      canMutate: false,
      canView: false,
      canExport: true,
      maxActiveProjects: 0,
      currentActiveProjects: activeProjectsCount,
      isProjectQuotaReached: true,
      maxUsers: 1,
      currentUsers: activeUsersCount,
      isUserQuotaReached: activeUsersCount >= 1,
      features: {},
      reason: "Organisasi belum memiliki langganan aktif. Silakan pilih paket langganan COVE.",
    };
  }

  // Find plan entitlement definition
  const baseEntitlement =
    INITIAL_PLAN_ENTITLEMENTS.find((e) => e.planId === subscription.planId) ||
    INITIAL_PLAN_ENTITLEMENTS[1]; // fallback to Core

  // 1. Check legacy override validity
  const isLegacyOverrideActive = Boolean(
    activeOverride &&
    activeOverride.isActive &&
    new Date(activeOverride.expiresAt) > now
  );

  // 2. Check canonical manual_subscription_overrides
  const activeCanonicalList = (manualOverrides || []).filter((o) => {
    const isRevoked = o.isRevoked ?? o.is_revoked ?? false;
    const expiryStr = o.expiresAt || o.expires_at;
    if (isRevoked || !expiryStr) return false;
    return new Date(expiryStr) > now;
  });

  const accessExtOverride = activeCanonicalList.find(
    (o) => (o.overrideType || o.override_type) === "ACCESS_EXTENSION"
  );
  const statusOverride = activeCanonicalList.find(
    (o) => (o.overrideType || o.override_type) === "STATUS_OVERRIDE"
  );
  const boostOverride = activeCanonicalList.find(
    (o) => (o.overrideType || o.override_type) === "ENTITLEMENT_BOOST"
  );

  // Determine effective subscription status (may be overridden by STATUS_OVERRIDE)
  let effectiveStatus = subscription.status;
  if (statusOverride) {
    const forcedStatus = (statusOverride.newValue?.status || statusOverride.new_value?.status) as string;
    if (forcedStatus) {
      effectiveStatus = forcedStatus as any;
    }
  }

  // Determine project quota override
  let maxProjects = baseEntitlement.maxActiveProjects;
  if (isLegacyOverrideActive && activeOverride?.overrideMaxProjects !== undefined) {
    maxProjects = activeOverride.overrideMaxProjects;
  } else if (boostOverride) {
    const boosted =
      boostOverride.newValue?.max_projects ??
      boostOverride.new_value?.max_projects ??
      boostOverride.newValue?.maxActiveProjects ??
      boostOverride.new_value?.maxActiveProjects ??
      boostOverride.newValue?.override_max_projects ??
      boostOverride.new_value?.override_max_projects;
    if (boosted !== undefined) {
      maxProjects = Number(boosted);
    }
  }

  // Evaluate grace period for PAST_DUE
  let isWithinGrace = false;
  let graceDaysRemaining = 0;
  if (effectiveStatus === "PAST_DUE" && subscription.gracePeriodEnd) {
    const graceEnd = new Date(subscription.gracePeriodEnd);
    if (now <= graceEnd) {
      isWithinGrace = true;
      const diffMs = graceEnd.getTime() - now.getTime();
      graceDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Determine canMutate
  let canMutate = false;
  let reason: string | undefined = undefined;

  // Immediate check for ACCESS_EXTENSION override
  if (accessExtOverride) {
    canMutate = true;
    const extExpiry = accessExtOverride.expiresAt || accessExtOverride.expires_at;
    reason = `Akses mutasi diperpanjang melalui manual override hingga ${extExpiry}.`;
  } else {
    switch (effectiveStatus) {
      case "ACTIVE":
      case "PILOT_ACTIVE":
      case "CANCEL_AT_PERIOD_END":
        canMutate = true;
        break;

      case "PAST_DUE":
        if (isWithinGrace) {
          canMutate = true;
          reason = `Pembayaran perpanjangan tertunda. Masa tenggang aktif (${graceDaysRemaining} hari tersisa).`;
        } else {
          canMutate = false;
          reason = "Masa tenggang pembayaran 7 hari telah berakhir. Akses diubah menjadi Baca-Saja (READ_ONLY).";
        }
        break;

      case "READ_ONLY":
        canMutate = false;
        reason = "Akun dalam mode Baca-Saja karena tunggakan pembayaran. Fitur penambahan & perubahan data dikunci.";
        break;

      case "SUSPENDED":
        canMutate = false;
        reason = "Akun ditangguhkan (SUSPENDED) karena tunggakan lebih dari 21 hari. Hubungi finance@cove.id.";
        break;

      case "CANCELLED":
      case "EXPIRED":
        canMutate = false;
        reason = "Periode langganan telah berakhir. Aktifkan kembali untuk melanjutkan penggunaan penuh.";
        break;

      case "MANUAL_GRANT":
        canMutate = isLegacyOverrideActive || activeCanonicalList.length > 0;
        reason = canMutate
          ? "Akses manual khusus aktif."
          : "Akses manual khusus telah kedaluwarsa.";
        break;

      case "DRAFT":
      case "PENDING_PAYMENT":
      default:
        canMutate = false;
        reason = "Menunggu penyelesaian pembayaran.";
        break;
    }
  }

  const isProjectQuotaReached =
    maxProjects !== -1 && activeProjectsCount >= maxProjects;

  const isUserQuotaReached =
    baseEntitlement.maxUsers !== -1 && activeUsersCount >= baseEntitlement.maxUsers;

  const features: Record<string, boolean> = {
    import: baseEntitlement.importEnabled,
    valueGapLedger: baseEntitlement.valueGapLedgerEnabled,
    claimReadiness: baseEntitlement.claimReadinessEnabled,
    actionQueue: baseEntitlement.actionQueueEnabled,
    roiLedger: baseEntitlement.roiLedgerEnabled,
    export: baseEntitlement.exportEnabled,
    api: baseEntitlement.apiEnabled,
    sso: baseEntitlement.ssoEnabled,
  };

  if (isLegacyOverrideActive && activeOverride?.overrideFeatures) {
    Object.assign(features, activeOverride.overrideFeatures);
  }

  if (boostOverride) {
    const boostFeatures = (boostOverride.newValue?.features ||
      boostOverride.new_value?.features ||
      boostOverride.newValue?.override_features ||
      boostOverride.new_value?.override_features ||
      {}) as Record<string, boolean>;
    Object.assign(features, boostFeatures);
  }

  return {
    allowed: canMutate,
    orgId,
    status: effectiveStatus,
    planId: subscription.planId,
    canMutate,
    canView: effectiveStatus !== "SUSPENDED",
    canExport: true, // Always true per Open Data Guarantee PRD 28.1
    maxActiveProjects: maxProjects,
    currentActiveProjects: activeProjectsCount,
    isProjectQuotaReached,
    maxUsers: baseEntitlement.maxUsers,
    currentUsers: activeUsersCount,
    isUserQuotaReached,
    features,
    reason,
    gracePeriodDaysRemaining: isWithinGrace ? graceDaysRemaining : 0,
    activeOverride: isLegacyOverrideActive && activeOverride ? activeOverride : undefined,
  };
}

/**
 * Server-Side Mutation Guard
 * Evaluates whether a write mutation (create/update/import/delete) is authorized
 */
export function guardMutation(
  evaluation: EntitlementEvaluation,
  mutationType: MutationType
): MutationGuardResult {
  if (evaluation.status === "SUSPENDED") {
    return {
      allowed: false,
      code: "ORG_SUSPENDED",
      message: "Akses akun ditangguhkan karena tunggakan penagihan. Seluruh mutasi operasional diblokir.",
    };
  }

  if (!evaluation.canMutate) {
    return {
      allowed: false,
      code: "READ_ONLY_BLOCK",
      message:
        evaluation.reason ||
        "Akun berada dalam mode Baca-Saja (READ_ONLY). Fitur perubahan data, impor, dan pengajuan klaim tidak dapat dijalankan.",
    };
  }

  if (mutationType === "CREATE_PROJECT") {
    if (evaluation.isProjectQuotaReached) {
      return {
        allowed: false,
        code: "QUOTA_EXCEEDED",
        message: `Batas kuota proyek aktif untuk paket Anda (${evaluation.maxActiveProjects} proyek) telah tercapai. Tambahkan lisensi Project Add-on (Rp750rb/bln) atau arsipkan proyek yang telah selesai.`,
      };
    }
  }

  if (mutationType === "INVITE_USER") {
    if (evaluation.isUserQuotaReached) {
      return {
        allowed: false,
        code: "QUOTA_EXCEEDED",
        message: `Batas kuota pengguna aktif untuk paket Anda (${evaluation.maxUsers} pengguna) telah tercapai. Tingkatkan paket langganan Anda untuk menambah pengguna baru.`,
      };
    }
  }

  return {
    allowed: true,
    code: "ALLOWED",
    message: "Mutasi diizinkan oleh Entitlement Guard.",
  };
}
