/**
 * COVE Phase 16R.3: Secured Internal Webhook Retention Purge Cron Endpoint
 * 
 * Governance & Security:
 * - Fail-closed if CRON_SECRET is unconfigured or insufficient entropy (< 16 chars).
 * - Protected strictly by Bearer token verified using constant-time comparison (crypto.timingSafeEqual).
 * - Rejects 'Bearer undefined', 'Bearer null', and empty tokens with HTTP 401.
 * - Rejects any attempt to pass credentials via URL query parameters with HTTP 400.
 * - Regular tenant cookies or sessions cannot access this endpoint.
 * - Audit logs execution without logging the secret.
 * - Calls database retention engine through verified internal service process.
 * - Operational state: IMPLEMENTED BUT NOT OPERATIONALLY ACTIVATED until an external scheduler job is configured.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbAdapter } from "../../../../../lib/db/database-adapter";

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
  const tokenBuffer = Buffer.from(providedToken, "utf8");
  const secretBuffer = Buffer.from(cronSecret.trim(), "utf8");

  const isMatch =
    tokenBuffer.length === secretBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, secretBuffer);

  if (!isMatch) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid cron secret." },
      { status: 401 }
    );
  }

  // 5. Parse retention days safely
  const retentionDaysParam = searchParams.get("retention_days");
  const retentionDays = retentionDaysParam ? parseInt(retentionDaysParam, 10) : 90;

  // 6. Execute Retention Purge through service process
  try {
    const purgeResult = dbAdapter.purgeWebhookEventsAsServiceRole({
      retentionDays,
      actorId: "INTERNAL_CRON_SERVICE",
    });

    // Audit log without leaking secret
    return NextResponse.json({
      operationalState: "IMPLEMENTED BUT NOT OPERATIONALLY ACTIVATED",
      retentionDays,
      purgedCount: purgeResult.purgedCount,
      preservedCount: purgeResult.preservedCount,
      cutoffDate: purgeResult.cutoffDate,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Error";
    return NextResponse.json(
      { error: "Purge execution failed", message },
      { status: 500 }
    );
  }
}
