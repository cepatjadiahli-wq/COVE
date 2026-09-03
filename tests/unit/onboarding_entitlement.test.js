/**
 * Test Suite 20: Phase 10 Onboarding, Concierge Pilot, Entitlement, and Packaging
 * PRD Reference: Section 23 (Onboarding & Concierge Pilot), Section 28 (Packaging & Entitlement), Section 35 (Commercial Clean-up)
 */

const {
  PILOT_SCOPE_CONFIG,
  B2B_PACKAGES,
  INITIAL_DATA_ACCEPTANCE_ITEMS,
  evaluateDataAcceptance,
  validateProjectEntitlement,
  validateExportEntitlement,
  generatePilotScorecard,
} = require("../../domains/onboarding/service");

const {
  SUBSCRIPTION_TIERS,
  hasFeatureAccess,
} = require("../../lib/subscription/tiers");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[Phase 10 Onboarding & Entitlement Assertion FAILED] ${message}`);
  }
}

async function runOnboardingEntitlementTestSuite() {
  console.log("  >>> Starting Phase 10 Onboarding & Entitlement Test Suite...");

  // 1. PRD Section 23.1: Scope Pilot 45 Hari
  console.log("  [1] Verifying PRD 23.1: Scope Pilot 45 Hari configuration...");
  assert(PILOT_SCOPE_CONFIG.durationDays === 45, "Pilot duration must be exactly 45 days (PRD 23.1)");
  assert(PILOT_SCOPE_CONFIG.maxActiveProjects === 1, "Pilot scope must be strictly 1 active project (PRD 23.1)");
  assert(PILOT_SCOPE_CONFIG.maxUsers === 10, "Pilot users must be capped at 10 (PRD 23.1)");
  assert(PILOT_SCOPE_CONFIG.minWeeklyReviews === 4, "Must include at least 4 weekly reviews (PRD 23.1)");
  assert(PILOT_SCOPE_CONFIG.priceMin === 7500000 && PILOT_SCOPE_CONFIG.priceMax === 12500000, "Price must be in range Rp7.5M - Rp12.5M (PRD 23.1)");

  // 2. PRD Section 23.3: Data Acceptance Checklist Evaluation
  console.log("  [2] Verifying PRD 23.3: Data Acceptance Checklist (8 mandatory criteria)...");
  assert(INITIAL_DATA_ACCEPTANCE_ITEMS.length === 8, "Data acceptance checklist must have 8 mandatory criteria (PRD 23.3)");
  
  const allVerifiedEval = evaluateDataAcceptance(INITIAL_DATA_ACCEPTANCE_ITEMS);
  assert(allVerifiedEval.isFullyAccepted, "All verified items must yield isFullyAccepted = true");
  assert(allVerifiedEval.pendingCount === 0, "No pending items should remain");

  const pendingList = [
    ...INITIAL_DATA_ACCEPTANCE_ITEMS.slice(0, 7),
    { ...INITIAL_DATA_ACCEPTANCE_ITEMS[7], status: "PENDING" },
  ];
  const pendingEval = evaluateDataAcceptance(pendingList);
  assert(!pendingEval.isFullyAccepted, "Checklist with pending item must NOT be fully accepted");
  assert(pendingEval.pendingCount === 1, "Pending count must reflect unverified items");

  // 3. PRD Section 23.2 & 24.5: Day 45 Pilot Scorecard Evaluation
  console.log("  [3] Verifying PRD 23.2 & 24.5: Day 45 Pilot Scorecard Generator...");
  const scorecard = generatePilotScorecard({
    projectId: "prj-meridian",
    projectName: "Grand Meridian Mixed-Use Development",
    baselineExposure: 3200000000,
    closingExposure: 1800000000,
    resolvedExposureLevelA: 850000000,
    baselineCycleDays: 48,
    closingCycleDays: 32,
    pilotFee: 10000000,
    implementationEffortHours: 12,
    weeklyReviewMinutesPerProject: 8,
    totalActiveProjectsInOrg: 1,
  });

  assert(scorecard.pilotDurationDays === 45, "Scorecard duration must be 45 days");
  assert(scorecard.exposureReduction === 1400000000, "Exposure reduction must be 1.4B (3.2B - 1.8B)");
  assert(scorecard.cycleDaysSaved === 16, "Cycle days saved must be 16 days (48 - 32)");
  assert(scorecard.roiMultiplier === 8.5, "ROI multiplier must be 8.5x (850M / 10M pilot fee)");
  assert(scorecard.timeBudgetCompliance.isImplementationUnderBudget, "Implementation 12h must be under 16h budget (PRD 23.4)");
  assert(scorecard.timeBudgetCompliance.isWeeklyReviewUnderBudget, "Weekly review 8m must be under 10m budget (PRD 23.4)");
  assert(scorecard.recommendedTier === "b2b_core", "Single project org must be recommended b2b_core");

  // Test multi-project org recommendation -> b2b_scale
  const scaleScorecard = generatePilotScorecard({
    projectId: "prj-multi",
    projectName: "Multi Project Contractor",
    baselineExposure: 5000000000,
    closingExposure: 2000000000,
    resolvedExposureLevelA: 1500000000,
    baselineCycleDays: 50,
    closingCycleDays: 30,
    totalActiveProjectsInOrg: 4,
  });
  assert(scaleScorecard.recommendedTier === "b2b_scale", "Org with >= 3 projects must be recommended b2b_scale");

  // 4. PRD Section 28 & 28.1: B2B Packaging & Project Entitlement
  console.log("  [4] Verifying PRD Section 28: B2B Packaging & Active Project Entitlement...");
  assert(Boolean(B2B_PACKAGES.b2b_pilot), "B2B Paid Pilot package must exist");
  assert(Boolean(B2B_PACKAGES.b2b_core), "B2B Core package must exist");
  assert(B2B_PACKAGES.b2b_core.priceAmount === 2500000, "Core price must be Rp2.5M/mo (PRD 28)");
  assert(B2B_PACKAGES.b2b_core.annualMinimum === 30000000, "Core annual min must be Rp30M (PRD 28)");
  assert(B2B_PACKAGES.b2b_scale.maxActiveProjects === 5, "Scale tier must support 5 active projects (PRD 28)");

  // Active project quota check
  const allowedCore = validateProjectEntitlement("b2b_core", 0);
  assert(allowedCore.allowed, "0 active projects should be allowed for Core (limit 1)");

  const blockedCore = validateProjectEntitlement("b2b_core", 1);
  assert(!blockedCore.allowed, "1 active project should reach limit for Core (1 project max)");
  assert(blockedCore.error.includes("Batas proyek aktif"), "Error must mention active project limit");

  const allowedScale = validateProjectEntitlement("b2b_scale", 4);
  assert(allowedScale.allowed, "4 active projects should be allowed for Scale (limit 5)");

  // 5. PRD Section 28.1: Read/Export Grace Period Guarantee
  console.log("  [5] Verifying PRD 28.1: Open Data Read/Export Grace Period Guarantee...");
  const activeExport = validateExportEntitlement("active");
  assert(activeExport.canExport, "Active subscription must allow export");

  const expiredExport = validateExportEntitlement("expired");
  assert(expiredExport.canExport, "Expired subscription must ALWAYS allow export (PRD 28.1 grace period rule)");
  assert(expiredExport.notice.includes("Grace Period"), "Notice must explain open data grace period");

  // 6. PRD Section 28.1 & 35: Commercial Clean-up & Backward Compatibility
  console.log("  [6] Verifying PRD 28.1 & 35: Commercial Clean-up and Legacy Backward Compatibility...");
  assert(Boolean(SUBSCRIPTION_TIERS.b2b_pilot), "SUBSCRIPTION_TIERS must contain b2b_pilot");
  assert(Boolean(SUBSCRIPTION_TIERS.b2b_core), "SUBSCRIPTION_TIERS must contain b2b_core");
  assert(Boolean(SUBSCRIPTION_TIERS.b2b_scale), "SUBSCRIPTION_TIERS must contain b2b_scale");
  assert(Boolean(SUBSCRIPTION_TIERS.b2b_enterprise), "SUBSCRIPTION_TIERS must contain b2b_enterprise");
  // Ensure legacy tier IDs are still preserved for webhook and existing payments (no regression)
  assert(Boolean(SUBSCRIPTION_TIERS.lifetime_799k), "Legacy lifetime_799k must be preserved for backward compatibility");
  assert(Boolean(SUBSCRIPTION_TIERS.monthly_129k), "Legacy monthly_129k must be preserved");

  // Feature access check
  assert(hasFeatureAccess("b2b_core", "p2c"), "Core tier must have p2c feature access");
  assert(hasFeatureAccess("b2b_core", "readiness_gate"), "Core tier must have readiness_gate feature access");
  assert(hasFeatureAccess("b2b_scale", "multi_project_ranking"), "Scale tier must have multi_project_ranking access");
  assert(hasFeatureAccess("b2b_enterprise", "sso_api"), "Enterprise tier must have all features");

  console.log("  >>> All Phase 10 Onboarding & Entitlement assertions PASSED successfully! [Suite 20 OK]\n");
  return true;
}

module.exports = { runOnboardingEntitlementTestSuite };
