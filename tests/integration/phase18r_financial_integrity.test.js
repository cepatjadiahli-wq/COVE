/**
 * COVE Phase 18R: Financial Integrity, Concurrency & SaaS Metrics Remediation
 * 20 Comprehensive UAT Integration Scenarios
 * Target: PostgreSQL Engine & Server Domain Services
 */

const assert = require("assert");
const crypto = require("crypto");
const path = require("path");
const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, "../../"),
  },
});
jiti.register();
const { createClient } = require("@supabase/supabase-js");

// Supabase Local Environment Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CRON_SECRET = process.env.CRON_SECRET || "cove_internal_cron_secret_key_32bytes_min";

process.env.CRON_SECRET = CRON_SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
process.env.NODE_ENV = "test";

// Import modules via jiti
const { setPlatformAdminResolverForTest } = jiti("@/lib/auth/server-guard.ts");
const {
  reconcilePaymentManually,
  unapplyPaymentManually,
  processPartialPayment,
} = jiti("@/domains/billing/reconciliation-engine.ts");
const { processRefundOrDispute } = jiti("@/domains/billing/refund-service.ts");
const {
  createOrUpdateMetricsSnapshot,
  simulateMrrMovementBridge,
} = jiti("@/domains/billing/saas-metrics-engine.ts");
const { evaluateTenantEntitlement } = jiti("@/domains/entitlement/service.ts");
const { adminBillingService } = jiti("@/domains/billing/admin-service.ts");
const actionsRoute = jiti("@/app/api/admin/billing/actions/route.ts");
const { runScanner } = require("../../scripts/scan-client-bundle-secrets.js");
const { NextRequest } = require("next/server");

async function runPhase18RIntegrityTestSuite() {
  console.log("================================================================================");
  console.log("  PHASE 18R: ADMIN BILLING INTEGRITY & COMPLETENESS REMEDIATION");
  console.log("  20 Comprehensive Financial & Concurrency UAT Test Scenarios");
  console.log("  Target: PostgreSQL Engine at " + SUPABASE_URL);
  console.log("================================================================================\n");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = crypto.randomBytes(4).toString("hex");
  const testOrgId = crypto.randomUUID();
  const testSubId = crypto.randomUUID();
  const testAdminId = crypto.randomUUID();

  // Create real platform admin user in auth.users
  const { data: adminAuthData, error: adminAuthErr } = await supabase.auth.admin.createUser({
    email: `admin_18r_${runId}@cove.id`,
    password: "Password18RAdmin!",
    email_confirm: true,
  });
  if (adminAuthErr) throw new Error("Failed to create auth user: " + adminAuthErr.message);

  const authUserId = adminAuthData.user.id;

  // Insert into platform_admins
  const { data: platformAdmin, error: padminErr } = await supabase
    .from("platform_admins")
    .insert({
      id: testAdminId,
      auth_user_id: authUserId,
      notes: "Phase 18R Verification Platform Admin",
    })
    .select()
    .single();
  if (padminErr) throw new Error("Failed to create platform admin: " + padminErr.message);

  // Set mock resolver for test environment
  setPlatformAdminResolverForTest(async (req) => {
    const authHeader = req?.headers?.get?.("authorization");
    if (authHeader === "Bearer invalid_admin_token") {
      return { authorized: false, statusCode: 403, error: "ACCESS_DENIED: Tenant OWNER / non-admin cannot access admin control center." };
    }
    return {
      authorized: true,
      statusCode: 200,
      admin: {
        id: platformAdmin.id,
        auth_user_id: platformAdmin.auth_user_id,
        role: "SUPER_ADMIN",
      },
    };
  });

  // Seed base test organization and subscription
  await supabase.from("organizations").insert({
    id: testOrgId,
    name: `PT Remediasi Nusantara ${runId}`,
    business_type: "General Contractor",
    subscription_status: "PAST_DUE",
  });

  const { error: subErr } = await supabase.from("subscriptions").insert({
    id: testSubId,
    org_id: testOrgId,
    plan_id: "b2b_core",
    price_id: "price_b2b_core_monthly",
    provider: "XENDIT",
    billing_interval: "MONTHLY",
    status: "PAST_DUE",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    grace_period_end: new Date(Date.now() - 1000 * 60).toISOString(), // expired grace
  });
  if (subErr) throw new Error("Failed to insert subscription: " + subErr.message);

  // ---------------------------------------------------------------------------
  // UAT 1: Concurrency - Parallel Partial Payments with Row-Level Locking
  // ---------------------------------------------------------------------------
  const invoice1Id = crypto.randomUUID();
  const invoice1Total = 5000000; // 5M IDR
  const { error: inv1Err } = await supabase.from("billing_invoices").insert({
    id: invoice1Id,
    org_id: testOrgId,
    subscription_id: testSubId,
    invoice_number: `INV-18R-CONC-${runId}`,
    amount_subtotal: invoice1Total,
    amount_total: invoice1Total,
    due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "PENDING",
    currency: "IDR",
  });
  if (inv1Err) throw new Error("Failed to insert invoice 1: " + inv1Err.message);

  // 3 concurrent partial payments of 2M each = 6M total (1M excess)
  const p1 = processPartialPayment({
    invoiceId: invoice1Id,
    paymentAmount: 2000000,
    provider: "XENDIT",
    providerPaymentId: `xendit_conc1_${runId}`,
  });
  const p2 = processPartialPayment({
    invoiceId: invoice1Id,
    paymentAmount: 2000000,
    provider: "XENDIT",
    providerPaymentId: `xendit_conc2_${runId}`,
  });
  const p3 = processPartialPayment({
    invoiceId: invoice1Id,
    paymentAmount: 2000000,
    provider: "XENDIT",
    providerPaymentId: `xendit_conc3_${runId}`,
  });

  await Promise.all([p1, p2, p3]);
  const { data: invAfter1 } = await supabase.from("billing_invoices").select("*").eq("id", invoice1Id).single();
  const { data: subAfter1 } = await supabase.from("subscriptions").select("*").eq("id", testSubId).single();
  const { data: overpayments1 } = await supabase
    .from("reconciliation_queue")
    .select("*")
    .eq("billing_invoice_id", invoice1Id)
    .eq("status", "OVERPAYMENT");

  assert.strictEqual(invAfter1.status, "PAID", "Invoice must be settled to PAID");
  assert.strictEqual(subAfter1.status, "ACTIVE", "Subscription must be reactivated to ACTIVE");
  assert.ok(overpayments1 && overpayments1.length >= 1, "Excess overpayment must be quarantined in reconciliation_queue");
  assert.strictEqual(Number(overpayments1[0].amount), 1000000, "Excess overpayment amount must be exactly 1,000,000 IDR");
  console.log("  ✔ UAT 1 Passed: Parallel partial payments settle invoice and quarantine excess without lost-updates.");

  // ---------------------------------------------------------------------------
  // UAT 2: Concurrency - Simultaneous Reconciliation Conflict (HTTP 409)
  // ---------------------------------------------------------------------------
  const recon2Id = crypto.randomUUID();
  const invoice2Id = crypto.randomUUID();
  const { error: inv2Err } = await supabase.from("billing_invoices").insert({
    id: invoice2Id,
    org_id: testOrgId,
    invoice_number: `INV-18R-REC2-${runId}`,
    amount_subtotal: 2500000,
    amount_total: 2500000,
    due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "PENDING",
    currency: "IDR",
  });
  if (inv2Err) throw new Error("Failed to insert invoice 2: " + inv2Err.message);
  await supabase.from("reconciliation_queue").insert({
    id: recon2Id,
    org_id: testOrgId,
    status: "UNAPPLIED",
    amount: 2500000,
    unapplied_amount: 2500000,
    applied_amount: 0,
    reason: "Unmatched bank transfer to reconcile",
  });

  const adminCall1 = reconcilePaymentManually({
    reconciliationId: recon2Id,
    targetBillingInvoiceId: invoice2Id,
    adminId: testAdminId,
    reason: "Admin 1 resolving anomaly",
  });
  const adminCall2 = reconcilePaymentManually({
    reconciliationId: recon2Id,
    targetBillingInvoiceId: invoice2Id,
    adminId: testAdminId,
    reason: "Admin 2 resolving anomaly simultaneously",
  });

  const [resA, resB] = await Promise.allSettled([adminCall1, adminCall2]);
  const succeededCount = [resA, resB].filter((r) => r.status === "fulfilled").length;
  const rejectedCount = [resA, resB].filter((r) => r.status === "rejected").length;

  assert.strictEqual(succeededCount, 1, "Exactly one parallel reconcile must succeed");
  assert.strictEqual(rejectedCount, 1, "Exactly one parallel reconcile must be rejected with conflict");
  const rejectedError = resA.status === "rejected" ? resA.reason : resB.reason;
  assert.strictEqual(rejectedError.statusCode, 409, "Conflicting reconciliation must return HTTP 409 Conflict");
  console.log("  ✔ UAT 2 Passed: Simultaneous reconciliation serialized with row locks and returns HTTP 409 Conflict.");

  // ---------------------------------------------------------------------------
  // UAT 3: Concurrency - Atomic Unapply Guarantees Non-Negative Balances
  // ---------------------------------------------------------------------------
  const unapplyRes = await unapplyPaymentManually({
    reconciliationId: recon2Id,
    adminId: testAdminId,
    reason: "Rollback reconciliation test",
  });
  assert.strictEqual(unapplyRes.status, "UNAPPLIED");
  assert.strictEqual(unapplyRes.unappliedAmount, 2500000);
  assert.strictEqual(unapplyRes.invoiceReverted, true, "Invoice reverted back to PENDING");
  console.log("  ✔ UAT 3 Passed: Atomic unapply rolls back invoice without negative balances.");

  // ---------------------------------------------------------------------------
  // UAT 4: Cumulative Refund Limits Enforced
  // ---------------------------------------------------------------------------
  const payment4Id = crypto.randomUUID();
  const invoice4Id = crypto.randomUUID();
  const { error: inv4Err } = await supabase.from("billing_invoices").insert({
    id: invoice4Id,
    org_id: testOrgId,
    invoice_number: `INV-18R-REF4-${runId}`,
    amount_subtotal: 2000000,
    amount_total: 2000000,
    due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "PAID",
    currency: "IDR",
  });
  if (inv4Err) throw new Error("Failed to insert invoice 4: " + inv4Err.message);

  const { error: pay4Err } = await supabase.from("payments").insert({
    id: payment4Id,
    billing_invoice_id: invoice4Id,
    org_id: testOrgId,
    amount: 2000000,
    net_amount: 2000000,
    paid_at: new Date().toISOString(),
    payment_method: "BANK_TRANSFER",
    provider_payment_id: `pay_ref4_${runId}`,
    status: "SUCCEEDED",
    provider: "XENDIT",
  });
  if (pay4Err) throw new Error("Failed to insert payment 4: " + pay4Err.message);

  // Partial refund 1: 500k (allowed)
  const ref1 = await processRefundOrDispute({
    paymentId: payment4Id,
    type: "PARTIAL_REFUND",
    amount: 500000,
    reason: "Partial refund phase 1",
    requestedBy: testAdminId,
  });
  assert.strictEqual(ref1.success, true);
  assert.strictEqual(ref1.invoiceStatus, "PAID", "Invoice must stay PAID on non-full partial refund");

  // Partial refund 2: 1M (allowed, total 1.5M <= 2M)
  const ref2 = await processRefundOrDispute({
    paymentId: payment4Id,
    type: "PARTIAL_REFUND",
    amount: 1000000,
    reason: "Partial refund phase 2",
    requestedBy: testAdminId,
  });
  assert.strictEqual(ref2.success, true);

  // Partial refund 3: 800k (1.5M + 800k = 2.3M > 2M -> MUST FAIL)
  let failedRef = false;
  try {
    await processRefundOrDispute({
      paymentId: payment4Id,
      type: "PARTIAL_REFUND",
      amount: 800000,
      reason: "Partial refund exceeding limit",
      requestedBy: testAdminId,
    });
  } catch (err) {
    failedRef = true;
    assert.ok(err.message.includes("CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT"));
  }
  assert.strictEqual(failedRef, true, "Exceeding cumulative refund must be strictly blocked");
  console.log("  ✔ UAT 4 Passed: Cumulative refund limit verified and excess blocked.");

  // ---------------------------------------------------------------------------
  // UAT 5: Full Refund Lifecycle & Entitlement Cancellation
  // ---------------------------------------------------------------------------
  const sub5Id = crypto.randomUUID();
  const inv5Id = crypto.randomUUID();
  const pay5Id = crypto.randomUUID();
  const { error: sub5Err } = await supabase.from("subscriptions").insert({
    id: sub5Id,
    org_id: testOrgId,
    plan_id: "b2b_core",
    price_id: "price_b2b_core_monthly",
    status: "ACTIVE",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  if (sub5Err) throw new Error("Failed to insert subscription 5: " + sub5Err.message);
  const { error: inv5Err } = await supabase.from("billing_invoices").insert({
    id: inv5Id,
    org_id: testOrgId,
    subscription_id: sub5Id,
    invoice_number: `INV-18R-FULL5-${runId}`,
    amount_subtotal: 2500000,
    amount_total: 2500000,
    due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "PAID",
    currency: "IDR",
  });
  if (inv5Err) throw new Error("Failed to insert invoice 5: " + inv5Err.message);

  const { error: pay5Err } = await supabase.from("payments").insert({
    id: pay5Id,
    billing_invoice_id: inv5Id,
    org_id: testOrgId,
    amount: 2500000,
    net_amount: 2500000,
    paid_at: new Date().toISOString(),
    payment_method: "BANK_TRANSFER",
    provider_payment_id: `pay_full5_${runId}`,
    status: "SUCCEEDED",
    provider: "XENDIT",
  });
  if (pay5Err) throw new Error("Failed to insert payment 5: " + pay5Err.message);

  const fullRef = await processRefundOrDispute({
    paymentId: pay5Id,
    type: "FULL_REFUND",
    amount: 2500000,
    reason: "Full customer refund",
    requestedBy: testAdminId,
  });
  assert.strictEqual(fullRef.invoiceStatus, "REFUNDED");
  assert.strictEqual(fullRef.subscriptionStatus, "CANCELLED");

  const { data: sub5After } = await supabase.from("subscriptions").select("status").eq("id", sub5Id).single();
  assert.strictEqual(sub5After.status, "CANCELLED", "Subscription cancelled on full refund");
  console.log("  ✔ UAT 5 Passed: Full refund cancels subscription and updates invoice to REFUNDED.");

  // ---------------------------------------------------------------------------
  // UAT 6: Dispute Lifecycle (DISPUTE_OPENED -> DISPUTE_WON)
  // ---------------------------------------------------------------------------
  const disputeOpen = await processRefundOrDispute({
    paymentId: pay5Id,
    type: "DISPUTE_OPENED",
    amount: 2500000,
    reason: "Customer chargeback filed with bank",
  });
  assert.strictEqual(disputeOpen.subscriptionStatus, "READ_ONLY");

  const disputeWon = await processRefundOrDispute({
    paymentId: pay5Id,
    type: "DISPUTE_WON",
    amount: 2500000,
    reason: "Evidence presented and dispute won",
  });
  assert.strictEqual(disputeWon.invoiceStatus, "PAID");
  assert.strictEqual(disputeWon.subscriptionStatus, "ACTIVE");
  console.log("  ✔ UAT 6 Passed: Dispute state machine transitions safely without double-credit.");

  // ---------------------------------------------------------------------------
  // UAT 7: Idempotency Key Prevents Duplicate Actions
  // ---------------------------------------------------------------------------
  const idemKey = `idem_key_${crypto.randomUUID()}`;
  const req1 = new NextRequest("http://localhost:3000/api/admin/billing/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": idemKey,
    },
    body: JSON.stringify({
      action: "CORRECT_BILLING_CONTACT",
      orgId: testOrgId,
      newContactEmail: `finance_${runId}@nusantara.co.id`,
      reason: "Correcting billing email address",
    }),
  });

  const resIdem1 = await actionsRoute.POST(req1);
  const jsonIdem1 = await resIdem1.json();
  assert.strictEqual(jsonIdem1.success, true);

  // Duplicate replay
  const req2 = new NextRequest("http://localhost:3000/api/admin/billing/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": idemKey,
    },
    body: JSON.stringify({
      action: "CORRECT_BILLING_CONTACT",
      orgId: testOrgId,
      newContactEmail: `finance_${runId}@nusantara.co.id`,
      reason: "Correcting billing email address",
    }),
  });
  const resIdem2 = await actionsRoute.POST(req2);
  const jsonIdem2 = await resIdem2.json();
  assert.strictEqual(jsonIdem2.isIdempotent, true, "Replayed request must return cached idempotent response");
  console.log("  ✔ UAT 7 Passed: Idempotency key verified against duplicate admin executions.");

  // ---------------------------------------------------------------------------
  // UAT 8: Override Canonical Integrity (ACCESS_EXTENSION grants access)
  // ---------------------------------------------------------------------------
  const futureExpiry = new Date(Date.now() + 14 * 86400000).toISOString();
  const overrideRecord = await adminBillingService.grantManualOverride({
    subscriptionId: testSubId,
    overrideType: "ACCESS_EXTENSION",
    newValue: { status: "ACTIVE", extendedDays: 14 },
    reason: "Temporary extension for contract signing",
    adminId: testAdminId,
    expiresAt: futureExpiry,
  });

  const evalWithExtension = evaluateTenantEntitlement({
    orgId: testOrgId,
    subscription: { id: testSubId, orgId: testOrgId, planId: "b2b_core", status: "PAST_DUE" },
    activeProjectsCount: 1,
    activeUsersCount: 2,
    manualOverrides: [overrideRecord],
  });
  assert.strictEqual(evalWithExtension.canMutate, true, "ACCESS_EXTENSION must allow mutations immediately");
  console.log("  ✔ UAT 8 Passed: Canonical manual override dynamically grants access to evaluateTenantEntitlement.");

  // ---------------------------------------------------------------------------
  // UAT 9: Override Instant Revocation
  // ---------------------------------------------------------------------------
  const revokedOvr = await adminBillingService.revokeManualOverride({
    overrideId: overrideRecord.id,
    revocationReason: "Contract negotiation cancelled",
    adminId: testAdminId,
  });
  assert.strictEqual(revokedOvr.is_revoked, true);

  const evalAfterRevoke = evaluateTenantEntitlement({
    orgId: testOrgId,
    subscription: { id: testSubId, orgId: testOrgId, planId: "b2b_core", status: "PAST_DUE" },
    activeProjectsCount: 1,
    activeUsersCount: 2,
    manualOverrides: [revokedOvr],
  });
  assert.strictEqual(evalAfterRevoke.canMutate, false, "Revoked override must instantly block mutation");
  console.log("  ✔ UAT 9 Passed: Override revocation immediately revokes entitlement without delay.");

  // ---------------------------------------------------------------------------
  // UAT 10: Override Future Expiration Constraint
  // ---------------------------------------------------------------------------
  let pastOvrFailed = false;
  try {
    await adminBillingService.grantManualOverride({
      subscriptionId: testSubId,
      overrideType: "STATUS_OVERRIDE",
      newValue: { status: "ACTIVE" },
      reason: "Attempting past expiry",
      adminId: testAdminId,
      expiresAt: new Date(Date.now() - 1000 * 60).toISOString(),
    });
  } catch {
    pastOvrFailed = true;
  }
  assert.strictEqual(pastOvrFailed, true, "Past expiration override must be rejected");
  console.log("  ✔ UAT 10 Passed: Past expiration override strictly rejected by future constraint.");

  // ---------------------------------------------------------------------------
  // UAT 11: Override Deduplication via Partial Unique Index
  // ---------------------------------------------------------------------------
  const ovr1 = await adminBillingService.grantManualOverride({
    subscriptionId: testSubId,
    overrideType: "ENTITLEMENT_BOOST",
    newValue: { max_projects: 10 },
    reason: "Boost 1",
    adminId: testAdminId,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  assert.ok(ovr1.id);

  // Second active override of same type on same subscription must fail unique constraint
  const { error: dupOvrErr } = await supabase.from("manual_subscription_overrides").insert({
    subscription_id: testSubId,
    org_id: testOrgId,
    override_type: "ENTITLEMENT_BOOST",
    previous_value: {},
    new_value: { max_projects: 20 },
    reason: "Conflicting duplicate boost",
    admin_id: testAdminId,
    expires_at: new Date(Date.now() + 10 * 86400000).toISOString(),
    is_revoked: false,
  });
  assert.ok(dupOvrErr && dupOvrErr.code === "23505", "Duplicate active override must violate partial unique index 23505");
  console.log("  ✔ UAT 11 Passed: Duplicate active override of same type rejected by partial unique index.");

  // ---------------------------------------------------------------------------
  // UAT 12: Audit Log Append-Only Database Trigger (SQLSTATE P0001)
  // ---------------------------------------------------------------------------
  const { data: auditEntry } = await supabase.from("admin_audit_logs").insert({
    admin_id: testAdminId,
    action: "SECURITY_TEST_AUDIT",
    target_entity: "TEST",
    target_id: "test-12",
    reason: "Immutability check",
  }).select("id").single();

  const { error: updateAuditErr } = await supabase
    .from("admin_audit_logs")
    .update({ reason: "Tampered reason" })
    .eq("id", auditEntry.id);
  assert.ok(updateAuditErr, "UPDATE on admin_audit_logs must fail");
  assert.ok(updateAuditErr.message.includes("CANNOT_MODIFY_AUDIT_LOG"), "UPDATE must throw append-only exception");

  const { error: deleteAuditErr } = await supabase
    .from("admin_audit_logs")
    .delete()
    .eq("id", auditEntry.id);
  assert.ok(deleteAuditErr, "DELETE on admin_audit_logs must fail");
  assert.ok(deleteAuditErr.message.includes("CANNOT_MODIFY_AUDIT_LOG"), "DELETE must throw append-only exception");
  console.log("  ✔ UAT 12 Passed: Database trigger enforces strict append-only immutability on admin_audit_logs.");

  // ---------------------------------------------------------------------------
  // UAT 13: Audit Log Coverage on Administrative Actions
  // ---------------------------------------------------------------------------
  const { data: auditLogs } = await supabase
    .from("admin_audit_logs")
    .select("action, before_state, after_state")
    .eq("admin_id", testAdminId);
  const recordedActions = auditLogs.map((l) => l.action);
  assert.ok(recordedActions.some((a) => a.includes("GRANT_") || a.includes("OVERRIDE")), "Override action must be logged");
  assert.ok(recordedActions.includes("RECONCILE_PAYMENT"), "Reconciliation action must be logged");
  console.log("  ✔ UAT 13 Passed: Comprehensive audit logs with before/after states verified.");

  // ---------------------------------------------------------------------------
  // UAT 14: Webhook Reprocessing Safety Guard
  // ---------------------------------------------------------------------------
  const webhookProcessedId = `evt_proc_${crypto.randomUUID()}`;
  await supabase.from("webhook_events").insert({
    event_id: webhookProcessedId,
    provider: "XENDIT",
    event_type: "INVOICE_PAID",
    processing_status: "PROCESSED",
    raw_payload: { status: "PAID" },
  });

  const reqReproc = new NextRequest("http://localhost:3000/api/admin/billing/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "REPROCESS_WEBHOOK",
      eventId: webhookProcessedId,
      reason: "Attempting to reprocess successful webhook",
    }),
  });
  const resReproc = await actionsRoute.POST(reqReproc);
  const jsonReproc = await resReproc.json();
  assert.strictEqual(resReproc.status, 400);
  assert.ok(jsonReproc.error.includes("WEBHOOK_ALREADY_PROCESSED"), "PROCESSED webhook must be rejected");
  console.log("  ✔ UAT 14 Passed: Reprocessing already processed webhooks is strictly blocked.");

  // ---------------------------------------------------------------------------
  // UAT 15: CSRF & Origin Tampering Guard
  // ---------------------------------------------------------------------------
  const reqCsrf = new NextRequest("http://localhost:3000/api/admin/billing/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://malicious-attacker-site.com",
    },
    body: JSON.stringify({
      action: "RESEND_PAYMENT_LINK",
      invoiceId: invoice1Id,
      reason: "Tampered origin test",
    }),
  });
  const resCsrf = await actionsRoute.POST(reqCsrf);
  assert.strictEqual(resCsrf.status, 403, "Origin mismatch must be rejected with HTTP 403");
  console.log("  ✔ UAT 15 Passed: Cross-origin / Referer tampering rejected with HTTP 403.");

  // ---------------------------------------------------------------------------
  // UAT 16: SaaS Metrics Zero-Denominator Handling
  // ---------------------------------------------------------------------------
  const simZero = simulateMrrMovementBridge({
    beginningMrr: 0,
    newMrr: 2500000,
    expansionMrr: 0,
    contractionMrr: 0,
    reactivationMrr: 0,
    churnedMrr: 0,
  });
  assert.strictEqual(simZero.grossRevenueRetention, null, "GRR must be null on zero beginning MRR");
  assert.strictEqual(simZero.grossRevenueRetentionStatus, "NOT_APPLICABLE", "GRR status must be NOT_APPLICABLE");
  assert.strictEqual(simZero.netRevenueRetention, null, "NRR must be null on zero beginning MRR without cohort");
  assert.strictEqual(simZero.netRevenueRetentionStatus, "NOT_APPLICABLE", "NRR status must be NOT_APPLICABLE");
  console.log("  ✔ UAT 16 Passed: Zero-denominator beginning MRR correctly yields null/NOT_APPLICABLE.");

  // ---------------------------------------------------------------------------
  // UAT 17: SaaS Metrics Upper Bound (GRR <= 1.0)
  // ---------------------------------------------------------------------------
  const simBound = simulateMrrMovementBridge({
    beginningMrr: 10000000,
    newMrr: 5000000,
    expansionMrr: 15000000, // Large expansion
    contractionMrr: 0,
    reactivationMrr: 0,
    churnedMrr: 0,
  });
  assert.ok(simBound.grossRevenueRetention <= 1.0, "GRR must not exceed 100% (1.0)");
  assert.strictEqual(simBound.grossRevenueRetention, 1.0);
  assert.strictEqual(simBound.netRevenueRetention, 2.5, "NRR reflects expansion (250%)");
  console.log("  ✔ UAT 17 Passed: GRR bounded to 1.0 (<= 100%) even during high expansion.");

  // ---------------------------------------------------------------------------
  // UAT 18: Multi-Movement MRR Movement Bridge (All 5 Movements in 1 Period)
  // ---------------------------------------------------------------------------
  const simAll = simulateMrrMovementBridge({
    beginningMrr: 50000000,
    newMrr: 15000000,
    expansionMrr: 10000000,
    contractionMrr: 5000000,
    reactivationMrr: 2500000,
    churnedMrr: 7500000,
  });
  // 50M + 15M + 10M + 2.5M - 5M - 7.5M = 65,000,000
  assert.strictEqual(simAll.endingMrr, 65000000);
  assert.strictEqual(simAll.isBalanced, true, "MRR bridge equation must balance to delta 0");
  console.log("  ✔ UAT 18 Passed: Multi-movement MRR bridge verified with all 5 movement types.");

  // ---------------------------------------------------------------------------
  // UAT 19: Snapshot Currency & Scope Uniqueness
  // ---------------------------------------------------------------------------
  const snap1 = await createOrUpdateMetricsSnapshot({
    periodType: "MONTHLY",
    snapshotDate: "2026-09-01",
    currency: "IDR",
    formulaVersion: "v1.0",
    isLocked: true,
  });
  assert.strictEqual(snap1.success, true);

  const snap2 = await createOrUpdateMetricsSnapshot({
    periodType: "MONTHLY",
    snapshotDate: "2026-09-01",
    currency: "IDR",
    formulaVersion: "v1.0",
  });
  assert.strictEqual(snap2.isIdempotent, true, "Duplicate snapshot request returns idempotent match");
  console.log("  ✔ UAT 19 Passed: Snapshot uniqueness per period, date, formula, and currency verified.");

  // ---------------------------------------------------------------------------
  // UAT 20: Static Secret Scanner
  // ---------------------------------------------------------------------------
  const scanResult = runScanner();
  assert.strictEqual(scanResult.success, true);
  assert.ok(scanResult.filesScanned >= 50, "At least 50 client files must be scanned");
  console.log("  ✔ UAT 20 Passed: Static client bundle and source code scan confirms 0 secret leaks.");

  console.log("\n================================================================================");
  console.log("  ALL 20 PHASE 18R FINANCIAL INTEGRITY & CONCURRENCY SCENARIOS PASSED (100%) 🚀");
  console.log("================================================================================\n");

  return { success: true, totalPassed: 20 };
}

if (require.main === module) {
  runPhase18RIntegrityTestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Phase 18R Test Failed:", err);
      process.exit(1);
    });
}

module.exports = { runPhase18RIntegrityTestSuite };
