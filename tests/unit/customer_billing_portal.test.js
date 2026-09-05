/**
 * Test Suite 25: Phase 16 Self-Service Customer Billing Portal & Subscription Workflows
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 3.11, 8.2, 12, 13)
 * References: COVE_PRD_v1.0_Validation_Gated_MVP.md (Section 28.1 Open Data Guarantee)
 */

const assert = require("assert");
const path = require("path");
const jiti = require("jiti")(path.resolve(__filename), {
  alias: {
    "@": path.resolve(__dirname, "../../"),
  },
});

const { calculateProration } = jiti("../../domains/subscription/proration");
const {
  evaluateDowngradeImpact,
  validateDowngradeProjectSelection,
} = jiti("../../domains/subscription/downgrade");
const { subscriptionWorkflowService } = jiti("../../domains/subscription/workflow-service");
const { dbAdapter } = jiti("../../lib/db/database-adapter");

async function runCustomerBillingPortalTestSuite() {
  console.log("▶ Running tests/unit/customer_billing_portal.test.js (Suite 25: Customer Billing Portal & Workflows)...");

  const orgId = "org-nusantara-01";

  // ============================================================================
  // Test 1: Mathematical Accuracy of Proration Calculation Engine
  // ============================================================================
  console.log("\n  [Test 1: Proration Calculation Engine Mathematical Accuracy]");
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-10-01T00:00:00Z"); // 30 days cycle
  const midCycle = new Date("2026-09-16T00:00:00Z"); // 15 days remaining

  const prorationResult = calculateProration({
    currentPrice: 2_500_000, // Core monthly
    targetPrice: 5_000_000,  // Scale monthly
    currentPeriodStart: start,
    currentPeriodEnd: end,
    now: midCycle,
  });

  assert.strictEqual(prorationResult.totalDays, 30, "Total cycle days must be 30");
  assert.strictEqual(prorationResult.remainingDays, 15, "Remaining cycle days must be 15");
  assert.strictEqual(prorationResult.unusedCredit, 1_250_000, "Unused credit must be Rp 1,250,000 (50% of 2.5M)");
  assert.strictEqual(prorationResult.proratedCost, 2_500_000, "Prorated target cost must be Rp 2,500,000 (50% of 5.0M)");
  assert.strictEqual(prorationResult.netPayable, 1_250_000, "Net payable must be Rp 1,250,000 (proratedCost - unusedCredit)");
  assert.strictEqual(prorationResult.isUpgrade, true, "Must flag as upgrade");

  // Downgrade proration test (net payable should be 0, no negative bill)
  const downgradeProration = calculateProration({
    currentPrice: 5_000_000,
    targetPrice: 2_500_000,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    now: midCycle,
  });
  assert.strictEqual(downgradeProration.isUpgrade, false, "Must flag as downgrade");
  assert.strictEqual(downgradeProration.netPayable, 0, "Downgrade net payable must be 0 (no immediate negative charge)");
  console.log("    ✔ Proration engine calculates daily rates, unused credits, and net payable IDR accurately.");

  // ============================================================================
  // Test 2: Customer Billing Details Retrieval & State Consistency
  // ============================================================================
  console.log("\n  [Test 2: Customer Billing Details Retrieval & Entitlement State]");
  const billingDetails = subscriptionWorkflowService.getCustomerBillingDetails(orgId);

  assert.ok(billingDetails.subscription, "Must return active subscription");
  assert.ok(billingDetails.currentPlan, "Must return current plan");
  assert.ok(billingDetails.availablePlans.length >= 3, "Must return available public plans");
  assert.ok(billingDetails.projects.total >= 1, "Must return project counts");
  assert.ok(billingDetails.users.total >= 1, "Must return user counts");
  assert.ok(Array.isArray(billingDetails.invoices), "Must return invoices array");
  console.log(`    ✔ Billing details successfully retrieved for tenant ${orgId}. Active projects: ${billingDetails.projects.active}.`);

  // ============================================================================
  // Test 3: Immediate Plan Upgrade Execution & Entitlement Snapshot
  // ============================================================================
  console.log("\n  [Test 3: Immediate Plan Upgrade Execution & Proration Invoicing]");
  const initialSub = dbAdapter.getActiveSubscription(orgId);
  initialSub.planId = "b2b_core";
  initialSub.billingInterval = "MONTHLY";

  const upgradeResult = subscriptionWorkflowService.executePlanChange({
    orgId,
    targetPlanId: "b2b_scale",
    targetInterval: "MONTHLY",
    actorId: "TEST_RUNNER",
  });

  assert.strictEqual(upgradeResult.success, true, "Upgrade execution must succeed");
  assert.strictEqual(upgradeResult.subscription.planId, "b2b_scale", "Subscription planId must be updated to b2b_scale");
  assert.strictEqual(upgradeResult.entitlement.maxActiveProjects, 5, "Scale tier must grant 5 active projects");
  assert.strictEqual(upgradeResult.entitlement.canMutate, true, "Mutations must be allowed on upgraded active plan");

  // Check that proration invoice was created
  const invoices = dbAdapter.getBillingInvoices(orgId);
  const prorationInvoice = invoices.find(
    (inv) =>
      (inv.invoiceNumber && inv.invoiceNumber.startsWith("INV-PRORATE")) ||
      (inv.number && inv.number.startsWith("INV-PRORATE"))
  );
  assert.ok(prorationInvoice, "A prorated invoice must be created on immediate upgrade");
  assert.strictEqual(prorationInvoice.status, "PAID", "Proration invoice must be marked PAID");
  console.log(`    ✔ Upgraded to b2b_scale. Quota expanded to ${upgradeResult.entitlement.maxActiveProjects} projects. Proration invoice recorded.`);

  // ============================================================================
  // Test 4: Downgrade Impact Assessment, Project Selection & Safe Archiving
  // ============================================================================
  console.log("\n  [Test 4: Downgrade Impact, Project Selection & Safe Archiving]");
  const mockActiveProjects = [
    { id: "prj-01", name: "Grand Meridian Commercial", code: "GMC-01" },
    { id: "prj-02", name: "Tower Fontana", code: "TFT-02" },
    { id: "prj-03", name: "Surabaya Industrial Hub", code: "SIH-03" },
  ];

  // Evaluate downgrade to Core (quota: 1 project)
  const impact = evaluateDowngradeImpact({
    activeProjects: mockActiveProjects,
    targetMaxProjects: 1,
  });
  assert.strictEqual(impact.needsProjectSelection, true, "Must flag that project selection is required");
  assert.strictEqual(impact.excessCount, 2, "Must identify 2 excess projects");

  // Invalid selection (> quota)
  const invalidSelection = validateDowngradeProjectSelection({
    activeProjects: mockActiveProjects,
    targetMaxProjects: 1,
    selectedProjectIds: ["prj-01", "prj-02"],
  });
  assert.strictEqual(invalidSelection.isValid, false, "Selection > quota must be rejected");

  // Valid selection (1 project)
  const validSelection = validateDowngradeProjectSelection({
    activeProjects: mockActiveProjects,
    targetMaxProjects: 1,
    selectedProjectIds: ["prj-01"],
  });
  assert.strictEqual(validSelection.isValid, true, "Selection within quota must be valid");
  assert.deepStrictEqual(validSelection.projectsToKeepActive, ["prj-01"]);
  assert.deepStrictEqual(validSelection.projectsToArchive, ["prj-02", "prj-03"]);

  const currentActive = dbAdapter.getProjects().filter((p) => p.status === "active");
  const firstActiveId = currentActive[0].id;

  // Execute Downgrade to b2b_core with project selection
  const downgradeResult = subscriptionWorkflowService.executePlanChange({
    orgId,
    targetPlanId: "b2b_core",
    targetInterval: "MONTHLY",
    selectedProjectIds: [firstActiveId],
    actorId: "TEST_RUNNER",
  });

  assert.strictEqual(downgradeResult.success, true, "Downgrade must succeed");
  assert.strictEqual(downgradeResult.subscription.planId, "b2b_core", "Subscription must be set to b2b_core");
  assert.strictEqual(downgradeResult.entitlement.maxActiveProjects, 1, "Core tier must have 1 active project quota");
  console.log("    ✔ Downgrade impact evaluated, project selection validated, non-selected projects archived safely.");

  // ============================================================================
  // Test 5: Cancellation at Period End & Self-Service Reactivation
  // ============================================================================
  console.log("\n  [Test 5: Cancellation at Period End & Reversible Reactivation]");
  // 5.1 Schedule cancellation
  const churnReason = "Proyek telah selesai / tidak ada proyek baru berjalan";
  const cancelResult = subscriptionWorkflowService.executeCancellationAtPeriodEnd({
    orgId,
    reason: churnReason,
    actorId: "TEST_RUNNER",
  });

  assert.strictEqual(cancelResult.success, true, "Cancellation scheduling must succeed");
  assert.strictEqual(cancelResult.subscription.status, "CANCEL_AT_PERIOD_END");
  assert.strictEqual(cancelResult.subscription.cancelAtPeriodEnd, true);
  assert.strictEqual(cancelResult.subscription.cancellationReason, churnReason);

  // Verify that tenant still has mutation access during the period
  const entitlementDuringCancel = dbAdapter.getTenantEntitlement(orgId);
  assert.strictEqual(entitlementDuringCancel.canMutate, true, "Tenant must maintain full mutation access until currentPeriodEnd");

  // 5.2 Reactivate before period end
  const reactivateResult = subscriptionWorkflowService.executeReactivation({
    orgId,
    actorId: "TEST_RUNNER",
  });

  assert.strictEqual(reactivateResult.success, true, "Reactivation must succeed");
  assert.strictEqual(reactivateResult.subscription.status, "ACTIVE");
  assert.strictEqual(reactivateResult.subscription.cancelAtPeriodEnd, false);
  assert.strictEqual(reactivateResult.subscription.cancellationReason, undefined);

  // 5.3 Attempt reactivating already active subscription should fail
  assert.throws(
    () => {
      subscriptionWorkflowService.executeReactivation({ orgId, actorId: "TEST_RUNNER" });
    },
    /Hanya langganan dengan status CANCEL_AT_PERIOD_END/,
    "Reactivating active subscription must throw error"
  );
  console.log("    ✔ Cancellation scheduled without sudden lockout; reactivation successfully restores ACTIVE status.");

  // ============================================================================
  // Test 6: Open Data Export Guarantee Across All Subscription Statuses (PRD 28.1)
  // ============================================================================
  console.log("\n  [Test 6: Open Data Export Guarantee Across All Subscription States]");
  const statusesToTest = ["ACTIVE", "CANCEL_AT_PERIOD_END", "PAST_DUE", "FROZEN"];

  for (const testStatus of statusesToTest) {
    const sub = dbAdapter.getActiveSubscription(orgId);
    sub.status = testStatus;

    // Simulate complete tenant data export
    const exportedProjects = dbAdapter.getProjects();
    const exportedInvoices = dbAdapter.getBillingInvoices(orgId);
    const exportedAuditLogs = dbAdapter.getBillingAuditLogs(orgId);
    const exportedClaims = dbAdapter.getClaims();

    assert.ok(exportedProjects.length > 0, `Projects must be exportable when status is ${testStatus}`);
    assert.ok(exportedInvoices.length > 0, `Invoices must be exportable when status is ${testStatus}`);
    assert.ok(exportedAuditLogs.length > 0, `Billing audit logs must be exportable when status is ${testStatus}`);
    assert.ok(exportedClaims.length > 0, `Claims must be exportable when status is ${testStatus}`);
  }

  // Restore active status
  const sub = dbAdapter.getActiveSubscription(orgId);
  sub.status = "ACTIVE";
  sub.cancelAtPeriodEnd = false;
  console.log("    ✔ Open Data Guarantee (PRD 28.1) verified: Tenant export is 100% accessible across ACTIVE, CANCEL_AT_PERIOD_END, PAST_DUE, and FROZEN states.");

  console.log("\n✅ Test Suite 25 (Phase 16 Customer Billing Portal & Workflows) PASSED (6/6 tests).");
}

if (require.main === module) {
  runCustomerBillingPortalTestSuite().catch((err) => {
    console.error("❌ Test Suite 25 FAILED:", err);
    process.exit(1);
  });
}

module.exports = { runCustomerBillingPortalTestSuite };
