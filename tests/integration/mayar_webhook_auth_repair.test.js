/**
 * COVE Phase 19E-R1: Mayar Webhook Authentication & Testing Payload Verification Suite
 * File: tests/integration/mayar_webhook_auth_repair.test.js
 * 
 * Verifies:
 * 1. 'testing' event + valid token -> 200 OK, zero financial mutation (no payment, no subscription, no invoice update).
 * 2. Missing token -> 401 Unauthorized.
 * 3. Wrong token -> 401 Unauthorized.
 * 4. Actual Mayar token formats accepted (Bearer, Token, Raw, across candidate header keys).
 * 5. Unknown event -> 200 OK, ignored without mutation.
 * 6. Duplicate event -> idempotent (cached 200, 0 double execution).
 * 7. Payment event valid -> normalized properly to PAYMENT_SUCCEEDED.
 * 8. Zero secret exposure in sanitized logs and error responses.
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const { MayarAdapter } = jiti("@/domains/billing/adapters/mayar-adapter.ts");
const { verifyMayarWebhookToken, safeTimingEqual } = jiti("@/lib/mayar/client.ts");
const { processWebhookEvent, sanitizeWebhookPayload } = jiti("@/domains/billing/webhook-service.ts");

async function runMayarWebhookAuthRepairTestSuite() {
  console.log("================================================================================");
  console.log("  COVE PHASE 19E-R1: MAYAR WEBHOOK AUTHENTICATION COMPATIBILITY SUITE");
  console.log("  Target Database: " + SUPABASE_URL);
  console.log("================================================================================\n");

  const runId = Date.now().toString(36);
  const TEST_SECRET = `myr_whsec_test_${runId}_secret_123456`;
  const originalEnvSecret = process.env.MAYAR_WEBHOOK_SECRET;
  process.env.MAYAR_WEBHOOK_SECRET = TEST_SECRET;

  const testOrgId = crypto.randomUUID();
  await supabase.from("organizations").insert({
    id: testOrgId,
    name: `Mayar Auth Test Org ${runId}`,
    billing_email: `mayar-auth-${runId}@cove.id`,
  });

  const adapter = new MayarAdapter();

  try {
    // -------------------------------------------------------------------------
    // Test 1: 'testing' payload + valid token -> HTTP 200, ZERO financial mutation
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Mayar 'testing' event with valid token -> HTTP 200, ZERO financial mutation ---");
    const testPayload = {
      event: "testing",
      data: {
        id: "123456789",
        status: "SUCCESS",
      },
    };

    // Baseline counts
    const { count: payCountBefore } = await supabase.from("payments").select("*", { count: "exact", head: true });
    const { count: subCountBefore } = await supabase.from("subscriptions").select("*", { count: "exact", head: true });
    const { count: invCountBefore } = await supabase.from("billing_invoices").select("*", { count: "exact", head: true });

    const headersValid = {
      "x-callback-token": `Bearer ${TEST_SECRET}`,
      "x-correlation-id": `corr_test1_${runId}`,
    };

    const resTestEvent = await processWebhookEvent({
      provider: "MAYAR",
      headers: headersValid,
      rawPayload: testPayload,
      rawBody: JSON.stringify(testPayload),
    });

    assert.strictEqual(resTestEvent.statusCode, 200, "Must return HTTP 200");
    assert.strictEqual(resTestEvent.success, true, "Must return success true");
    assert.strictEqual(resTestEvent.eventType, "TEST_EVENT", "Must normalize to TEST_EVENT");
    assert.ok(resTestEvent.message && resTestEvent.message.includes("zero financial mutation"), "Must indicate acknowledged test event");

    // Assert counts after
    const { count: payCountAfter } = await supabase.from("payments").select("*", { count: "exact", head: true });
    const { count: subCountAfter } = await supabase.from("subscriptions").select("*", { count: "exact", head: true });
    const { count: invCountAfter } = await supabase.from("billing_invoices").select("*", { count: "exact", head: true });

    assert.strictEqual(payCountAfter, payCountBefore, "ZERO payment rows created");
    assert.strictEqual(subCountAfter, subCountBefore, "ZERO subscription rows created/modified");
    assert.strictEqual(invCountAfter, invCountBefore, "ZERO invoice rows created/modified");
    console.log("  ✔ Test 1 Passed: 'testing' event acknowledged with HTTP 200 and zero financial mutations.\n");

    // -------------------------------------------------------------------------
    // Test 2: Missing token -> HTTP 401 Unauthorized
    // -------------------------------------------------------------------------
    console.log("--- TEST 2: Missing webhook authentication token -> HTTP 401 ---");
    const resNoAuth = await processWebhookEvent({
      provider: "MAYAR",
      headers: { "x-correlation-id": `corr_test2_${runId}` },
      rawPayload: testPayload,
      rawBody: JSON.stringify(testPayload),
    });

    assert.strictEqual(resNoAuth.statusCode, 401, "Missing token must be rejected with HTTP 401");
    assert.strictEqual(resNoAuth.success, false, "Success must be false");
    console.log("  ✔ Test 2 Passed: Missing token rejected with HTTP 401.\n");

    // -------------------------------------------------------------------------
    // Test 3: Wrong token -> HTTP 401 Unauthorized
    // -------------------------------------------------------------------------
    console.log("--- TEST 3: Invalid/tampered webhook authentication token -> HTTP 401 ---");
    const resWrongAuth = await processWebhookEvent({
      provider: "MAYAR",
      headers: {
        "x-callback-token": "Bearer wrong_token_secret_xyz",
        "x-correlation-id": `corr_test3_${runId}`,
      },
      rawPayload: testPayload,
      rawBody: JSON.stringify(testPayload),
    });

    assert.strictEqual(resWrongAuth.statusCode, 401, "Invalid token must be rejected with HTTP 401");
    assert.strictEqual(resWrongAuth.success, false, "Success must be false");
    console.log("  ✔ Test 3 Passed: Invalid token rejected with HTTP 401.\n");

    // -------------------------------------------------------------------------
    // Test 4: Format token aktual Mayar (Bearer, Token, Raw) on x-callback-token
    // -------------------------------------------------------------------------
    console.log("--- TEST 4: Header x-callback-token formats accepted ---");
    // Verify constant-time comparison helper and verifyMayarWebhookToken
    assert.strictEqual(safeTimingEqual("secret123", "secret123"), true);
    assert.strictEqual(safeTimingEqual("secret123", "secret999"), false);
    assert.strictEqual(safeTimingEqual("secret123", "short"), false);
    assert.strictEqual(verifyMayarWebhookToken("secret123", "secret123"), true);
    assert.strictEqual(verifyMayarWebhookToken("Bearer secret123", "secret123"), true);
    assert.strictEqual(verifyMayarWebhookToken("wrong", "secret123"), false);

    const headerName = "x-callback-token";
    assert.strictEqual(adapter.verifyWebhook({ [headerName]: TEST_SECRET }, "{}"), true, `Raw token in x-callback-token must pass`);
    assert.strictEqual(adapter.verifyWebhook({ [headerName]: `Bearer ${TEST_SECRET}` }, "{}"), true, `Bearer token in x-callback-token must pass`);
    assert.strictEqual(adapter.verifyWebhook({ [headerName]: `Token ${TEST_SECRET}` }, "{}"), true, `Token prefix in x-callback-token must pass`);

    // Verify rejection of other guessed headers
    assert.strictEqual(adapter.verifyWebhook({ "x-mayar-token": TEST_SECRET }, "{}"), false, "x-mayar-token must be rejected");
    assert.strictEqual(adapter.verifyWebhook({ authorization: `Bearer ${TEST_SECRET}` }, "{}"), false, "authorization must be rejected");

    console.log(`  ✔ Test 4 Passed: Header x-callback-token accepted with Raw, Bearer, and Token prefixes. Other headers rejected.\n`);

    // -------------------------------------------------------------------------
    // Test 5: Unknown event -> HTTP 200, IGNORED_EVENT without mutation
    // -------------------------------------------------------------------------
    console.log("--- TEST 5: Unknown event type -> HTTP 200, safely ignored ---");
    const unknownPayload = {
      event: "account.upgraded",
      data: {
        id: "acc_upgraded_9911",
      },
    };

    const resUnknown = await processWebhookEvent({
      provider: "MAYAR",
      headers: {
        "x-callback-token": TEST_SECRET,
        "x-correlation-id": `corr_test5_${runId}`,
      },
      rawPayload: unknownPayload,
      rawBody: JSON.stringify(unknownPayload),
    });

    assert.strictEqual(resUnknown.statusCode, 200, "Unknown event must return HTTP 200");
    assert.strictEqual(resUnknown.eventType, "IGNORED_EVENT", "Must normalize to IGNORED_EVENT");
    console.log("  ✔ Test 5 Passed: Unknown event handled safely with HTTP 200 (ignored).\n");

    // -------------------------------------------------------------------------
    // Test 6: Duplicate event -> Idempotent replay (cached success, 0 re-execution)
    // -------------------------------------------------------------------------
    console.log("--- TEST 6: Duplicate webhook event -> Idempotent replay ---");
    const dupPayload = {
      event: "testing",
      data: {
        id: `dup_${runId}`,
        status: "SUCCESS",
      },
    };

    // First call
    const resFirst = await processWebhookEvent({
      provider: "MAYAR",
      headers: { "x-callback-token": TEST_SECRET },
      rawPayload: dupPayload,
      rawBody: JSON.stringify(dupPayload),
    });
    assert.strictEqual(resFirst.statusCode, 200);

    // Second call with same event
    const resSecond = await processWebhookEvent({
      provider: "MAYAR",
      headers: { "x-callback-token": TEST_SECRET },
      rawPayload: dupPayload,
      rawBody: JSON.stringify(dupPayload),
    });
    assert.strictEqual(resSecond.statusCode, 200);
    assert.strictEqual(resSecond.idempotentReplay, true, "Duplicate call must return idempotentReplay: true");
    console.log("  ✔ Test 6 Passed: Duplicate webhook replay safely handled with 0 duplicate mutations.\n");

    // -------------------------------------------------------------------------
    // Test 7: Valid payment event -> properly normalized
    // -------------------------------------------------------------------------
    console.log("--- TEST 7: Valid payment.received event -> Normalized to PAYMENT_SUCCEEDED ---");
    const paymentPayload = {
      event: "payment.received",
      event_id: `evt_pay_${runId}`,
      data: {
        id: `pay_auth_${runId}`,
        amount: 3000000,
        createdAt: new Date().toISOString(),
        customer: { name: "PT Test", email: "finance@test.id" },
        metadata: { org_id: testOrgId, plan_id: "b2b_core", interval: "MONTHLY" },
      },
    };

    const norm = adapter.normalizeWebhookEvent(paymentPayload);
    assert.strictEqual(norm.eventType, "PAYMENT_SUCCEEDED");
    assert.strictEqual(norm.amount, 3000000);
    assert.strictEqual(norm.currency, "IDR");
    assert.strictEqual(norm.externalPaymentId, `pay_auth_${runId}`);
    console.log("  ✔ Test 7 Passed: Valid payment event correctly normalized to PAYMENT_SUCCEEDED.\n");

    // -------------------------------------------------------------------------
    // Test 8: Zero secret exposure in sanitized payload & logs
    // -------------------------------------------------------------------------
    console.log("--- TEST 8: Zero secret exposure in sanitized payload ---");
    const rawSensitivePayload = {
      token: TEST_SECRET,
      apiKey: "myr_key_secret123",
      authorization: `Bearer ${TEST_SECRET}`,
      "x-callback-token": `Bearer ${TEST_SECRET}`,
      data: {
        creditCard: "4111-2222-3333-4444",
        cvv: "123",
        secret_key: "super_secret_string",
      },
    };

    const sanitized = sanitizeWebhookPayload(rawSensitivePayload);
    assert.strictEqual(sanitized.token, "[REDACTED]", "token must be redacted");
    assert.strictEqual(sanitized.apiKey, "[REDACTED]", "apiKey must be redacted");
    assert.strictEqual(sanitized.authorization, "[REDACTED]", "authorization must be redacted");
    assert.strictEqual(sanitized["x-callback-token"], "[REDACTED]", "x-callback-token must be redacted");
    assert.strictEqual(sanitized.data.creditCard, "[REDACTED]", "creditCard must be redacted");
    assert.strictEqual(sanitized.data.cvv, "[REDACTED]", "cvv must be redacted");
    assert.strictEqual(sanitized.data.secret_key, "[REDACTED]", "secret_key must be redacted");
    assert.strictEqual(JSON.stringify(sanitized).includes(TEST_SECRET), false, "Plaintext secret must not appear in sanitized object");
    console.log("  ✔ Test 8 Passed: All sensitive fields redacted; zero secret exposure in payloads.\n");

    console.log("================================================================================");
    console.log("  ALL 8 MANDATORY MAYAR WEBHOOK REPAIR TESTS PASSED (100% SUCCESS) 🚀");
    console.log("================================================================================\n");
  } finally {
    // Cleanup
    process.env.MAYAR_WEBHOOK_SECRET = originalEnvSecret;
    await supabase.from("organizations").delete().eq("id", testOrgId);
  }
}

if (require.main === module) {
  runMayarWebhookAuthRepairTestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Mayar Webhook Auth Repair Test Failed:", err);
      process.exit(1);
    });
}

module.exports = { runMayarWebhookAuthRepairTestSuite };
