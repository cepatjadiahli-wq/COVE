const assert = require("assert");

function calculateClaimGaps(input) {
  const workPerformed = Math.max(0, input.workPerformedValue || 0);
  const measured = Math.max(0, input.measuredValue || 0);
  const claimed = Math.max(0, input.claimedValue || 0);
  const certified = Math.max(0, input.certifiedValue || 0);
  const allocatedInvoiceGross = Math.max(0, input.allocatedInvoiceGross ?? certified);
  const invoiceOutstanding = Math.max(0, input.invoiceOutstandingTotal || 0);

  const unmeasuredValue = Math.max(0, workPerformed - measured);
  const unclaimedValue = Math.max(0, measured - claimed);
  const uncertifiedValue = Math.max(0, claimed - certified);
  const certifiedNotInvoicedValue = Math.max(0, certified - allocatedInvoiceGross);
  const invoicedNotCollectedValue = invoiceOutstanding;

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

function runGapsTests() {
  console.log("▶ Running tests/unit/gaps.test.js (Classification: Pure Unit Test)...");

  // Canonical Initial State: Grand Meridian MC-006
  // Work: Rp 3.2B | Measured: Rp 3.0B | Claimed: Rp 2.75B | Certified: Rp 2.10B | Invoiced: Rp 2.10B | Collected: Rp 1.40B
  const mc006 = calculateClaimGaps({
    workPerformedValue: 3200000000,
    measuredValue: 3000000000,
    claimedValue: 2750000000,
    certifiedValue: 2100000000,
    allocatedInvoiceGross: 2100000000,
    invoiceOutstandingTotal: 700000000, // 2.10B Invoiced - 1.40B Collected = 700M
  });

  console.log("  Verifying Canonical MC-006 Initial Gap Assertions:");
  console.log("    Work Performed:       Rp 3,200,000,000");
  console.log("    Measured:             Rp 3,000,000,000");
  console.log("    Claimed:              Rp 2,750,000,000");
  console.log("    Certified:            Rp 2,100,000,000");
  console.log("    Invoiced:             Rp 2,100,000,000");
  console.log("    Collected:            Rp 1,400,000,000");

  assert.strictEqual(mc006.unmeasuredValue, 200000000, "Unmeasured Gap must equal MAX(Work - Measured, 0) = Rp 200,000,000");
  assert.strictEqual(mc006.unclaimedValue, 250000000, "Unclaimed Gap must equal MAX(Measured - Claimed, 0) = Rp 250,000,000");
  assert.strictEqual(mc006.uncertifiedValue, 650000000, "Uncertified Gap must equal MAX(Claimed - Certified, 0) = Rp 650,000,000");
  assert.strictEqual(mc006.certifiedNotInvoicedValue, 0, "Certified Not Invoiced must equal MAX(Certified - Invoiced, 0) = Rp 0");
  assert.strictEqual(mc006.invoicedNotCollectedValue, 700000000, "Invoice Outstanding must equal Rp 700,000,000");
  assert.strictEqual(mc006.totalOpenValue, 1800000000, "Total Open Value must equal Rp 1,800,000,000");

  console.log("  ✔ All Canonical MC-006 numbers verified independently with mathematical proof!");

  // Edge cases & bounding
  const zeroGaps = calculateClaimGaps({ workPerformedValue: 0, measuredValue: 0, claimedValue: 0, certifiedValue: 0 });
  assert.strictEqual(zeroGaps.totalOpenValue, 0);

  const negativeGaps = calculateClaimGaps({ workPerformedValue: -100, measuredValue: -50, claimedValue: -20, certifiedValue: 0 });
  assert.strictEqual(negativeGaps.totalOpenValue, 0);

  console.log("✔ Value Gap Engine unit tests passed!");
}

module.exports = { runGapsTests };
if (require.main === module) runGapsTests();
