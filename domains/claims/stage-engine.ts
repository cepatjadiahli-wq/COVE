import { ClaimStage, CLAIM_STAGE_CONFIGS } from "@/lib/constants";

export interface StageHistoryItem {
  id: string;
  claimId: string;
  fromStage?: ClaimStage | null;
  toStage: ClaimStage;
  enteredAt: string;
  exitedAt?: string | null;
  durationHours?: number;
  changedBy?: string;
  changeReason?: string;
}

export interface TransitionStageRequest {
  claimId: string;
  currentStage: ClaimStage;
  targetStage: ClaimStage;
  changedByUserId: string;
  reason?: string;
  stageEnteredAt: string | Date;
}

export interface TransitionStageResult {
  success: boolean;
  newStage: ClaimStage;
  enteredAt: string;
  previousDurationHours: number;
  requiresReason: boolean;
  error?: string;
  historyEntry: StageHistoryItem;
}

/**
 * Validates and executes a claim stage transition with history tracking
 */
export function transitionClaimStage(req: TransitionStageRequest): TransitionStageResult {
  const currentConfig = CLAIM_STAGE_CONFIGS[req.currentStage];
  const targetConfig = CLAIM_STAGE_CONFIGS[req.targetStage];

  if (!targetConfig) {
    return {
      success: false,
      newStage: req.currentStage,
      enteredAt: new Date().toISOString(),
      previousDurationHours: 0,
      requiresReason: false,
      error: `Tahap target "${req.targetStage}" tidak valid.`,
      historyEntry: {} as any,
    };
  }

  // Check if transition is backward or exception
  const isBackward = targetConfig.order < currentConfig.order && !targetConfig.isException;
  const isException = targetConfig.isException || currentConfig.isException;

  const requiresReason = isBackward || isException;

  if (requiresReason && (!req.reason || req.reason.trim().length === 0)) {
    return {
      success: false,
      newStage: req.currentStage,
      enteredAt: new Date(req.stageEnteredAt).toISOString(),
      previousDurationHours: 0,
      requiresReason: true,
      error: `Perpindahan tahap dari ${currentConfig.label} ke ${targetConfig.label} memerlukan alasan/justifikasi eksplisit.`,
      historyEntry: {} as any,
    };
  }

  const now = new Date();
  const enteredAtDate = new Date(req.stageEnteredAt);
  const durationMs = Math.max(0, now.getTime() - enteredAtDate.getTime());
  const previousDurationHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));

  const historyEntry: StageHistoryItem = {
    id: "hist-" + Math.random().toString(36).substring(2, 9),
    claimId: req.claimId,
    fromStage: req.currentStage,
    toStage: req.targetStage,
    enteredAt: now.toISOString(),
    exitedAt: null,
    durationHours: previousDurationHours,
    changedBy: req.changedByUserId,
    changeReason: req.reason || `Transitioned to ${targetConfig.label}`,
  };

  return {
    success: true,
    newStage: req.targetStage,
    enteredAt: now.toISOString(),
    previousDurationHours,
    requiresReason,
    historyEntry,
  };
}
