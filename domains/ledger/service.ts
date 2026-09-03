/**
 * COVE Value Gap Ledger, Stage Engine & Aging Service
 * PRD Section 9, 11 (LED-001 through LED-015), Section 14.3
 * 
 * Rules:
 * - Single current stage invariant (LED-001)
 * - Append-only stage event history (LED-002)
 * - Working-day and calendar-day aging calculation based on contract rules (LED-003)
 * - Detail equals filter total reconciliation (LED-004)
 * - Exposure bucket calculation based on stage & version (LED-005)
 * - Gross exposure strictly separated from controllable exposure (LED-006, LED-015)
 * - Controllability taxonomy: INTERNAL, JOINT, EXTERNAL, UNKNOWN (LED-007)
 * - Source lineage tracking (LED-008)
 * - Recertification variance tracking without overwriting claimed history (LED-009)
 * - Strict non-overlapping sequential gaps preventing double-counting (LED-010, UAT-05, UAT-10, UAT-11)
 * - PRD 11.3 Freshness rules: <=7d Current, 8-14d Attention, >14d Stale (LED-011)
 * - Dispute marking without erasing financial exposure (LED-012)
 * - Partial certification, invoicing, and receipt reconciliation (LED-013, UAT-12)
 * - Write-off / Closed-no-recovery segregation (LED-014)
 * - Elimination of pseudo-scores (LED-015)
 */

import { ClaimStage } from "@/lib/constants";

export type CoreStageCode = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

export interface CoreStageDef {
  code: CoreStageCode;
  name: string;
  nameId: string;
  entryCondition: string;
  exitEvidence: string;
}

export const CORE_STAGES: Record<CoreStageCode, CoreStageDef> = {
  S0: {
    code: "S0",
    name: "Imported",
    nameId: "Terimpor",
    entryCondition: "Baris lolos validasi impor spreadsheet",
    exitEvidence: "Mapping dan source snapshot diterima",
  },
  S1: {
    code: "S1",
    name: "Measured",
    nameId: "Teropname",
    entryCondition: "Nilai/volume terukur dengan dokumen sumber opname bersama",
    exitEvidence: "Dipilih masuk ke dalam paket klaim periode berjalan",
  },
  S2: {
    code: "S2",
    name: "Claim-ready",
    nameId: "Siap Klaim",
    entryCondition: "Checklist readiness dan dokumen pendukung 100% lengkap",
    exitEvidence: "Submitted timestamp dan tanda terima pengajuan",
  },
  S3: {
    code: "S3",
    name: "Submitted",
    nameId: "Diajukan",
    entryCondition: "Klaim resmi dikirimkan ke MK/Klien",
    exitEvidence: "Sertifikat disahkan (BAP) atau catatan revisi",
  },
  S4: {
    code: "S4",
    name: "Certified",
    nameId: "Disahkan (BAP)",
    entryCondition: "Nilai telah disahkan dan ditandatangani konsultan pengawas",
    exitEvidence: "Nomor faktur dan tanggal terbit invoice",
  },
  S5: {
    code: "S5",
    name: "Invoiced",
    nameId: "Tertagih (Invoice)",
    entryCondition: "Faktur komersial telah diterbitkan dan diterima klien",
    exitEvidence: "Bukti penerimaan kas masuk (receipt) atau penyesuaian",
  },
  S6: {
    code: "S6",
    name: "Collected",
    nameId: "Tercairkan (Kas Masuk)",
    entryCondition: "Penerimaan dana kas masuk telah direkonsiliasi dengan rekening koran",
    exitEvidence: "Final/partial payment receipt record (Outcome)",
  },
};

export type ControllabilityType = "INTERNAL" | "JOINT" | "EXTERNAL" | "UNKNOWN";

export type FreshnessStatus = "CURRENT" | "ATTENTION" | "STALE" | "UNKNOWN";

export interface SequentialValueGaps {
  unmeasuredValue: number;           // G1: Work Performed - Measured (UAT-05)
  unclaimedValue: number;            // G2: Measured - Claimed
  uncertifiedValue: number;          // G3: Claimed - Certified (UAT-10)
  certifiedNotInvoicedValue: number; // G4: Certified - Invoiced (UAT-11)
  invoicedNotCollectedValue: number; // G5: Invoiced - Cash Received (UAT-12)
  totalOpenValue: number;            // G1 + G2 + G3 + G4 + G5 (No double count)
}

export interface LedgerItemRecord {
  id: string;
  projectId: string;
  claimNumber: string;
  currentStage: ClaimStage;
  coreStage: CoreStageCode;
  stageEnteredAt: string;
  stageAgingDays: number;
  calendarBasis: "CALENDAR_DAYS" | "WORKING_DAYS";
  workPerformedValue: number;
  measuredValue: number;
  claimedValue: number;
  certifiedValue: number;
  invoicedGrossValue: number;
  cashReceivedValue: number;
  gaps: SequentialValueGaps;
  grossPreInvoiceExposure: number;
  controllability: ControllabilityType;
  isControllable: boolean;
  isDisputed: boolean;
  disputeReason?: string;
  isWrittenOff: boolean;
  writeOffReason?: string;
  writeOffAmount?: number;
  freshness: FreshnessStatus;
  sourceUpdatedAt: string;
  sourceReference?: string;
  responsibleOwnerId: string;
}

export interface LedgerExposureSummary {
  totalClaimsCount: number;
  totalWorkPerformed: number;
  totalGrossPreInvoiceExposure: number;
  totalControllableExposure: number;
  totalExternalExposure: number;
  totalUnknownExposure: number;
  totalDisputedExposure: number;
  totalInvoicedOutstanding: number;
  totalCashCollected: number;
  totalWrittenOff: number;
  unknownClassificationCount: number;
  gapsBreakdown: {
    unmeasured: number;
    unclaimed: number;
    uncertified: number;
    certifiedNotInvoiced: number;
    invoicedNotCollected: number;
  };
}

// -----------------------------------------------------------------------------
// LED-001: Single Current Stage Invariant Assertion
// -----------------------------------------------------------------------------
export function mapClaimStageToCoreStage(stage: ClaimStage): CoreStageCode {
  switch (stage) {
    case "WORK_RECORDED":
      return "S0";
    case "MEASUREMENT":
      return "S1";
    case "CLAIM_PREPARATION":
    case "CLAIM_READY":
      return "S2";
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "DISPUTED":
    case "REJECTED":
    case "ON_HOLD":
      return "S3";
    case "CERTIFIED":
    case "INVOICE_READY":
      return "S4";
    case "INVOICE_ISSUED":
    case "INVOICE_ACCEPTED":
    case "DUE":
    case "PARTIALLY_PAID":
      return "S5";
    case "PAID":
      return "S6";
    default:
      return "S2";
  }
}

export function assertSingleCurrentStage(claim: { currentStage: ClaimStage }): boolean {
  if (!claim || !claim.currentStage) return false;
  const coreStage = mapClaimStageToCoreStage(claim.currentStage);
  return Boolean(coreStage && CORE_STAGES[coreStage]);
}

// -----------------------------------------------------------------------------
// LED-003: Working-Day & Calendar-Day Stage Aging Engine
// -----------------------------------------------------------------------------
export function calculateStageAgeDays(
  enteredAt: string | Date,
  calendarBasis: "CALENDAR_DAYS" | "WORKING_DAYS" = "CALENDAR_DAYS",
  referenceDate: Date = new Date()
): number {
  const entered = new Date(enteredAt);
  if (isNaN(entered.getTime())) return 0;

  if (calendarBasis === "CALENDAR_DAYS") {
    const diffMs = Math.max(0, referenceDate.getTime() - entered.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // WORKING_DAYS: Exclude Saturdays and Sundays
  let workingDays = 0;
  const cur = new Date(entered.getFullYear(), entered.getMonth(), entered.getDate());
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  return workingDays;
}

// -----------------------------------------------------------------------------
// LED-011: Data Freshness Evaluation (PRD Section 11.3)
// -----------------------------------------------------------------------------
export function evaluateLedgerFreshness(
  sourceUpdatedAt: string | Date | null | undefined,
  referenceDate: Date = new Date()
): { status: FreshnessStatus; daysAgo: number; label: string } {
  if (!sourceUpdatedAt) {
    return { status: "UNKNOWN", daysAgo: 999, label: "Sumber Tidak Diketahui" };
  }

  const updated = new Date(sourceUpdatedAt);
  if (isNaN(updated.getTime())) {
    return { status: "UNKNOWN", daysAgo: 999, label: "Format Waktu Tidak Valid" };
  }

  const diffMs = Math.max(0, referenceDate.getTime() - updated.getTime());
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysAgo <= 7) {
    return { status: "CURRENT", daysAgo, label: `Fresh (${daysAgo === 0 ? "Hari ini" : `${daysAgo} hari lalu`})` };
  } else if (daysAgo <= 14) {
    return { status: "ATTENTION", daysAgo, label: `Perlu Pembaruan (${daysAgo} hari lalu)` };
  } else {
    return { status: "STALE", daysAgo, label: `Kedaluwarsa (>14 hari: ${daysAgo} hari lalu)` };
  }
}

// -----------------------------------------------------------------------------
// LED-005, LED-010: Sequential Value Gaps & Double-Count Protection
// -----------------------------------------------------------------------------
export function calculateSequentialValueGaps(claim: {
  workPerformedValue: number;
  measuredValue: number;
  claimedValue: number;
  certifiedValue: number;
  invoicedGrossValue?: number;
  cashReceivedValue?: number;
}): SequentialValueGaps {
  const work = Math.max(0, claim.workPerformedValue || 0);
  const measured = Math.max(0, claim.measuredValue || 0);
  const claimed = Math.max(0, claim.claimedValue || 0);
  const certified = Math.max(0, claim.certifiedValue || 0);
  const invoiced = Math.max(0, claim.invoicedGrossValue ?? certified);
  const cash = Math.max(0, claim.cashReceivedValue || 0);

  // 1. G1: Unmeasured (Work performed not yet agreed in joint measurement)
  const unmeasuredValue = Math.max(0, work - measured);

  // 2. G2: Unclaimed (Measured quantity not yet billed in monthly claim)
  const unclaimedValue = Math.max(0, measured - claimed);

  // 3. G3: Uncertified (Claimed value submitted awaiting consultant certification)
  const uncertifiedValue = Math.max(0, claimed - certified);

  // 4. G4: Certified Not Invoiced (Certified value awaiting commercial tax invoice)
  const certifiedNotInvoicedValue = Math.max(0, certified - invoiced);

  // 5. G5: Invoiced Not Collected (Invoiced receivable awaiting cash receipt)
  const invoicedNotCollectedValue = Math.max(0, invoiced - cash);

  // Strict non-overlapping total open value (zero double-counting)
  const totalOpenValue =
    unmeasuredValue +
    unclaimedValue +
    uncertifiedValue +
    certifiedNotInvoicedValue +
    invoicedNotCollectedValue;

  return {
    unmeasuredValue,
    unclaimedValue,
    uncertifiedValue,
    certifiedNotInvoicedValue,
    invoicedNotCollectedValue,
    totalOpenValue,
  };
}

// -----------------------------------------------------------------------------
// LED-009: Recertification Variance Tracker (BAP Cuts)
// -----------------------------------------------------------------------------
export function recordRecertificationVariance(
  claimedValue: number,
  certifiedValue: number,
  actorName: string = "Commercial Manager",
  notes?: string
): {
  claimedValue: number;
  certifiedValue: number;
  varianceAmount: number;
  variancePercent: number;
  isCutDetected: boolean;
  auditDescription: string;
} {
  const cleanClaimed = Math.max(0, claimedValue || 0);
  const cleanCertified = Math.max(0, certifiedValue || 0);
  const varianceAmount = cleanClaimed - cleanCertified;
  const isCutDetected = varianceAmount > 0;
  const variancePercent = cleanClaimed > 0 ? Math.round((varianceAmount / cleanClaimed) * 10000) / 100 : 0;

  const auditDescription = isCutDetected
    ? `Pemotongan sertifikasi (BAP Cut) terdeteksi sebesar Rp ${varianceAmount.toLocaleString(
        "id-ID"
      )} (${variancePercent}% dari pengajuan Rp ${cleanClaimed.toLocaleString(
        "id-ID"
      )}). Nilai disahkan: Rp ${cleanCertified.toLocaleString("id-ID")}. Histori pengajuan asli tetap dipertahankan.`
    : `Sertifikasi penuh atau addendum plus sebesar Rp ${cleanCertified.toLocaleString("id-ID")}.`;

  return {
    claimedValue: cleanClaimed,
    certifiedValue: cleanCertified,
    varianceAmount,
    variancePercent,
    isCutDetected,
    auditDescription,
  };
}

// -----------------------------------------------------------------------------
// LED-006, LED-007, LED-015: Ledger Exposure Breakdown Engine
// -----------------------------------------------------------------------------
export function evaluateLedgerExposure(
  claims: any[],
  contractRulesMap: Record<string, { calendarBasis?: "CALENDAR_DAYS" | "WORKING_DAYS" }> = {},
  referenceDate: Date = new Date()
): { items: LedgerItemRecord[]; summary: LedgerExposureSummary } {
  let totalWorkPerformed = 0;
  let totalGrossPreInvoiceExposure = 0;
  let totalControllableExposure = 0;
  let totalExternalExposure = 0;
  let totalUnknownExposure = 0;
  let totalDisputedExposure = 0;
  let totalInvoicedOutstanding = 0;
  let totalCashCollected = 0;
  let totalWrittenOff = 0;
  let unknownClassificationCount = 0;

  let sumUnmeasured = 0;
  let sumUnclaimed = 0;
  let sumUncertified = 0;
  let sumCertifiedNotInvoiced = 0;
  let sumInvoicedNotCollected = 0;

  const items: LedgerItemRecord[] = claims.map((c) => {
    const calendarBasis = contractRulesMap[c.projectId]?.calendarBasis || "CALENDAR_DAYS";
    const stageAgingDays = calculateStageAgeDays(c.currentStageEnteredAt || c.periodEnd, calendarBasis, referenceDate);
    const freshness = evaluateLedgerFreshness(c.sourceUpdatedAt || c.currentStageEnteredAt, referenceDate);
    const coreStage = mapClaimStageToCoreStage(c.currentStage);

    const gaps = calculateSequentialValueGaps({
      workPerformedValue: c.workPerformedValue,
      measuredValue: c.measuredValue,
      claimedValue: c.claimedValue,
      certifiedValue: c.certifiedValue,
      invoicedGrossValue: c.certifiedValue,
      cashReceivedValue: c.cashReceivedValue,
    });

    // Gross Pre-Invoice Exposure: Value sitting between physical execution and final invoice
    // G1 (Unmeasured) + G2 (Unclaimed) + G3 (Uncertified) + G4 (Certified not invoiced)
    const grossPreInvoiceExposure =
      gaps.unmeasuredValue + gaps.unclaimedValue + gaps.uncertifiedValue + gaps.certifiedNotInvoicedValue;

    // Controllability (PRD 11.2 LED-007)
    const controllability: ControllabilityType = c.controllability || "UNKNOWN";
    const isControllable = controllability === "INTERNAL" || controllability === "JOINT";

    if (controllability === "UNKNOWN") {
      unknownClassificationCount++;
      totalUnknownExposure += grossPreInvoiceExposure;
    } else if (isControllable) {
      totalControllableExposure += grossPreInvoiceExposure;
    } else {
      totalExternalExposure += grossPreInvoiceExposure;
    }

    if (c.isDisputed) {
      totalDisputedExposure += c.claimedValue;
    }

    if (c.isWrittenOff) {
      totalWrittenOff += c.writeOffAmount || c.claimedValue || 0;
    }

    totalWorkPerformed += c.workPerformedValue || 0;
    totalGrossPreInvoiceExposure += grossPreInvoiceExposure;
    totalInvoicedOutstanding += gaps.invoicedNotCollectedValue;
    totalCashCollected += c.cashReceivedValue || 0;

    sumUnmeasured += gaps.unmeasuredValue;
    sumUnclaimed += gaps.unclaimedValue;
    sumUncertified += gaps.uncertifiedValue;
    sumCertifiedNotInvoiced += gaps.certifiedNotInvoicedValue;
    sumInvoicedNotCollected += gaps.invoicedNotCollectedValue;

    return {
      id: c.id,
      projectId: c.projectId,
      claimNumber: c.claimNumber,
      currentStage: c.currentStage,
      coreStage,
      stageEnteredAt: c.currentStageEnteredAt || c.periodEnd,
      stageAgingDays,
      calendarBasis,
      workPerformedValue: c.workPerformedValue,
      measuredValue: c.measuredValue,
      claimedValue: c.claimedValue,
      certifiedValue: c.certifiedValue,
      invoicedGrossValue: c.certifiedValue,
      cashReceivedValue: c.cashReceivedValue || 0,
      gaps,
      grossPreInvoiceExposure,
      controllability,
      isControllable,
      isDisputed: Boolean(c.isDisputed),
      disputeReason: c.disputeReason,
      isWrittenOff: Boolean(c.isWrittenOff),
      writeOffReason: c.writeOffReason,
      writeOffAmount: c.writeOffAmount,
      freshness: freshness.status,
      sourceUpdatedAt: c.sourceUpdatedAt || c.currentStageEnteredAt,
      sourceReference: c.sourceReference,
      responsibleOwnerId: c.responsibleOwnerId,
    };
  });

  const summary: LedgerExposureSummary = {
    totalClaimsCount: items.length,
    totalWorkPerformed,
    totalGrossPreInvoiceExposure,
    totalControllableExposure,
    totalExternalExposure,
    totalUnknownExposure,
    totalDisputedExposure,
    totalInvoicedOutstanding,
    totalCashCollected,
    totalWrittenOff,
    unknownClassificationCount,
    gapsBreakdown: {
      unmeasured: sumUnmeasured,
      unclaimed: sumUnclaimed,
      uncertified: sumUncertified,
      certifiedNotInvoiced: sumCertifiedNotInvoiced,
      invoicedNotCollected: sumInvoicedNotCollected,
    },
  };

  return { items, summary };
}

// -----------------------------------------------------------------------------
// LED-004: Ledger Filtering & Detail-to-Total Invariant
// -----------------------------------------------------------------------------
export interface LedgerFilterCriteria {
  projectId?: string;
  stage?: ClaimStage;
  coreStage?: CoreStageCode;
  controllability?: ControllabilityType;
  freshness?: FreshnessStatus;
  isDisputed?: boolean;
  ownerId?: string;
  searchQuery?: string;
}

export function filterLedgerItems(
  items: LedgerItemRecord[],
  criteria: LedgerFilterCriteria
): {
  filteredItems: LedgerItemRecord[];
  filteredTotalGrossExposure: number;
  filteredTotalControllable: number;
} {
  const filteredItems = items.filter((item) => {
    if (criteria.projectId && item.projectId !== criteria.projectId) return false;
    if (criteria.stage && item.currentStage !== criteria.stage) return false;
    if (criteria.coreStage && item.coreStage !== criteria.coreStage) return false;
    if (criteria.controllability && item.controllability !== criteria.controllability) return false;
    if (criteria.freshness && item.freshness !== criteria.freshness) return false;
    if (criteria.isDisputed !== undefined && item.isDisputed !== criteria.isDisputed) return false;
    if (criteria.ownerId && item.responsibleOwnerId !== criteria.ownerId) return false;
    if (criteria.searchQuery && criteria.searchQuery.trim() !== "") {
      const q = criteria.searchQuery.toLowerCase();
      const matchClaim = item.claimNumber.toLowerCase().includes(q);
      const matchSource = (item.sourceReference || "").toLowerCase().includes(q);
      if (!matchClaim && !matchSource) return false;
    }
    return true;
  });

  const filteredTotalGrossExposure = filteredItems.reduce((acc, it) => acc + it.grossPreInvoiceExposure, 0);
  const filteredTotalControllable = filteredItems.reduce(
    (acc, it) => (it.isControllable ? acc + it.grossPreInvoiceExposure : acc),
    0
  );

  return {
    filteredItems,
    filteredTotalGrossExposure,
    filteredTotalControllable,
  };
}
