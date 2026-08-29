const assert = require("assert");

function calculateEvidenceReadiness(items) {
  if (!items || items.length === 0) {
    return { percent: 0, band: "INCOMPLETE" };
  }

  const applicableRequired = items.filter(
    (item) => item.required && item.status !== "not_applicable"
  );
  const verified = applicableRequired.filter((item) => item.status === "verified");

  if (applicableRequired.length === 0) {
    return { percent: 100, band: "READY" };
  }

  const percent = Math.round((verified.length / applicableRequired.length) * 100);
  let band = "INCOMPLETE";

  if (percent >= 100) band = "READY";
  else if (percent >= 80) band = "NEARLY_READY";
  else if (percent >= 50) band = "NEEDS_ATTENTION";

  return { percent, band, totalVerified: verified.length, totalApplicable: applicableRequired.length };
}

function runEvidenceTests() {
  console.log("▶ Running tests/unit/evidence.test.js...");

  // Test Case 1: 10 items, 5 verified, 0 N/A -> 50% (Needs Attention)
  const items1 = [
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "in_progress" },
    { required: true, status: "missing" },
    { required: true, status: "missing" },
    { required: true, status: "missing" },
    { required: true, status: "missing" },
  ];
  const res1 = calculateEvidenceReadiness(items1);
  assert.strictEqual(res1.percent, 50);
  assert.strictEqual(res1.band, "NEEDS_ATTENTION");

  // Test Case 2: 10 items, 8 verified, 2 N/A -> 8/8 = 100% (Ready)
  const items2 = [
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "verified" },
    { required: true, status: "not_applicable" },
    { required: true, status: "not_applicable" },
  ];
  const res2 = calculateEvidenceReadiness(items2);
  assert.strictEqual(res2.percent, 100, "N/A items must be excluded from denominator");
  assert.strictEqual(res2.band, "READY");

  console.log("✔ Evidence Readiness Engine unit tests passed!");
}

module.exports = { runEvidenceTests };
if (require.main === module) runEvidenceTests();
