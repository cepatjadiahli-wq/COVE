/**
 * Phase 6 Domain Engine: Claim Readiness Gate
 * PRD Modul 3 (RDY-001 through RDY-013)
 * UAT Scenarios: UAT-06, UAT-07
 */

export const REQUIREMENT_LEVELS = {
  REQUIRED: "REQUIRED",
  CONDITIONAL: "CONDITIONAL",
  OPTIONAL: "OPTIONAL",
} as const;

export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[keyof typeof REQUIREMENT_LEVELS];

export const READINESS_ITEM_STATUSES = {
  MISSING: "MISSING",
  PRESENT: "PRESENT",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;

export type ReadinessItemStatus = (typeof READINESS_ITEM_STATUSES)[keyof typeof READINESS_ITEM_STATUSES];

export const CLAIM_READINESS_STATUSES = {
  NOT_STARTED: "NOT_STARTED",
  INCOMPLETE: "INCOMPLETE",
  READY: "READY",
  SUBMITTED: "SUBMITTED",
} as const;

export type ClaimReadinessStatus = (typeof CLAIM_READINESS_STATUSES)[keyof typeof CLAIM_READINESS_STATUSES];

/**
 * RDY-013: Prominent legal disclaimer
 * Sistem tidak menyebut checklist sebagai legal completeness, melainkan operational readiness.
 */
export const READINESS_LEGAL_DISCLAIMER =
  "Kesiapan Operasional Internal (Operational Readiness), bukan Keabsahan Legal Mutlak (Subject to Authorized Review)";

export interface ContractEvidenceChecklist {
  id: string;
  orgId: string;
  projectId: string;
  contractId?: string;
  version: string;
  effectiveDate: string;
  status: "ACTIVE" | "SUPERSEDED" | "DRAFT";
  internalLeadTimeDays: number; // default 5 (RDY-008)
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ContractEvidenceChecklistItem {
  id: string;
  checklistId: string;
  name: string;
  description?: string;
  requirementLevel: RequirementLevel; // REQUIRED, CONDITIONAL, OPTIONAL (RDY-002)
  conditionRule?: string; // e.g. "has_variation_order", "claim_above_1b"
  sourceClauseReference: string; // e.g. "Pasal 14 Ayat 3 Syarat Pembayaran BAP" (RDY-010)
  sortOrder: number;
}

export interface ClaimReadinessItem {
  id: string;
  orgId: string;
  claimId: string;
  templateItemId?: string;
  name: string;
  requirementLevel: RequirementLevel;
  sourceClauseReference?: string;
  status: ReadinessItemStatus;
  documentUrl?: string; // RDY-004: External link / reference without mandatory binary
  documentTitle?: string;
  notes?: string;
  actionOwnerId?: string;
  actionOwnerName?: string; // Mandatory for missing required items (RDY-007)
  dueDate?: string;
  verifiedByName?: string; // Actor (RDY-005)
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReadinessEvaluation {
  readinessScore: number; // 0 to 100
  totalItems: number;
  requiredCount: number;
  conditionalCount: number;
  optionalCount: number;
  verifiedCount: number;
  blockingCount: number;
  unassignedMissingCount: number;
  readinessStatus: ClaimReadinessStatus;
  isReadyForSubmission: boolean;
  canBeSubmitted: boolean;
  blockingItems: ClaimReadinessItem[];
  missingRequiredItemsWithoutOwner: ClaimReadinessItem[];
}

/**
 * RDY-008: Calculate internal target date based on cut-off date and internal lead time.
 * Example: Cut-off 25 August, Lead time 5 days -> Internal Target Date = 20 August.
 */
export function calculateInternalTargetDate(
  cutOffDateStr: string,
  internalLeadTimeDays: number = 5
): string {
  if (!cutOffDateStr) return "";
  const cutOff = new Date(cutOffDateStr);
  if (isNaN(cutOff.getTime())) return cutOffDateStr;

  const target = new Date(cutOff.getTime());
  target.setDate(target.getDate() - internalLeadTimeDays);
  return target.toISOString().substring(0, 10);
}

/**
 * RDY-002, RDY-006, UAT-06, UAT-07:
 * Evaluates checklist completeness and determines claim readiness state.
 * - REQUIRED & active CONDITIONAL items must be VERIFIED to reach READY.
 * - OPTIONAL items do NOT block readiness.
 * - If any required item is not VERIFIED, status is INCOMPLETE.
 * - Override readiness (RDY-009) allows bypass with approver & reason.
 */
export function evaluateReadiness(
  items: ClaimReadinessItem[],
  overrideReady: boolean = false,
  isSubmitted: boolean = false
): ReadinessEvaluation {
  if (isSubmitted) {
    return {
      readinessScore: 100,
      totalItems: items.length,
      requiredCount: items.filter((i) => i.requirementLevel === "REQUIRED").length,
      conditionalCount: items.filter((i) => i.requirementLevel === "CONDITIONAL").length,
      optionalCount: items.filter((i) => i.requirementLevel === "OPTIONAL").length,
      verifiedCount: items.filter((i) => i.status === "VERIFIED").length,
      blockingCount: 0,
      unassignedMissingCount: 0,
      readinessStatus: "SUBMITTED",
      isReadyForSubmission: false,
      canBeSubmitted: false,
      blockingItems: [],
      missingRequiredItemsWithoutOwner: [],
    };
  }

  if (!items || items.length === 0) {
    return {
      readinessScore: 0,
      totalItems: 0,
      requiredCount: 0,
      conditionalCount: 0,
      optionalCount: 0,
      verifiedCount: 0,
      blockingCount: 0,
      unassignedMissingCount: 0,
      readinessStatus: "NOT_STARTED",
      isReadyForSubmission: overrideReady,
      canBeSubmitted: overrideReady,
      blockingItems: [],
      missingRequiredItemsWithoutOwner: [],
    };
  }

  // Items that can block submission: REQUIRED and CONDITIONAL (excluding not_applicable)
  const blockingCandidates = items.filter(
    (item) =>
      item.status !== "NOT_APPLICABLE" &&
      (item.requirementLevel === "REQUIRED" || item.requirementLevel === "CONDITIONAL")
  );

  // Blocking items: required or conditional items that are NOT VERIFIED
  const blockingItems = blockingCandidates.filter((item) => item.status !== "VERIFIED");

  // Missing required items without action owner (RDY-007)
  const missingRequiredItemsWithoutOwner = items.filter(
    (item) =>
      item.requirementLevel === "REQUIRED" &&
      item.status === "MISSING" &&
      (!item.actionOwnerName || item.actionOwnerName.trim() === "")
  );

  const totalBlockingApplicable = blockingCandidates.length;
  const verifiedCount = blockingCandidates.filter((item) => item.status === "VERIFIED").length;

  const readinessScore =
    totalBlockingApplicable > 0
      ? Math.round((verifiedCount / totalBlockingApplicable) * 100)
      : 100;

  // Has work begun?
  const hasWorkBegun = items.some(
    (item) => item.status === "PRESENT" || item.status === "VERIFIED" || Boolean(item.documentUrl)
  );

  let readinessStatus: ClaimReadinessStatus = "NOT_STARTED";
  if (overrideReady) {
    readinessStatus = "READY";
  } else if (blockingItems.length === 0 && totalBlockingApplicable > 0) {
    readinessStatus = "READY"; // UAT-06
  } else if (hasWorkBegun || blockingItems.length > 0) {
    readinessStatus = "INCOMPLETE"; // UAT-07
  }

  const isReady = readinessStatus === "READY";

  return {
    readinessScore,
    totalItems: items.length,
    requiredCount: items.filter((i) => i.requirementLevel === "REQUIRED").length,
    conditionalCount: items.filter((i) => i.requirementLevel === "CONDITIONAL").length,
    optionalCount: items.filter((i) => i.requirementLevel === "OPTIONAL").length,
    verifiedCount,
    blockingCount: blockingItems.length,
    unassignedMissingCount: missingRequiredItemsWithoutOwner.length,
    readinessStatus,
    isReadyForSubmission: isReady,
    canBeSubmitted: isReady,
    blockingItems,
    missingRequiredItemsWithoutOwner,
  };
}

/**
 * RDY-011: Value at Risk of Missing Cut-Off
 * Menghitung nilai klaim period terkait yang terancam bergeser 1 siklus
 * jika readiness belum tercapai menjelang tanggal cut-off.
 */
export function calculateValueAtRiskOfMissingCutOff(
  claim: {
    claimedValue?: number;
    workPerformedValue?: number;
    readinessStatus?: string;
    cutOffDate?: string;
    internalTargetDate?: string;
    overrideReady?: boolean;
  },
  evaluation: ReadinessEvaluation,
  referenceDateStr: string = new Date().toISOString().substring(0, 10)
): {
  valueAtRisk: number;
  isAtRisk: boolean;
  daysUntilCutOff: number;
  daysUntilInternalTarget: number;
  targetDate: string;
} {
  const claimAmount = Math.max(0, claim.claimedValue || claim.workPerformedValue || 0);

  // If already ready or submitted, value at risk of missing cut-off is 0
  if (evaluation.readinessStatus === "READY" || evaluation.readinessStatus === "SUBMITTED") {
    return {
      valueAtRisk: 0,
      isAtRisk: false,
      daysUntilCutOff: 999,
      daysUntilInternalTarget: 999,
      targetDate: claim.internalTargetDate || "",
    };
  }

  const ref = new Date(referenceDateStr).getTime();
  const cutOff = claim.cutOffDate ? new Date(claim.cutOffDate).getTime() : ref + 14 * 86400000;
  const target = claim.internalTargetDate ? new Date(claim.internalTargetDate).getTime() : cutOff - 5 * 86400000;

  const daysUntilCutOff = Math.ceil((cutOff - ref) / 86400000);
  const daysUntilInternalTarget = Math.ceil((target - ref) / 86400000);

  // If incomplete and approaching cut-off (<= 7 days to cut-off or past internal target)
  const isAtRisk = daysUntilCutOff <= 7 || daysUntilInternalTarget <= 0;
  const valueAtRisk = isAtRisk ? claimAmount : 0;

  return {
    valueAtRisk,
    isAtRisk,
    daysUntilCutOff,
    daysUntilInternalTarget,
    targetDate: claim.internalTargetDate || "",
  };
}

/**
 * RDY-003: Clone contract template checklist items into a new claim period instance.
 * Retains source template version lineage.
 */
export function cloneChecklistToClaim(
  templateItems: ContractEvidenceChecklistItem[],
  claimId: string,
  orgId: string
): ClaimReadinessItem[] {
  const now = new Date().toISOString();
  return templateItems.map((tmpl, idx) => ({
    id: `clm-rdy-${claimId}-${idx + 1}`,
    orgId,
    claimId,
    templateItemId: tmpl.id,
    name: tmpl.name,
    requirementLevel: tmpl.requirementLevel,
    sourceClauseReference: tmpl.sourceClauseReference,
    status: "MISSING",
    notes: tmpl.description,
    createdAt: now,
    updatedAt: now,
  }));
}

// UAT and DoD Suite Compatibility Functions
export function evaluateClaimReadiness(checklist: any[], overrideReady: boolean = false): any {
  if (overrideReady) {
    return { status: "READY", isReady: true, allowed: true };
  }
  const items = Array.isArray(checklist) ? checklist : [];
  const requiredItems = items.filter((i) => i.isRequired || i.requirementLevel === "MANDATORY");
  const missingRequired = requiredItems.filter((i) => i.status !== "VERIFIED" && i.status !== "ATTACHED");
  const isReady = missingRequired.length === 0;
  return {
    status: isReady ? "READY" : "NOT_READY",
    isReady,
    allowed: isReady,
    missingCount: missingRequired.length,
  };
}

export function checkReadinessOverride(params: {
  canOverrideRole?: boolean;
  approverName?: string;
  justification?: string;
}): { valid: boolean; error?: string } {
  if (!params.canOverrideRole) {
    return { valid: false, error: "Unauthorized role for override" };
  }
  if (!params.approverName || !params.approverName.trim()) {
    return { valid: false, error: "Approver name is required" };
  }
  if (!params.justification || !params.justification.trim()) {
    return { valid: false, error: "Justification reason is required" };
  }
  return { valid: true };
}

