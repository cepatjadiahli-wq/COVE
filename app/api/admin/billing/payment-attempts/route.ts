import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/server-guard";
import { adminBillingService } from "@/domains/billing/admin-service";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const result = await adminBillingService.listPaymentAttempts({ page, limit });
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
