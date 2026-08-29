const assert = require("assert");

function evaluateFreshness(updatedAt) {
  if (!updatedAt) return "UNKNOWN";
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));

  if (hoursAgo > 24 * 7) return "STALE";
  if (hoursAgo > 24) return "NEEDS_UPDATE";
  return "FRESH";
}

function runFreshnessTests() {
  console.log("▶ Running tests/unit/freshness.test.js...");

  assert.strictEqual(evaluateFreshness(new Date(Date.now() - 2 * 3600000)), "FRESH", "2 hours ago is Fresh");
  assert.strictEqual(evaluateFreshness(new Date(Date.now() - 48 * 3600000)), "NEEDS_UPDATE", "48 hours ago Needs Update");
  assert.strictEqual(evaluateFreshness(new Date(Date.now() - 10 * 86400000)), "STALE", "10 days ago is Stale");
  assert.strictEqual(evaluateFreshness(null), "UNKNOWN", "Null timestamp is Unknown");

  console.log("✔ Data Freshness Engine unit tests passed!");
}

module.exports = { runFreshnessTests };
if (require.main === module) runFreshnessTests();
