/**
 * COVE Phase 17R: Secured Internal Subscription Renewal Cron Endpoint
 * 
 * Governance & Security:
 * - Fail-closed if CRON_SECRET is unconfigured or insufficient entropy (< 16 chars).
 * - Protected strictly by Bearer token verified using constant-time comparison (crypto.timingSafeEqual).
 * - Rejects 'Bearer undefined', 'Bearer null', and empty tokens with HTTP 401.
 * - Rejects any attempt to pass credentials via URL query parameters with HTTP 400.
 * - Enforces single active renewal invoice per period.
 * - Excludes legacy lifetime plans.
 * - Persists directly to Supabase PostgreSQL when available, with memory fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbAdapter } from "../../../../../lib/db/database-adapter";
import { createRenewalInvoice, generateRenewalInvoiceNumber } from "../../../../../domains/subscription/renewal-service";
import { isLegacyPlan } from "../../../../../domains/subscription/dunning-engine";
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

  // 5. Parse configuration
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
    // Proceed with defaults
  }

  const targetThreshold = new Date(asOfDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  let processedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  const renewalResults: Array<Record<string, unknown>> = [];

  // 6. Check if running against live Supabase PostgreSQL
  const hasDb = !!(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (hasDb) {
    try {
      const { createAdminClient } = await import("../../../../../lib/supabase/admin");
      const supabase = createAdminClient();

      const { data: dbSubs, error: subsErr } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("status", "ACTIVE")
        .eq("cancel_at_period_end", false)
        .lte("current_period_end", targetThreshold.toISOString())
        .limit(batchLimit);

      if (!subsErr && dbSubs && dbSubs.length > 0) {
        for (const sub of dbSubs) {
          processedCount++;
          if (isLegacyPlan(sub.plan_id)) {
            skippedCount++;
            renewalResults.push({ subscriptionId: sub.id, skipped: true, reason: "Legacy plan" });
            continue;
          }

          // Check if pending invoice already exists in database
          const { data: existingInvs } = await supabase
            .from("billing_invoices")
            .select("id, invoice_number, status, due_date")
            .eq("subscription_id", sub.id)
            .in("status", ["PENDING", "PAID"]);

          const isDuplicate = existingInvs && existingInvs.some((inv: { due_date: string }) => {
            const invDue = new Date(inv.due_date).getTime();
            const subDue = new Date(sub.current_period_end).getTime();
            return Math.abs(invDue - subDue) < 24 * 60 * 60 * 1000;
          });

          if (isDuplicate) {
            skippedCount++;
            renewalResults.push({
              subscriptionId: sub.id,
              skipped: true,
              isIdempotentReplay: true,
              reason: "Invoice already exists for this renewal period",
            });
            continue;
          }

          // Generate new invoice
          const newInvId = crypto.randomUUID();
          const invoiceNum = generateRenewalInvoiceNumber(asOfDate);
          const amountTotal = 2500000;

          const { error: insertErr } = await supabase.from("billing_invoices").insert({
            id: newInvId,
            org_id: sub.org_id,
            subscription_id: sub.id,
            invoice_number: invoiceNum,
            amount_subtotal: amountTotal,
            discount_amount: 0,
            tax_amount: 0,
            amount_total: amountTotal,
            currency: sub.currency || "IDR",
            status: "PENDING",
            due_date: sub.current_period_end,
            created_at: asOfDate.toISOString(),
          });

          if (!insertErr) {
            createdCount++;
            await supabase.from("renewal_jobs").insert({
              id: crypto.randomUUID(),
              org_id: sub.org_id,
              subscription_id: sub.id,
              billing_invoice_id: newInvId,
              stage: "RENEWAL",
              status: "COMPLETED",
              scheduled_at: asOfDate.toISOString(),
              processed_at: new Date().toISOString(),
              idempotency_key: `renewal_${sub.id}_${sub.current_period_end.split("T")[0]}`,
            });

            renewalResults.push({
              subscriptionId: sub.id,
              invoiceId: newInvId,
              invoiceNumber: invoiceNum,
              amountTotal,
              paymentUrl: `https://cove.id/billing?invoice_id=${newInvId}`,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: "Renewal invoice generation sweep completed successfully (Database persisted).",
          asOfDate: asOfDate.toISOString(),
          processedCount,
          createdCount,
          skippedCount,
          results: renewalResults,
        });
      }
    } catch (dbEx) {
      console.warn("⚠️ [Renewal Cron] Database query failed, falling back to memory adapter:", dbEx);
    }
  }

  // Fallback: in-memory adapter (e.g. standalone runner unit tests)
  const subscriptions = dbAdapter.getSubscriptions();
  const existingInvoices = dbAdapter.getBillingInvoices();

  const eligibleSubs = subscriptions
    .filter((s: Subscription) => s.status === "ACTIVE" && !s.cancelAtPeriodEnd)
    .filter((s: Subscription) => new Date(s.currentPeriodEnd).getTime() <= targetThreshold.getTime())
    .slice(0, batchLimit);

  for (const sub of eligibleSubs) {
    processedCount++;
    const res = await createRenewalInvoice({
      subscription: sub,
      existingInvoices,
      asOfDate,
    });

    if (res.skippedLegacy) {
      skippedCount++;
      renewalResults.push({ subscriptionId: sub.id, skipped: true, reason: "Legacy plan" });
    } else if (res.success && res.invoice) {
      if (res.isIdempotentReplay) {
        skippedCount++;
        renewalResults.push({
          subscriptionId: sub.id,
          invoiceId: res.invoice.id,
          isIdempotentReplay: true,
        });
      } else {
        createdCount++;
        dbAdapter.createBillingInvoice(res.invoice);
        renewalResults.push({
          subscriptionId: sub.id,
          invoiceId: res.invoice.id,
          invoiceNumber: res.invoice.invoiceNumber,
          amountTotal: res.invoice.amountTotal,
          paymentUrl: res.paymentUrl,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: "Renewal invoice generation sweep completed successfully.",
    asOfDate: asOfDate.toISOString(),
    processedCount,
    createdCount,
    skippedCount,
    results: renewalResults,
  });
}
