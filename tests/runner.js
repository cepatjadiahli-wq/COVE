const { runGapsTests } = require("./unit/gaps.test");
const { runRiskTests } = require("./unit/risk.test");
const { runInvoiceTests } = require("./unit/invoices.test");
const { runEvidenceTests } = require("./unit/evidence.test");
const { runActionTests } = require("./unit/actions.test");
const { runFreshnessTests } = require("./unit/freshness.test");
const { runClaimTransitionTests } = require("./integration/claim_transition.test");
const { runCriticalFlowTest } = require("./e2e/critical_flow.test");
const { runRlsSecurityTest } = require("./e2e/rls_security.test");
const { runBrowserE2ETest } = require("./e2e/browser_cove_journey.spec");
const { runPilotIsolationTests } = require("./integration/pilot_isolation.test");

console.log("================================================================================");
console.log("  COVE V1 — CONTROLLED CUSTOMER PILOT READINESS AUDIT RUNNER");
console.log("  Framework: Next.js 16.3.3 Active LTS | React 19.0.0 | PostgreSQL (Supabase)");
console.log("  Timestamp: " + new Date().toISOString());
console.log("================================================================================\n");

const suites = [
  { name: "Value Gap Engine", classification: "Pure Unit Test", fn: runGapsTests },
  { name: "Cash-at-Risk Engine", classification: "Pure Unit Test", fn: runRiskTests },
  { name: "Invoice & Cash Reconciliation", classification: "Pure Unit Test", fn: runInvoiceTests },
  { name: "Evidence Readiness", classification: "Pure Unit Test", fn: runEvidenceTests },
  { name: "Action Prioritization & Outcome Separation", classification: "Pure Unit Test", fn: runActionTests },
  { name: "Data Freshness Categorization", classification: "Pure Unit Test", fn: runFreshnessTests },
  { name: "Claim Stage Transition & History", classification: "Database Integration Test", fn: runClaimTransitionTests },
  { name: "Critical User Journey 21-Step (MC-006 2-Phase)", classification: "Database Integration Test", fn: runCriticalFlowTest },
  { name: "Multi-Tenant RLS & RBAC Penetration", classification: "Security Penetration Suite", fn: runRlsSecurityTest },
  { name: "Real Browser E2E & LocalStorage Destruction Test", classification: "Real Browser & Database E2E", fn: runBrowserE2ETest },
  { name: "Pilot Multi-Tenant Isolation & Admin Authorization", classification: "Pilot Integration Suite", fn: runPilotIsolationTests },
];

let passed = 0;
let failed = 0;

for (const suite of suites) {
  try {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`SUITE: ${suite.name}`);
    console.log(`CLASSIFICATION: [${suite.classification}]`);
    console.log(`--------------------------------------------------------------------------------`);
    suite.fn();
    passed++;
  } catch (err) {
    console.error(`❌ FAILED: ${suite.name}`);
    console.error(err);
    failed++;
  }
}

console.log("\n================================================================================");
console.log(`  AUDIT SUMMARY: ${passed} Passed, ${failed} Failed out of ${suites.length} Suites`);
console.log("================================================================================");

if (failed > 0) {
  console.error("  AUDIT FAILED: Critical defects discovered!");
  process.exit(1);
} else {
  console.log("  ALL AUDIT TEST SUITES PASSED ACCORDING TO PILOT READINESS CRITERIA! 🚀\n");
}
