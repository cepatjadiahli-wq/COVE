const assert = require("assert");

function evaluateClaimRisk(input) {
  const unmeasured = Math.max(0, input.workPerformedValue - input.measuredValue);
  const unclaimed = Math.max(0, input.measuredValue - input.claimedValue);
  const uncertified = Math.max(0, input.claimedValue - input.certifiedValue);
  const certifiedNotInvoiced = Math.max(0, input.certifiedValue - (input.invoicedGrossValue || input.certifiedValue));
  const invoiceOutstanding = Math.max(0, input.invoiceOutstandingTotal || 0);

  const reasons = [];
  const components = [];
  let riskLevel = "HEALTHY";

  if (input.stage === "DISPUTED") {
    riskLevel = "CRITICAL";
    reasons.push("Disputed");
  }

  if (input.stageAgingDays >= (input.stageSlaCriticalDays || 21)) {
    riskLevel = "CRITICAL";
    reasons.push("SLA Critical Breach");
  } else if (input.stageAgingDays >= (input.stageSlaRiskDays || 14)) {
    if (riskLevel !== "CRITICAL") riskLevel = "AT_RISK";
    reasons.push("SLA Risk Breach");
  }

  if (input.hasActiveBlockers) {
    if (input.activeBlockerSeverity === "critical" || input.activeBlockerSeverity === "high") {
      riskLevel = "CRITICAL";
    } else {
      if (riskLevel === "HEALTHY") riskLevel = "AT_RISK";
    }
    reasons.push("Active Blocker");
  }

  const isRisky = riskLevel === "AT_RISK" || riskLevel === "CRITICAL";

  if (isRisky) {
    if (["WORK_RECORDED", "MEASUREMENT"].includes(input.stage) && unmeasured > 0) {
      components.push({ category: "UNMEASURED_AT_RISK", exposure: unmeasured });
    }
    if (["CLAIM_PREPARATION", "CLAIM_READY"].includes(input.stage) && unclaimed > 0) {
      components.push({ category: "UNCLAIMED_AT_RISK", exposure: unclaimed });
    }
    if (["SUBMITTED", "UNDER_REVIEW", "DISPUTED", "REJECTED"].includes(input.stage) && uncertified > 0) {
      components.push({ category: "UNCERTIFIED_AT_RISK", exposure: uncertified });
    }
    if (["CERTIFIED", "INVOICE_READY"].includes(input.stage) && certifiedNotInvoiced > 0) {
      components.push({ category: "CERTIFIED_NOT_INVOICED_AT_RISK", exposure: certifiedNotInvoiced });
    }
    if (["INVOICE_ISSUED", "DUE", "PARTIALLY_PAID"].includes(input.stage) && invoiceOutstanding > 0) {
      components.push({ category: "RECEIVABLE_AT_RISK", exposure: invoiceOutstanding });
    }
  }

  const totalCashAtRisk = components.reduce((acc, c) => acc + c.exposure, 0);

  return {
    riskLevel,
    totalCashAtRisk,
    components,
    riskReasons: reasons,
  };
}

function runRiskTests() {
  console.log("▶ Running tests/unit/risk.test.js...");

  // Test Case 1: Healthy claim should have 0 Cash-at-Risk even if open value exists
  const healthyClaim = evaluateClaimRisk({
    stage: "UNDER_REVIEW",
    stageAgingDays: 3,
    workPerformedValue: 1000000000,
    measuredValue: 1000000000,
    claimedValue: 1000000000,
    certifiedValue: 0,
    hasActiveBlockers: false,
  });
  assert.strictEqual(healthyClaim.riskLevel, "HEALTHY");
  assert.strictEqual(healthyClaim.totalCashAtRisk, 0, "Healthy claim should have 0 Cash-at-Risk");

  // Test Case 2: Claim MC-006 with 16 days in Under Review and High Blocker -> Critical Risk
  const mc006Risk = evaluateClaimRisk({
    stage: "UNDER_REVIEW",
    stageAgingDays: 16,
    workPerformedValue: 3200000000,
    measuredValue: 3000000000,
    claimedValue: 2750000000,
    certifiedValue: 2100000000,
    hasActiveBlockers: true,
    activeBlockerSeverity: "high",
    stageSlaRiskDays: 14,
  });

  assert.strictEqual(mc006Risk.riskLevel, "CRITICAL");
  assert.strictEqual(mc006Risk.totalCashAtRisk, 650000000, "Uncertified Cash-at-Risk should be exactly 650M");
  assert.strictEqual(mc006Risk.components.length, 1, "Only 1 component to prevent double counting");

  // Test Case 3: Disputed claim triggers Critical
  const disputedClaim = evaluateClaimRisk({
    stage: "DISPUTED",
    stageAgingDays: 5,
    workPerformedValue: 500000000,
    measuredValue: 500000000,
    claimedValue: 500000000,
    certifiedValue: 0,
    hasActiveBlockers: false,
  });
  assert.strictEqual(disputedClaim.riskLevel, "CRITICAL");
  assert.strictEqual(disputedClaim.totalCashAtRisk, 500000000);

  console.log("✔ Cash-at-Risk Engine unit tests passed!");
}

module.exports = { runRiskTests };
if (require.main === module) runRiskTests();
