import { NextRequest, NextResponse } from "next/server";
import { processWebhookEvent } from "@/domains/billing/webhook-service";

type RouteProps = {
  params: Promise<{ provider: string }>;
};

/**
 * Health check for specific webhook provider
 */
export async function GET(req: NextRequest, props: RouteProps) {
  const { provider } = await props.params;
  return NextResponse.json({
    status: "ok",
    provider: provider.toUpperCase(),
    service: `COVE ${provider.toUpperCase()} Webhook Receiver`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Unified Webhook Receiver for All Gateway Providers (Xendit, Mayar, Mock)
 */
export async function POST(req: NextRequest, props: RouteProps) {
  try {
    const { provider } = await props.params;
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Extract headers into Record<string, string | null>
    const headers: Record<string, string | null> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result = await processWebhookEvent({
      provider: provider.toUpperCase(),
      headers,
      rawPayload: body,
      rawBody,
    });

    return NextResponse.json(result, { status: result.statusCode });
  } catch (error: any) {
    console.error(`❌ [Webhook Route Error]:`, error);
    return NextResponse.json(
      { error: "Internal server error processing webhook.", message: error.message },
      { status: 500 }
    );
  }
}
