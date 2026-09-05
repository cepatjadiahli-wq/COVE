/**
 * COVE Phase 16R.4: True Concurrency Database Integration Test
 * Verifies atomic serialization and row-level locking (SELECT ... FOR UPDATE)
 * on PostgreSQL database engine using two independent Supabase clients.
 */

const assert = require("assert");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function runTrueConcurrencyTest() {
  console.log("================================================================================");
  console.log("  PHASE 16R.4: TRUE-CONCURRENCY DATABASE INTEGRATION TEST");
  console.log("  Engine: PostgreSQL (Local Supabase at " + SUPABASE_URL + ")");
  console.log("================================================================================\n");

  // Two independent clients opening separate HTTP/PostgREST/PostgreSQL connections
  const client1 = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client2 = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testOrgId = crypto.randomUUID();
  const testClientId = crypto.randomUUID();

  console.log("  [Setup: Initializing Isolated Tenant Fixture]");
  console.log("    Tenant ID : " + testOrgId);
  console.log("    Client ID : " + testClientId);

  // 1. Setup Organization & Client
  const { error: orgErr } = await client1.from("organizations").insert({
    id: testOrgId,
    name: "PT True Concurrency Test " + Date.now(),
    subscription_status: "active",
  });
  assert.ifError(orgErr);

  const { error: clientErr } = await client1.from("clients").insert({
    id: testClientId,
    organization_id: testOrgId,
    client_code: "CLI-TC",
    name: "Client Concurrency Test",
  });
  assert.ifError(clientErr);

  // 2. Setup Subscription on Core Plan (max_active_projects = 1, max_users = 10)
  const { error: subErr } = await client1.from("subscriptions").insert({
    id: crypto.randomUUID(),
    org_id: testOrgId,
    plan_id: "b2b_core",
    price_id: "price_b2b_core_monthly",
    status: "ACTIVE",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert.ifError(subErr);

  console.log("    Plan      : b2b_core (Quota: 1 Active Project, 10 User Seats)");
  console.log("    Status    : ACTIVE\n");

  // ============================================================================
  // TEST 1: Project Quota True Concurrency (0/1 Initial -> 2 Parallel Requests)
  // ============================================================================
  console.log("  ------------------------------------------------------------------------------");
  console.log("  [Test 1: Project Quota True Concurrency (2 Independent Database Connections)]");
  console.log("  ------------------------------------------------------------------------------");

  const startTime1 = new Date().toISOString();
  const startTime2 = new Date().toISOString();
  console.log("    Transaction 1 Start Time : " + startTime1);
  console.log("    Transaction 2 Start Time : " + startTime2);

  const reqProject1 = client1.rpc("create_project_with_quota_check", {
    p_org_id: testOrgId,
    p_client_id: testClientId,
    p_project_code: "PRJ-TC-001",
    p_project_name: "Project Concurrency Alpha",
    p_contract_number: "CTR-TC-001",
    p_contract_title: "Contract Alpha",
    p_original_contract_value: 1500000000,
  });

  const reqProject2 = client2.rpc("create_project_with_quota_check", {
    p_org_id: testOrgId,
    p_client_id: testClientId,
    p_project_code: "PRJ-TC-002",
    p_project_name: "Project Concurrency Beta",
    p_contract_number: "CTR-TC-002",
    p_contract_title: "Contract Beta",
    p_original_contract_value: 2500000000,
  });

  const projectResults = await Promise.allSettled([reqProject1, reqProject2]);

  let projectFulfilledCount = 0;
  let projectRejectedCount = 0;
  let fulfilledProjectId = null;
  let rejectionReason = null;

  for (let i = 0; i < projectResults.length; i++) {
    const r = projectResults[i];
    const txNum = i + 1;
    if (r.status === "fulfilled" && !r.value.error) {
      projectFulfilledCount++;
      fulfilledProjectId = r.value.data;
      console.log(`    Transaction ${txNum} Result     : FULFILLED (Project ID: ${fulfilledProjectId})`);
    } else {
      projectRejectedCount++;
      const errMsg = r.status === "rejected" ? r.reason.message : r.value.error.message;
      rejectionReason = errMsg;
      console.log(`    Transaction ${txNum} Result     : REJECTED (${errMsg})`);
    }
  }

  assert.strictEqual(projectFulfilledCount, 1, "Exactly 1 concurrent project creation must be fulfilled");
  assert.strictEqual(projectRejectedCount, 1, "Exactly 1 concurrent project creation must be rejected");
  assert.match(
    rejectionReason,
    /Batas kuota proyek aktif untuk paket Anda/,
    "Rejection error must explicitly indicate project quota exceeded"
  );

  // Verify final database count
  const { count: finalProjectCount, error: countErr } = await client1
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", testOrgId);
  assert.ifError(countErr);

  console.log("    Final Active Projects    : " + finalProjectCount + " (Expected: 1)");
  assert.strictEqual(finalProjectCount, 1, "Database project count must strictly equal 1");
  console.log("    ✔ Test 1 PASSED: True concurrency serialized by row lock (1 fulfilled, 1 rejected, count=1).\n");

  // ============================================================================
  // TEST 2: User Seat Quota True Concurrency (9/10 Initial -> 2 Parallel Invites)
  // ============================================================================
  console.log("  ------------------------------------------------------------------------------");
  console.log("  [Test 2: User Seat Quota True Concurrency (9 Seats Used, Quota 10)]");
  console.log("  ------------------------------------------------------------------------------");

  console.log("    Pre-seeding 9 existing active members...");
  for (let s = 1; s <= 9; s++) {
    const seedEmail = `existing_staff_${s}_${Date.now()}@testconcurrency.com`;
    const { data: prof, error: profErr } = await client1
      .from("profiles")
      .insert({
        full_name: `Staff Member ${s}`,
        email: seedEmail,
      })
      .select("id")
      .single();
    assert.ifError(profErr);

    const { error: memErr } = await client1.from("organization_members").insert({
      organization_id: testOrgId,
      user_id: prof.id,
      role: "VIEWER",
      status: "active",
    });
    assert.ifError(memErr);
  }

  const { count: initialSeats } = await client1
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", testOrgId)
    .in("status", ["active", "invited"]);
  console.log("    Initial Counted Seats    : " + initialSeats + " / 10");
  assert.strictEqual(initialSeats, 9, "Initial seats must be exactly 9");

  const emailAlpha = `concurrent_alpha_${Date.now()}@testconcurrency.com`;
  const emailBeta = `concurrent_beta_${Date.now()}@testconcurrency.com`;

  const startTime3 = new Date().toISOString();
  const startTime4 = new Date().toISOString();
  console.log("    Transaction 3 Start Time : " + startTime3 + " (Target: " + emailAlpha + ")");
  console.log("    Transaction 4 Start Time : " + startTime4 + " (Target: " + emailBeta + ")");

  const reqUser1 = client1.rpc("invite_user_with_quota_check", {
    p_org_id: testOrgId,
    p_email: emailAlpha,
    p_full_name: "Candidate Alpha",
    p_role: "VIEWER",
  });

  const reqUser2 = client2.rpc("invite_user_with_quota_check", {
    p_org_id: testOrgId,
    p_email: emailBeta,
    p_full_name: "Candidate Beta",
    p_role: "VIEWER",
  });

  const userResults = await Promise.allSettled([reqUser1, reqUser2]);

  let userFulfilledCount = 0;
  let userRejectedCount = 0;
  let successfulEmail = null;
  let rejectedEmail = null;

  for (let i = 0; i < userResults.length; i++) {
    const r = userResults[i];
    const txNum = i + 3;
    const email = i === 0 ? emailAlpha : emailBeta;
    if (r.status === "fulfilled" && !r.value.error) {
      userFulfilledCount++;
      successfulEmail = email;
      console.log(`    Transaction ${txNum} Result     : FULFILLED (Seat granted to ${email})`);
    } else {
      userRejectedCount++;
      rejectedEmail = email;
      const errMsg = r.status === "rejected" ? r.reason.message : r.value.error.message;
      console.log(`    Transaction ${txNum} Result     : REJECTED (${errMsg})`);
    }
  }

  assert.strictEqual(userFulfilledCount, 1, "Exactly 1 concurrent invite must be fulfilled");
  assert.strictEqual(userRejectedCount, 1, "Exactly 1 concurrent invite must be rejected");
  assert.ok(successfulEmail, "Successful email must be recorded");

  // Verify final database count
  const { count: finalSeatsCount, error: seatCountErr } = await client1
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", testOrgId)
    .in("status", ["active", "invited"]);
  assert.ifError(seatCountErr);

  console.log("    Final Counted Seats      : " + finalSeatsCount + " (Expected: 10)");
  assert.strictEqual(finalSeatsCount, 10, "Database counted seats must strictly equal 10 (quota ceiling)");

  // Orphan Profile Check: The rejected invite MUST NOT have created an orphan profile in profiles table!
  const { data: orphanCheck, error: orphanErr } = await client1
    .from("profiles")
    .select("id, email")
    .eq("email", rejectedEmail);
  assert.ifError(orphanErr);

  const orphanCount = orphanCheck.length;
  console.log(`    Orphan Profile Check     : ${orphanCount} records found for rejected email '${rejectedEmail}'`);
  assert.strictEqual(orphanCount, 0, "Rejected user transaction must roll back with ZERO orphan profiles");
  console.log("    ✔ Test 2 PASSED: 1 fulfilled, 1 rejected, count=10, zero orphan profiles.\n");

  console.log("================================================================================");
  console.log("  ALL TRUE-CONCURRENCY DATABASE TESTS COMPLETED WITH 100% SUCCESS! 🚀");
  console.log("================================================================================");
}

runTrueConcurrencyTest().catch((err) => {
  console.error("FATAL ERROR in runTrueConcurrencyTest:", err);
  process.exit(1);
});
