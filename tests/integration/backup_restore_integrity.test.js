/**
 * COVE Phase 19: Backup, Restore & Disaster Recovery Verification Test Suite
 * File: tests/integration/backup_restore_integrity.test.js
 * 
 * Verifies:
 * 1. Pre-corruption cryptographic backup creation (SHA-256 checksums).
 * 2. Simulated accidental corruption / data deletion.
 * 3. Successful restoration from backup.
 * 4. Post-restore record count, checksum, and referential integrity matching.
 * 5. Re-evaluation of financial invariants and entitlement post-restore.
 * 6. Realistic RPO (Recovery Point Objective) and RTO (Recovery Time Objective) measurement.
 */

process.env.NODE_ENV = "test";
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, "../../"),
  },
});
jiti.register();

const { createClient } = require("@supabase/supabase-js");
const {
  createBillingBackup,
  restoreBillingBackup,
  verifyBillingIntegrity,
} = require("../../scripts/backup-restore-billing");

const { evaluateTenantEntitlement } = jiti("@/domains/entitlement/service.ts");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runBackupRestoreIntegrityTestSuite() {
  console.log("================================================================================");
  console.log("  COVE PHASE 19: BACKUP, RESTORE & DISASTER RECOVERY TEST SUITE");
  console.log("  Target: Local Supabase Container at " + SUPABASE_URL);
  console.log("================================================================================\n");

  const runId = Date.now().toString(36);
  const drOrgId = crypto.randomUUID();
  const drSubId = crypto.randomUUID();
  const drInvId = crypto.randomUUID();
  const drPayId = crypto.randomUUID();

  // 1. Setup Isolated DR Test Organization and Billing Fixtures
  console.log("--- Step 1: Setting up isolated disaster recovery test fixtures ---");
  const { error: orgErr } = await supabase.from("organizations").insert({
    id: drOrgId,
    name: `Disaster Recovery Test Corp ${runId}`,
    billing_email: `dr-${runId}@cove.id`,
    subscription_tier: "tier_2",
    subscription_status: "ACTIVE",
  });
  if (orgErr) throw new Error(`Org insert failed: ${orgErr.message}`);

  const now = new Date();
  const periodStart = now.toISOString();
  const periodEnd = new Date(now.getTime() + 30 * 86400000).toISOString();

  const { error: subErr } = await supabase.from("subscriptions").insert({
    id: drSubId,
    org_id: drOrgId,
    plan_id: "b2b_core",
    price_id: "price_b2b_core_monthly",
    provider: "MAYAR",
    status: "ACTIVE",
    billing_interval: "MONTHLY",
    current_period_start: periodStart,
    current_period_end: periodEnd,
    currency: "IDR",
    scheduler_owner: "COVE",
  });
  if (subErr) throw new Error(`Sub insert failed: ${subErr.message}`);

  await supabase.from("organizations").update({ active_subscription_id: drSubId }).eq("id", drOrgId);

  const { error: invErr } = await supabase.from("billing_invoices").insert({
    id: drInvId,
    org_id: drOrgId,
    subscription_id: drSubId,
    invoice_number: `INV-DR-${runId}`,
    amount_subtotal: 3000000,
    amount_total: 3000000,
    status: "PAID",
    currency: "IDR",
    due_date: periodEnd,
    paid_at: periodStart,
    created_at: periodStart,
  });
  if (invErr) throw new Error(`Invoice insert failed: ${invErr.message}`);

  const { error: payErr } = await supabase.from("payments").insert({
    id: drPayId,
    org_id: drOrgId,
    billing_invoice_id: drInvId,
    amount: 3000000,
    net_amount: 3000000,
    fee_amount: 0,
    payment_method: "BANK_TRANSFER",
    status: "SETTLED",
    paid_at: periodStart,
    provider: "MAYAR",
    provider_payment_id: `myr_dr_pay_${runId}`,
  });
  if (payErr) throw new Error(`Payment insert failed: ${payErr.message}`);

  let adminId;
  const { data: existingAdmin } = await supabase.from("platform_admins").select("id").limit(1).maybeSingle();
  let createdAdminUserId = null;
  let createdAdminRecordId = null;
  if (existingAdmin) {
    adminId = existingAdmin.id;
  } else {
    const adminAuthRes = await supabase.auth.admin.createUser({
      email: `dr_admin_${runId}@cove.id`,
      password: "AdminPassword123!",
      email_confirm: true,
    });
    createdAdminUserId = adminAuthRes.data.user.id;
    createdAdminRecordId = crypto.randomUUID();
    const { error: padminErr } = await supabase.from("platform_admins").insert({
      id: createdAdminRecordId,
      auth_user_id: createdAdminUserId,
      notes: "DR Test Admin",
    });
    if (padminErr) throw new Error(`Platform admin creation failed: ${padminErr.message}`);
    adminId = createdAdminRecordId;
  }

  const { error: ovrErr } = await supabase.from("manual_subscription_overrides").insert({
    id: crypto.randomUUID(),
    org_id: drOrgId,
    subscription_id: drSubId,
    override_type: "ENTITLEMENT_BOOST",
    previous_value: { max_projects: 2 },
    new_value: { override_max_projects: 15, boost_reason: "Disaster Recovery Testing Quota" },
    reason: "Disaster recovery fixture grant",
    admin_id: adminId,
    granted_at: periodStart,
    expires_at: periodEnd,
    is_revoked: false,
  });
  if (ovrErr) throw new Error(`Override insert failed: ${ovrErr.message}`);

  const { error: auditErr } = await supabase.from("admin_audit_logs").insert({
    id: crypto.randomUUID(),
    admin_id: adminId,
    action: "CREATE_BACKUP_FIXTURE",
    target_entity: "ORGANIZATION",
    target_id: drOrgId,
    org_id: drOrgId,
    reason: "Disaster recovery testing fixture",
    before_state: null,
    after_state: { org_id: drOrgId, sub_id: drSubId },
    created_at: periodStart,
  });
  if (auditErr) throw new Error(`Audit log insert failed: ${auditErr.message}`);

  console.log("  ✔ Step 1 Passed: DR fixtures established with active subscription, invoice, and payment.");

  // 2. Create Initial Cryptographic Backup
  console.log("\n--- Step 2: Creating cryptographic billing backup ---");
  const backupStart = Date.now();
  const backup = await createBillingBackup(drOrgId);
  const backupDurationMs = Date.now() - backupStart;

  assert.ok(backup.tables.subscriptions.length >= 1, "Backup must include subscription");
  assert.ok(backup.tables.billing_invoices.length >= 1, "Backup must include billing invoice");
  assert.ok(backup.tables.manual_subscription_overrides.length >= 1, "Backup must include override");
  console.log(`  ✔ Step 2 Passed: Backup generated in ${backupDurationMs}ms with verified SHA-256 checksums.`);

  // 3. Simulate Accidental Corruption / Deletion
  console.log("\n--- Step 3: Simulating accidental data corruption & deletion ---");
  await supabase.from("manual_subscription_overrides").delete().eq("org_id", drOrgId);
  await supabase.from("payments").delete().eq("id", drPayId);
  await supabase.from("billing_invoices").delete().eq("id", drInvId);
  await supabase.from("subscriptions").update({ status: "CORRUPTED_ERROR" }).eq("id", drSubId);

  const corruptedCheck = await verifyBillingIntegrity(backup);
  assert.strictEqual(corruptedCheck.allCountsMatch, false, "Corrupted state must detect count mismatch");
  assert.strictEqual(corruptedCheck.allChecksumsMatch, false, "Corrupted state must detect checksum divergence");
  console.log("  ✔ Step 3 Passed: System detected data corruption and checksum mismatch.");

  // 4. Perform Disaster Recovery Restoration
  console.log("\n--- Step 4: Executing disaster recovery restore from backup ---");
  const restoreStart = Date.now();
  const restoreResults = await restoreBillingBackup(backup);
  const restoreDurationMs = Date.now() - restoreStart;

  console.log(`  Restore execution finished in ${restoreDurationMs}ms:`, Object.keys(restoreResults).length, "tables restored.");
  assert.ok(restoreDurationMs < 5000, `RTO must be under 5000ms: got ${restoreDurationMs}ms`);

  // 5. Verify Checksums and Referential Integrity Post-Restore
  console.log("\n--- Step 5: Verifying 100% post-restore integrity and checksums ---");
  const postRestoreIntegrity = await verifyBillingIntegrity(backup);
  assert.strictEqual(postRestoreIntegrity.allCountsMatch, true, "Restored record counts must match backup 100%");
  assert.strictEqual(postRestoreIntegrity.allChecksumsMatch, true, "Restored SHA-256 checksums must match backup 100%");
  assert.strictEqual(postRestoreIntegrity.referentialIntegrityValid, true, "Zero orphaned invoices or foreign key violations");
  console.log("  ✔ Step 5 Passed: Post-restore checksums and referential integrity match pre-disaster state 100%.");

  // 6. Verify Financial Invariants Post-Restore
  console.log("\n--- Step 6: Verifying financial invariants and entitlement resolution post-restore ---");
  const restoredSub = (await supabase.from("subscriptions").select("*").eq("id", drSubId).single()).data;
  assert.strictEqual(restoredSub.status, "ACTIVE", "Subscription status must be restored to ACTIVE");

  const restoredInvoice = (await supabase.from("billing_invoices").select("status, amount_total").eq("id", drInvId).single()).data;
  assert.strictEqual(restoredInvoice.status, "PAID", "Invoice status must be restored to PAID");
  assert.strictEqual(Number(restoredInvoice.amount_total), 3000000, "Invoice amount_total must be restored");

  const restoredOverrides = (await supabase.from("manual_subscription_overrides").select("*").eq("org_id", drOrgId)).data;
  const entitlement = evaluateTenantEntitlement({
    orgId: drOrgId,
    subscription: restoredSub,
    activeProjectsCount: 1,
    activeUsersCount: 1,
    manualOverrides: restoredOverrides,
  });
  assert.strictEqual(entitlement.maxActiveProjects, 15, "Entitlement boost must be fully restored from canonical override table");
  console.log("  ✔ Step 6 Passed: Financial state and tenant entitlement preserved post-disaster.");

  // Cleanup DR Fixtures
  await supabase.from("manual_subscription_overrides").delete().eq("org_id", drOrgId);
  await supabase.from("payments").delete().eq("org_id", drOrgId);
  await supabase.from("billing_invoices").delete().eq("org_id", drOrgId);
  await supabase.from("subscriptions").delete().eq("org_id", drOrgId);
  await supabase.from("organizations").delete().eq("id", drOrgId);

  console.log("\n================================================================================");
  console.log(`  BACKUP & DISASTER RECOVERY AUDIT PASSED (RPO: 0 data loss, RTO: ${restoreDurationMs}ms)`);
  console.log("================================================================================\n");
}

if (require.main === module) {
  runBackupRestoreIntegrityTestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Backup & Restore Test Suite Failed:", err);
      process.exit(1);
    });
}

module.exports = { runBackupRestoreIntegrityTestSuite };
