import { NextRequest, NextResponse } from "next/server";
import { processWebhookEvent } from "@/domains/billing/webhook-service";
import { logBillingEvent } from "@/domains/billing/observability";

/**
 * Health check for Mayar webhook configuration
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "COVE Mayar Webhook Listener",
    timestamp: new Date().toISOString(),
    configured: Boolean(process.env.MAYAR_WEBHOOK_SECRET),
  });
}

/**
 * Main Webhook Receiver from Mayar.id
 */
export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("x-correlation-id") || req.headers.get("x-request-id") || `corr_${Date.now()}`;
  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      logBillingEvent("warn", "Malformed JSON payload received in Mayar webhook route", {
        correlationId,
        provider: "MAYAR",
        status: "BLOCKED",
        errorCategory: "VALIDATION",
      });
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Extract all headers into lowercase dictionary to ensure zero header truncation
    const headers: Record<string, string | null> = {};
    const headerNames: string[] = [];
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      headers[lowerKey] = value;
      headerNames.push(lowerKey);
    });

    if (!headers["x-correlation-id"]) {
      headers["x-correlation-id"] = correlationId;
    }

    // Safe Temporary Diagnostics (Phase 19E-R1):
    // Log non-sensitive header names and presence booleans ONLY.
    // NEVER log values of authorization, token, apiKey, secret, cookie, or payload!
    if (process.env.NODE_ENV !== "test") {
      console.log(`[Mayar Webhook Diagnostic] Header Names Received: [${headerNames.join(", ")}]`);
      console.log(`[Mayar Webhook Diagnostic] Auth Header Presence:`, {
        hasAuthorization: Boolean(headers["authorization"]),
        hasXMayarToken: Boolean(headers["x-mayar-token"]),
        hasXMayarSignature: Boolean(headers["x-mayar-signature"]),
        hasXMayarSecret: Boolean(headers["x-mayar-secret"]),
        hasXMayarWebhookToken: Boolean(headers["x-mayar-webhook-token"]),
        hasXCallbackToken: Boolean(headers["x-callback-token"]),
        hasXWebhookToken: Boolean(headers["x-webhook-token"]),
        hasMayarToken: Boolean(headers["mayar-token"]),
        hasMayarSignature: Boolean(headers["mayar-signature"]),
        hasXApiKey: Boolean(headers["x-api-key"]),
        hasToken: Boolean(headers["token"]),
      });
    }

    const result = await processWebhookEvent({
      provider: "MAYAR",
      headers,
      rawPayload: body,
      rawBody,
    });

    return NextResponse.json(result, { status: result.statusCode });
  } catch (error: any) {
    logBillingEvent("error", `Internal server error in Mayar webhook route: ${error.message}`, {
      correlationId,
      provider: "MAYAR",
      status: "FAILED",
      errorCategory: "GATEWAY_ERROR",
    });
    return NextResponse.json(
      { error: "Internal server error processing webhook.", message: error.message },
      { status: 500 }
    );
  }
}
