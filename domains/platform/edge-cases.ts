/**
 * Phase 11 Domain Engine: Edge Cases, Exception Handling, and Safety Guardrails
 * PRD Reference: Section 21 (NFR), Section 24 (UAT & Negative Acceptance), Section 25 (Edge Cases)
 */

export interface DownstreamExceptionResult {
  hasException: boolean;
  type: "DOWNSTREAM_EXCEEDS_UPSTREAM" | "NORMAL";
  stageUpstream: string;
  stageDownstream: string;
  upstreamValue: number;
  downstreamValue: number;
  varianceAmount: number;
  message: string;
}

export interface ClaimCancellationResult {
  claimId: string;
  previousStage: string;
  isCancelled: boolean;
  cancellationReason: string;
  cancelledAt: string;
  cancelledBy: string;
  historyPreserved: boolean;
}

export interface StageSkipResult {
  claimId: string;
  fromStage: string;
  toStage: string;
  skippedStages: string[];
  isAllowed: boolean;
  sourceEventReference: string;
  approvalReason: string;
  error?: string;
}

export interface ContractAddendumResult {
  projectId: string;
  originalContractValue: number;
  addendumNumber: string;
  addendumValue: number;
  newTotalContractValue: number;
  approvalStatus: "APPROVED" | "PENDING_VO";
  isVersionPreserved: boolean;
}

export interface BrokenEvidenceResult {
  evidenceKey: string;
  originalUrl: string;
  status: "UNAVAILABLE";
  flaggedAt: string;
  actionCreated: boolean;
  actionTitle: string;
  assignedOwnerId: string;
  referenceRetained: boolean;
}

export interface ConcurrencyCheckResult {
  entityId: string;
  currentVersion: number;
  providedVersion: number;
  hasConflict: boolean;
  message?: string;
}

export interface NetworkRetryResult<T> {
  idempotencyKey: string;
  isReplay: boolean;
  data: T;
  executedAt: string;
}

const IDEMPOTENCY_CACHE = new Map<string, any>();

/**
 * PRD Section 25: Downstream > Upstream Reconciliation Exception
 * Behavior: Flagged as an explicit reconciliation exception; NEVER clamped silently.
 */
export function evaluateDownstreamUpstreamIntegrity(
  stageUpstream: string,
  upstreamValue: number,
  stageDownstream: string,
  downstreamValue: number
): DownstreamExceptionResult {
  if (downstreamValue > upstreamValue) {
    const variance = downstreamValue - upstreamValue;
    return {
      hasException: true,
      type: "DOWNSTREAM_EXCEEDS_UPSTREAM",
      stageUpstream,
      stageDownstream,
      upstreamValue,
      downstreamValue,
      varianceAmount: variance,
      message: `Peringatan Rekonsiliasi: Nilai ${stageDownstream} (Rp ${downstreamValue.toLocaleString("id-ID")}) melebihi nilai ${stageUpstream} (Rp ${upstreamValue.toLocaleString("id-ID")}) sebesar Rp ${variance.toLocaleString("id-ID")}. Sistem mencatat exception tanpa melakukan clamping diam-diam (PRD Section 25).`,
    };
  }

  return {
    hasException: false,
    type: "NORMAL",
    stageUpstream,
    stageDownstream,
    upstreamValue,
    downstreamValue,
    varianceAmount: 0,
    message: "Integritas urutan nilai downstream dan upstream valid.",
  };
}

/**
 * PRD Section 25: Claim Cancelled
 * Behavior: Requires closed/cancelled reason; all historical stage logs preserved.
 */
export function handleClaimCancellation(params: {
  claimId: string;
  currentStage: string;
  cancellationReason: string;
  cancelledBy: string;
}): ClaimCancellationResult {
  if (!params.cancellationReason || params.cancellationReason.trim().length < 10) {
    throw new Error(
      "Pembatalan klaim memerlukan alasan bisnis tertulis yang jelas minimal 10 karakter (PRD Section 25)."
    );
  }

  return {
    claimId: params.claimId,
    previousStage: params.currentStage,
    isCancelled: true,
    cancellationReason: params.cancellationReason.trim(),
    cancelledAt: new Date().toISOString(),
    cancelledBy: params.cancelledBy,
    historyPreserved: true,
  };
}

/**
 * PRD Section 25: Stage Skipped
 * Behavior: Allowed ONLY with explicit source event reference and approved business reason.
 */
export function handleStageSkip(params: {
  claimId: string;
  fromStage: string;
  toStage: string;
  sourceEventReference?: string;
  approvalReason?: string;
}): StageSkipResult {
  const STAGE_ORDER = [
    "WORK_PERFORMED",
    "MEASURED",
    "SUBMITTED",
    "UNDER_REVIEW",
    "CERTIFIED",
    "INVOICED",
    "PAID",
  ];

  const fromIdx = STAGE_ORDER.indexOf(params.fromStage);
  const toIdx = STAGE_ORDER.indexOf(params.toStage);

  if (fromIdx === -1 || toIdx === -1) {
    return {
      claimId: params.claimId,
      fromStage: params.fromStage,
      toStage: params.toStage,
      skippedStages: [],
      isAllowed: false,
      sourceEventReference: "",
      approvalReason: "",
      error: "Tahap asal atau tahap tujuan tidak dikenali dalam urutan alur klaim.",
    };
  }

  const skipped = STAGE_ORDER.slice(fromIdx + 1, toIdx);

  // If jumping forward skipping 1 or more stages
  if (skipped.length > 0) {
    if (!params.sourceEventReference || params.sourceEventReference.trim().length < 3) {
      return {
        claimId: params.claimId,
        fromStage: params.fromStage,
        toStage: params.toStage,
        skippedStages: skipped,
        isAllowed: false,
        sourceEventReference: "",
        approvalReason: "",
        error: "Melewati tahap alur (Stage Skip) memerlukan rujukan berkas/event sumber resmi (PRD Section 25).",
      };
    }

    if (!params.approvalReason || params.approvalReason.trim().length < 5) {
      return {
        claimId: params.claimId,
        fromStage: params.fromStage,
        toStage: params.toStage,
        skippedStages: skipped,
        isAllowed: false,
        sourceEventReference: params.sourceEventReference,
        approvalReason: "",
        error: "Melewati tahap alur (Stage Skip) memerlukan alasan persetujuan tertulis (PRD Section 25).",
      };
    }
  }

  return {
    claimId: params.claimId,
    fromStage: params.fromStage,
    toStage: params.toStage,
    skippedStages: skipped,
    isAllowed: true,
    sourceEventReference: params.sourceEventReference || "NORMAL_PROGRESSION",
    approvalReason: params.approvalReason || "Tahap berurutan normal",
  };
}

/**
 * PRD Section 25: Contract / BOQ Addendum Revision & Unapproved VO Isolation
 * Behavior: Creates a versioned addendum; unapproved VOs are segregated from guaranteed claim value.
 */
export function handleContractAddendumRevision(params: {
  projectId: string;
  originalContractValue: number;
  addendumNumber: string;
  addendumValue: number;
  isApproved: boolean;
}): ContractAddendumResult {
  const isApproved = params.isApproved;
  const newTotal = isApproved
    ? params.originalContractValue + params.addendumValue
    : params.originalContractValue;

  return {
    projectId: params.projectId,
    originalContractValue: params.originalContractValue,
    addendumNumber: params.addendumNumber,
    addendumValue: params.addendumValue,
    newTotalContractValue: newTotal,
    approvalStatus: isApproved ? "APPROVED" : "PENDING_VO",
    isVersionPreserved: true,
  };
}

/**
 * PRD Section 25: Broken Evidence Link
 * Behavior: Marks link as UNAVAILABLE, generates corrective action for owner, retains DB reference.
 */
export function handleBrokenEvidenceLink(params: {
  evidenceKey: string;
  originalUrl: string;
  ownerId: string;
  claimNumber: string;
}): BrokenEvidenceResult {
  return {
    evidenceKey: params.evidenceKey,
    originalUrl: params.originalUrl,
    status: "UNAVAILABLE",
    flaggedAt: new Date().toISOString(),
    actionCreated: true,
    actionTitle: `Perbaiki Tautan Dokumen Kesiapan ${params.evidenceKey} pada Klaim ${params.claimNumber}`,
    assignedOwnerId: params.ownerId,
    referenceRetained: true,
  };
}

/**
 * PRD Section 25: Concurrent Updates (Optimistic Concurrency)
 * Behavior: Detects version conflict; prevents silent overwrite.
 */
export function checkOptimisticConcurrency(
  entityId: string,
  currentVersion: number,
  providedVersion: number
): ConcurrencyCheckResult {
  if (providedVersion !== currentVersion) {
    return {
      entityId,
      currentVersion,
      providedVersion,
      hasConflict: true,
      message: `Konflik Pembaharuan Serentak: Data telah diubah oleh pengguna lain (Versi database ${currentVersion} vs Versi Anda ${providedVersion}). Sistem menolak penimpaan diam-diam (PRD Section 25). Muat ulang data terbaru sebelum menyimpan.`,
    };
  }

  return {
    entityId,
    currentVersion,
    providedVersion,
    hasConflict: false,
  };
}

/**
 * PRD Section 25: Network Interruption & Safe Retry with Idempotency
 * Behavior: Guarantees no duplicate execution upon network retry.
 */
export function executeWithIdempotency<T>(
  idempotencyKey: string,
  operation: () => T
): NetworkRetryResult<T> {
  if (IDEMPOTENCY_CACHE.has(idempotencyKey)) {
    return {
      idempotencyKey,
      isReplay: true,
      data: IDEMPOTENCY_CACHE.get(idempotencyKey),
      executedAt: new Date().toISOString(),
    };
  }

  const result = operation();
  IDEMPOTENCY_CACHE.set(idempotencyKey, result);

  return {
    idempotencyKey,
    isReplay: false,
    data: result,
    executedAt: new Date().toISOString(),
  };
}
