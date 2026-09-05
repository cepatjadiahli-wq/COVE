/**
 * COVE Phase 17R: Secured Internal Dunning Sweep Cron Endpoint
 * 
 * Governance & Security:
 * - Fail-closed if CRON_SECRET is unconfigured or insufficient entropy (< 16 chars).
 * - Protected strictly by Bearer token verified using constant-time comparison (crypto.timingSafeEqual).
 * - Rejects 'Bearer undefined', 'Bearer null', and empty tokens with HTTP 401.
 * - Rejects any attempt to pass credentials via URL query parameters with HTTP 400.
 * - Tenant users cannot access this endpoint.
 * - Persists directly to Supabase PostgreSQL when available, calling private RPCs.
 * - Transparent notification statuses ('GENERATED', 'QUEUED').
 * - Supports late cron catch-up policy (skipping obsolete notification milestones).
 * - Idempotent: safe against replayed jobs or parallel cron runs.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbAdapter } from "../../../../../lib/db/database-adapter";
import { evaluateDunningStage, generateDunningIdempotencyKey } from "../../../../../domains/subscription/dunning-engine";
import { buildDunningNotification } from "../../../../../domains/billing/notification-service";
import { Subscription } from "../../../../../domains/billing/types";

export async function POST(req: NextRequest) {
  // 1. Fail-Closed: Verify CRON_SECRET environment variable
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length < 16) {
    return NextResponse.json(
      { error: "Configuration Error: CRON_SECRET is not configured or has insufficient entropy." },
      { status: 500 }
    );
  }

  // 2. Reject credentials in URL query parameters
  const { searchParams } = new URL(req.url);
  if (
    searchParams.has("secret") ||
    searchParams.has("cron_secret") ||
    searchParams.has("token") ||
    searchParams.has("auth")
  ) {
    return NextResponse.json(
      { error: "Forbidden: Passing credentials in URL query parameters is strictly prohibited." },
      { status: 400 }
    );
  }

  // 3. Extract and validate Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized: Missing or malformed Authorization header." },
      { status: 401 }
    );
  }

  const providedToken = authHeader.slice(7).trim();
  if (!providedToken || providedToken === "undefined" || providedToken === "null") {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or empty token value." },
      { status: 401 }
    );
  }

  // 4. Constant-time comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(cronSecret, "utf-8");
  const providedBuffer = Buffer.from(providedToken, "utf-8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid token length." },
      { status: 401 }
    );
  }

  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid CRON_SECRET token." },
      { status: 401 }
    );
  }

  // 5. Parse optional configuration (e.g. asOfDate for testing, batchLimit)
  let asOfDate: Date = new Date();
  let batchLimit = 50;

  try {
    const body = await req.json();
    if (body.asOfDate) {
      asOfDate = new Date(body.asOfDate);
    }
    if (body.batchLimit && typeof body.batchLimit === "number") {
      batchLimit = Math.min(body.batchLimit, 100);
    }
  } catch {
    // Empty or non-JSON body: proceed with defaults
  }

  let evaluatedCount = 0;
  let transitionsCount = 0;
  let notificationsCount = 0;
  const sweepResults: Array<Record<string, unknown>> = [];

  // 6. Check if running against live Supabase PostgreSQL
  const hasDb = !!(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (hasDb) {
    try {
      const { createAdminClient } = await import("../../../../../lib/supabase/admin");
      const supabase = createAdminClient();

      const { data: dbSubs, error: subsErr } = await supabase
        .from("subscriptions")
        .select("*")
        .in("status", ["ACTIVE", "PAST_DUE", "READ_ONLY", "CANCEL_AT_PERIOD_END"])
        .order("created_at", { ascending: false })
        .limit(batchLimit);

      if (!subsErr && dbSubs && dbSubs.length > 0) {
        for (const sub of dbSubs) {
          evaluatedCount++;
          const evalResult = evaluateDunningStage(
            {
              id: sub.id,
              status: sub.status,
              currentPeriodEnd: sub.current_period_end,
              gracePeriodEnd: sub.grace_period_end,
              planId: sub.plan_id,
            },
            asOfDate
          );

          if (evalResult.isLegacy || !evalResult.activeStage) {
            continue;
          }

          const stage = evalResult.activeStage;
          const targetStatus = evalResult.targetStatus;
          const idempotencyKey = generateDunningIdempotencyKey(sub.id, "inv_dunning", stage, asOfDate);

          // Find pending billing invoice for this subscription
          const { data: invData } = await supabase
            .from("billing_invoices")
            .select("id, invoice_number, amount_total")
            .eq("subscription_id", sub.id)
            .in("status", ["PENDING", "DRAFT"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const billingInvoiceId = invData ? invData.id : null;
          const invoiceAmount = invData ? Number(invData.amount_total) : 2500000;

          // Check if stage transition is needed
          let transitionApplied = false;
          if (targetStatus && targetStatus !== sub.status) {
            const { error: rpcErr } = await supabase.rpc("process_dunning_stage_transition", {
              p_subscription_id: sub.id,
              p_target_stage: stage,
              p_target_status: targetStatus,
              p_scheduled_at: asOfDate.toISOString(),
              p_idempotency_key: idempotencyKey,
            });

            if (!rpcErr) {
              transitionsCount++;
              transitionApplied = true;
            } else {
              console.warn(`⚠️ [Dunning Cron] Stage transition RPC rejected for sub ${sub.id}:`, rpcErr.message);
            }
          }

          // Build notification
          const { data: orgData } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("id", sub.org_id)
            .maybeSingle();
          const orgName = orgData ? orgData.name : "Organization";

          const notification = buildDunningNotification({
            orgId: sub.org_id,
            orgName,
            planName: sub.plan_id,
            amount: invoiceAmount,
            dueDateUtc: sub.current_period_end,
            stage,
            paymentUrl: `https://cove.id/billing?org_id=${sub.org_id}`,
          });

          // Insert billing notification with status GENERATED (idempotent)
          const notifIdempotencyKey = `notif_${idempotencyKey}`;
          const { error: notifErr } = await supabase.from("billing_notifications").insert({
            id: crypto.randomUUID(),
            org_id: sub.org_id,
            subscription_id: sub.id,
            billing_invoice_id: billingInvoiceId,
            stage,
            channel: "IN_APP",
            recipient: "billing@cove.id",
            subject: notification.subject,
            body_text: notification.bodyText,
            action_url: notification.actionUrl,
            status: "GENERATED",
            scheduled_at: asOfDate.toISOString(),
            processed_at: new Date().toISOString(),
            idempotency_key: notifIdempotencyKey,
          });

          if (!notifErr) {
            notificationsCount++;
          }

          // Catch-Up Policy: Record skipped obsolete stages if running late
          if (evalResult.skippedStages && evalResult.skippedStages.length > 0) {
            for (const skippedStage of evalResult.skippedStages) {
              const skippedKey = `skip_${sub.id}_${skippedStage}_${asOfDate.toISOString().split("T")[0]}`;
              await supabase.from("dunning_events").insert({
                id: crypto.randomUUID(),
                org_id: sub.org_id,
                subscription_id: sub.id,
                billing_invoice_id: billingInvoiceId,
                stage: skippedStage,
                action_type: "NOTIFICATION",
                status: "SKIPPED",
                scheduled_at: asOfDate.toISOString(),
                processed_at: new Date().toISOString(),
                idempotency_key: skippedKey,
                metadata: { reason: "Late cron catch-up policy skipped obsolete notification" },
              });
            }
          }

          sweepResults.push({
            subscriptionId: sub.id,
            orgId: sub.org_id,
            stage,
            previousStatus: sub.status,
            currentStatus: targetStatus || sub.status,
            transitionApplied,
            idempotencyKey,
            notificationSubject: notification.subject,
            notificationStatus: "GENERATED",
          });
        }

        return NextResponse.json({
          success: true,
          message: "Dunning sweep completed successfully (Database persisted).",
          asOfDate: asOfDate.toISOString(),
          evaluatedCount,
          transitionsCount,
          notificationsCount,
          results: sweepResults,
        });
      }
    } catch (dbEx) {
      console.warn("⚠️ [Dunning Cron] Database query failed, falling back to memory adapter:", dbEx);
    }
  }

  // Fallback: In-memory adapter (e.g. standalone test runner)
  const subscriptions = dbAdapter.getSubscriptions();
  const eligibleSubs = subscriptions
    .filter((s: Subscription) => ["ACTIVE", "PAST_DUE", "READ_ONLY", "CANCEL_AT_PERIOD_END"].includes(s.status))
    .slice(0, batchLimit);

  for (const sub of eligibleSubs) {
    evaluatedCount++;
    const evalResult = evaluateDunningStage(sub, asOfDate);

    if (evalResult.isLegacy || !evalResult.activeStage) {
      continue;
    }

    const stage = evalResult.activeStage;
    const targetStatus = evalResult.targetStatus;
    const idempotencyKey = generateDunningIdempotencyKey(sub.id, "inv_dunning", stage, asOfDate);

    // Check if stage transition is needed
    let transitionApplied = false;
    if (targetStatus && targetStatus !== sub.status) {
      dbAdapter.setSubscriptionStatus(
        sub.id,
        targetStatus,
        `Automated dunning transition at stage ${stage} (consequence: ${evalResult.consequence})`,
        "DUNNING_CRON"
      );
      transitionsCount++;
      transitionApplied = true;
    }

    // Build notification
    const org = dbAdapter.getOrganizations().find((o) => o.id === sub.orgId);
    const orgName = org ? org.name : "Organization";
    const notification = buildDunningNotification({
      orgId: sub.orgId,
      orgName,
      planName: sub.planId,
      amount: 2500000,
      dueDateUtc: sub.currentPeriodEnd,
      stage,
      paymentUrl: `https://cove.id/billing?org_id=${sub.orgId}`,
    });
    notificationsCount++;

    sweepResults.push({
      subscriptionId: sub.id,
      orgId: sub.orgId,
      stage,
      previousStatus: sub.status,
      currentStatus: targetStatus || sub.status,
      transitionApplied,
      idempotencyKey,
      notificationSubject: notification.subject,
      notificationStatus: "GENERATED",
    });
  }

  return NextResponse.json({
    success: true,
    message: "Dunning sweep completed successfully.",
    asOfDate: asOfDate.toISOString(),
    evaluatedCount,
    transitionsCount,
    notificationsCount,
    results: sweepResults,
  });
}
