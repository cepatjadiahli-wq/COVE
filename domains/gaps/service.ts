/**
 * COVE Value Gap Engine
 * Implements pure financial gap formulas according to Blueprint §23 & PRD §18
 * 
 * Rules:
 * - Return all components separately.
 * - Never collapse into an opaque single number.
 * - Negative gaps are clamped to 0.
 */

export interface ClaimGapsInput {
  workPerformedValue: number;
  measuredValue: number;
  claimedValue: number;
  certifiedValue: number;
  allocatedInvoiceGross?: number;
  invoiceOutstandingTotal?: number;
}

export interface ClaimGapsResult {
  unmeasuredValue: number;
  unclaimedValue: number;
  uncertifiedValue: number;
  certifiedNotInvoicedValue: number;
  invoicedNotCollectedValue: number;
  totalOpenValue: number;
}

/**
 * Calculates economic gaps across all stages of a progress claim
 */
export function calculateClaimGaps(input: ClaimGapsInput): ClaimGapsResult {
  const workPerformed = Math.max(0, input.workPerformedValue || 0);
  const measured = Math.max(0, input.measuredValue || 0);
  const claimed = Math.max(0, input.claimedValue || 0);
  const certified = Math.max(0, input.certifiedValue || 0);
  const allocatedInvoiceGross = Math.max(0, input.allocatedInvoiceGross ?? certified);
  const invoiceOutstanding = Math.max(0, input.invoiceOutstandingTotal || 0);

  // 1. Unmeasured: Work performed but not yet measured in formal opname
  const unmeasuredValue = Math.max(0, workPerformed - measured);

  // 2. Unclaimed: Measured opname value but not yet claimed in official progress claim
  const unclaimedValue = Math.max(0, measured - claimed);

  // 3. Uncertified: Claimed value submitted but not yet certified by Consultant/Owner
  const uncertifiedValue = Math.max(0, claimed - certified);

  // 4. Certified Not Invoiced: Value certified in BAP/MC but invoice not yet issued
  const certifiedNotInvoicedValue = Math.max(0, certified - allocatedInvoiceGross);

  // 5. Invoiced Not Collected: Outstanding invoice receivables
  const invoicedNotCollectedValue = invoiceOutstanding;

  // Total Open Economic Value (Work performed not yet collected as cash)
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
