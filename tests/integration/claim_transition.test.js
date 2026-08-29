const assert = require("assert");

const CLAIM_STAGE_ORDERS = {
  WORK_RECORDED: 1,
  MEASUREMENT: 2,
  CLAIM_PREPARATION: 3,
  CLAIM_READY: 4,
  SUBMITTED: 5,
  UNDER_REVIEW: 6,
  CERTIFIED: 7,
  INVOICE_READY: 8,
  INVOICE_ISSUED: 9,
  INVOICE_ACCEPTED: 10,
  DUE: 11,
  PARTIALLY_PAID: 12,
  PAID: 13,
  ON_HOLD: 99,
  DISPUTED: 99,
  REJECTED: 99,
  CANCELLED: 99,
};

function transitionClaimStage(req) {
  const currentOrder = CLAIM_STAGE_ORDERS[req.currentStage] || 0;
  const targetOrder = CLAIM_STAGE_ORDERS[req.targetStage] || 0;

  const isBackward = targetOrder < currentOrder && targetOrder < 90;
  const isException = targetOrder >= 90;
  const requiresReason = isBackward || isException;

  if (requiresReason && (!req.reason || req.reason.trim().length === 0)) {
    return {
      success: false,
      error: "Alasan eksplisit diperlukan untuk perpindahan tahap ini.",
    };
  }

  const durationMs = Date.now() - new Date(req.stageEnteredAt).getTime();
  const previousDurationHours = parseFloat((durationMs / 3600000).toFixed(2));

  return {
    success: true,
    newStage: req.targetStage,
    enteredAt: new Date().toISOString(),
    previousDurationHours,
    historyEntry: {
      fromStage: req.currentStage,
      toStage: req.targetStage,
      durationHours: previousDurationHours,
      changeReason: req.reason || "Normal progression",
    },
  };
}

function runClaimTransitionTests() {
  console.log("▶ Running tests/integration/claim_transition.test.js...");

  // Test Case 1: Normal forward transition (UNDER_REVIEW -> CERTIFIED)
  const forwardRes = transitionClaimStage({
    claimId: "clm-mc006",
    currentStage: "UNDER_REVIEW",
    targetStage: "CERTIFIED",
    stageEnteredAt: new Date(Date.now() - 48 * 3600000).toISOString(),
  });
  assert.strictEqual(forwardRes.success, true, "Forward transition should succeed without reason");
  assert.strictEqual(forwardRes.newStage, "CERTIFIED");
  assert.strictEqual(forwardRes.previousDurationHours, 48);

  // Test Case 2: Backward transition without reason (CERTIFIED -> UNDER_REVIEW) -> Fail
  const backwardFail = transitionClaimStage({
    claimId: "clm-mc006",
    currentStage: "CERTIFIED",
    targetStage: "UNDER_REVIEW",
    stageEnteredAt: new Date().toISOString(),
    reason: "",
  });
  assert.strictEqual(backwardFail.success, false, "Backward transition without reason must fail");

  // Test Case 3: Backward transition with valid reason -> Pass
  const backwardPass = transitionClaimStage({
    claimId: "clm-mc006",
    currentStage: "CERTIFIED",
    targetStage: "UNDER_REVIEW",
    stageEnteredAt: new Date().toISOString(),
    reason: "Koreksi perhitungan volume pembesian ulang oleh konsultan",
  });
  assert.strictEqual(backwardPass.success, true, "Backward transition with reason should pass");
  assert.strictEqual(backwardPass.historyEntry.changeReason, "Koreksi perhitungan volume pembesian ulang oleh konsultan");

  console.log("✔ Claim Stage Transition integration tests passed!");
}

module.exports = { runClaimTransitionTests };
if (require.main === module) runClaimTransitionTests();
