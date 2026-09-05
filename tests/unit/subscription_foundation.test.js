/**
 * Test Suite 23: Phase 14 Billing Data Model & Entitlement Foundation
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 8, 9, 16)
 * References: docs/COVE_PHASE_14_IMPLEMENTATION_PLAN.md
 */

const assert = require("assert");
const {
  INITIAL_PLANS,
  INITIAL_PRICES,
  INITIAL_PLAN_ENTITLEMENTS,
  INITIAL_SUBSCRIPTIONS,
} = require("../../domains/billing/seed-data");

const {
  evaluateTenantEntitlement,
  guardMutation,
} = require("../../domains/entitlement/service");

const {
  canTransition,
  executeSubscriptionTransition,
} = require("../../domains/subscription/lifecycle");

async function runSubscriptionFoundationTestSuite() {
  console.log("▶ Running tests/unit/subscription_foundation.test.js (Suite 23: Billing Data Model & Entitlement Foundation)...");

  // ============================================================================
  // Test 1: Data Model & Catalog Integrity
  // ============================================================================
  console.log("\n  [Test 1: Plans, Prices, and Entitlement Catalog Integrity]");
  assert.strictEqual(INITIAL_PLANS.length >= 5, true, "Plans catalog must contain at least 5 plans");
  
  const pilotPlan = INITIAL_PLANS.find((p) => p.id === "b2b_pilot");
  const corePlan = INITIAL_PLANS.find((p) => p.id === "b2b_core");
  const scalePlan = INITIAL_PLANS.find((p) => p.id === "b2b_scale");
  const addonPlan = INITIAL_PLANS.find((p) => p.id === "b2b_addon_project");

  assert(Boolean(pilotPlan && corePlan && scalePlan && addonPlan), "All B2B core plans and add-on must exist");
  assert.strictEqual(pilotPlan.isPublic, true);
  assert.strictEqual(corePlan.isPublic, true);
  assert.strictEqual(scalePlan.isPublic, true);

  // Price versioning
  const coreMonthly = INITIAL_PRICES.find((p) => p.id === "price_core_monthly_v1");
  const coreAnnual = INITIAL_PRICES.find((p) => p.id === "price_core_annual_v1");
  assert.strictEqual(coreMonthly.amount, 2500000, "Core monthly price must be Rp 2,500,000");
  assert.strictEqual(coreAnnual.amount, 30000000, "Core annual price must be Rp 30,000,000");
  assert.strictEqual(coreMonthly.isCurrent, true);

  // Plan Entitlements
  const coreEntitlement = INITIAL_PLAN_ENTITLEMENTS.find((e) => e.planId === "b2b_core");
  const scaleEntitlement = INITIAL_PLAN_ENTITLEMENTS.find((e) => e.planId === "b2b_scale");
  assert.strictEqual(coreEntitlement.maxActiveProjects, 1, "Core plan must have max 1 active project");
  assert.strictEqual(coreEntitlement.maxUsers, 10, "Core plan must have max 10 users");
  assert.strictEqual(scaleEntitlement.maxActiveProjects, 5, "Scale plan must have max 5 active projects");
  assert.strictEqual(scaleEntitlement.maxUsers, 25, "Scale plan must have max 25 users");
  console.log("    ✔ Plan catalog, price versioning, and base entitlements verified.");

  // ============================================================================
  // Test 2: Server-Side Entitlement Evaluation (Active vs Read-Only vs Grace)
  // ============================================================================
  console.log("\n  [Test 2: Server-Side Entitlement Evaluation (Active, Grace, Read-Only, Suspended)]");
  
  // 2.1 Active Subscription
  const activeSub = { ...INITIAL_SUBSCRIPTIONS[0], status: "ACTIVE" };
  const evalActive = evaluateTenantEntitlement({
    orgId: "org-nusantara-01",
    subscription: activeSub,
    activeProjectsCount: 3,
    activeUsersCount: 8,
  });
  assert.strictEqual(evalActive.canMutate, true, "ACTIVE subscription must permit mutations");
  assert.strictEqual(evalActive.canView, true, "ACTIVE subscription must permit viewing");
  assert.strictEqual(evalActive.canExport, true, "ACTIVE subscription must permit export");
  assert.strictEqual(evalActive.isProjectQuotaReached, false, "3 projects out of 5 must not be reached");

  // 2.2 Past Due within 7-Day Grace Period
  const pastDueSubGrace = {
    ...INITIAL_SUBSCRIPTIONS[0],
    status: "PAST_DUE",
    gracePeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days left
  };
  const evalGrace = evaluateTenantEntitlement({
    orgId: "org-nusantara-01",
    subscription: pastDueSubGrace,
    activeProjectsCount: 3,
    activeUsersCount: 8,
  });
  assert.strictEqual(evalGrace.canMutate, true, "PAST_DUE within grace period must retain full mutation rights");
  assert.strictEqual(evalGrace.gracePeriodDaysRemaining, 5, "Must compute 5 grace days remaining");

  // 2.3 Past Due after 7-Day Grace Period Expired
  const pastDueSubExpired = {
    ...INITIAL_SUBSCRIPTIONS[0],
    status: "PAST_DUE",
    gracePeriodEnd: new Date(Date.now() - 1000).toISOString(), // expired
  };
  const evalGraceExpired = evaluateTenantEntitlement({
    orgId: "org-nusantara-01",
    subscription: pastDueSubExpired,
    activeProjectsCount: 3,
    activeUsersCount: 8,
  });
  assert.strictEqual(evalGraceExpired.canMutate, false, "PAST_DUE after grace expired must block mutations");
  assert.strictEqual(evalGraceExpired.canExport, true, "Open Data Guarantee: export must remain true");

  // 2.4 READ_ONLY Status
  const readOnlySub = { ...INITIAL_SUBSCRIPTIONS[0], status: "READ_ONLY" };
  const evalReadOnly = evaluateTenantEntitlement({
    orgId: "org-nusantara-01",
    subscription: readOnlySub,
    activeProjectsCount: 3,
    activeUsersCount: 8,
  });
  assert.strictEqual(evalReadOnly.canMutate, false, "READ_ONLY subscription must block mutations");
  assert.strictEqual(evalReadOnly.canView, true, "READ_ONLY subscription must permit viewing");
  assert.strictEqual(evalReadOnly.canExport, true, "READ_ONLY subscription must permit export");

  // 2.5 SUSPENDED Status
  const suspendedSub = { ...INITIAL_SUBSCRIPTIONS[0], status: "SUSPENDED" };
  const evalSuspended = evaluateTenantEntitlement({
    orgId: "org-nusantara-01",
    subscription: suspendedSub,
    activeProjectsCount: 3,
    activeUsersCount: 8,
  });
  assert.strictEqual(evalSuspended.canMutate, false, "SUSPENDED subscription must block mutations");
  assert.strictEqual(evalSuspended.canView, false, "SUSPENDED subscription must block standard dashboard viewing");
  assert.strictEqual(evalSuspended.canExport, true, "Open Data Guarantee: export must remain available");
  console.log("    ✔ Entitlement evaluation states verified with Open Data Guarantee.");

  // ============================================================================
  // Test 3: Project Quota Limit Mutation Guards
  // ============================================================================
  console.log("\n  [Test 3: Project Quota Limit Mutation Guards]");
  
  // Core Plan: 0 projects -> Allow
  const coreSub = { ...INITIAL_SUBSCRIPTIONS[0], planId: "b2b_core", status: "ACTIVE" };
  const evalCoreAllowed = evaluateTenantEntitlement({
    orgId: "org-core-01",
    subscription: coreSub,
    activeProjectsCount: 0,
    activeUsersCount: 1,
  });
  const guardCoreAllowed = guardMutation(evalCoreAllowed, "CREATE_PROJECT");
  assert.strictEqual(guardCoreAllowed.allowed, true, "Core plan with 0 projects must allow creation");

  // Core Plan: 1 project -> Block creation of 2nd project
  const evalCoreBlocked = evaluateTenantEntitlement({
    orgId: "org-core-01",
    subscription: coreSub,
    activeProjectsCount: 1,
    activeUsersCount: 1,
  });
  const guardCoreBlocked = guardMutation(evalCoreBlocked, "CREATE_PROJECT");
  assert.strictEqual(guardCoreBlocked.allowed, false, "Core plan with 1 project must block 2nd project creation");
  assert.strictEqual(guardCoreBlocked.code, "QUOTA_EXCEEDED");
  assert(guardCoreBlocked.message.includes("Batas kuota proyek aktif"), "Message must explain active project quota");

  // Read-Only Status: Block project creation
  const guardReadOnlyProject = guardMutation(evalReadOnly, "CREATE_PROJECT");
  assert.strictEqual(guardReadOnlyProject.allowed, false);
  assert.strictEqual(guardReadOnlyProject.code, "READ_ONLY_BLOCK");

  // Read-Only Status: Block tracker import
  const guardReadOnlyImport = guardMutation(evalReadOnly, "IMPORT_TRACKER");
  assert.strictEqual(guardReadOnlyImport.allowed, false);
  assert.strictEqual(guardReadOnlyImport.code, "READ_ONLY_BLOCK");
  console.log("    ✔ Mutation guards enforce project limits and read-only lockdown.");

  // ============================================================================
  // Test 4: Subscription Lifecycle State Machine Transitions
  // ============================================================================
  console.log("\n  [Test 4: Subscription Lifecycle State Machine Transitions]");
  
  // Legal transition: ACTIVE -> CANCEL_AT_PERIOD_END
  assert.strictEqual(canTransition("ACTIVE", "CANCEL_AT_PERIOD_END"), true);
  const cancelTransition = executeSubscriptionTransition(activeSub, {
    targetStatus: "CANCEL_AT_PERIOD_END",
    reason: "Proyek selesai dan manajemen memutuskan tidak memperpanjang",
    source: "USER_REQUEST",
    actorId: "usr-bambang",
  });
  assert.strictEqual(cancelTransition.result.success, true);
  assert.strictEqual(cancelTransition.updatedSubscription.cancelAtPeriodEnd, true);
  assert.strictEqual(cancelTransition.updatedSubscription.churnReason, "Proyek selesai dan manajemen memutuskan tidak memperpanjang");
  assert.strictEqual(cancelTransition.statusEvent.fromStatus, "ACTIVE");
  assert.strictEqual(cancelTransition.statusEvent.toStatus, "CANCEL_AT_PERIOD_END");

  // Legal transition: CANCEL_AT_PERIOD_END -> ACTIVE (Reactivation)
  assert.strictEqual(canTransition("CANCEL_AT_PERIOD_END", "ACTIVE"), true);
  const reactivateTransition = executeSubscriptionTransition(cancelTransition.updatedSubscription, {
    targetStatus: "ACTIVE",
    reason: "Pelanggan membatalkan penghentian langganan",
    source: "USER_REQUEST",
    actorId: "usr-bambang",
  });
  assert.strictEqual(reactivateTransition.result.success, true);
  assert.strictEqual(reactivateTransition.updatedSubscription.cancelAtPeriodEnd, false);

  // Illegal transition: DRAFT -> READ_ONLY (Must be rejected)
  assert.strictEqual(canTransition("DRAFT", "READ_ONLY"), false);
  const draftSub = { ...activeSub, status: "DRAFT" };
  const illegalTransition = executeSubscriptionTransition(draftSub, {
    targetStatus: "READ_ONLY",
    reason: "Percobaan transisi ilegal",
    source: "ADMIN_OVERRIDE",
  });
  assert.strictEqual(illegalTransition.result.success, false);
  assert(illegalTransition.result.error.includes("[INVALID_STATE_TRANSITION]"), "Must return illegal transition error");
  console.log("    ✔ State machine transitions and audit events verified.");

  // ============================================================================
  // Test 5: Manual Overrides
  // ============================================================================
  console.log("\n  [Test 5: Time-Bound Manual Entitlement Overrides]");
  
  // Active override temporarily grants 10 projects to Core customer
  const activeOverride = {
    id: "ovr-01",
    orgId: "org-core-01",
    grantedBy: "Direksi COVE",
    reason: "Dispensasi masa transisi tender BUMN",
    overrideMaxProjects: 10,
    startsAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const evalWithOverride = evaluateTenantEntitlement({
    orgId: "org-core-01",
    subscription: coreSub,
    activeProjectsCount: 3,
    activeUsersCount: 5,
    activeOverride,
  });
  assert.strictEqual(evalWithOverride.maxActiveProjects, 10, "Override must temporarily set maxActiveProjects to 10");
  assert.strictEqual(evalWithOverride.isProjectQuotaReached, false, "3 projects must be within 10 project override");

  // Expired override reverts to base plan
  const expiredOverride = {
    ...activeOverride,
    expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
  };
  const evalExpiredOverride = evaluateTenantEntitlement({
    orgId: "org-core-01",
    subscription: coreSub,
    activeProjectsCount: 3,
    activeUsersCount: 5,
    activeOverride: expiredOverride,
  });
  assert.strictEqual(evalExpiredOverride.maxActiveProjects, 1, "Expired override must revert to Core plan limit of 1");
  assert.strictEqual(evalExpiredOverride.isProjectQuotaReached, true, "3 projects must exceed base limit of 1");
  console.log("    ✔ Time-bound manual override and auto-expiration verified.");

  console.log("\n✔ All Suite 23 Billing Data Model & Entitlement Foundation tests PASSED successfully!");
}

runSubscriptionFoundationTestSuite().catch((err) => {
  console.error("❌ Suite 23 Test Failure:", err);
  process.exit(1);
});

module.exports = { runSubscriptionFoundationTestSuite };
