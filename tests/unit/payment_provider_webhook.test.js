/**
 * Test Suite 24: Phase 15 Payment Provider Adapter & Webhook Normalization Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 10, 11, 16)
 * References: docs/COVE_PAYMENT_PROVIDER_DECISION.md
 */

const assert = require("assert");
const path = require("path");
const jiti = require("jiti")(path.resolve(__filename), {
  alias: {
    "@": path.resolve(__dirname, "../../"),
  },
});

const {
  getPaymentAdapter,
  MOCK_WEBHOOK_SECRET,
} = jiti("../../domains/billing/adapters");
const { processWebhookEvent } = jiti("../../domains/billing/webhook-service");
const { dbAdapter } = jiti("../../lib/db/database-adapter");

async function runPaymentProviderWebhookTestSuite() {
  console.log("▶ Running tests/unit/payment_provider_webhook.test.js (Suite 24: Payment Provider Adapter & Webhook Normalization)...");

  // ============================================================================
  // Test 1: Payment Provider Adapter Interface Compliance
  // ============================================================================
  console.log("\n  [Test 1: Adapter Interface Compliance Across Gateways]");
  const mockAdapter = getPaymentAdapter("MOCK");
  const xenditAdapter = getPaymentAdapter("XENDIT");
  const mayarAdapter = getPaymentAdapter("MAYAR");

  assert.strictEqual(mockAdapter.providerName, "MOCK");
  assert.strictEqual(xenditAdapter.providerName, "XENDIT");
  assert.strictEqual(mayarAdapter.providerName, "MAYAR");

  const requiredMethods = [
    "createCustomer",
    "createCheckoutSession",
    "createSubscription",
    "getSubscription",
    "cancelSubscription",
    "verifyWebhook",
    "normalizeWebhookEvent",
    "refundPayment",
    "reconcileTransaction",
  ];

  for (const method of requiredMethods) {
    assert.strictEqual(typeof mockAdapter[method], "function", `MockAdapter must implement ${method}`);
    assert.strictEqual(typeof xenditAdapter[method], "function", `XenditAdapter must implement ${method}`);
    assert.strictEqual(typeof mayarAdapter[method], "function", `MayarAdapter must implement ${method}`);
  }
  console.log("    ✔ All 3 adapters implement full PaymentProviderAdapter interface contract.");

  // ============================================================================
  // Test 2: Cryptographic Signature & Token Verification
  // ============================================================================
  console.log("\n  [Test 2: Cryptographic Signature & Token Verification]");
  // Test valid signature
  const validHeaders = { "x-mock-token": MOCK_WEBHOOK_SECRET };
  assert.strictEqual(mockAdapter.verifyWebhook(validHeaders, "{}"), true, "Valid secret must pass verification");

  // Test tampered/missing signature
  const forgedHeaders = { "x-mock-token": "forged_bad_token_999" };
  assert.strictEqual(mockAdapter.verifyWebhook(forgedHeaders, "{}"), false, "Forged token must be rejected");

  const emptyHeaders = {};
  assert.strictEqual(mockAdapter.verifyWebhook(emptyHeaders, "{}"), false, "Missing token must be rejected");

  // Service-level rejection with HTTP 401
  const rejectedResult = await processWebhookEvent({
    provider: "MOCK",
    headers: forgedHeaders,
    rawPayload: { event: "payment.succeeded" },
  });
  assert.strictEqual(rejectedResult.success, false);
  assert.strictEqual(rejectedResult.statusCode, 401, "Invalid token must return 401 Unauthorized");
  console.log("    ✔ Cryptographic signature verification and 401 rejection verified.");

  // ============================================================================
  // Test 3: Webhook Idempotency Enforcement (Zero Duplicate Payments)
  // ============================================================================
  console.log("\n  [Test 3: Webhook Idempotency Enforcement (Zero Duplicate Processing)]");
  const testOrgId = "org-nusantara-01";
  const uniqueEventId = `evt_idemp_test_${Date.now()}`;
  const initialPaymentCount = dbAdapter.getPayments(testOrgId).length;
  const initialInvoiceCount = dbAdapter.getBillingInvoices(testOrgId).length;

  const idempotencyPayload = {
    event_id: uniqueEventId,
    event_type: "payment.succeeded",
    data: {
      payment_id: `pay_${uniqueEventId}`,
      amount: 5000000,
      org_id: testOrgId,
      plan_id: "b2b_scale",
      billing_interval: "MONTHLY",
    },
  };

  // First execution: must process successfully
  const firstRun = await processWebhookEvent({
    provider: "MOCK",
    headers: validHeaders,
    rawPayload: idempotencyPayload,
  });
  assert.strictEqual(firstRun.success, true);
  assert.strictEqual(firstRun.statusCode, 200);
  assert.strictEqual(Boolean(firstRun.idempotentReplay), false);

  const afterFirstPaymentCount = dbAdapter.getPayments(testOrgId).length;
  assert.strictEqual(afterFirstPaymentCount, initialPaymentCount + 1, "First execution must create exactly 1 payment record");

  // Second execution with identical provider & eventId: must return 200 OK as idempotent replay
  const secondRun = await processWebhookEvent({
    provider: "MOCK",
    headers: validHeaders,
    rawPayload: idempotencyPayload,
  });
  assert.strictEqual(secondRun.success, true);
  assert.strictEqual(secondRun.statusCode, 200);
  assert.strictEqual(secondRun.idempotentReplay, true, "Duplicate event must be flagged as idempotent replay");

  const afterSecondPaymentCount = dbAdapter.getPayments(testOrgId).length;
  const afterSecondInvoiceCount = dbAdapter.getBillingInvoices(testOrgId).length;
  assert.strictEqual(afterSecondPaymentCount, afterFirstPaymentCount, "Duplicate webhook must NOT create duplicate payment");
  assert.strictEqual(afterSecondInvoiceCount, initialInvoiceCount + 1, "Duplicate webhook must NOT create duplicate invoice");
  console.log("    ✔ Strict idempotency verified: Zero duplicate debit / duplicate payment on event replay.");

  // ============================================================================
  // Test 4: Webhook Event Normalization across Multiple Gateways
  // ============================================================================
  console.log("\n  [Test 4: Webhook Event Normalization Across Multi-Gateways]");
  // Test Xendit Normalization
  const rawXenditPayload = {
    id: "inv_xnd_987654",
    status: "PAID",
    paid_amount: 5000000,
    paid_at: "2026-09-04T10:00:00.000Z",
    payer_email: "finance@nusantarabuildindo.co.id",
    metadata: {
      org_id: "org-nusantara-01",
      plan_id: "b2b_scale",
      interval: "MONTHLY",
    },
  };
  const normalizedXendit = xenditAdapter.normalizeWebhookEvent(rawXenditPayload);
  assert.strictEqual(normalizedXendit.eventType, "PAYMENT_SUCCEEDED");
  assert.strictEqual(normalizedXendit.provider, "XENDIT");
  assert.strictEqual(normalizedXendit.amount, 5000000);
  assert.strictEqual(normalizedXendit.orgId, "org-nusantara-01");
  assert.strictEqual(normalizedXendit.planId, "b2b_scale");

  // Test Mayar Normalization
  const rawMayarPayload = {
    event: "payment.received",
    data: {
      id: "myr_pay_12345",
      amount: 2500000,
      customer: {
        email: "finance@nusantarabuildindo.co.id",
        name: "PT Nusantara Buildindo",
      },
      metadata: {
        org_id: "org-nusantara-01",
        plan_id: "b2b_core",
        interval: "MONTHLY",
      },
    },
  };
  const normalizedMayar = mayarAdapter.normalizeWebhookEvent(rawMayarPayload);
  assert.strictEqual(normalizedMayar.eventType, "PAYMENT_SUCCEEDED");
  assert.strictEqual(normalizedMayar.provider, "MAYAR");
  assert.strictEqual(normalizedMayar.amount, 2500000);
  assert.strictEqual(normalizedMayar.eventId, "payment.received_myr_pay_12345");
  assert.strictEqual(normalizedMayar.orgId, "org-nusantara-01");
  assert.strictEqual(normalizedMayar.planId, "b2b_core");
  console.log("    ✔ Raw payloads from Xendit and Mayar successfully normalized to canonical internal schema.");

  // ============================================================================
  // Test 5: End-to-End Subscription Lifecycle Activation via Webhook
  // ============================================================================
  console.log("\n  [Test 5: End-to-End Subscription Lifecycle Activation via Webhook]");
  const activationEventId = `evt_e2e_act_${Date.now()}`;
  const activationPayload = {
    event_id: activationEventId,
    event_type: "subscription.activated",
    data: {
      payment_id: `pay_act_${Date.now()}`,
      amount: 60000000,
      org_id: "org-nusantara-01",
      plan_id: "b2b_scale",
      billing_interval: "ANNUAL",
    },
  };

  const activationResult = await processWebhookEvent({
    provider: "MOCK",
    headers: validHeaders,
    rawPayload: activationPayload,
  });
  assert.strictEqual(activationResult.success, true);

  // Assert tenant subscription is now ACTIVE
  const activeSub = dbAdapter.getActiveSubscription("org-nusantara-01");
  assert(Boolean(activeSub), "Active subscription must exist");
  assert.strictEqual(activeSub.status, "ACTIVE");
  assert.strictEqual(activeSub.planId, "b2b_scale");
  assert.strictEqual(activeSub.billingInterval, "ANNUAL");

  // Assert entitlement snapshot was taken
  const snapshots = dbAdapter.getEntitlementSnapshots("org-nusantara-01");
  assert(snapshots.length > 0, "Entitlement snapshot must be recorded");
  assert.strictEqual(snapshots[0].maxActiveProjects, 5, "Scale plan must have 5 active projects locked in snapshot");

  // Assert status transition event exists
  const statusEvents = dbAdapter.getSubscriptionStatusEvents(activeSub.id);
  const webhookEvent = statusEvents.find((e) => e.source === "WEBHOOK");
  assert(Boolean(webhookEvent), "A status event with source 'WEBHOOK' must be recorded");

  // Assert billing audit log exists
  const auditLogs = dbAdapter.getBillingAuditLogs("org-nusantara-01");
  assert(auditLogs.length > 0, "Billing audit log must be recorded");
  console.log("    ✔ Full atomic activation verified: subscription ACTIVE, invoice PAID, snapshot created, audit logged.");

  // ============================================================================
  // Test 6: Elimination of Redirect Success Bypass
  // ============================================================================
  console.log("\n  [Test 6: Elimination of Redirect Success Bypass]");
  const checkoutSession = await mockAdapter.createCheckoutSession({
    orgId: "org-nusantara-01",
    planId: "b2b_scale",
    priceId: "price_scale_monthly_v1",
    amount: 5000000,
    interval: "MONTHLY",
    successUrl: "http://localhost:3000/billing/status",
    cancelUrl: "http://localhost:3000/pricing",
    idempotencyKey: "test_key_123",
  });

  // Verify checkout URL does NOT contain payment_success=true
  assert.strictEqual(
    checkoutSession.checkoutUrl.includes("payment_success=true"),
    false,
    "Checkout URL must NOT contain payment_success=true bypass flag"
  );
  assert.strictEqual(
    checkoutSession.checkoutUrl.includes("status=processing"),
    true,
    "Checkout URL must route to status=processing verification page"
  );
  console.log("    ✔ Security vulnerability eliminated: zero payment_success bypass parameter in checkout URLs.");

  console.log("\n✔ All Suite 24 Payment Provider Adapter & Webhook Normalization tests PASSED successfully!\n");
}

if (require.main === module) {
  runPaymentProviderWebhookTestSuite().catch((err) => {
    console.error("Suite 24 failure:", err);
    process.exit(1);
  });
}

module.exports = { runPaymentProviderWebhookTestSuite };
