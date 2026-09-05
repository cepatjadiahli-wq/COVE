import { NextRequest, NextResponse } from "next/server";
import { validateBillingAuth } from "@/lib/auth/server-guard";

/**
 * GET /api/auth/session
 *
 * Server-authoritative session status endpoint.
 * Reads Supabase SSR cookies, validates identity, checks org membership.
 *
 * Returns:
 *   200 — session valid, org exists, role has billing access
 *   401 — not authenticated (no valid SSR cookie)
 *   403 — authenticated but role lacks billing permission
 *   409 — authenticated but no organization / onboarding incomplete
 *
 * SECURITY:
 *   - Must not be cached (responses are user-specific)
 *   - Does not return tokens, cookies, or raw user data
 *   - Does not accept orgId from query params
 */
export async function GET(req: NextRequest) {
  const correlationId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const auth = await validateBillingAuth(req);

    const body = {
      authenticated: auth.authorized,
      hasOrg: auth.authorized ? !!auth.user?.orgId : false,
      role: auth.authorized ? auth.user?.role : undefined,
      correlationId,
    };

    return NextResponse.json(body, {
      status: auth.statusCode,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Correlation-ID": correlationId,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { authenticated: false, correlationId },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Correlation-ID": correlationId,
        },
      }
    );
  }
}
