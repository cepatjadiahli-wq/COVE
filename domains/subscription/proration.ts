/**
 * COVE Phase 16: Proration Calculation Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 12.1)
 */

export interface ProrationCalculationParams {
  currentPrice: number;
  targetPrice: number;
  currentPeriodStart: string | Date;
  currentPeriodEnd: string | Date;
  now?: Date;
}

export interface ProrationCalculationResult {
  totalDays: number;
  remainingDays: number;
  currentDailyRate: number;
  targetDailyRate: number;
  unusedCredit: number;
  proratedCost: number;
  netPayable: number;
  isUpgrade: boolean;
  effectiveDate: string;
}

/**
 * Calculates transparent proration when changing plans in the middle of a billing period.
 */
export function calculateProration(params: ProrationCalculationParams): ProrationCalculationResult {
  const now = params.now || new Date();
  const start = new Date(params.currentPeriodStart);
  const end = new Date(params.currentPeriodEnd);

  // Calculate total days in current cycle (minimum 1 day)
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate remaining days (clamped between 0 and totalDays)
  const rawRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.min(totalDays, Math.max(0, rawRemaining));

  const currentDailyRate = params.currentPrice / totalDays;
  const targetDailyRate = params.targetPrice / totalDays;

  // Unused portion of current plan credited to tenant
  const unusedCredit = Math.round(currentDailyRate * remainingDays);

  // Prorated portion of target plan for remaining duration
  const proratedCost = Math.round(targetDailyRate * remainingDays);

  const isUpgrade = params.targetPrice > params.currentPrice;
  const netPayable = isUpgrade ? Math.max(0, proratedCost - unusedCredit) : 0;

  return {
    totalDays,
    remainingDays,
    currentDailyRate: Math.round(currentDailyRate),
    targetDailyRate: Math.round(targetDailyRate),
    unusedCredit,
    proratedCost,
    netPayable,
    isUpgrade,
    effectiveDate: now.toISOString(),
  };
}
