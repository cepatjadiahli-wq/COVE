import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/server-guard";
import { adminBillingService } from "@/domains/billing/admin-service";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }

  const { searchParams } = new URL(req.url);
  const asOfDate = searchParams.get("asOfDate") || undefined;
  const excludeDemo = searchParams.get("excludeDemo") === "true";

  try {
    const metrics = await adminBillingService.getSaasMetrics({ asOfDate, excludeDemoTenants: excludeDemo });
    return NextResponse.json({ success: true, data: metrics });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }

  try {
    const body = await req.json();
    const result = await adminBillingService.createMetricsSnapshot({
      periodType: body.periodType || "DAILY",
      snapshotDate: body.snapshotDate || new Date().toISOString().split("T")[0],
      isLocked: body.isLocked || false,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
  }
}
