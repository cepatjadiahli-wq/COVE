/**
 * COVE Phase 17: Dunning & Lifecycle Automation Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 7)
 * PRD Reference: COVE_PRD_v1.0_Validation_Gated_MVP.md (Section 28 Open Data Guarantee)
 * 
 * Rules:
 * 1. Timestamps stored strictly in UTC.
 * 2. User-facing display converted to Asia/Jakarta (WIB).
 * 3. Schedule calculated deterministically relative to billing_due_at.
 * 4. Fake clock support for testing via asOfDate parameter.
 * 5. Idempotent key generation prevents duplicate notifications or transitions.
 * 6. Legacy lifetime plans ('lifetime_799k') strictly excluded from dunning/renewal.
 */

import { SubscriptionStatus } from "../billing/types";

export type DunningStage =
  | "H_MINUS_7"
  | "H_MINUS_1"
  | "DUE_DATE"
  | "H_PLUS_1"
  | "H_PLUS_3"
  | "H_PLUS_7"
  | "H_PLUS_21";

export interface DunningStageConfig {
  stage: DunningStage;
  offsetDays: number; // relative to billing_due_at (negative = before, positive = after)
  targetStatus: SubscriptionStatus;
  actionType: "NOTIFICATION" | "STATE_TRANSITION" | "PAYMENT_RETRY";
  description: string;
  consequence: string;
}

export const DUNNING_STAGES: DunningStageConfig[] = [
  {
    stage: "H_MINUS_7",
    offsetDays: -7,
    targetStatus: "ACTIVE",
    actionType: "NOTIFICATION",
    description: "Pengingat awal perpanjangan (H-7)",
    consequence: "Langganan akan diperpanjang otomatis atau silakan bayar sebelum tanggal jatuh tempo agar operasional tetap lancar.",
  },
  {
    stage: "H_MINUS_1",
    offsetDays: -1,
    targetStatus: "ACTIVE",
    actionType: "NOTIFICATION",
    description: "Pengingat terakhir sebelum jatuh tempo (H-1)",
    consequence: "Tagihan akan jatuh tempo besok. Harap selesaikan pembayaran untuk menghindari masa penunggakan.",
  },
  {
    stage: "DUE_DATE",
    offsetDays: 0,
    targetStatus: "PAST_DUE",
    actionType: "STATE_TRANSITION",
    description: "Invoice jatuh tempo dan instruksi pembayaran (Hari H)",
    consequence: "Tagihan jatuh tempo hari ini. Masa tenggang 7 hari kalender aktif dengan operasional penuh.",
  },
  {
    stage: "H_PLUS_1",
    offsetDays: 1,
    targetStatus: "PAST_DUE",
    actionType: "NOTIFICATION",
    description: "Pengingat pertama keterlambatan (H+1)",
    consequence: "Tagihan Anda belum terbayar. Anda berada dalam masa tenggang hingga H+7 tanpa gangguan mutasi data.",
  },
  {
    stage: "H_PLUS_3",
    offsetDays: 3,
    targetStatus: "PAST_DUE",
    actionType: "NOTIFICATION",
    description: "Eskalasi keterlambatan (H+3)",
    consequence: "Masa tenggang tersisa 4 hari. Lunasi segera sebelum akun dialihkan ke mode READ_ONLY pada H+7.",
  },
  {
    stage: "H_PLUS_7",
    offsetDays: 7,
    targetStatus: "READ_ONLY",
    actionType: "STATE_TRANSITION",
    description: "Akhir grace period dan transisi menuju READ_ONLY (H+7)",
    consequence: "Masa tenggang telah berakhir. Akun beralih ke READ_ONLY. Mutasi data dibekukan; pembacaan, billing, dan ekspor data tetap 100% aktif.",
  },
  {
    stage: "H_PLUS_21",
    offsetDays: 21,
    targetStatus: "SUSPENDED",
    actionType: "STATE_TRANSITION",
    description: "Transisi menuju SUSPENDED (H+21)",
    consequence: "Akun berstatus SUSPENDED karena tagihan tertunggak 3 minggu. Ekspor data lengkap dan kanal pembayaran pemulihan tetap tersedia.",
  },
];

export interface ScheduledStageItem {
  stage: DunningStage;
  scheduledAt: string; // ISO 8601 UTC
  scheduledAtWib: string; // Asia/Jakarta formatted
  targetStatus: SubscriptionStatus;
  consequence: string;
  isPastOrDue: boolean;
}

/**
 * Formats an ISO UTC timestamp into Asia/Jakarta (WIB) display string
 */
export function formatJakartaTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Checks whether a given plan ID is a legacy non-renewable tier
 */
export function isLegacyPlan(planId?: string): boolean {
  if (!planId) return false;
  const normalized = planId.toLowerCase().trim();
  return normalized === "lifetime_799k" || normalized === "lifetime";
}

/**
 * Deterministically calculates all dunning schedule milestones relative to billing_due_at
 */
export function calculateDunningSchedule(
  billingDueAtInput: Date | string,
  asOfDateInput?: Date | string
): ScheduledStageItem[] {
  const dueDate = typeof billingDueAtInput === "string" ? new Date(billingDueAtInput) : billingDueAtInput;
  const asOfDate = asOfDateInput
    ? typeof asOfDateInput === "string"
      ? new Date(asOfDateInput)
      : asOfDateInput
    : new Date();

  return DUNNING_STAGES.map((cfg) => {
    const scheduled = new Date(dueDate.getTime() + cfg.offsetDays * 24 * 60 * 60 * 1000);
    const scheduledIso = scheduled.toISOString();
    return {
      stage: cfg.stage,
      scheduledAt: scheduledIso,
      scheduledAtWib: formatJakartaTime(scheduled),
      targetStatus: cfg.targetStatus,
      consequence: cfg.consequence,
      isPastOrDue: asOfDate.getTime() >= scheduled.getTime(),
    };
  });
}

/**
 * Evaluates the current applicable dunning stage for a subscription as of a target date (fake clock support)
 */
export function evaluateDunningStage(
  subscription: {
    id: string;
    status: SubscriptionStatus | string;
    currentPeriodEnd: string;
    gracePeriodEnd?: string;
    planId?: string;
  },
  asOfDateInput?: Date | string
): {
  isLegacy: boolean;
  activeStage: DunningStage | null;
  targetStatus: SubscriptionStatus;
  schedule: ScheduledStageItem[];
  skippedStages: DunningStage[];
  consequence: string;
  isGracePeriodActive: boolean;
} {
  if (isLegacyPlan(subscription.planId)) {
    return {
      isLegacy: true,
      activeStage: null,
      targetStatus: subscription.status as SubscriptionStatus,
      schedule: [],
      skippedStages: [],
      consequence: "Paket legacy lifetime tidak tunduk pada siklus renewal atau dunning.",
      isGracePeriodActive: false,
    };
  }

  const asOfDate = asOfDateInput
    ? typeof asOfDateInput === "string"
      ? new Date(asOfDateInput)
      : asOfDateInput
    : new Date();

  const schedule = calculateDunningSchedule(subscription.currentPeriodEnd, asOfDate);

  // Find the highest stage where asOfDate >= scheduledAt
  const pastStages = schedule.filter((s) => s.isPastOrDue);
  const activeStageItem = pastStages.length > 0 ? pastStages[pastStages.length - 1] : null;

  // Evaluate grace period (due date to H+7)
  const dueDate = new Date(subscription.currentPeriodEnd);
  const graceEndDate = new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isGracePeriodActive =
    asOfDate.getTime() >= dueDate.getTime() && asOfDate.getTime() < graceEndDate.getTime();

  // Identify obsolete stages prior to the current active stage that should be marked skipped
  const skippedStages: DunningStage[] = [];
  if (activeStageItem) {
    for (const item of pastStages) {
      if (item.stage !== activeStageItem.stage) {
        skippedStages.push(item.stage);
      }
    }
  }

  return {
    isLegacy: false,
    activeStage: activeStageItem ? activeStageItem.stage : null,
    targetStatus: activeStageItem ? activeStageItem.targetStatus : (subscription.status as SubscriptionStatus),
    schedule,
    skippedStages,
    consequence: activeStageItem
      ? activeStageItem.consequence
      : "Langganan dalam periode aktif normal.",
    isGracePeriodActive,
  };
}

/**
 * Evaluates late cron catch-up policy:
 * If a cron run was delayed, skips obsolete intermediate notification stages
 * while safely applying the latest required state transition.
 */
export function evaluateCatchUpPolicy(params: {
  subscription: {
    id: string;
    status: SubscriptionStatus | string;
    currentPeriodEnd: string;
    gracePeriodEnd?: string;
    planId?: string;
  };
  asOfDate?: Date | string;
  previouslyProcessedStages?: string[];
}): {
  isCatchUp: boolean;
  effectiveStage: DunningStage | null;
  targetStatus: SubscriptionStatus;
  obsoleteStagesToSkip: DunningStage[];
  actionRequired: "STATE_TRANSITION" | "NOTIFICATION" | "NONE";
} {
  const evalResult = evaluateDunningStage(params.subscription, params.asOfDate);
  if (evalResult.isLegacy || !evalResult.activeStage) {
    return {
      isCatchUp: false,
      effectiveStage: null,
      targetStatus: params.subscription.status as SubscriptionStatus,
      obsoleteStagesToSkip: [],
      actionRequired: "NONE",
    };
  }

  const processed = new Set(params.previouslyProcessedStages || []);
  const obsoleteToSkip = evalResult.skippedStages.filter((s: DunningStage) => !processed.has(s));
  const isCatchUp = obsoleteToSkip.length > 0;

  let actionRequired: "STATE_TRANSITION" | "NOTIFICATION" | "NONE" = "NONE";
  if (evalResult.targetStatus !== params.subscription.status) {
    actionRequired = "STATE_TRANSITION";
  } else if (!processed.has(evalResult.activeStage)) {
    actionRequired = "NOTIFICATION";
  }

  return {
    isCatchUp,
    effectiveStage: evalResult.activeStage,
    targetStatus: evalResult.targetStatus,
    obsoleteStagesToSkip: obsoleteToSkip,
    actionRequired,
  };
}

/**
 * Generates an idempotent key to prevent duplicate dunning events or notifications
 */
export function generateDunningIdempotencyKey(
  subscriptionId: string,
  invoiceId: string,
  stage: DunningStage | string,
  scheduledAt: Date | string
): string {
  const scheduledIso = typeof scheduledAt === "string" ? scheduledAt : scheduledAt.toISOString();
  return `dunning_${subscriptionId}_${invoiceId}_${stage}_${scheduledIso.split("T")[0]}`;
}
