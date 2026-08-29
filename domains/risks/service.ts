import {
  ClaimStage,
  RiskLevel,
  CashAtRiskCategory,
  CASH_AT_RISK_CATEGORIES,
} from "@/lib/constants";
import { calculateClaimGaps } from "@/domains/gaps/service";

export interface RiskEvaluationInput {
  claimId: string;
  stage: ClaimStage;
  stageAgingDays: number;
  workPerformedValue: number;
  measuredValue: number;
  claimedValue: number;
  certifiedValue: number;
  invoicedGrossValue?: number;
  invoiceOutstandingTotal?: number;
  hasActiveBlockers?: boolean;
  activeBlockerSeverity?: "low" | "medium" | "high" | "critical";
  activeBlockerExposure?: number;
  activeBlockerControllability?: "internal" | "joint" | "external" | "not_software_addressable";
  evidenceReadinessPercent?: number;
  expectedCashDate?: string | Date;
  isOverdueInvoice?: boolean;
  overdueDays?: number;
  stageSlaRiskDays?: number;
  stageSlaCriticalDays?: number;
}

export interface RiskComponent {
  category: CashAtRiskCategory;
  exposureAmount: number;
  stage: ClaimStage;
  isControllable: boolean;
  reasons: string[];
}

export interface RiskEvaluationResult {
  riskLevel: RiskLevel;
  totalCashAtRisk: number;
  controllableCashAtRisk: number;
  riskReasons: string[];
  riskComponents: RiskComponent[];
  hasCriticalExposure: boolean;
}

/**
 * Deterministic Claim Risk Evaluator (Blueprint §37-§43)
 * Guarantees zero double-counting across economic stages.
 */
export function evaluateClaimRisk(input: RiskEvaluationInput): RiskEvaluationResult {
  const gaps = calculateClaimGaps({
    workPerformedValue: input.workPerformedValue,
    measuredValue: input.measuredValue,
    claimedValue: input.claimedValue,
    certifiedValue: input.certifiedValue,
    allocatedInvoiceGross: input.invoicedGrossValue,
    invoiceOutstandingTotal: input.invoiceOutstandingTotal,
  });

  const reasons: string[] = [];
  const components: RiskComponent[] = [];
  let computedRiskLevel: RiskLevel = "HEALTHY";

  const slaRiskDays = input.stageSlaRiskDays || 14;
  const slaCriticalDays = input.stageSlaCriticalDays || 21;

  // 1. Exception State Signals
  if (input.stage === "DISPUTED") {
    computedRiskLevel = "CRITICAL";
    reasons.push("Status klaim berada dalam tahap Sengketa (Disputed).");
  } else if (input.stage === "ON_HOLD") {
    computedRiskLevel = "AT_RISK";
    reasons.push("Proses klaim ditangguhkan (On Hold).");
  } else if (input.stage === "REJECTED") {
    computedRiskLevel = "CRITICAL";
    reasons.push("Pengajuan klaim ditolak (Rejected) oleh konsultan/klien.");
  }

  // 2. Stage SLA Breach Check
  if (input.stageAgingDays >= slaCriticalDays) {
    computedRiskLevel = "CRITICAL";
    reasons.push(
      `Durasi tahap (${input.stageAgingDays} hari) melebihi batas kritis SLA (${slaCriticalDays} hari).`
    );
  } else if (input.stageAgingDays >= slaRiskDays) {
    if (computedRiskLevel !== "CRITICAL") computedRiskLevel = "AT_RISK";
    reasons.push(
      `Durasi tahap (${input.stageAgingDays} hari) melebihi batas risiko SLA (${slaRiskDays} hari).`
    );
  } else if (input.stageAgingDays >= Math.floor(slaRiskDays * 0.75)) {
    if (computedRiskLevel === "HEALTHY") computedRiskLevel = "WATCH";
    reasons.push(`Durasi tahap mendekati batas peringatan SLA.`);
  }

  // 3. Active Blocker Check
  if (input.hasActiveBlockers) {
    if (input.activeBlockerSeverity === "critical" || input.activeBlockerSeverity === "high") {
      computedRiskLevel = "CRITICAL";
    } else if (computedRiskLevel === "HEALTHY" || computedRiskLevel === "WATCH") {
      computedRiskLevel = "AT_RISK";
    }
    reasons.push(
      `Terdapat blocker aktif dengan tingkat keparahan ${input.activeBlockerSeverity || "material"}.`
    );
  }

  // 4. Evidence Readiness Check for pre-submission/review stages
  if (
    ["CLAIM_PREPARATION", "CLAIM_READY", "SUBMITTED"].includes(input.stage) &&
    input.evidenceReadinessPercent !== undefined &&
    input.evidenceReadinessPercent < 80
  ) {
    if (computedRiskLevel === "HEALTHY") computedRiskLevel = "WATCH";
    reasons.push(
      `Kesiapan dokumen pendukung (evidence) baru mencapai ${Math.round(input.evidenceReadinessPercent)}% (<80%).`
    );
  }

  // 5. Overdue Invoice / Receivable Check
  if (input.isOverdueInvoice) {
    computedRiskLevel = "CRITICAL";
    reasons.push(
      `Tagihan telah jatuh tempo (overdue ${input.overdueDays || 0} hari) dan belum terbayar.`
    );
  }

  // 6. Missed Expected Cash Date
  if (input.expectedCashDate) {
    const cashDate = new Date(input.expectedCashDate);
    const today = new Date();
    if (today > cashDate && input.stage !== "PAID") {
      if (computedRiskLevel === "HEALTHY") computedRiskLevel = "WATCH";
      reasons.push("Target tanggal penerimaan kas telah terlewati.");
    }
  }

  // -------------------------------------------------------------
  // NON-DOUBLE-COUNTING CASH-AT-RISK AGGREGATION
  // Determine Cash-at-Risk based on current stage and triggered risks
  // -------------------------------------------------------------
  const isRisky = computedRiskLevel === "AT_RISK" || computedRiskLevel === "CRITICAL";
  const isControllable =
    input.activeBlockerControllability === "internal" ||
    input.activeBlockerControllability === "joint" ||
    !input.activeBlockerControllability;

  if (isRisky) {
    // A. Unmeasured at Risk
    if (["WORK_RECORDED", "MEASUREMENT"].includes(input.stage) && gaps.unmeasuredValue > 0) {
      components.push({
        category: CASH_AT_RISK_CATEGORIES.UNMEASURED_AT_RISK,
        exposureAmount: gaps.unmeasuredValue,
        stage: input.stage,
        isControllable,
        reasons,
      });
    }

    // B. Unclaimed at Risk
    if (["CLAIM_PREPARATION", "CLAIM_READY"].includes(input.stage) && gaps.unclaimedValue > 0) {
      components.push({
        category: CASH_AT_RISK_CATEGORIES.UNCLAIMED_AT_RISK,
        exposureAmount: gaps.unclaimedValue,
        stage: input.stage,
        isControllable,
        reasons,
      });
    }

    // C. Uncertified at Risk
    if (["SUBMITTED", "UNDER_REVIEW", "DISPUTED", "REJECTED"].includes(input.stage) && gaps.uncertifiedValue > 0) {
      components.push({
        category: CASH_AT_RISK_CATEGORIES.UNCERTIFIED_AT_RISK,
        exposureAmount: gaps.uncertifiedValue,
        stage: input.stage,
        isControllable,
        reasons,
      });
    }

    // D. Certified Not Invoiced at Risk
    if (["CERTIFIED", "INVOICE_READY"].includes(input.stage) && gaps.certifiedNotInvoicedValue > 0) {
      components.push({
        category: CASH_AT_RISK_CATEGORIES.CERTIFIED_NOT_INVOICED_AT_RISK,
        exposureAmount: gaps.certifiedNotInvoicedValue,
        stage: input.stage,
        isControllable,
        reasons,
      });
    }

    // E. Receivable at Risk (Invoiced not collected & overdue/disputed)
    if (["INVOICE_ISSUED", "INVOICE_ACCEPTED", "DUE", "PARTIALLY_PAID"].includes(input.stage) && gaps.invoicedNotCollectedValue > 0) {
      components.push({
        category: CASH_AT_RISK_CATEGORIES.RECEIVABLE_AT_RISK,
        exposureAmount: gaps.invoicedNotCollectedValue,
        stage: input.stage,
        isControllable,
        reasons,
      });
    }
  }

  const totalCashAtRisk = components.reduce((acc, c) => acc + c.exposureAmount, 0);
  const controllableCashAtRisk = components
    .filter((c) => c.isControllable)
    .reduce((acc, c) => acc + c.exposureAmount, 0);

  return {
    riskLevel: computedRiskLevel,
    totalCashAtRisk,
    controllableCashAtRisk,
    riskReasons: reasons.length > 0 ? reasons : ["Semua parameter berada dalam batas wajar."],
    riskComponents: components,
    hasCriticalExposure: computedRiskLevel === "CRITICAL",
  };
}
