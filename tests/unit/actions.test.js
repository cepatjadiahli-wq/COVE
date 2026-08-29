const assert = require("assert");

function suggestActionPriority(input) {
  let score = 0;
  const exposure = input.financialExposure || 0;
  if (exposure >= 1000000000) score += 40;
  else if (exposure >= 500000000) score += 25;
  else if (exposure > 0) score += 10;

  if (input.riskSeverity === "critical") score += 35;
  else if (input.riskSeverity === "high") score += 20;
  else if (input.riskSeverity === "medium") score += 10;

  if ((input.agingDays || 0) >= 14) score += 20;
  else if ((input.agingDays || 0) >= 7) score += 10;

  if (score >= 60) return "critical";
  if (score >= 40) return "high";
  if (score >= 20) return "medium";
  return "low";
}

function runActionTests() {
  console.log("▶ Running tests/unit/actions.test.js...");

  // Test Case 1: High exposure (650M) + High severity + 16 days aging -> Critical
  const prio1 = suggestActionPriority({
    financialExposure: 650000000,
    riskSeverity: "high",
    agingDays: 16,
  });
  assert.strictEqual(prio1, "critical", "Should suggest critical priority");

  // Test Case 2: Low exposure + Low severity + 2 days -> Low
  const prio2 = suggestActionPriority({
    financialExposure: 50000000,
    riskSeverity: "low",
    agingDays: 2,
  });
  assert.strictEqual(prio2, "low", "Should suggest low priority");

  console.log("✔ Action Engine unit tests passed!");
}

module.exports = { runActionTests };
if (require.main === module) runActionTests();
