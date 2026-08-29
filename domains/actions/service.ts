import { ActionPriority, OutcomeType, ACTION_PRIORITIES } from "@/lib/constants";

export interface ActionPriorityInput {
  financialExposure: number;
  riskSeverity?: "low" | "medium" | "high" | "critical";
  agingDays?: number;
  dueDate?: string | Date;
}

export interface ActionPriorityResult {
  suggestedPriority: ActionPriority;
  priorityScore: number;
  reason: string;
}

/**
 * Deterministically suggests action priority based on financial exposure and urgency
 */
export function suggestActionPriority(input: ActionPriorityInput): ActionPriorityResult {
  let score = 0;
  const reasons: string[] = [];

  // Exposure Scoring (in Rupiah)
  const exposure = input.financialExposure || 0;
  if (exposure >= 1_000_000_000) {
    score += 40;
    reasons.push("Eksposur finansial material (≥ Rp 1,0 Miliar)");
  } else if (exposure >= 500_000_000) {
    score += 25;
    reasons.push("Eksposur finansial signifikan (≥ Rp 500 Juta)");
  } else if (exposure > 0) {
    score += 10;
  }

  // Risk Severity Scoring
  if (input.riskSeverity === "critical") {
    score += 35;
    reasons.push("Tingkat keparahan risiko Kritis");
  } else if (input.riskSeverity === "high") {
    score += 20;
    reasons.push("Tingkat keparahan risiko Tinggi");
  } else if (input.riskSeverity === "medium") {
    score += 10;
  }

  // Aging Scoring
  const aging = input.agingDays || 0;
  if (aging >= 14) {
    score += 20;
    reasons.push(`Masalah telah tertahan ${aging} hari`);
  } else if (aging >= 7) {
    score += 10;
  }

  // Due Date Urgency
  if (input.dueDate) {
    const due = new Date(input.dueDate);
    const today = new Date();
    const diffHours = (due.getTime() - today.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      score += 30;
      reasons.push("Action telah melewati batas waktu (Overdue)");
    } else if (diffHours <= 24) {
      score += 20;
      reasons.push("Batas waktu jatuh tempo dalam 24 jam");
    } else if (diffHours <= 72) {
      score += 10;
    }
  }

  let suggestedPriority: ActionPriority = ACTION_PRIORITIES.LOW;
  if (score >= 60) {
    suggestedPriority = ACTION_PRIORITIES.CRITICAL;
  } else if (score >= 40) {
    suggestedPriority = ACTION_PRIORITIES.HIGH;
  } else if (score >= 20) {
    suggestedPriority = ACTION_PRIORITIES.MEDIUM;
  }

  return {
    suggestedPriority,
    priorityScore: score,
    reason: reasons.length > 0 ? reasons.join(" • ") : "Prioritas standar berdasarkan parameter dasar.",
  };
}

export interface ResolveActionInput {
  actionId: string;
  resolutionText: string;
  outcomeType: OutcomeType;
  outcomeValue?: number;
  resolvedByUserId: string;
}

export interface ResolveActionResult {
  success: boolean;
  resolvedAt: string;
  outcomeType: OutcomeType;
  outcomeValue: number;
  error?: string;
}

export function validateActionResolution(input: ResolveActionInput): ResolveActionResult {
  if (!input.resolutionText || input.resolutionText.trim().length < 5) {
    return {
      success: false,
      resolvedAt: new Date().toISOString(),
      outcomeType: input.outcomeType,
      outcomeValue: 0,
      error: "Catatan resolusi wajib diisi minimal 5 karakter untuk menyelesaikan action.",
    };
  }

  if (!input.outcomeType) {
    return {
      success: false,
      resolvedAt: new Date().toISOString(),
      outcomeType: "unknown",
      outcomeValue: 0,
      error: "Jenis hasil finansial (Outcome Type) wajib dipilih.",
    };
  }

  return {
    success: true,
    resolvedAt: new Date().toISOString(),
    outcomeType: input.outcomeType,
    outcomeValue: Math.max(0, input.outcomeValue || 0),
  };
}
