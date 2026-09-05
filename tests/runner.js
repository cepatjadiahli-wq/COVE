process.env.NODE_ENV = "test";
const path = require("path");
const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, "../"),
  },
});
jiti.register();

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
const { runRbacAuthTestSuite } = require("./unit/rbac_auth.test");
const { runContractRulesTestSuite } = require("./unit/contract_rules.test");
const { runImportEngineTestSuite } = require("./unit/import_engine.test");
const { runValueGapLedgerTestSuite } = require("./unit/value_gap_ledger.test");
const { runReadinessGateTestSuite } = require("./unit/readiness_gate.test");
const { runActionsEscalationTestSuite } = require("./unit/actions_escalation.test");
const { runPortfolioRoiTestSuite } = require("./unit/portfolio_roi.test");
const { runPlatformUsabilityTestSuite } = require("./unit/platform_usability.test");
const { runOnboardingEntitlementTestSuite } = require("./unit/onboarding_entitlement.test");
const { runUatMasterTestSuite } = require("./integration/uat_18_scenarios.test");
const { runDodReleaseReadinessTestSuite } = require("./unit/dod_release_readiness.test");
const { runSubscriptionFoundationTestSuite } = require("./unit/subscription_foundation.test");
const { runPaymentProviderWebhookTestSuite } = require("./unit/payment_provider_webhook.test");
const { runCustomerBillingPortalTestSuite } = require("./unit/customer_billing_portal.test");
const { runSecurityRemediationTestSuite } = require("./unit/security_remediation.test");
const { runDunningRecoveryLifecycleTestSuite } = require("./unit/dunning_recovery_lifecycle.test");
const { runDunningE2EDatabaseTests } = require("./integration/dunning_e2e_database.test");
const { runAdminBillingTestSuite } = require("./integration/admin_billing_control_center.test");
const { runPhase18RIntegrityTestSuite } = require("./integration/phase18r_financial_integrity.test");
const { runPhase18R1SafetyTestSuite } = require("./integration/phase18r1_serverless_safety.test");
const { runFaultInjectionTestSuite } = require("./integration/phase18r1_fault_injection.test");
const { runPhase19UatTestSuite } = require("./integration/subscription_phase19_uat.test");
const { runBackupRestoreIntegrityTestSuite } = require("./integration/backup_restore_integrity.test");
const { runMayarWebhookAuthRepairTestSuite } = require("./integration/mayar_webhook_auth_repair.test");

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
  { name: "Phase 2 RBAC, Session Revocation & Audit Trail", classification: "Security & Authorization Unit Test", fn: runRbacAuthTestSuite },
  { name: "Phase 3 Project Intake & Contract Rule Foundation", classification: "Commercial & Rules Unit Test", fn: runContractRulesTestSuite },
  { name: "Phase 4 Excel/CSV Import & Reconciliation Engine", classification: "Data Ingestion & Integrity Unit Test", fn: runImportEngineTestSuite },
  { name: "Phase 5 Value Gap Ledger & Stage Engine", classification: "Core Financial Ledger Unit Test", fn: runValueGapLedgerTestSuite },
  { name: "Phase 6 Claim Readiness Gate", classification: "Readiness & Gatekeeper Unit Test", fn: runReadinessGateTestSuite },
  { name: "Phase 7 Action & Escalation Queue", classification: "Action & Resolution Unit Test", fn: runActionsEscalationTestSuite },
  { name: "Phase 8 Portfolio Review & ROI Ledger", classification: "Portfolio & Executive Unit Test", fn: runPortfolioRoiTestSuite },
  { name: "Phase 9 Platform Usability & Integration Bridge", classification: "Usability & Integration Unit Test", fn: runPlatformUsabilityTestSuite },
  { name: "Phase 10 Onboarding, Pilot Scorecard & Entitlement", classification: "Commercial & Entitlement Unit Test", fn: runOnboardingEntitlementTestSuite },
  { name: "Phase 11 Master 18 UAT Scenarios & Edge Cases", classification: "Master UAT & Edge Cases Integration Test", fn: runUatMasterTestSuite },
  { name: "Phase 12 MVP Definition of Done & Release Readiness", classification: "DoD & Release Readiness Unit Test", fn: runDodReleaseReadinessTestSuite },
  { name: "Phase 14 Billing Data Model & Entitlement Foundation", classification: "Billing Data Model & Entitlement Unit Test", fn: runSubscriptionFoundationTestSuite },
  { name: "Phase 15 Payment Provider Adapter & Webhook Normalization", classification: "Payment Gateway & Webhook Unit Test", fn: runPaymentProviderWebhookTestSuite },
  { name: "Phase 16 Customer Billing Portal & Subscription Workflows", classification: "Customer Billing Portal & Workflows Unit Test", fn: runCustomerBillingPortalTestSuite },
  { name: "Phase 16R Subscription Security, Authorization & Entitlement Remediation", classification: "Security & Authorization Unit Test", fn: runSecurityRemediationTestSuite },
  { name: "Phase 17 Renewal, Dunning & Billing Recovery Engine", classification: "Renewal, Dunning & Recovery Unit Test", fn: runDunningRecoveryLifecycleTestSuite },
  { name: "Phase 17R Dunning Financial Integrity & E2E Database Recovery", classification: "E2E Database Integration Test", fn: runDunningE2EDatabaseTests },
  { name: "Phase 18 Admin Billing Control Center, Reconciliation & SaaS Metrics", classification: "Admin Control & SaaS Metrics Integration Suite", fn: runAdminBillingTestSuite },
  { name: "Phase 18R Admin Billing Integrity and Completeness Remediation", classification: "Financial Integrity & Concurrency Remediation Suite", fn: runPhase18RIntegrityTestSuite },
  { name: "Phase 18R.1 Final Financial and Serverless Safety Patch", classification: "Financial Safety & Serverless Invariants Suite", fn: runPhase18R1SafetyTestSuite },
  { name: "Phase 18R.1 Fault Injection & Transaction Boundary Evidence", classification: "Fault Injection & Invariants Suite", fn: runFaultInjectionTestSuite },
  { name: "Phase 19 Mayar Provider Validation & UAT", classification: "Master 26 Scenarios & Subscription Invariants", fn: runPhase19UatTestSuite },
  { name: "Phase 19 Backup & Restore Disaster Recovery Integrity", classification: "Disaster Recovery & Financial Invariants Suite", fn: runBackupRestoreIntegrityTestSuite },
  { name: "Phase 19E-R1 Mayar Webhook Authentication Compatibility", classification: "Mayar Webhook Authentication & Payload Compatibility Suite", fn: runMayarWebhookAuthRepairTestSuite },
];

let passed = 0;
let failed = 0;

async function runAllSuites() {
  for (const suite of suites) {
    try {
      console.log(`\n--------------------------------------------------------------------------------`);
      console.log(`SUITE: ${suite.name}`);
      console.log(`CLASSIFICATION: [${suite.classification}]`);
      console.log(`--------------------------------------------------------------------------------`);
      await suite.fn();
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
}

runAllSuites().catch((err) => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});
